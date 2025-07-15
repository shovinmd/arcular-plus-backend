const Medication = require('../models/Medication');
const { validationResult } = require('express-validator');

// Get medications for a user
const getMedicationsByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.query;

    let medications;
    if (status === 'active') {
      medications = await Medication.findActiveByPatient(userId);
    } else {
      medications = await Medication.findByPatient(userId);
    }

    res.json({
      success: true,
      data: medications,
      count: medications.length
    });
  } catch (error) {
    console.error('Error fetching medications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch medications'
    });
  }
};

// Create new medication
const createMedication = async (req, res) => {
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
      dose,
      frequency,
      type,
      patientId,
      doctorId,
      endDate,
      instructions,
      sideEffects,
      quantity,
      unit
    } = req.body;

    const medication = new Medication({
      name,
      dose,
      frequency,
      type: type || 'tablet',
      patientId,
      doctorId,
      endDate: endDate ? new Date(endDate) : null,
      instructions,
      sideEffects,
      quantity: quantity || 1,
      unit: unit || 'tablets',
      status: 'active'
    });

    await medication.save();

    res.status(201).json({
      success: true,
      data: medication,
      message: 'Medication assigned successfully'
    });
  } catch (error) {
    console.error('Error creating medication:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to assign medication'
    });
  }
};

// Update medication
const updateMedication = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const medication = await Medication.findById(id);
    if (!medication) {
      return res.status(404).json({
        success: false,
        error: 'Medication not found'
      });
    }

    // Update medication
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        if (key === 'endDate') {
          medication[key] = updateData[key] ? new Date(updateData[key]) : null;
        } else {
          medication[key] = updateData[key];
        }
      }
    });

    await medication.save();

    res.json({
      success: true,
      data: medication,
      message: 'Medication updated successfully'
    });
  } catch (error) {
    console.error('Error updating medication:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update medication'
    });
  }
};

// Delete medication
const deleteMedication = async (req, res) => {
  try {
    const { id } = req.params;
    const medication = await Medication.findById(id);

    if (!medication) {
      return res.status(404).json({
        success: false,
        error: 'Medication not found'
      });
    }

    await Medication.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Medication deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting medication:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete medication'
    });
  }
};

// Mark medication as taken
const markAsTaken = async (req, res) => {
  try {
    const { id } = req.params;
    const medication = await Medication.findById(id);

    if (!medication) {
      return res.status(404).json({
        success: false,
        error: 'Medication not found'
      });
    }

    await medication.markAsTaken();

    res.json({
      success: true,
      data: medication,
      message: 'Medication marked as taken'
    });
  } catch (error) {
    console.error('Error marking medication as taken:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark medication as taken'
    });
  }
};

// Mark medication as not taken
const markAsNotTaken = async (req, res) => {
  try {
    const { id } = req.params;
    const medication = await Medication.findById(id);

    if (!medication) {
      return res.status(404).json({
        success: false,
        error: 'Medication not found'
      });
    }

    await medication.markAsNotTaken();

    res.json({
      success: true,
      data: medication,
      message: 'Medication marked as not taken'
    });
  } catch (error) {
    console.error('Error marking medication as not taken:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark medication as not taken'
    });
  }
};

// Get pending medications
const getPendingMedications = async (req, res) => {
  try {
    const { userId } = req.params;
    const medications = await Medication.findPendingByPatient(userId);

    res.json({
      success: true,
      data: medications,
      count: medications.length
    });
  } catch (error) {
    console.error('Error fetching pending medications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pending medications'
    });
  }
};

// Get medication by ID
const getMedicationById = async (req, res) => {
  try {
    const { id } = req.params;
    const medication = await Medication.findById(id);

    if (!medication) {
      return res.status(404).json({
        success: false,
        error: 'Medication not found'
      });
    }

    res.json({
      success: true,
      data: medication
    });
  } catch (error) {
    console.error('Error fetching medication:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch medication'
    });
  }
};

module.exports = {
  getMedicationsByUser,
  createMedication,
  updateMedication,
  deleteMedication,
  markAsTaken,
  markAsNotTaken,
  getPendingMedications,
  getMedicationById
}; 