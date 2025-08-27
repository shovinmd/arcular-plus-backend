const express = require('express');
const router = express.Router();
const nurseController = require('../controllers/nurseController');
const firebaseAuthMiddleware = require('../middleware/firebaseAuthMiddleware');

// Registration
router.post('/register', firebaseAuthMiddleware, nurseController.registerNurse);

// Get all nurses
router.get('/', firebaseAuthMiddleware, nurseController.getAllNurses);

// Staff routes for pending approvals
router.get('/pending-approvals', firebaseAuthMiddleware, nurseController.getPendingApprovalsForStaff);
router.post('/:nurseId/approve', firebaseAuthMiddleware, nurseController.approveNurseByStaff);
router.post('/:nurseId/reject', firebaseAuthMiddleware, nurseController.rejectNurseByStaff);

// Get nurses by hospital
router.get('/hospital/:hospitalName', firebaseAuthMiddleware, nurseController.getNursesByHospital);

// Get nurses by qualification
router.get('/qualification/:qualification', firebaseAuthMiddleware, nurseController.getNursesByQualification);

// Get nurse by UID (for login) - must come before /:id
router.get('/uid/:uid', firebaseAuthMiddleware, nurseController.getNurseByUID);

// Get nurse by email (for login verification)
router.get('/email/:email', firebaseAuthMiddleware, nurseController.getNurseByEmail);

// Get nurse by email (for login verification - unprotected)
router.get('/login-email/:email', nurseController.getNurseByEmail);

// Get nurse by ID (generic route - must come last)
router.get('/:id', firebaseAuthMiddleware, nurseController.getNurseById);

// Update nurse
router.put('/:id', firebaseAuthMiddleware, nurseController.updateNurse);

// Delete nurse
router.delete('/:id', firebaseAuthMiddleware, nurseController.deleteNurse);

// Admin routes
router.get('/pending-approvals', firebaseAuthMiddleware, nurseController.getPendingApprovals);
router.post('/:id/approve', firebaseAuthMiddleware, nurseController.approveNurse);
router.post('/:id/reject', firebaseAuthMiddleware, nurseController.rejectNurse);

module.exports = router; 