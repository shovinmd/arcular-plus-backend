const Pharmacy = require('../models/Pharmacy');

// Register a new pharmacy
const registerPharmacy = async (req, res) => {
  try {
    const {
      uid,
      pharmacyName,
      email,
      ownerName,
      mobileNumber,
      licenseNumber,
      licenseDocumentUrl,
      drugsAvailable,
      address,
      city,
      state,
      pincode,
      profileImageUrl
    } = req.body;

    // Validate required fields
    const requiredFields = {
      uid, pharmacyName, email, ownerName, mobileNumber,
      licenseNumber, licenseDocumentUrl, address, city, state, pincode, profileImageUrl
    };

    const missingFields = Object.keys(requiredFields).filter(
      field => !requiredFields[field]
    );

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    // Check if pharmacy already exists
    const existingPharmacy = await Pharmacy.findOne({
      $or: [
        { email },
        { licenseNumber },
        { uid }
      ]
    });

    if (existingPharmacy) {
      return res.status(400).json({
        success: false,
        message: 'Pharmacy with this email, license number, or UID already exists'
      });
    }

    // Create new pharmacy
    const pharmacy = new Pharmacy({
      uid,
      pharmacyName,
      email,
      ownerName,
      mobileNumber,
      licenseNumber,
      licenseDocumentUrl,
      drugsAvailable: drugsAvailable || [],
      address,
      city,
      state,
      pincode,
      profileImageUrl
    });

    await pharmacy.save();

    const pharmacyData = pharmacy.toObject();
    pharmacyData.type = 'pharmacy';
    res.status(201).json({
      success: true,
      message: 'Pharmacy registered successfully',
      data: pharmacyData
    });
  } catch (error) {
    console.error('Pharmacy registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to register pharmacy',
      error: error.message
    });
  }
};

// Get pharmacy by ID
const getPharmacyById = async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findById(req.params.id);
    if (!pharmacy) {
      return res.status(404).json({
        success: false,
        message: 'Pharmacy not found'
      });
    }
    const data = pharmacy.toObject();
    data.type = 'pharmacy';
    res.json({
      success: true,
      data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get pharmacy',
      error: error.message
    });
  }
};

// Get pharmacy by UID
const getPharmacyByUID = async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findOne({ uid: req.params.uid });
    if (!pharmacy) {
      return res.status(404).json({
        success: false,
        message: 'Pharmacy not found'
      });
    }
    const data = pharmacy.toObject();
    data.type = 'pharmacy';
    res.json({
      success: true,
      data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get pharmacy',
      error: error.message
    });
  }
};

// Get all pharmacies
const getAllPharmacies = async (req, res) => {
  try {
    const pharmacies = await Pharmacy.find({ isApproved: true });
    const withType = pharmacies.map(p => { const d = p.toObject(); d.type = 'pharmacy'; return d; });
    res.json({
      success: true,
      data: withType
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get pharmacies',
      error: error.message
    });
  }
};

// Update pharmacy
const updatePharmacy = async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true }
    );
    if (!pharmacy) {
      return res.status(404).json({
        success: false,
        message: 'Pharmacy not found'
      });
    }
    res.json({
      success: true,
      message: 'Pharmacy updated successfully',
      data: pharmacy
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update pharmacy',
      error: error.message
    });
  }
};

// Delete pharmacy
const deletePharmacy = async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findByIdAndDelete(req.params.id);
    if (!pharmacy) {
      return res.status(404).json({
        success: false,
        message: 'Pharmacy not found'
      });
    }
    res.json({
      success: true,
      message: 'Pharmacy deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete pharmacy',
      error: error.message
    });
  }
};

// Get pharmacies by city
const getPharmaciesByCity = async (req, res) => {
  try {
    const pharmacies = await Pharmacy.findByCity(req.params.city);
    res.json({
      success: true,
      data: pharmacies
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get pharmacies by city',
      error: error.message
    });
  }
};

// Get pharmacies by drug
const getPharmaciesByDrug = async (req, res) => {
  try {
    const pharmacies = await Pharmacy.findByDrug(req.params.drugName);
    res.json({
      success: true,
      data: pharmacies
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get pharmacies by drug',
      error: error.message
    });
  }
};

// Get pending approvals
const getPendingApprovals = async (req, res) => {
  try {
    const pharmacies = await Pharmacy.getPendingApprovals();
    res.json({
      success: true,
      data: pharmacies
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get pending approvals',
      error: error.message
    });
  }
};

// Approve pharmacy
const approvePharmacy = async (req, res) => {
  try {
    const { notes } = req.body;
    const pharmacy = await Pharmacy.approvePharmacy(req.params.id, req.user.uid, notes);
    if (!pharmacy) {
      return res.status(404).json({
        success: false,
        message: 'Pharmacy not found'
      });
    }
    res.json({
      success: true,
      message: 'Pharmacy approved successfully',
      data: pharmacy
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to approve pharmacy',
      error: error.message
    });
  }
};

// Reject pharmacy
const rejectPharmacy = async (req, res) => {
  try {
    const { reason } = req.body;
    const pharmacy = await Pharmacy.rejectPharmacy(req.params.id, req.user.uid, reason);
    if (!pharmacy) {
      return res.status(404).json({
        success: false,
        message: 'Pharmacy not found'
      });
    }
    res.json({
      success: true,
      message: 'Pharmacy rejected successfully',
      data: pharmacy
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to reject pharmacy',
      error: error.message
    });
  }
};

module.exports = {
  registerPharmacy,
  getPharmacyById,
  getPharmacyByUID,
  getAllPharmacies,
  updatePharmacy,
  deletePharmacy,
  getPharmaciesByCity,
  getPharmaciesByDrug,
  getPendingApprovals,
  approvePharmacy,
  rejectPharmacy
}; 