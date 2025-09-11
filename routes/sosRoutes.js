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

// Get patient's SOS history
router.get('/patient/:patientId', verifyFirebaseToken, sosController.getPatientSOSHistory);

// Cancel SOS request
router.post('/cancel/:sosRequestId', verifyFirebaseToken, sosController.cancelSOSRequest);

// Get SOS statistics
router.get('/statistics/:hospitalId', verifyFirebaseToken, sosController.getSOSStatistics);

module.exports = router;