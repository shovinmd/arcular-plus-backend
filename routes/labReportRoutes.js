const express = require('express');
const router = express.Router();
const labReportController = require('../controllers/labReportController');
const { verifyFirebaseToken } = require('../middleware/firebaseAuth');

// Get lab reports by hospital
router.get('/hospital/:hospitalId', verifyFirebaseToken, labReportController.getLabReportsByHospital);

// Get lab reports by patient ARC ID
router.get('/patient/:arcId', verifyFirebaseToken, labReportController.getLabReportsByPatientArcId);

// Create lab test request
router.post('/', verifyFirebaseToken, labReportController.createLabTestRequest);

// Create lab report (upload)
router.post('/create', verifyFirebaseToken, labReportController.createLabReport);

// Update lab report status
router.put('/:reportId/status', verifyFirebaseToken, labReportController.updateLabReportStatus);

module.exports = router;