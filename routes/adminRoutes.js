const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authenticateToken = require('../middleware/firebaseAuthMiddleware');

// Admin registration (requires Firebase auth)
router.post('/register', authenticateToken, adminController.registerAdmin);

// Get all admins (requires Firebase auth) - must come before /:adminId
router.get('/', authenticateToken, adminController.getAllAdmins);

// Admin management routes (must come after specific routes)
router.get('/:adminId', authenticateToken, adminController.getAdminInfo);
router.put('/:adminId', authenticateToken, adminController.updateAdmin);
router.delete('/:adminId', authenticateToken, adminController.deleteAdmin);

module.exports = router; 