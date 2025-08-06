const Nurse = require('../models/Nurse');

// Register a new nurse
const registerNurse = async (req, res) => {
  try {
    const {
      uid,
      fullName,
      email,
      mobileNumber,
      gender,
      dateOfBirth,
      qualification,
      experienceYears,
      licenseNumber,
      licenseDocumentUrl,
      hospitalAffiliation,
      address,
      city,
      state,
      pincode,
      profileImageUrl
    } = req.body;

    // Validate required fields
    const requiredFields = {
      uid, fullName, email, mobileNumber, gender, dateOfBirth,
      qualification, experienceYears, licenseNumber, licenseDocumentUrl,
      hospitalAffiliation, address, city, state, pincode, profileImageUrl
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

    // Check if nurse already exists
    const existingNurse = await Nurse.findOne({
      $or: [
        { email },
        { licenseNumber },
        { uid }
      ]
    });

    if (existingNurse) {
      return res.status(400).json({
        success: false,
        message: 'Nurse with this email, license number, or UID already exists'
      });
    }

    // Create new nurse
    const nurse = new Nurse({
      uid,
      fullName,
      email,
      mobileNumber,
      gender,
      dateOfBirth,
      qualification,
      experienceYears,
      licenseNumber,
      licenseDocumentUrl,
      hospitalAffiliation,
      address,
      city,
      state,
      pincode,
      profileImageUrl
    });

    await nurse.save();

    res.status(201).json({
      success: true,
      message: 'Nurse registered successfully',
      data: nurse
    });
  } catch (error) {
    console.error('Nurse registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to register nurse',
      error: error.message
    });
  }
};

// Get nurse by ID
const getNurseById = async (req, res) => {
  try {
    const nurse = await Nurse.findById(req.params.id);
    if (!nurse) {
      return res.status(404).json({
        success: false,
        message: 'Nurse not found'
      });
    }
    res.json({
      success: true,
      data: nurse
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get nurse',
      error: error.message
    });
  }
};

// Get nurse by UID
const getNurseByUID = async (req, res) => {
  try {
    const nurse = await Nurse.findOne({ uid: req.params.uid });
    if (!nurse) {
      return res.status(404).json({
        success: false,
        message: 'Nurse not found'
      });
    }
    res.json({
      success: true,
      data: nurse
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get nurse',
      error: error.message
    });
  }
};

// Get all nurses
const getAllNurses = async (req, res) => {
  try {
    const nurses = await Nurse.find({ isApproved: true });
    res.json({
      success: true,
      data: nurses
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get nurses',
      error: error.message
    });
  }
};

// Update nurse
const updateNurse = async (req, res) => {
  try {
    const nurse = await Nurse.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true }
    );
    if (!nurse) {
      return res.status(404).json({
        success: false,
        message: 'Nurse not found'
      });
    }
    res.json({
      success: true,
      message: 'Nurse updated successfully',
      data: nurse
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update nurse',
      error: error.message
    });
  }
};

// Delete nurse
const deleteNurse = async (req, res) => {
  try {
    const nurse = await Nurse.findByIdAndDelete(req.params.id);
    if (!nurse) {
      return res.status(404).json({
        success: false,
        message: 'Nurse not found'
      });
    }
    res.json({
      success: true,
      message: 'Nurse deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete nurse',
      error: error.message
    });
  }
};

// Get nurses by hospital
const getNursesByHospital = async (req, res) => {
  try {
    const nurses = await Nurse.findByHospital(req.params.hospitalName);
    res.json({
      success: true,
      data: nurses
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get nurses by hospital',
      error: error.message
    });
  }
};

// Get nurses by qualification
const getNursesByQualification = async (req, res) => {
  try {
    const nurses = await Nurse.findByQualification(req.params.qualification);
    res.json({
      success: true,
      data: nurses
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get nurses by qualification',
      error: error.message
    });
  }
};

// Get pending approvals
const getPendingApprovals = async (req, res) => {
  try {
    const nurses = await Nurse.getPendingApprovals();
    res.json({
      success: true,
      data: nurses
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get pending approvals',
      error: error.message
    });
  }
};

// Approve nurse
const approveNurse = async (req, res) => {
  try {
    const { notes } = req.body;
    const nurse = await Nurse.approveNurse(req.params.id, req.user.uid, notes);
    if (!nurse) {
      return res.status(404).json({
        success: false,
        message: 'Nurse not found'
      });
    }
    res.json({
      success: true,
      message: 'Nurse approved successfully',
      data: nurse
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to approve nurse',
      error: error.message
    });
  }
};

// Reject nurse
const rejectNurse = async (req, res) => {
  try {
    const { reason } = req.body;
    const nurse = await Nurse.rejectNurse(req.params.id, req.user.uid, reason);
    if (!nurse) {
      return res.status(404).json({
        success: false,
        message: 'Nurse not found'
      });
    }
    res.json({
      success: true,
      message: 'Nurse rejected successfully',
      data: nurse
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to reject nurse',
      error: error.message
    });
  }
};

module.exports = {
  registerNurse,
  getNurseById,
  getNurseByUID,
  getAllNurses,
  updateNurse,
  deleteNurse,
  getNursesByHospital,
  getNursesByQualification,
  getPendingApprovals,
  approveNurse,
  rejectNurse
}; 