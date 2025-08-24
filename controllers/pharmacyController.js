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
      if (documents.drug_license) {
        req.body.drugLicenseUrl = documents.drug_license;
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
      status: userData.status || 'pending',
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

    // Send approval email
    try {
      await sendApprovalEmail(pharmacy.email, pharmacy.fullName, 'pharmacy', true, notes);
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
    const { reason } = req.body;
    const pharmacy = await Pharmacy.rejectPharmacy(req.params.id, req.user.uid, reason);
    if (!pharmacy) {
      return res.status(404).json({
        success: false,
        message: 'Pharmacy not found'
      });
    }

    // Send rejection email
    try {
      await sendApprovalEmail(pharmacy.email, pharmacy.fullName, 'pharmacy', false, reason);
      console.log('✅ Rejection email sent to pharmacy');
    } catch (emailError) {
      console.error('❌ Error sending rejection email:', emailError);
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