const Pharmacy = require('../models/Pharmacy');
const User = require('../models/User');

// Register a new pharmacy
const registerPharmacy = async (req, res) => {
  try {
    const firebaseUser = req.user;
    const {
      name,
      email,
      phone,
      alternatePhone,
      licenseNumber,
      registrationNumber,
      drugLicenseNumber,
      gstNumber,
      pharmacyType,
      specialization,
      experience,
      address,
      city,
      state,
      pincode,
      landmark,
      operatingHours,
      workingDays,
      is24Hours,
      homeDelivery,
      onlineOrdering,
      prescriptionFilling,
      medicineConsultation,
      availableMedicines,
      specialties,
      insuranceAccepted,
      certificateUrl,
      licenseDocumentUrl,
      drugLicenseUrl,
      description,
      website,
      emergencyContact,
      paymentMethods
    } = req.body;

    // Check if pharmacy already exists
    const existingPharmacy = await Pharmacy.findOne({
      $or: [
        { email: email.toLowerCase() },
        { licenseNumber },
        { registrationNumber },
        { drugLicenseNumber },
        { uid: firebaseUser.uid }
      ]
    });

    if (existingPharmacy) {
      return res.status(400).json({
        success: false,
        message: 'Pharmacy already exists with this email, license number, or registration number'
      });
    }

    // Create new pharmacy
    const pharmacy = new Pharmacy({
      uid: firebaseUser.uid,
      name,
      email: email.toLowerCase(),
      phone,
      alternatePhone,
      licenseNumber,
      registrationNumber,
      drugLicenseNumber,
      gstNumber,
      pharmacyType,
      specialization,
      experience: parseInt(experience) || 0,
      address,
      city,
      state,
      pincode,
      landmark,
      operatingHours,
      workingDays: workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      is24Hours: is24Hours || false,
      homeDelivery: homeDelivery || false,
      onlineOrdering: onlineOrdering || false,
      prescriptionFilling: prescriptionFilling !== false, // Default to true
      medicineConsultation: medicineConsultation || false,
      availableMedicines: availableMedicines || [],
      specialties: specialties || [],
      insuranceAccepted: insuranceAccepted || [],
      certificateUrl,
      licenseDocumentUrl,
      drugLicenseUrl,
      description,
      website,
      emergencyContact,
      paymentMethods: paymentMethods || ['Cash', 'Card', 'UPI'],
      isApproved: false,
      approvalStatus: 'pending'
    });

    await pharmacy.save();

    // Also create/update user record
    const userData = {
      uid: firebaseUser.uid,
      fullName: name,
      email: email.toLowerCase(),
      mobileNumber: phone,
      alternateMobile: alternatePhone,
      address,
      city,
      state,
      pincode,
      type: 'pharmacy',
      // Pharmacy-specific fields
      pharmacyName: name,
      pharmacyLicenseNumber: licenseNumber,
      pharmacyAddress: address,
      operatingHours,
      homeDelivery: homeDelivery || false,
      drugLicenseUrl
    };

    await User.findOneAndUpdate(
      { uid: firebaseUser.uid },
      userData,
      { upsert: true, new: true }
    );

    res.status(201).json({
      success: true,
      message: 'Pharmacy registered successfully. Pending approval.',
      data: pharmacy
    });

  } catch (error) {
    console.error('Error registering pharmacy:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to register pharmacy',
      error: error.message
    });
  }
};

// Get all pharmacies
const getAllPharmacies = async (req, res) => {
  try {
    const pharmacies = await Pharmacy.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      data: pharmacies
    });
  } catch (error) {
    console.error('Error fetching pharmacies:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pharmacies',
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
    res.status(200).json({
      success: true,
      data: pharmacy
    });
  } catch (error) {
    console.error('Error fetching pharmacy:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pharmacy',
      error: error.message
    });
  }
};

// Get pharmacy by UID
const getPharmacyByUid = async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findOne({ uid: req.params.uid });
    if (!pharmacy) {
      return res.status(404).json({
        success: false,
        message: 'Pharmacy not found'
      });
    }
    res.status(200).json({
      success: true,
      data: pharmacy
    });
  } catch (error) {
    console.error('Error fetching pharmacy:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pharmacy',
      error: error.message
    });
  }
};

// Update pharmacy
const updatePharmacy = async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!pharmacy) {
      return res.status(404).json({
        success: false,
        message: 'Pharmacy not found'
      });
    }
    res.status(200).json({
      success: true,
      message: 'Pharmacy updated successfully',
      data: pharmacy
    });
  } catch (error) {
    console.error('Error updating pharmacy:', error);
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
    res.status(200).json({
      success: true,
      message: 'Pharmacy deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting pharmacy:', error);
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
    res.status(200).json({
      success: true,
      data: pharmacies
    });
  } catch (error) {
    console.error('Error fetching pharmacies by city:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pharmacies',
      error: error.message
    });
  }
};

// Get pharmacies by type
const getPharmaciesByType = async (req, res) => {
  try {
    const pharmacies = await Pharmacy.findByType(req.params.type);
    res.status(200).json({
      success: true,
      data: pharmacies
    });
  } catch (error) {
    console.error('Error fetching pharmacies by type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pharmacies',
      error: error.message
    });
  }
};

// Get pharmacies with home delivery
const getPharmaciesWithHomeDelivery = async (req, res) => {
  try {
    const pharmacies = await Pharmacy.findWithHomeDelivery();
    res.status(200).json({
      success: true,
      data: pharmacies
    });
  } catch (error) {
    console.error('Error fetching pharmacies with home delivery:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pharmacies',
      error: error.message
    });
  }
};

// Get pending approvals
const getPendingApprovals = async (req, res) => {
  try {
    const pharmacies = await Pharmacy.findPendingApprovals();
    res.status(200).json({
      success: true,
      data: pharmacies
    });
  } catch (error) {
    console.error('Error fetching pending approvals:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending approvals',
      error: error.message
    });
  }
};

// Approve pharmacy
const approvePharmacy = async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findById(req.params.id);
    if (!pharmacy) {
      return res.status(404).json({
        success: false,
        message: 'Pharmacy not found'
      });
    }

    pharmacy.approvalStatus = 'approved';
    pharmacy.isApproved = true;
    await pharmacy.save();

    res.status(200).json({
      success: true,
      message: 'Pharmacy approved successfully',
      data: pharmacy
    });
  } catch (error) {
    console.error('Error approving pharmacy:', error);
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
    const pharmacy = await Pharmacy.findById(req.params.id);
    if (!pharmacy) {
      return res.status(404).json({
        success: false,
        message: 'Pharmacy not found'
      });
    }

    pharmacy.approvalStatus = 'rejected';
    pharmacy.isApproved = false;
    await pharmacy.save();

    res.status(200).json({
      success: true,
      message: 'Pharmacy rejected successfully',
      data: pharmacy
    });
  } catch (error) {
    console.error('Error rejecting pharmacy:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject pharmacy',
      error: error.message
    });
  }
};

// Search pharmacies
const searchPharmacies = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const pharmacies = await Pharmacy.search(q);
    res.status(200).json({
      success: true,
      data: pharmacies
    });
  } catch (error) {
    console.error('Error searching pharmacies:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search pharmacies',
      error: error.message
    });
  }
};

module.exports = {
  registerPharmacy,
  getAllPharmacies,
  getPharmacyById,
  getPharmacyByUid,
  updatePharmacy,
  deletePharmacy,
  getPharmaciesByCity,
  getPharmaciesByType,
  getPharmaciesWithHomeDelivery,
  getPendingApprovals,
  approvePharmacy,
  rejectPharmacy,
  searchPharmacies
}; 