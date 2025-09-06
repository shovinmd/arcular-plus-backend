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
router.post('/:pharmacyId/approve', firebaseAuthMiddleware, pharmacyController.approvePharmacyByStaff);
router.post('/:pharmacyId/reject', firebaseAuthMiddleware, pharmacyController.rejectPharmacyByStaff);

// Get pharmacies by city
router.get('/city/:city', firebaseAuthMiddleware, pharmacyController.getPharmaciesByCity);

// Get pharmacies by drug
router.get('/drug/:drugName', firebaseAuthMiddleware, pharmacyController.getPharmaciesByDrug);

// Get pharmacy by UID (for login) - must come before /:id
router.get('/uid/:uid', firebaseAuthMiddleware, pharmacyController.getPharmacyByUID);

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

module.exports = router; 