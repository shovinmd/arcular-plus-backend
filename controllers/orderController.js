const Order = require('../models/Order');
const User = require('../models/User');
const Pharmacy = require('../models/Pharmacy');
const nodemailer = require('nodemailer');

// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'shovinmicheldavid1285@gmail.com',
    pass: process.env.EMAIL_PASS || 'qybb pcvk fact dnly'
  }
});

// Send email function
const sendEmail = async (to, subject, html) => {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER || 'shovinmicheldavid1285@gmail.com',
      to: to,
      subject: subject,
      html: html
    });
    console.log(`✅ Email sent to ${to}`);
  } catch (error) {
    console.error('❌ Error sending email:', error);
    throw error;
  }
};

// Create new order
const createOrder = async (req, res) => {
  try {
    const { userId, pharmacyId, items, deliveryAddress, deliveryCity, deliveryState, deliveryPincode, deliveryPhone, notes } = req.body;

    // Validate required fields
    if (!userId || !pharmacyId || !items || !deliveryAddress || !deliveryCity || !deliveryState || !deliveryPincode || !deliveryPhone) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Validate items
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Order must contain at least one item'
      });
    }

    // Calculate total amount
    const totalAmount = items.reduce((total, item) => total + (item.price * item.quantity), 0);

    // Create order
    const order = new Order({
      userId,
      pharmacyId,
      items,
      totalAmount,
      deliveryAddress,
      deliveryCity,
      deliveryState,
      deliveryPincode,
      deliveryPhone,
      notes,
      paymentMethod: 'cod', // Payment on delivery
      paymentStatus: 'pending'
    });

    await order.save();

    // Get user and pharmacy details for email
    const user = await User.findOne({ uid: userId });
    const pharmacy = await Pharmacy.findOne({ uid: pharmacyId });

    // Send confirmation email to user
    if (user && user.email) {
      await sendOrderConfirmationEmail(user.email, order, user, pharmacy);
    }

    // Send notification to pharmacy
    if (pharmacy && pharmacy.email) {
      await sendOrderNotificationToPharmacy(pharmacy.email, order, user, pharmacy);
    }

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: order
    });

  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get orders by user
const getOrdersByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const orders = await Order.findByUser(userId);
    
    res.json({
      success: true,
      data: orders
    });
  } catch (error) {
    console.error('Error fetching user orders:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get orders by pharmacy
const getOrdersByPharmacy = async (req, res) => {
  try {
    const { pharmacyId } = req.params;
    const orders = await Order.findByPharmacy(pharmacyId);
    
    res.json({
      success: true,
      data: orders
    });
  } catch (error) {
    console.error('Error fetching pharmacy orders:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Update order status
const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, notes } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    const order = await Order.updateStatus(orderId, status, notes);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Get user details for notification
    const user = await User.findOne({ uid: order.userId });
    
    // Send status update email to user
    if (user && user.email) {
      await sendOrderStatusUpdateEmail(user.email, order, user);
    }

    res.json({
      success: true,
      message: 'Order status updated successfully',
      data: order
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Add tracking information
const addTracking = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { trackingNumber, estimatedDelivery } = req.body;

    if (!trackingNumber) {
      return res.status(400).json({
        success: false,
        message: 'Tracking number is required'
      });
    }

    const order = await Order.addTracking(orderId, trackingNumber, estimatedDelivery);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Get user details for notification
    const user = await User.findOne({ uid: order.userId });
    
    // Send tracking update email to user
    if (user && user.email) {
      await sendTrackingUpdateEmail(user.email, order, user);
    }

    res.json({
      success: true,
      message: 'Tracking information added successfully',
      data: order
    });
  } catch (error) {
    console.error('Error adding tracking:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Mark order as delivered
const markDelivered = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.markDelivered(orderId);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Get user details for notification
    const user = await User.findOne({ uid: order.userId });
    
    // Send delivery confirmation email to user
    if (user && user.email) {
      await sendDeliveryConfirmationEmail(user.email, order, user);
    }

    res.json({
      success: true,
      message: 'Order marked as delivered successfully',
      data: order
    });
  } catch (error) {
    console.error('Error marking order as delivered:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Email service functions
const sendOrderConfirmationEmail = async (userEmail, order, user, pharmacy) => {
  try {
    const subject = `Order Confirmation - ${order.orderId}`;
    const html = `
      <h2>Order Confirmation</h2>
      <p>Dear ${user.fullName},</p>
      <p>Your order has been placed successfully!</p>
      
      <h3>Order Details:</h3>
      <p><strong>Order ID:</strong> ${order.orderId}</p>
      <p><strong>Pharmacy:</strong> ${pharmacy?.pharmacyName || 'N/A'}</p>
      <p><strong>Total Amount:</strong> ₹${order.totalAmount}</p>
      <p><strong>Payment Method:</strong> Cash on Delivery</p>
      
      <h3>Items Ordered:</h3>
      <ul>
        ${order.items.map(item => `<li>${item.medicineName} - Qty: ${item.quantity} - ₹${item.price}</li>`).join('')}
      </ul>
      
      <h3>Delivery Address:</h3>
      <p>${order.deliveryAddress}<br>
      ${order.deliveryCity}, ${order.deliveryState} - ${order.deliveryPincode}<br>
      Phone: ${order.deliveryPhone}</p>
      
      <p>You will receive updates about your order status via email and app notifications.</p>
      <p>Thank you for choosing our service!</p>
    `;
    
    await sendEmail(userEmail, subject, html);
  } catch (error) {
    console.error('Error sending order confirmation email:', error);
  }
};

const sendOrderNotificationToPharmacy = async (pharmacyEmail, order, user, pharmacy) => {
  try {
    const subject = `New Order Received - ${order.orderId}`;
    const html = `
      <h2>New Order Received</h2>
      <p>You have received a new order from ${user.fullName}.</p>
      
      <h3>Order Details:</h3>
      <p><strong>Order ID:</strong> ${order.orderId}</p>
      <p><strong>Customer:</strong> ${user.fullName}</p>
      <p><strong>Total Amount:</strong> ₹${order.totalAmount}</p>
      <p><strong>Payment Method:</strong> Cash on Delivery</p>
      
      <h3>Items Ordered:</h3>
      <ul>
        ${order.items.map(item => `<li>${item.medicineName} - Qty: ${item.quantity} - ₹${item.price}</li>`).join('')}
      </ul>
      
      <h3>Delivery Address:</h3>
      <p>${order.deliveryAddress}<br>
      ${order.deliveryCity}, ${order.deliveryState} - ${order.deliveryPincode}<br>
      Phone: ${order.deliveryPhone}</p>
      
      <p>Please process this order and update the status in your pharmacy dashboard.</p>
    `;
    
    await sendEmail(pharmacyEmail, subject, html);
  } catch (error) {
    console.error('Error sending order notification to pharmacy:', error);
  }
};

const sendOrderStatusUpdateEmail = async (userEmail, order, user) => {
  try {
    const subject = `Order Status Update - ${order.orderId}`;
    const html = `
      <h2>Order Status Update</h2>
      <p>Dear ${user.fullName},</p>
      <p>Your order status has been updated.</p>
      
      <h3>Order Details:</h3>
      <p><strong>Order ID:</strong> ${order.orderId}</p>
      <p><strong>Status:</strong> ${order.status.toUpperCase()}</p>
      ${order.pharmacyNotes ? `<p><strong>Notes:</strong> ${order.pharmacyNotes}</p>` : ''}
      
      <p>You can track your order in the app or contact the pharmacy for more details.</p>
    `;
    
    await sendEmail(userEmail, subject, html);
  } catch (error) {
    console.error('Error sending order status update email:', error);
  }
};

const sendTrackingUpdateEmail = async (userEmail, order, user) => {
  try {
    const subject = `Order Shipped - ${order.orderId}`;
    const html = `
      <h2>Your Order Has Been Shipped!</h2>
      <p>Dear ${user.fullName},</p>
      <p>Great news! Your order has been shipped and is on its way.</p>
      
      <h3>Order Details:</h3>
      <p><strong>Order ID:</strong> ${order.orderId}</p>
      <p><strong>Tracking Number:</strong> ${order.trackingNumber}</p>
      <p><strong>Estimated Delivery:</strong> ${order.estimatedDelivery ? new Date(order.estimatedDelivery).toLocaleDateString() : 'TBD'}</p>
      
      <p>You can track your order using the tracking number provided above.</p>
    `;
    
    await sendEmail(userEmail, subject, html);
  } catch (error) {
    console.error('Error sending tracking update email:', error);
  }
};

const sendDeliveryConfirmationEmail = async (userEmail, order, user) => {
  try {
    const subject = `Order Delivered - ${order.orderId}`;
    const html = `
      <h2>Order Delivered Successfully!</h2>
      <p>Dear ${user.fullName},</p>
      <p>Your order has been delivered successfully!</p>
      
      <h3>Order Details:</h3>
      <p><strong>Order ID:</strong> ${order.orderId}</p>
      <p><strong>Delivered On:</strong> ${new Date(order.actualDelivery).toLocaleDateString()}</p>
      <p><strong>Total Amount:</strong> ₹${order.totalAmount}</p>
      
      <p>Thank you for your order! We hope you're satisfied with your purchase.</p>
      <p>If you have any questions or concerns, please contact our support team.</p>
    `;
    
    await sendEmail(userEmail, subject, html);
  } catch (error) {
    console.error('Error sending delivery confirmation email:', error);
  }
};

module.exports = {
  createOrder,
  getOrdersByUser,
  getOrdersByPharmacy,
  updateOrderStatus,
  addTracking,
  markDelivered
};
