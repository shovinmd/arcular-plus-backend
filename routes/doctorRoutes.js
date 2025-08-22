const express = require('express');
const router = express.Router();
const firebaseAuthMiddleware = require('../middleware/firebaseAuthMiddleware');
const Doctor = require('../models/Doctor');
const User = require('../models/User');

// Get all doctors
router.get('/', firebaseAuthMiddleware, async (req, res) => {
  try {
    // Try to get doctors from both collections
    const doctorsFromDoctor = await Doctor.find({});
    const doctorsFromUser = await User.find({ userType: 'doctor' });

    // Combine and format doctors
    const allDoctors = [
      ...doctorsFromDoctor.map(doctor => ({
        uid: doctor.uid,
        fullName: doctor.name || doctor.fullName,
        specialization: doctor.specialization,
        experienceYears: doctor.experienceYears || 0,
        consultationFee: doctor.consultationFee || 0,
        profileImageUrl: doctor.profileImageUrl,
        email: doctor.email,
        mobileNumber: doctor.mobileNumber,
        hospital: doctor.hospital,
        rating: doctor.rating || 4.5,
      })),
      ...doctorsFromUser.map(doctor => ({
        uid: doctor.uid,
        fullName: doctor.fullName,
        specialization: doctor.specialization || 'General',
        experienceYears: doctor.experienceYears || 0,
        consultationFee: doctor.consultationFee || 0,
        profileImageUrl: doctor.profileImageUrl,
        email: doctor.email,
        mobileNumber: doctor.mobileNumber,
        hospital: doctor.hospital,
        rating: doctor.rating || 4.5,
      }))
    ];

    res.json(allDoctors);
  } catch (error) {
    console.error('Error fetching doctors:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

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
    
    // Try to find doctor in both collections
    let doctor = await Doctor.findOne({ uid: doctorId });
    if (!doctor) {
      doctor = await User.findOne({ uid: doctorId, userType: 'doctor' });
    }

    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    const doctorProfile = {
      uid: doctor.uid,
      fullName: doctor.name || doctor.fullName,
      specialization: doctor.specialization,
      experienceYears: doctor.experienceYears || 0,
      consultationFee: doctor.consultationFee || 0,
      profileImageUrl: doctor.profileImageUrl,
      email: doctor.email,
      mobileNumber: doctor.mobileNumber,
      hospital: doctor.hospital,
      rating: doctor.rating || 4.5,
      bio: doctor.bio || '',
      education: doctor.education || [],
      certifications: doctor.certifications || [],
    };

    res.json(doctorProfile);
  } catch (error) {
    console.error('Error fetching doctor profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 