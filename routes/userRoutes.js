const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const User = require('../models/User');
const { getUserProfile, getUserByArcId } = require('../controllers/userController');
const firebaseAuthMiddleware = require('../middleware/firebaseAuthMiddleware');

// Get user profile by UID
router.get('/:uid', firebaseAuthMiddleware, async (req, res) => {
  try {
    const { uid } = req.params;
    const user = await User.findOne({ uid });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user by email
router.get('/email/:email', firebaseAuthMiddleware, async (req, res) => {
  try {
    const { email } = req.params;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Error fetching user by email:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user by phone
router.get('/phone/:phone', firebaseAuthMiddleware, async (req, res) => {
  try {
    const { phone } = req.params;
    const user = await User.findOne({ mobileNumber: phone });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Error fetching user by phone:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user profile
router.put('/:uid', firebaseAuthMiddleware, require('../controllers/userController').updateUser);

// Add user registration/sync endpoint
router.post('/register', firebaseAuthMiddleware, require('../controllers/userController').registerOrSyncUser);
router.get('/profile', firebaseAuthMiddleware, getUserProfile);

// Add public endpoint to get user by ARC ID
router.get('/arc/:arcId', getUserByArcId);

// Test endpoint to check if backend is working
router.get('/test/health', (req, res) => {
  res.json({ message: 'Backend is working!', timestamp: new Date().toISOString() });
});

// Test endpoint to check User model
router.get('/test/user-model', async (req, res) => {
  try {
    const User = require('../models/User');
    const testUser = new User({
      uid: 'test-uid',
      fullName: 'Test User',
      email: 'test@example.com',
      mobileNumber: '1234567890',
      gender: 'Male',
      dateOfBirth: new Date(),
      address: 'Test Address',
      pincode: '123456',
      city: 'Test City',
      state: 'Test State',
      type: 'patient',
      aadhaarNumber: '123456789012',
      aadhaarFrontImageUrl: 'test-front-url',
      aadhaarBackImageUrl: 'test-back-url',
    });
    res.json({ 
      message: 'User model is working!', 
      testUser: testUser.getPublicProfile(),
      hasFindByUid: typeof User.findByUid === 'function'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router; 
