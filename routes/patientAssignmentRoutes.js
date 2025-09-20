const express = require('express');
const router = express.Router();
const patientAssignmentController = require('../controllers/patientAssignmentController');
const firebaseAuthMiddleware = require('../middleware/firebaseAuthMiddleware');

// Create patient assignment (Hospital only)
router.post('/create', firebaseAuthMiddleware, patientAssignmentController.createAssignment);

// Get assignments for doctor
router.get('/doctor', firebaseAuthMiddleware, patientAssignmentController.getDoctorAssignments);

// Get assignments for nurse
router.get('/nurse', firebaseAuthMiddleware, patientAssignmentController.getNurseAssignments);

// Get assignments for hospital
router.get('/hospital', firebaseAuthMiddleware, patientAssignmentController.getHospitalAssignments);

// Update assignment status (Doctor or Nurse)
router.put('/:assignmentId/status', firebaseAuthMiddleware, patientAssignmentController.updateAssignmentStatus);

// Delete assignment (Hospital only)
router.delete('/:assignmentId', firebaseAuthMiddleware, patientAssignmentController.deleteAssignment);

// Get assignment statistics (Hospital only)
router.get('/stats', firebaseAuthMiddleware, patientAssignmentController.getAssignmentStats);

module.exports = router;
