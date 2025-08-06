const express = require('express');
const router = express.Router();
const pharmacyController = require('../controllers/pharmacyController');
const { authenticateToken } = require('../middleware/auth');

// Public routes
router.post('/register', pharmacyController.registerPharmacy);
router.get('/all', pharmacyController.getAllPharmacies);
router.get('/city/:city', pharmacyController.getPharmaciesByCity);
router.get('/drug/:drugName', pharmacyController.getPharmaciesByDrug);

// Protected routes
router.get('/:id', authenticateToken, pharmacyController.getPharmacyById);
router.get('/uid/:uid', authenticateToken, pharmacyController.getPharmacyByUID);
router.put('/:id', authenticateToken, pharmacyController.updatePharmacy);
router.delete('/:id', authenticateToken, pharmacyController.deletePharmacy);

// Admin routes
router.get('/admin/pending', authenticateToken, pharmacyController.getPendingApprovals);
router.post('/admin/approve/:id', authenticateToken, pharmacyController.approvePharmacy);
router.post('/admin/reject/:id', authenticateToken, pharmacyController.rejectPharmacy);

module.exports = router; 