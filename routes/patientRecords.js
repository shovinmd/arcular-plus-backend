const express = require('express');
const router = express.Router();
const PatientRecord = require('../models/PatientRecord');
const Prescription = require('../models/Prescription');
const User = require('../models/User');
const Hospital = require('../models/Hospital');
const { authenticateToken: auth } = require('../middleware/auth');

// Create new patient record
router.post('/create', auth, async (req, res) => {
  try {
    const {
      patientArcId,
      patientName,
      hospitalId,
      assignedDoctorId,
      admissionReason,
      diagnosis,
      treatmentPlan,
      medicalHistory,
      allergies,
      emergencyContact
    } = req.body;

    // Validate required fields
    if (!patientArcId || !patientName || !hospitalId || !admissionReason) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: patientArcId, patientName, hospitalId, admissionReason'
      });
    }

    // Check if patient record already exists
    const existingRecord = await PatientRecord.findOne({ patientArcId });
    if (existingRecord) {
      return res.status(400).json({
        success: false,
        message: 'Patient record already exists for this ARC ID'
      });
    }

    // Verify hospital exists
    const hospital = await Hospital.findOne({ uid: hospitalId });
    if (!hospital) {
      return res.status(400).json({
        success: false,
        message: 'Invalid hospital ID'
      });
    }

    // Verify doctor exists if assigned
    let assignedDoctorName = '';
    if (assignedDoctorId) {
      const doctor = await User.findById(assignedDoctorId);
      if (!doctor || doctor.userType !== 'doctor') {
        return res.status(400).json({
          success: false,
          message: 'Invalid doctor ID'
        });
      }
      assignedDoctorName = doctor.fullName;
    }

    // Generate unique patient ID
    const patientId = `PAT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create patient record
    const patientRecord = new PatientRecord({
      patientArcId,
      patientName,
      patientId,
      hospitalId: hospital._id, // Use MongoDB ObjectId for reference
      hospitalName: hospital.fullName,
      assignedDoctorId,
      assignedDoctorName,
      admissionReason,
      diagnosis: diagnosis || '',
      treatmentPlan: treatmentPlan || '',
      medicalHistory: medicalHistory || '',
      allergies: allergies || [],
      emergencyContact: emergencyContact || {},
      createdBy: req.user.id
    });

    await patientRecord.save();

    res.status(201).json({
      success: true,
      message: 'Patient record created successfully',
      data: patientRecord
    });

  } catch (error) {
    console.error('❌ Error creating patient record:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating patient record',
      error: error.message
    });
  }
});

// Get patient records by hospital
router.get('/hospital/:hospitalId', auth, async (req, res) => {
  try {
    const { hospitalId } = req.params;
    const { status } = req.query;

    // Build query
    let query = { hospitalId };
    if (status) query.status = status;

    const patientRecords = await PatientRecord.find(query)
      .populate('assignedDoctorId', 'fullName')
      .populate('prescriptions')
      .sort({ admissionDate: -1 });

    res.json({
      success: true,
      data: patientRecords
    });

  } catch (error) {
    console.error('❌ Error fetching hospital patient records:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching patient records',
      error: error.message
    });
  }
});

// Get patient records by doctor
router.get('/doctor/:doctorId', auth, async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { status } = req.query;

    // Build query
    let query = { assignedDoctorId: doctorId };
    if (status) query.status = status;

    const patientRecords = await PatientRecord.find(query)
      .populate('hospitalId', 'fullName')
      .populate('prescriptions')
      .sort({ admissionDate: -1 });

    res.json({
      success: true,
      data: patientRecords
    });

  } catch (error) {
    console.error('❌ Error fetching doctor patient records:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching patient records',
      error: error.message
    });
  }
});

// Get patient record by ARC ID
router.get('/patient/:patientArcId', auth, async (req, res) => {
  try {
    const { patientArcId } = req.params;

    const patientRecord = await PatientRecord.findOne({ patientArcId })
      .populate('assignedDoctorId', 'fullName')
      .populate('prescriptions')
      .populate('hospitalId', 'fullName');

    if (!patientRecord) {
      return res.status(404).json({
        success: false,
        message: 'Patient record not found'
      });
    }

    res.json({
      success: true,
      data: patientRecord
    });

  } catch (error) {
    console.error('❌ Error fetching patient record:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching patient record',
      error: error.message
    });
  }
});

// Update patient record
router.put('/:recordId', auth, async (req, res) => {
  try {
    const { recordId } = req.params;
    const {
      assignedDoctorId,
      diagnosis,
      treatmentPlan,
      medicalHistory,
      allergies,
      emergencyContact,
      notes
    } = req.body;

    const patientRecord = await PatientRecord.findById(recordId);
    if (!patientRecord) {
      return res.status(404).json({
        success: false,
        message: 'Patient record not found'
      });
    }

    // Check if user has permission to update (hospital admin or assigned doctor)
    if (patientRecord.hospitalId.toString() !== req.user.id && 
        patientRecord.assignedDoctorId?.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this patient record'
      });
    }

    // Update fields
    if (assignedDoctorId) {
      const doctor = await User.findById(assignedDoctorId);
      if (doctor && doctor.userType === 'doctor') {
        patientRecord.assignedDoctorId = assignedDoctorId;
        patientRecord.assignedDoctorName = doctor.fullName;
      }
    }
    if (diagnosis) patientRecord.diagnosis = diagnosis;
    if (treatmentPlan) patientRecord.treatmentPlan = treatmentPlan;
    if (medicalHistory) patientRecord.medicalHistory = medicalHistory;
    if (allergies) patientRecord.allergies = allergies;
    if (emergencyContact) patientRecord.emergencyContact = emergencyContact;
    if (notes) patientRecord.notes = notes;

    patientRecord.updatedBy = req.user.id;
    await patientRecord.save();

    res.json({
      success: true,
      message: 'Patient record updated successfully',
      data: patientRecord
    });

  } catch (error) {
    console.error('❌ Error updating patient record:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating patient record',
      error: error.message
    });
  }
});

// Add prescription to patient record
router.post('/:recordId/prescriptions', auth, async (req, res) => {
  try {
    const { recordId } = req.params;
    const { prescriptionId } = req.body;

    const patientRecord = await PatientRecord.findById(recordId);
    if (!patientRecord) {
      return res.status(404).json({
        success: false,
        message: 'Patient record not found'
      });
    }

    // Verify prescription exists
    const prescription = await Prescription.findById(prescriptionId);
    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      });
    }

    // Add prescription to patient record
    await patientRecord.addPrescription(prescriptionId);

    res.json({
      success: true,
      message: 'Prescription added to patient record',
      data: patientRecord
    });

  } catch (error) {
    console.error('❌ Error adding prescription to patient record:', error);
    res.status(500).json({
      success: false,
      message: 'Server error adding prescription',
      error: error.message
    });
  }
});

// Add appointment to patient record
router.post('/:recordId/appointments', auth, async (req, res) => {
  try {
    const { recordId } = req.params;
    const appointmentData = req.body;

    const patientRecord = await PatientRecord.findById(recordId);
    if (!patientRecord) {
      return res.status(404).json({
        success: false,
        message: 'Patient record not found'
      });
    }

    // Add appointment to patient record
    await patientRecord.addAppointment(appointmentData);

    res.json({
      success: true,
      message: 'Appointment added to patient record',
      data: patientRecord
    });

  } catch (error) {
    console.error('❌ Error adding appointment to patient record:', error);
    res.status(500).json({
      success: false,
      message: 'Server error adding appointment',
      error: error.message
    });
  }
});

// Add lab report to patient record
router.post('/:recordId/lab-reports', auth, async (req, res) => {
  try {
    const { recordId } = req.params;
    const labReportData = req.body;

    const patientRecord = await PatientRecord.findById(recordId);
    if (!patientRecord) {
      return res.status(404).json({
        success: false,
        message: 'Patient record not found'
      });
    }

    // Add lab report to patient record
    await patientRecord.addLabReport(labReportData);

    res.json({
      success: true,
      message: 'Lab report added to patient record',
      data: patientRecord
    });

  } catch (error) {
    console.error('❌ Error adding lab report to patient record:', error);
    res.status(500).json({
      success: false,
      message: 'Server error adding lab report',
      error: error.message
    });
  }
});

// Add billing to patient record
router.post('/:recordId/billing', auth, async (req, res) => {
  try {
    const { recordId } = req.params;
    const billingData = req.body;

    const patientRecord = await PatientRecord.findById(recordId);
    if (!patientRecord) {
      return res.status(404).json({
        success: false,
        message: 'Patient record not found'
      });
    }

    // Add billing to patient record
    await patientRecord.addBilling(billingData);

    res.json({
      success: true,
      message: 'Billing added to patient record',
      data: patientRecord
    });

  } catch (error) {
    console.error('❌ Error adding billing to patient record:', error);
    res.status(500).json({
      success: false,
      message: 'Server error adding billing',
      error: error.message
    });
  }
});

// Discharge patient
router.put('/:recordId/discharge', auth, async (req, res) => {
  try {
    const { recordId } = req.params;
    const { dischargeNotes } = req.body;

    const patientRecord = await PatientRecord.findById(recordId);
    if (!patientRecord) {
      return res.status(404).json({
        success: false,
        message: 'Patient record not found'
      });
    }

    // Check if user has permission to discharge (hospital admin)
    if (patientRecord.hospitalId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to discharge this patient'
      });
    }

    // Discharge patient
    await patientRecord.discharge(dischargeNotes);

    res.json({
      success: true,
      message: 'Patient discharged successfully',
      data: patientRecord
    });

  } catch (error) {
    console.error('❌ Error discharging patient:', error);
    res.status(500).json({
      success: false,
      message: 'Server error discharging patient',
      error: error.message
    });
  }
});

// Archive patient record
router.put('/:recordId/archive', auth, async (req, res) => {
  try {
    const { recordId } = req.params;
    const { archiveReason } = req.body;

    const patientRecord = await PatientRecord.findById(recordId);
    if (!patientRecord) {
      return res.status(404).json({
        success: false,
        message: 'Patient record not found'
      });
    }

    // Check if user has permission to archive (hospital admin)
    if (patientRecord.hospitalId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to archive this patient record'
      });
    }

    // Archive patient record
    await patientRecord.archive(archiveReason);

    res.json({
      success: true,
      message: 'Patient record archived successfully',
      data: patientRecord
    });

  } catch (error) {
    console.error('❌ Error archiving patient record:', error);
    res.status(500).json({
      success: false,
      message: 'Server error archiving patient record',
      error: error.message
    });
  }
});

module.exports = router;
