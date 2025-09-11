const express = require('express');
const router = express.Router();
const nurseController = require('../controllers/nurseController');
const firebaseAuthMiddleware = require('../middleware/firebaseAuthMiddleware');

// Registration
router.post('/register', firebaseAuthMiddleware, nurseController.registerNurse);

// Get all nurses
router.get('/', firebaseAuthMiddleware, nurseController.getAllNurses);

// Staff routes for pending approvals
router.get('/pending-approvals', firebaseAuthMiddleware, nurseController.getPendingApprovalsForStaff);
router.post('/:nurseId/approve', firebaseAuthMiddleware, nurseController.approveNurseByStaff);
router.post('/:nurseId/reject', firebaseAuthMiddleware, nurseController.rejectNurseByStaff);

// Get nurses by hospital
router.get('/hospital/:hospitalName', firebaseAuthMiddleware, nurseController.getNursesByHospital);

// Get nurses affiliated to a hospital (by Mongo _id)
router.get('/affiliated/:hospitalId', firebaseAuthMiddleware, nurseController.getNursesByAffiliation);

// Associate nurse to current hospital by ARC ID
router.post('/associate/by-arcid', firebaseAuthMiddleware, nurseController.associateNurseByArcId);

// Get nurses by qualification
router.get('/qualification/:qualification', firebaseAuthMiddleware, nurseController.getNursesByQualification);

// Get nurse by UID (for login) - must come before /:id
router.get('/uid/:uid', firebaseAuthMiddleware, nurseController.getNurseByUID);

// Get nurse by email (for login verification)
router.get('/email/:email', firebaseAuthMiddleware, nurseController.getNurseByEmail);

// Get nurse by email (for login verification - unprotected)
router.get('/login-email/:email', nurseController.getNurseByEmail);

// Get nurse by ID (generic route - must come last)
router.get('/:id', firebaseAuthMiddleware, nurseController.getNurseById);

// Update nurse
router.put('/:id', firebaseAuthMiddleware, nurseController.updateNurse);

// Delete nurse
router.delete('/:id', firebaseAuthMiddleware, nurseController.deleteNurse);

// Admin routes
router.get('/pending-approvals', firebaseAuthMiddleware, nurseController.getPendingApprovals);
router.post('/:id/approve', firebaseAuthMiddleware, nurseController.approveNurse);
router.post('/:id/reject', firebaseAuthMiddleware, nurseController.rejectNurse);

// Public QR scanning endpoints
router.get('/qr/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    console.log('🔍 Nurse QR Scan Request - Raw Identifier:', identifier);

    const Nurse = require('../models/Nurse');
    
    // Try to find nurse by ARC ID first
    let nurse = await Nurse.findOne({ arcId: identifier });
    
    if (!nurse) {
      // If not found by ARC ID, try by UID
      nurse = await Nurse.findOne({ uid: identifier });
    }

    if (!nurse) {
      return res.status(404).json({ 
        error: 'Nurse not found',
        message: 'No nurse found with the provided identifier'
      });
    }

    // Return limited nurse info for QR scanning
    res.json({
      success: true,
      type: 'nurse',
      data: {
        uid: nurse.uid,
        arcId: nurse.arcId,
        fullName: nurse.fullName,
        email: nurse.email,
        mobileNumber: nurse.mobileNumber,
        qualification: nurse.qualification,
        experienceYears: nurse.experienceYears || 0,
        hospitalAffiliation: nurse.currentHospital,
        profileImageUrl: nurse.profileImageUrl,
        isApproved: nurse.isApproved,
        approvalStatus: nurse.approvalStatus,
      }
    });
  } catch (error) {
    console.error('Error fetching nurse by QR:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/qr/uid/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    console.log('🔍 Nurse QR Scan Request by UID:', uid);

    const Nurse = require('../models/Nurse');
    const nurse = await Nurse.findOne({ uid });

    if (!nurse) {
      return res.status(404).json({ 
        error: 'Nurse not found',
        message: 'No nurse found with the provided UID'
      });
    }

    // Return limited nurse info for QR scanning
    res.json({
      success: true,
      type: 'nurse',
      data: {
        uid: nurse.uid,
        arcId: nurse.arcId,
        fullName: nurse.fullName,
        email: nurse.email,
        mobileNumber: nurse.mobileNumber,
        qualification: nurse.qualification,
        experienceYears: nurse.experienceYears || 0,
        hospitalAffiliation: nurse.currentHospital,
        profileImageUrl: nurse.profileImageUrl,
        isApproved: nurse.isApproved,
        approvalStatus: nurse.approvalStatus,
      }
    });
  } catch (error) {
    console.error('Error fetching nurse by UID:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update nurse shift
router.put('/shift/:nurseId', firebaseAuthMiddleware, nurseController.updateNurseShift);

module.exports = router; 