const express = require('express');
const router = express.Router();
const { recordVitals, getVitalsForPatient } = require('../controllers/vitalsController');
const firebaseAuthMiddleware = require('../middleware/firebaseAuthMiddleware');

// Record vitals (nurse)
router.post('/record', firebaseAuthMiddleware, recordVitals);

// Get vitals for a patient (doctor/nurse)
router.get('/patient/:patientId', firebaseAuthMiddleware, getVitalsForPatient);

module.exports = router;


