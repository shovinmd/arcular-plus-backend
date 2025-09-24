const Order = require('../models/Order');
const User = require('../models/User');
const Pharmacy = require('../models/Pharmacy');
const { sendMailSmart, sendInBackground } = require('../services/emailService');

// Fire-and-forget email helper
const sendEmail = async (to, subject, html) => {
  if (!to) return;
  sendInBackground('Order email', async () => {
    const ok = await sendMailSmart({ to, subject, html });
    if (!ok) throw new Error('email provider failed');
  });
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
    
    const deliveryFee = deliveryMethod === 'Home Delivery' ? 30 : 0;
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

      // Update pharmacy inventory stock for each ordered item
      try {
        const Medicine = require('../models/Medicine');
        for (const item of processedItems) {
          const medicine = await Medicine.findOne({
            _id: item.medicineId,
            pharmacyId: pharmacy._id
          });

          if (!medicine) {
            console.warn('⚠️ Medicine not found for stock decrement:', item.medicineId);
            continue;
          }

          const newStock = Math.max(0, (medicine.stock || 0) - item.quantity);
          const newStockQuantity = Math.max(0, (medicine.stockQuantity || medicine.stock || 0) - item.quantity);
          let newStatus = 'In Stock';
          if (newStock <= 0) newStatus = 'Out of Stock';
          else if (newStock <= (medicine.minStock || 10)) newStatus = 'Low Stock';

          await Medicine.updateOne(
            { _id: medicine._id },
            {
              $set: { stock: newStock, stockQuantity: newStockQuantity, status: newStatus, lastUpdated: new Date().toISOString().split('T')[0] }
            }
          );

          console.log(`📉 Stock updated for ${medicine.name}: ${medicine.stock} -> ${newStock}`);
        }
      } catch (stockError) {
        console.error('❌ Error updating stock after order placement:', stockError);
        // Continue without failing the order
      }
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
                  <th>Selling Price</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                ${processedItems.map(item => `
                  <tr>
                    <td>${item.medicineName}</td>
                    <td>${item.type}</td>
                    <td>${item.quantity}</td>
                    <td>₹${item.sellingPrice}</td>
                    <td>₹${item.totalPrice}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            
            <div style="margin: 10px 0 20px 0;">
              <table class="items-table" style="width: 100%; border-collapse: collapse;">
                <tbody>
                  <tr>
                    <td style="padding: 8px;">Subtotal</td>
                    <td style="padding: 8px; text-align: right;">₹${subtotal}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px;">Delivery Fee</td>
                    <td style="padding: 8px; text-align: right;">₹${deliveryFee}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px; font-weight: 700;">Grand Total</td>
                    <td style="padding: 8px; text-align: right; font-weight: 700;">₹${totalAmount}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://arcular-pluse-a-unified-healthcare-peach.vercel.app/" class="cta-button" target="_blank">View Order in Dashboard</a>
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
        console.log('📧 Queueing email to pharmacy:', pharmacy.email);
        await sendEmail(pharmacy.email, `New Order: ${order.orderId}`, pharmacyEmailHtml);
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
        <title>Order Placed</title>
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
            <h1>✅ Order Placed</h1>
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
                  <th>Selling Price</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                ${processedItems.map(item => `
                  <tr>
                    <td>${item.medicineName}</td>
                    <td>${item.type}</td>
                    <td>${item.quantity}</td>
                    <td>₹${item.sellingPrice}</td>
                    <td>₹${item.totalPrice}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            
            <div style="margin: 10px 0 20px 0;">
              <table class="items-table" style="width: 100%; border-collapse: collapse;">
                <tbody>
                  <tr>
                    <td style="padding: 8px;">Subtotal</td>
                    <td style="padding: 8px; text-align: right;">₹${subtotal}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px;">Delivery Fee</td>
                    <td style="padding: 8px; text-align: right;">₹${deliveryFee}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px; font-weight: 700;">Grand Total</td>
                    <td style="padding: 8px; text-align: right; font-weight: 700;">₹${totalAmount}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://arcular-pluse-a-unified-healthcare-peach.vercel.app/" class="cta-button" target="_blank">Track Your Order</a>
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
        console.log('📧 Queueing email to user:', user.email);
        await sendEmail(user.email, `Order Placed: ${order.orderId}`, userEmailHtml);
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

// Get orders by hospital
const getOrdersByHospital = async (req, res) => {
  try {
    const { hospitalId } = req.params;
    
    console.log('🏥 Fetching orders for hospital:', hospitalId);
    
    // First, try to find hospital by UID to get MongoDB ID
    const Hospital = require('../models/Hospital');
    let hospital = await Hospital.findOne({ uid: hospitalId });
    
    if (!hospital) {
      // If not found by UID, try by MongoDB ID
      hospital = await Hospital.findById(hospitalId);
    }
    
    if (!hospital) {
      return res.status(404).json({
        success: false, 
        error: 'Hospital not found'
      });
    }
    
    console.log('🏥 Found hospital:', {
      uid: hospital.uid,
      _id: hospital._id,
      name: hospital.hospitalName || hospital.fullName
    });
    
    // Find orders where the order was placed by this hospital
    // We'll look for orders that have hospital-related information in userNotes or other fields
    const orders = await Order.find({
      $or: [
        { userNotes: { $regex: 'Hospital order', $options: 'i' } },
        { userEmail: { $regex: 'hospital@arcular.com', $options: 'i' } },
        { userName: { $regex: 'Hospital', $options: 'i' } }
      ]
    }).sort({ orderDate: -1 });
    
    console.log(`✅ Found ${orders.length} hospital orders for ${hospital.hospitalName || hospital.fullName}`);

    res.json({
      success: true,
      data: orders
    });

  } catch (error) {
    console.error('❌ Error fetching hospital orders:', error);
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
    const { status, note, updatedBy, trackingInfo } = req.body;
    
    console.log(`🔄 Updating order ${orderId} to status: ${status}`);
    if (trackingInfo) {
      console.log('📦 Tracking info:', trackingInfo);
    }

    const order = await Order.findOne({ orderId: orderId });
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Update status with tracking info if provided
    if (trackingInfo && status === 'Shipped') {
      order.trackingNumber = trackingInfo.trackingId || trackingInfo.trackingID || trackingInfo.tracking_no;
      order.courierService = trackingInfo.courierService || trackingInfo.courier || 'Not specified';
      order.trackingUrl = trackingInfo.trackingUrl || trackingInfo.trackingURL || '';
      order.estimatedDelivery = trackingInfo.estimatedDelivery;
      await order.save();
    }
    
    // Update status
    await order.updateStatus(status, updatedBy, note);
 
    // Send email notifications based on status
    // If order is cancelled, restore stock quantities
    if (status === 'Cancelled') {
      try {
        const Medicine = require('../models/Medicine');
        for (const item of order.items) {
          const medicine = await Medicine.findOne({
            _id: item.medicineId,
            pharmacyId: order.pharmacyId
          });
          if (!medicine) continue;
          const restoredStock = (medicine.stock || 0) + (item.quantity || 0);
          const restoredStockQuantity = (medicine.stockQuantity || medicine.stock || 0) + (item.quantity || 0);
          let newStatus = 'In Stock';
          if (restoredStock <= 0) newStatus = 'Out of Stock';
          else if (restoredStock <= (medicine.minStock || 10)) newStatus = 'Low Stock';
          await Medicine.updateOne(
            { _id: medicine._id },
            { $set: { stock: restoredStock, stockQuantity: restoredStockQuantity, status: newStatus, lastUpdated: new Date().toISOString().split('T')[0] } }
          );
        }
        console.log('↩️ Stock restored after cancellation for order:', order.orderId);
      } catch (restoreErr) {
        console.error('❌ Error restoring stock on cancellation:', restoreErr);
      }
    }

    if (status === 'Confirmed') {
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
            .header { background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%); color: white; padding: 30px; text-align: center; }
            .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
            .content { padding: 30px; }
            .order-card { background-color: #f8f9fa; border-left: 4px solid #ff9800; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0; }
            .order-id { font-size: 24px; font-weight: bold; color: #ff9800; margin: 10px 0; }
            .status-badge { display: inline-block; background-color: #ff9800; color: white; padding: 8px 16px; border-radius: 20px; font-weight: 600; margin: 10px 0; }
            .cta-button { display: inline-block; background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: 600; margin: 20px 0; }
            .next-steps { background-color: #fff3e0; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .footer { background-color: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✅ Order Confirmed</h1>
              <p>Great news! Your order has been confirmed by the pharmacy.</p>
            </div>
            <div class="content">
              <div class="order-card">
                <div class="order-id">Order ID: ${order.orderId}</div>
                <div class="status-badge">Confirmed</div>
                <p><strong>Confirmed Time:</strong> ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://arcular-pluse-a-unified-healthcare-peach.vercel.app/" class="cta-button" target="_blank">Track Your Order</a>
              </div>
              
              <div class="next-steps">
                <h3 style="margin-top: 0; color: #e65100;">📋 What's Next?</h3>
                <ul>
                  <li>Your order is being prepared by the pharmacy</li>
                  <li>You will receive another email when your order is shipped</li>
                  <li>Track your order status in the "My Orders" section</li>
                  <li>Estimated delivery time will be provided after shipping</li>
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
        console.log('📧 Queueing confirmation email to user:', order.userEmail);
        await sendEmail(order.userEmail, `Order Confirmed: ${order.orderId}`, userEmailHtml);
      } catch (emailError) {
        console.error('❌ Error sending confirmation email to user:', emailError);
      }
    } else if (status === 'Shipped') {
      const userEmailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Order Shipped</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #17a2b8 0%, #20c997 100%); color: white; padding: 30px; text-align: center; }
            .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
            .content { padding: 30px; }
            .order-card { background-color: #f8f9fa; border-left: 4px solid #17a2b8; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0; }
            .order-id { font-size: 24px; font-weight: bold; color: #17a2b8; margin: 10px 0; }
            .status-badge { display: inline-block; background-color: #17a2b8; color: white; padding: 8px 16px; border-radius: 20px; font-weight: 600; margin: 10px 0; }
            .tracking-card { background-color: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2196f3; }
            .tracking-id { font-size: 20px; font-weight: bold; color: #1976d2; margin: 10px 0; }
            .courier-info { background-color: #f3e5f5; padding: 15px; border-radius: 8px; margin: 15px 0; }
            .track-button { display: inline-block; background: linear-gradient(135deg, #17a2b8 0%, #20c997 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: 600; margin: 20px 0; }
            .next-steps { background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .footer { background-color: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚚 Order Shipped</h1>
              <p>Your order is on the way!</p>
            </div>
            <div class="content">
              <div class="order-card">
                <div class="order-id">Order ID: ${order.orderId}</div>
                <div class="status-badge">Shipped</div>
                <p><strong>Shipped Time:</strong> ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
              </div>
              
              ${order.trackingNumber ? `
              <div class="tracking-card">
                <h3 style="margin-top: 0; color: #1976d2;">📦 Tracking Information</h3>
                <div class="tracking-id">Tracking ID: ${order.trackingNumber}</div>
                <div class="courier-info">
                  <p><strong>Courier Service:</strong> ${order.courierService || 'Not specified'}</p>
                  ${order.estimatedDelivery ? `<p><strong>Estimated Delivery:</strong> ${new Date(order.estimatedDelivery).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>` : ''}
                  ${order.trackingUrl ? `<p><strong>Tracking URL:</strong> <a href="${order.trackingUrl}" target="_blank">${order.trackingUrl}</a></p>` : ''}
                </div>
                ${order.trackingUrl ? `
                <div style="text-align: center; margin: 20px 0;">
                  <a href="${order.trackingUrl}" class="track-button" target="_blank">Track Your Package</a>
                </div>
                ` : ''}
              </div>
              ` : ''}
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://arcular-pluse-a-unified-healthcare-peach.vercel.app/" class="track-button" target="_blank">View Order Details</a>
              </div>
              
              <div class="next-steps">
                <h3 style="margin-top: 0; color: #2e7d32;">📋 What's Next?</h3>
                <ul>
                  <li>Your order has been shipped and is on its way</li>
                  <li>Use the tracking information above to monitor your package</li>
                  <li>You should receive your order within 2-5 business days</li>
                  <li>Please ensure someone is available to receive the package</li>
                  <li>Contact us if you have any questions about your delivery</li>
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
        console.log('📧 Queueing shipped email to user:', order.userEmail);
        await sendEmail(order.userEmail, `Order Shipped: ${order.orderId}`, userEmailHtml);
      } catch (emailError) {
        console.error('❌ Error sending shipped email to user:', emailError);
      }
    } else if (status === 'Delivered') {
      const userEmailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Order Delivered</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #4caf50 0%, #2e7d32 100%); color: white; padding: 30px; text-align: center; }
            .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
            .content { padding: 30px; }
            .order-card { background-color: #f8f9fa; border-left: 4px solid #4caf50; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0; }
            .order-id { font-size: 24px; font-weight: bold; color: #4caf50; margin: 10px 0; }
            .status-badge { display: inline-block; background-color: #4caf50; color: white; padding: 8px 16px; border-radius: 20px; font-weight: 600; margin: 10px 0; }
            .cta-button { display: inline-block; background: linear-gradient(135deg, #4caf50 0%, #2e7d32 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: 600; margin: 20px 0; }
            .next-steps { background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .footer { background-color: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Order Delivered</h1>
              <p>Your order has been delivered successfully!</p>
            </div>
            <div class="content">
              <div class="order-card">
                <div class="order-id">Order ID: ${order.orderId}</div>
                <div class="status-badge">Delivered</div>
                <p><strong>Delivered Time:</strong> ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://arcular-pluse-a-unified-healthcare-peach.vercel.app/" class="cta-button" target="_blank">Order Again</a>
              </div>
              
              <!-- Rating Section -->
              <div style="background-color: #fff3e0; padding: 25px; border-radius: 12px; margin: 25px 0; border: 2px solid #ff9800;">
                <h3 style="margin-top: 0; color: #e65100; text-align: center;">⭐ Rate Your Experience</h3>
                <p style="text-align: center; color: #666; margin-bottom: 20px;">Help us improve by rating your order experience</p>
                
                <div style="text-align: center; margin: 20px 0;">
                  <div style="display: inline-block; margin: 0 5px;">
                    <a href="https://arcular-pluse-a-unified-healthcare-peach.vercel.app/rate?orderId=${order.orderId}&rating=5" 
                       style="display: inline-block; width: 40px; height: 40px; background-color: #ff9800; color: white; text-decoration: none; border-radius: 50%; line-height: 40px; font-weight: bold; margin: 0 2px;">5</a>
                    <a href="https://arcular-pluse-a-unified-healthcare-peach.vercel.app/rate?orderId=${order.orderId}&rating=4" 
                       style="display: inline-block; width: 40px; height: 40px; background-color: #ff9800; color: white; text-decoration: none; border-radius: 50%; line-height: 40px; font-weight: bold; margin: 0 2px;">4</a>
                    <a href="https://arcular-pluse-a-unified-healthcare-peach.vercel.app/rate?orderId=${order.orderId}&rating=3" 
                       style="display: inline-block; width: 40px; height: 40px; background-color: #ff9800; color: white; text-decoration: none; border-radius: 50%; line-height: 40px; font-weight: bold; margin: 0 2px;">3</a>
                    <a href="https://arcular-pluse-a-unified-healthcare-peach.vercel.app/rate?orderId=${order.orderId}&rating=2" 
                       style="display: inline-block; width: 40px; height: 40px; background-color: #ff9800; color: white; text-decoration: none; border-radius: 50%; line-height: 40px; font-weight: bold; margin: 0 2px;">2</a>
                    <a href="https://arcular-pluse-a-unified-healthcare-peach.vercel.app/rate?orderId=${order.orderId}&rating=1" 
                       style="display: inline-block; width: 40px; height: 40px; background-color: #ff9800; color: white; text-decoration: none; border-radius: 50%; line-height: 40px; font-weight: bold; margin: 0 2px;">1</a>
                  </div>
                </div>
                
                <div style="text-align: center; margin-top: 15px;">
                  <a href="https://arcular-pluse-a-unified-healthcare-peach.vercel.app/rate?orderId=${order.orderId}" 
                     style="display: inline-block; background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%); color: white; padding: 10px 25px; text-decoration: none; border-radius: 20px; font-weight: 600;">Rate & Review</a>
                </div>
              </div>
              
              <div class="next-steps">
                <h3 style="margin-top: 0; color: #2e7d32;">🎉 Thank You!</h3>
                <ul>
                  <li>Your order has been delivered successfully</li>
                  <li>We hope you're satisfied with your purchase</li>
                  <li>Please rate your experience using the buttons above</li>
                  <li>Feel free to place another order anytime</li>
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
        console.log('📧 Queueing delivered email to user:', order.userEmail);
        await sendEmail(order.userEmail, `Order Delivered: ${order.orderId}`, userEmailHtml);
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
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://arcular-pluse-a-unified-healthcare-peach.vercel.app/" class="cta-button" target="_blank">Place New Order</a>
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
        console.log('📧 Queueing cancellation email to user:', order.userEmail);
        await sendEmail(order.userEmail, `Order Cancelled: ${order.orderId}`, userEmailHtml);
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
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://arcular-pluse-a-unified-healthcare-peach.vercel.app/" class="cta-button" target="_blank">Manage Orders</a>
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
        console.log('📧 Queueing cancellation email to pharmacy:', order.pharmacyEmail);
        await sendEmail(order.pharmacyEmail, `Order Cancelled: ${order.orderId}`, pharmacyEmailHtml);
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

    // Resolve pharmacyId: accept UID or MongoDB ID
    const Pharmacy = require('../models/Pharmacy');
    let pharmacy = await Pharmacy.findOne({ uid: pharmacyId });
    if (!pharmacy) {
      pharmacy = await Pharmacy.findById(pharmacyId);
    }
    if (!pharmacy) {
      return res.status(404).json({ success: false, error: 'Pharmacy not found' });
    }
    const actualPharmacyId = pharmacy._id;

    const totalOrders = await Order.countDocuments({ pharmacyId: actualPharmacyId });
    const pendingOrders = await Order.countDocuments({ 
      pharmacyId: actualPharmacyId, 
      status: 'Pending' 
    });
    const confirmedOrders = await Order.countDocuments({ 
      pharmacyId: actualPharmacyId, 
      status: 'Confirmed' 
    });
    const shippedOrders = await Order.countDocuments({ 
      pharmacyId: actualPharmacyId, 
      status: 'Shipped' 
    });
    const deliveredOrders = await Order.countDocuments({ 
      pharmacyId: actualPharmacyId, 
      status: 'Delivered' 
    });
    
    // Calculate revenue from completed orders (Delivered, Confirmed, Shipped)
    let totalRevenueValue = 0;
    try {
      const agg = await Order.aggregate([
        { $match: { pharmacyId: actualPharmacyId, status: { $in: ['Delivered', 'Confirmed', 'Shipped'] } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]);
      totalRevenueValue = Number(agg?.[0]?.total || 0);
      console.log(`💰 Revenue calculation (aggregate): ${totalRevenueValue} for pharmacy ${actualPharmacyId}`);
    } catch (e) {
      console.log('⚠️ Aggregate failed, using fallback:', e.message);
      // Fallback using find + reduce
      const completedDocs = await Order.find({
        pharmacyId: actualPharmacyId,
        status: { $in: ['Delivered', 'Confirmed', 'Shipped'] }
      }).select('totalAmount status');
      totalRevenueValue = completedDocs.reduce(
        (sum, o) => sum + Number(o.totalAmount || 0),
        0
      );
      console.log(`💰 Revenue calculation (fallback): ${totalRevenueValue} from ${completedDocs.length} completed orders`);
      console.log('📊 Sample completed orders:', completedDocs.slice(0, 3).map(o => ({ totalAmount: o.totalAmount, status: o.status })));
    }

    res.json({
      success: true,
      data: {
        totalOrders,
        pendingOrders,
        confirmedOrders,
        shippedOrders,
        deliveredOrders,
        totalRevenue: totalRevenueValue
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

// Place hospital order to pharmacy
const placeHospitalOrder = async (req, res) => {
  try {
    const { pharmacyId, patientArcId, medicineId, medicineName, quantity, unitPrice, subtotal, deliveryFee, totalAmount, notes, pharmacyName, patientDetails } = req.body;
    
    console.log('🏥 Hospital order received:', {
      pharmacyId,
      patientArcId,
      medicineId,
      medicineName,
      quantity,
      pharmacyName
    });
    
    // Get pharmacy information
    const pharmacy = await Pharmacy.findOne({ uid: pharmacyId });
    if (!pharmacy) {
      return res.status(404).json({
        success: false,
        error: 'Pharmacy not found'
      });
    }
    
    // Get medicine information to get the price
    const Medicine = require('../models/Medicine');
    const medicine = await Medicine.findOne({
      _id: medicineId,
      pharmacyId: pharmacy._id
    });
    
    if (!medicine) {
      return res.status(404).json({
        success: false,
        error: 'Medicine not found in pharmacy inventory'
      });
    }
    
    console.log('💊 Medicine found:', {
      name: medicine.name,
      sellingPrice: medicine.sellingPrice,
      unitPrice: medicine.unitPrice
    });
    
    // Calculate prices using real medicine data
    const medicineUnitPrice = medicine.unitPrice || 0;
    const medicineSellingPrice = medicine.sellingPrice || 0;
    const totalPrice = medicineSellingPrice * quantity;
    const hospitalDeliveryFee = 30; // Fixed delivery charge
    const hospitalSubtotal = totalPrice;
    const hospitalTotalAmount = hospitalSubtotal + hospitalDeliveryFee;
    
    console.log('💰 Price calculation:', {
      unitPrice: medicineUnitPrice,
      sellingPrice: medicineSellingPrice,
      quantity,
      totalPrice,
      deliveryFee: hospitalDeliveryFee,
      subtotal: hospitalSubtotal,
      totalAmount: hospitalTotalAmount
    });
    
    // Get patient's Firebase UID for order tracking
    const User = require('../models/User');
    const patient = await User.findOne({ arcId: patientArcId });
    const patientUserId = patient ? patient.uid : patientArcId; // Fallback to ARC ID if user not found
    
    console.log('👤 Patient lookup:', {
      arcId: patientArcId,
      found: !!patient,
      uid: patient?.uid,
      usingUserId: patientUserId
    });
    
    // Generate unique order ID
    const orderId = `HOSP-ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    
    // Create order data
    const order = new Order({
      orderId: orderId,
      userId: patientUserId, // Use patient's Firebase UID for order tracking
      userName: patientDetails?.fullName || patientDetails?.name || 'Patient',
      userEmail: patientDetails?.email || 'hospital@arcular.com',
      userPhone: patientDetails?.mobileNumber || patientDetails?.phone || 'Hospital Order',
      userAddress: {
        street: patientDetails?.address || 'Hospital Address',
        city: patientDetails?.city || 'Hospital City',
        state: patientDetails?.state || 'Hospital State',
        pincode: patientDetails?.pincode || '000000'
      },
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
      items: [{
        medicineId: medicine._id,
        medicineName: medicine.name,
        category: medicine.category || 'Prescription',
        type: medicine.type || 'Tablet',
        quantity: quantity,
        unitPrice: medicineUnitPrice,
        sellingPrice: medicineSellingPrice,
        totalPrice: totalPrice
      }],
      subtotal: hospitalSubtotal,
      deliveryFee: hospitalDeliveryFee,
      totalAmount: hospitalTotalAmount,
      deliveryMethod: 'Home Delivery',
      paymentMethod: 'Cash on Delivery',
      userNotes: notes || 'Hospital order for patient',
      statusHistory: [{
        status: 'Pending',
        timestamp: new Date(),
        note: 'Hospital order placed',
        updatedBy: 'hospital'
      }]
    });
    
    await order.save();
    console.log('✅ Hospital order created successfully:', order.orderId);
    
    // Update pharmacy inventory stock for the ordered medicine
    try {
      const newStock = Math.max(0, (medicine.stock || 0) - quantity);
      const newStockQuantity = Math.max(0, (medicine.stockQuantity || medicine.stock || 0) - quantity);
      let newStatus = 'In Stock';
      if (newStock <= 0) newStatus = 'Out of Stock';
      else if (newStock <= (medicine.minStock || 10)) newStatus = 'Low Stock';

      await Medicine.updateOne(
        { _id: medicine._id },
        {
          $set: { 
            stock: newStock, 
            stockQuantity: newStockQuantity, 
            status: newStatus, 
            lastUpdated: new Date().toISOString().split('T')[0] 
          }
        }
      );

      console.log(`📉 Stock updated for ${medicine.name}: ${medicine.stock} -> ${newStock}`);
    } catch (stockError) {
      console.error('❌ Error updating stock after hospital order placement:', stockError);
      // Continue without failing the order
    }
    
    // Send email to pharmacy with patient details
    const pharmacyEmailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Hospital Order Received</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%); color: white; padding: 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
          .content { padding: 30px; }
          .order-card { background-color: #f8f9fa; border-left: 4px solid #ff6b35; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0; }
          .order-id { font-size: 24px; font-weight: bold; color: #ff6b35; margin: 10px 0; }
          .patient-info { background-color: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2196f3; }
          .medicine-info { background-color: #f3e5f5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #9c27b0; }
          .delivery-info { background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4caf50; }
          .cta-button { display: inline-block; background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: 600; margin: 20px 0; }
          .footer { background-color: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏥 Hospital Order Received</h1>
            <p>You have received a medicine order from a hospital</p>
          </div>
          <div class="content">
            <div class="order-card">
              <div class="order-id">Order ID: ${order.orderId}</div>
              <p><strong>Status:</strong> Pending Confirmation</p>
              <p><strong>Order Time:</strong> ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
              <p><strong>Order Type:</strong> Hospital Order</p>
          </div>
          
            <div class="patient-info">
              <h3 style="margin-top: 0; color: #1976d2;">👤 Patient Information</h3>
              <p><strong>Patient Name:</strong> ${patientDetails?.fullName || patientDetails?.name || 'N/A'}</p>
              <p><strong>Patient ARC ID:</strong> ${patientArcId}</p>
              <p><strong>Contact:</strong> ${patientDetails?.mobileNumber || patientDetails?.phone || 'N/A'}</p>
              <p><strong>Address:</strong> ${patientDetails?.address || 'Hospital Address'}</p>
              <p><strong>Email:</strong> ${patientDetails?.email || 'N/A'}</p>
              </div>
            
            <div class="medicine-info">
              <h3 style="margin-top: 0; color: #7b1fa2;">💊 Medicine Details</h3>
              <p><strong>Medicine:</strong> ${medicine.name}</p>
              <p><strong>Quantity:</strong> ${quantity}</p>
              <p><strong>Unit Price:</strong> ₹${medicineUnitPrice}</p>
              <p><strong>Selling Price:</strong> ₹${medicineSellingPrice}</p>
              <p><strong>Total Price:</strong> ₹${totalPrice}</p>
              <p><strong>Delivery Fee:</strong> ₹${hospitalDeliveryFee}</p>
              <p><strong>Total Amount:</strong> ₹${hospitalTotalAmount}</p>
              <p><strong>Notes:</strong> ${notes || 'No additional notes'}</p>
          </div>
          
            <div class="delivery-info">
              <h3 style="margin-top: 0; color: #2e7d32;">🚚 Delivery Information</h3>
              <p><strong>Delivery Method:</strong> Hospital Delivery</p>
              <p><strong>Payment Method:</strong> Hospital Account</p>
              <p><strong>Priority:</strong> High (Hospital Order)</p>
          </div>
          
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://arcular-pluse-a-unified-healthcare-peach.vercel.app/" class="cta-button" target="_blank">View Order in Dashboard</a>
            </div>
            
            <p style="background-color: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107; margin: 20px 0;">
              <strong>⚠️ Action Required:</strong> Please prepare and deliver this medicine to the patient as soon as possible. Contact the patient using the provided details for delivery coordination.
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
        console.log('📧 Queueing hospital order email to pharmacy:', pharmacy.email);
        await sendEmail(pharmacy.email, `Hospital Order: ${order.orderId}`, pharmacyEmailHtml);
      } else {
        console.warn('⚠️ Pharmacy email not found, skipping email send');
      }
    } catch (emailError) {
      console.error('❌ Error sending hospital order email to pharmacy:', emailError);
    }
    
    res.json({
      success: true,
      message: 'Hospital order placed successfully',
      orderId: order.orderId,
      data: order
    });

  } catch (error) {
    console.error('❌ Error placing hospital order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to place hospital order',
      message: error.message
    });
  }
};

module.exports = {
  placeOrder,
  placeHospitalOrder,
  getOrdersByUser,
  getOrdersByPharmacy,
  getOrdersByHospital,
  updateOrderStatus,
  getOrderById,
  getOrderStats
};