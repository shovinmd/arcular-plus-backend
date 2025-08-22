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

// Update user profile
router.put('/:uid', authenticateToken, require('../controllers/userController').updateUser);

// Add user registration/sync endpoint
router.post('/register', firebaseAuthMiddleware, require('../controllers/userController').registerOrSyncUser);
router.get('/profile', firebaseAuthMiddleware, getUserProfile);

// Add public endpoint to get user by ARC ID
router.get('/arc/:arcId', getUserByArcId);

// Public endpoint for QR code scanning - shows limited user info
router.get('/qr/:arcId', async (req, res) => {
  try {
    const { arcId } = req.params;
    const user = await User.findOne({ arcId });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Return only public health information for QR scanning
    const publicInfo = {
      arcId: user.arcId,
      fullName: user.fullName,
      bloodGroup: user.bloodGroup,
      emergencyContactName: user.emergencyContactName,
      emergencyContactNumber: user.emergencyContactNumber,
      emergencyContactRelation: user.emergencyContactRelation,
      knownAllergies: user.knownAllergies || [],
      chronicConditions: user.chronicConditions || [],
      isPregnant: user.isPregnant || false,
      // Add health history summary
      healthSummary: {
        hasAllergies: (user.knownAllergies || []).length > 0,
        hasChronicConditions: (user.chronicConditions || []).length > 0,
        isPregnant: user.isPregnant || false,
        bloodGroup: user.bloodGroup,
      }
    };

    res.json(publicInfo);
  } catch (error) {
    console.error('Error fetching user by QR:', error);
    res.status(500).json({ error: 'Internal server error' });
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
