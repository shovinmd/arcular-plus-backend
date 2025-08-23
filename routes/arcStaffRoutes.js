const express = require('express');
const router = express.Router();
const arcStaffController = require('../controllers/arcStaffController');
const authenticateToken = require('../middleware/firebaseAuthMiddleware');

// Registration route
router.post('/register', authenticateToken, arcStaffController.registerArcStaff);

// Admin routes (create, manage staff)
router.post('/create', authenticateToken, arcStaffController.createArcStaff);
router.get('/all', authenticateToken, arcStaffController.getAllArcStaff);

// Arc Staff routes (approval operations) - must come before /:staffId routes
router.get('/pending-approvals', authenticateToken, arcStaffController.getPendingApprovals);
router.post('/approve/:userId', authenticateToken, arcStaffController.approveUser);
router.post('/reject/:userId', authenticateToken, arcStaffController.rejectUser);
router.get('/profile', authenticateToken, arcStaffController.getArcStaffProfile);

// Staff management routes (must come after specific routes)
router.get('/:staffId', authenticateToken, arcStaffController.getArcStaffById);
router.put('/:staffId', authenticateToken, arcStaffController.updateArcStaff);
router.delete('/:staffId', authenticateToken, arcStaffController.deleteArcStaff);

module.exports = router; 