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
      status: userData.status || 'pending',
      isApproved: false,
      approvalStatus: 'pending',
      registrationDate: new Date(),
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