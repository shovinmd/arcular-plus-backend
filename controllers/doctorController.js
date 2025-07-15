const Doctor = require('../models/Doctor');
const { validationResult } = require('express-validator');

// Get all doctors
const getAllDoctors = async (req, res) => {
  try {
    const doctors = await Doctor.findActive();
    res.json({
      success: true,
      data: doctors,
      count: doctors.length
    });
  } catch (error) {
    console.error('Error fetching doctors:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch doctors'
    });
  }
};

// Get doctors by hospital
const getDoctorsByHospital = async (req, res) => {
  try {
    const { hospitalId } = req.params;
    const doctors = await Doctor.findByHospital(hospitalId);

    res.json({
      success: true,
      data: doctors,
      count: doctors.length
    });
  } catch (error) {
    console.error('Error fetching doctors by hospital:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch doctors'
    });
  }
};

// Get doctors by specialization
const getDoctorsBySpecialization = async (req, res) => {
  try {
    const { specialization } = req.params;
    const doctors = await Doctor.findBySpecialization(specialization);

    res.json({
      success: true,
      data: doctors,
      count: doctors.length
    });
  } catch (error) {
    console.error('Error fetching doctors by specialization:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch doctors'
    });
  }
};

// Create new doctor
const createDoctor = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const {
      name,
      specialization,
      hospitalId,
      email,
      phone,
      licenseNumber,
      experience,
      education,
      bio,
      imageUrl
    } = req.body;

    // Check if doctor with same license number exists
    const existingDoctor = await Doctor.findOne({ licenseNumber });
    if (existingDoctor) {
      return res.status(400).json({
        success: false,
        error: 'Doctor with this license number already exists'
      });
    }

    // Check if email already exists
    const existingEmail = await Doctor.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        error: 'Email already registered'
      });
    }

    const doctor = new Doctor({
      name,
      specialization,
      hospitalId,
      email,
      phone,
      licenseNumber,
      experience: experience || 0,
      education,
      bio,
      imageUrl,
      status: 'active'
    });

    await doctor.save();

    res.status(201).json({
      success: true,
      data: doctor,
      message: 'Doctor added successfully'
    });
  } catch (error) {
    console.error('Error creating doctor:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add doctor'
    });
  }
};

// Update doctor
const updateDoctor = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const doctor = await Doctor.findById(id);
    if (!doctor) {
      return res.status(404).json({
        success: false,
        error: 'Doctor not found'
      });
    }

    // Update doctor
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        doctor[key] = updateData[key];
      }
    });

    await doctor.save();

    res.json({
      success: true,
      data: doctor,
      message: 'Doctor updated successfully'
    });
  } catch (error) {
    console.error('Error updating doctor:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update doctor'
    });
  }
};

// Delete doctor
const deleteDoctor = async (req, res) => {
  try {
    const { id } = req.params;
    const doctor = await Doctor.findById(id);

    if (!doctor) {
      return res.status(404).json({
        success: false,
        error: 'Doctor not found'
      });
    }

    // Soft delete - change status to inactive
    doctor.status = 'inactive';
    await doctor.save();

    res.json({
      success: true,
      message: 'Doctor deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting doctor:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete doctor'
    });
  }
};

// Search doctors
const searchDoctors = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    const doctors = await Doctor.search(q);

    res.json({
      success: true,
      data: doctors,
      count: doctors.length
    });
  } catch (error) {
    console.error('Error searching doctors:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search doctors'
    });
  }
};

// Get doctor by ID
const getDoctorById = async (req, res) => {
  try {
    const { id } = req.params;
    const doctor = await Doctor.findById(id);

    if (!doctor) {
      return res.status(404).json({
        success: false,
        error: 'Doctor not found'
      });
    }

    res.json({
      success: true,
      data: doctor
    });
  } catch (error) {
    console.error('Error fetching doctor:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch doctor'
    });
  }
};

exports.getDoctorProfile = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.updateDoctorProfile = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.getAppointments = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.updateAppointment = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.getPatients = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.getPatientInfo = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.getPrescriptions = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.createPrescription = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.getPrescriptionDetails = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.getReports = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.uploadReport = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.getReportDetails = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.getAvailability = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.addAvailabilitySlot = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.removeAvailabilitySlot = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.getNotifications = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.updateSettings = async (req, res) => res.status(501).json({ error: 'Not implemented' }); 