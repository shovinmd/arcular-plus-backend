const express = require('express');
const router = express.Router();
const pharmacyController = require('../controllers/pharmacyController');
const { authenticateToken } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Pharmacy registration and management
router.post('/register', pharmacyController.registerPharmacy);
router.get('/', pharmacyController.getAllPharmacies);
router.get('/:id', pharmacyController.getPharmacyById);
router.get('/uid/:uid', pharmacyController.getPharmacyByUid);
router.put('/:id', pharmacyController.updatePharmacy);
router.delete('/:id', pharmacyController.deletePharmacy);

// Search and filter routes
router.get('/city/:city', pharmacyController.getPharmaciesByCity);
router.get('/type/:type', pharmacyController.getPharmaciesByType);
router.get('/home-delivery', pharmacyController.getPharmaciesWithHomeDelivery);
router.get('/search', pharmacyController.searchPharmacies);

// Approval routes
router.get('/admin/pending', pharmacyController.getPendingApprovals);
router.put('/admin/:id/approve', pharmacyController.approvePharmacy);
router.put('/admin/:id/reject', pharmacyController.rejectPharmacy);

module.exports = router; 