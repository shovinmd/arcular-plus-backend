const Lab = require('../models/Lab');
const User = require('../models/User');

// Register a new lab
const registerLab = async (req, res) => {
  try {
    console.log('🧪 Lab registration request received');
    console.log('📋 Request body:', JSON.stringify(req.body, null, 2));

    // Map documents from RegistrationService format to expected format
    const { documents } = req.body;
    if (documents) {
      if (documents.lab_license) {
        req.body.licenseDocumentUrl = documents.lab_license;
      }
      if (documents.accreditation_certificate) {
        req.body.accreditationCertificateUrl = documents.accreditation_certificate;
      }
      if (documents.equipment_certificate) {
        req.body.equipmentCertificateUrl = documents.equipment_certificate;
      }
    }

    const userData = req.body;
    const { uid } = userData;

    // Check if lab already exists
    const existingLab = await User.findOne({ uid });
    if (existingLab) {
      return res.status(400).json({ error: 'Lab already registered' });
    }

    // Create new lab user
    const newLab = new User({
      ...userData,
      userType: 'lab',
      status: userData.status || 'pending',
      registrationDate: new Date(),
    });

    const savedLab = await newLab.save();

    res.status(201).json({
      success: true,
      message: 'Lab registration successful',
      data: savedLab,
      arcId: savedLab.arcId,
    });
  } catch (error) {
    console.error('Lab registration error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Lab registration failed',
      details: error.message 
    });
  }
};

// Get lab by ID
const getLabById = async (req, res) => {
  try {
    const lab = await Lab.findById(req.params.id);
    if (!lab) {
      return res.status(404).json({
        success: false,
        message: 'Lab not found'
      });
    }
    const labData = lab.toObject();
    labData.type = 'lab';
    res.json({
      success: true,
      data: labData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get lab',
      error: error.message
    });
  }
};

// Get lab by UID
const getLabByUID = async (req, res) => {
  try {
    const lab = await Lab.findOne({ uid: req.params.uid });
    if (!lab) {
      return res.status(404).json({
        success: false,
        message: 'Lab not found'
      });
    }
    const labData = lab.toObject();
    labData.type = 'lab';
    res.json({
      success: true,
      data: labData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get lab',
      error: error.message
    });
  }
};

// Get all labs
const getAllLabs = async (req, res) => {
  try {
    const labs = await Lab.find({ isApproved: true });
    const labsWithType = labs.map(l => { const d = l.toObject(); d.type = 'lab'; return d; });
    res.json({
      success: true,
      data: labsWithType
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get labs',
      error: error.message
    });
  }
};

// Update lab
const updateLab = async (req, res) => {
  try {
    const lab = await Lab.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true }
    );
    if (!lab) {
      return res.status(404).json({
        success: false,
        message: 'Lab not found'
      });
    }
    res.json({
      success: true,
      message: 'Lab updated successfully',
      data: lab
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update lab',
      error: error.message
    });
  }
};

// Delete lab
const deleteLab = async (req, res) => {
  try {
    const lab = await Lab.findByIdAndDelete(req.params.id);
    if (!lab) {
      return res.status(404).json({
        success: false,
        message: 'Lab not found'
      });
    }
    res.json({
      success: true,
      message: 'Lab deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete lab',
      error: error.message
    });
  }
};

// Get labs by city
const getLabsByCity = async (req, res) => {
  try {
    const labs = await Lab.findByCity(req.params.city);
    res.json({
      success: true,
      data: labs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get labs by city',
      error: error.message
    });
  }
};

// Get labs by service
const getLabsByService = async (req, res) => {
  try {
    const labs = await Lab.findByService(req.params.service);
    res.json({
      success: true,
      data: labs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get labs by service',
      error: error.message
    });
  }
};

// Get pending approvals
const getPendingApprovals = async (req, res) => {
  try {
    const labs = await Lab.getPendingApprovals();
    res.json({
      success: true,
      data: labs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get pending approvals',
      error: error.message
    });
  }
};

// Approve lab
const approveLab = async (req, res) => {
  try {
    const { notes } = req.body;
    const lab = await Lab.approveLab(req.params.id, req.user.uid, notes);
    if (!lab) {
      return res.status(404).json({
        success: false,
        message: 'Lab not found'
      });
    }
    res.json({
      success: true,
      message: 'Lab approved successfully',
      data: lab
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to approve lab',
      error: error.message
    });
  }
};

// Reject lab
const rejectLab = async (req, res) => {
  try {
    const { reason } = req.body;
    const lab = await Lab.rejectLab(req.params.id, req.user.uid, reason);
    if (!lab) {
      return res.status(404).json({
        success: false,
        message: 'Lab not found'
      });
    }
    res.json({
      success: true,
      message: 'Lab rejected successfully',
      data: lab
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to reject lab',
      error: error.message
    });
  }
};

module.exports = {
  registerLab,
  getLabById,
  getLabByUID,
  getAllLabs,
  updateLab,
  deleteLab,
  getLabsByCity,
  getLabsByService,
  getPendingApprovals,
  approveLab,
  rejectLab
}; 