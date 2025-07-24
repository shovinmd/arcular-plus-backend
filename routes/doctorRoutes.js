const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const doctorController = require('../controllers/doctorController');
const router = express.Router();

// Profile
router.get('/:id', authenticateToken, doctorController.getDoctorProfile);
router.put('/:id', authenticateToken, doctorController.updateDoctorProfile);

// Appointments
router.get('/:id/appointments', authenticateToken, doctorController.getAppointments);
router.put('/:id/appointments/:appointmentId', authenticateToken, doctorController.updateAppointment);

// Patients
router.get('/:id/patients', authenticateToken, doctorController.getPatients);
router.get('/:id/patient/:patientId', authenticateToken, doctorController.getPatientInfo);

// Prescriptions
router.get('/:id/prescriptions', authenticateToken, doctorController.getPrescriptions);
router.post('/:id/prescriptions', authenticateToken, doctorController.createPrescription);
router.get('/:id/prescriptions/:prescriptionId', authenticateToken, doctorController.getPrescriptionDetails);

// Reports
router.get('/:id/reports', authenticateToken, doctorController.getReports);
router.post('/:id/reports', authenticateToken, doctorController.uploadReport);
router.get('/:id/reports/:reportId', authenticateToken, doctorController.getReportDetails);

// Availability
router.get('/:id/availability', authenticateToken, doctorController.getAvailability);
router.post('/:id/availability', authenticateToken, doctorController.addAvailabilitySlot);
router.delete('/:id/availability/:slotId', authenticateToken, doctorController.removeAvailabilitySlot);

// Notifications
router.get('/:id/notifications', authenticateToken, doctorController.getNotifications);

// Settings
router.put('/:id/settings', authenticateToken, doctorController.updateSettings);

module.exports = router; 