const express = require('express');
const router = express.Router();
const sosController = require('../controllers/sosController');
const { verifyFirebaseToken } = require('../middleware/firebaseAuth');

// Create new SOS request
router.post('/create', verifyFirebaseToken, sosController.createSOSRequest);

// Get SOS requests for a specific hospital
router.get('/hospital/:hospitalId', verifyFirebaseToken, sosController.getHospitalSOSRequests);

// Accept SOS request
router.post('/accept/:hospitalId', verifyFirebaseToken, sosController.acceptSOSRequest);

// Mark patient as admitted
router.post('/admit/:hospitalId', verifyFirebaseToken, sosController.markPatientAdmitted);

// Confirm patient admission (for users)
router.post('/confirm-admission', verifyFirebaseToken, sosController.confirmPatientAdmission);

// Confirm hospital reached (for users)
router.post('/confirm-hospital-reached', verifyFirebaseToken, sosController.confirmHospitalReached);

// Get patient's SOS history
router.get('/patient/:patientId', verifyFirebaseToken, sosController.getPatientSOSHistory);

// Cancel SOS request
router.post('/cancel/:sosRequestId', verifyFirebaseToken, sosController.cancelSOSRequest);

// Get SOS request by id (for polling)
router.get('/request/:sosRequestId', verifyFirebaseToken, sosController.getSOSRequestById);

// SOS Escalation System
router.post('/escalate/:sosRequestId', verifyFirebaseToken, sosController.handleSOSEscalation);
router.get('/escalation-status/:sosRequestId', verifyFirebaseToken, sosController.getSOSEscalationStatus);

// Get SOS statistics
router.get('/statistics/:hospitalId', verifyFirebaseToken, sosController.getSOSStatistics);

module.exports = router;