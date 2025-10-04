const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const firebaseAuthMiddleware = require('../middleware/firebaseAuthMiddleware');
const hospitalController = require('../controllers/hospitalController');
const hospitalLocationController = require('../controllers/hospitalLocationController');
const sosController = require('../controllers/sosController');
const router = express.Router();

// Public route to get all approved hospitals (for appointment booking)
router.get('/', firebaseAuthMiddleware, hospitalController.getAllApprovedHospitals);

// Hospital approval routes (Admin only)
router.get('/admin/pending', authenticateToken, hospitalController.getPendingHospitals);
router.get('/admin/all', authenticateToken, hospitalController.getAllHospitals);
router.post('/admin/:hospitalId/approve', authenticateToken, hospitalController.approveHospital);
router.post('/admin/:hospitalId/reject', authenticateToken, hospitalController.rejectHospital);
router.put('/admin/:hospitalId/status', authenticateToken, hospitalController.updateApprovalStatus);

// Staff routes for pending approvals
router.get('/pending-approvals', firebaseAuthMiddleware, hospitalController.getPendingApprovalsForStaff);
router.post('/:hospitalId/approve', firebaseAuthMiddleware, hospitalController.approveHospitalByStaff);
router.post('/:hospitalId/reject', firebaseAuthMiddleware, hospitalController.rejectHospitalByStaff);

// Get nearby hospitals for SOS - MUST BE BEFORE :id ROUTES
router.get('/nearby', firebaseAuthMiddleware, hospitalController.getNearbyHospitals);

// Admin/Staff: synchronize hospital coordinates across fields (debug/maintenance)
router.post('/sync-coordinates', firebaseAuthMiddleware, async (req, res) => {
  try {
    const result = await sosController.synchronizeHospitalCoordinates();
    return res.status(200).json({ success: true, ...result });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// Send direct alert to hospital (from user app)
router.post('/alert', firebaseAuthMiddleware, async (req, res) => {
  try {
    await sosController.sendHospitalAlert(req, res);
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// Get direct alerts for hospital
router.get('/:hospitalId/direct-alerts', firebaseAuthMiddleware, async (req, res) => {
  try {
    const { hospitalId } = req.params;
    const { status, limit = 50 } = req.query;
    
    const HospitalAlert = require('../models/HospitalAlert');
    const Hospital = require('../models/Hospital');
    
    // First, try to find the hospital by Firebase UID to get MongoDB _id
    let actualHospitalId = hospitalId;
    
    // Check if hospitalId looks like a Firebase UID (not MongoDB ObjectId)
    if (!hospitalId.match(/^[0-9a-fA-F]{24}$/)) {
      console.log('🔍 hospitalId is Firebase UID, looking up MongoDB _id...');
      const hospital = await Hospital.findOne({ uid: hospitalId });
      if (hospital) {
        actualHospitalId = hospital._id.toString();
        console.log('✅ Found hospital MongoDB _id:', actualHospitalId);
      } else {
        console.log('❌ Hospital not found for UID:', hospitalId);
        return res.status(404).json({
          success: false,
          message: 'Hospital not found'
        });
      }
    }
    
    let query = { hospitalId: actualHospitalId };
    if (status) {
      query.status = status;
    }
    
    console.log('🔍 Querying HospitalAlert with:', query);
    
    const alerts = await HospitalAlert.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .lean();
    
    console.log('✅ Found', alerts.length, 'direct alerts');
    
    res.json({
      success: true,
      data: alerts,
      count: alerts.length
    });
  } catch (e) {
    console.error('❌ Error fetching direct alerts:', e);
    return res.status(500).json({ success: false, error: e.message });
  }
});

// Acknowledge direct alert
router.post('/:hospitalId/direct-alerts/:alertId/acknowledge', firebaseAuthMiddleware, async (req, res) => {
  try {
    const { hospitalId, alertId } = req.params;
    const { responseDetails } = req.body;
    
    const HospitalAlert = require('../models/HospitalAlert');
    const Hospital = require('../models/Hospital');
    
    // First, try to find the hospital by Firebase UID to get MongoDB _id
    let actualHospitalId = hospitalId;
    
    // Check if hospitalId looks like a Firebase UID (not MongoDB ObjectId)
    if (!hospitalId.match(/^[0-9a-fA-F]{24}$/)) {
      console.log('🔍 hospitalId is Firebase UID, looking up MongoDB _id...');
      const hospital = await Hospital.findOne({ uid: hospitalId });
      if (hospital) {
        actualHospitalId = hospital._id.toString();
        console.log('✅ Found hospital MongoDB _id:', actualHospitalId);
      } else {
        console.log('❌ Hospital not found for UID:', hospitalId);
        return res.status(404).json({
          success: false,
          message: 'Hospital not found'
        });
      }
    }
    
    const alert = await HospitalAlert.findOneAndUpdate(
      { _id: alertId, hospitalId: actualHospitalId },
      { 
        status: 'acknowledged',
        acknowledgedAt: new Date(),
        responseDetails: responseDetails || 'Alert acknowledged by hospital'
      },
      { new: true }
    );
    
    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Alert acknowledged successfully',
      data: alert
    });
  } catch (e) {
    console.error('❌ Error acknowledging alert:', e);
    return res.status(500).json({ success: false, error: e.message });
  }
});

// Create inpatient account
router.post('/:hospitalId/inpatients', firebaseAuthMiddleware, async (req, res) => {
  try {
    const { hospitalId } = req.params;
    const {
      fullName,
      email,
      mobileNumber,
      password,
      gender,
      dateOfBirth,
      address,
      pincode,
      city,
      state,
      emergencyContactName,
      emergencyContactNumber,
      emergencyContactRelation,
      knownAllergies,
      chronicConditions,
      bloodGroup,
      height,
      weight
    } = req.body;

    // Validate required fields
    if (!fullName || !email || !mobileNumber || !password) {
      return res.status(400).json({
        success: false,
        message: 'Full name, email, mobile number, and password are required'
      });
    }

    // Check if hospital exists - handle both Firebase UID and MongoDB _id
    const Hospital = require('../models/Hospital');
    let hospital;
    
    // Check if hospitalId looks like a Firebase UID (not MongoDB ObjectId)
    if (!hospitalId.match(/^[0-9a-fA-F]{24}$/)) {
      console.log('🔍 hospitalId is Firebase UID, looking up hospital...');
      hospital = await Hospital.findOne({ uid: hospitalId });
    } else {
      console.log('🔍 hospitalId is MongoDB _id, looking up hospital...');
      hospital = await Hospital.findById(hospitalId);
    }
    
    if (!hospital) {
      return res.status(404).json({
        success: false,
        message: 'Hospital not found'
      });
    }

    // Check if user already exists with this email or phone
    const User = require('../models/User');
    const existingUser = await User.findOne({
      $or: [
        { email: email },
        { mobileNumber: mobileNumber }
      ]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email or phone number'
      });
    }

    // Generate unique ARC ID
    const { v4: uuidv4 } = require('uuid');
    const arcId = 'ARC-' + uuidv4().slice(0, 8).toUpperCase();

    // Generate QR code
    const QRCode = require('qrcode');
    const qrCode = await QRCode.toDataURL(arcId);

    // Create Firebase user account
    const admin = require('firebase-admin');
    let firebaseUid;
    try {
      const userRecord = await admin.auth().createUser({
        email: email,
        password: password,
        phoneNumber: mobileNumber.startsWith('+') ? mobileNumber : `+91${mobileNumber}`,
        displayName: fullName
      });
      firebaseUid = userRecord.uid;
    } catch (firebaseError) {
      console.error('❌ Firebase user creation error:', firebaseError);
      return res.status(400).json({
        success: false,
        message: 'Failed to create user account: ' + firebaseError.message
      });
    }

    // Create user in MongoDB
    const user = new User({
      uid: firebaseUid,
      fullName,
      email,
      mobileNumber,
      gender,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      address,
      pincode,
      city,
      state,
      emergencyContactName,
      emergencyContactNumber,
      emergencyContactRelation,
      knownAllergies: knownAllergies || [],
      chronicConditions: chronicConditions || [],
      bloodGroup,
      height,
      weight,
      type: 'patient',
      arcId,
      qrCode,
      status: 'active',
      createdAt: new Date(),
      // Hospital association
      associatedHospital: hospital._id.toString(),
      associatedHospitalName: hospital.hospitalName,
      createdByHospital: true,
      createdByHospitalId: hospital._id.toString()
    });

    await user.save();

    console.log('✅ Inpatient account created:', {
      name: fullName,
      email: email,
      arcId: arcId,
      hospital: hospital.hospitalName
    });

    // Send welcome email with login credentials to the patient
    try {
      const { sendInpatientAccountEmail } = require('../services/emailService');
      await sendInpatientAccountEmail(
        email,
        fullName,
        password,
        hospital.hospitalName,
        arcId
      );
      console.log('✅ Inpatient welcome email sent to:', email);
    } catch (emailError) {
      console.error('❌ Failed to send inpatient welcome email:', emailError);
      // Don't fail the account creation if email fails
    }

    res.status(201).json({
      success: true,
      message: 'Inpatient account created successfully',
      data: {
        userId: user._id,
        uid: firebaseUid,
        arcId: arcId,
        qrCode: qrCode,
        fullName: fullName,
        email: email,
        mobileNumber: mobileNumber
      }
    });

  } catch (e) {
    console.error('❌ Error creating inpatient account:', e);
    return res.status(500).json({ 
      success: false, 
      error: e.message 
    });
  }
});

// Get hospital inpatients
router.get('/:hospitalId/inpatients', firebaseAuthMiddleware, async (req, res) => {
  try {
    const { hospitalId } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    
    const User = require('../models/User');
    const Hospital = require('../models/Hospital');
    
    // First, try to find the hospital by Firebase UID to get MongoDB _id
    let actualHospitalId = hospitalId;
    
    // Check if hospitalId looks like a Firebase UID (not MongoDB ObjectId)
    if (!hospitalId.match(/^[0-9a-fA-F]{24}$/)) {
      console.log('🔍 hospitalId is Firebase UID, looking up MongoDB _id...');
      const hospital = await Hospital.findOne({ uid: hospitalId });
      if (hospital) {
        actualHospitalId = hospital._id.toString();
        console.log('✅ Found hospital MongoDB _id:', actualHospitalId);
      } else {
        console.log('❌ Hospital not found for UID:', hospitalId);
        return res.status(404).json({
          success: false,
          message: 'Hospital not found'
        });
      }
    }
    
    const inpatients = await User.find({
      associatedHospitalId: actualHospitalId,
      createdByHospital: true,
      type: 'patient'
    })
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip(parseInt(offset))
    .select('fullName email mobileNumber arcId createdAt status gender dateOfBirth address')
    .lean();
    
    const totalCount = await User.countDocuments({
      associatedHospitalId: actualHospitalId,
      createdByHospital: true,
      type: 'patient'
    });
    
    res.json({
      success: true,
      data: inpatients,
      count: inpatients.length,
      totalCount: totalCount
    });
  } catch (e) {
    console.error('❌ Error fetching inpatients:', e);
    return res.status(500).json({ success: false, error: e.message });
  }
});

// Get hospital SOS log
router.get('/:hospitalId/sos-log', firebaseAuthMiddleware, async (req, res) => {
  try {
    const { hospitalId } = req.params;
    const { limit = 50 } = req.query;
    
    const HospitalSOS = require('../models/HospitalSOS');
    
    const sosLog = await HospitalSOS.find({ hospitalId: hospitalId })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .select('sosRequestId patientInfo emergencyDetails hospitalStatus createdAt handledByOtherDetails')
      .lean();
    
    res.json({
      success: true,
      data: sosLog,
      count: sosLog.length
    });
  } catch (e) {
    console.error('❌ Error fetching SOS log:', e);
    return res.status(500).json({ success: false, error: e.message });
  }
});

// Get hospital profile by UID
router.get('/uid/:uid', firebaseAuthMiddleware, hospitalController.getHospitalByUid);

// Login endpoint for service providers (no auth required)
router.get('/login-email/:email', async (req, res) => {
  try {
    const { email } = req.params;
    console.log('🔍 Hospital login check for email:', email);
    
    const Hospital = require('../models/Hospital');
    const hospital = await Hospital.findOne({ email: email });
    
    if (!hospital) {
      console.log('❌ Hospital not found for email:', email);
      return res.status(404).json({
        success: false,
        message: 'Hospital not found'
      });
    }
    
    console.log('✅ Hospital found:', hospital.hospitalName);
    
    res.json({
      success: true,
      data: hospital
    });
  } catch (e) {
    console.error('❌ Error checking hospital login:', e);
    return res.status(500).json({
      success: false,
      error: e.message
    });
  }
});

// Get hospital profile by ID
router.get('/:hospitalId', firebaseAuthMiddleware, hospitalController.getHospitalProfile);

// Update hospital profile
router.put('/:hospitalId', firebaseAuthMiddleware, hospitalController.updateHospitalProfile);

// Update hospital geo location (dashboard/app action)
router.put('/:hospitalId/location', firebaseAuthMiddleware, hospitalLocationController.updateHospitalLocation);

// Hospital registration
router.post('/register', firebaseAuthMiddleware, hospitalController.registerHospital);

// NOTE: Do not add another wildcard '/' route here; '/' is already used above
// for getAllApprovedHospitals. Keeping only the earlier route avoids shadowing
// '/nearby' and other specific endpoints.

module.exports = router; 
