const Medicine = require('../models/Medicine');
const User = require('../models/User');
const Order = require('../models/Order');
const { sendFCMNotification } = require('../services/fcmService');

// Get all medicines with search and filters
const getMedicines = async (req, res) => {
  try {
    const { 
      search, 
      category, 
      pharmacyId, 
      minPrice, 
      maxPrice, 
      page = 1, 
      limit = 20 
    } = req.query;

    let query = { isAvailable: true };

    // Search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { genericName: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
        { composition: { $regex: search, $options: 'i' } }
      ];
    }

    // Category filter
    if (category) {
      query.category = category;
    }

    // Pharmacy filter
    if (pharmacyId) {
      query.pharmacyId = pharmacyId;
    }

    // Price range filter
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }

    const medicines = await Medicine.find(query)
      .sort({ name: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Medicine.countDocuments(query);

    res.json({
      success: true,
      data: medicines,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total: total
      }
    });

  } catch (error) {
    console.error('Error fetching medicines:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch medicines'
    });
  }
};

// Get medicine by ID
const getMedicineById = async (req, res) => {
  try {
    const { id } = req.params;
    const medicine = await Medicine.findOne({ medicineId: id });
    
    if (!medicine) {
      return res.status(404).json({
        success: false,
        error: 'Medicine not found'
      });
    }

    res.json({
      success: true,
      data: medicine
    });

  } catch (error) {
    console.error('Error fetching medicine:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch medicine'
    });
  }
};

// Get medicines by pharmacy
const getMedicinesByPharmacy = async (req, res) => {
  try {
    const { pharmacyId } = req.params;
    const { search, category, page = 1, limit = 20 } = req.query;

    let query = { pharmacyId: pharmacyId, isAvailable: true };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { genericName: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } }
      ];
    }

    if (category) {
      query.category = category;
    }

    const medicines = await Medicine.find(query)
      .sort({ name: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Medicine.countDocuments(query);

    res.json({
      success: true,
      data: medicines,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total: total
      }
    });

  } catch (error) {
    console.error('Error fetching pharmacy medicines:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pharmacy medicines'
    });
  }
};

// Add medicine (for pharmacy)
const addMedicine = async (req, res) => {
  try {
    const firebaseUser = req.user;
    if (!firebaseUser || !firebaseUser.uid) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid Firebase user' 
      });
    }

    // Check if user is a pharmacy
    const pharmacy = await User.findOne({ uid: firebaseUser.uid, type: 'pharmacy' });
    if (!pharmacy) {
      return res.status(403).json({
        success: false,
        error: 'Only pharmacies can add medicines'
      });
    }

    const medicineData = {
      ...req.body,
      pharmacyId: firebaseUser.uid,
      pharmacyName: pharmacy.fullName
    };

    const medicine = new Medicine(medicineData);
    await medicine.save();

    res.status(201).json({
      success: true,
      message: 'Medicine added successfully',
      data: medicine
    });

  } catch (error) {
    console.error('Error adding medicine:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add medicine'
    });
  }
};

// Update medicine (for pharmacy)
const updateMedicine = async (req, res) => {
  try {
    const { id } = req.params;
    const firebaseUser = req.user;
    
    if (!firebaseUser || !firebaseUser.uid) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid Firebase user' 
      });
    }

    const medicine = await Medicine.findOne({ 
      medicineId: id, 
      pharmacyId: firebaseUser.uid 
    });

    if (!medicine) {
      return res.status(404).json({
        success: false,
        error: 'Medicine not found or access denied'
      });
    }

    Object.assign(medicine, req.body);
    await medicine.save();

    res.json({
      success: true,
      message: 'Medicine updated successfully',
      data: medicine
    });

  } catch (error) {
    console.error('Error updating medicine:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update medicine'
    });
  }
};

// Delete medicine (for pharmacy)
const deleteMedicine = async (req, res) => {
  try {
    const { id } = req.params;
    const firebaseUser = req.user;
    
    if (!firebaseUser || !firebaseUser.uid) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid Firebase user' 
      });
    }

    const medicine = await Medicine.findOneAndDelete({ 
      medicineId: id, 
      pharmacyId: firebaseUser.uid 
    });

    if (!medicine) {
      return res.status(404).json({
        success: false,
        error: 'Medicine not found or access denied'
      });
    }

    res.json({
      success: true,
      message: 'Medicine deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting medicine:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete medicine'
    });
  }
};

// Get medicine categories
const getMedicineCategories = async (req, res) => {
  try {
    const categories = await Medicine.distinct('category');
    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch categories'
    });
  }
};

// Search medicines with suggestions
const searchMedicines = async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.length < 2) {
      return res.json({
        success: true,
        data: []
      });
    }

    const medicines = await Medicine.find({
      $and: [
        { isAvailable: true },
        {
          $or: [
            { name: { $regex: q, $options: 'i' } },
            { genericName: { $regex: q, $options: 'i' } },
            { brand: { $regex: q, $options: 'i' } }
          ]
        }
      ]
    })
    .select('name genericName brand price form strength')
    .limit(10);

    res.json({
      success: true,
      data: medicines
    });

  } catch (error) {
    console.error('Error searching medicines:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search medicines'
    });
  }
};

module.exports = {
  getMedicines,
  getMedicineById,
  getMedicinesByPharmacy,
  addMedicine,
  updateMedicine,
  deleteMedicine,
  getMedicineCategories,
  searchMedicines
};
