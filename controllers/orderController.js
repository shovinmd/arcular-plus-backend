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
    // Check if email credentials are configured
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.warn('⚠️ Email credentials not configured. Skipping email send.');
      return;
    }
    
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
    
    // Get user information by Firebase UID
    const user = await User.findOne({ uid: userId });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    console.log('👤 User found:', {
      uid: user.uid,
      fullName: user.fullName,
      email: user.email,
      mobileNumber: user.mobileNumber
    });
    
    // Get user name (try fullName first, then email as fallback)
    const userName = user.fullName || user.email?.split('@')[0] || 'Unknown User';
    
    // Validate required user fields
    if (!userName || userName === 'Unknown User') {
      return res.status(400).json({
        success: false,
        error: 'User name is required. Please complete your profile with full name.'
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
    let pharmacy = await Pharmacy.findOne({ uid: items[0].pharmacyId });
    if (!pharmacy) {
      // Try by MongoDB ID as fallback
      pharmacy = await Pharmacy.findById(items[0].pharmacyId);
    }
    if (!pharmacy) {
      return res.status(404).json({
        success: false,
        error: 'Pharmacy not found'
      });
    }
    
    // Generate unique order ID
    const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    
    console.log('🆔 Generated orderId:', orderId);
    console.log('👤 User name for order:', userName);
    
    // Create order
    const order = new Order({
      orderId: orderId,
      userId: userId,
      userName: userName,
      userEmail: user.email,
      userPhone: user.mobileNumber || 'Not provided',
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
    
    try {
      await order.save();
      console.log('✅ Order created successfully:', order.orderId);
    } catch (saveError) {
      console.error('❌ Error saving order:', saveError);
      return res.status(500).json({
        success: false,
        error: 'Failed to save order: ' + saveError.message
      });
    }
    
    // Send email to pharmacy
    const pharmacyEmailHtml = `
      <h2>New Order Received</h2>
      <p><strong>Order ID:</strong> ${order.orderId}</p>
      <p><strong>Customer:</strong> ${userName}</p>
      <p><strong>Email:</strong> ${user.email}</p>
      <p><strong>Phone:</strong> ${user.mobileNumber || 'Not provided'}</p>
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
    
    // Send email to pharmacy
    try {
      await sendEmail(pharmacy.email, `New Order: ${order.orderId}`, pharmacyEmailHtml);
      console.log('✅ Pharmacy email sent to:', pharmacy.email);
    } catch (emailError) {
      console.error('❌ Error sending email to pharmacy:', emailError);
    }
    
    // Send confirmation email to user
    const userEmailHtml = `
      <h2>Order Confirmed</h2>
      <p>Thank you for your order! Your order has been placed successfully.</p>
      <p><strong>Order ID:</strong> ${order.orderId}</p>
      <p><strong>Total Amount:</strong> ₹${totalAmount}</p>
      <p><strong>Status:</strong> Pending Confirmation</p>
      
      <h3>Order Items:</h3>
      <ul>
        ${processedItems.map(item => `
          <li>${item.medicineName} (${item.type}) - Qty: ${item.quantity} - ₹${item.totalPrice}</li>
        `).join('')}
      </ul>
      
      <p>You will receive another email once the pharmacy confirms your order.</p>
    `;
    
    try {
      await sendEmail(user.email, `Order Confirmed: ${order.orderId}`, userEmailHtml);
      console.log('✅ User email sent to:', user.email);
    } catch (emailError) {
      console.error('❌ Error sending email to user:', emailError);
    }
    
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
    
    console.log('🔍 Fetching orders for pharmacy:', pharmacyId);
    
    // First, try to find pharmacy by UID to get MongoDB ID
    const Pharmacy = require('../models/Pharmacy');
    let pharmacy = await Pharmacy.findOne({ uid: pharmacyId });
    
    if (!pharmacy) {
      // If not found by UID, try by MongoDB ID
      pharmacy = await Pharmacy.findById(pharmacyId);
    }
    
    if (!pharmacy) {
      return res.status(404).json({
        success: false,
        error: 'Pharmacy not found'
      });
    }
    
    console.log('🏥 Found pharmacy:', {
      uid: pharmacy.uid,
      _id: pharmacy._id,
      name: pharmacy.pharmacyName
    });
    
    // Find orders by pharmacy MongoDB ID
    const orders = await Order.find({ pharmacyId: pharmacy._id })
      .sort({ orderDate: -1 });
    
    console.log(`✅ Found ${orders.length} orders for pharmacy ${pharmacy.pharmacyName}`);
    
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
    } else if (status === 'Cancelled') {
      // Send cancellation email to user
      const userEmailHtml = `
        <h2>Order Cancelled</h2>
        <p>Your order has been cancelled.</p>
        <p><strong>Order ID:</strong> ${order.orderId}</p>
        <p><strong>Status:</strong> Cancelled</p>
        <p><strong>Reason:</strong> ${note || 'No reason provided'}</p>
        <p>If you have any questions, please contact our support team.</p>
      `;
      await sendEmail(order.userEmail, `Order Cancelled: ${order.orderId}`, userEmailHtml);
      
      // Send cancellation notification to pharmacy
      const pharmacyEmailHtml = `
        <h2>Order Cancelled</h2>
        <p>An order has been cancelled by the customer.</p>
        <p><strong>Order ID:</strong> ${order.orderId}</p>
        <p><strong>Customer:</strong> ${order.userName}</p>
        <p><strong>Status:</strong> Cancelled</p>
        <p><strong>Reason:</strong> ${note || 'Cancelled by customer'}</p>
        <p>Please update your inventory accordingly.</p>
      `;
      await sendEmail(order.pharmacyEmail, `Order Cancelled: ${order.orderId}`, pharmacyEmailHtml);
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