const express = require('express');
const router = express.Router();
const firebaseAuthMiddleware = require('../middleware/firebaseAuthMiddleware');
const Prescription = require('../models/Prescription');
const prescriptionController = require('../controllers/prescriptionController');

// Get all prescriptions for a user
router.get('/user/:userId', firebaseAuthMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.query;

    let prescriptions;
    if (status) {
      prescriptions = await Prescription.findByStatus(userId, status);
    } else {
      prescriptions = await Prescription.findByUser(userId);
    }

    res.json({
      success: true,
      data: prescriptions,
      count: prescriptions.length
    });
  } catch (error) {
    console.error('Error fetching prescriptions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch prescriptions'
    });
  }
});

// Optimized endpoint for app tabs (Active/Completed/Archived)
router.get('/user/:userId/by-status', firebaseAuthMiddleware, prescriptionController.getByUserAndStatus);

// Transform a prescription to medicine payloads for client import
router.get('/:id/transform-to-medicines', firebaseAuthMiddleware, prescriptionController.transformToMedicines);

// Get prescriptions for doctors
router.get('/doctor/:doctorId', firebaseAuthMiddleware, async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { status } = req.query;

    let prescriptions;
    if (status) {
      prescriptions = await Prescription.find({ doctorId, status }).sort({ prescriptionDate: -1 });
    } else {
      prescriptions = await Prescription.findByDoctor(doctorId);
    }

    res.json({
      success: true,
      data: prescriptions,
      count: prescriptions.length
    });
  } catch (error) {
    console.error('Error fetching doctor prescriptions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch doctor prescriptions'
    });
  }
});

// Get prescriptions for pharmacies
router.get('/pharmacy/:pharmacyId', firebaseAuthMiddleware, async (req, res) => {
  try {
    const { pharmacyId } = req.params;
    const { status } = req.query;

    let prescriptions;
    if (status === 'dispensed') {
      prescriptions = await Prescription.findDispensed(pharmacyId);
    } else if (status) {
      prescriptions = await Prescription.find({ pharmacyId, status }).sort({ prescriptionDate: -1 });
    } else {
      prescriptions = await Prescription.findByPharmacy(pharmacyId);
    }

    res.json({
      success: true,
      data: prescriptions,
      count: prescriptions.length
    });
  } catch (error) {
    console.error('Error fetching pharmacy prescriptions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pharmacy prescriptions'
    });
  }
});

// Get pending refill requests for doctors
router.get('/doctor/:doctorId/pending-refills', firebaseAuthMiddleware, async (req, res) => {
  try {
    const { doctorId } = req.params;
    const prescriptions = await Prescription.findPendingRefills(doctorId);

    res.json({
      success: true,
      data: prescriptions,
      count: prescriptions.length
    });
  } catch (error) {
    console.error('Error fetching pending refills:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pending refills'
    });
  }
});

// Get prescription by ID
router.get('/:id', firebaseAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const prescription = await Prescription.findById(id);

    if (!prescription) {
      return res.status(404).json({
        success: false,
        error: 'Prescription not found'
      });
    }

    res.json({
      success: true,
      data: prescription
    });
  } catch (error) {
    console.error('Error fetching prescription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch prescription'
    });
  }
});

// Create new prescription
router.post('/', firebaseAuthMiddleware, async (req, res) => {
  try {
    const {
      userId,
      patientName,
      patientMobile,
      patientEmail,
      doctorId,
      doctorName,
      doctorSpecialty,
      diagnosis,
      medications,
      instructions,
      followUpDate,
      notes
    } = req.body;

    const prescription = new Prescription({
      userId,
      patientName,
      patientMobile,
      patientEmail,
      doctorId,
      doctorName,
      doctorSpecialty,
      diagnosis,
      medications,
      instructions,
      followUpDate,
      notes
    });

    await prescription.save();

    res.status(201).json({
      success: true,
      data: prescription,
      message: 'Prescription created successfully'
    });
  } catch (error) {
    console.error('Error creating prescription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create prescription'
    });
  }
});

// Request refill
router.post('/:id/request-refill', firebaseAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const prescription = await Prescription.findById(id);

    if (!prescription) {
      return res.status(404).json({
        success: false,
        error: 'Prescription not found'
      });
    }

    await prescription.requestRefill();

    res.json({
      success: true,
      data: prescription,
      message: 'Refill request submitted successfully'
    });
  } catch (error) {
    console.error('Error requesting refill:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to request refill'
    });
  }
});

// Approve refill (doctor only)
router.post('/:id/approve-refill', firebaseAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { approvedBy } = req.body;

    const prescription = await Prescription.findById(id);

    if (!prescription) {
      return res.status(404).json({
        success: false,
        error: 'Prescription not found'
      });
    }

    await prescription.approveRefill(approvedBy);

    res.json({
      success: true,
      data: prescription,
      message: 'Refill approved successfully'
    });
  } catch (error) {
    console.error('Error approving refill:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to approve refill'
    });
  }
});

// Dispense medication (pharmacy only)
router.post('/:id/dispense', firebaseAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { pharmacyId, pharmacyName, dispensedBy } = req.body;

    const prescription = await Prescription.findById(id);

    if (!prescription) {
      return res.status(404).json({
        success: false,
        error: 'Prescription not found'
      });
    }

    await prescription.dispenseMedication(pharmacyId, pharmacyName, dispensedBy);

    res.json({
      success: true,
      data: prescription,
      message: 'Medication dispensed successfully'
    });
  } catch (error) {
    console.error('Error dispensing medication:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to dispense medication'
    });
  }
});

// Update prescription
router.put('/:id', firebaseAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const prescription = await Prescription.findById(id);
    if (!prescription) {
      return res.status(404).json({
        success: false,
        error: 'Prescription not found'
      });
    }

    // Update fields
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        if (key === 'prescriptionDate' || key === 'followUpDate') {
          prescription[key] = new Date(updateData[key]);
        } else {
          prescription[key] = updateData[key];
        }
      }
    });

    await prescription.save();

    res.json({
      success: true,
      data: prescription,
      message: 'Prescription updated successfully'
    });
  } catch (error) {
    console.error('Error updating prescription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update prescription'
    });
  }
});

// Update prescription status
router.patch('/:id/status', firebaseAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const prescription = await Prescription.findById(id);
    if (!prescription) {
      return res.status(404).json({
        success: false,
        error: 'Prescription not found'
      });
    }

    await prescription.updateStatus(status);

    res.json({
      success: true,
      data: prescription,
      message: 'Prescription status updated successfully'
    });
  } catch (error) {
    console.error('Error updating prescription status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update prescription status'
    });
  }
});

// Delete prescription
router.delete('/:id', firebaseAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const prescription = await Prescription.findById(id);

    if (!prescription) {
      return res.status(404).json({
        success: false,
        error: 'Prescription not found'
      });
    }

    await Prescription.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Prescription deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting prescription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete prescription'
    });
  }
});

module.exports = router;
