const express = require('express');
const auth = require('../middleware/auth');
const hospitalController = require('../controllers/hospitalController');
const router = express.Router();

// Profile
router.get('/:id', auth, hospitalController.getHospitalProfile);
router.put('/:id', auth, hospitalController.updateHospitalProfile);

// Doctors
router.get('/:id/doctors', auth, hospitalController.getDoctors);
router.post('/:id/doctors', auth, hospitalController.addDoctor);
router.delete('/:id/doctors/:doctorId', auth, hospitalController.removeDoctor);

// Departments
router.get('/:id/departments', auth, hospitalController.getDepartments);
router.post('/:id/departments', auth, hospitalController.addDepartment);
router.delete('/:id/departments/:deptName', auth, hospitalController.removeDepartment);

// Appointments
router.get('/:id/appointments', auth, hospitalController.getAppointments);
router.post('/:id/appointments', auth, hospitalController.createAppointment);
router.put('/:id/appointments/:appointmentId', auth, hospitalController.updateAppointment);

// Admissions
router.get('/:id/admissions', auth, hospitalController.getAdmissions);
router.post('/:id/admissions', auth, hospitalController.admitPatient);
router.put('/:id/admissions/:admissionId', auth, hospitalController.updateAdmission);

// Pharmacy
router.get('/:id/pharmacy', auth, hospitalController.getPharmacyItems);
router.post('/:id/pharmacy', auth, hospitalController.addPharmacyItem);
router.put('/:id/pharmacy/:itemId', auth, hospitalController.updatePharmacyItem);
router.delete('/:id/pharmacy/:itemId', auth, hospitalController.removePharmacyItem);

// Lab
router.get('/:id/lab-tests', auth, hospitalController.getLabTests);
router.post('/:id/lab-tests', auth, hospitalController.addLabTest);
router.put('/:id/lab-tests/:testId', auth, hospitalController.updateLabTest);
router.delete('/:id/lab-tests/:testId', auth, hospitalController.removeLabTest);

// QR Records
router.get('/:id/qr-records', auth, hospitalController.getQrRecords);

// Analytics
router.get('/:id/analytics', auth, hospitalController.getAnalytics);

// Reports
router.get('/:id/reports', auth, hospitalController.getReports);

// Chat
router.get('/:id/chat', auth, hospitalController.getChatMessages);
router.post('/:id/chat', auth, hospitalController.sendChatMessage);

// Shifts
router.get('/:id/shifts', auth, hospitalController.getShifts);
router.post('/:id/shifts', auth, hospitalController.createShift);
router.put('/:id/shifts/:shiftId', auth, hospitalController.updateShift);
router.delete('/:id/shifts/:shiftId', auth, hospitalController.deleteShift);

// Billing
router.get('/:id/billing', auth, hospitalController.getBilling);
router.post('/:id/billing', auth, hospitalController.createBillingEntry);

// Documents
router.get('/:id/documents', auth, hospitalController.getDocuments);
router.post('/:id/documents', auth, hospitalController.uploadDocument);

// Notifications
router.get('/:id/notifications', auth, hospitalController.getNotifications);

// Settings
router.put('/:id/settings', auth, hospitalController.updateSettings);

// Hospital registration
router.post('/register', auth, hospitalController.registerHospital);

// Fetch all hospitals
router.get('/', auth, hospitalController.getAllHospitals);

module.exports = router; 