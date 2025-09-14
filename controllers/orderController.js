const Order = require('../models/Order');
const User = require('../models/User');
const Pharmacy = require('../models/Pharmacy');
const nodemailer = require('nodemailer');

// Email configuration
const createTransporter = () => {
  return nodemailer.createTransport({
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
      console.warn('EMAIL_USER:', process.env.EMAIL_USER ? 'Set' : 'Not set');
      console.warn('EMAIL_PASS:', process.env.EMAIL_PASS ? 'Set' : 'Not set');
      return;
    }
    
    console.log(`📧 Attempting to send email to: ${to}`);
    console.log(`📧 Subject: ${subject}`);
    
    const transporter = createTransporter();
    const result = await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: to,
      subject: subject,
      html: html
    });
    
    console.log(`✅ Email sent successfully to ${to}: ${subject}`);
    console.log(`📧 Message ID: ${result.messageId}`);
  } catch (error) {
    console.error('❌ Error sending email:', error);
    console.error('❌ Error details:', error.message);
    console.error('❌ Error code:', error.code);
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
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Order Received</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
          .content { padding: 30px; }
          .order-card { background-color: #f8f9fa; border-left: 4px solid #28a745; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0; }
          .order-id { font-size: 24px; font-weight: bold; color: #28a745; margin: 10px 0; }
          .customer-info { background-color: #e3f2fd; padding: 15px; border-radius: 8px; margin: 15px 0; }
          .items-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          .items-table th, .items-table td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
          .items-table th { background-color: #f8f9fa; font-weight: 600; }
          .total-amount { font-size: 20px; font-weight: bold; color: #28a745; text-align: right; margin: 20px 0; }
          .cta-button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: 600; margin: 20px 0; }
          .footer { background-color: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🛒 New Order Received</h1>
            <p>You have received a new order from a customer</p>
          </div>
          <div class="content">
            <div class="order-card">
              <div class="order-id">Order ID: ${order.orderId}</div>
              <p><strong>Status:</strong> Pending Confirmation</p>
              <p><strong>Order Time:</strong> ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
            </div>
            
            <div class="customer-info">
              <h3 style="margin-top: 0; color: #1976d2;">👤 Customer Information</h3>
              <p><strong>Name:</strong> ${userName}</p>
              <p><strong>Email:</strong> ${user.email}</p>
              <p><strong>Phone:</strong> ${user.mobileNumber || 'Not provided'}</p>
              <p><strong>Delivery Method:</strong> ${deliveryMethod}</p>
            </div>
            
            <h3 style="color: #333;">📦 Order Items</h3>
            <table class="items-table">
              <thead>
                <tr>
                  <th>Medicine</th>
                  <th>Type</th>
                  <th>Quantity</th>
                  <th>Unit Price</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                ${processedItems.map(item => `
                  <tr>
                    <td>${item.medicineName}</td>
                    <td>${item.type}</td>
                    <td>${item.quantity}</td>
                    <td>₹${item.unitPrice}</td>
                    <td>₹${item.totalPrice}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            
            <div class="total-amount">
              <strong>Total Amount: ₹${totalAmount}</strong>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="#" class="cta-button">View Order in Dashboard</a>
            </div>
            
            <p style="background-color: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107; margin: 20px 0;">
              <strong>⚠️ Action Required:</strong> Please confirm this order in your pharmacy dashboard as soon as possible.
            </p>
          </div>
          <div class="footer">
            <p>This is an automated notification from Arcular Plus</p>
            <p>Please do not reply to this email</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    // Send email to pharmacy
    try {
      if (pharmacy.email) {
        console.log('📧 Sending email to pharmacy:', pharmacy.email);
        await sendEmail(pharmacy.email, `New Order: ${order.orderId}`, pharmacyEmailHtml);
        console.log('✅ Pharmacy email sent successfully to:', pharmacy.email);
      } else {
        console.warn('⚠️ Pharmacy email not found, skipping email send');
        console.warn('Pharmacy data:', { pharmacyName: pharmacy.pharmacyName, email: pharmacy.email });
      }
    } catch (emailError) {
      console.error('❌ Error sending email to pharmacy:', emailError);
      console.error('❌ Pharmacy email error details:', emailError.message);
    }
    
    // Send confirmation email to user
    const userEmailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Order Confirmed</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
          .content { padding: 30px; }
          .order-card { background-color: #f8f9fa; border-left: 4px solid #28a745; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0; }
          .order-id { font-size: 24px; font-weight: bold; color: #28a745; margin: 10px 0; }
          .status-badge { display: inline-block; background-color: #ffc107; color: #000; padding: 8px 16px; border-radius: 20px; font-weight: 600; margin: 10px 0; }
          .items-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          .items-table th, .items-table td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
          .items-table th { background-color: #f8f9fa; font-weight: 600; }
          .total-amount { font-size: 20px; font-weight: bold; color: #28a745; text-align: right; margin: 20px 0; }
          .next-steps { background-color: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .footer { background-color: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Order Confirmed</h1>
            <p>Thank you for your order! Your order has been placed successfully.</p>
          </div>
          <div class="content">
            <div class="order-card">
              <div class="order-id">Order ID: ${order.orderId}</div>
              <div class="status-badge">Pending Confirmation</div>
              <p><strong>Order Time:</strong> ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
            </div>
            
            <h3 style="color: #333;">📦 Your Order Items</h3>
            <table class="items-table">
              <thead>
                <tr>
                  <th>Medicine</th>
                  <th>Type</th>
                  <th>Quantity</th>
                  <th>Unit Price</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                ${processedItems.map(item => `
                  <tr>
                    <td>${item.medicineName}</td>
                    <td>${item.type}</td>
                    <td>${item.quantity}</td>
                    <td>₹${item.unitPrice}</td>
                    <td>₹${item.totalPrice}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            
            <div class="total-amount">
              <strong>Total Amount: ₹${totalAmount}</strong>
            </div>
            
            <div class="next-steps">
              <h3 style="margin-top: 0; color: #1976d2;">📋 What's Next?</h3>
              <ul>
                <li>Your order is being processed by the pharmacy</li>
                <li>You will receive another email once the pharmacy confirms your order</li>
                <li>Track your order status in the "My Orders" section</li>
                <li>Estimated delivery time will be provided after confirmation</li>
              </ul>
            </div>
          </div>
          <div class="footer">
            <p>This is an automated confirmation from Arcular Plus</p>
            <p>For support, contact us through the app</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    try {
      if (user.email) {
        console.log('📧 Sending email to user:', user.email);
        await sendEmail(user.email, `Order Confirmed: ${order.orderId}`, userEmailHtml);
        console.log('✅ User email sent successfully to:', user.email);
      } else {
        console.warn('⚠️ User email not found, skipping email send');
        console.warn('User data:', { userName: userName, email: user.email });
      }
    } catch (emailError) {
      console.error('❌ Error sending email to user:', emailError);
      console.error('❌ User email error details:', emailError.message);
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
      try {
        console.log('📧 Sending confirmation email to user:', order.userEmail);
        await sendEmail(order.userEmail, `Order Confirmed: ${order.orderId}`, userEmailHtml);
        console.log('✅ User confirmation email sent successfully');
      } catch (emailError) {
        console.error('❌ Error sending confirmation email to user:', emailError);
      }
    } else if (status === 'Shipped') {
      const userEmailHtml = `
        <h2>Order Shipped</h2>
        <p>Your order is on the way!</p>
        <p><strong>Order ID:</strong> ${order.orderId}</p>
        <p><strong>Status:</strong> Shipped</p>
        ${order.trackingNumber ? `<p><strong>Tracking Number:</strong> ${order.trackingNumber}</p>` : ''}
        <p>You should receive your order soon.</p>
      `;
      try {
        console.log('📧 Sending shipped email to user:', order.userEmail);
        await sendEmail(order.userEmail, `Order Shipped: ${order.orderId}`, userEmailHtml);
        console.log('✅ User shipped email sent successfully');
      } catch (emailError) {
        console.error('❌ Error sending shipped email to user:', emailError);
      }
    } else if (status === 'Delivered') {
      const userEmailHtml = `
        <h2>Order Delivered</h2>
        <p>Your order has been delivered successfully!</p>
        <p><strong>Order ID:</strong> ${order.orderId}</p>
        <p><strong>Status:</strong> Delivered</p>
        <p>Thank you for choosing our service!</p>
      `;
      try {
        console.log('📧 Sending delivered email to user:', order.userEmail);
        await sendEmail(order.userEmail, `Order Delivered: ${order.orderId}`, userEmailHtml);
        console.log('✅ User delivered email sent successfully');
      } catch (emailError) {
        console.error('❌ Error sending delivered email to user:', emailError);
      }
    } else if (status === 'Cancelled') {
      // Send cancellation email to user
      const userEmailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Order Cancelled</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #dc3545 0%, #e83e8c 100%); color: white; padding: 30px; text-align: center; }
            .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
            .content { padding: 30px; }
            .order-card { background-color: #f8f9fa; border-left: 4px solid #dc3545; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0; }
            .order-id { font-size: 24px; font-weight: bold; color: #dc3545; margin: 10px 0; }
            .status-badge { display: inline-block; background-color: #dc3545; color: white; padding: 8px 16px; border-radius: 20px; font-weight: 600; margin: 10px 0; }
            .reason-box { background-color: #f8d7da; padding: 15px; border-radius: 8px; border-left: 4px solid #dc3545; margin: 15px 0; }
            .next-steps { background-color: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .footer { background-color: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>❌ Order Cancelled</h1>
              <p>Your order has been cancelled as requested</p>
            </div>
            <div class="content">
              <div class="order-card">
                <div class="order-id">Order ID: ${order.orderId}</div>
                <div class="status-badge">Cancelled</div>
                <p><strong>Cancellation Time:</strong> ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
              </div>
              
              <div class="reason-box">
                <h3 style="margin-top: 0; color: #721c24;">📝 Cancellation Reason</h3>
                <p><strong>Reason:</strong> ${note || 'Order cancelled by user'}</p>
              </div>
              
              <div class="next-steps">
                <h3 style="margin-top: 0; color: #1976d2;">🔄 What's Next?</h3>
                <ul>
                  <li>Your order has been successfully cancelled</li>
                  <li>No charges will be applied to your account</li>
                  <li>You can place a new order anytime</li>
                  <li>If you have any questions, contact our support team</li>
                </ul>
              </div>
            </div>
            <div class="footer">
              <p>This is an automated notification from Arcular Plus</p>
              <p>For support, contact us through the app</p>
            </div>
          </div>
        </body>
        </html>
      `;
      try {
        console.log('📧 Sending cancellation email to user:', order.userEmail);
        await sendEmail(order.userEmail, `Order Cancelled: ${order.orderId}`, userEmailHtml);
        console.log('✅ User cancellation email sent successfully');
      } catch (emailError) {
        console.error('❌ Error sending cancellation email to user:', emailError);
      }
      
      // Send cancellation notification to pharmacy
      const pharmacyEmailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Order Cancelled</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #dc3545 0%, #e83e8c 100%); color: white; padding: 30px; text-align: center; }
            .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
            .content { padding: 30px; }
            .order-card { background-color: #f8f9fa; border-left: 4px solid #dc3545; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0; }
            .order-id { font-size: 24px; font-weight: bold; color: #dc3545; margin: 10px 0; }
            .status-badge { display: inline-block; background-color: #dc3545; color: white; padding: 8px 16px; border-radius: 20px; font-weight: 600; margin: 10px 0; }
            .customer-info { background-color: #f8d7da; padding: 15px; border-radius: 8px; margin: 15px 0; }
            .reason-box { background-color: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107; margin: 15px 0; }
            .action-required { background-color: #d1ecf1; padding: 20px; border-radius: 8px; border-left: 4px solid #17a2b8; margin: 20px 0; }
            .footer { background-color: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>❌ Order Cancelled</h1>
              <p>An order has been cancelled by the customer</p>
            </div>
            <div class="content">
              <div class="order-card">
                <div class="order-id">Order ID: ${order.orderId}</div>
                <div class="status-badge">Cancelled</div>
                <p><strong>Cancellation Time:</strong> ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
              </div>
              
              <div class="customer-info">
                <h3 style="margin-top: 0; color: #721c24;">👤 Customer Information</h3>
                <p><strong>Customer:</strong> ${order.userName}</p>
                <p><strong>Email:</strong> ${order.userEmail}</p>
                <p><strong>Phone:</strong> ${order.userPhone || 'Not provided'}</p>
              </div>
              
              <div class="reason-box">
                <h3 style="margin-top: 0; color: #856404;">📝 Cancellation Reason</h3>
                <p><strong>Reason:</strong> ${note || 'Cancelled by customer'}</p>
              </div>
              
              <div class="action-required">
                <h3 style="margin-top: 0; color: #0c5460;">⚠️ Action Required</h3>
                <ul>
                  <li>Update your inventory to reflect the cancelled order</li>
                  <li>Return any reserved stock to available inventory</li>
                  <li>Process any refunds if payment was already collected</li>
                  <li>Update your order management system</li>
                </ul>
              </div>
            </div>
            <div class="footer">
              <p>This is an automated notification from Arcular Plus</p>
              <p>Please do not reply to this email</p>
            </div>
          </div>
        </body>
        </html>
      `;
      
      try {
        console.log('📧 Sending cancellation email to pharmacy:', order.pharmacyEmail);
        await sendEmail(order.pharmacyEmail, `Order Cancelled: ${order.orderId}`, pharmacyEmailHtml);
        console.log('✅ Pharmacy cancellation email sent successfully');
      } catch (emailError) {
        console.error('❌ Error sending cancellation email to pharmacy:', emailError);
      }
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