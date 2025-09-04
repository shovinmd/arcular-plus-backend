const Order = require('../models/Order');
const Medicine = require('../models/Medicine');
const User = require('../models/User');
const nodemailer = require('nodemailer');
const fcmService = require('../services/fcmService');

// Create order
const createOrder = async (req, res) => {
  try {
    const {
      items,
      deliveryAddress,
      paymentMethod = 'cash_on_delivery',
      notes
    } = req.body;

    const firebaseUser = req.user;
    if (!firebaseUser || !firebaseUser.uid) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid Firebase user' 
      });
    }

    // Get user information
    const user = await User.findOne({ uid: firebaseUser.uid });
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }

    // Validate items and calculate totals
    let subtotal = 0;
    const validatedItems = [];

    for (const item of items) {
      const medicine = await Medicine.findOne({ 
        medicineId: item.medicineId,
        isAvailable: true 
      });
      
      if (!medicine) {
        return res.status(400).json({
          success: false,
          error: `Medicine ${item.medicineName} is not available`
        });
      }

      if (medicine.stockQuantity < item.quantity) {
        return res.status(400).json({
          success: false,
          error: `Insufficient stock for ${item.medicineName}. Available: ${medicine.stockQuantity}`
        });
      }

      const totalPrice = medicine.price * item.quantity;
      subtotal += totalPrice;

      validatedItems.push({
        medicineId: medicine.medicineId,
        medicineName: medicine.name,
        quantity: item.quantity,
        unitPrice: medicine.price,
        totalPrice: totalPrice,
        pharmacyId: medicine.pharmacyId,
        pharmacyName: medicine.pharmacyName
      });
    }

    // Calculate delivery fee (free for orders above ₹500)
    const deliveryFee = subtotal >= 500 ? 0 : 50;
    const totalAmount = subtotal + deliveryFee;

    // Create order
    const order = new Order({
      userId: firebaseUser.uid,
      userEmail: user.email,
      userName: user.fullName,
      userPhone: user.mobileNumber,
      deliveryAddress: deliveryAddress,
      items: validatedItems,
      subtotal: subtotal,
      deliveryFee: deliveryFee,
      totalAmount: totalAmount,
      paymentMethod: paymentMethod,
      notes: notes
    });

    await order.save();

    // Update medicine stock
    for (const item of validatedItems) {
      await Medicine.findOneAndUpdate(
        { medicineId: item.medicineId },
        { $inc: { stockQuantity: -item.quantity } }
      );
    }

    // Send email confirmation
    await sendOrderConfirmationEmail(order);

    // Send FCM notification to pharmacies
    const pharmacyIds = [...new Set(validatedItems.map(item => item.pharmacyId))];
    for (const pharmacyId of pharmacyIds) {
      const pharmacy = await User.findOne({ uid: pharmacyId });
      if (pharmacy && pharmacy.fcmToken) {
        await fcmService.sendToUser(pharmacy.uid, {
          title: 'New Medicine Order',
          body: `New order #${order.orderId} received with ${validatedItems.length} items`,
          data: {
            type: 'new_order',
            orderId: order.orderId,
            userId: firebaseUser.uid
          }
        });
      }
    }

    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      data: order
    });

  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create order'
    });
  }
};

// Get user orders
const getUserOrders = async (req, res) => {
  try {
    const firebaseUser = req.user;
    if (!firebaseUser || !firebaseUser.uid) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid Firebase user' 
      });
    }

    const { status, page = 1, limit = 10 } = req.query;
    const query = { userId: firebaseUser.uid };

    if (status) {
      query.orderStatus = status;
    }

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Order.countDocuments(query);

    res.json({
      success: true,
      data: orders,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total: total
      }
    });

  } catch (error) {
    console.error('Error fetching user orders:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch orders'
    });
  }
};

// Get pharmacy orders
const getPharmacyOrders = async (req, res) => {
  try {
    const firebaseUser = req.user;
    if (!firebaseUser || !firebaseUser.uid) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid Firebase user' 
      });
    }

    const { status, page = 1, limit = 10 } = req.query;
    
    // Find orders that contain items from this pharmacy
    const orders = await Order.find({
      'items.pharmacyId': firebaseUser.uid,
      ...(status && { orderStatus: status })
    })
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

    const total = await Order.countDocuments({
      'items.pharmacyId': firebaseUser.uid,
      ...(status && { orderStatus: status })
    });

    res.json({
      success: true,
      data: orders,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total: total
      }
    });

  } catch (error) {
    console.error('Error fetching pharmacy orders:', error);
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
    const { status, notes } = req.body;

    const firebaseUser = req.user;
    if (!firebaseUser || !firebaseUser.uid) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid Firebase user' 
      });
    }

    const order = await Order.findOne({ orderId: orderId });
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Check if user has permission to update this order
    const hasPermission = order.userId === firebaseUser.uid || 
                         order.items.some(item => item.pharmacyId === firebaseUser.uid);

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    order.orderStatus = status;
    if (notes) order.notes = notes;

    if (status === 'confirmed') {
      order.confirmedAt = new Date();
    } else if (status === 'shipped') {
      order.shippedAt = new Date();
    } else if (status === 'delivered') {
      order.deliveredAt = new Date();
    } else if (status === 'cancelled') {
      order.cancelledAt = new Date();
    }

    await order.save();

    // Send notification to user
    const user = await User.findOne({ uid: order.userId });
    if (user && user.fcmToken) {
      await fcmService.sendToUser(user.uid, {
        title: 'Order Status Updated',
        body: `Your order #${order.orderId} has been ${status}`,
        data: {
          type: 'order_status_update',
          orderId: order.orderId,
          status: status
        }
      });
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
      error: 'Failed to update order status'
    });
  }
};

// Cancel order
const cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;

    const firebaseUser = req.user;
    if (!firebaseUser || !firebaseUser.uid) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid Firebase user' 
      });
    }

    const order = await Order.findOne({ 
      orderId: orderId,
      userId: firebaseUser.uid 
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    if (order.orderStatus === 'delivered' || order.orderStatus === 'cancelled') {
      return res.status(400).json({
        success: false,
        error: 'Cannot cancel this order'
      });
    }

    order.orderStatus = 'cancelled';
    order.cancellationReason = reason;
    order.cancelledAt = new Date();

    // Restore medicine stock
    for (const item of order.items) {
      await Medicine.findOneAndUpdate(
        { medicineId: item.medicineId },
        { $inc: { stockQuantity: item.quantity } }
      );
    }

    await order.save();

    res.json({
      success: true,
      message: 'Order cancelled successfully',
      data: order
    });

  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel order'
    });
  }
};

// Send order confirmation email
const sendOrderConfirmationEmail = async (order) => {
  try {
    const transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: order.userEmail,
      subject: 'Order Confirmation - Arcular Plus',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #32CCBC;">Order Confirmation</h2>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>Order Details</h3>
            <p><strong>Order ID:</strong> ${order.orderId}</p>
            <p><strong>Order Date:</strong> ${order.createdAt.toDateString()}</p>
            <p><strong>Payment Method:</strong> ${order.paymentMethod.replace('_', ' ').toUpperCase()}</p>
            <p><strong>Total Amount:</strong> ₹${order.totalAmount}</p>
          </div>
          
          <div style="background-color: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h4>Order Items:</h4>
            ${order.items.map(item => `
              <div style="border-bottom: 1px solid #ddd; padding: 10px 0;">
                <p><strong>${item.medicineName}</strong></p>
                <p>Quantity: ${item.quantity} | Price: ₹${item.unitPrice} | Total: ₹${item.totalPrice}</p>
                <p>Pharmacy: ${item.pharmacyName}</p>
              </div>
            `).join('')}
          </div>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h4>Delivery Address:</h4>
            <p>${order.deliveryAddress.street}</p>
            <p>${order.deliveryAddress.city}, ${order.deliveryAddress.state} - ${order.deliveryAddress.pincode}</p>
            ${order.deliveryAddress.landmark ? `<p>Landmark: ${order.deliveryAddress.landmark}</p>` : ''}
          </div>
          
          <p style="color: #666; font-size: 14px;">
            Thank you for choosing Arcular Plus for your medicine needs.
          </p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    order.emailSent = true;
    await order.save();

  } catch (error) {
    console.error('Error sending order confirmation email:', error);
  }
};

module.exports = {
  createOrder,
  getUserOrders,
  getPharmacyOrders,
  updateOrderStatus,
  cancelOrder
};