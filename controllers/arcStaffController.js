const ArcStaff = require('../models/ArcStaff');
const User = require('../models/User');

// Register new Arc Staff (self-registration)
const registerArcStaff = async (req, res) => {
  try {
    console.log('👨‍💼 Arc Staff registration request received');
    console.log('📋 Request body:', JSON.stringify(req.body, null, 2));

    // Map documents from RegistrationService format to expected format
    const { documents } = req.body;
    if (documents) {
      if (documents.identity_proof) {
        req.body.identityProofUrl = documents.identity_proof;
      }
      if (documents.employment_letter) {
        req.body.employmentLetterUrl = documents.employment_letter;
      }
    }

    const userData = req.body;
    const { uid } = userData;

    // Check if arc staff already exists
    const existingStaff = await User.findOne({ uid });
    if (existingStaff) {
      return res.status(400).json({ error: 'Arc Staff already registered' });
    }

    // Create new arc staff user
    const newStaff = new User({
      ...userData,
      userType: 'arcstaff',
      status: userData.status || 'pending',
      registrationDate: new Date(),
    });

    const savedStaff = await newStaff.save();

    res.status(201).json({
      success: true,
      message: 'Arc Staff registration successful',
      data: savedStaff,
      arcId: savedStaff.arcId,
    });
  } catch (error) {
    console.error('Arc Staff registration error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Arc Staff registration failed',
      details: error.message 
    });
  }
};

// Create new Arc Staff (by admin)
const createArcStaff = async (req, res) => {
  try {
    const firebaseUser = req.user; // set by auth middleware
    if (!firebaseUser || !firebaseUser.uid) {
      return res.status(400).json({ error: 'Invalid Firebase user' });
    }
    
    // Check if staff already exists
    const existingStaff = await ArcStaff.findOne({ 
      email: req.body.email 
    });

    if (existingStaff) {
      return res.status(400).json({ 
        success: false, 
        message: 'Staff with this email already exists' 
      });
    }

    // Create new staff
    const staffData = {
      uid: req.body.uid, // Firebase UID for the staff
      ...req.body,
      createdBy: firebaseUser.uid,
      joiningDate: new Date(),
    };

    const arcStaff = new ArcStaff(staffData);
    await arcStaff.save();

    console.log('✅ Arc Staff created successfully:', arcStaff.email);

    res.status(201).json({
      success: true,
      message: 'Arc Staff created successfully',
      staff: arcStaff
    });

  } catch (error) {
    console.error('❌ Create Arc Staff error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create Arc Staff',
      error: error.message
    });
  }
};

// Get all Arc Staff (for admin)
const getAllArcStaff = async (req, res) => {
  try {
    const staff = await ArcStaff.find()
      .select('-__v')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: staff.length,
      staff: staff
    });

  } catch (error) {
    console.error('❌ Get all Arc Staff error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get Arc Staff',
      error: error.message
    });
  }
};

// Get Arc Staff by ID
const getArcStaffById = async (req, res) => {
  try {
    const { staffId } = req.params;
    
    const staff = await ArcStaff.findOne({ 
      uid: staffId,
      isActive: true
    });

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Arc Staff not found'
      });
    }

    res.status(200).json({
      success: true,
      staff: staff
    });

  } catch (error) {
    console.error('❌ Get Arc Staff error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get Arc Staff',
      error: error.message
    });
  }
};

// Update Arc Staff
const updateArcStaff = async (req, res) => {
  try {
    const { staffId } = req.params;
    const firebaseUser = req.user;

    // Check if staff exists
    const staff = await ArcStaff.findOne({ 
      uid: staffId,
      isActive: true
    });

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Arc Staff not found'
      });
    }

    // Update staff info
    const updatedStaff = await ArcStaff.findByIdAndUpdate(
      staff._id,
      { ...req.body },
      { new: true, runValidators: true }
    );

    console.log('✅ Arc Staff updated successfully:', updatedStaff.email);

    res.status(200).json({
      success: true,
      message: 'Arc Staff updated successfully',
      staff: updatedStaff
    });

  } catch (error) {
    console.error('❌ Update Arc Staff error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update Arc Staff',
      error: error.message
    });
  }
};

// Delete Arc Staff (soft delete)
const deleteArcStaff = async (req, res) => {
  try {
    const { staffId } = req.params;

    const staff = await ArcStaff.findOneAndUpdate(
      { uid: staffId },
      { isActive: false },
      { new: true }
    );

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Arc Staff not found'
      });
    }

    console.log('✅ Arc Staff deactivated successfully:', staff.email);

    res.status(200).json({
      success: true,
      message: 'Arc Staff deactivated successfully'
    });

  } catch (error) {
    console.error('❌ Delete Arc Staff error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete Arc Staff',
      error: error.message
    });
  }
};

// Get pending approvals for Arc Staff
const getPendingApprovals = async (req, res) => {
  try {
    const firebaseUser = req.user;
    
    // Get staff info
    const staff = await ArcStaff.findOne({ 
      uid: firebaseUser.uid,
      isActive: true
    });

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Arc Staff not found'
      });
    }

    // Get pending users based on staff permissions
    const pendingUsers = [];
    
    if (staff.canApproveHospitals) {
      const hospitals = await User.find({ 
        type: 'hospital',
        approvalStatus: 'pending'
      }).select('uid fullName email hospitalName createdAt');
      pendingUsers.push(...hospitals.map(h => ({ ...h.toObject(), userType: 'hospital' })));
    }
    
    if (staff.canApproveDoctors) {
      const doctors = await User.find({ 
        type: 'doctor',
        approvalStatus: 'pending'
      }).select('uid fullName email createdAt');
      pendingUsers.push(...doctors.map(d => ({ ...d.toObject(), userType: 'doctor' })));
    }
    
    if (staff.canApproveLabs) {
      const labs = await User.find({ 
        type: 'lab',
        approvalStatus: 'pending'
      }).select('uid fullName email createdAt');
      pendingUsers.push(...labs.map(l => ({ ...l.toObject(), userType: 'lab' })));
    }
    
    if (staff.canApprovePharmacies) {
      const pharmacies = await User.find({ 
        type: 'pharmacy',
        approvalStatus: 'pending'
      }).select('uid fullName email createdAt');
      pendingUsers.push(...pharmacies.map(p => ({ ...p.toObject(), userType: 'pharmacy' })));
    }
    
    if (staff.canApproveNurses) {
      const nurses = await User.find({ 
        type: 'nurse',
        approvalStatus: 'pending'
      }).select('uid fullName email createdAt');
      pendingUsers.push(...nurses.map(n => ({ ...n.toObject(), userType: 'nurse' })));
    }

    res.status(200).json({
      success: true,
      count: pendingUsers.length,
      pendingUsers: pendingUsers
    });

  } catch (error) {
    console.error('❌ Get pending approvals error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get pending approvals',
      error: error.message
    });
  }
};

// Approve user (by Arc Staff)
const approveUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const firebaseUser = req.user;
    
    // Get staff info
    const staff = await ArcStaff.findOne({ 
      uid: firebaseUser.uid,
      isActive: true
    });

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Arc Staff not found'
      });
    }

    // Get user to approve
    const user = await User.findOne({ 
      uid: userId,
      approvalStatus: 'pending'
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found or already processed'
      });
    }

    // Check if staff has permission to approve this user type
    if (!staff.canApprove(user.type)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to approve this user type'
      });
    }

    // Approve user
    user.approvalStatus = 'approved';
    user.isApproved = true;
    user.approvedBy = firebaseUser.uid;
    user.approvedAt = new Date();
    await user.save();

    console.log('✅ User approved by Arc Staff:', user.email);

    res.status(200).json({
      success: true,
      message: 'User approved successfully',
      user: {
        uid: user.uid,
        email: user.email,
        fullName: user.fullName,
        type: user.type,
        approvalStatus: user.approvalStatus
      }
    });

  } catch (error) {
    console.error('❌ Approve user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve user',
      error: error.message
    });
  }
};

// Reject user (by Arc Staff)
const rejectUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    const firebaseUser = req.user;
    
    // Get staff info
    const staff = await ArcStaff.findOne({ 
      uid: firebaseUser.uid,
      isActive: true
    });

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Arc Staff not found'
      });
    }

    // Get user to reject
    const user = await User.findOne({ 
      uid: userId,
      approvalStatus: 'pending'
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found or already processed'
      });
    }

    // Check if staff has permission to reject this user type
    if (!staff.canApprove(user.type)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to reject this user type'
      });
    }

    // Reject user
    user.approvalStatus = 'rejected';
    user.isApproved = false;
    user.rejectedBy = firebaseUser.uid;
    user.rejectedAt = new Date();
    user.rejectionReason = reason || 'Rejected by Arc Staff';
    await user.save();

    console.log('❌ User rejected by Arc Staff:', user.email);

    res.status(200).json({
      success: true,
      message: 'User rejected successfully',
      user: {
        uid: user.uid,
        email: user.email,
        fullName: user.fullName,
        type: user.type,
        approvalStatus: user.approvalStatus,
        rejectionReason: user.rejectionReason
      }
    });

  } catch (error) {
    console.error('❌ Reject user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject user',
      error: error.message
    });
  }
};

// Get Arc Staff profile
const getArcStaffProfile = async (req, res) => {
  try {
    const firebaseUser = req.user;
    
    const staff = await ArcStaff.findOne({ 
      uid: firebaseUser.uid,
      isActive: true
    });

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Arc Staff not found'
      });
    }

    res.status(200).json({
      success: true,
      staff: staff
    });

  } catch (error) {
    console.error('❌ Get Arc Staff profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get Arc Staff profile',
      error: error.message
    });
  }
};

// Get all approved hospitals for staff dashboard
const getAllApprovedHospitals = async (req, res) => {
  try {
    const Hospital = require('../models/Hospital');
    
    const hospitals = await Hospital.find({ 
      isApproved: true, 
      approvalStatus: 'approved' 
    }).select('uid hospitalName registrationNumber mobileNumber email address approvalStatus');
    
    res.status(200).json({
      success: true,
      hospitals: hospitals
    });
  } catch (error) {
    console.error('❌ Get approved hospitals error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get approved hospitals',
      error: error.message
    });
  }
};

// Get all approved doctors for staff dashboard
const getAllApprovedDoctors = async (req, res) => {
  try {
    const Doctor = require('../models/Doctor');
    
    const doctors = await Doctor.find({ 
      isApproved: true, 
      approvalStatus: 'approved' 
    }).select('uid fullName licenseNumber specialization mobileNumber email experienceYears approvalStatus');
    
    res.status(200).json({
      success: true,
      doctors: doctors
    });
  } catch (error) {
    console.error('❌ Get approved doctors error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get approved doctors',
      error: error.message
    });
  }
};

// Get all approved nurses for staff dashboard
const getAllApprovedNurses = async (req, res) => {
  try {
    const Nurse = require('../models/Nurse');
    
    const nurses = await Nurse.find({ 
      isApproved: true, 
      approvalStatus: 'approved' 
    }).select('uid fullName licenseNumber department mobileNumber email experienceYears approvalStatus');
    
    res.status(200).json({
      success: true,
      nurses: nurses
    });
  } catch (error) {
    console.error('❌ Get approved nurses error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get approved nurses',
      error: error.message
    });
  }
};

// Get all approved labs for staff dashboard
const getAllApprovedLabs = async (req, res) => {
  try {
    const Lab = require('../models/Lab');
    
    const labs = await Lab.find({ 
      isApproved: true, 
      approvalStatus: 'approved' 
    }).select('uid labName licenseNumber mobileNumber email services approvalStatus');
    
    res.status(200).json({
      success: true,
      labs: labs
    });
  } catch (error) {
    console.error('❌ Get approved labs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get approved labs',
      error: error.message
    });
  }
};

// Get all approved pharmacies for staff dashboard
const getAllApprovedPharmacies = async (req, res) => {
  try {
    const Pharmacy = require('../models/Pharmacy');
    
    const pharmacies = await Pharmacy.find({ 
      isApproved: true, 
      approvalStatus: 'approved' 
    }).select('uid pharmacyName licenseNumber mobileNumber email services approvalStatus');
    
    res.status(200).json({
      success: true,
      pharmacies: pharmacies
    });
  } catch (error) {
    console.error('❌ Get approved pharmacies error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get approved pharmacies',
      error: error.message
    });
  }
};

// Get all approved service providers summary for staff dashboard
const getAllApprovedServiceProviders = async (req, res) => {
  try {
    const Hospital = require('../models/Hospital');
    const Doctor = require('../models/Doctor');
    const Nurse = require('../models/Nurse');
    const Lab = require('../models/Lab');
    const Pharmacy = require('../models/Pharmacy');
    
    // Fetch all approved service providers in parallel
    const [hospitals, doctors, nurses, labs, pharmacies] = await Promise.all([
      Hospital.find({ isApproved: true, approvalStatus: 'approved' }).select('uid hospitalName registrationNumber mobileNumber email address approvalStatus'),
      Doctor.find({ isApproved: true, approvalStatus: 'approved' }).select('uid fullName licenseNumber specialization mobileNumber email experienceYears approvalStatus'),
      Nurse.find({ isApproved: true, approvalStatus: 'approved' }).select('uid fullName licenseNumber department mobileNumber email experienceYears approvalStatus'),
      Lab.find({ isApproved: true, approvalStatus: 'approved' }).select('uid labName licenseNumber mobileNumber email services approvalStatus'),
      Pharmacy.find({ isApproved: true, approvalStatus: 'approved' }).select('uid pharmacyName licenseNumber mobileNumber email services approvalStatus')
    ]);
    
    res.status(200).json({
      success: true,
      data: {
        hospitals: hospitals,
        doctors: doctors,
        nurses: nurses,
        labs: labs,
        pharmacies: pharmacies
      }
    });
  } catch (error) {
    console.error('❌ Get all approved service providers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get approved service providers',
      error: error.message
    });
  }
};

module.exports = {
  registerArcStaff,
  createArcStaff,
  getAllArcStaff,
  getArcStaffById,
  updateArcStaff,
  deleteArcStaff,
  getPendingApprovals,
  approveUser,
  rejectUser,
  getArcStaffProfile,
  getAllApprovedHospitals,
  getAllApprovedDoctors,
  getAllApprovedNurses,
  getAllApprovedLabs,
  getAllApprovedPharmacies,
  getAllApprovedServiceProviders,
}; 