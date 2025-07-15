const express = require('express');
const auth = require('../middleware/auth');
const doctorController = require('../controllers/doctorController');
const router = express.Router();

// Profile
router.get('/:id', auth, doctorController.getDoctorProfile);
router.put('/:id', auth, doctorController.updateDoctorProfile);

// Appointments
router.get('/:id/appointments', auth, doctorController.getAppointments);
router.put('/:id/appointments/:appointmentId', auth, doctorController.updateAppointment);

// Patients
router.get('/:id/patients', auth, doctorController.getPatients);
router.get('/:id/patient/:patientId', auth, doctorController.getPatientInfo);

// Prescriptions
router.get('/:id/prescriptions', auth, doctorController.getPrescriptions);
router.post('/:id/prescriptions', auth, doctorController.createPrescription);
router.get('/:id/prescriptions/:prescriptionId', auth, doctorController.getPrescriptionDetails);

// Reports
router.get('/:id/reports', auth, doctorController.getReports);
router.post('/:id/reports', auth, doctorController.uploadReport);
router.get('/:id/reports/:reportId', auth, doctorController.getReportDetails);

// Availability
router.get('/:id/availability', auth, doctorController.getAvailability);
router.post('/:id/availability', auth, doctorController.addAvailabilitySlot);
router.delete('/:id/availability/:slotId', auth, doctorController.removeAvailabilitySlot);

// Notifications
router.get('/:id/notifications', auth, doctorController.getNotifications);

// Settings
router.put('/:id/settings', auth, doctorController.updateSettings);

module.exports = router; 