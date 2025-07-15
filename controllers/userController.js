const User = require('../models/User');
const { validationResult } = require('express-validator');

// Get user by UID
const getUserByUid = async (req, res) => {
  try {
    const { uid } = req.params;
    const user = await User.findByUid(uid);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user.getPublicProfile()
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user'
    });
  }
};

// Create new user
const createUser = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const {
      uid,
      name,
      email,
      phone,
      type,
      age,
      height,
      weight,
      hospitalName,
      licenseNumber
    } = req.body;

    // Check if user already exists
    const existingUser = await User.findByUid(uid);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'User already exists'
      });
    }

    const userData = {
      uid,
      name,
      email,
      phone,
      type,
      createdAt: new Date()
    };

    // Add type-specific fields
    if (type === 'user') {
      userData.age = age;
      userData.height = height;
      userData.weight = weight;
    } else if (type === 'hospital') {
      userData.hospitalName = hospitalName;
      userData.licenseNumber = licenseNumber;
    }

    const user = new User(userData);
    await user.save();

    res.status(201).json({
      success: true,
      data: user.getPublicProfile(),
      message: 'User created successfully'
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create user'
    });
  }
};

// Update user
const updateUser = async (req, res) => {
  try {
    const { uid } = req.params;
    const updateData = req.body;

    const user = await User.findByUid(uid);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Update user
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        user[key] = updateData[key];
      }
    });

    await user.save();

    res.json({
      success: true,
      data: user.getPublicProfile(),
      message: 'User updated successfully'
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user'
    });
  }
};

exports.registerOrSyncUser = async (req, res) => {
  try {
    const firebaseUser = req.user; // set by auth middleware
    if (!firebaseUser || !firebaseUser.uid) {
      return res.status(400).json({ error: 'Invalid Firebase user' });
    }
    const User = require('../models/User');
    let user = await User.findOne({ uid: firebaseUser.uid });
    if (!user) {
      // Create new user in MongoDB
      user = new User({
        uid: firebaseUser.uid,
        fullName: firebaseUser.name || firebaseUser.displayName || '',
        email: firebaseUser.email || '',
        type: req.body.type || 'patient',
        status: 'active',
        createdAt: new Date(),
        // Add more fields as needed from req.body
        ...req.body
      });
      await user.save();
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getUserByUid,
  createUser,
  updateUser
}; 