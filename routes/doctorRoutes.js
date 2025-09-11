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

// Get all specialties
router.get('/specialties', firebaseAuthMiddleware, async (req, res) => {
  try {
    console.log('🔍 Fetching all specialties...');
    
    // Get all doctors (temporarily including non-approved for testing)
    const doctors = await Doctor.find({});
    
    console.log(`📊 Found ${doctors.length} total doctors`);
    
    // Debug: Check if the doctor with multiple specializations is approved
    const doctorWithMultipleSpecs = await Doctor.findOne({ fullName: 'sdfs' });
    if (doctorWithMultipleSpecs) {
      console.log(`🔍 Doctor 'sdfs' status:`, {
        isApproved: doctorWithMultipleSpecs.isApproved,
        status: doctorWithMultipleSpecs.status,
        specializations: doctorWithMultipleSpecs.specializations
      });
    }
    
    const specialtiesSet = new Set();
    
    doctors.forEach(doctor => {
      // Add single specialization
      if (doctor.specialization && doctor.specialization.trim()) {
        specialtiesSet.add(doctor.specialization.trim());
      }
      
      // Add multiple specializations
      if (doctor.specializations && Array.isArray(doctor.specializations)) {
        doctor.specializations.forEach(spec => {
          if (spec && spec.trim()) {
            specialtiesSet.add(spec.trim());
          }
        });
      }
    });
    
    const specialties = Array.from(specialtiesSet).sort();
    
    console.log(`📊 Found ${doctors.length} doctors`);
    console.log(`✅ Found ${specialties.length} unique specialties:`, specialties);
    
    // Debug: Show sample doctors and their specializations
    console.log('🔍 Sample doctors and their specializations:');
    for (let i = 0; i < Math.min(3, doctors.length); i++) {
      const doctor = doctors[i];
      console.log(`  ${i + 1}. ${doctor.fullName}`);
      console.log(`     - Specialization: ${doctor.specialization}`);
      console.log(`     - Specializations: ${JSON.stringify(doctor.specializations)}`);
    }
    
    res.json({
      success: true,
      data: specialties
    });
  } catch (error) {
    console.error('❌ Error fetching specialties:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch specialties',
      details: error.message 
    });
  }
});


// Get doctor by UID
router.get('/uid/:uid', firebaseAuthMiddleware, doctorController.getDoctorByUID);

// Get doctors affiliated to a hospital (by Mongo _id)
router.get('/affiliated/:hospitalId', firebaseAuthMiddleware, doctorController.getDoctorsByAffiliation);

// Associate doctor to current hospital by ARC ID
router.post('/associate/by-arcid', firebaseAuthMiddleware, doctorController.associateDoctorByArcId);

// Remove doctor association from current hospital
router.delete('/remove-association/:doctorId', firebaseAuthMiddleware, doctorController.removeDoctorAssociation);

// Get doctor by email (for login verification)
router.get('/email/:email', firebaseAuthMiddleware, doctorController.getDoctorByEmail);

// Get doctor by email (for login verification - unprotected)
router.get('/login-email/:email', doctorController.getDoctorByEmail);

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

// Public QR scanning endpoints
router.get('/qr/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    console.log('🔍 Doctor QR Scan Request - Raw Identifier:', identifier);

    // Try to find doctor by ARC ID first
    let doctor = await Doctor.findOne({ arcId: identifier });
    
    if (!doctor) {
      // If not found by ARC ID, try by UID
      doctor = await Doctor.findOne({ uid: identifier });
    }

    if (!doctor) {
      return res.status(404).json({ 
        error: 'Doctor not found',
        message: 'No doctor found with the provided identifier'
      });
    }

    // Return limited doctor info for QR scanning
    res.json({
      success: true,
      type: 'doctor',
      data: {
        uid: doctor.uid,
        arcId: doctor.arcId,
        fullName: doctor.fullName,
        email: doctor.email,
        mobileNumber: doctor.mobileNumber,
        specialization: doctor.specialization,
        experienceYears: doctor.experienceYears || 0,
        consultationFee: doctor.consultationFee || 0,
        hospitalAffiliation: doctor.currentHospital,
        profileImageUrl: doctor.profileImageUrl,
        isApproved: doctor.isApproved,
        approvalStatus: doctor.approvalStatus,
      }
    });
  } catch (error) {
    console.error('Error fetching doctor by QR:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/qr/uid/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    console.log('🔍 Doctor QR Scan Request by UID:', uid);

    const doctor = await Doctor.findOne({ uid });

    if (!doctor) {
      return res.status(404).json({ 
        error: 'Doctor not found',
        message: 'No doctor found with the provided UID'
      });
    }

    // Return limited doctor info for QR scanning
    res.json({
      success: true,
      type: 'doctor',
      data: {
        uid: doctor.uid,
        arcId: doctor.arcId,
        fullName: doctor.fullName,
        email: doctor.email,
        mobileNumber: doctor.mobileNumber,
        specialization: doctor.specialization,
        experienceYears: doctor.experienceYears || 0,
        consultationFee: doctor.consultationFee || 0,
        hospitalAffiliation: doctor.currentHospital,
        profileImageUrl: doctor.profileImageUrl,
        isApproved: doctor.isApproved,
        approvalStatus: doctor.approvalStatus,
      }
    });
  } catch (error) {
    console.error('Error fetching doctor by UID:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 