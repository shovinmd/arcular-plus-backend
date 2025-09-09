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

const registerHospital = async (req, res) => {
  try {
    const firebaseUser = req.user; // set by auth middleware
    if (!firebaseUser || !firebaseUser.uid) {
      return res.status(400).json({ error: 'Invalid Firebase user' });
    }
    
    console.log('🏥 Hospital registration request received');
    console.log('📋 Request body:', JSON.stringify(req.body, null, 2));
    console.log('🌍 Location data - Longitude:', req.body.longitude, 'Latitude:', req.body.latitude);
    
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
      console.log('🌍 Stored coordinates - Longitude:', hospital.longitude, 'Latitude:', hospital.latitude);
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
      console.log('🌍 Updated coordinates - Longitude:', hospital.longitude, 'Latitude:', hospital.latitude);
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
const getPendingHospitals = async (req, res) => {
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
const getAllHospitals = async (req, res) => {
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
const approveHospital = async (req, res) => {
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
const rejectHospital = async (req, res) => {
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
const updateApprovalStatus = async (req, res) => {
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
const getHospitalApprovalStatus = async (req, res) => {
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

const getHospitalProfile = async (req, res) => {
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

const getHospitalByEmail = async (req, res) => {
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

const updateHospitalProfile = async (req, res) => {
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
const getDoctors = async (req, res) => res.status(501).json({ error: 'Not implemented' });
const addDoctor = async (req, res) => res.status(501).json({ error: 'Not implemented' });
const removeDoctor = async (req, res) => res.status(501).json({ error: 'Not implemented' });
const getDepartments = async (req, res) => res.status(501).json({ error: 'Not implemented' });
const addDepartment = async (req, res) => res.status(501).json({ error: 'Not implemented' });
const removeDepartment = async (req, res) => res.status(501).json({ error: 'Not implemented' });
const Appointment = require('../models/Appointment');
const User = require('../models/User');
const getAppointments = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const query = { hospitalId: id };
    const items = await Appointment.find(query)
      .sort({ appointmentDate: -1, appointmentTime: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    const total = await Appointment.countDocuments(query);
    return res.json({ success: true, data: items, pagination: { current: page, pages: Math.ceil(total / limit), total } });
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Failed to fetch appointments' });
  }
};
const createAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      userId,
      doctorId,
      appointmentDate,
      appointmentTime,
      reason,
      symptoms,
      medicalHistory,
      appointmentType = 'consultation'
    } = req.body;

    if (!userId || !doctorId || !appointmentDate || !appointmentTime) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const user = await User.findOne({ uid: userId });
    const doctor = await User.findOne({ uid: doctorId, type: 'doctor' });
    if (!user || !doctor) return res.status(404).json({ success: false, error: 'User/Doctor not found' });

    const exists = await Appointment.findOne({ doctorId, appointmentDate: new Date(appointmentDate), appointmentTime, appointmentStatus: { $in: ['pending', 'confirmed'] } });
    if (exists) return res.status(400).json({ success: false, error: 'This time slot is already booked' });

    const appointment = new Appointment({
      userId,
      userEmail: user.email,
      userName: user.fullName,
      userPhone: user.mobileNumber,
      doctorId,
      doctorName: doctor.fullName,
      doctorEmail: doctor.email,
      doctorPhone: doctor.mobileNumber,
      doctorSpecialization: doctor.specialization,
      doctorConsultationFee: doctor.consultationFee,
      hospitalId: id,
      hospitalName: req.hospital?.hospitalName || doctor.hospitalAffiliation,
      hospitalAddress: req.hospital?.address || doctor.address,
      appointmentDate: new Date(appointmentDate),
      appointmentTime,
      appointmentType,
      reason,
      symptoms,
      medicalHistory,
      consultationFee: doctor.consultationFee,
      paymentMethod: 'cash'
    });
    await appointment.save();
    return res.status(201).json({ success: true, message: 'Appointment booked successfully', data: appointment });
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Failed to create appointment' });
  }
};
const updateAppointment = async (req, res) => {
  try {
    const { id, appointmentId } = req.params;
    const { status } = req.body;
    const apt = await Appointment.findOne({ hospitalId: id, appointmentId });
    if (!apt) return res.status(404).json({ success: false, error: 'Appointment not found' });
    apt.appointmentStatus = status || apt.appointmentStatus;
    await apt.save();
    return res.json({ success: true, data: apt });
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Failed to update appointment' });
  }
};
const getAdmissions = async (req, res) => res.status(501).json({ error: 'Not implemented' });
const admitPatient = async (req, res) => res.status(501).json({ error: 'Not implemented' });
const updateAdmission = async (req, res) => res.status(501).json({ error: 'Not implemented' });
const getPharmacyItems = async (req, res) => res.status(501).json({ error: 'Not implemented' });
const addPharmacyItem = async (req, res) => res.status(501).json({ error: 'Not implemented' });
const updatePharmacyItem = async (req, res) => res.status(501).json({ error: 'Not implemented' });
const removePharmacyItem = async (req, res) => res.status(501).json({ error: 'Not implemented' });
const getLabTests = async (req, res) => res.status(501).json({ error: 'Not implemented' });
const addLabTest = async (req, res) => res.status(501).json({ error: 'Not implemented' });
const updateLabTest = async (req, res) => res.status(501).json({ error: 'Not implemented' });
const removeLabTest = async (req, res) => res.status(501).json({ error: 'Not implemented' });
const getQrRecords = async (req, res) => res.status(501).json({ error: 'Not implemented' });
const getAnalytics = async (req, res) => res.status(501).json({ error: 'Not implemented' });
const getReports = async (req, res) => res.status(501).json({ error: 'Not implemented' });
const getChatMessages = async (req, res) => res.status(501).json({ error: 'Not implemented' });
const sendChatMessage = async (req, res) => res.status(501).json({ error: 'Not implemented' });
const getShifts = async (req, res) => res.status(501).json({ error: 'Not implemented' });
const createShift = async (req, res) => res.status(501).json({ error: 'Not implemented' });
const updateShift = async (req, res) => res.status(501).json({ error: 'Not implemented' });
const deleteShift = async (req, res) => res.status(501).json({ error: 'Not implemented' });
const getBilling = async (req, res) => res.status(501).json({ error: 'Not implemented' });
const createBillingEntry = async (req, res) => res.status(501).json({ error: 'Not implemented' });
const getDocuments = async (req, res) => res.status(501).json({ error: 'Not implemented' });
const uploadDocument = async (req, res) => res.status(501).json({ error: 'Not implemented' });
const getNotifications = async (req, res) => res.status(501).json({ error: 'Not implemented' });
const updateSettings = async (req, res) => res.status(501).json({ error: 'Not implemented' });

// Get pending approvals for staff
const getPendingApprovalsForStaff = async (req, res) => {
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
const approveHospitalByStaff = async (req, res) => {
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
const rejectHospitalByStaff = async (req, res) => {
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
const getNearbyHospitals = async (req, res) => {
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

// Get approved hospitals for affiliation selection (public endpoint for registration)
const getApprovedHospitalsForAffiliation = async (req, res) => {
  try {
    console.log('🏥 Fetching approved hospitals for affiliation selection...');
    console.log('🔐 Auth status:', req.user ? 'Authenticated' : 'Public access');
    
    // First try to find approved hospitals
    let hospitals = await Hospital.find({
      isApproved: true,
      approvalStatus: 'approved',
      status: 'active'
    })
    .select('_id hospitalName city state hospitalType address pincode longitude latitude')
    .sort({ hospitalName: 1 });
    
    console.log(`✅ Found ${hospitals.length} approved hospitals`);
    
    // If no approved hospitals, try to find any hospitals with pending status
    if (hospitals.length === 0) {
      console.log('⚠️ No approved hospitals found, trying to find pending hospitals...');
      hospitals = await Hospital.find({
        status: { $in: ['active', 'pending'] }
      })
      .select('_id hospitalName city state hospitalType address pincode longitude latitude')
      .sort({ hospitalName: 1 });
      
      console.log(`✅ Found ${hospitals.length} hospitals (including pending)`);
    }
    
    // If still no hospitals, return empty array with success
    if (hospitals.length === 0) {
      console.log('⚠️ No hospitals found in database');
      return res.status(200).json({
        success: true,
        message: 'No hospitals available for affiliation',
        data: {
          hospitals: []
        }
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Hospitals fetched successfully',
      data: {
        hospitals: hospitals.map(hospital => ({
          id: hospital._id,
          name: hospital.hospitalName,
          city: hospital.city,
          state: hospital.state,
          type: hospital.hospitalType,
          address: hospital.address,
          pincode: hospital.pincode,
          location: {
            longitude: hospital.longitude,
            latitude: hospital.latitude
          }
        }))
      }
    });
  } catch (error) {
    console.error('❌ Error fetching hospitals for affiliation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch hospitals for affiliation',
      error: error.message
    });
  }
};

// Search hospitals for affiliation (public endpoint for registration)
const searchHospitalsForAffiliation = async (req, res) => {
  try {
    const { query, city, state } = req.query;
    console.log('🔍 Searching hospitals for affiliation:', { query, city, state });
    console.log('🔐 Auth status:', req.user ? 'Authenticated' : 'Public access');
    
    let searchCriteria = {
      isApproved: true,
      approvalStatus: 'approved',
      status: 'active'
    };
    
    // Add search conditions
    if (query) {
      searchCriteria.$or = [
        { hospitalName: { $regex: query, $options: 'i' } },
        { city: { $regex: query, $options: 'i' } },
        { state: { $regex: query, $options: 'i' } }
      ];
    }
    
    if (city) {
      searchCriteria.city = { $regex: city, $options: 'i' };
    }
    
    if (state) {
      searchCriteria.state = { $regex: state, $options: 'i' };
    }
    
    const hospitals = await Hospital.find(searchCriteria)
      .select('_id hospitalName city state hospitalType address pincode longitude latitude')
      .sort({ hospitalName: 1 })
      .limit(50); // Limit results for performance
    
    console.log(`✅ Found ${hospitals.length} hospitals matching search criteria`);
    
    res.status(200).json({
      success: true,
      message: 'Hospitals search completed successfully',
      data: {
        hospitals: hospitals.map(hospital => ({
          id: hospital._id,
          name: hospital.hospitalName,
          city: hospital.city,
          state: hospital.state,
          type: hospital.hospitalType,
          address: hospital.address,
          pincode: hospital.pincode,
          location: {
            longitude: hospital.longitude,
            latitude: hospital.latitude
          }
        }))
      }
    });
  } catch (error) {
    console.error('❌ Error searching hospitals:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search hospitals',
      error: error.message
    });
  }
};

// Public endpoint for QR code scanning - shows limited hospital info
const getHospitalByQr = async (req, res) => {
  try {
    const { identifier } = req.params;
    console.log('🏥 QR Scan Request - Raw Identifier:', identifier);
    
    // Try to parse JSON identifier first
    let parsedIdentifier = identifier;
    let extractedUid = null;
    let extractedEmail = null;
    
    try {
      // Check if identifier is JSON and extract uid/email
      if (identifier.startsWith('{') && identifier.includes('"uid"')) {
        const jsonData = JSON.parse(identifier);
        extractedUid = jsonData.uid;
        extractedEmail = jsonData.contactInfo?.email || jsonData.email;
        console.log('✅ Parsed JSON - UID:', extractedUid, 'Email:', extractedEmail);
      }
    } catch (parseError) {
      console.log('⚠️ Identifier is not valid JSON, using as-is');
    }
    
    // Try to find hospital by arcId first
    let hospital = await Hospital.findOne({ arcId: identifier });
    console.log('🔍 Search by arcId result:', hospital ? 'Found' : 'Not found');
    
    // If not found by arcId, try by extracted UID
    if (!hospital && extractedUid) {
      console.log('🔄 Trying to find by extracted UID:', extractedUid);
      hospital = await Hospital.findOne({ uid: extractedUid });
      console.log('🔍 Search by extracted UID result:', hospital ? 'Found' : 'Not found');
    }
    
    // If still not found, try by original identifier as UID
    if (!hospital) {
      console.log('🔄 Trying to find by original identifier as UID...');
      hospital = await Hospital.findOne({ uid: identifier });
      console.log('🔍 Search by original identifier as UID result:', hospital ? 'Found' : 'Not found');
    }
    
    // If still not found, try by extracted email
    if (!hospital && extractedEmail) {
      console.log('🔄 Trying to find by extracted email:', extractedEmail);
      hospital = await Hospital.findOne({ email: extractedEmail });
      console.log('🔍 Search by extracted email result:', hospital ? 'Found' : 'Not found');
    }
    
    // If still not found, try by original identifier as email
    if (!hospital) {
      console.log('🔄 Trying to find by original identifier as email...');
      hospital = await Hospital.findOne({ email: identifier });
      console.log('🔍 Search by original identifier as email result:', hospital ? 'Found' : 'Not found');
    }
    
    if (!hospital) {
      console.log('❌ Hospital not found by any method');
      
      // Debug: Check if any hospitals exist in database
      const totalHospitals = await Hospital.countDocuments();
      console.log('📊 Total hospitals in database:', totalHospitals);
      
      return res.status(404).json({ 
        error: 'Hospital not found',
        searchedFor: identifier,
        extractedUid: extractedUid,
        extractedEmail: extractedEmail,
        totalHospitalsInDatabase: totalHospitals,
        message: 'Hospital not found by QR code'
      });
    }

    console.log('✅ Hospital found:', hospital.hospitalName, 'ARC ID:', hospital.arcId);

    // Return only public hospital information for QR scanning
    const publicInfo = {
      uid: hospital.uid,
      arcId: hospital.arcId,
      fullName: hospital.fullName,
      hospitalName: hospital.hospitalName,
      hospitalType: hospital.hospitalType,
      registrationNumber: hospital.registrationNumber,
      address: hospital.address,
      city: hospital.city,
      state: hospital.state,
      pincode: hospital.pincode,
      mobileNumber: hospital.mobileNumber,
      alternateMobile: hospital.alternateMobile,
      email: hospital.email,
      hospitalEmail: hospital.hospitalEmail,
      hospitalPhone: hospital.hospitalPhone,
      hospitalAddress: hospital.hospitalAddress,
      numberOfBeds: hospital.numberOfBeds,
      departments: hospital.departments,
      specialFacilities: hospital.specialFacilities,
      hasPharmacy: hospital.hasPharmacy,
      hasLab: hospital.hasLab,
      profileImageUrl: hospital.profileImageUrl,
      approvalStatus: hospital.approvalStatus,
      isApproved: hospital.isApproved,
      type: hospital.type,
      // Don't include sensitive information like documents, internal IDs, etc.
    };

    console.log('📤 Returning public hospital info for QR scan');
    res.json(publicInfo);
    
  } catch (error) {
    console.error('❌ Error fetching hospital by QR:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

// Public endpoint for QR code scanning by UID - shows limited hospital info
const getHospitalByUid = async (req, res) => {
  try {
    const { uid } = req.params;

    console.log('🏥 UID Scan Request - Raw UID:', uid);
    
    // Try to parse JSON UID first
    let extractedUid = uid;
    
    try {
      // Check if UID is JSON and extract the actual UID
      if (uid.startsWith('{') && uid.includes('"uid"')) {
        const jsonData = JSON.parse(uid);
        extractedUid = jsonData.uid;
        console.log('✅ Parsed JSON UID - Extracted:', extractedUid);
      }
    } catch (parseError) {
      console.log('⚠️ UID is not valid JSON, using as-is');
    }
    
    console.log('🔍 Searching for hospital with UID:', extractedUid);
    const hospital = await Hospital.findOne({ uid: extractedUid });
    
    if (!hospital) {
      console.log('❌ Hospital not found by UID:', extractedUid);
      
      // Debug: Check if any hospitals exist in database
      const totalHospitals = await Hospital.countDocuments();
      console.log('📊 Total hospitals in database:', totalHospitals);
      
      // Debug: Check if the specific UID exists
      const hospitalExists = await Hospital.exists({ uid: extractedUid });
      console.log('🔍 Hospital exists check for UID:', extractedUid, 'Result:', hospitalExists);
      
      return res.status(404).json({ 
        error: 'Hospital not found',
        searchedFor: uid,
        extractedUid: extractedUid,
        totalHospitalsInDatabase: totalHospitals,
        hospitalExistsCheck: hospitalExists,
        message: 'Hospital not found by UID'
      });
    }

    console.log('✅ Hospital found by UID:', hospital.hospitalName, 'ARC ID:', hospital.arcId);

    // Return only public hospital information for QR scanning
    const publicInfo = {
      uid: hospital.uid,
      arcId: hospital.arcId,
      fullName: hospital.fullName,
      hospitalName: hospital.hospitalName,
      hospitalType: hospital.hospitalType,
      registrationNumber: hospital.registrationNumber,
      address: hospital.address,
      city: hospital.city,
      state: hospital.state,
      pincode: hospital.pincode,
      mobileNumber: hospital.mobileNumber,
      alternateMobile: hospital.alternateMobile,
      email: hospital.email,
      hospitalEmail: hospital.hospitalEmail,
      hospitalPhone: hospital.hospitalPhone,
      hospitalAddress: hospital.hospitalAddress,
      numberOfBeds: hospital.numberOfBeds,
      departments: hospital.departments,
      specialFacilities: hospital.specialFacilities,
      hasPharmacy: hospital.hasPharmacy,
      hasLab: hospital.hasLab,
      profileImageUrl: hospital.profileImageUrl,
      approvalStatus: hospital.approvalStatus,
      isApproved: hospital.isApproved,
      type: hospital.type,
      // Don't include sensitive information like documents, internal IDs, etc.
    };

    console.log('📤 Returning public hospital info for UID scan');
    res.json(publicInfo);
    
  } catch (error) {
    console.error('❌ Error fetching hospital by UID for QR:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

module.exports = {
  registerHospital,
  getPendingHospitals,
  getAllHospitals,
  approveHospital,
  rejectHospital,
  updateApprovalStatus,
  getHospitalApprovalStatus,
  getHospitalProfile,
  getHospitalByEmail,
  updateHospitalProfile,
  getPendingApprovalsForStaff,
  approveHospitalByStaff,
  rejectHospitalByStaff,
  getNearbyHospitals,
  getApprovedHospitalsForAffiliation,
  searchHospitalsForAffiliation,
  // Placeholder functions
  getDoctors,
  addDoctor,
  removeDoctor,
  getDepartments,
  addDepartment,
  removeDepartment,
  getAppointments,
  createAppointment,
  updateAppointment,
  getAdmissions,
  admitPatient,
  updateAdmission,
  getPharmacyItems,
  addPharmacyItem,
  updatePharmacyItem,
  removePharmacyItem,
  getLabTests,
  addLabTest,
  updateLabTest,
  removeLabTest,
  getQrRecords,
  getAnalytics,
  getReports,
  getChatMessages,
  sendChatMessage,
  getShifts,
  createShift,
  updateShift,
  deleteShift,
  getBilling,
  createBillingEntry,
  getDocuments,
  uploadDocument,
  getNotifications,
  updateSettings,
  getHospitalByQr,
  getHospitalByUid
};