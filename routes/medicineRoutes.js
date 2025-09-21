const express = require('express');
const router = express.Router();
const medicineController = require('../controllers/medicineController');
const { verifyFirebaseToken } = require('../middleware/firebaseAuth');

// Get all medicines with search and filters
router.get('/', medicineController.getMedicines);

// Search medicines with suggestions
router.get('/search', medicineController.searchMedicines);

// Get medicine categories
router.get('/categories', medicineController.getMedicineCategories);

// Get medicine by ID
router.get('/:id', medicineController.getMedicineById);

// Get medicines by pharmacy
router.get('/pharmacy/:pharmacyId', medicineController.getMedicinesByPharmacy);

// Add medicine (pharmacy only)
router.post('/', verifyFirebaseToken, medicineController.addMedicine);

// Update medicine (pharmacy only)
router.put('/:id', verifyFirebaseToken, medicineController.updateMedicine);

// Delete medicine (pharmacy only)
router.delete('/:id', verifyFirebaseToken, medicineController.deleteMedicine);

// Save medicine QR code
router.post('/:id/qr-code', verifyFirebaseToken, medicineController.saveMedicineQRCode);

// Get medicine by QR code
router.get('/qr/:qrCode', medicineController.getMedicineByQRCode);

module.exports = router;
