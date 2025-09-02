const Pharmacy = require('../models/Pharmacy');

// Add medicine to pharmacy inventory
const addMedicine = async (req, res) => {
  try {
    const { pharmacyId } = req.params;
    const medicineData = req.body;

    // Validate required fields
    if (!medicineData.medicineName || !medicineData.category || !medicineData.price) {
      return res.status(400).json({
        success: false,
        message: 'Medicine name, category, and price are required'
      });
    }

    // Generate unique medicine ID
    const medicineId = 'MED' + Date.now().toString().slice(-8);
    
    const medicine = {
      medicineId,
      ...medicineData,
      addedAt: new Date(),
      updatedAt: new Date()
    };

    const updatedPharmacy = await Pharmacy.addMedicine(pharmacyId, medicine);

    if (!updatedPharmacy) {
      return res.status(404).json({
        success: false,
        message: 'Pharmacy not found'
      });
    }

    res.status(201).json({
      success: true,
      message: 'Medicine added successfully',
      data: medicine
    });

  } catch (error) {
    console.error('Error adding medicine:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Update medicine in pharmacy inventory
const updateMedicine = async (req, res) => {
  try {
    const { pharmacyId, medicineId } = req.params;
    const updateData = req.body;

    const updatedPharmacy = await Pharmacy.updateMedicine(pharmacyId, medicineId, updateData);

    if (!updatedPharmacy) {
      return res.status(404).json({
        success: false,
        message: 'Pharmacy or medicine not found'
      });
    }

    res.json({
      success: true,
      message: 'Medicine updated successfully',
      data: updatedPharmacy
    });

  } catch (error) {
    console.error('Error updating medicine:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Remove medicine from pharmacy inventory
const removeMedicine = async (req, res) => {
  try {
    const { pharmacyId, medicineId } = req.params;

    const updatedPharmacy = await Pharmacy.removeMedicine(pharmacyId, medicineId);

    if (!updatedPharmacy) {
      return res.status(404).json({
        success: false,
        message: 'Pharmacy not found'
      });
    }

    res.json({
      success: true,
      message: 'Medicine removed successfully',
      data: updatedPharmacy
    });

  } catch (error) {
    console.error('Error removing medicine:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get pharmacy medicine inventory
const getMedicineInventory = async (req, res) => {
  try {
    const { pharmacyId } = req.params;

    const pharmacy = await Pharmacy.getMedicineInventory(pharmacyId);

    if (!pharmacy) {
      return res.status(404).json({
        success: false,
        message: 'Pharmacy not found'
      });
    }

    res.json({
      success: true,
      data: {
        pharmacyName: pharmacy.pharmacyName,
        city: pharmacy.city,
        state: pharmacy.state,
        medicines: pharmacy.medicineInventory || []
      }
    });

  } catch (error) {
    console.error('Error fetching medicine inventory:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Search medicines across all pharmacies
const searchMedicines = async (req, res) => {
  try {
    const { searchQuery, city } = req.query;

    const pharmacies = await Pharmacy.searchMedicines(searchQuery, city);

    // Flatten medicines from all pharmacies
    const medicines = [];
    pharmacies.forEach(pharmacy => {
      if (pharmacy.medicineInventory && pharmacy.medicineInventory.length > 0) {
        pharmacy.medicineInventory.forEach(medicine => {
          medicines.push({
            ...medicine.toObject(),
            pharmacyId: pharmacy._id,
            pharmacyName: pharmacy.pharmacyName,
            location: `${pharmacy.city}, ${pharmacy.state}`,
            address: pharmacy.address
          });
        });
      }
    });

    res.json({
      success: true,
      data: medicines
    });

  } catch (error) {
    console.error('Error searching medicines:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

module.exports = {
  addMedicine,
  updateMedicine,
  removeMedicine,
  getMedicineInventory,
  searchMedicines
};
