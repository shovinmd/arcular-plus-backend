const express = require('express');
const router = express.Router();
const sosController = require('../controllers/sosController');
const { verifyFirebaseToken } = require('../middleware/firebaseAuth');

// Debug endpoint to check hospitals (temporary)
router.get('/debug/hospitals', async (req, res) => {
  try {
    const Hospital = require('../models/Hospital');
    
    const totalHospitals = await Hospital.countDocuments();
    const activeHospitals = await Hospital.countDocuments({ status: 'active' });
    const approvedHospitals = await Hospital.countDocuments({ isApproved: true });
    const activeApprovedHospitals = await Hospital.countDocuments({ 
      status: 'active', 
      isApproved: true 
    });
    
    console.log('🔍 Hospital counts:', {
      total: totalHospitals,
      active: activeHospitals,
      approved: approvedHospitals,
      activeApproved: activeApprovedHospitals
    });
    
    res.json({
      success: true,
      data: {
        totalHospitals,
        activeHospitals,
        approvedHospitals,
        activeApprovedHospitals
      }
    });
  } catch (e) {
    console.error('❌ Debug hospitals error:', e);
    res.status(500).json({
      success: false,
      error: e.message
    });
  }
});

// Create new SOS request
router.post('/create', verifyFirebaseToken, sosController.createSOSRequest);

// Get SOS requests for a specific hospital
router.get('/hospital/:hospitalId', verifyFirebaseToken, sosController.getHospitalSOSRequests);

// Accept SOS request
router.post('/accept/:hospitalId', verifyFirebaseToken, sosController.acceptSOSRequest);

// Mark patient as admitted
router.post('/admit/:hospitalId', verifyFirebaseToken, sosController.markPatientAdmitted);

// Discharge patient from hospital
router.post('/discharge/:hospitalId', verifyFirebaseToken, sosController.dischargePatient);

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

// Emergency Coordination System
router.post('/coordinate/:sosRequestId', verifyFirebaseToken, sosController.handleEmergencyCoordination);
router.get('/coordination-status/:sosRequestId', verifyFirebaseToken, sosController.getCoordinationStatus);

// Get SOS statistics
router.get('/statistics/:hospitalId', verifyFirebaseToken, sosController.getSOSStatistics);

// Synchronize hospital coordinates
router.post('/sync-hospital-coordinates', verifyFirebaseToken, sosController.synchronizeHospitalCoordinates);

// Send alert to specific hospital
router.post('/send-hospital-alert', verifyFirebaseToken, sosController.sendHospitalAlert);

module.exports = router;