const Hospital = require('../models/Hospital');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const { 
  sendRegistrationConfirmation, 
  sendApprovalEmail, 
  sendWelcomeEmail 
} = require('../services/emailService');

const REQUIRED_HOSPITAL_FIELDS = [
  'fullName', 'email', 'mobileNumber', 'hospitalName', 'registrationNumber', 'hospitalType', 'address', 'city', 'state', 'pincode', 'numberOfBeds', 'departments', 'licenseDocumentUrl'
];

// Email service imported from centralized service

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
    console.log('📋 Documents received:', documents);
    console.log('📋 Documents type:', typeof documents);
    console.log('📋 Documents keys:', documents ? Object.keys(documents) : 'No documents');
    
    if (documents) {
      if (documents.hospital_license) {
        req.body.licenseDocumentUrl = documents.hospital_license;
        console.log('✅ Mapped hospital_license to licenseDocumentUrl:', documents.hospital_license);
      } else {
        console.log('❌ hospital_license not found in documents');
        // Try to find licenseDocumentUrl in the main body as fallback
        if (req.body.licenseDocumentUrl) {
          console.log('✅ Found licenseDocumentUrl in main body as fallback');
        } else {
          console.log('❌ No licenseDocumentUrl found anywhere');
        }
      }
      if (documents.registration_certificate) {
        req.body.registrationCertificateUrl = documents.registration_certificate;
        console.log('✅ Mapped registration_certificate to registrationCertificateUrl');
      }
      if (documents.building_permit) {
        req.body.buildingPermitUrl = documents.building_permit;
        console.log('✅ Mapped building_permit to buildingPermitUrl');
      }
    } else {
      console.log('❌ No documents object found in request body');
      // Try to find licenseDocumentUrl in the main body as fallback
      if (req.body.licenseDocumentUrl) {
        console.log('✅ Found licenseDocumentUrl in main body as fallback');
      } else {
        console.log('❌ No licenseDocumentUrl found anywhere');
      }
    }
    
    console.log('📋 Request body after document mapping:', JSON.stringify(req.body, null, 2));
    
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
    
    // Send registration confirmation email
    try {
      await sendRegistrationConfirmation(
        hospital.email || req.body.email, 
        hospital.hospitalName || req.body.hospitalName, 
        'hospital'
      );
      console.log('✅ Registration confirmation email sent');
    } catch (emailError) {
      console.error('❌ Error sending registration confirmation email:', emailError);
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
    try {
      await sendApprovalEmail(hospital.email, hospital.hospitalName, 'hospital', true, '');
      console.log('✅ Approval email sent to hospital');
    } catch (emailError) {
      console.error('❌ Error sending approval email:', emailError);
    }
    
    // Send welcome email
    try {
      await sendWelcomeEmail(hospital.email, hospital.hospitalName, 'hospital');
      console.log('✅ Welcome email sent to hospital');
    } catch (emailError) {
      console.error('❌ Error sending welcome email:', emailError);
    }
    
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
    await sendApprovalEmail(hospital.email, hospital.hospitalName, 'hospital', false, reason);
    
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
    try {
      await sendApprovalEmail(hospital.email, hospital.hospitalName, 'hospital', status === 'approved', notes);
      console.log('✅ Status update email sent to hospital');
    } catch (emailError) {
      console.error('❌ Error sending status update email:', emailError);
    }
    
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

exports.getHospitalByEmail = async (req, res) => {
  try {
    const { email } = req.params;
    const hospital = await Hospital.findOne({ email: email });
    
    if (!hospital) {
      return res.status(404).json({ 
        success: false, 
        error: 'Hospital not found' 
      });
    }
    
    res.json({
      success: true,
      data: hospital
    });
  } catch (err) {
    console.error('Error getting hospital by email:', err);
    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
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

// Get pending approvals for staff
exports.getPendingApprovalsForStaff = async (req, res) => {
  try {
    const pendingHospitals = await Hospital.find({ 
      isApproved: false, 
      approvalStatus: 'pending' 
    }).select('-__v').sort({ createdAt: -1 });

    res.json({
      success: true,
      data: pendingHospitals,
      count: pendingHospitals.length
    });
  } catch (error) {
    console.error('Error fetching pending approvals for staff:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pending approvals'
    });
  }
};

// Approve hospital by staff
exports.approveHospitalByStaff = async (req, res) => {
  try {
    const { hospitalId } = req.params;
    const { approvedBy, notes } = req.body;
    
    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) {
      return res.status(404).json({
        success: false,
        error: 'Hospital not found'
      });
    }

    // Update approval status
    hospital.isApproved = true;
    hospital.approvalStatus = 'approved';
    hospital.approvedAt = new Date();
    hospital.approvedBy = approvedBy || 'staff';
    hospital.approvalNotes = notes || 'Approved by staff';
    
    await hospital.save();

    // Send approval email
    try {
      await sendApprovalEmail(hospital.email, hospital.hospitalName, 'hospital', true, notes);
      console.log('✅ Approval email sent to hospital');
    } catch (emailError) {
      console.error('❌ Error sending approval email:', emailError);
    }
    
    res.json({
      success: true,
      message: 'Hospital approved successfully',
      data: hospital
    });
  } catch (error) {
    console.error('Error approving hospital by staff:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to approve hospital'
    });
  }
};

// Reject hospital by staff
exports.rejectHospitalByStaff = async (req, res) => {
  try {
    const { hospitalId } = req.params;
    const { rejectedBy, reason, category, nextSteps } = req.body;
    
    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) {
      return res.status(404).json({
        success: false,
        error: 'Hospital not found'
      });
    }

    // Update rejection status
    hospital.isApproved = false;
    hospital.approvalStatus = 'rejected';
    hospital.rejectedAt = new Date();
    hospital.rejectedBy = rejectedBy || 'staff';
    hospital.rejectionReason = reason;
    hospital.rejectionCategory = category;
    hospital.nextSteps = nextSteps;
    
    await hospital.save();

    // Send rejection email
    try {
      await sendApprovalEmail(hospital.email, hospital.hospitalName, 'hospital', false, reason);
      console.log('✅ Rejection email sent to hospital');
    } catch (emailError) {
      console.error('❌ Error sending rejection email:', emailError);
    }
    
    res.json({
      success: true,
      message: 'Hospital rejected successfully',
      data: hospital
    });
  } catch (error) {
    console.error('Error rejecting hospital by staff:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reject hospital'
    });
  }
};

// Get nearby hospitals for SOS based on location
exports.getNearbyHospitals = async (req, res) => {
  try {
    const { latitude, longitude, city, pincode, radius = 10 } = req.query;
    const firebaseUser = req.user;
    
    if (!firebaseUser || !firebaseUser.uid) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    console.log('🏥 Fetching nearby hospitals for SOS');
    console.log('📍 Location params:', { latitude, longitude, city, pincode, radius });

    let query = { isApproved: true, status: 'active' };
    
    // If coordinates are provided, use them for proximity search
    if (latitude && longitude) {
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      const radiusKm = parseFloat(radius);
      
      // Find hospitals within the specified radius
      // Note: This is a simplified approach. For production, consider using MongoDB's $geoNear
      const hospitals = await Hospital.find(query);
      
      // Filter hospitals by distance
      const hospitalsWithDistance = hospitals
        .map(hospital => {
          if (hospital.geoCoordinates && hospital.geoCoordinates.lat && hospital.geoCoordinates.lng) {
            const distance = _calculateDistance(
              lat, lng, 
              hospital.geoCoordinates.lat, hospital.geoCoordinates.lng
            );
            return { ...hospital.toObject(), distance };
          }
          return null;
        })
        .where((hospital) => hospital != null && hospital.distance <= radiusKm)
        .sort((a, b) => a.distance - b.distance);
      
      console.log(`✅ Found ${hospitalsWithDistance.length} hospitals within ${radiusKm}km`);
      
      res.json({
        success: true,
        data: hospitalsWithDistance,
        count: hospitalsWithDistance.length
      });
    } else if (city || pincode) {
      // Fallback to city/pincode search
      if (city) query.city = { $regex: city, $options: 'i' };
      if (pincode) query.pincode = pincode;
      
      const hospitals = await Hospital.find(query);
      console.log(`✅ Found ${hospitals.length} hospitals by city/pincode`);
      
      res.json({
        success: true,
        data: hospitals,
        count: hospitals.length
      });
    } else {
      // Return all approved hospitals if no location specified
      const hospitals = await Hospital.find(query).limit(20);
      console.log(`✅ Found ${hospitals.length} approved hospitals`);
      
      res.json({
        success: true,
        data: hospitals,
        count: hospitals.length
      });
    }
  } catch (error) {
    console.error('❌ Error fetching nearby hospitals:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch nearby hospitals'
    });
  }
};

// Helper function to calculate distance between two coordinates (Haversine formula)
function _calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = _toRadians(lat2 - lat1);
  const dLon = _toRadians(lon2 - lon1);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(_toRadians(lat1)) * Math.cos(_toRadians(lat2)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function _toRadians(degrees) {
  return degrees * (Math.PI / 180);
}