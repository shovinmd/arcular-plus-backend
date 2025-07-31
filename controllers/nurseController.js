const Nurse = require('../models/Nurse');
const User = require('../models/User');

// Register a new nurse
const registerNurse = async (req, res) => {
  try {
    const firebaseUser = req.user;
    const {
      name,
      email,
      phone,
      alternatePhone,
      dateOfBirth,
      gender,
      licenseNumber,
      registrationNumber,
      specialization,
      experience,
      education,
      qualification,
      hospitalId,
      department,
      designation,
      shift,
      address,
      city,
      state,
      pincode,
      certificateUrl,
      licenseDocumentUrl,
      bio,
      emergencyContact
    } = req.body;

    // Check if nurse already exists
    const existingNurse = await Nurse.findOne({
      $or: [
        { email: email.toLowerCase() },
        { licenseNumber },
        { registrationNumber },
        { uid: firebaseUser.uid }
      ]
    });

    if (existingNurse) {
      return res.status(400).json({
        success: false,
        message: 'Nurse already exists with this email, license number, or registration number'
      });
    }

    // Create new nurse
    const nurse = new Nurse({
      uid: firebaseUser.uid,
      name,
      email: email.toLowerCase(),
      phone,
      alternatePhone,
      dateOfBirth: new Date(dateOfBirth),
      gender,
      licenseNumber,
      registrationNumber,
      specialization,
      experience: parseInt(experience) || 0,
      education,
      qualification,
      hospitalId,
      department,
      designation,
      shift,
      address,
      city,
      state,
      pincode,
      certificateUrl,
      licenseDocumentUrl,
      bio,
      emergencyContact,
      isApproved: false,
      approvalStatus: 'pending'
    });

    await nurse.save();

    // Also create/update user record
    const userData = {
      uid: firebaseUser.uid,
      fullName: name,
      email: email.toLowerCase(),
      mobileNumber: phone,
      alternateMobile: alternatePhone,
      gender,
      dateOfBirth: new Date(dateOfBirth),
      address,
      city,
      state,
      pincode,
      type: 'nurse',
      // Nurse-specific fields
      medicalRegistrationNumber: registrationNumber,
      specialization,
      experienceYears: parseInt(experience) || 0,
      certificateUrl
    };

    await User.findOneAndUpdate(
      { uid: firebaseUser.uid },
      userData,
      { upsert: true, new: true }
    );

    res.status(201).json({
      success: true,
      message: 'Nurse registered successfully. Pending approval.',
      data: nurse
    });

  } catch (error) {
    console.error('Error registering nurse:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to register nurse',
      error: error.message
    });
  }
};

// Get all nurses
const getAllNurses = async (req, res) => {
  try {
    const nurses = await Nurse.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      data: nurses
    });
  } catch (error) {
    console.error('Error fetching nurses:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch nurses',
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
    res.status(200).json({
      success: true,
      data: nurse
    });
  } catch (error) {
    console.error('Error fetching nurse:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch nurse',
      error: error.message
    });
  }
};

// Get nurse by UID
const getNurseByUid = async (req, res) => {
  try {
    const nurse = await Nurse.findOne({ uid: req.params.uid });
    if (!nurse) {
      return res.status(404).json({
        success: false,
        message: 'Nurse not found'
      });
    }
    res.status(200).json({
      success: true,
      data: nurse
    });
  } catch (error) {
    console.error('Error fetching nurse:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch nurse',
      error: error.message
    });
  }
};

// Update nurse
const updateNurse = async (req, res) => {
  try {
    const nurse = await Nurse.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!nurse) {
      return res.status(404).json({
        success: false,
        message: 'Nurse not found'
      });
    }
    res.status(200).json({
      success: true,
      message: 'Nurse updated successfully',
      data: nurse
    });
  } catch (error) {
    console.error('Error updating nurse:', error);
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
    res.status(200).json({
      success: true,
      message: 'Nurse deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting nurse:', error);
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
    const nurses = await Nurse.findByHospital(req.params.hospitalId);
    res.status(200).json({
      success: true,
      data: nurses
    });
  } catch (error) {
    console.error('Error fetching nurses by hospital:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch nurses',
      error: error.message
    });
  }
};

// Get nurses by department
const getNursesByDepartment = async (req, res) => {
  try {
    const nurses = await Nurse.findByDepartment(req.params.department);
    res.status(200).json({
      success: true,
      data: nurses
    });
  } catch (error) {
    console.error('Error fetching nurses by department:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch nurses',
      error: error.message
    });
  }
};

// Get pending approvals
const getPendingApprovals = async (req, res) => {
  try {
    const nurses = await Nurse.findPendingApprovals();
    res.status(200).json({
      success: true,
      data: nurses
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

// Approve nurse
const approveNurse = async (req, res) => {
  try {
    const nurse = await Nurse.findById(req.params.id);
    if (!nurse) {
      return res.status(404).json({
        success: false,
        message: 'Nurse not found'
      });
    }

    nurse.approvalStatus = 'approved';
    nurse.isApproved = true;
    await nurse.save();

    res.status(200).json({
      success: true,
      message: 'Nurse approved successfully',
      data: nurse
    });
  } catch (error) {
    console.error('Error approving nurse:', error);
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
    const nurse = await Nurse.findById(req.params.id);
    if (!nurse) {
      return res.status(404).json({
        success: false,
        message: 'Nurse not found'
      });
    }

    nurse.approvalStatus = 'rejected';
    nurse.isApproved = false;
    await nurse.save();

    res.status(200).json({
      success: true,
      message: 'Nurse rejected successfully',
      data: nurse
    });
  } catch (error) {
    console.error('Error rejecting nurse:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject nurse',
      error: error.message
    });
  }
};

// Search nurses
const searchNurses = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const nurses = await Nurse.search(q);
    res.status(200).json({
      success: true,
      data: nurses
    });
  } catch (error) {
    console.error('Error searching nurses:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search nurses',
      error: error.message
    });
  }
};

module.exports = {
  registerNurse,
  getAllNurses,
  getNurseById,
  getNurseByUid,
  updateNurse,
  deleteNurse,
  getNursesByHospital,
  getNursesByDepartment,
  getPendingApprovals,
  approveNurse,
  rejectNurse,
  searchNurses
}; 