const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { verifyFirebaseToken, verifyAdminRole } = require('../middleware/firebaseAuth');
const authenticateToken = require('../middleware/firebaseAuthMiddleware');

// Admin registration (requires Firebase auth)
router.post('/register', authenticateToken, adminController.registerAdmin);

// Get all admins (requires Firebase auth) - must come before /:adminId
router.get('/', authenticateToken, adminController.getAllAdmins);

// Admin management routes (must come after specific routes)
router.get('/:adminId', authenticateToken, adminController.getAdminInfo);
router.put('/:adminId', authenticateToken, adminController.updateAdmin);
router.delete('/:adminId', authenticateToken, adminController.deleteAdmin);

// Staff profile change routes for admin
router.get('/admin/profile-changes', verifyFirebaseToken, verifyAdminRole, adminController.getPendingProfileChanges);
router.post('/admin/profile-changes/:changeId/approve', verifyFirebaseToken, verifyAdminRole, adminController.approveProfileChange);
router.post('/admin/profile-changes/:changeId/reject', verifyFirebaseToken, verifyAdminRole, adminController.rejectProfileChange);

module.exports = router; 