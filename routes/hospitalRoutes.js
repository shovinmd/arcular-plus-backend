const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const hospitalController = require('../controllers/hospitalController');
const router = express.Router();

// Hospital approval routes (Admin only)
router.get('/admin/pending', authenticateToken, hospitalController.getPendingHospitals);
router.get('/admin/all', authenticateToken, hospitalController.getAllHospitals);
router.post('/admin/:hospitalId/approve', authenticateToken, hospitalController.approveHospital);
router.post('/admin/:hospitalId/reject', authenticateToken, hospitalController.rejectHospital);
router.put('/admin/:hospitalId/status', authenticateToken, hospitalController.updateApprovalStatus);

// Hospital approval status check
router.get('/:uid/approval-status', authenticateToken, hospitalController.getHospitalApprovalStatus);

// Get hospital by UID (for login)
router.get('/uid/:uid', authenticateToken, hospitalController.getHospitalProfile);

// Profile
router.get('/:id', authenticateToken, hospitalController.getHospitalProfile);
router.put('/:id', authenticateToken, hospitalController.updateHospitalProfile);

// Doctors
router.get('/:id/doctors', authenticateToken, hospitalController.getDoctors);
router.post('/:id/doctors', authenticateToken, hospitalController.addDoctor);
router.delete('/:id/doctors/:doctorId', authenticateToken, hospitalController.removeDoctor);

// Departments
router.get('/:id/departments', authenticateToken, hospitalController.getDepartments);
router.post('/:id/departments', authenticateToken, hospitalController.addDepartment);
router.delete('/:id/departments/:deptName', authenticateToken, hospitalController.removeDepartment);

// Appointments
router.get('/:id/appointments', authenticateToken, hospitalController.getAppointments);
router.post('/:id/appointments', authenticateToken, hospitalController.createAppointment);
router.put('/:id/appointments/:appointmentId', authenticateToken, hospitalController.updateAppointment);

// Admissions
router.get('/:id/admissions', authenticateToken, hospitalController.getAdmissions);
router.post('/:id/admissions', authenticateToken, hospitalController.admitPatient);
router.put('/:id/admissions/:admissionId', authenticateToken, hospitalController.updateAdmission);

// Pharmacy
router.get('/:id/pharmacy', authenticateToken, hospitalController.getPharmacyItems);
router.post('/:id/pharmacy', authenticateToken, hospitalController.addPharmacyItem);
router.put('/:id/pharmacy/:itemId', authenticateToken, hospitalController.updatePharmacyItem);
router.delete('/:id/pharmacy/:itemId', authenticateToken, hospitalController.removePharmacyItem);

// Lab
router.get('/:id/lab-tests', authenticateToken, hospitalController.getLabTests);
router.post('/:id/lab-tests', authenticateToken, hospitalController.addLabTest);
router.put('/:id/lab-tests/:testId', authenticateToken, hospitalController.updateLabTest);
router.delete('/:id/lab-tests/:testId', authenticateToken, hospitalController.removeLabTest);

// QR Records
router.get('/:id/qr-records', authenticateToken, hospitalController.getQrRecords);

// Analytics
router.get('/:id/analytics', authenticateToken, hospitalController.getAnalytics);

// Reports
router.get('/:id/reports', authenticateToken, hospitalController.getReports);

// Chat
router.get('/:id/chat', authenticateToken, hospitalController.getChatMessages);
router.post('/:id/chat', authenticateToken, hospitalController.sendChatMessage);

// Shifts
router.get('/:id/shifts', authenticateToken, hospitalController.getShifts);
router.post('/:id/shifts', authenticateToken, hospitalController.createShift);
router.put('/:id/shifts/:shiftId', authenticateToken, hospitalController.updateShift);
router.delete('/:id/shifts/:shiftId', authenticateToken, hospitalController.deleteShift);

// Billing
router.get('/:id/billing', authenticateToken, hospitalController.getBilling);
router.post('/:id/billing', authenticateToken, hospitalController.createBillingEntry);

// Documents
router.get('/:id/documents', authenticateToken, hospitalController.getDocuments);
router.post('/:id/documents', authenticateToken, hospitalController.uploadDocument);

// Notifications
router.get('/:id/notifications', authenticateToken, hospitalController.getNotifications);

// Settings
router.put('/:id/settings', authenticateToken, hospitalController.updateSettings);

// Hospital registration
router.post('/register', authenticateToken, hospitalController.registerHospital);

// Fetch all hospitals
router.get('/', authenticateToken, hospitalController.getAllHospitals);

module.exports = router; 