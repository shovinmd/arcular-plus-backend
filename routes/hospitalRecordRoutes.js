const express = require('express');
const router = express.Router();
const hospitalRecordController = require('../controllers/hospitalRecordController');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// Create a new hospital record
router.post('/create', hospitalRecordController.createHospitalRecord);

// Get all hospital records for a hospital
router.get('/', hospitalRecordController.getHospitalRecords);

// Get hospital records statistics
router.get('/stats', hospitalRecordController.getHospitalRecordsStats);

// Get a specific hospital record
router.get('/:recordId', hospitalRecordController.getHospitalRecordById);

// Update a hospital record
router.put('/:recordId', hospitalRecordController.updateHospitalRecord);

// Delete a hospital record
router.delete('/:recordId', hospitalRecordController.deleteHospitalRecord);

// Get patient by ARC ID
router.get('/patient/arc/:arcId', hospitalRecordController.getPatientByArcId);

module.exports = router;
