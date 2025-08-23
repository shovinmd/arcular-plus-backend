const Hospital = require('../models/Hospital');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const nodemailer = require('nodemailer');

const REQUIRED_HOSPITAL_FIELDS = [
  'fullName', 'email', 'mobileNumber', 'hospitalName', 'registrationNumber', 'hospitalType', 'address', 'city', 'state', 'pincode', 'numberOfBeds', 'departments', 'licenseDocumentUrl'
];

// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'your-email@gmail.com',
    pass: process.env.EMAIL_PASS || 'your-app-password'
  }
});

// Send approval email
const sendApprovalEmail = async (hospitalEmail, hospitalName, isApproved, reason = '') => {
  try {
    const subject = isApproved ? 'Hospital Registration Approved' : 'Hospital Registration Update';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center;">
          <h1>Arcular Plus</h1>
          <h2>${subject}</h2>
        </div>
        <div style="padding: 20px;">
          <p>Dear ${hospitalName},</p>
          ${isApproved ? 
            '<p>Congratulations! Your hospital registration has been approved. You can now access your hospital dashboard and start using all features.</p>' :
            `<p>We regret to inform you that your hospital registration requires additional information.</p>
             <p><strong>Reason:</strong> ${reason}</p>
             <p>Please update your registration details and resubmit for approval.</p>`
          }
          <p>Best regards,<br>Arcular Plus Team</p>
        </div>
      </div>
    `;
    
    await transporter.sendMail({
      from: process.env.EMAIL_USER || 'your-email@gmail.com',
      to: hospitalEmail,
      subject: subject,
      html: html
    });
  } catch (error) {
    console.error('Error sending approval email:', error);
  }
};

// Helper function to validate required fields
const validateRequiredFields = (body) => {
  const missingFields = [];
  
  console.log('🔍 Validating fields:', Object.keys(body));
  console.log('📋 Required fields:', REQUIRED_HOSPITAL_FIELDS);
  
  for (const field of REQUIRED_HOSPITAL_FIELDS) {
    const value = body[field];
    console.log(`🔍 Checking field '${field}':`, value, `(type: ${typeof value})`);
    
    // Special handling for different field types
    if (field === 'numberOfBeds') {
      // numberOfBeds can be 0, so check if it's defined and is a number
      if (value === undefined || value === null || typeof value !== 'number') {
        missingFields.push(field);
        console.log(`❌ Missing ${field}: value is ${value} (type: ${typeof value})`);
      }
    } else if (field === 'departments') {
      // departments should be an array with at least one item
      if (!Array.isArray(value) || value.length === 0) {
        missingFields.push(field);
        console.log(`❌ Missing ${field}: value is ${value} (type: ${typeof value})`);
      }
    } else if (field === 'licenseDocumentUrl') {
      // licenseDocumentUrl should be a non-empty string
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        missingFields.push(field);
        console.log(`❌ Missing ${field}: value is ${value} (type: ${typeof value})`);
      }
    } else {
      // For string fields, check if they exist and are not empty
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        missingFields.push(field);
        console.log(`❌ Missing ${field}: value is ${value} (type: ${typeof value})`);
      }
    }
  }
  
  console.log('❌ Missing fields:', missingFields);
  return missingFields;
};

exports.registerHospital = async (req, res) => {
  try {
    const firebaseUser = req.user; // set by auth middleware
    if (!firebaseUser || !firebaseUser.uid) {
      return res.status(400).json({ error: 'Invalid Firebase user' });
    }
    
    console.log('🏥 Hospital registration request received');
    console.log('📋 Request body:', JSON.stringify(req.body, null, 2));
    
    // Map documents from RegistrationService format to expected format
    const { documents } = req.body;
    if (documents) {
      if (documents.hospital_license) {
        req.body.licenseDocumentUrl = documents.hospital_license;
      }
      if (documents.registration_certificate) {
        req.body.registrationCertificateUrl = documents.registration_certificate;
      }
      if (documents.building_permit) {
        req.body.buildingPermitUrl = documents.building_permit;
      }
    }
    
    // Validate required fields with proper handling
    const missingFields = validateRequiredFields(req.body);
    if (missingFields.length > 0) {
      console.log('❌ Missing fields:', missingFields);
      return res.status(400).json({ 
        error: `Missing required fields: ${missingFields.join(', ')}` 
      });
    }
    
    console.log('✅ All required fields present');
    
    let hospital = await Hospital.findOne({ uid: firebaseUser.uid });
    
    if (!hospital) {
      // Generate Arc ID
      const arcId = 'ARC-' + uuidv4().slice(0, 8).toUpperCase();
      // Generate QR code (using Arc ID)
      const qrCode = await QRCode.toDataURL(arcId);
      
      hospital = new Hospital({
        uid: firebaseUser.uid,
        ...req.body,
        arcId,
        qrCode,
        status: 'pending',
        isApproved: false,
        approvalStatus: 'pending',
        createdAt: new Date(),
      });
      await hospital.save();
      console.log('✅ New hospital created:', hospital.hospitalName);
    } else {
      Object.assign(hospital, req.body);
      hospital.status = 'pending';
      hospital.isApproved = false;
      hospital.approvalStatus = 'pending';
      if (!hospital.arcId) {
        hospital.arcId = 'ARC-' + uuidv4().slice(0, 8).toUpperCase();
      }
      if (!hospital.qrCode && hospital.arcId) {
        hospital.qrCode = await QRCode.toDataURL(hospital.arcId);
      }
      await hospital.save();
      console.log('✅ Existing hospital updated:', hospital.hospitalName);
    }
    
    res.json(hospital);
  } catch (err) {
    console.error('❌ Hospital registration error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get all pending hospitals for admin approval
exports.getPendingHospitals = async (req, res) => {
  try {
    const hospitals = await Hospital.find({ 
      approvalStatus: 'pending' 
    }).sort({ createdAt: -1 });
    
    res.json(hospitals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get all hospitals with approval status
exports.getAllHospitals = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const query = {};
    
    if (status) {
      query.approvalStatus = status;
    }
    
    const hospitals = await Hospital.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Hospital.countDocuments(query);
    
    res.json({
      hospitals,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Approve a hospital
exports.approveHospital = async (req, res) => {
  try {
    const { hospitalId } = req.params;
    const { approvedBy, notes } = req.body;
    
    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) {
      return res.status(404).json({ error: 'Hospital not found' });
    }
    
    hospital.isApproved = true;
    hospital.approvalStatus = 'approved';
    hospital.status = 'active';
    hospital.approvedBy = approvedBy;
    hospital.approvedAt = new Date();
    hospital.approvalNotes = notes;
    
    await hospital.save();
    
    // Send approval email
    await sendApprovalEmail(hospital.email, hospital.hospitalName, true);
    
    res.json({ 
      message: 'Hospital approved successfully',
      hospital 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Reject a hospital
exports.rejectHospital = async (req, res) => {
  try {
    const { hospitalId } = req.params;
    const { rejectedBy, reason } = req.body;
    
    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) {
      return res.status(404).json({ error: 'Hospital not found' });
    }
    
    hospital.isApproved = false;
    hospital.approvalStatus = 'rejected';
    hospital.status = 'inactive';
    hospital.rejectedBy = rejectedBy;
    hospital.rejectedAt = new Date();
    hospital.rejectionReason = reason;
    
    await hospital.save();
    
    // Send rejection email
    await sendApprovalEmail(hospital.email, hospital.hospitalName, false, reason);
    
    res.json({ 
      message: 'Hospital rejected successfully',
      hospital 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update hospital approval status
exports.updateApprovalStatus = async (req, res) => {
  try {
    const { hospitalId } = req.params;
    const { status, notes, updatedBy } = req.body;
    
    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) {
      return res.status(404).json({ error: 'Hospital not found' });
    }
    
    hospital.approvalStatus = status;
    hospital.status = status === 'approved' ? 'active' : 'inactive';
    
    if (status === 'approved') {
      hospital.isApproved = true;
      hospital.approvedBy = updatedBy;
      hospital.approvedAt = new Date();
      hospital.approvalNotes = notes;
    } else if (status === 'rejected') {
      hospital.isApproved = false;
      hospital.rejectedBy = updatedBy;
      hospital.rejectedAt = new Date();
      hospital.rejectionReason = notes;
    }
    
    await hospital.save();
    
    // Send email notification
    await sendApprovalEmail(hospital.email, hospital.hospitalName, status === 'approved', notes);
    
    res.json({ 
      message: `Hospital status updated to ${status}`,
      hospital 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get hospital approval status
exports.getHospitalApprovalStatus = async (req, res) => {
  try {
    const { uid } = req.params;
    const hospital = await Hospital.findOne({ uid });
    
    if (!hospital) {
      return res.status(404).json({ error: 'Hospital not found' });
    }
    
    res.json({
      isApproved: hospital.isApproved,
      approvalStatus: hospital.approvalStatus,
      status: hospital.status,
      approvedBy: hospital.approvedBy,
      approvedAt: hospital.approvedAt,
      approvalNotes: hospital.approvalNotes,
      rejectedBy: hospital.rejectedBy,
      rejectedAt: hospital.rejectedAt,
      rejectionReason: hospital.rejectionReason
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getHospitalProfile = async (req, res) => {
  try {
    const { uid } = req.params;
    const hospital = await Hospital.findOne({ uid });
    
    if (!hospital) {
      return res.status(404).json({ error: 'Hospital not found' });
    }
    
    res.json(hospital);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateHospitalProfile = async (req, res) => {
  try {
    const { uid } = req.params;
    const updateData = req.body;
    const hospital = await Hospital.findOne({ uid });
    if (!hospital) {
      return res.status(404).json({ error: 'Hospital not found' });
    }
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        hospital[key] = updateData[key];
      }
    });
    if (!hospital.arcId) {
      hospital.arcId = 'ARC-' + uuidv4().slice(0, 8).toUpperCase();
    }
    if (!hospital.qrCode && hospital.arcId) {
      hospital.qrCode = await QRCode.toDataURL(hospital.arcId);
    }
    await hospital.save();
    res.json(hospital);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Placeholder functions for future implementation
exports.getDoctors = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.addDoctor = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.removeDoctor = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.getDepartments = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.addDepartment = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.removeDepartment = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.getAppointments = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.createAppointment = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.updateAppointment = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.getAdmissions = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.admitPatient = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.updateAdmission = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.getPharmacyItems = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.addPharmacyItem = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.updatePharmacyItem = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.removePharmacyItem = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.getLabTests = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.addLabTest = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.updateLabTest = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.removeLabTest = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.getQrRecords = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.getAnalytics = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.getReports = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.getChatMessages = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.sendChatMessage = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.getShifts = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.createShift = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.updateShift = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.deleteShift = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.getBilling = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.createBillingEntry = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.getDocuments = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.uploadDocument = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.getNotifications = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.updateSettings = async (req, res) => res.status(501).json({ error: 'Not implemented' });