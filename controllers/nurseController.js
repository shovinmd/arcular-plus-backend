const Nurse = require('../models/Nurse');
const { sendRegistrationConfirmation, sendApprovalEmail } = require('../services/emailService');

// Register a new nurse
const registerNurse = async (req, res) => {
  try {
    console.log('👩‍⚕️ Nurse registration request received');
    console.log('📋 Request body:', JSON.stringify(req.body, null, 2));

    // Map documents from RegistrationService format to expected format
    const { documents } = req.body;
    if (documents) {
      if (documents.nursing_degree) {
        req.body.nursingDegreeUrl = documents.nursing_degree;
      }
      if (documents.license_certificate) {
        req.body.licenseDocumentUrl = documents.license_certificate;
      }
      if (documents.identity_proof) {
        req.body.identityProofUrl = documents.identity_proof;
      }
    }

    const userData = req.body;
    const { uid } = userData;

    // Check if nurse already exists
    const existingNurse = await Nurse.findOne({ uid });
    if (existingNurse) {
      return res.status(400).json({ error: 'Nurse already registered' });
    }

    // Create new nurse user in Nurse model
    const newNurse = new Nurse({
      ...userData,
      status: 'active', // Changed from 'pending' to 'active' (valid enum value)
      isApproved: false,
      approvalStatus: 'pending',
      registrationDate: new Date(),
      // Ensure all required fields are present with defaults if missing
      shifts: userData.shifts || [],
      currentHospital: userData.currentHospital || userData.hospitalAffiliation || '',
      role: userData.role || 'Staff',
      bio: userData.bio || '',
      education: userData.education || userData.qualification || '',
      workingHours: userData.workingHours || {},
      nursingDegreeUrl: userData.nursingDegreeUrl || userData.licenseDocumentUrl || '',
      identityProofUrl: userData.identityProofUrl || '',
      // Ensure affiliatedHospitals is properly formatted
      affiliatedHospitals: userData.affiliatedHospitals || [],
    });

    const savedNurse = await newNurse.save();

    // Send registration confirmation email
    try {
      await sendRegistrationConfirmation(
        savedNurse.email, 
        savedNurse.fullName, 
        'nurse'
      );
      console.log('✅ Registration confirmation email sent to nurse');
    } catch (emailError) {
      console.error('❌ Error sending registration confirmation email:', emailError);
    }

    res.status(201).json({
      success: true,
      message: 'Nurse registration successful',
      data: savedNurse,
      arcId: savedNurse.arcId,
    });
  } catch (error) {
    console.error('Nurse registration error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Nurse registration failed',
      details: error.message 
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
    // Add explicit type for client routing
    const nurseData = nurse.toObject();
    nurseData.type = 'nurse';
    res.json({
      success: true,
      data: nurseData
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
    // Add explicit type for client routing
    const nurseData = nurse.toObject();
    nurseData.type = 'nurse';
    res.json({
      success: true,
      data: nurseData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get nurse',
      error: error.message
    });
  }
};

// Get nurse by email
const getNurseByEmail = async (req, res) => {
  try {
    const { email } = req.params;
    const nurse = await Nurse.findOne({ email: email });
    if (!nurse) {
      return res.status(404).json({
        success: false,
        message: 'Nurse not found'
      });
    }
    // Add explicit type for client routing
    const nurseData = nurse.toObject();
    nurseData.type = 'nurse';
    res.json({
      success: true,
      data: nurseData
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
    const nursesWithType = nurses.map(n => {
      const data = n.toObject();
      data.type = 'nurse';
      return data;
    });
    res.json({
      success: true,
      data: nursesWithType
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get nurses',
      error: error.message
    });
  }
};

// Update nurse profile by UID
const updateNurseProfile = async (req, res) => {
  try {
    const { uid } = req.params;
    const updates = req.body;

    console.log(`👩‍⚕️ Updating nurse profile for UID: ${uid}`);
    console.log('📋 Updates:', JSON.stringify(updates, null, 2));

    const nurse = await Nurse.findOneAndUpdate(
      { uid },
      { ...updates, updatedAt: new Date() },
      { new: true }
    );

    if (!nurse) {
      return res.status(404).json({
        success: false,
        error: 'Nurse not found'
      });
    }

    console.log('✅ Nurse profile updated successfully');
    res.json({
      success: true,
      message: 'Nurse profile updated successfully',
      data: nurse
    });
  } catch (error) {
    console.error('❌ Error updating nurse profile:', error);
    res.status(500).json({
      success: false,
      error: 'Error updating nurse profile',
      message: error.message
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

    // Send approval email
    try {
      await sendApprovalEmail(nurse.email, nurse.fullName, 'nurse', true, notes);
      console.log('✅ Approval email sent to nurse');
    } catch (emailError) {
      console.error('❌ Error sending approval email:', emailError);
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

    // Send rejection email
    try {
      await sendApprovalEmail(nurse.email, nurse.fullName, 'nurse', false, reason);
      console.log('✅ Rejection email sent to nurse');
    } catch (emailError) {
      console.error('❌ Error sending rejection email:', emailError);
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

// Get pending approvals for staff
const getPendingApprovalsForStaff = async (req, res) => {
  try {
    const pendingNurses = await Nurse.find({ 
      isApproved: false, 
      approvalStatus: 'pending' 
    }).select('-__v').sort({ createdAt: -1 });

    res.json({
      success: true,
      data: pendingNurses,
      count: pendingNurses.length
    });
  } catch (error) {
    console.error('Error fetching pending approvals for staff:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pending approvals'
    });
  }
};

// Approve nurse by staff
const approveNurseByStaff = async (req, res) => {
  try {
    const { nurseId } = req.params;
    const { approvedBy, notes } = req.body;
    
    console.log(`🔍 Approving nurse with ID: ${nurseId}`);
    console.log(`📝 Approval notes: ${notes}`);
    console.log(`👤 Approved by: ${approvedBy}`);
    
    // Try to find nurse by either Firebase uid or Mongo _id
    let nurse = null;
    try {
      const mongoose = require('mongoose');
      const isObjectId = mongoose.isValidObjectId(nurseId);
      console.log('🔎 Lookup strategy:', isObjectId ? 'by _id' : 'by uid');
      if (isObjectId) {
        nurse = await Nurse.findById(nurseId);
      }
      if (!nurse) {
        nurse = await Nurse.findOne({ uid: nurseId });
      }
    } catch (lookupErr) {
      console.error('❌ Lookup error, trying uid fallback:', lookupErr);
      nurse = await Nurse.findOne({ uid: nurseId });
    }
    
    if (!nurse) {
      console.log(`❌ Nurse not found with ID: ${nurseId}`);
      return res.status(404).json({
        success: false,
        error: 'Nurse not found'
      });
    }

    console.log(`✅ Found nurse: ${nurse.fullName} (${nurse.email})`);
    console.log(`📊 Current status: ${nurse.status}, isApproved: ${nurse.isApproved}, approvalStatus: ${nurse.approvalStatus}`);

    // Update approval status (make idempotent)
    const wasAlreadyApproved = nurse.isApproved && nurse.approvalStatus === 'approved' && nurse.status === 'active';
    
    if (!wasAlreadyApproved) {
      nurse.isApproved = true;
      nurse.approvalStatus = 'approved';
      nurse.status = 'active';
      nurse.approvedAt = new Date();
      nurse.approvedBy = approvedBy || 'staff';
      nurse.approvalNotes = notes || 'Approved by staff';
      
      await nurse.save();
      console.log(`✅ Nurse approval status updated successfully`);
    } else {
      console.log(`ℹ️ Nurse was already approved, no changes made`);
    }

    // Send approval email (only if not already approved)
    if (!wasAlreadyApproved) {
      try {
        await sendApprovalEmail(nurse.email, nurse.fullName, 'nurse', true, notes);
        console.log('✅ Approval email sent to nurse');
      } catch (emailError) {
        console.error('❌ Error sending approval email:', emailError);
        // Don't fail the request if email fails
      }
    }
    
    res.json({
      success: true,
      message: wasAlreadyApproved ? 'Nurse was already approved' : 'Nurse approved successfully',
      data: {
        _id: nurse._id,
        uid: nurse.uid,
        fullName: nurse.fullName,
        email: nurse.email,
        status: nurse.status,
        isApproved: nurse.isApproved,
        approvalStatus: nurse.approvalStatus,
        approvedAt: nurse.approvedAt,
        approvedBy: nurse.approvedBy
      }
    });
  } catch (error) {
    console.error('❌ Error approving nurse by staff:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to approve nurse',
      details: error.message
    });
  }
};

// Reject nurse by staff
const rejectNurseByStaff = async (req, res) => {
  try {
    const { nurseId } = req.params;
    const { rejectedBy, reason, category, nextSteps } = req.body;
    
    const nurse = await Nurse.findById(nurseId);
    if (!nurse) {
      return res.status(404).json({
        success: false,
        error: 'Nurse not found'
      });
    }

    // Update rejection status
    nurse.isApproved = false;
    nurse.approvalStatus = 'rejected';
    nurse.rejectedAt = new Date();
    nurse.rejectedBy = rejectedBy || 'staff';
    nurse.rejectionReason = reason;
    nurse.rejectionCategory = category;
    nurse.nextSteps = nextSteps;
    
    await nurse.save();

    // Send rejection email
    try {
      await sendApprovalEmail(nurse.email, nurse.fullName, 'nurse', false, reason);
      console.log('✅ Rejection email sent to nurse');
    } catch (emailError) {
      console.error('❌ Error sending rejection email:', emailError);
    }
    
    res.json({
      success: true,
      message: 'Nurse rejected successfully',
      data: nurse
    });
  } catch (error) {
    console.error('Error rejecting nurse by staff:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reject nurse'
    });
  }
};

// Get nurses by affiliation (hospital Mongo _id)
const getNursesByAffiliation = async (req, res) => {
  try {
    const { hospitalId } = req.params;
    const nurses = await Nurse.find({
      isApproved: true,
      approvalStatus: 'approved',
      status: 'active',
      'affiliatedHospitals.hospitalId': hospitalId,
    }).select('-__v').sort({ createdAt: -1 });

    res.json({ success: true, data: nurses, count: nurses.length });
  } catch (error) {
    console.error('Error fetching nurses by affiliation:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch nurses by affiliation' });
  }
};

// Associate a nurse to the current hospital by ARC ID
const associateNurseByArcId = async (req, res) => {
  try {
    const firebaseUser = req.user;
    if (!firebaseUser || !firebaseUser.uid) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { arcId } = req.body;
    if (!arcId) {
      return res.status(400).json({ success: false, error: 'arcId is required' });
    }

    const Hospital = require('../models/Hospital');
    const Nurse = require('../models/Nurse');

    // Find hospital by Firebase UID
    const hospital = await Hospital.findOne({ uid: firebaseUser.uid });
    if (!hospital) {
      return res.status(404).json({ success: false, error: 'Hospital not found' });
    }

    // Find nurse by arcId
    const nurse = await Nurse.findOne({ arcId });
    if (!nurse) {
      return res.status(404).json({ success: false, error: 'Nurse not found' });
    }

    // Ensure nurse is active and approved
    if (!(nurse.status === 'active' && nurse.isApproved && nurse.approvalStatus === 'approved')) {
      return res.status(400).json({ success: false, error: 'Nurse is not active and approved' });
    }

    // Check if already affiliated
    const already = (nurse.affiliatedHospitals || []).some(h => String(h.hospitalId) === String(hospital._id));
    if (!already) {
      nurse.affiliatedHospitals = nurse.affiliatedHospitals || [];
      nurse.affiliatedHospitals.push({
        hospitalId: String(hospital._id),
        hospitalName: hospital.hospitalName,
        role: 'Staff',
        startDate: new Date(),
        isActive: true,
      });
      await nurse.save();
    }

    return res.json({ success: true, message: 'Nurse associated successfully', data: nurse });
  } catch (error) {
    console.error('Error associating nurse by ARC ID:', error);
    return res.status(500).json({ success: false, error: 'Failed to associate nurse', details: error.message });
  }
};

// Update nurse shift for a given hospital (identified by current Firebase user)
// Accepts nurseId (uid or Mongo _id) as route param
// Body: { shiftType: 'morning'|'evening'|'night'|'custom', startTime: 'HH:mm', endTime: 'HH:mm' }
const updateNurseShift = async (req, res) => {
  try {
    const firebaseUser = req.user;
    if (!firebaseUser || !firebaseUser.uid) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { nurseId } = req.params;
    const { shiftType, startTime, endTime } = req.body || {};

    if (!shiftType) {
      return res.status(400).json({ success: false, error: 'shiftType is required' });
    }

    const Hospital = require('../models/Hospital');

    // Find current hospital by Firebase UID
    const hospital = await Hospital.findOne({ uid: firebaseUser.uid });
    if (!hospital) {
      return res.status(404).json({ success: false, error: 'Hospital not found' });
    }

    // Find nurse by uid first, then by _id
    let nurse = await Nurse.findOne({ uid: nurseId });
    if (!nurse) {
      const mongoose = require('mongoose');
      if (mongoose.isValidObjectId(nurseId)) {
        nurse = await Nurse.findById(nurseId);
      }
    }

    if (!nurse) {
      return res.status(404).json({ success: false, error: 'Nurse not found' });
    }

    // Ensure affiliation exists for this hospital
    const hospitalIdString = String(hospital._id);
    nurse.affiliatedHospitals = nurse.affiliatedHospitals || [];
    let affiliation = nurse.affiliatedHospitals.find(
      (a) => String(a.hospitalId) === hospitalIdString
    );
    if (!affiliation) {
      nurse.affiliatedHospitals.push({
        hospitalId: hospitalIdString,
        hospitalName: hospital.hospitalName,
        role: 'Staff',
        startDate: new Date(),
        isActive: true,
      });
    }

    // Upsert shift entry per hospital
    nurse.shifts = nurse.shifts || [];
    const existingShiftIndex = nurse.shifts.findIndex(
      (s) => String(s.hospitalId) === hospitalIdString
    );
    const shiftData = {
      hospitalId: hospitalIdString,
      hospitalName: hospital.hospitalName,
      shiftType,
      startTime: startTime || null,
      endTime: endTime || null,
      isActive: true,
      updatedAt: new Date(),
    };
    if (existingShiftIndex >= 0) {
      nurse.shifts[existingShiftIndex] = { ...nurse.shifts[existingShiftIndex], ...shiftData };
    } else {
      nurse.shifts.push(shiftData);
    }

    await nurse.save();

    return res.json({ success: true, message: 'Nurse shift updated successfully', data: nurse });
  } catch (error) {
    console.error('Error updating nurse shift:', error);
    return res.status(500).json({ success: false, error: 'Failed to update nurse shift' });
  }
};

module.exports = {
  registerNurse,
  getNurseById,
  getNurseByUID,
  getNurseByEmail,
  getAllNurses,
  updateNurseProfile,
  updateNurse,
  deleteNurse,
  getNursesByHospital,
  getNursesByQualification,
  getPendingApprovals,
  approveNurse,
  rejectNurse,
  getPendingApprovalsForStaff,
  approveNurseByStaff,
  rejectNurseByStaff,
  getNursesByAffiliation,
  associateNurseByArcId,
  updateNurseShift,
}; 