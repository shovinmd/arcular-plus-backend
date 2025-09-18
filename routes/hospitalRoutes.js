const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const firebaseAuthMiddleware = require('../middleware/firebaseAuthMiddleware');
const hospitalController = require('../controllers/hospitalController');
const router = express.Router();

// Public route to get all approved hospitals (for appointment booking)
router.get('/', firebaseAuthMiddleware, hospitalController.getAllApprovedHospitals);

// Hospital approval routes (Admin only)
router.get('/admin/pending', authenticateToken, hospitalController.getPendingHospitals);
router.get('/admin/all', authenticateToken, hospitalController.getAllHospitals);
router.post('/admin/:hospitalId/approve', authenticateToken, hospitalController.approveHospital);
router.post('/admin/:hospitalId/reject', authenticateToken, hospitalController.rejectHospital);
router.put('/admin/:hospitalId/status', authenticateToken, hospitalController.updateApprovalStatus);

// Staff routes for pending approvals
router.get('/pending-approvals', firebaseAuthMiddleware, hospitalController.getPendingApprovalsForStaff);
router.post('/:hospitalId/approve', firebaseAuthMiddleware, hospitalController.approveHospitalByStaff);
router.post('/:hospitalId/reject', firebaseAuthMiddleware, hospitalController.rejectHospitalByStaff);

// Get hospital by UID (for login) - MUST BE BEFORE GENERIC :id ROUTES
router.get('/uid/:uid', firebaseAuthMiddleware, hospitalController.getHospitalProfile);
router.put('/uid/:uid', firebaseAuthMiddleware, hospitalController.updateHospitalProfile);

// Get hospital by email (for login verification)
router.get('/email/:email', firebaseAuthMiddleware, hospitalController.getHospitalByEmail);

// Get hospital by email (for login verification - unprotected)
router.get('/login-email/:email', hospitalController.getHospitalByEmail);

// Hospital approval status check
router.get('/:uid/approval-status', firebaseAuthMiddleware, hospitalController.getHospitalApprovalStatus);

// Profile
router.get('/:id', firebaseAuthMiddleware, hospitalController.getHospitalProfile);
router.put('/:id', firebaseAuthMiddleware, hospitalController.updateHospitalProfile);

// Doctors
router.get('/:id/doctors', firebaseAuthMiddleware, hospitalController.getDoctors);
router.post('/:id/doctors', firebaseAuthMiddleware, hospitalController.addDoctor);
router.delete('/:id/doctors/:doctorId', firebaseAuthMiddleware, hospitalController.removeDoctor);

// Departments
router.get('/:id/departments', firebaseAuthMiddleware, hospitalController.getDepartments);
router.post('/:id/departments', firebaseAuthMiddleware, hospitalController.addDepartment);
router.delete('/:id/departments/:deptName', firebaseAuthMiddleware, hospitalController.removeDepartment);

// Appointments
router.get('/:id/appointments', firebaseAuthMiddleware, hospitalController.getAppointments);
router.post('/:id/appointments', firebaseAuthMiddleware, hospitalController.createAppointment);
router.put('/:id/appointments/:appointmentId', firebaseAuthMiddleware, hospitalController.updateAppointment);

// Back-compat alias for booking via singular action
router.post('/:id/appointments/book', firebaseAuthMiddleware, hospitalController.createAppointment);

// Admissions
router.get('/:id/admissions', firebaseAuthMiddleware, hospitalController.getAdmissions);
router.post('/:id/admissions', firebaseAuthMiddleware, hospitalController.admitPatient);
router.put('/:id/admissions/:admissionId', firebaseAuthMiddleware, hospitalController.updateAdmission);

// Pharmacy
router.get('/:id/pharmacy', firebaseAuthMiddleware, hospitalController.getPharmacyItems);
router.post('/:id/pharmacy', firebaseAuthMiddleware, hospitalController.addPharmacyItem);
router.put('/:id/pharmacy/:itemId', firebaseAuthMiddleware, hospitalController.updatePharmacyItem);
router.delete('/:id/pharmacy/:itemId', firebaseAuthMiddleware, hospitalController.removePharmacyItem);

// Lab
router.get('/:id/lab-tests', firebaseAuthMiddleware, hospitalController.getLabTests);
router.post('/:id/lab-tests', firebaseAuthMiddleware, hospitalController.addLabTest);
router.put('/:id/lab-tests/:testId', firebaseAuthMiddleware, hospitalController.updateLabTest);
router.delete('/:id/lab-tests/:testId', firebaseAuthMiddleware, hospitalController.removeLabTest);

// QR Records
router.get('/:id/qr-records', firebaseAuthMiddleware, hospitalController.getQrRecords);

// Public QR scanning endpoints
router.get('/qr/:identifier', hospitalController.getHospitalByQr);
router.get('/qr/uid/:uid', hospitalController.getHospitalByUid);


// Analytics
router.get('/:id/analytics', firebaseAuthMiddleware, hospitalController.getAnalytics);

// Reports
router.get('/:id/reports', firebaseAuthMiddleware, hospitalController.getReports);

// Chat
router.get('/:id/chat', firebaseAuthMiddleware, hospitalController.getChatMessages);
router.post('/:id/chat', firebaseAuthMiddleware, hospitalController.sendChatMessage);

// Shifts
router.get('/:id/shifts', firebaseAuthMiddleware, hospitalController.getShifts);
router.post('/:id/shifts', firebaseAuthMiddleware, hospitalController.createShift);
router.put('/:id/shifts/:shiftId', firebaseAuthMiddleware, hospitalController.updateShift);
router.delete('/:id/shifts/:shiftId', firebaseAuthMiddleware, hospitalController.deleteShift);

// Billing
router.get('/:id/billing', firebaseAuthMiddleware, hospitalController.getBilling);
router.post('/:id/billing', firebaseAuthMiddleware, hospitalController.createBillingEntry);

// Documents
router.get('/:id/documents', firebaseAuthMiddleware, hospitalController.getDocuments);
router.post('/:id/documents', firebaseAuthMiddleware, hospitalController.uploadDocument);

// Notifications
router.get('/:id/notifications', firebaseAuthMiddleware, hospitalController.getNotifications);

// Settings
router.put('/:id/settings', firebaseAuthMiddleware, hospitalController.updateSettings);

// Get approved hospitals for affiliation selection (public - for registration)
router.get('/affiliation/approved', hospitalController.getApprovedHospitalsForAffiliation);

// Search hospitals for affiliation (public - for registration)
router.get('/affiliation/search', hospitalController.searchHospitalsForAffiliation);

// Search hospitals by name
router.get('/search', firebaseAuthMiddleware, hospitalController.searchHospitalsByName);

// Get nearby hospitals for SOS
router.get('/nearby', firebaseAuthMiddleware, hospitalController.getNearbyHospitals);

// Hospital registration
router.post('/register', firebaseAuthMiddleware, hospitalController.registerHospital);

// Fetch all hospitals (must be last to avoid catching other routes)
router.get('/', firebaseAuthMiddleware, hospitalController.getAllHospitals);

module.exports = router; 