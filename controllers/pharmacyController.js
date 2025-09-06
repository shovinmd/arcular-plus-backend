const Pharmacy = require('../models/Pharmacy');
const { sendRegistrationConfirmation, sendApprovalEmail } = require('../services/emailService');

// Register a new pharmacy
const registerPharmacy = async (req, res) => {
  try {
    console.log('💊 Pharmacy registration request received');
    console.log('📋 Request body:', JSON.stringify(req.body, null, 2));

    // Map documents from RegistrationService format to expected format
    const { documents } = req.body;
    if (documents) {
      if (documents.pharmacy_license) {
        req.body.licenseDocumentUrl = documents.pharmacy_license;
      }
      if (documents.premises_certificate) {
        req.body.premisesCertificateUrl = documents.premises_certificate;
      }
    }

    const userData = req.body;
    const { uid } = userData;

    // Check if pharmacy already exists
    const existingPharmacy = await Pharmacy.findOne({ uid });
    if (existingPharmacy) {
      return res.status(400).json({ error: 'Pharmacy already registered' });
    }

    // Create new pharmacy user in Pharmacy model
    const newPharmacy = new Pharmacy({
      ...userData,
      status: 'active', // Changed from 'pending' to 'active' (valid enum value)
      isApproved: false,
      approvalStatus: 'pending',
      registrationDate: new Date(),
    });

    const savedPharmacy = await newPharmacy.save();

    // Send registration confirmation email
    try {
      await sendRegistrationConfirmation(
        savedPharmacy.email, 
        savedPharmacy.fullName, 
        'pharmacy'
      );
      console.log('✅ Registration confirmation email sent to pharmacy');
    } catch (emailError) {
      console.error('❌ Error sending registration confirmation email:', emailError);
    }

    res.status(201).json({
      success: true,
      message: 'Pharmacy registration successful',
      data: savedPharmacy,
      arcId: savedPharmacy.arcId,
    });
  } catch (error) {
    console.error('Pharmacy registration error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Pharmacy registration failed',
      details: error.message 
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
    const pharmacyData = pharmacy.toObject();
    pharmacyData.type = 'pharmacy';
    res.json({
      success: true,
      data: pharmacyData
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
    const pharmacyData = pharmacy.toObject();
    pharmacyData.type = 'pharmacy';
    res.json({
      success: true,
      data: pharmacyData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get pharmacy',
      error: error.message
    });
  }
};

// Get pharmacy by email
const getPharmacyByEmail = async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findOne({ email: req.params.email });
    if (!pharmacy) {
      return res.status(404).json({
        success: false,
        message: 'Pharmacy not found'
      });
    }
    const pharmacyData = pharmacy.toObject();
    pharmacyData.type = 'pharmacy';
    res.json({
      success: true,
      data: pharmacyData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get pharmacy',
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

// Get all pharmacies
const getAllPharmacies = async (req, res) => {
  try {
    const pharmacies = await Pharmacy.find();
    res.json({
      success: true,
      data: pharmacies
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get pharmacies',
      error: error.message
    });
  }
};

// Get pharmacies by city
const getPharmaciesByCity = async (req, res) => {
  try {
    const { city } = req.params;
    const pharmacies = await Pharmacy.find({ city: new RegExp(city, 'i') });
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
    const { drugName } = req.params;
    const pharmacies = await Pharmacy.find({
      'availableDrugs.name': new RegExp(drugName, 'i')
    });
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

// Search pharmacies
const searchPharmacies = async (req, res) => {
  try {
    const { query, city, state } = req.query;
    let searchCriteria = {};

    if (query) {
      searchCriteria.$or = [
        { pharmacyName: new RegExp(query, 'i') },
        { fullName: new RegExp(query, 'i') },
        { city: new RegExp(query, 'i') },
        { state: new RegExp(query, 'i') }
      ];
    }

    if (city) {
      searchCriteria.city = new RegExp(city, 'i');
    }

    if (state) {
      searchCriteria.state = new RegExp(state, 'i');
    }

    const pharmacies = await Pharmacy.find(searchCriteria);
    res.json({
      success: true,
      data: pharmacies
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to search pharmacies',
      error: error.message
    });
  }
};

// Get pending approvals
const getPendingApprovals = async (req, res) => {
  try {
    const pharmacies = await Pharmacy.find({ approvalStatus: 'pending' });
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
    const pharmacy = await Pharmacy.findByIdAndUpdate(
      req.params.id,
      { 
        isApproved: true, 
        approvalStatus: 'approved',
        approvedAt: new Date()
      },
      { new: true }
    );
    
    if (!pharmacy) {
      return res.status(404).json({
        success: false,
        message: 'Pharmacy not found'
      });
    }

    // Send approval email
    try {
      await sendApprovalEmail(pharmacy.email, pharmacy.fullName, 'pharmacy');
      console.log('✅ Approval email sent to pharmacy');
    } catch (emailError) {
      console.error('❌ Error sending approval email:', emailError);
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
    const pharmacy = await Pharmacy.findByIdAndUpdate(
      req.params.id,
      { 
        isApproved: false, 
        approvalStatus: 'rejected',
        rejectedAt: new Date()
      },
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

// Get pending approvals for staff
const getPendingApprovalsForStaff = async (req, res) => {
  try {
    const pharmacies = await Pharmacy.find({ 
      approvalStatus: 'pending',
      status: 'active'
    });
    res.json({
      success: true,
      data: pharmacies
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get pending approvals for staff',
      error: error.message
    });
  }
};

// Approve pharmacy by staff
const approvePharmacyByStaff = async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findByIdAndUpdate(
      req.params.id,
      { 
        isApproved: true, 
        approvalStatus: 'approved',
        approvedAt: new Date(),
        approvedBy: req.user.uid
      },
      { new: true }
    );
    
    if (!pharmacy) {
      return res.status(404).json({
        success: false,
        message: 'Pharmacy not found'
      });
    }

    // Send approval email
    try {
      await sendApprovalEmail(pharmacy.email, pharmacy.fullName, 'pharmacy');
      console.log('✅ Approval email sent to pharmacy');
    } catch (emailError) {
      console.error('❌ Error sending approval email:', emailError);
    }

    res.json({
      success: true,
      message: 'Pharmacy approved successfully by staff',
      data: pharmacy
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to approve pharmacy by staff',
      error: error.message
    });
  }
};

// Reject pharmacy by staff
const rejectPharmacyByStaff = async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findByIdAndUpdate(
      req.params.id,
      { 
        isApproved: false, 
        approvalStatus: 'rejected',
        rejectedAt: new Date(),
        rejectedBy: req.user.uid
      },
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
      message: 'Pharmacy rejected successfully by staff',
      data: pharmacy
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to reject pharmacy by staff',
      error: error.message
    });
  }
};

module.exports = {
  registerPharmacy,
  getAllPharmacies,
  getPharmacyById,
  getPharmacyByUID,
  getPharmacyByEmail,
  updatePharmacy,
  deletePharmacy,
  getPharmaciesByCity,
  getPharmaciesByDrug,
  searchPharmacies,
  getPendingApprovals,
  approvePharmacy,
  rejectPharmacy,
  getPendingApprovalsForStaff,
  approvePharmacyByStaff,
  rejectPharmacyByStaff
};