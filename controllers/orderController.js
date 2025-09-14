const Order = require('../models/Order');
const User = require('../models/User');
const Pharmacy = require('../models/Pharmacy');
const nodemailer = require('nodemailer');

// Email configuration
const createTransporter = () => {
  return nodemailer.createTransporter({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

// Send email notification
const sendEmail = async (to, subject, html) => {
  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: to,
      subject: subject,
      html: html
    });
    console.log(`✅ Email sent to ${to}: ${subject}`);
  } catch (error) {
    console.error('❌ Error sending email:', error);
  }
};

// Place a new order
const placeOrder = async (req, res) => {
  try {
    const { userId, items, userAddress, deliveryMethod, paymentMethod, userNotes } = req.body;
    
    console.log('🛒 Placing order for user:', userId);
    console.log('📦 Order items:', items.length);
    
    // Get user information
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    // Calculate totals
    let subtotal = 0;
    const processedItems = [];
    
    for (const item of items) {
      const totalPrice = item.sellingPrice * item.quantity;
      subtotal += totalPrice;
      
      processedItems.push({
        medicineId: item.id,
        medicineName: item.name,
        category: item.category,
        type: item.type,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        sellingPrice: item.sellingPrice,
        totalPrice: totalPrice
      });
    }
    
    const deliveryFee = deliveryMethod === 'Home Delivery' ? 50 : 0;
    const totalAmount = subtotal + deliveryFee;
    
    // Get pharmacy information (from first item)
    const pharmacy = await Pharmacy.findById(items[0].pharmacyId);
    if (!pharmacy) {
      return res.status(404).json({
        success: false,
        error: 'Pharmacy not found'
      });
    }
    
    // Create order
    const order = new Order({
      userId: userId,
      userName: user.name,
      userEmail: user.email,
      userPhone: user.phoneNumber || 'Not provided',
      userAddress: userAddress,
      pharmacyId: pharmacy._id,
      pharmacyName: pharmacy.pharmacyName,
      pharmacyEmail: pharmacy.email,
      pharmacyPhone: pharmacy.mobileNumber,
      pharmacyAddress: {
        street: pharmacy.address,
        city: pharmacy.city,
        state: pharmacy.state,
        pincode: pharmacy.pincode
      },
      items: processedItems,
      subtotal: subtotal,
      deliveryFee: deliveryFee,
      totalAmount: totalAmount,
      deliveryMethod: deliveryMethod,
      paymentMethod: paymentMethod,
      userNotes: userNotes,
      statusHistory: [{
        status: 'Pending',
        timestamp: new Date(),
        note: 'Order placed',
        updatedBy: 'user'
      }]
    });
    
    await order.save();
    
    console.log('✅ Order created successfully:', order.orderId);
    
    // Send email to pharmacy
    const pharmacyEmailHtml = `
      <h2>New Order Received</h2>
      <p><strong>Order ID:</strong> ${order.orderId}</p>
      <p><strong>Customer:</strong> ${user.name}</p>
      <p><strong>Email:</strong> ${user.email}</p>
      <p><strong>Phone:</strong> ${user.phoneNumber || 'Not provided'}</p>
      <p><strong>Total Amount:</strong> ₹${totalAmount}</p>
      <p><strong>Delivery Method:</strong> ${deliveryMethod}</p>
      
      <h3>Order Items:</h3>
      <ul>
        ${processedItems.map(item => `
          <li>${item.medicineName} (${item.type}) - Qty: ${item.quantity} - ₹${item.totalPrice}</li>
        `).join('')}
      </ul>
      
      <p>Please confirm this order in your pharmacy dashboard.</p>
    `;
    
    await sendEmail(pharmacy.email, `New Order: ${order.orderId}`, pharmacyEmailHtml);
    
    // Send confirmation email to user
    const userEmailHtml = `
      <h2>Order Confirmed</h2>
      <p>Thank you for your order! Your order has been placed successfully.</p>
      <p><strong>Order ID:</strong> ${order.orderId}</p>
      <p><strong>Total Amount:</strong> ₹${totalAmount}</p>
      <p><strong>Status:</strong> Pending Confirmation</p>
      
      <p>You will receive another email once the pharmacy confirms your order.</p>
    `;
    
    await sendEmail(user.email, `Order Confirmed: ${order.orderId}`, userEmailHtml);
    
    res.json({
      success: true,
      message: 'Order placed successfully',
      orderId: order.orderId,
      data: order
    });
    
  } catch (error) {
    console.error('❌ Error placing order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to place order',
      message: error.message
    });
  }
};

// Get orders by user
const getOrdersByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const orders = await Order.find({ userId: userId })
      .sort({ orderDate: -1 });
    
    console.log(`✅ Found ${orders.length} orders for user ${userId}`);
    
    res.json({
      success: true,
      data: orders
    });
    
  } catch (error) {
    console.error('❌ Error fetching user orders:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch orders'
    });
  }
};

// Get orders by pharmacy
const getOrdersByPharmacy = async (req, res) => {
  try {
    const { pharmacyId } = req.params;
    
    const orders = await Order.find({ pharmacyId: pharmacyId })
      .sort({ orderDate: -1 });
    
    console.log(`✅ Found ${orders.length} orders for pharmacy ${pharmacyId}`);
    
    res.json({
      success: true,
      data: orders
    });
    
  } catch (error) {
    console.error('❌ Error fetching pharmacy orders:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch orders'
    });
  }
};

// Update order status
const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, note, updatedBy } = req.body;
    
    console.log(`🔄 Updating order ${orderId} to status: ${status}`);
    
    const order = await Order.findOne({ orderId: orderId });
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }
    
    // Update status
    await order.updateStatus(status, updatedBy, note);
    
    // Send email notifications based on status
    if (status === 'Confirmed') {
      const userEmailHtml = `
        <h2>Order Confirmed</h2>
        <p>Great news! Your order has been confirmed by the pharmacy.</p>
        <p><strong>Order ID:</strong> ${order.orderId}</p>
        <p><strong>Status:</strong> Confirmed</p>
        <p>Your order is being prepared and will be shipped soon.</p>
      `;
      await sendEmail(order.userEmail, `Order Confirmed: ${order.orderId}`, userEmailHtml);
    } else if (status === 'Shipped') {
      const userEmailHtml = `
        <h2>Order Shipped</h2>
        <p>Your order is on the way!</p>
        <p><strong>Order ID:</strong> ${order.orderId}</p>
        <p><strong>Status:</strong> Shipped</p>
        ${order.trackingNumber ? `<p><strong>Tracking Number:</strong> ${order.trackingNumber}</p>` : ''}
        <p>You should receive your order soon.</p>
      `;
      await sendEmail(order.userEmail, `Order Shipped: ${order.orderId}`, userEmailHtml);
    } else if (status === 'Delivered') {
      const userEmailHtml = `
        <h2>Order Delivered</h2>
        <p>Your order has been delivered successfully!</p>
        <p><strong>Order ID:</strong> ${order.orderId}</p>
        <p><strong>Status:</strong> Delivered</p>
        <p>Thank you for choosing our service!</p>
      `;
      await sendEmail(order.userEmail, `Order Delivered: ${order.orderId}`, userEmailHtml);
    }
    
    console.log(`✅ Order ${orderId} status updated to ${status}`);
    
    res.json({
      success: true,
      message: 'Order status updated successfully',
      data: order
    });
    
  } catch (error) {
    console.error('❌ Error updating order status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update order status'
    });
  }
};

// Get order by ID
const getOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const order = await Order.findOne({ orderId: orderId });
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }
    
    res.json({
      success: true,
      data: order
    });
    
  } catch (error) {
    console.error('❌ Error fetching order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch order'
    });
  }
};

// Get order statistics
const getOrderStats = async (req, res) => {
  try {
    const { pharmacyId } = req.params;
    
    const totalOrders = await Order.countDocuments({ pharmacyId: pharmacyId });
    const pendingOrders = await Order.countDocuments({ 
      pharmacyId: pharmacyId, 
      status: 'Pending' 
    });
    const confirmedOrders = await Order.countDocuments({ 
      pharmacyId: pharmacyId, 
      status: 'Confirmed' 
    });
    const shippedOrders = await Order.countDocuments({ 
      pharmacyId: pharmacyId, 
      status: 'Shipped' 
    });
    const deliveredOrders = await Order.countDocuments({ 
      pharmacyId: pharmacyId, 
      status: 'Delivered' 
    });
    
    const totalRevenue = await Order.aggregate([
      { $match: { pharmacyId: pharmacyId, status: 'Delivered' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    
    res.json({
      success: true,
      data: {
        totalOrders,
        pendingOrders,
        confirmedOrders,
        shippedOrders,
        deliveredOrders,
        totalRevenue: totalRevenue[0]?.total || 0
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching order stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch order statistics'
    });
  }
};

module.exports = {
  placeOrder,
  getOrdersByUser,
  getOrdersByPharmacy,
  updateOrderStatus,
  getOrderById,
  getOrderStats
};