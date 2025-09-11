const Lab = require('../models/Lab');
const { sendRegistrationConfirmation, sendApprovalEmail } = require('../services/emailService');

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
    const existingLab = await Lab.findOne({ uid });
    if (existingLab) {
      return res.status(400).json({ error: 'Lab already registered' });
    }

    // Create new lab user in Lab model
    const newLab = new Lab({
      ...userData,
      status: 'active', // Changed from 'pending' to 'active' (valid enum value)
      isApproved: false,
      approvalStatus: 'pending',
      registrationDate: new Date(),
    });

    const savedLab = await newLab.save();

    // Send registration confirmation email
    try {
      await sendRegistrationConfirmation(
        savedLab.email, 
        savedLab.fullName, 
        'lab'
      );
      console.log('✅ Registration confirmation email sent to lab');
    } catch (emailError) {
      console.error('❌ Error sending registration confirmation email:', emailError);
    }

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

// Get lab by email
const getLabByEmail = async (req, res) => {
  try {
    const { email } = req.params;
    const lab = await Lab.findOne({ email: email });
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

// Search labs
const searchLabs = async (req, res) => {
  try {
    const { query, city, specialization } = req.query;
    
    let searchCriteria = {};
    
    if (query) {
      searchCriteria.$or = [
        { labName: { $regex: query, $options: 'i' } },
        { ownerName: { $regex: query, $options: 'i' } },
        { specialization: { $regex: query, $options: 'i' } }
      ];
    }
    
    if (city) {
      searchCriteria.city = { $regex: city, $options: 'i' };
    }
    
    if (specialization) {
      searchCriteria.specialization = { $regex: specialization, $options: 'i' };
    }
    
    // Only return approved labs
    searchCriteria.isApproved = true;
    
    const labs = await Lab.find(searchCriteria).limit(20);
    
    res.json({
      success: true,
      data: labs,
      count: labs.length
    });
  } catch (error) {
    console.error('Error searching labs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search labs',
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

    // Send approval email
    try {
      await sendApprovalEmail(lab.email, lab.fullName, 'lab', true, notes);
      console.log('✅ Approval email sent to lab');
    } catch (emailError) {
      console.error('❌ Error sending approval email:', emailError);
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

    // Send rejection email
    try {
      await sendApprovalEmail(lab.email, lab.fullName, 'lab', false, reason);
      console.log('✅ Rejection email sent to lab');
    } catch (emailError) {
      console.error('❌ Error sending rejection email:', emailError);
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

// Get pending approvals for staff
const getPendingApprovalsForStaff = async (req, res) => {
  try {
    const pendingLabs = await Lab.find({ 
      isApproved: false, 
      approvalStatus: 'pending' 
    }).select('-__v').sort({ createdAt: -1 });

    res.json({
      success: true,
      data: pendingLabs,
      count: pendingLabs.length
    });
  } catch (error) {
    console.error('Error fetching pending approvals for staff:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pending approvals'
    });
  }
};

// Approve lab by staff
const approveLabByStaff = async (req, res) => {
  try {
    const { labId } = req.params;
    const { approvedBy, notes } = req.body;
    
    console.log(`🔍 Approving lab with ID: ${labId}`);
    console.log(`📝 Approval notes: ${notes}`);
    console.log(`👤 Approved by: ${approvedBy}`);
    
    // Try to find lab by either Mongo _id or Firebase uid
    let lab = await Lab.findById(labId);
    if (!lab) {
      lab = await Lab.findOne({ uid: labId });
    }
    
    if (!lab) {
      console.log(`❌ Lab not found with ID: ${labId}`);
      return res.status(404).json({
        success: false,
        error: 'Lab not found'
      });
    }

    console.log(`✅ Found lab: ${lab.labName} (${lab.email})`);
    console.log(`📊 Current status: ${lab.status}, isApproved: ${lab.isApproved}, approvalStatus: ${lab.approvalStatus}`);

    // Update approval status (make idempotent)
    const wasAlreadyApproved = lab.isApproved && lab.approvalStatus === 'approved' && lab.status === 'active';
    
    if (!wasAlreadyApproved) {
      lab.isApproved = true;
      lab.approvalStatus = 'approved';
      lab.status = 'active';
      lab.approvedAt = new Date();
      lab.approvedBy = approvedBy || 'staff';
      lab.approvalNotes = notes || 'Approved by staff';
      
      await lab.save();
      console.log(`✅ Lab approval status updated successfully`);
    } else {
      console.log(`ℹ️ Lab was already approved, no changes made`);
    }

    // Send approval email (only if not already approved)
    if (!wasAlreadyApproved) {
      try {
        await sendApprovalEmail(lab.email, lab.labName, 'lab', true, notes);
        console.log('✅ Approval email sent to lab');
      } catch (emailError) {
        console.error('❌ Error sending approval email:', emailError);
        // Don't fail the request if email fails
      }
    }
    
    res.json({
      success: true,
      message: wasAlreadyApproved ? 'Lab was already approved' : 'Lab approved successfully',
      data: {
        _id: lab._id,
        uid: lab.uid,
        labName: lab.labName,
        email: lab.email,
        status: lab.status,
        isApproved: lab.isApproved,
        approvalStatus: lab.approvalStatus,
        approvedAt: lab.approvedAt,
        approvedBy: lab.approvedBy
      }
    });
  } catch (error) {
    console.error('❌ Error approving lab by staff:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to approve lab',
      details: error.message
    });
  }
};

// Reject lab by staff
const rejectLabByStaff = async (req, res) => {
  try {
    const { labId } = req.params;
    const { rejectedBy, reason, category, nextSteps } = req.body;
    
    const lab = await Lab.findById(labId);
    if (!lab) {
      return res.status(404).json({
        success: false,
        error: 'Lab not found'
      });
    }

    // Update rejection status
    lab.isApproved = false;
    lab.approvalStatus = 'rejected';
    lab.rejectedAt = new Date();
    lab.rejectedBy = rejectedBy || 'staff';
    lab.rejectionReason = reason;
    lab.rejectionCategory = category;
    lab.nextSteps = nextSteps;
    
    await lab.save();

    // Send rejection email
    try {
      await sendApprovalEmail(lab.email, lab.labName, 'lab', false, reason);
      console.log('✅ Rejection email sent to lab');
    } catch (emailError) {
      console.error('❌ Error sending rejection email:', emailError);
    }
    
    res.json({
      success: true,
      message: 'Lab rejected successfully',
      data: lab
    });
  } catch (error) {
    console.error('Error rejecting lab by staff:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reject lab'
    });
  }
};

// Get labs by affiliation (hospital Mongo _id)
const getLabsByAffiliation = async (req, res) => {
  try {
    const { hospitalId } = req.params;
    const labs = await Lab.find({
      isApproved: true,
      approvalStatus: 'approved',
      status: 'active',
      'affiliatedHospitals.hospitalId': hospitalId,
    }).select('-__v').sort({ createdAt: -1 });

    res.json({ success: true, data: labs, count: labs.length });
  } catch (error) {
    console.error('Error fetching labs by affiliation:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch labs by affiliation' });
  }
};

module.exports = {
  registerLab,
  getAllLabs,
  getLabById,
  getLabByUID,
  getLabByEmail,
  updateLab,
  deleteLab,
  getLabsByCity,
  getLabsByService,
  searchLabs,
  getPendingApprovals,
  approveLab,
  rejectLab,
  getPendingApprovalsForStaff,
  approveLabByStaff,
  rejectLabByStaff,
  getLabsByAffiliation,
}; 