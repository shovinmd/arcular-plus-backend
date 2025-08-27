const express = require('express');
const router = express.Router();
const firebaseAuthMiddleware = require('../middleware/firebaseAuthMiddleware');
const Doctor = require('../models/Doctor');
const doctorController = require('../controllers/doctorController');

// Doctor registration
router.post('/register', firebaseAuthMiddleware, async (req, res) => {
  try {
    console.log('👨‍⚕️ Doctor registration request received');
    console.log('📋 Request body:', JSON.stringify(req.body, null, 2));

    // Map documents from RegistrationService format to expected format
    const { documents } = req.body;
    if (documents) {
      if (documents.medical_degree) {
        req.body.medicalDegreeUrl = documents.medical_degree;
      }
      if (documents.license_certificate) {
        req.body.licenseDocumentUrl = documents.license_certificate;
      }
      if (documents.identity_proof) {
        req.body.identityProofUrl = documents.identity_proof;
      }
    }

    const userData = req.body;
    const { uid } = userData;

    // Check if doctor already exists in Doctor model
    const existingDoctor = await Doctor.findOne({ uid });
    if (existingDoctor) {
      return res.status(400).json({ error: 'Doctor already registered' });
    }

    // Create new doctor user in Doctor model
    const newDoctor = new Doctor({
      ...userData,
      status: userData.status || 'pending',
      isApproved: false,
      approvalStatus: 'pending',
      registrationDate: new Date(),
    });

    const savedDoctor = await newDoctor.save();

    // Send registration confirmation email
    try {
      const { sendRegistrationConfirmation } = require('../services/emailService');
      await sendRegistrationConfirmation(
        savedDoctor.email, 
        savedDoctor.fullName, 
        'doctor'
      );
      console.log('✅ Registration confirmation email sent to doctor');
    } catch (emailError) {
      console.error('❌ Error sending registration confirmation email:', emailError);
    }

    res.status(201).json({
      success: true,
      message: 'Doctor registration successful',
      data: savedDoctor,
      arcId: savedDoctor.arcId,
    });
  } catch (error) {
    console.error('Doctor registration error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Doctor registration failed',
      details: error.message 
    });
  }
});

// Get all doctors
router.get('/', firebaseAuthMiddleware, doctorController.getAllDoctors);

// Get doctor by UID
router.get('/uid/:uid', firebaseAuthMiddleware, doctorController.getDoctorByUID);

// Get doctor by email (for login verification)
router.get('/email/:email', firebaseAuthMiddleware, doctorController.getDoctorByEmail);

// Staff routes for pending approvals
router.get('/pending-approvals', firebaseAuthMiddleware, doctorController.getPendingApprovalsForStaff);
router.post('/:doctorId/approve', firebaseAuthMiddleware, doctorController.approveDoctorByStaff);
router.post('/:doctorId/reject', firebaseAuthMiddleware, doctorController.rejectDoctorByStaff);

// Get doctor availability
router.get('/:doctorId/availability', firebaseAuthMiddleware, async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { date } = req.query;

    // For now, return default availability slots
    // In a real app, this would check the doctor's actual schedule
    const defaultSlots = [
      '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
      '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM'
    ];

    // Generate availability for next 7 days
    const availability = [];
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date();
      currentDate.setDate(currentDate.getDate() + i);
      
      availability.push({
        date: currentDate.toISOString().split('T')[0],
        slots: defaultSlots,
        available: true
      });
    }

    res.json(availability);
  } catch (error) {
    console.error('Error fetching doctor availability:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get doctor profile
router.get('/:doctorId/profile', firebaseAuthMiddleware, async (req, res) => {
  try {
    const { doctorId } = req.params;
    
    // Find doctor in Doctor model only
    const doctor = await Doctor.findOne({ uid: doctorId });

    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    const doctorProfile = {
      uid: doctor.uid,
      fullName: doctor.fullName,
      specialization: doctor.specialization,
      experienceYears: doctor.experienceYears || 0,
      consultationFee: doctor.consultationFee || 0,
      profileImageUrl: doctor.profileImageUrl,
      email: doctor.email,
      mobileNumber: doctor.mobileNumber,
      hospitalAffiliation: doctor.currentHospital,
      affiliatedHospitals: doctor.affiliatedHospitals || [],
      rating: doctor.rating || 4.5,
      bio: doctor.bio || '',
      education: doctor.education || '',
      certifications: doctor.certifications || [],
      qualification: doctor.education || 'MBBS',
      medicalRegistrationNumber: doctor.medicalRegistrationNumber || '',
    };

    res.json(doctorProfile);
  } catch (error) {
    console.error('Error fetching doctor profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get doctors by hospital
router.get('/hospital/:hospitalName', firebaseAuthMiddleware, async (req, res) => {
  try {
    const { hospitalName } = req.params;
    
    // Find doctors affiliated with the hospital from Doctor model only
    const doctors = await Doctor.find({
      $or: [
        { currentHospital: { $regex: hospitalName, $options: 'i' } },
        { affiliatedHospitals: { $regex: hospitalName, $options: 'i' } }
      ]
    });

    const formattedDoctors = doctors.map(doctor => ({
      uid: doctor.uid,
      fullName: doctor.fullName,
      specialization: doctor.specialization,
      experienceYears: doctor.experienceYears || 0,
      consultationFee: doctor.consultationFee || 0,
      hospitalAffiliation: doctor.currentHospital,
    }));

    res.json(formattedDoctors);
  } catch (error) {
    console.error('Error fetching doctors by hospital:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 