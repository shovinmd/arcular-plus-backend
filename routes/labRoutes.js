const express = require('express');
const router = express.Router();
const labController = require('../controllers/labController');
const firebaseAuthMiddleware = require('../middleware/firebaseAuthMiddleware');

// Registration
router.post('/register', firebaseAuthMiddleware, labController.registerLab);

// Get all labs
router.get('/', firebaseAuthMiddleware, labController.getAllLabs);

// Staff routes for pending approvals
router.get('/pending-approvals', firebaseAuthMiddleware, labController.getPendingApprovalsForStaff);

// Get labs affiliated to a hospital (by Mongo _id)
router.get('/affiliated/:hospitalId', firebaseAuthMiddleware, labController.getLabsByAffiliation);

// Associate lab with hospital
router.post('/associate/:hospitalId', firebaseAuthMiddleware, labController.associateLabWithHospital);

// Approve a lab by staff
router.post('/:labId/approve', firebaseAuthMiddleware, labController.approveLabByStaff);
router.post('/:labId/reject', firebaseAuthMiddleware, labController.rejectLabByStaff);

// Get labs by city
router.get('/city/:city', firebaseAuthMiddleware, labController.getLabsByCity);

// Get labs by service
router.get('/service/:service', firebaseAuthMiddleware, labController.getLabsByService);

// Get lab by UID (for login) - must come before /:id
router.get('/uid/:uid', firebaseAuthMiddleware, labController.getLabByUID);

// Get lab by email (for login verification)
router.get('/email/:email', firebaseAuthMiddleware, labController.getLabByEmail);

// Get lab by email (for login verification - unprotected)
router.get('/login-email/:email', labController.getLabByEmail);

// Get lab by ID (generic route - must come last)
router.get('/:id', firebaseAuthMiddleware, labController.getLabById);

// Update lab
router.put('/:id', firebaseAuthMiddleware, labController.updateLab);

// Delete lab
router.delete('/:id', firebaseAuthMiddleware, labController.deleteLab);

// Admin routes
router.get('/pending-approvals', firebaseAuthMiddleware, labController.getPendingApprovals);
router.post('/:id/approve', firebaseAuthMiddleware, labController.approveLab);
router.post('/:id/reject', firebaseAuthMiddleware, labController.rejectLab);

// Public QR scanning endpoints
router.get('/qr/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    console.log('🔍 Lab QR Scan Request - Raw Identifier:', identifier);

    const Lab = require('../models/Lab');
    
    // Try to find lab by ARC ID first
    let lab = await Lab.findOne({ arcId: identifier });
    
    if (!lab) {
      // If not found by ARC ID, try by UID
      lab = await Lab.findOne({ uid: identifier });
    }

    if (!lab) {
      return res.status(404).json({ 
        error: 'Lab not found',
        message: 'No lab found with the provided identifier'
      });
    }

    // Return limited lab info for QR scanning
    res.json({
      success: true,
      type: 'lab',
      data: {
        uid: lab.uid,
        arcId: lab.arcId,
        labName: lab.labName,
        email: lab.email,
        mobileNumber: lab.mobileNumber,
        address: lab.address,
        city: lab.city,
        state: lab.state,
        pincode: lab.pincode,
        services: lab.services,
        profileImageUrl: lab.profileImageUrl,
        isApproved: lab.isApproved,
        approvalStatus: lab.approvalStatus,
      }
    });
  } catch (error) {
    console.error('Error fetching lab by QR:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/qr/uid/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    console.log('🔍 Lab QR Scan Request by UID:', uid);

    const Lab = require('../models/Lab');
    const lab = await Lab.findOne({ uid });

    if (!lab) {
      return res.status(404).json({ 
        error: 'Lab not found',
        message: 'No lab found with the provided UID'
      });
    }

    // Return limited lab info for QR scanning
    res.json({
      success: true,
      type: 'lab',
      data: {
        uid: lab.uid,
        arcId: lab.arcId,
        labName: lab.labName,
        email: lab.email,
        mobileNumber: lab.mobileNumber,
        address: lab.address,
        city: lab.city,
        state: lab.state,
        pincode: lab.pincode,
        services: lab.services,
        profileImageUrl: lab.profileImageUrl,
        isApproved: lab.isApproved,
        approvalStatus: lab.approvalStatus,
      }
    });
  } catch (error) {
    console.error('Error fetching lab by UID:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 