const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const User = require('../models/User');
const { getUserProfile, getUserByArcId } = require('../controllers/userController');
const firebaseAuthMiddleware = require('../middleware/firebaseAuthMiddleware');

// Get user profile
router.get('/:uid', firebaseAuthMiddleware, async (req, res) => {
  const { uid } = req.params;
  const user = await User.findOne({ uid });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// Update user profile (use Firebase auth so mobile app tokens work)
router.put('/:uid', firebaseAuthMiddleware, require('../controllers/userController').updateUser);

// Add user registration/sync endpoint
router.post('/register', firebaseAuthMiddleware, require('../controllers/userController').registerOrSyncUser);
router.get('/profile', firebaseAuthMiddleware, getUserProfile);

// Add public endpoint to get user by ARC ID
router.get('/arc/:arcId', getUserByArcId);

// Debug endpoint to list all users (for testing)
router.get('/debug/users', async (req, res) => {
  try {
    console.log('🔍 Debug: Listing all users...');
    const users = await User.find({}, 'uid arcId fullName email');
    console.log('📊 Found users:', users.length);
    users.forEach(user => {
      console.log(`  - UID: ${user.uid}, ARC ID: ${user.arcId}, Name: ${user.fullName}, Email: ${user.email}`);
    });
    
    res.json({
      count: users.length,
      users: users.map(u => ({
        uid: u.uid,
        arcId: u.arcId,
        fullName: u.fullName,
        email: u.email
      }))
    });
  } catch (error) {
    console.error('❌ Error listing users:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Public endpoint for QR code scanning - shows limited user info
router.get('/qr/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    console.log('🔍 QR Scan Request - Raw Identifier:', identifier);
    
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
    
    // Try to find user by arcId first
    let user = await User.findOne({ arcId: identifier });
    console.log('🔍 Search by arcId result:', user ? 'Found' : 'Not found');
    
    // If not found by arcId, try by extracted UID
    if (!user && extractedUid) {
      console.log('🔄 Trying to find by extracted UID:', extractedUid);
      user = await User.findOne({ uid: extractedUid });
      console.log('🔍 Search by extracted UID result:', user ? 'Found' : 'Not found');
    }
    
    // If still not found, try by original identifier as UID
    if (!user) {
      console.log('🔄 Trying to find by original identifier as UID...');
      user = await User.findOne({ uid: identifier });
      console.log('🔍 Search by original identifier as UID result:', user ? 'Found' : 'Not found');
    }
    
    // If still not found, try by extracted email
    if (!user && extractedEmail) {
      console.log('🔄 Trying to find by extracted email:', extractedEmail);
      user = await User.findOne({ email: extractedEmail });
      console.log('🔍 Search by extracted email result:', user ? 'Found' : 'Not found');
    }
    
    // If still not found, try by original identifier as email
    if (!user) {
      console.log('🔄 Trying to find by original identifier as email...');
      user = await User.findOne({ email: identifier });
      console.log('🔍 Search by original identifier as email result:', user ? 'Found' : 'Not found');
    }
    
    if (!user) {
      console.log('❌ User not found by any method');
      return res.status(404).json({ 
        error: 'User not found',
        searchedFor: identifier,
        extractedUid: extractedUid,
        extractedEmail: extractedEmail,
        message: 'User not found by ARC ID, UID, or email'
      });
    }

    console.log('✅ User found:', user.fullName, 'UID:', user.uid, 'ARC ID:', user.arcId);

    // Return only public health information for QR scanning
    const publicInfo = {
      uid: user.uid,
      arcId: user.arcId,
      fullName: user.fullName,
      dateOfBirth: user.dateOfBirth,
      gender: user.gender,
      bloodGroup: user.bloodGroup,
      height: user.height,
      weight: user.weight,
      profileImageUrl: user.profileImageUrl, // Add profile image
      mobileNumber: user.mobileNumber, // Add mobile number
      alternateMobile: user.alternateMobile, // Add alternate mobile
      address: user.address, // Add address
      pincode: user.pincode, // Add pincode
      city: user.city, // Add city
      state: user.state, // Add state
      emergencyContactName: user.emergencyContactName,
      emergencyContactNumber: user.emergencyContactNumber,
      emergencyContactRelation: user.emergencyContactRelation,
      knownAllergies: user.knownAllergies || [],
      chronicConditions: user.chronicConditions || [],
      isPregnant: user.isPregnant || false,
      numberOfPreviousPregnancies: user.numberOfPreviousPregnancies || 0,
      lastPregnancyYear: user.lastPregnancyYear,
      pregnancyHealthNotes: user.pregnancyHealthNotes,
      lastPeriodStartDate: user.lastPeriodStartDate,
      healthInsuranceId: user.healthInsuranceId,
      policyNumber: user.policyNumber,
      policyExpiryDate: user.policyExpiryDate, // Add policy expiry date
      // Add health history summary
      healthSummary: {
        hasAllergies: (user.knownAllergies || []).length > 0,
        hasChronicConditions: (user.chronicConditions || []).length > 0,
        isPregnant: user.isPregnant || false,
        bloodGroup: user.bloodGroup,
      }
    };

    console.log('📤 Sending public info for:', user.fullName);
    res.json(publicInfo);
  } catch (error) {
    console.error('❌ Error fetching user by QR:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Public endpoint for QR code scanning by UID - shows limited user info
router.get('/uid/:uid', async (req, res) => {
  try {
    const { uid } = req.params;

    console.log('🔍 UID Scan Request - Raw UID:', uid);
    
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
    
    console.log('🔍 Searching for user with UID:', extractedUid);
    const user = await User.findOne({ uid: extractedUid });
    
    if (!user) {
      console.log('❌ User not found by UID:', extractedUid);
      
      // Debug: Check if any users exist in database
      const totalUsers = await User.countDocuments();
      console.log('📊 Total users in database:', totalUsers);
      
      // Debug: Check if the specific UID exists
      const userExists = await User.exists({ uid: extractedUid });
      console.log('🔍 User exists check for UID:', extractedUid, 'Result:', userExists);
      
      return res.status(404).json({ 
        error: 'User not found',
        searchedFor: uid,
        extractedUid: extractedUid,
        totalUsersInDatabase: totalUsers,
        userExistsCheck: userExists,
        message: 'User not found by UID'
      });
    }

    console.log('✅ User found by UID:', user.fullName, 'ARC ID:', user.arcId);

    // Return only public health information for QR scanning
    const publicInfo = {
      uid: user.uid,
      arcId: user.arcId,
      fullName: user.fullName,
      dateOfBirth: user.dateOfBirth,
      gender: user.gender,
      bloodGroup: user.bloodGroup,
      height: user.height,
      weight: user.weight,
      profileImageUrl: user.profileImageUrl, // Add profile image
      mobileNumber: user.mobileNumber, // Add mobile number
      alternateMobile: user.alternateMobile, // Add alternate mobile
      address: user.address, // Add address
      pincode: user.pincode, // Add pincode
      city: user.city, // Add city
      state: user.state, // Add state
      emergencyContactName: user.emergencyContactName,
      emergencyContactNumber: user.emergencyContactNumber,
      emergencyContactRelation: user.emergencyContactRelation,
      knownAllergies: user.knownAllergies || [],
      chronicConditions: user.chronicConditions || [],
      isPregnant: user.isPregnant || false,
      numberOfPreviousPregnancies: user.numberOfPreviousPregnancies || 0,
      lastPregnancyYear: user.lastPregnancyYear,
      pregnancyHealthNotes: user.pregnancyHealthNotes,
      lastPeriodStartDate: user.lastPeriodStartDate,
      healthInsuranceId: user.healthInsuranceId,
      policyNumber: user.policyNumber,
      policyExpiryDate: user.policyExpiryDate, // Add policy expiry date
      // Add health history summary
      healthSummary: {
        hasAllergies: (user.knownAllergies || []).length > 0,
        hasChronicConditions: (user.chronicConditions || []).length > 0,
        isPregnant: user.isPregnant || false,
        bloodGroup: user.bloodGroup,
      }
    };

    console.log('📤 Sending public info for:', user.fullName);
    res.json(publicInfo);
  } catch (error) {
    console.error('❌ Error fetching user by UID for QR:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Get user dashboard statistics
router.get('/:uid/dashboard-stats', firebaseAuthMiddleware, async (req, res) => {
  try {
    const { uid } = req.params;
    const user = await User.findOne({ uid });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get counts from related collections
    const appointments = await require('../models/Appointment').find({ userId: uid });
    const medications = await require('../models/Medication').find({ userId: uid });
    const reports = await require('../models/Report').find({ userId: uid });

    const stats = {
      appointmentsCount: appointments.length,
      medicationsCount: medications.length,
      reportsCount: reports.length,
      lastAppointment: appointments.isNotEmpty ? appointments[appointments.length - 1]?.appointmentDate : null,
      lastMedication: medications.isNotEmpty ? medications[medications.length - 1]?.prescribedDate : null,
      lastReport: reports.isNotEmpty ? reports[reports.length - 1]?.reportDate : null,
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user health summary
router.get('/:uid/health-summary', firebaseAuthMiddleware, async (req, res) => {
  try {
    const { uid } = req.params;
    const user = await User.findOne({ uid });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const healthSummary = {
      bloodGroup: user.bloodGroup,
      height: user.height,
      weight: user.weight,
      bmi: user.bmi,
      bmiCategory: user.bmiCategory,
      knownAllergies: user.knownAllergies || [],
      chronicConditions: user.chronicConditions || [],
      isPregnant: user.isPregnant || false,
      pregnancyTrackingEnabled: user.pregnancyTrackingEnabled || false,
      emergencyContact: {
        name: user.emergencyContactName,
        number: user.emergencyContactNumber,
        relation: user.emergencyContactRelation,
      },
      healthInsurance: {
        id: user.healthInsuranceId,
        policyNumber: user.policyNumber,
        expiryDate: user.policyExpiryDate,
      }
    };

    res.json(healthSummary);
  } catch (error) {
    console.error('Error fetching health summary:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user recent activities
router.get('/:uid/recent-activities', firebaseAuthMiddleware, async (req, res) => {
  try {
    const { uid } = req.params;
    
    // Get recent activities from various collections
    const appointments = await require('../models/Appointment').find({ userId: uid }).sort({ appointmentDate: -1 }).limit(5);
    const medications = await require('../models/Medication').find({ userId: uid }).sort({ prescribedDate: -1 }).limit(5);
    const reports = await require('../models/Report').find({ userId: uid }).sort({ reportDate: -1 }).limit(5);

    const activities = [];

    // Add appointments
    appointments.forEach(appointment => {
      activities.push({
        type: 'appointment',
        title: `Appointment with ${appointment.doctorName || 'Doctor'}`,
        date: appointment.appointmentDate,
        status: appointment.status,
        id: appointment._id,
      });
    });

    // Add medications
    medications.forEach(medication => {
      activities.push({
        type: 'medication',
        title: `Prescribed ${medication.medicineName}`,
        date: medication.prescribedDate,
        status: medication.status,
        id: medication._id,
      });
    });

    // Add reports
    reports.forEach(report => {
      activities.push({
        type: 'report',
        title: `${report.reportType} Report`,
        date: report.reportDate,
        status: report.status,
        id: report._id,
      });
    });

    // Sort by date and limit to 10
    activities.sort((a, b) => b.date - a.date);
    activities.splice(10);

    res.json(activities);
  } catch (error) {
    console.error('Error fetching recent activities:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user notifications
router.get('/:uid/notifications', firebaseAuthMiddleware, async (req, res) => {
  try {
    const { uid } = req.params;
    
    // Get notifications from Notification collection
    const notifications = await require('../models/Notification').find({ userId: uid }).sort({ createdAt: -1 }).limit(20);

    const formattedNotifications = notifications.map(notification => ({
      id: notification._id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      isRead: notification.isRead || false,
      createdAt: notification.createdAt,
      actionUrl: notification.actionUrl,
    }));

    res.json(formattedNotifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user appointments with details
router.get('/:uid/appointments-with-details', firebaseAuthMiddleware, async (req, res) => {
  try {
    const { uid } = req.params;
    
    // Get appointments with doctor details
    const appointments = await require('../models/Appointment').find({ userId: uid }).sort({ appointmentDate: -1 });

    const appointmentsWithDetails = await Promise.all(appointments.map(async (appointment) => {
      let doctorDetails = null;
      
      if (appointment.doctorId) {
        // Try to find doctor in different collections based on user type
        const doctor = await require('../models/Doctor').findOne({ uid: appointment.doctorId }) ||
                      await require('../models/User').findOne({ uid: appointment.doctorId, userType: 'doctor' });
        
        if (doctor) {
          doctorDetails = {
            name: doctor.fullName || doctor.name,
            specialization: doctor.specialization,
            profileImage: doctor.profileImageUrl,
          };
        }
      }

      return {
        id: appointment._id,
        appointmentDate: appointment.appointmentDate,
        appointmentTime: appointment.appointmentTime,
        status: appointment.status,
        type: appointment.appointmentType,
        notes: appointment.notes,
        doctorDetails,
        hospitalName: appointment.hospitalName,
        reason: appointment.reason,
      };
    }));

    res.json(appointmentsWithDetails);
  } catch (error) {
    console.error('Error fetching appointments with details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Test endpoint to check if backend is working
router.get('/test/health', (req, res) => {
  res.json({ message: 'Backend is working!', timestamp: new Date().toISOString() });
});

// Test endpoint to check User model
router.get('/test/user-model', async (req, res) => {
  try {
    const User = require('../models/User');
    const testUser = new User({
      uid: 'test-uid',
      fullName: 'Test User',
      email: 'test@example.com',
      mobileNumber: '1234567890',
      gender: 'Male',
      dateOfBirth: new Date(),
      address: 'Test Address',
      pincode: '123456',
      city: 'Test City',
      state: 'Test State',
      type: 'patient',
      aadhaarNumber: '123456789012',
      aadhaarFrontImageUrl: 'test-front-url',
      aadhaarBackImageUrl: 'test-back-url',
    });
    res.json({ 
      message: 'User model is working!', 
      testUser: testUser.getPublicProfile(),
      hasFindByUid: typeof User.findByUid === 'function'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user medications with details
router.get('/:uid/medications-with-details', firebaseAuthMiddleware, async (req, res) => {
  try {
    const { uid } = req.params;
    const user = await User.findOne({ uid });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const medications = await require('../models/Medication').find({ userId: uid });
    const medicationsWithDetails = medications.map(medication => ({
      id: medication._id,
      name: medication.name,
      dose: medication.dose,
      frequency: medication.frequency,
      type: medication.type,
      isTaken: medication.isTaken,
      prescribedDate: medication.prescribedDate,
      endDate: medication.endDate,
      doctorName: medication.doctorName,
      notes: medication.notes,
    }));

    res.json(medicationsWithDetails);
  } catch (error) {
    console.error('Error fetching medications with details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user lab reports with details
router.get('/:uid/lab-reports-with-details', firebaseAuthMiddleware, async (req, res) => {
  try {
    const { uid } = req.params;
    const user = await User.findOne({ uid });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const labReports = await require('../models/LabReport').find({ userId: uid });
    const reportsWithDetails = labReports.map(report => ({
      id: report._id,
      testName: report.testName,
      testType: report.testType,
      reportDate: report.reportDate,
      result: report.result,
      normalRange: report.normalRange,
      unit: report.unit,
      labName: report.labName,
      doctorName: report.doctorName,
      notes: report.notes,
      fileUrl: report.fileUrl,
    }));

    res.json(reportsWithDetails);
  } catch (error) {
    console.error('Error fetching lab reports with details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user prescriptions with details
router.get('/:uid/prescriptions-with-details', firebaseAuthMiddleware, async (req, res) => {
  try {
    const { uid } = req.params;
    const user = await User.findOne({ uid });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const prescriptions = await require('../models/Prescription').find({ userId: uid });
    const prescriptionsWithDetails = prescriptions.map(prescription => ({
      id: prescription._id,
      doctorName: prescription.doctorName,
      doctorSpecialty: prescription.doctorSpecialty,
      prescriptionDate: prescription.prescriptionDate,
      diagnosis: prescription.diagnosis,
      medications: prescription.medications,
      instructions: prescription.instructions,
      followUpDate: prescription.followUpDate,
      status: prescription.status,
      notes: prescription.notes,
    }));

    res.json(prescriptionsWithDetails);
  } catch (error) {
    console.error('Error fetching prescriptions with details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 
