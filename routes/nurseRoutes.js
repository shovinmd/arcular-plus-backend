const express = require('express');
const router = express.Router();
const nurseController = require('../controllers/nurseController');
const { authenticateToken } = require('../middleware/auth');

// Public routes
router.post('/register', nurseController.registerNurse);
router.get('/all', nurseController.getAllNurses);
router.get('/hospital/:hospitalName', nurseController.getNursesByHospital);
router.get('/qualification/:qualification', nurseController.getNursesByQualification);

// Protected routes
router.get('/:id', authenticateToken, nurseController.getNurseById);
router.get('/uid/:uid', authenticateToken, nurseController.getNurseByUID);
router.put('/:id', authenticateToken, nurseController.updateNurse);
router.delete('/:id', authenticateToken, nurseController.deleteNurse);

// Admin routes
router.get('/admin/pending', authenticateToken, nurseController.getPendingApprovals);
router.post('/admin/approve/:id', authenticateToken, nurseController.approveNurse);
router.post('/admin/reject/:id', authenticateToken, nurseController.rejectNurse);

module.exports = router; 