const Hospital = require('../models/Hospital');
const Doctor = require('../models/Doctor');
const Nurse = require('../models/Nurse');
const Pharmacy = require('../models/Pharmacy');
const Lab = require('../models/Lab');
const ArcStaff = require('../models/ArcStaff');

// Middleware to check if user is approved
const checkApprovalStatus = async (req, res, next) => {
  try {
    const { uid } = req.params; // Get UID from URL params
    
    if (!uid) {
      return res.status(400).json({ 
        success: false, 
        message: 'User UID is required' 
      });
    }

    // Check approval status in all role models
    const [hospital, doctor, nurse, pharmacy, lab, arcStaff] = await Promise.all([
      Hospital.findOne({ uid }),
      Doctor.findOne({ uid }),
      Nurse.findOne({ uid }),
      Pharmacy.findOne({ uid }),
      Lab.findOne({ uid }),
      ArcStaff.findOne({ uid })
    ]);

    let user = hospital || doctor || nurse || pharmacy || lab || arcStaff;
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Check if user is approved
    if (!user.isApproved || user.approvalStatus !== 'approved') {
      return res.status(403).json({ 
        success: false, 
        message: 'Your account is pending approval. Please wait for admin approval.',
        status: 'pending',
        approvalStatus: user.approvalStatus
      });
    }

    // User is approved, proceed
    req.approvedUser = user;
    next();
  } catch (error) {
    console.error('Approval check error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error checking approval status' 
    });
  }
};

// Middleware to check if user exists and get their role
const getUserRole = async (req, res, next) => {
  try {
    const { uid } = req.params;
    
    if (!uid) {
      return res.status(400).json({ 
        success: false, 
        message: 'User UID is required' 
      });
    }

    // Check in all role models
    const [hospital, doctor, nurse, pharmacy, lab, arcStaff] = await Promise.all([
      Hospital.findOne({ uid }),
      Doctor.findOne({ uid }),
      Nurse.findOne({ uid }),
      Pharmacy.findOne({ uid }),
      Lab.findOne({ uid }),
      ArcStaff.findOne({ uid })
    ]);

    let user = hospital || doctor || nurse || pharmacy || lab || arcStaff;
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Determine user role
    let userRole = 'unknown';
    if (hospital) userRole = 'hospital';
    else if (doctor) userRole = 'doctor';
    else if (nurse) userRole = 'nurse';
    else if (pharmacy) userRole = 'pharmacy';
    else if (lab) userRole = 'lab';
    else if (arcStaff) userRole = 'arc_staff';

    req.userRole = userRole;
    req.userData = user;
    next();
  } catch (error) {
    console.error('Get user role error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error getting user role' 
    });
  }
};

module.exports = {
  checkApprovalStatus,
  getUserRole
};
