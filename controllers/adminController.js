const User = require('../models/User');

// Register admin
const registerAdmin = async (req, res) => {
  try {
    const firebaseUser = req.user; // set by auth middleware
    if (!firebaseUser || !firebaseUser.uid) {
      return res.status(400).json({ error: 'Invalid Firebase user' });
    }
    
    // Check if admin already exists
    const existingAdmin = await User.findOne({ 
      uid: firebaseUser.uid,
      type: 'admin'
    });

    if (existingAdmin) {
      return res.status(400).json({ 
        success: false, 
        message: 'Admin already exists' 
      });
    }

    // Create new admin
    const adminData = {
      ...req.body,
      uid: firebaseUser.uid,
      type: 'admin',
      role: 'admin',
      createdAt: new Date(),
    };

    const admin = new User(adminData);
    await admin.save();

    console.log('✅ Admin registered successfully:', admin.email);

    res.status(201).json({
      success: true,
      message: 'Admin registered successfully',
      admin: {
        uid: admin.uid,
        email: admin.email,
        fullName: admin.fullName,
        type: admin.type,
        role: admin.role,
      }
    });

  } catch (error) {
    console.error('❌ Admin registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to register admin',
      error: error.message
    });
  }
};

// Get admin info
const getAdminInfo = async (req, res) => {
  try {
    const { adminId } = req.params;
    
    const admin = await User.findOne({ 
      uid: adminId,
      type: 'admin'
    });

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    res.status(200).json({
      success: true,
      admin: {
        uid: admin.uid,
        email: admin.email,
        fullName: admin.fullName,
        mobileNumber: admin.mobileNumber,
        organization: admin.organization,
        designation: admin.designation,
        address: admin.address,
        city: admin.city,
        state: admin.state,
        pincode: admin.pincode,
        type: admin.type,
        role: admin.role,
        createdAt: admin.createdAt,
      }
    });

  } catch (error) {
    console.error('❌ Get admin info error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get admin info',
      error: error.message
    });
  }
};
  

// Get all admins (for admin management)
const getAllAdmins = async (req, res) => {
  try {
    const admins = await User.find({ type: 'admin' })
      .select('-__v')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: admins.length,
      admins: admins
    });

  } catch (error) {
    console.error('❌ Get all admins error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get admins',
      error: error.message
    });
  }
};

// Update admin info
const updateAdmin = async (req, res) => {
  try {
    const { adminId } = req.params;
    const firebaseUser = req.user;

    // Check if admin exists
    const admin = await User.findOne({ 
      uid: adminId,
      type: 'admin'
    });

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    // Update admin info
    const updatedAdmin = await User.findByIdAndUpdate(
      admin._id,
      { ...req.body },
      { new: true, runValidators: true }
    );

    console.log('✅ Admin updated successfully:', updatedAdmin.email);

    res.status(200).json({
      success: true,
      message: 'Admin updated successfully',
      admin: {
        uid: updatedAdmin.uid,
        email: updatedAdmin.email,
        fullName: updatedAdmin.fullName,
        mobileNumber: updatedAdmin.mobileNumber,
        organization: updatedAdmin.organization,
        designation: updatedAdmin.designation,
        address: updatedAdmin.address,
        city: updatedAdmin.city,
        state: updatedAdmin.state,
        pincode: updatedAdmin.pincode,
        type: updatedAdmin.type,
        role: updatedAdmin.role,
      }
    });

  } catch (error) {
    console.error('❌ Update admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update admin',
      error: error.message
    });
  }
};

// Delete admin
const deleteAdmin = async (req, res) => {
  try {
    const { adminId } = req.params;

    const admin = await User.findOneAndDelete({ 
      uid: adminId,
      type: 'admin'
    });

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    console.log('✅ Admin deleted successfully:', admin.email);

    res.status(200).json({
      success: true,
      message: 'Admin deleted successfully'
    });

  } catch (error) {
    console.error('❌ Delete admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete admin',
      error: error.message
    });
  }
};

module.exports = {
  registerAdmin,
  getAdminInfo,
  getAllAdmins,
  updateAdmin,
  deleteAdmin,
}; 