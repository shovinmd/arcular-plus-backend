const express = require('express');
const router = express.Router();
const labController = require('../controllers/labController');
const firebaseAuthMiddleware = require('../middleware/firebaseAuthMiddleware');

// Registration
router.post('/register', firebaseAuthMiddleware, labController.registerLab);

// Get all labs
router.get('/', firebaseAuthMiddleware, labController.getAllLabs);

// Staff routes for pending approvals
router.get('/pending-approvals', firebaseAuthMiddleware, labController.getPendingApprovalsForStaff);
router.post('/:labId/approve', firebaseAuthMiddleware, labController.approveLabByStaff);
router.post('/:labId/reject', firebaseAuthMiddleware, labController.rejectLabByStaff);

// Get labs by city
router.get('/city/:city', firebaseAuthMiddleware, labController.getLabsByCity);

// Get labs by service
router.get('/service/:service', firebaseAuthMiddleware, labController.getLabsByService);

// Get lab by UID (for login) - must come before /:id
router.get('/uid/:uid', firebaseAuthMiddleware, labController.getLabByUID);

// Get lab by email (for login verification)
router.get('/email/:email', firebaseAuthMiddleware, labController.getLabByEmail);

// Get lab by ID (generic route - must come last)
router.get('/:id', firebaseAuthMiddleware, labController.getLabById);

// Update lab
router.put('/:id', firebaseAuthMiddleware, labController.updateLab);

// Delete lab
router.delete('/:id', firebaseAuthMiddleware, labController.deleteLab);

// Admin routes
router.get('/pending-approvals', firebaseAuthMiddleware, labController.getPendingApprovals);
router.post('/:id/approve', firebaseAuthMiddleware, labController.approveLab);
router.post('/:id/reject', firebaseAuthMiddleware, labController.rejectLab);

module.exports = router; 