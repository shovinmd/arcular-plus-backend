const express = require('express');
const router = express.Router();
const { recordVitals, getVitalsForPatient, deleteVital, updateVitals } = require('../controllers/vitalsController');
const firebaseAuthMiddleware = require('../middleware/firebaseAuthMiddleware');

// Record vitals (nurse)
router.post('/record', firebaseAuthMiddleware, recordVitals);

// Get vitals for a patient (doctor/nurse)
router.get('/patient/:patientId', firebaseAuthMiddleware, getVitalsForPatient);

// Delete a vital record
router.delete('/:id', firebaseAuthMiddleware, deleteVital);

// Update a vital record
router.patch('/:id', firebaseAuthMiddleware, updateVitals);

module.exports = router;


