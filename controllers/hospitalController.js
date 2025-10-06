const Hospital = require('../models/Hospital');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const { 
  sendRegistrationConfirmation, 
  sendApprovalEmail, 
  sendWelcomeEmail 
} = require('../services/emailService');
const fetch = require('node-fetch');

// --- Coordinate utilities (normalize and write in all formats)
function normalizeLonLat(rawLon, rawLat, hints) {
  const toNum = (v) => (typeof v === 'string' ? parseFloat(v) : v);
  let lon = toNum(rawLon);
  let lat = toNum(rawLat);
  const isValidLat = (v) => typeof v === 'number' && !isNaN(v) && Math.abs(v) <= 90;
  const isValidLon = (v) => typeof v === 'number' && !isNaN(v) && Math.abs(v) <= 180;
  if (isValidLon(lon) && isValidLat(lat)) return { lon, lat };
  if (isValidLon(lat) && isValidLat(lon)) return { lon: lat, lat: lon };
  if (hints && isValidLon(hints.lng) && isValidLat(hints.lat)) return { lon: hints.lng, lat: hints.lat };
  return { lon: undefined, lat: undefined };
}

function extractAndNormalizeFromBody(body) {
  const geo = body.geoCoordinates || {};
  // Accept multiple naming variants
  const candidates = [
    { lon: body.longitude, lat: body.latitude },
    { lon: geo.lng, lat: geo.lat },
    { lon: geo.longitude, lat: geo.latitude },
    Array.isArray(body.location?.coordinates) && body.location.coordinates.length === 2
      ? { lon: body.location.coordinates[0], lat: body.location.coordinates[1] }
      : null,
  ].filter(Boolean);
  let normalized = { lon: undefined, lat: undefined };
  for (const c of candidates) {
    normalized = normalizeLonLat(c.lon, c.lat, { lng: geo.lng, lat: geo.lat });
    if (normalized.lon !== undefined && normalized.lat !== undefined) break;
  }
  return normalized;
}

function writeAllCoordFormats(target, lon, lat) {
  target.longitude = lon;
  target.latitude = lat;
  target.geoCoordinates = { lng: lon, lat: lat };
  target.location = { type: 'Point', coordinates: [lon, lat] };
}

const REQUIRED_HOSPITAL_FIELDS = [
  'hospitalOwnerName', 'email', 'mobileNumber', 'hospitalName', 'registrationNumber', 'hospitalType', 'address', 'city', 'state', 'pincode', 'numberOfBeds', 'departments', 'licenseDocumentUrl'
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
    console.log('🔐 Firebase user from middleware:', firebaseUser);
    console.log('🔑 Firebase user UID:', firebaseUser?.uid);
    console.log('📧 Firebase user email:', firebaseUser?.email);
    
    if (!firebaseUser || !firebaseUser.uid) {
      console.log('❌ Invalid Firebase user - no UID found');
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
    
    // Map alternateMobile to altPhoneNumber
    if (req.body.alternateMobile) {
      req.body.altPhoneNumber = req.body.alternateMobile;
      console.log('✅ Mapped alternateMobile to altPhoneNumber:', req.body.alternateMobile);
    }
    
    // Map document URLs from both documents object and main body
    if (documents) {
      if (documents.hospital_license) {
        req.body.licenseDocumentUrl = documents.hospital_license;
        console.log('✅ Mapped hospital_license to licenseDocumentUrl:', documents.hospital_license);
      }
      if (documents.registration_certificate) {
        req.body.registrationCertificateUrl = documents.registration_certificate;
        console.log('✅ Mapped registration_certificate to registrationCertificateUrl');
      }
      if (documents.building_permit) {
        req.body.buildingPermitUrl = documents.building_permit;
        console.log('✅ Mapped building_permit to buildingPermitUrl');
      }
    }
    
    // Also check main body for document URLs (fallback)
      if (req.body.licenseDocumentUrl) {
      console.log('✅ Found licenseDocumentUrl in main body:', req.body.licenseDocumentUrl);
      }
    if (req.body.registrationCertificateUrl) {
      console.log('✅ Found registrationCertificateUrl in main body:', req.body.registrationCertificateUrl);
    }
    if (req.body.buildingPermitUrl) {
      console.log('✅ Found buildingPermitUrl in main body:', req.body.buildingPermitUrl);
    }
    
    console.log('📋 Request body after document mapping:', JSON.stringify(req.body, null, 2));
    console.log('📋 Documents object:', JSON.stringify(documents, null, 2));
    
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
      
      // Normalize incoming coordinates and write to all formats
      const norm = extractAndNormalizeFromBody(req.body);

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
      if (norm.lon !== undefined && norm.lat !== undefined) {
        writeAllCoordFormats(hospital, norm.lon, norm.lat);
      }
      await hospital.save();
      console.log('✅ New hospital created:', hospital.hospitalName);
      console.log('🔑 Hospital UID stored:', hospital.uid);
      console.log('📧 Hospital email stored:', hospital.email);
      console.log('🌍 Stored coordinates - Longitude:', hospital.longitude, 'Latitude:', hospital.latitude);
    } else {
      // Normalize incoming coordinates and write to all formats
      const norm = extractAndNormalizeFromBody(req.body);

      Object.assign(hospital, req.body);
      if (norm.lon !== undefined && norm.lat !== undefined) {
        writeAllCoordFormats(hospital, norm.lon, norm.lat);
      }
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
    console.log('🏥 Getting hospital profile for UID:', uid);
    
    const hospital = await Hospital.findOne({ uid });
    
    if (!hospital) {
      console.log('❌ Hospital not found for UID:', uid);
      return res.status(404).json({ 
        success: false,
        error: 'Hospital not found' 
      });
    }
    
    console.log('✅ Hospital found:', {
      _id: hospital._id,
      uid: hospital.uid,
      hospitalName: hospital.hospitalName
    });
    
    res.json({
      success: true,
      _id: hospital._id,
      id: hospital._id,
      ...hospital.toObject()
    });
  } catch (err) {
    console.error('❌ Error getting hospital profile:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
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
    console.log('🏥 Hospital Update Profile - Request received');
    console.log('🏥 UID:', req.params.uid);
    console.log('🏥 Update data:', JSON.stringify(req.body, null, 2));
    
    const { uid } = req.params;
    const updateData = req.body;
    
    // Map alternateMobile to altPhoneNumber
    if (updateData.alternateMobile) {
      updateData.altPhoneNumber = updateData.alternateMobile;
      console.log('✅ Mapped alternateMobile to altPhoneNumber in update:', updateData.alternateMobile);
    }
    
    const hospital = await Hospital.findOne({ uid });
    if (!hospital) {
      console.log('❌ Hospital not found for UID:', uid);
      return res.status(404).json({ error: 'Hospital not found' });
    }
    
    console.log('✅ Hospital found:', hospital.hospitalName);
    
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        console.log(`🔄 Updating ${key}: ${hospital[key]} -> ${updateData[key]}`);
        hospital[key] = updateData[key];
      }
    });

    // If coordinates provided in update, normalize and write to all formats
    const norm = extractAndNormalizeFromBody(updateData);
    if (norm.lon !== undefined && norm.lat !== undefined) {
      writeAllCoordFormats(hospital, norm.lon, norm.lat);
    }
    
    if (!hospital.arcId) {
      hospital.arcId = 'ARC-' + uuidv4().slice(0, 8).toUpperCase();
    }
    if (!hospital.qrCode && hospital.arcId) {
      hospital.qrCode = await QRCode.toDataURL(hospital.arcId);
    }
    
    console.log('💾 Saving hospital to database...');
    await hospital.save();
    console.log('✅ Hospital saved successfully');
    
    res.json(hospital);
  } catch (err) {
    console.log('❌ Error updating hospital profile:', err);
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
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Multer storage for hospital documents (PDF/images)
const hospitalDocsStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    try {
      const id = req.params.id || 'unknown';
      const dir = path.join(__dirname, '..', 'uploads', 'hospitals', id);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    } catch (e) {
      cb(e);
    }
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname) || (file.mimetype === 'application/pdf' ? '.pdf' : '');
    const safe = (req.body.documentType || 'document')
      .toString()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_');
    const ts = Date.now();
    cb(null, `${safe}_${ts}${ext}`);
  }
});

const uploadHospitalDoc = multer({
  storage: hospitalDocsStorage,
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'image/png', 'image/jpeg'];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    return cb(new Error('Unsupported file type'));
  },
  limits: { fileSize: 10 * 1024 * 1024 }
}).single('file');

const getDocuments = async (req, res) => res.status(200).json({ success: true, data: [] });

const uploadDocument = async (req, res) => {
  uploadHospitalDoc(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
    try {
      const id = req.params.id || 'unknown';
      const file = req.file;
      if (!file) return res.status(400).json({ success: false, error: 'No file uploaded' });
      const publicUrl = `/uploads/hospitals/${id}/${file.filename}`;

      // Return a normalized payload so frontend can map without changing reg logic
      const documentType = (req.body.documentType || 'document').toString();
      const mappedKey = documentType === 'hospital_license'
        ? 'licenseDocumentUrl'
        : documentType === 'registration_certificate'
          ? 'registrationCertificateUrl'
          : documentType === 'building_permit'
            ? 'buildingPermitUrl'
            : 'documentUrl';

      return res.json({
        success: true,
        data: {
          url: publicUrl,
          filename: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          documentType,
          mappedKey
        }
      });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  });
};
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
    const hospitalId = req.params.hospitalId || req.params.uid;
    const { approvedBy, notes } = req.body;
    const staffUid = (req.user && req.user.uid) ? req.user.uid : undefined;
    console.log('🛠️ Staff approval request:', { hospitalId, approvedBy, staffUid });
    
    // Allow approval by either Mongo _id or Firebase UID
    let hospital = null;
    try {
      const mongoose = require('mongoose');
      const isObjectId = mongoose.isValidObjectId(hospitalId);
      console.log('🔎 Lookup strategy:', isObjectId ? 'by _id' : 'by uid');
      if (isObjectId) {
        hospital = await Hospital.findById(hospitalId);
      }
    if (!hospital) {
        hospital = await Hospital.findOne({ uid: hospitalId });
      }
    } catch (lookupErr) {
      console.error('❌ Lookup error, trying uid fallback:', lookupErr);
      hospital = await Hospital.findOne({ uid: hospitalId });
    }
    
    if (!hospital) {
      console.log('❌ Hospital not found for approval:', hospitalId);
      return res.status(404).json({ success: false, error: 'Hospital not found' });
    }

    // If already approved/active, no-op to idempotently succeed
    if (hospital.isApproved === true && hospital.approvalStatus === 'approved' && hospital.status === 'active') {
      console.log('ℹ️ Hospital already approved/active, returning success');
      return res.json({
        success: true,
        message: 'Hospital already approved',
        data: {
          _id: hospital._id,
          uid: hospital.uid,
          isApproved: hospital.isApproved,
          approvalStatus: hospital.approvalStatus,
          status: hospital.status,
          approvedAt: hospital.approvedAt,
          approvedBy: hospital.approvedBy,
        }
      });
    }

    // Update approval fields (only these as requested)
    hospital.isApproved = true;
    hospital.approvalStatus = 'approved';
    hospital.status = 'active';
    hospital.approvedAt = new Date();
    hospital.approvedBy = approvedBy || staffUid || 'staff';
    hospital.approvalNotes = notes || 'Approved by staff';
    
    await hospital.save();
    console.log('✅ Hospital approved and saved:', { id: hospital._id, uid: hospital.uid });

    // Send approval email (best-effort)
    try {
      await sendApprovalEmail(hospital.email, hospital.hospitalName, 'hospital', true, notes);
      console.log('📧 Approval email sent to hospital');
    } catch (emailError) {
      console.error('❌ Error sending approval email:', emailError);
    }
    
    return res.json({
      success: true,
      message: 'Hospital approved successfully',
      data: {
        _id: hospital._id,
        uid: hospital.uid,
        isApproved: hospital.isApproved,
        approvalStatus: hospital.approvalStatus,
        status: hospital.status,
        approvedAt: hospital.approvedAt,
        approvedBy: hospital.approvedBy,
      }
    });
  } catch (error) {
    console.error('❌ Error approving hospital by staff:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to approve hospital',
      details: error && error.message ? error.message : String(error)
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
    const { latitude, longitude, city, pincode, radius = 15, distanceMode } = req.query;
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
    
    // Parse coordinates if provided
    let lat = null;
    let lng = null;
    if (latitude && longitude) {
      lat = parseFloat(latitude);
      lng = parseFloat(longitude);
    }
    
    // If coordinates are provided, use them for proximity search
    if (latitude && longitude) {
      const radiusKm = parseFloat(radius);
      
      // Find hospitals within the specified radius
      // Note: This is a simplified approach. For production, consider using MongoDB's $geoNear
      const hospitals = await Hospital.find(query);
      
      // Filter hospitals by distance with coordinate normalization
      let hospitalsWithDistance = hospitals
        .map(hospital => {
          // Try different coordinate formats
          let hospitalLat, hospitalLng;
          if (hospital.geoCoordinates) {
            if (hospital.geoCoordinates.lat && hospital.geoCoordinates.lng) {
              hospitalLat = hospital.geoCoordinates.lat;
              hospitalLng = hospital.geoCoordinates.lng;
            } else if (hospital.geoCoordinates.latitude && hospital.geoCoordinates.longitude) {
              hospitalLat = hospital.geoCoordinates.latitude;
              hospitalLng = hospital.geoCoordinates.longitude;
            }
          }
          if (hospitalLat === undefined && hospitalLng === undefined) {
            if (hospital.latitude && hospital.longitude) {
              hospitalLat = hospital.latitude;
              hospitalLng = hospital.longitude;
            }
          }
          if (hospitalLat === undefined && hospitalLng === undefined && hospital.location && hospital.location.coordinates) {
            const coords = hospital.location.coordinates;
            if (Array.isArray(coords) && coords.length === 2) {
              hospitalLng = coords[0];
              hospitalLat = coords[1];
            }
          }

          // Normalize and validate
          const norm = normalizeLonLat(hospitalLng, hospitalLat);
          if (norm.lon !== undefined && norm.lat !== undefined) {
            const distance = _calculateDistance(lat, lng, norm.lat, norm.lon);
            if (Number.isFinite(distance)) {
              return { ...hospital.toObject(), distance };
            }
          }
          return null;
        })
        .filter((hospital) => hospital != null && hospital.distance <= radiusKm)
        .sort((a, b) => a.distance - b.distance);
      
      console.log(`📍 Sample hospital data:`, hospitalsWithDistance.slice(0, 2).map(h => ({
        name: h.hospitalName,
        geoCoordinates: h.geoCoordinates,
        latitude: h.latitude,
        longitude: h.longitude,
        location: h.location,
        distance: h.distance
      })));
      
      // Optional: replace straight-line with driving distance via Google Distance Matrix
      if (distanceMode === 'driving' && process.env.GOOGLE_MAPS_API_KEY && hospitalsWithDistance.length > 0) {
        try {
          const key = process.env.GOOGLE_MAPS_API_KEY;
          const origins = `${lat},${lng}`;
          // Join first 25 destinations per request (API limit). For simplicity, handle up to 25.
          const top = hospitalsWithDistance.slice(0, 25);
          const destinations = top.map(h => `${h.location?.coordinates?.[1] ?? h.latitude},${h.location?.coordinates?.[0] ?? h.longitude}`).join('|');
          const url = `https://maps.googleapis.com/maps/api/distancematrix/json?units=metric&origins=${encodeURIComponent(origins)}&destinations=${encodeURIComponent(destinations)}&mode=driving&key=${key}`;
          const resp = await fetch(url);
          const data = await resp.json();
          if (data.status === 'OK' && data.rows && data.rows[0] && Array.isArray(data.rows[0].elements)) {
            data.rows[0].elements.forEach((el, idx) => {
              if (el.status === 'OK') {
                top[idx].drivingDistanceKm = (el.distance.value || 0) / 1000;
                top[idx].drivingDurationSec = (el.duration.value || 0);
              }
            });
            // Merge enriched entries back
            hospitalsWithDistance = top
              .filter(h => typeof h.drivingDistanceKm === 'number')
              .filter(h => h.drivingDistanceKm <= radiusKm)
              .sort((a, b) => a.drivingDistanceKm - b.drivingDistanceKm);
          } else {
            console.log('⚠️ Distance Matrix returned non-OK status, using straight-line distances');
          }
        } catch (gErr) {
          console.log('⚠️ Driving distance fetch failed, using straight-line distances:', gErr.message);
        }
      }

      console.log(`✅ Found ${hospitalsWithDistance.length} hospitals within ${radiusKm}km (${distanceMode === 'driving' ? 'driving' : 'air'})`);

      // Fallback: if none found within provided radius (default 15km), expand to 25km
      if (hospitalsWithDistance.length === 0 && (isNaN(radiusKm) || radiusKm <= 15)) {
        const fallbackKm = 25;
        let hospitals25 = hospitals
          .map(hospital => {
            let hospitalLat, hospitalLng;
            if (hospital.geoCoordinates) {
              if (hospital.geoCoordinates.lat && hospital.geoCoordinates.lng) {
                hospitalLat = hospital.geoCoordinates.lat;
                hospitalLng = hospital.geoCoordinates.lng;
              } else if (hospital.geoCoordinates.latitude && hospital.geoCoordinates.longitude) {
                hospitalLat = hospital.geoCoordinates.latitude;
                hospitalLng = hospital.geoCoordinates.longitude;
              }
            }
            if (!hospitalLat && !hospitalLng) {
              if (hospital.latitude && hospital.longitude) {
                hospitalLat = hospital.latitude;
                hospitalLng = hospital.longitude;
              }
            }
            if (!hospitalLat && !hospitalLng && hospital.location && hospital.location.coordinates) {
              const coords = hospital.location.coordinates;
              if (Array.isArray(coords) && coords.length === 2) {
                hospitalLng = coords[0];
                hospitalLat = coords[1];
              }
            }
            if (hospitalLat && hospitalLng) {
              const distance = _calculateDistance(lat, lng, hospitalLat, hospitalLng);
              return { ...hospital.toObject(), distance };
            }
            return null;
          })
          .filter((h) => h != null && h.distance <= fallbackKm)
          .sort((a, b) => a.distance - b.distance);

        if (distanceMode === 'driving' && process.env.GOOGLE_MAPS_API_KEY && hospitals25.length > 0) {
          try {
            const key = process.env.GOOGLE_MAPS_API_KEY;
            const origins = `${lat},${lng}`;
            const top = hospitals25.slice(0, 25);
            const destinations = top.map(h => `${h.location?.coordinates?.[1] ?? h.latitude},${h.location?.coordinates?.[0] ?? h.longitude}`).join('|');
            const url = `https://maps.googleapis.com/maps/api/distancematrix/json?units=metric&origins=${encodeURIComponent(origins)}&destinations=${encodeURIComponent(destinations)}&mode=driving&key=${key}`;
            const resp = await fetch(url);
            const data = await resp.json();
            if (data.status === 'OK' && data.rows && data.rows[0] && Array.isArray(data.rows[0].elements)) {
              data.rows[0].elements.forEach((el, idx) => {
                if (el.status === 'OK') {
                  top[idx].drivingDistanceKm = (el.distance.value || 0) / 1000;
                  top[idx].drivingDurationSec = (el.duration.value || 0);
                }
              });
              hospitals25 = top
                .filter(h => typeof h.drivingDistanceKm === 'number')
                .filter(h => h.drivingDistanceKm <= fallbackKm)
                .sort((a, b) => a.drivingDistanceKm - b.drivingDistanceKm);
            }
          } catch (e) {
            console.log('⚠️ Driving distance fallback fetch failed:', e.message);
          }
        }

        console.log(`📍 Fallback 25km found ${hospitals25.length} hospitals`);
        return res.json({
          success: true,
          data: hospitals25,
          count: hospitals25.length,
          radiusUsedKm: hospitals25.length > 0 ? fallbackKm : radiusKm
        });
      }

      return res.json({
        success: true,
        data: hospitalsWithDistance,
        count: hospitalsWithDistance.length,
        radiusUsedKm: radiusKm
      });
    } else if (city || pincode) {
      // Fallback to city/pincode search
      if (city) query.city = { $regex: city, $options: 'i' };
      if (pincode) query.pincode = pincode;
      
      const hospitals = await Hospital.find(query);
      
      // Calculate distances for city/pincode hospitals if coordinates are available
      const hospitalsWithDistance = hospitals.map(hospital => {
        const hospitalObj = hospital.toObject();
        
        // Try different coordinate formats
        let hospitalLat, hospitalLng;
        
        if (hospital.geoCoordinates) {
          // Format 1: geoCoordinates.lat/lng
          if (hospital.geoCoordinates.lat && hospital.geoCoordinates.lng) {
            hospitalLat = hospital.geoCoordinates.lat;
            hospitalLng = hospital.geoCoordinates.lng;
          }
          // Format 2: geoCoordinates.latitude/longitude
          else if (hospital.geoCoordinates.latitude && hospital.geoCoordinates.longitude) {
            hospitalLat = hospital.geoCoordinates.latitude;
            hospitalLng = hospital.geoCoordinates.longitude;
          }
        }
        
        // Format 3: Direct latitude/longitude fields
        if (hospitalLat === undefined && hospitalLng === undefined) {
          if (hospital.latitude && hospital.longitude) {
            hospitalLat = hospital.latitude;
            hospitalLng = hospital.longitude;
          }
        }
        
        // Format 4: location.coordinates [lng, lat]
        if (hospitalLat === undefined && hospitalLng === undefined && hospital.location && hospital.location.coordinates) {
          const coords = hospital.location.coordinates;
          if (Array.isArray(coords) && coords.length === 2) {
            hospitalLng = coords[0];
            hospitalLat = coords[1];
          }
        }
        
        const norm = normalizeLonLat(hospitalLng, hospitalLat);
        if (norm.lon !== undefined && norm.lat !== undefined && lat && lng) {
          const distance = _calculateDistance(lat, lng, norm.lat, norm.lon);
          hospitalObj.distance = distance;
        }
        return hospitalObj;
      });
      
      console.log(`✅ Found ${hospitalsWithDistance.length} hospitals by city/pincode`);
      
      res.json({
        success: true,
        data: hospitalsWithDistance,
        count: hospitalsWithDistance.length
      });
    } else {
      // Return all approved hospitals if no location specified
      const hospitals = await Hospital.find(query).limit(20);
      
      // Calculate distances for all hospitals if coordinates are available
      const hospitalsWithDistance = hospitals.map(hospital => {
        const hospitalObj = hospital.toObject();
        
        // Try different coordinate formats
        let hospitalLat, hospitalLng;
        
        if (hospital.geoCoordinates) {
          // Format 1: geoCoordinates.lat/lng
          if (hospital.geoCoordinates.lat && hospital.geoCoordinates.lng) {
            hospitalLat = hospital.geoCoordinates.lat;
            hospitalLng = hospital.geoCoordinates.lng;
          }
          // Format 2: geoCoordinates.latitude/longitude
          else if (hospital.geoCoordinates.latitude && hospital.geoCoordinates.longitude) {
            hospitalLat = hospital.geoCoordinates.latitude;
            hospitalLng = hospital.geoCoordinates.longitude;
          }
        }
        
        // Format 3: Direct latitude/longitude fields
        if (!hospitalLat && !hospitalLng) {
          if (hospital.latitude && hospital.longitude) {
            hospitalLat = hospital.latitude;
            hospitalLng = hospital.longitude;
          }
        }
        
        // Format 4: location.coordinates [lng, lat]
        if (!hospitalLat && !hospitalLng && hospital.location && hospital.location.coordinates) {
          const coords = hospital.location.coordinates;
          if (Array.isArray(coords) && coords.length === 2) {
            hospitalLng = coords[0];
            hospitalLat = coords[1];
          }
        }
        
        if (hospitalLat && hospitalLng && lat && lng) {
          const distance = _calculateDistance(lat, lng, hospitalLat, hospitalLng);
          hospitalObj.distance = distance;
        }
        return hospitalObj;
      });
      
      console.log(`✅ Found ${hospitalsWithDistance.length} approved hospitals`);
      
      res.json({
        success: true,
        data: hospitalsWithDistance,
        count: hospitalsWithDistance.length
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
    
    // First try to find approved hospitals (including pending status if approved)
    let hospitals = await Hospital.find({
      isApproved: true,
      approvalStatus: 'approved',
      status: { $in: ['active', 'pending'] }
    })
    .select('_id hospitalName city state hospitalType address pincode longitude latitude')
    .sort({ hospitalName: 1 });
    
    console.log(`✅ Found ${hospitals.length} approved hospitals`);
    
    // Debug: Show sample hospitals
    if (hospitals.length > 0) {
      console.log('🔍 Sample approved hospitals:');
      for (let i = 0; i < Math.min(3, hospitals.length); i++) {
        const hospital = hospitals[i];
        console.log(`  ${i + 1}. ${hospital.hospitalName} (Status: ${hospital.status || 'N/A'})`);
      }
    }
    
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

// Get all approved hospitals for appointment booking
const getAllApprovedHospitals = async (req, res) => {
  try {
    console.log('🏥 Fetching all approved hospitals for appointment booking...');
    
    const hospitals = await Hospital.find({ 
      isApproved: true,
      status: 'active'
    }).select(
      'uid hospitalName hospitalType address city state pincode numberOfBeds departments specialFacilities hasPharmacy hasLab averageRating totalRatings longitude latitude geoCoordinates location'
    ).lean();

    console.log(`✅ Found ${hospitals.length} approved hospitals`);

    // Transform data for frontend
    const transformedHospitals = hospitals.map(hospital => {
      // Resolve coordinates from any supported format
      let lat = undefined;
      let lng = undefined;
      if (hospital.geoCoordinates && typeof hospital.geoCoordinates.lat === 'number' && typeof hospital.geoCoordinates.lng === 'number') {
        lat = hospital.geoCoordinates.lat;
        lng = hospital.geoCoordinates.lng;
      } else if (typeof hospital.latitude === 'number' && typeof hospital.longitude === 'number') {
        lat = hospital.latitude;
        lng = hospital.longitude;
      } else if (hospital.location && Array.isArray(hospital.location.coordinates) && hospital.location.coordinates.length === 2) {
        lng = hospital.location.coordinates[0];
        lat = hospital.location.coordinates[1];
      }

      return ({
      uid: hospital.uid,
      fullName: hospital.hospitalName,
      hospitalName: hospital.hospitalName,
      hospitalType: hospital.hospitalType,
      address: hospital.address,
      city: hospital.city,
      state: hospital.state,
      pincode: hospital.pincode,
      numberOfBeds: hospital.numberOfBeds,
      departments: hospital.departments || [],
      specialFacilities: hospital.specialFacilities || [],
      hasPharmacy: hospital.hasPharmacy || false,
      hasLab: hospital.hasLab || false,
      averageRating: hospital.averageRating || 0,
      totalRatings: hospital.totalRatings || 0,
      // Add location info for easy access
      location: `${hospital.address}, ${hospital.city}, ${hospital.state} - ${hospital.pincode}`,
      coordinates: lat !== undefined && lng !== undefined ? { latitude: lat, longitude: lng } : undefined,
    });
    });

    res.json({
      success: true,
      data: transformedHospitals,
      count: transformedHospitals.length
    });
  } catch (error) {
    console.error('❌ Error fetching approved hospitals:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch hospitals',
      error: error.message
    });
  }
};

// Search hospitals by name
const searchHospitalsByName = async (req, res) => {
  try {
    const { name } = req.query;
    
    if (!name || name.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Hospital name must be at least 2 characters long'
      });
    }

    console.log('🔍 Searching hospitals by name:', name);

    const hospitals = await Hospital.find({
      hospitalName: { $regex: name, $options: 'i' },
      isApproved: true,
      status: 'active'
    }).select('uid hospitalName address city state pincode email mobileNumber')
      .limit(10);

    console.log(`✅ Found ${hospitals.length} hospitals matching "${name}"`);

    res.json({
      success: true,
      data: hospitals,
      count: hospitals.length
    });
  } catch (error) {
    console.error('❌ Error searching hospitals by name:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search hospitals',
      error: error.message
    });
  }
};

module.exports = {
  registerHospital,
  getPendingHospitals,
  getAllHospitals,
  getAllApprovedHospitals,
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
  searchHospitalsByName,
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