const express = require('express');
const router = express.Router();
const {
  addMedicine,
  updateMedicine,
  removeMedicine,
  getMedicineInventory,
  searchMedicines
} = require('../controllers/pharmacyInventoryController');
const firebaseAuthMiddleware = require('../middleware/firebaseAuthMiddleware');

// Add medicine to pharmacy inventory (pharmacy only)
router.post('/:pharmacyId/medicines', firebaseAuthMiddleware, addMedicine);

// Update medicine in pharmacy inventory (pharmacy only)
router.put('/:pharmacyId/medicines/:medicineId', firebaseAuthMiddleware, updateMedicine);

// Remove medicine from pharmacy inventory (pharmacy only)
router.delete('/:pharmacyId/medicines/:medicineId', firebaseAuthMiddleware, removeMedicine);

// Get pharmacy medicine inventory
router.get('/:pharmacyId/medicines', firebaseAuthMiddleware, getMedicineInventory);

// Search medicines across all pharmacies (public)
router.get('/medicines/search', searchMedicines);

module.exports = router;
