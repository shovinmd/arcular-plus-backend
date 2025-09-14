const express = require('express');
const router = express.Router();
const pharmacyController = require('../controllers/pharmacyController');
const firebaseAuthMiddleware = require('../middleware/firebaseAuthMiddleware');

// Registration
router.post('/register', firebaseAuthMiddleware, pharmacyController.registerPharmacy);

// Get all pharmacies
router.get('/', firebaseAuthMiddleware, pharmacyController.getAllPharmacies);

// Staff routes for pending approvals
router.get('/pending-approvals', firebaseAuthMiddleware, pharmacyController.getPendingApprovalsForStaff);

// Get pharmacies affiliated to a hospital (by Mongo _id)
router.get('/affiliated/:hospitalId', firebaseAuthMiddleware, pharmacyController.getPharmaciesByAffiliation);

// Approve pharmacy by staff
router.post('/:pharmacyId/approve', firebaseAuthMiddleware, pharmacyController.approvePharmacyByStaff);
router.post('/:pharmacyId/reject', firebaseAuthMiddleware, pharmacyController.rejectPharmacyByStaff);

// Get pharmacies by city
router.get('/city/:city', firebaseAuthMiddleware, pharmacyController.getPharmaciesByCity);

// Get pharmacies by drug
router.get('/drug/:drugName', firebaseAuthMiddleware, pharmacyController.getPharmaciesByDrug);

// Get pharmacy by UID (for login) - must come before /:id
router.get('/uid/:uid', firebaseAuthMiddleware, pharmacyController.getPharmacyByUID);

// Update pharmacy by UID
router.put('/uid/:uid', firebaseAuthMiddleware, pharmacyController.updatePharmacyByUID);

// Get pharmacy approval status
router.get('/approval-status/:uid', firebaseAuthMiddleware, pharmacyController.getPharmacyApprovalStatus);

// Get pharmacy by email (for login verification)
router.get('/email/:email', firebaseAuthMiddleware, pharmacyController.getPharmacyByEmail);

// Get pharmacy by email (for login verification - unprotected)
router.get('/login-email/:email', pharmacyController.getPharmacyByEmail);

// Get pharmacy by ID (generic route - must come last)
router.get('/:id', firebaseAuthMiddleware, pharmacyController.getPharmacyById);

// Update pharmacy
router.put('/:id', firebaseAuthMiddleware, pharmacyController.updatePharmacy);

// Delete pharmacy
router.delete('/:id', firebaseAuthMiddleware, pharmacyController.deletePharmacy);

// Note: Database cleanup route removed - no longer needed with the permanent fix

// Public QR scanning endpoints
router.get('/qr/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    console.log('🔍 Pharmacy QR Scan Request - Raw Identifier:', identifier);

    const Pharmacy = require('../models/Pharmacy');
    
    // Try to find pharmacy by ARC ID first
    let pharmacy = await Pharmacy.findOne({ arcId: identifier });
    
    if (!pharmacy) {
      // If not found by ARC ID, try by UID
      pharmacy = await Pharmacy.findOne({ uid: identifier });
    }

    if (!pharmacy) {
      return res.status(404).json({ 
        error: 'Pharmacy not found',
        message: 'No pharmacy found with the provided identifier'
      });
    }

    // Return limited pharmacy info for QR scanning
    res.json({
      success: true,
      type: 'pharmacy',
      data: {
        uid: pharmacy.uid,
        arcId: pharmacy.arcId,
        pharmacyName: pharmacy.pharmacyName,
        email: pharmacy.email,
        mobileNumber: pharmacy.mobileNumber,
        address: pharmacy.address,
        city: pharmacy.city,
        state: pharmacy.state,
        pincode: pharmacy.pincode,
        services: pharmacy.services,
        profileImageUrl: pharmacy.profileImageUrl,
        isApproved: pharmacy.isApproved,
        approvalStatus: pharmacy.approvalStatus,
      }
    });
  } catch (error) {
    console.error('Error fetching pharmacy by QR:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/qr/uid/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    console.log('🔍 Pharmacy QR Scan Request by UID:', uid);

    const Pharmacy = require('../models/Pharmacy');
    const pharmacy = await Pharmacy.findOne({ uid });

    if (!pharmacy) {
      return res.status(404).json({ 
        error: 'Pharmacy not found',
        message: 'No pharmacy found with the provided UID'
      });
    }

    // Return limited pharmacy info for QR scanning
    res.json({
      success: true,
      type: 'pharmacy',
      data: {
        uid: pharmacy.uid,
        arcId: pharmacy.arcId,
        pharmacyName: pharmacy.pharmacyName,
        email: pharmacy.email,
        mobileNumber: pharmacy.mobileNumber,
        address: pharmacy.address,
        city: pharmacy.city,
        state: pharmacy.state,
        pincode: pharmacy.pincode,
        services: pharmacy.services,
        profileImageUrl: pharmacy.profileImageUrl,
        isApproved: pharmacy.isApproved,
        approvalStatus: pharmacy.approvalStatus,
      }
    });
  } catch (error) {
    console.error('Error fetching pharmacy by UID:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 