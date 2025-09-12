const express = require('express');
const router = express.Router();
const labReportController = require('../controllers/labReportController');
const { verifyFirebaseToken } = require('../middleware/firebaseAuth');

// Get lab reports by hospital
router.get('/hospital/:hospitalId', verifyFirebaseToken, labReportController.getLabReportsByHospital);

// Create lab test request
router.post('/', verifyFirebaseToken, labReportController.createLabTestRequest);

// Update lab report status
router.put('/:reportId/status', verifyFirebaseToken, labReportController.updateLabReportStatus);

module.exports = router;