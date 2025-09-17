const express = require('express');
const router = express.Router();
const Prescription = require('../models/Prescription');
const User = require('../models/User');
const Hospital = require('../models/Hospital');
const { authenticateToken: auth } = require('../middleware/auth');

// Create new prescription
router.post('/create', auth, async (req, res) => {
  try {
    const {
      patientArcId,
      hospitalId,
      doctorId,
      diagnosis,
      medications,
      instructions,
      followUpDate,
      notes
    } = req.body;

    // Validate required fields
    if (!patientArcId || !hospitalId || !doctorId || !diagnosis) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: patientArcId, hospitalId, doctorId, diagnosis'
      });
    }

    // Verify doctor exists and is associated with hospital
    const doctor = await User.findById(doctorId);
    if (!doctor || doctor.userType !== 'doctor') {
      return res.status(400).json({
        success: false,
        message: 'Invalid doctor ID'
      });
    }

    // Verify hospital exists
    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) {
      return res.status(400).json({
        success: false,
        message: 'Invalid hospital ID'
      });
    }

    // Create prescription
    const prescription = new Prescription({
      patientArcId,
      hospitalId,
      doctorId,
      doctorName: doctor.fullName,
      diagnosis,
      medications: medications || [],
      instructions: instructions || '',
      followUpDate: followUpDate ? new Date(followUpDate) : null,
      notes: notes || '',
      status: 'Active',
      prescriptionDate: new Date(),
      createdBy: req.user.id
    });

    await prescription.save();

    res.status(201).json({
      success: true,
      message: 'Prescription created successfully',
      data: prescription
    });

  } catch (error) {
    console.error('❌ Error creating prescription:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating prescription',
      error: error.message
    });
  }
});

// Get prescriptions by doctor
router.get('/doctor/:doctorId', auth, async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { status, patientArcId } = req.query;

    // Build query
    let query = { doctorId };
    if (status) query.status = status;
    if (patientArcId) query.patientArcId = patientArcId;

    const prescriptions = await Prescription.find(query)
      .sort({ prescriptionDate: -1 })
      .populate('hospitalId', 'fullName')
      .populate('doctorId', 'fullName');

    res.json({
      success: true,
      data: prescriptions
    });

  } catch (error) {
    console.error('❌ Error fetching doctor prescriptions:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching prescriptions',
      error: error.message
    });
  }
});

// Get prescriptions by patient ARC ID
router.get('/patient/:patientArcId', auth, async (req, res) => {
  try {
    const { patientArcId } = req.params;
    const { status } = req.query;

    // Build query
    let query = { patientArcId };
    if (status) query.status = status;

    const prescriptions = await Prescription.find(query)
      .sort({ prescriptionDate: -1 })
      .populate('hospitalId', 'fullName')
      .populate('doctorId', 'fullName');

    res.json({
      success: true,
      data: prescriptions
    });

  } catch (error) {
    console.error('❌ Error fetching patient prescriptions:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching prescriptions',
      error: error.message
    });
  }
});

// Update prescription
router.put('/:prescriptionId', auth, async (req, res) => {
  try {
    const { prescriptionId } = req.params;
    const {
      diagnosis,
      medications,
      instructions,
      followUpDate,
      notes,
      status
    } = req.body;

    const prescription = await Prescription.findById(prescriptionId);
    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      });
    }

    // Check if user has permission to update (doctor or hospital admin)
    if (prescription.doctorId.toString() !== req.user.id && 
        prescription.hospitalId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this prescription'
      });
    }

    // Update fields
    if (diagnosis) prescription.diagnosis = diagnosis;
    if (medications) prescription.medications = medications;
    if (instructions) prescription.instructions = instructions;
    if (followUpDate) prescription.followUpDate = new Date(followUpDate);
    if (notes) prescription.notes = notes;
    if (status) prescription.status = status;

    prescription.updatedAt = new Date();
    await prescription.save();

    res.json({
      success: true,
      message: 'Prescription updated successfully',
      data: prescription
    });

  } catch (error) {
    console.error('❌ Error updating prescription:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating prescription',
      error: error.message
    });
  }
});

// Mark prescription as completed
router.put('/:prescriptionId/complete', auth, async (req, res) => {
  try {
    const { prescriptionId } = req.params;
    const { completionNotes } = req.body;

    const prescription = await Prescription.findById(prescriptionId);
    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      });
    }

    // Check if user has permission to complete (doctor or hospital admin)
    if (prescription.doctorId.toString() !== req.user.id && 
        prescription.hospitalId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to complete this prescription'
      });
    }

    prescription.status = 'Completed';
    prescription.completionDate = new Date();
    if (completionNotes) prescription.completionNotes = completionNotes;
    prescription.updatedAt = new Date();

    await prescription.save();

    res.json({
      success: true,
      message: 'Prescription marked as completed',
      data: prescription
    });

  } catch (error) {
    console.error('❌ Error completing prescription:', error);
    res.status(500).json({
      success: false,
      message: 'Server error completing prescription',
      error: error.message
    });
  }
});

// Archive prescription
router.put('/:prescriptionId/archive', auth, async (req, res) => {
  try {
    const { prescriptionId } = req.params;
    const { archiveReason } = req.body;

    const prescription = await Prescription.findById(prescriptionId);
    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      });
    }

    // Check if user has permission to archive (hospital admin)
    if (prescription.hospitalId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to archive this prescription'
      });
    }

    prescription.status = 'Archived';
    prescription.archiveDate = new Date();
    if (archiveReason) prescription.archiveReason = archiveReason;
    prescription.updatedAt = new Date();

    await prescription.save();

    res.json({
      success: true,
      message: 'Prescription archived successfully',
      data: prescription
    });

  } catch (error) {
    console.error('❌ Error archiving prescription:', error);
    res.status(500).json({
      success: false,
      message: 'Server error archiving prescription',
      error: error.message
    });
  }
});

// Get prescription by ID
router.get('/:prescriptionId', auth, async (req, res) => {
  try {
    const { prescriptionId } = req.params;

    const prescription = await Prescription.findById(prescriptionId)
      .populate('hospitalId', 'fullName')
      .populate('doctorId', 'fullName');

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      });
    }

    res.json({
      success: true,
      data: prescription
    });

  } catch (error) {
    console.error('❌ Error fetching prescription:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching prescription',
      error: error.message
    });
  }
});

module.exports = router;
