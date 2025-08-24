const Hospital = require('../models/Hospital');
const Doctor = require('../models/Doctor');
const Nurse = require('../models/Nurse');
const Pharmacy = require('../models/Pharmacy');
const Lab = require('../models/Lab');

// Middleware to check if user is approved in their role model
const checkRoleApproval = async (req, res, next) => {
  try {
    const { uid } = req.params; // Get UID from URL params
    
    if (!uid) {
      return res.status(400).json({ 
        success: false, 
        message: 'User UID is required' 
      });
    }

    // Check approval status in all role models
    const [hospital, doctor, nurse, pharmacy, lab] = await Promise.all([
      Hospital.findOne({ uid }),
      Doctor.findOne({ uid }),
      Nurse.findOne({ uid }),
      Pharmacy.findOne({ uid }),
      Lab.findOne({ uid })
    ]);

    let user = hospital || doctor || nurse || pharmacy || lab;
    
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
    console.error('Role approval check error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error checking approval status' 
    });
  }
};

module.exports = {
  checkRoleApproval
};
