const express = require('express');
const router = express.Router();
const nurseController = require('../controllers/nurseController');
const { authenticateToken } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Nurse registration and management
router.post('/register', nurseController.registerNurse);
router.get('/', nurseController.getAllNurses);
router.get('/:id', nurseController.getNurseById);
router.get('/uid/:uid', nurseController.getNurseByUid);
router.put('/:id', nurseController.updateNurse);
router.delete('/:id', nurseController.deleteNurse);

// Search and filter routes
router.get('/hospital/:hospitalId', nurseController.getNursesByHospital);
router.get('/department/:department', nurseController.getNursesByDepartment);
router.get('/search', nurseController.searchNurses);

// Approval routes
router.get('/admin/pending', nurseController.getPendingApprovals);
router.put('/admin/:id/approve', nurseController.approveNurse);
router.put('/admin/:id/reject', nurseController.rejectNurse);

module.exports = router; 