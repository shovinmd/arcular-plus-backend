const express = require('express');
const firebaseAuthMiddleware = require('../middleware/firebaseAuthMiddleware');
const doctorController = require('../controllers/doctorController');
const router = express.Router();

// Registration
router.post('/register', firebaseAuthMiddleware, doctorController.registerDoctor);

// Get all doctors
router.get('/', firebaseAuthMiddleware, doctorController.getAllDoctors);

// Get pending approvals
router.get('/pending-approvals', firebaseAuthMiddleware, doctorController.getPendingApprovals);

// Get doctors by hospital
router.get('/hospital/:hospitalId', firebaseAuthMiddleware, doctorController.getDoctorsByHospital);

// Get doctors by specialization
router.get('/specialization/:specialization', firebaseAuthMiddleware, doctorController.getDoctorsBySpecialization);

// Search doctors
router.get('/search', firebaseAuthMiddleware, doctorController.searchDoctors);

// Get doctor by UID (for login) - must come before /:id
router.get('/uid/:uid', firebaseAuthMiddleware, doctorController.getDoctorByUID);

// Approval workflow - must come before /:id
router.post('/:id/approve', firebaseAuthMiddleware, doctorController.approveDoctor);
router.post('/:id/reject', firebaseAuthMiddleware, doctorController.rejectDoctor);

// Get doctor by ID (generic route - must come last)
router.get('/:id', firebaseAuthMiddleware, doctorController.getDoctorById);

// Update doctor
router.put('/:id', firebaseAuthMiddleware, doctorController.updateDoctor);

// Delete doctor
router.delete('/:id', firebaseAuthMiddleware, doctorController.deleteDoctor);

module.exports = router; 