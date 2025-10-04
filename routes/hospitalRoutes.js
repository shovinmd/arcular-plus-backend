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
    
    let query = { hospitalId: hospitalId };
    if (status) {
      query.status = status;
    }
    
    const alerts = await HospitalAlert.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .lean();
    
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
    
    const alert = await HospitalAlert.findOneAndUpdate(
      { _id: alertId, hospitalId: hospitalId },
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
    const result = await sosController.getHospitalSOSLog(req, res);
    return result;
  } catch (e) {
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
      hospital: hospital.hospitalName
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
    
    const inpatients = await User.find({
      associatedHospitalId: hospitalId,
      createdByHospital: true,
      type: 'patient'
    })
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip(parseInt(offset))
    .select('fullName email mobileNumber arcId createdAt status gender dateOfBirth address')
    .lean();
    
    const totalCount = await User.countDocuments({
      associatedHospitalId: hospitalId,
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

// NOTE: Do not add another wildcard '/' route here; '/' is already used above
// for getAllApprovedHospitals. Keeping only the earlier route avoids shadowing
// '/nearby' and other specific endpoints.

module.exports = router; 