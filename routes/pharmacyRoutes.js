const express = require('express');
const auth = require('../middleware/auth');
const pharmacyController = require('../controllers/pharmacyController');
const router = express.Router();

// Profile
router.get('/:id', auth, pharmacyController.getPharmacyProfile);
router.put('/:id', auth, pharmacyController.updatePharmacyProfile);

// Medicine Inventory
router.get('/:id/inventory', auth, pharmacyController.getInventory);
router.post('/:id/inventory', auth, pharmacyController.addMedicine);
router.put('/:id/inventory/:medicineId', auth, pharmacyController.updateMedicine);
router.delete('/:id/inventory/:medicineId', auth, pharmacyController.deleteMedicine);

// Prescription Fulfillment
router.get('/:id/prescriptions', auth, pharmacyController.getPrescriptions);
router.post('/:id/prescriptions/:prescriptionId/fulfill', auth, pharmacyController.fulfillPrescription);

// Home Delivery
router.get('/:id/deliveries', auth, pharmacyController.getDeliveries);
router.post('/:id/deliveries', auth, pharmacyController.createDelivery);

// Chat
router.get('/:id/chat', auth, pharmacyController.getChatMessages);
router.post('/:id/chat', auth, pharmacyController.sendChatMessage);

// Notifications
router.get('/:id/notifications', auth, pharmacyController.getNotifications);

// Settings
router.put('/:id/settings', auth, pharmacyController.updateSettings);

module.exports = router; 