const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const User = require('../models/User');
const { getUserProfile, getUserByArcId } = require('../controllers/userController');
const firebaseAuthMiddleware = require('../middleware/firebaseAuthMiddleware');

// Get user profile
router.get('/:uid', authenticateToken, async (req, res) => {
  const { uid } = req.params;
  const user = await User.findOne({ uid });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// Update user profile
router.put('/:uid', authenticateToken, async (req, res) => {
  const { uid } = req.params;
  const update = req.body;
  const user = await User.findOneAndUpdate({ uid }, update, { new: true });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// Add user registration/sync endpoint
router.post('/register', authenticateToken, require('../controllers/userController').registerOrSyncUser);
router.get('/profile', firebaseAuthMiddleware, getUserProfile);

// Add public endpoint to get user by ARC ID
router.get('/arc/:arcId', getUserByArcId);

module.exports = router; 
