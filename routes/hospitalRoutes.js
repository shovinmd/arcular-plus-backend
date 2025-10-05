const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const firebaseAuthMiddleware = require('../middleware/firebaseAuthMiddleware');
const hospitalController = require('../controllers/hospitalController');
const hospitalLocationController = require('../controllers/hospitalLocationController');
const sosController = require('../controllers/sosController');
const router = express.Router();

// Send direct alert to hospital (from user app) - MUST BE BEFORE :id ROUTES
router.post('/alert', firebaseAuthMiddleware, async (req, res) => {
  try {
    await sosController.sendHospitalAlert(req, res);
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// Get direct alerts for hospital - MUST BE BEFORE :id ROUTES
router.get('/:hospitalId/direct-alerts', firebaseAuthMiddleware, async (req, res) => {
  try {
    const { hospitalId } = req.params;
    const { status, limit = 50 } = req.query;

    const HospitalAlert = require('../models/HospitalAlert');
    const Hospital = require('../models/Hospital');
    const { Types } = require('mongoose');

    // Resolve hospitalId to MongoDB ObjectId by trying multiple identifiers
    let mongoHospitalId = null;

    console.log('🔎 Resolving hospital identifier for direct alerts:', hospitalId);

    // 1) If hospitalId is a valid ObjectId, use it directly
    if (Types.ObjectId.isValid(hospitalId)) {
      mongoHospitalId = hospitalId;
      console.log('✅ Using provided MongoDB _id for hospital');
    } else {
      // 2) Try firebaseUid
      let hospitalDoc = await Hospital.findOne({ firebaseUid: hospitalId });
      if (!hospitalDoc) {
        // 3) Try generic uid
        hospitalDoc = await Hospital.findOne({ uid: hospitalId });
      }
      if (!hospitalDoc) {
        // 4) Try qrUid/publicId as a last resort
        hospitalDoc = await Hospital.findOne({ $or: [{ qrUid: hospitalId }, { publicId: hospitalId }] });
      }
      if (hospitalDoc) {
        mongoHospitalId = hospitalDoc._id;
        console.log(`✅ Resolved hospital to _id: ${mongoHospitalId}`);
      }
    }

    if (!mongoHospitalId) {
      console.log('⚠️ Hospital not found for identifier:', hospitalId);
      return res.json({ success: true, data: [], count: 0, message: 'Hospital not found' });
    }

    const query = Object.assign(
      { hospitalId: mongoHospitalId },
      status ? { status } : {}
    );

    console.log('🔍 Querying direct alerts with:', query);

    const alerts = await HospitalAlert.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .lean();

    console.log(`📊 Found ${alerts.length} direct alerts`);

    return res.json({ success: true, data: alerts, count: alerts.length });
  } catch (e) {
    console.error('❌ Error fetching direct alerts:', e);
    return res.status(500).json({ success: false, error: e.message });
  }
});

// Acknowledge direct alert - MUST BE BEFORE :id ROUTES
router.post('/:hospitalId/direct-alerts/:alertId/acknowledge', firebaseAuthMiddleware, async (req, res) => {
  try {
    const { hospitalId, alertId } = req.params;
    const { responseDetails } = req.body;

    const HospitalAlert = require('../models/HospitalAlert');
    const Hospital = require('../models/Hospital');
    const { Types } = require('mongoose');

    // Resolve hospital id similar to GET route
    let mongoHospitalId = null;
    if (Types.ObjectId.isValid(hospitalId)) {
      mongoHospitalId = hospitalId;
    } else {
      let hospitalDoc = await Hospital.findOne({ firebaseUid: hospitalId })
        || await Hospital.findOne({ uid: hospitalId })
        || await Hospital.findOne({ $or: [{ qrUid: hospitalId }, { publicId: hospitalId }] });
      if (hospitalDoc) mongoHospitalId = hospitalDoc._id;
    }

    const alert = await HospitalAlert.findOneAndUpdate(
      { _id: alertId, hospitalId: mongoHospitalId },
      {
        status: 'acknowledged',
        acknowledgedAt: new Date(),
        responseDetails: responseDetails || 'Alert acknowledged by hospital'
      },
      { new: true }
    );

    if (!alert) {
      return res.status(404).json({ success: false, message: 'Alert not found' });
    }

    return res.json({ success: true, message: 'Alert acknowledged successfully', data: alert });
  } catch (e) {
    console.error('❌ Error acknowledging alert:', e);
    return res.status(500).json({ success: false, error: e.message });
  }
});

// Cancel a direct alert (user side) - keep in hospitals namespace for simplicity
router.post('/direct-alerts/:alertId/cancel', firebaseAuthMiddleware, async (req, res) => {
  try {
    await sosController.cancelDirectAlert(req, res);
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// Get current user's latest direct alerts (for user app status)
router.get('/direct-alerts/my', firebaseAuthMiddleware, async (req, res) => {
  try {
    const uid = req.user && (req.user.uid || req.user.user_id);
    const { status, limit = 5 } = req.query;
    const HospitalAlert = require('../models/HospitalAlert');
    const query = Object.assign(
      { patientId: uid },
      status ? { status } : {}
    );
    const alerts = await HospitalAlert.find(query)
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(parseInt(limit))
      .lean();
    return res.json({ success: true, data: alerts, count: alerts.length });
  } catch (e) {
    console.error('❌ Error fetching my direct alerts:', e);
    return res.status(500).json({ success: false, error: e.message });
  }
});

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

// Duplicate routes removed - using the ones at the top of the file

// Get hospital by UID (for login) - MUST BE BEFORE GENERIC :id ROUTES
router.get('/uid/:uid', firebaseAuthMiddleware, hospitalController.getHospitalProfile);
router.put('/uid/:uid', firebaseAuthMiddleware, hospitalController.updateHospitalProfile);

// Search hospitals by name MUST BE BEFORE GENERIC ":id" ROUTES
router.get('/search', firebaseAuthMiddleware, hospitalController.searchHospitalsByName);

// Get hospital by email (for login verification)
router.get('/email/:email', firebaseAuthMiddleware, hospitalController.getHospitalByEmail);

// Get hospital by email (for login verification - unprotected)
router.get('/login-email/:email', hospitalController.getHospitalByEmail);

// Hospital approval status check
router.get('/:uid/approval-status', firebaseAuthMiddleware, hospitalController.getHospitalApprovalStatus);

// Profile
router.get('/:id', firebaseAuthMiddleware, hospitalController.getHospitalProfile);
router.put('/:id', firebaseAuthMiddleware, hospitalController.updateHospitalProfile);

// Doctors
router.get('/:id/doctors', firebaseAuthMiddleware, hospitalController.getDoctors);
router.post('/:id/doctors', firebaseAuthMiddleware, hospitalController.addDoctor);
router.delete('/:id/doctors/:doctorId', firebaseAuthMiddleware, hospitalController.removeDoctor);

// Departments
router.get('/:id/departments', firebaseAuthMiddleware, hospitalController.getDepartments);
router.post('/:id/departments', firebaseAuthMiddleware, hospitalController.addDepartment);
router.delete('/:id/departments/:deptName', firebaseAuthMiddleware, hospitalController.removeDepartment);

// Appointments
router.get('/:id/appointments', firebaseAuthMiddleware, hospitalController.getAppointments);
router.post('/:id/appointments', firebaseAuthMiddleware, hospitalController.createAppointment);
router.put('/:id/appointments/:appointmentId', firebaseAuthMiddleware, hospitalController.updateAppointment);

// Back-compat alias for booking via singular action
router.post('/:id/appointments/book', firebaseAuthMiddleware, hospitalController.createAppointment);

// Admissions
router.get('/:id/admissions', firebaseAuthMiddleware, hospitalController.getAdmissions);
router.post('/:id/admissions', firebaseAuthMiddleware, hospitalController.admitPatient);
router.put('/:id/admissions/:admissionId', firebaseAuthMiddleware, hospitalController.updateAdmission);

// Pharmacy
router.get('/:id/pharmacy', firebaseAuthMiddleware, hospitalController.getPharmacyItems);
router.post('/:id/pharmacy', firebaseAuthMiddleware, hospitalController.addPharmacyItem);
router.put('/:id/pharmacy/:itemId', firebaseAuthMiddleware, hospitalController.updatePharmacyItem);
router.delete('/:id/pharmacy/:itemId', firebaseAuthMiddleware, hospitalController.removePharmacyItem);

// Lab
router.get('/:id/lab-tests', firebaseAuthMiddleware, hospitalController.getLabTests);
router.post('/:id/lab-tests', firebaseAuthMiddleware, hospitalController.addLabTest);
router.put('/:id/lab-tests/:testId', firebaseAuthMiddleware, hospitalController.updateLabTest);
router.delete('/:id/lab-tests/:testId', firebaseAuthMiddleware, hospitalController.removeLabTest);

// QR Records
router.get('/:id/qr-records', firebaseAuthMiddleware, hospitalController.getQrRecords);

// Public QR scanning endpoints
router.get('/qr/:identifier', hospitalController.getHospitalByQr);
router.get('/qr/uid/:uid', hospitalController.getHospitalByUid);

// Add: fetch hospital SOS log (recent actions and handledByOther details)
router.get('/:hospitalId/sos-log', firebaseAuthMiddleware, async (req, res) => {
  try {
    const { hospitalId } = req.params;
    const { limit } = req.query;
    
    console.log(`📊 Getting SOS log for hospital: ${hospitalId}, limit: ${limit}`);
    
    const result = await sosController.getHospitalSOSLog(req, res);
    return result;
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// Debug endpoint to check SOS data
router.get('/:hospitalId/debug-sos', firebaseAuthMiddleware, async (req, res) => {
  try {
    const { hospitalId } = req.params;
    const HospitalSOS = require('../models/HospitalSOS');
    const SOSRequest = require('../models/SOSRequest');
    
    console.log(`🔍 Debug: Checking SOS data for hospital: ${hospitalId}`);
    
    // Try to resolve hospitalId to MongoDB ObjectId
    let mongoHospitalId = hospitalId;
    
    // If hospitalId looks like a Firebase UID (long string), find the MongoDB _id
    if (hospitalId.length > 20) {
      const Hospital = require('../models/Hospital');
      const hospital = await Hospital.findOne({ firebaseUid: hospitalId });
      if (hospital) {
        mongoHospitalId = hospital._id;
        console.log(`🔍 Resolved Firebase UID ${hospitalId} to MongoDB _id: ${mongoHospitalId}`);
      }
    }
    
    // Get all HospitalSOS records for this hospital
    const hospitalSOSRecords = await HospitalSOS.find({
      hospitalId: mongoHospitalId
    }).lean();
    
    console.log(`📊 Found ${hospitalSOSRecords.length} HospitalSOS records`);
    
    // Get all SOS requests
    const allSOSRequests = await SOSRequest.find({}).limit(5).lean();
    console.log(`📊 Found ${allSOSRequests.length} SOS requests (showing first 5)`);
    
    // Get all HospitalSOS records (first 10)
    const allHospitalSOS = await HospitalSOS.find({}).limit(10).lean();
    console.log(`📊 Found ${allHospitalSOS.length} total HospitalSOS records (showing first 10)`);
    
    res.json({
      success: true,
      data: {
        hospitalId: hospitalId,
        mongoHospitalId: mongoHospitalId,
        hospitalSOSRecords: hospitalSOSRecords,
        allSOSRequests: allSOSRequests,
        allHospitalSOS: allHospitalSOS,
        counts: {
          hospitalSOSRecords: hospitalSOSRecords.length,
          allSOSRequests: allSOSRequests.length,
          allHospitalSOS: allHospitalSOS.length
        }
      }
    });
    
  } catch (e) {
    console.error('❌ Error in debug endpoint:', e);
    return res.status(500).json({ success: false, error: e.message });
  }
});


// Analytics
router.get('/:id/analytics', firebaseAuthMiddleware, hospitalController.getAnalytics);

// Reports
router.get('/:id/reports', firebaseAuthMiddleware, hospitalController.getReports);

// Chat
router.get('/:id/chat', firebaseAuthMiddleware, hospitalController.getChatMessages);
router.post('/:id/chat', firebaseAuthMiddleware, hospitalController.sendChatMessage);

// Shifts
router.get('/:id/shifts', firebaseAuthMiddleware, hospitalController.getShifts);
router.post('/:id/shifts', firebaseAuthMiddleware, hospitalController.createShift);
router.put('/:id/shifts/:shiftId', firebaseAuthMiddleware, hospitalController.updateShift);
router.delete('/:id/shifts/:shiftId', firebaseAuthMiddleware, hospitalController.deleteShift);

// Billing
router.get('/:id/billing', firebaseAuthMiddleware, hospitalController.getBilling);
router.post('/:id/billing', firebaseAuthMiddleware, hospitalController.createBillingEntry);

// Documents
router.get('/:id/documents', firebaseAuthMiddleware, hospitalController.getDocuments);
router.post('/:id/documents', firebaseAuthMiddleware, hospitalController.uploadDocument);

// Notifications
router.get('/:id/notifications', firebaseAuthMiddleware, hospitalController.getNotifications);

// Settings
router.put('/:id/settings', firebaseAuthMiddleware, hospitalController.updateSettings);

// Get approved hospitals for affiliation selection (public - for registration)
router.get('/affiliation/approved', hospitalController.getApprovedHospitalsForAffiliation);

// Search hospitals for affiliation (public - for registration)
router.get('/affiliation/search', hospitalController.searchHospitalsForAffiliation);

// Update hospital geo location (dashboard/app action)
router.put('/:hospitalId/location', firebaseAuthMiddleware, hospitalLocationController.updateHospitalLocation);

// Hospital registration
router.post('/register', firebaseAuthMiddleware, hospitalController.registerHospital);

// Inpatient Management Routes
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
    if (!fullName || !password) {
      return res.status(400).json({
        success: false,
        message: 'Full name and password are required'
      });
    }

    // At least one contact method is required
    if (!email && !mobileNumber) {
      return res.status(400).json({
        success: false,
        message: 'Either email or mobile number is required'
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
    let existingUser;
    
    if (email && mobileNumber) {
      // Both email and phone provided - check both
      existingUser = await User.findOne({
        $or: [
          { email: email },
          { mobileNumber: mobileNumber }
        ]
      });
    } else if (email) {
      // Only email provided - check email
      existingUser = await User.findOne({ email: email });
    } else {
      // Only phone provided - check phone
      existingUser = await User.findOne({ mobileNumber: mobileNumber });
    }

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

    // Create Firebase user account (password is always required now)
    const admin = require('firebase-admin');
    let firebaseUid;
    
    try {
      const userRecord = await admin.auth().createUser({
        email: email || undefined, // Email might be null if only phone provided
        password: password,
        phoneNumber: mobileNumber ? (mobileNumber.startsWith('+') ? mobileNumber : `+91${mobileNumber}`) : undefined,
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
      hospital: hospital.hospitalName,
      hospitalMongoId: hospital._id.toString(),
      hospitalFirebaseUid: hospital.uid,
      userAssociatedHospital: user.associatedHospital,
      userAssociatedHospitalId: user.associatedHospitalId,
      userCreatedByHospitalId: user.createdByHospitalId
    });

    // Send welcome email with login credentials to the patient (if email provided)
    if (email) {
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
    
    // Find the hospital to get the correct MongoDB _id
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
    
    console.log('🔍 Fetching inpatients for hospital:', hospital.hospitalName, 'MongoDB _id:', hospital._id);
    
    // Try multiple query approaches to find inpatients
    let inpatients = await User.find({
      associatedHospitalId: hospital._id.toString(),
      createdByHospital: true,
      type: 'patient'
    })
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip(parseInt(offset))
    .select('fullName email mobileNumber arcId createdAt status gender dateOfBirth address')
    .lean();
    
    console.log('🔍 Query 1 - associatedHospitalId:', hospital._id.toString(), 'Found:', inpatients.length);
    
    // If no results, try alternative queries
    if (inpatients.length === 0) {
      console.log('🔍 Trying alternative queries...');
      
      // Try with associatedHospital field
      inpatients = await User.find({
        associatedHospital: hospital._id.toString(),
        createdByHospital: true,
        type: 'patient'
      })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .select('fullName email mobileNumber arcId createdAt status gender dateOfBirth address')
      .lean();
      
      console.log('🔍 Query 2 - associatedHospital:', hospital._id.toString(), 'Found:', inpatients.length);
      
      // Try with createdByHospitalId field
      if (inpatients.length === 0) {
        inpatients = await User.find({
          createdByHospitalId: hospital._id.toString(),
          createdByHospital: true,
          type: 'patient'
        })
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(offset))
        .select('fullName email mobileNumber arcId createdAt status gender dateOfBirth address')
        .lean();
        
        console.log('🔍 Query 3 - createdByHospitalId:', hospital._id.toString(), 'Found:', inpatients.length);
      }
      
      // Try finding any users created by this hospital
      if (inpatients.length === 0) {
        const allHospitalUsers = await User.find({
          createdByHospital: true,
          type: 'patient'
        })
        .select('fullName email mobileNumber arcId createdAt status gender dateOfBirth address associatedHospitalId associatedHospital createdByHospitalId')
        .lean();
        
        console.log('🔍 All hospital-created patients:', allHospitalUsers.length);
        for (let user of allHospitalUsers) {
          console.log('👤 User:', user.fullName, 'ARC ID:', user.arcId, 'associatedHospitalId:', user.associatedHospitalId, 'associatedHospital:', user.associatedHospital, 'createdByHospitalId:', user.createdByHospitalId);
        }
        
        // If we still have no results, try a broader search
        if (inpatients.length === 0) {
          console.log('🔍 Trying broader search - looking for any patients with this hospital in any field...');
          
          // Try searching by hospital name
          inpatients = await User.find({
            associatedHospitalName: hospital.hospitalName,
            createdByHospital: true,
            type: 'patient'
          })
          .sort({ createdAt: -1 })
          .limit(parseInt(limit))
          .skip(parseInt(offset))
          .select('fullName email mobileNumber arcId createdAt status gender dateOfBirth address')
          .lean();
          
          console.log('🔍 Query 4 - by hospital name:', hospital.hospitalName, 'Found:', inpatients.length);
        }
      }
    }
    
    const totalCount = await User.countDocuments({
      $or: [
        { associatedHospitalId: hospital._id.toString() },
        { associatedHospital: hospital._id.toString() },
        { createdByHospitalId: hospital._id.toString() }
      ],
      createdByHospital: true,
      type: 'patient'
    });
    
    console.log('✅ Found', inpatients.length, 'inpatients for hospital', hospital.hospitalName);
    
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

// Search inpatients by ARC ID (fallback method)
router.get('/:hospitalId/inpatients/search/:arcId', firebaseAuthMiddleware, async (req, res) => {
  try {
    const { hospitalId, arcId } = req.params;
    
    const User = require('../models/User');
    const Hospital = require('../models/Hospital');
    
    // Find the hospital to get the correct MongoDB _id
    let hospital;
    
    // Check if hospitalId looks like a Firebase UID (not MongoDB ObjectId)
    if (!hospitalId.match(/^[0-9a-fA-F]{24}$/)) {
      hospital = await Hospital.findOne({ uid: hospitalId });
    } else {
      hospital = await Hospital.findById(hospitalId);
    }
    
    if (!hospital) {
      return res.status(404).json({
        success: false,
        message: 'Hospital not found'
      });
    }
    
    console.log('🔍 Searching for ARC ID:', arcId, 'in hospital:', hospital.hospitalName);
    
    // First, let's see all patients with this ARC ID (regardless of hospital)
    const allPatientsWithArcId = await User.find({
      arcId: arcId,
      type: 'patient'
    })
    .select('fullName email mobileNumber arcId createdAt status gender dateOfBirth address associatedHospitalId associatedHospital createdByHospitalId associatedHospitalName createdByHospital')
    .lean();
    
    console.log('🔍 All patients with ARC ID', arcId, ':', allPatientsWithArcId.length);
    for (let p of allPatientsWithArcId) {
      console.log('👤 Patient:', p.fullName, 'ARC:', p.arcId, 'createdByHospital:', p.createdByHospital, 'associatedHospital:', p.associatedHospital, 'associatedHospitalId:', p.associatedHospitalId);
    }
    
    // Search for patient by ARC ID
    const patient = await User.findOne({
      arcId: arcId,
      createdByHospital: true,
      type: 'patient'
    })
    .select('fullName email mobileNumber arcId createdAt status gender dateOfBirth address associatedHospitalId associatedHospital createdByHospitalId associatedHospitalName')
    .lean();
    
    if (patient) {
      console.log('✅ Found patient by ARC ID:', patient.fullName, 'ARC:', patient.arcId);
      console.log('🔍 Patient hospital fields:', {
        associatedHospitalId: patient.associatedHospitalId,
        associatedHospital: patient.associatedHospital,
        createdByHospitalId: patient.createdByHospitalId,
        associatedHospitalName: patient.associatedHospitalName
      });
      
      // Check if this patient belongs to the requesting hospital
      const belongsToHospital = (
        patient.associatedHospitalId === hospital._id.toString() ||
        patient.associatedHospital === hospital._id.toString() ||
        patient.createdByHospitalId === hospital._id.toString() ||
        patient.associatedHospitalName === hospital.hospitalName
      );
      
      if (belongsToHospital) {
        res.json({
          success: true,
          data: [patient],
          count: 1,
          totalCount: 1,
          foundBy: 'ARC ID search'
        });
      } else {
        res.json({
          success: true,
          data: [],
          count: 0,
          totalCount: 0,
          message: 'Patient found but does not belong to this hospital'
        });
      }
    } else {
      res.json({
        success: true,
        data: [],
        count: 0,
        totalCount: 0,
        message: 'No patient found with this ARC ID'
      });
    }
  } catch (e) {
    console.error('❌ Error searching inpatient by ARC ID:', e);
    return res.status(500).json({ success: false, error: e.message });
  }
});

// Migration endpoint to fix existing patients
router.post('/migrate-patients', firebaseAuthMiddleware, async (req, res) => {
  try {
    const User = require('../models/User');
    
    console.log('🔧 Starting patient migration...');
    
    // Find all patients with ARC IDs but missing createdByHospital field
    const patientsToMigrate = await User.find({
      type: 'patient',
      arcId: { $exists: true },
      $or: [
        { createdByHospital: { $exists: false } },
        { createdByHospital: null }
      ]
    });
    
    console.log('🔧 Found', patientsToMigrate.length, 'patients to migrate');
    
    let migratedCount = 0;
    
    for (let patient of patientsToMigrate) {
      // Update the patient with the missing fields
      await User.findByIdAndUpdate(patient._id, {
        $set: {
          createdByHospital: true,
          createdByHospitalId: patient.associatedHospital || 'unknown',
          associatedHospitalId: patient.associatedHospital || 'unknown',
          associatedHospitalName: patient.associatedHospitalName || 'Unknown Hospital'
        }
      });
      
      migratedCount++;
      console.log('✅ Migrated patient:', patient.fullName, 'ARC:', patient.arcId);
    }
    
    console.log('🔧 Migration complete. Migrated', migratedCount, 'patients');
    
    res.json({
      success: true,
      message: `Successfully migrated ${migratedCount} patients`,
      migratedCount: migratedCount
    });
  } catch (e) {
    console.error('❌ Error in patient migration:', e);
    return res.status(500).json({ success: false, error: e.message });
  }
});

// Debug endpoint to show all patients in database
router.get('/debug/all-patients', firebaseAuthMiddleware, async (req, res) => {
  try {
    const User = require('../models/User');
    
    console.log('🔍 Debug: Fetching all patients in database...');
    
    const allPatients = await User.find({
      type: 'patient'
    })
    .select('fullName email mobileNumber arcId createdAt status gender dateOfBirth address associatedHospitalId associatedHospital createdByHospitalId associatedHospitalName createdByHospital')
    .lean();
    
    console.log('🔍 Total patients in database:', allPatients.length);
    
    const patientsWithArcId = allPatients.filter(p => p.arcId);
    console.log('🔍 Patients with ARC ID:', patientsWithArcId.length);
    
    for (let p of patientsWithArcId) {
      console.log('👤 Patient:', p.fullName, 'ARC:', p.arcId, 'createdByHospital:', p.createdByHospital, 'associatedHospital:', p.associatedHospital, 'associatedHospitalId:', p.associatedHospitalId);
    }
    
    res.json({
      success: true,
      totalPatients: allPatients.length,
      patientsWithArcId: patientsWithArcId.length,
      patients: allPatients.map(p => ({
        name: p.fullName,
        arcId: p.arcId,
        email: p.email,
        createdByHospital: p.createdByHospital,
        associatedHospital: p.associatedHospital,
        associatedHospitalId: p.associatedHospitalId,
        createdAt: p.createdAt
      }))
    });
  } catch (e) {
    console.error('❌ Error in debug endpoint:', e);
    return res.status(500).json({ success: false, error: e.message });
  }
});

// NOTE: Do not add another wildcard '/' route here; '/' is already used above
// for getAllApprovedHospitals. Keeping only the earlier route avoids shadowing
// '/nearby' and other specific endpoints.

module.exports = router; 