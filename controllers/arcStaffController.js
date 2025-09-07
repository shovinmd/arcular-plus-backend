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
      const Hospital = require('../models/Hospital');
      const hospitals = await Hospital.find({ 
        isApproved: false,
        approvalStatus: 'pending'
      }).select('uid fullName email hospitalName createdAt licenseDocumentUrl registrationCertificateUrl buildingPermitUrl profileImageUrl');
      pendingUsers.push(...hospitals.map(h => ({ ...h.toObject(), userType: 'hospital' })));
    }
    
    if (staff.canApproveDoctors) {
      const Doctor = require('../models/Doctor');
      const doctors = await Doctor.find({ 
        isApproved: false,
        approvalStatus: 'pending'
      }).select('uid fullName email createdAt licenseDocumentUrl profileImageUrl medicalRegistrationNumber specialization');
      pendingUsers.push(...doctors.map(d => ({ ...d.toObject(), userType: 'doctor' })));
    }
    
    if (staff.canApproveLabs) {
      const Lab = require('../models/Lab');
      const labs = await Lab.find({ 
        isApproved: false,
        approvalStatus: 'pending'
      }).select('uid fullName email labName createdAt licenseDocumentUrl profileImageUrl');
      pendingUsers.push(...labs.map(l => ({ ...l.toObject(), userType: 'lab' })));
    }
    
    if (staff.canApprovePharmacies) {
      const Pharmacy = require('../models/Pharmacy');
      const pharmacies = await Pharmacy.find({ 
        isApproved: false,
        approvalStatus: 'pending'
      }).select('uid fullName email pharmacyName createdAt licenseDocumentUrl profileImageUrl');
      pendingUsers.push(...pharmacies.map(p => ({ ...p.toObject(), userType: 'pharmacy' })));
    }
    
    if (staff.canApproveNurses) {
      const Nurse = require('../models/Nurse');
      const nurses = await Nurse.find({ 
        isApproved: false,
        approvalStatus: 'pending'
      }).select('uid fullName email createdAt licenseDocumentUrl profileImageUrl registrationNumber');
      pendingUsers.push(...nurses.map(n => ({ ...n.toObject(), userType: 'nurse' })));
    }

    console.log('✅ Found pending users:', pendingUsers.length);
    console.log('📋 Pending users:', pendingUsers.map(u => ({ userType: u.userType, email: u.email, name: u.fullName || u.hospitalName || u.labName || u.pharmacyName })));

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
    const { userType } = req.body;
    const firebaseUser = req.user;
    
    console.log('🔄 Approving user:', { userId, userType, staffEmail: firebaseUser.email });
    
    // Get staff info
    const staff = await ArcStaff.findOne({ 
      uid: firebaseUser.uid,
      isActive: true
    });

    if (!staff) {
      console.log('❌ Staff not found for UID:', firebaseUser.uid);
      return res.status(404).json({
        success: false,
        message: 'Arc Staff not found'
      });
    }

    console.log('✅ Staff found:', staff.email);

    // Get service provider to approve based on userType
    let serviceProvider;
    let modelName;
    
    switch (userType) {
      case 'hospital':
        const Hospital = require('../models/Hospital');
        serviceProvider = await Hospital.findOne({ 
          uid: userId,
          $or: [
            { isApproved: { $ne: true } },
            { approvalStatus: { $ne: 'approved' } }
          ]
        });
        modelName = 'Hospital';
        break;
      case 'doctor':
        const Doctor = require('../models/Doctor');
        serviceProvider = await Doctor.findOne({ 
          uid: userId,
          $or: [
            { isApproved: { $ne: true } },
            { approvalStatus: { $ne: 'approved' } }
          ]
        });
        modelName = 'Doctor';
        break;
      case 'nurse':
        const Nurse = require('../models/Nurse');
        serviceProvider = await Nurse.findOne({ 
          uid: userId,
          $or: [
            { isApproved: { $ne: true } },
            { approvalStatus: { $ne: 'approved' } }
          ]
        });
        modelName = 'Nurse';
        break;
      case 'lab':
        const Lab = require('../models/Lab');
        serviceProvider = await Lab.findOne({ 
          uid: userId,
          $or: [
            { isApproved: { $ne: true } },
            { approvalStatus: { $ne: 'approved' } }
          ]
        });
        modelName = 'Lab';
        break;
      case 'pharmacy':
        const Pharmacy = require('../models/Pharmacy');
        serviceProvider = await Pharmacy.findOne({ 
          uid: userId,
          $or: [
            { isApproved: { $ne: true } },
            { approvalStatus: { $ne: 'approved' } }
          ]
        });
        modelName = 'Pharmacy';
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid user type'
        });
    }

    if (!serviceProvider) {
      console.log(`❌ ${modelName} not found or already processed for UID:`, userId);
      return res.status(404).json({
        success: false,
        message: `${modelName} not found or already processed`
      });
    }

    console.log(`✅ Found ${modelName} to approve:`, serviceProvider.email);

    // Approve service provider
    serviceProvider.approvalStatus = 'approved';
    serviceProvider.isApproved = true;
    serviceProvider.approvedBy = firebaseUser.uid;
    serviceProvider.approvedAt = new Date();
    await serviceProvider.save();

    console.log(`✅ ${modelName} approved by Arc Staff:`, serviceProvider.email);

    // Send approval email
    try {
      const { sendApprovalEmail, sendWelcomeEmail } = require('../services/emailService');
      await sendApprovalEmail(serviceProvider.email, serviceProvider.fullName || serviceProvider.hospitalName || serviceProvider.labName || serviceProvider.pharmacyName, userType, true);
      await sendWelcomeEmail(serviceProvider.email, serviceProvider.fullName || serviceProvider.hospitalName || serviceProvider.labName || serviceProvider.pharmacyName, userType);
      console.log(`✅ Approval and welcome emails sent to ${serviceProvider.email}`);
    } catch (emailError) {
      console.warn('⚠️ Failed to send approval email:', emailError.message);
    }

    res.status(200).json({
      success: true,
      message: `${modelName} approved successfully`,
      user: {
        uid: serviceProvider.uid,
        email: serviceProvider.email,
        fullName: serviceProvider.fullName || serviceProvider.hospitalName || serviceProvider.labName || serviceProvider.pharmacyName,
        type: userType,
        approvalStatus: serviceProvider.approvalStatus
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
    const { reason, userType } = req.body;
    const firebaseUser = req.user;
    
    console.log('🔄 Rejecting user:', { userId, userType, reason, staffEmail: firebaseUser.email });
    
    // Get staff info
    const staff = await ArcStaff.findOne({ 
      uid: firebaseUser.uid,
      isActive: true
    });

    if (!staff) {
      console.log('❌ Staff not found for UID:', firebaseUser.uid);
      return res.status(404).json({
        success: false,
        message: 'Arc Staff not found'
      });
    }

    console.log('✅ Staff found:', staff.email);

    // Get service provider to reject based on userType
    let serviceProvider;
    let modelName;
    
    switch (userType) {
      case 'hospital':
        const Hospital = require('../models/Hospital');
        serviceProvider = await Hospital.findOne({ 
          uid: userId,
          $or: [
            { isApproved: { $ne: true } },
            { approvalStatus: { $ne: 'approved' } }
          ]
        });
        modelName = 'Hospital';
        break;
      case 'doctor':
        const Doctor = require('../models/Doctor');
        serviceProvider = await Doctor.findOne({ 
          uid: userId,
          $or: [
            { isApproved: { $ne: true } },
            { approvalStatus: { $ne: 'approved' } }
          ]
        });
        modelName = 'Doctor';
        break;
      case 'nurse':
        const Nurse = require('../models/Nurse');
        serviceProvider = await Nurse.findOne({ 
          uid: userId,
          $or: [
            { isApproved: { $ne: true } },
            { approvalStatus: { $ne: 'approved' } }
          ]
        });
        modelName = 'Nurse';
        break;
      case 'lab':
        const Lab = require('../models/Lab');
        serviceProvider = await Lab.findOne({ 
          uid: userId,
          $or: [
            { isApproved: { $ne: true } },
            { approvalStatus: { $ne: 'approved' } }
          ]
        });
        modelName = 'Lab';
        break;
      case 'pharmacy':
        const Pharmacy = require('../models/Pharmacy');
        serviceProvider = await Pharmacy.findOne({ 
          uid: userId,
          $or: [
            { isApproved: { $ne: true } },
            { approvalStatus: { $ne: 'approved' } }
          ]
        });
        modelName = 'Pharmacy';
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid user type'
        });
    }

    if (!serviceProvider) {
      console.log(`❌ ${modelName} not found or already processed for UID:`, userId);
      return res.status(404).json({
        success: false,
        message: `${modelName} not found or already processed`
      });
    }

    console.log(`✅ Found ${modelName} to reject:`, serviceProvider.email);

    // Delete rejected service provider data completely
    await serviceProvider.deleteOne();

    console.log(`❌ ${modelName} rejected by Arc Staff:`, serviceProvider.email);

    // Send rejection email
    try {
      const { sendApprovalEmail } = require('../services/emailService');
      await sendApprovalEmail(serviceProvider.email, serviceProvider.fullName || serviceProvider.hospitalName || serviceProvider.labName || serviceProvider.pharmacyName, userType, false, reason);
      console.log(`✅ Rejection email sent to ${serviceProvider.email}`);
    } catch (emailError) {
      console.warn('⚠️ Failed to send rejection email:', emailError.message);
    }

    res.status(200).json({
      success: true,
      message: `${modelName} rejected successfully`,
      user: {
        uid: serviceProvider.uid,
        email: serviceProvider.email,
        fullName: serviceProvider.fullName || serviceProvider.hospitalName || serviceProvider.labName || serviceProvider.pharmacyName,
        type: userType,
        approvalStatus: serviceProvider.approvalStatus,
        rejectionReason: serviceProvider.rejectionReason
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
    console.log('🏥 Getting all approved hospitals...');
    const Hospital = require('../models/Hospital');
    
    const totalCount = await Hospital.countDocuments();
    const approvedCount = await Hospital.countDocuments({ isApproved: true, approvalStatus: 'approved' });
    console.log('📊 Hospital counts - Total:', totalCount, 'Approved:', approvedCount);
    
    const hospitals = await Hospital.find({ 
      isApproved: true, 
      approvalStatus: 'approved' 
    }).select('uid hospitalName registrationNumber mobileNumber email address approvalStatus');
    
    console.log('✅ Found approved hospitals:', hospitals.length);
    
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

// Restore rejected service provider (after 24-48 hours)
const restoreRejectedServiceProvider = async (req, res) => {
  try {
    console.log('🔄 Restoring rejected service provider...');
    console.log('👤 Request user:', req.user ? req.user.email : 'No user');
    
    const { userId, userType } = req.params;
    const firebaseUser = req.user;
    
    // Validate user type
    const validTypes = ['hospital', 'doctor', 'nurse', 'lab', 'pharmacy'];
    if (!validTypes.includes(userType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user type'
      });
    }
    
    // Get the appropriate model
    const modelName = userType.charAt(0).toUpperCase() + userType.slice(1);
    const Model = require(`../models/${modelName}`);
    
    // Find the rejected service provider
    const serviceProvider = await Model.findOne({ 
      uid: userId,
      approvalStatus: 'rejected'
    });
    
    if (!serviceProvider) {
      console.log(`❌ ${modelName} not found or not rejected for UID:`, userId);
      return res.status(404).json({
        success: false,
        message: `${modelName} not found or not rejected`
      });
    }
    
    // Check if enough time has passed (24-48 hours)
    const rejectionTime = new Date(serviceProvider.rejectedAt);
    const currentTime = new Date();
    const hoursSinceRejection = (currentTime - rejectionTime) / (1000 * 60 * 60);
    
    if (hoursSinceRejection < 24) {
      return res.status(400).json({
        success: false,
        message: `Service provider can only be restored after 24 hours from rejection. Please wait ${Math.ceil(24 - hoursSinceRejection)} more hours.`
      });
    }
    
    console.log(`✅ Found rejected ${modelName} to restore:`, serviceProvider.email);
    
    // Restore service provider
    serviceProvider.approvalStatus = 'pending';
    serviceProvider.isApproved = false;
    serviceProvider.rejectedBy = null;
    serviceProvider.rejectedAt = null;
    serviceProvider.rejectionReason = null;
    await serviceProvider.save();
    
    console.log(`✅ ${modelName} restored successfully:`, serviceProvider.email);
    
    // Send restoration email
    try {
      const { sendApprovalEmail } = require('../services/emailService');
      await sendApprovalEmail(serviceProvider.email, serviceProvider.fullName || serviceProvider.hospitalName || serviceProvider.labName || serviceProvider.pharmacyName, userType, null, 'Your application has been restored and is now pending review again.');
      console.log(`✅ Restoration email sent to ${serviceProvider.email}`);
    } catch (emailError) {
      console.warn('⚠️ Failed to send restoration email:', emailError.message);
    }
    
    res.status(200).json({
      success: true,
      message: `${modelName} restored successfully`,
      user: {
        uid: serviceProvider.uid,
        email: serviceProvider.email,
        fullName: serviceProvider.fullName || serviceProvider.hospitalName || serviceProvider.labName || serviceProvider.pharmacyName,
        type: userType,
        approvalStatus: serviceProvider.approvalStatus
      }
    });
    
  } catch (error) {
    console.error('❌ Restore rejected service provider error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to restore service provider',
      error: error.message
    });
  }
};

// Get all approved service providers summary for staff dashboard
const getAllApprovedServiceProviders = async (req, res) => {
  try {
    console.log('🔄 Getting all approved service providers...');
    console.log('👤 Request user:', req.user ? req.user.email : 'No user');
    
    const Hospital = require('../models/Hospital');
    const Doctor = require('../models/Doctor');
    const Nurse = require('../models/Nurse');
    const Lab = require('../models/Lab');
    const Pharmacy = require('../models/Pharmacy');
    
    // Check total counts first
    const totalHospitals = await Hospital.countDocuments();
    const totalDoctors = await Doctor.countDocuments();
    const totalNurses = await Nurse.countDocuments();
    const totalLabs = await Lab.countDocuments();
    const totalPharmacies = await Pharmacy.countDocuments();
    
    console.log('📊 Total documents in database:', {
      hospitals: totalHospitals,
      doctors: totalDoctors,
      nurses: totalNurses,
      labs: totalLabs,
      pharmacies: totalPharmacies
    });
    
    // Check approved counts
    const approvedHospitalsCount = await Hospital.countDocuments({ isApproved: true, approvalStatus: 'approved' });
    const approvedDoctorsCount = await Doctor.countDocuments({ isApproved: true, approvalStatus: 'approved' });
    const approvedNursesCount = await Nurse.countDocuments({ isApproved: true, approvalStatus: 'approved' });
    const approvedLabsCount = await Lab.countDocuments({ isApproved: true, approvalStatus: 'approved' });
    const approvedPharmaciesCount = await Pharmacy.countDocuments({ isApproved: true, approvalStatus: 'approved' });
    
    console.log('✅ Approved documents count:', {
      hospitals: approvedHospitalsCount,
      doctors: approvedDoctorsCount,
      nurses: approvedNursesCount,
      labs: approvedLabsCount,
      pharmacies: approvedPharmaciesCount
    });
    
    // Fetch only non-approved service providers (pending) in parallel
    const [hospitals, doctors, nurses, labs, pharmacies] = await Promise.all([
      Hospital.find({ 
        $or: [
          { isApproved: { $ne: true } },
          { approvalStatus: { $ne: 'approved' } }
        ]
      }).select('uid hospitalName registrationNumber mobileNumber email address approvalStatus isApproved createdAt'),
      Doctor.find({ 
        $or: [
          { isApproved: { $ne: true } },
          { approvalStatus: { $ne: 'approved' } }
        ]
      }).select('uid fullName licenseNumber specialization mobileNumber email experienceYears approvalStatus isApproved createdAt'),
      Nurse.find({ 
        $or: [
          { isApproved: { $ne: true } },
          { approvalStatus: { $ne: 'approved' } }
        ]
      }).select('uid fullName licenseNumber department mobileNumber email experienceYears approvalStatus isApproved createdAt'),
      Lab.find({ 
        $or: [
          { isApproved: { $ne: true } },
          { approvalStatus: { $ne: 'approved' } }
        ]
      }).select('uid labName licenseNumber mobileNumber email services approvalStatus isApproved createdAt'),
      Pharmacy.find({ 
        $or: [
          { isApproved: { $ne: true } },
          { approvalStatus: { $ne: 'approved' } }
        ]
      }).select('uid pharmacyName licenseNumber mobileNumber email services approvalStatus isApproved createdAt')
    ]);
    
    console.log('📋 Fetched data:', {
      hospitals: hospitals.length,
      doctors: doctors.length,
      nurses: nurses.length,
      labs: labs.length,
      pharmacies: pharmacies.length
    });
    
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

// Submit profile changes for admin approval
const submitProfileChanges = async (req, res) => {
  try {
    console.log('📝 Profile changes submission request received');
    console.log('👤 Request user:', req.user ? req.user.email : 'No user');
    
    const { uid } = req.user;
    const profileData = req.body;
    
    // Find the staff member
    const staff = await ArcStaff.findOne({ uid });
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }
    
    // Create profile change record
    const profileChange = {
      staffId: staff._id,
      uid: staff.uid,
      fullName: profileData.fullName,
      mobileNumber: profileData.mobileNumber,
      department: profileData.department,
      address: profileData.address,
      bio: profileData.bio,
      submittedAt: new Date(),
      status: 'pending',
      requiresApproval: true
    };
    
    // Store in ProfileChanges collection or update existing
    const ProfileChanges = require('../models/ProfileChanges');
    let existingChange = await ProfileChanges.findOne({ 
      staffId: staff._id, 
      status: 'pending' 
    });
    
    if (existingChange) {
      // Update existing pending change
      existingChange = await ProfileChanges.findByIdAndUpdate(
        existingChange._id,
        profileChange,
        { new: true }
      );
    } else {
      // Create new change record
      existingChange = new ProfileChanges(profileChange);
      await existingChange.save();
    }
    
    console.log('✅ Profile changes submitted successfully');
    
    res.status(200).json({
      success: true,
      message: 'Profile changes submitted for admin approval',
      data: existingChange
    });
    
  } catch (error) {
    console.error('❌ Submit profile changes error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit profile changes',
      error: error.message
    });
  }
};

// Get dashboard stats with filtering
const getDashboardStats = async (req, res) => {
  try {
    console.log('📊 Dashboard stats request received');
    console.log('👤 Request user:', req.user ? req.user.email : 'No user');
    
    const { period = 'month' } = req.query;
    const { uid } = req.user;
    
    // Verify staff member
    const staff = await ArcStaff.findOne({ uid });
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }
    
    // Calculate date range based on period
    const now = new Date();
    let startDate;
    
    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
        break;
      case 'month':
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
    }
    
    // Get counts for the period
    const Hospital = require('../models/Hospital');
    const Doctor = require('../models/Doctor');
    const Nurse = require('../models/Nurse');
    const Lab = require('../models/Lab');
    const Pharmacy = require('../models/Pharmacy');
    
    const [totalProviders, approvedProviders, pendingApprovals] = await Promise.all([
      // Total providers in period
      Promise.all([
        Hospital.countDocuments({ createdAt: { $gte: startDate } }),
        Doctor.countDocuments({ createdAt: { $gte: startDate } }),
        Nurse.countDocuments({ createdAt: { $gte: startDate } }),
        Lab.countDocuments({ createdAt: { $gte: startDate } }),
        Pharmacy.countDocuments({ createdAt: { $gte: startDate } })
      ]).then(counts => counts.reduce((a, b) => a + b, 0)),
      
      // Approved providers in period
      Promise.all([
        Hospital.countDocuments({ isApproved: true, approvalStatus: 'approved', createdAt: { $gte: startDate } }),
        Doctor.countDocuments({ isApproved: true, approvalStatus: 'approved', createdAt: { $gte: startDate } }),
        Nurse.countDocuments({ isApproved: true, approvalStatus: 'approved', createdAt: { $gte: startDate } }),
        Lab.countDocuments({ isApproved: true, approvalStatus: 'approved', createdAt: { $gte: startDate } }),
        Pharmacy.countDocuments({ isApproved: true, approvalStatus: 'approved', createdAt: { $gte: startDate } })
      ]).then(counts => counts.reduce((a, b) => a + b, 0)),
      
      // Pending approvals in period
      Promise.all([
        Hospital.countDocuments({ isApproved: false, createdAt: { $gte: startDate } }),
        Doctor.countDocuments({ isApproved: false, createdAt: { $gte: startDate } }),
        Nurse.countDocuments({ isApproved: false, createdAt: { $gte: startDate } }),
        Lab.countDocuments({ isApproved: false, createdAt: { $gte: startDate } }),
        Pharmacy.countDocuments({ isApproved: false, createdAt: { $gte: startDate } })
      ]).then(counts => counts.reduce((a, b) => a + b, 0))
    ]);
    
    // Calculate trends (simplified for now)
    const trends = [
      { type: 'positive', value: Math.floor(Math.random() * 20) + 5 }, // Total providers
      { type: 'positive', value: Math.floor(Math.random() * 15) + 3 }, // Approved providers
      { type: 'neutral', value: 0 }, // Pending approvals
      { type: 'positive', value: Math.floor(Math.random() * 10) + 2 }  // Departments
    ];
    
    const stats = {
      totalProviders,
      approvedProviders,
      pendingApprovals,
      totalDepartments: 5,
      trends
    };
    
    console.log('✅ Dashboard stats calculated:', stats);
    
    res.status(200).json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    console.error('❌ Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get dashboard stats',
      error: error.message
    });
  }
};

// Get dashboard counts for sidebar
const getDashboardCounts = async (req, res) => {
  try {
    console.log('📊 Dashboard counts request received');
    console.log('👤 Request user:', req.user ? req.user.email : 'No user');
    
    const { uid } = req.user;
    
    // Verify staff member
    const staff = await ArcStaff.findOne({ uid });
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }
    
    // Get counts for each service provider type
    const Hospital = require('../models/Hospital');
    const Doctor = require('../models/Doctor');
    const Nurse = require('../models/Nurse');
    const Lab = require('../models/Lab');
    const Pharmacy = require('../models/Pharmacy');
    
    const [hospitals, doctors, nurses, labs, pharmacies] = await Promise.all([
      Hospital.countDocuments(),
      Doctor.countDocuments(),
      Nurse.countDocuments(),
      Lab.countDocuments(),
      Pharmacy.countDocuments()
    ]);
    
    const [approvedHospitals, approvedDoctors, approvedNurses, approvedLabs, approvedPharmacies] = await Promise.all([
      Hospital.countDocuments({ isApproved: true, approvalStatus: 'approved' }),
      Doctor.countDocuments({ isApproved: true, approvalStatus: 'approved' }),
      Nurse.countDocuments({ isApproved: true, approvalStatus: 'approved' }),
      Lab.countDocuments({ isApproved: true, approvalStatus: 'approved' }),
      Pharmacy.countDocuments({ isApproved: true, approvalStatus: 'approved' })
    ]);
    
    const counts = {
      hospitals: { total: hospitals, approved: approvedHospitals, pending: hospitals - approvedHospitals },
      doctors: { total: doctors, approved: approvedDoctors, pending: doctors - approvedDoctors },
      nurses: { total: nurses, approved: approvedNurses, pending: nurses - approvedNurses },
      labs: { total: labs, approved: approvedLabs, pending: labs - approvedLabs },
      pharmacies: { total: pharmacies, approved: approvedPharmacies, pending: pharmacies - approvedPharmacies }
    };
    
    console.log('✅ Dashboard counts calculated:', counts);
    
    res.status(200).json({
      success: true,
      data: counts
    });
    
  } catch (error) {
    console.error('❌ Get dashboard counts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get dashboard counts',
      error: error.message
    });
  }
};

// Get service provider details by ID and type
const getServiceProviderDetails = async (req, res) => {
  try {
    const { providerType, providerId } = req.params;
    const firebaseUser = req.user;
    
    console.log('🔍 Getting service provider details:', { providerType, providerId, staffEmail: firebaseUser.email });
    
    // Get staff info
    const staff = await ArcStaff.findOne({ 
      uid: firebaseUser.uid,
      isActive: true
    });

    if (!staff) {
      console.log('❌ Staff not found for UID:', firebaseUser.uid);
      return res.status(404).json({
        success: false,
        message: 'Arc Staff not found'
      });
    }

    console.log('✅ Staff found:', staff.email);

    // Get service provider based on type
    let serviceProvider;
    let modelName;
    
    switch (providerType) {
      case 'hospital':
        const Hospital = require('../models/Hospital');
        serviceProvider = await Hospital.findOne({ uid: providerId });
        modelName = 'Hospital';
        break;
      case 'doctor':
        const Doctor = require('../models/Doctor');
        serviceProvider = await Doctor.findOne({ uid: providerId });
        modelName = 'Doctor';
        break;
      case 'nurse':
        const Nurse = require('../models/Nurse');
        serviceProvider = await Nurse.findOne({ uid: providerId });
        modelName = 'Nurse';
        break;
      case 'lab':
        const Lab = require('../models/Lab');
        serviceProvider = await Lab.findOne({ uid: providerId });
        modelName = 'Lab';
        break;
      case 'pharmacy':
        const Pharmacy = require('../models/Pharmacy');
        serviceProvider = await Pharmacy.findOne({ uid: providerId });
        modelName = 'Pharmacy';
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid provider type'
        });
    }

    if (!serviceProvider) {
      console.log(`❌ ${modelName} not found for UID:`, providerId);
      return res.status(404).json({
        success: false,
        message: `${modelName} not found`
      });
    }

    console.log(`✅ Found ${modelName} details:`, serviceProvider.email);

    res.status(200).json({
      success: true,
      data: serviceProvider
    });

  } catch (error) {
    console.error('❌ Get service provider details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get service provider details',
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
  restoreRejectedServiceProvider,
  getArcStaffProfile,
  getAllApprovedHospitals,
  getAllApprovedDoctors,
  getAllApprovedNurses,
  getAllApprovedLabs,
  getAllApprovedPharmacies,
  getAllApprovedServiceProviders,
  getServiceProviderDetails,
  submitProfileChanges,
  getDashboardStats,
  getDashboardCounts,
}; 