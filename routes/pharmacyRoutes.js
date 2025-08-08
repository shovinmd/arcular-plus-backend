const express = require('express');
const router = express.Router();
const pharmacyController = require('../controllers/pharmacyController');
const firebaseAuthMiddleware = require('../middleware/firebaseAuthMiddleware');

// Registration
router.post('/register', firebaseAuthMiddleware, pharmacyController.registerPharmacy);

// Get all pharmacies
router.get('/', firebaseAuthMiddleware, pharmacyController.getAllPharmacies);

// Get pharmacies by city
router.get('/city/:city', firebaseAuthMiddleware, pharmacyController.getPharmaciesByCity);

// Get pharmacies by drug
router.get('/drug/:drugName', firebaseAuthMiddleware, pharmacyController.getPharmaciesByDrug);

// Get pharmacy by UID (for login) - must come before /:id
router.get('/uid/:uid', firebaseAuthMiddleware, pharmacyController.getPharmacyByUID);

// Get pharmacy by ID (generic route - must come last)
router.get('/:id', firebaseAuthMiddleware, pharmacyController.getPharmacyById);

// Update pharmacy
router.put('/:id', firebaseAuthMiddleware, pharmacyController.updatePharmacy);

// Delete pharmacy
router.delete('/:id', firebaseAuthMiddleware, pharmacyController.deletePharmacy);

// Admin routes
router.get('/pending-approvals', firebaseAuthMiddleware, pharmacyController.getPendingApprovals);
router.post('/:id/approve', firebaseAuthMiddleware, pharmacyController.approvePharmacy);
router.post('/:id/reject', firebaseAuthMiddleware, pharmacyController.rejectPharmacy);

module.exports = router; 