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

    // Transform MongoDB _id to id for frontend compatibility
    const transformedMedications = medications.map(med => {
      const medObj = med.toObject();
      return {
        ...medObj,
        id: medObj._id.toString(), // Convert _id to id
        _id: undefined // Remove _id to avoid confusion
      };
    });

    res.json({
      success: true,
      data: transformedMedications,
      count: transformedMedications.length
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

// Create new medication for user (self-added)
const createUserMedication = async (req, res) => {
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
      dosage,
      frequency,
      type,
      duration,
      times,
      instructions,
      startDate,
      endDate
    } = req.body;

    // Get patient ID from authenticated user
    const patientId = req.user?.uid || req.body.patientId;
    if (!patientId) {
      return res.status(400).json({
        success: false,
        error: 'Patient ID is required'
      });
    }

    // Calculate end date if not provided
    let calculatedEndDate = endDate;
    if (!calculatedEndDate && duration) {
      const start = startDate ? new Date(startDate) : new Date();
      if (duration.includes('days')) {
        const days = parseInt(duration.split(' ')[0]) || 7;
        calculatedEndDate = new Date(start.getTime() + (days * 24 * 60 * 60 * 1000));
      } else if (duration.includes('week')) {
        const weeks = parseInt(duration.split(' ')[0]) || 1;
        calculatedEndDate = new Date(start.getTime() + (weeks * 7 * 24 * 60 * 60 * 1000));
      }
    }

    // Validate times based on frequency
    const timeValidation = validateTimesForFrequency(frequency, times);
    if (!timeValidation.isValid) {
      return res.status(400).json({
        success: false,
        error: timeValidation.message
      });
    }

    const medication = new Medication({
      name,
      dose: dosage, // Map dosage to dose field for compatibility
      frequency,
      type,
      patientId,
      doctorId: null, // User-added medicines don't have a doctor
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: calculatedEndDate,
      instructions,
      dosage,
      duration,
      times,
      status: 'active',
      notificationEnabled: true
    });

    await medication.save();

    // Transform MongoDB _id to id for frontend compatibility
    const medObj = medication.toObject();
    const transformedMedication = {
      ...medObj,
      id: medObj._id.toString(), // Convert _id to id
      _id: undefined // Remove _id to avoid confusion
    };

    res.status(201).json({
      success: true,
      data: transformedMedication,
      message: 'Medicine added successfully'
    });
  } catch (error) {
    console.error('❌ Error creating user medication:', error);
    console.error('❌ Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    res.status(500).json({
      success: false,
      error: 'Failed to add medicine',
      details: error.message
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

    // Transform MongoDB _id to id for frontend compatibility
    const medObj = medication.toObject();
    const transformedMedication = {
      ...medObj,
      id: medObj._id.toString(), // Convert _id to id
      _id: undefined // Remove _id to avoid confusion
    };

    res.json({
      success: true,
      data: transformedMedication,
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

    // Update medicine status
    medication.isTaken = true;
    medication.status = 'completed';
    medication.completedAt = new Date();
    medication.lastAction = 'taken';
    
    // Add to action history
    medication.actionHistory.push({
      action: 'taken',
      timestamp: new Date()
    });
    
    await medication.save();

    // Log the action for notification screen
    await logMedicineAction(medication.patientId, medication.name, 'taken');

    // Transform MongoDB _id to id for frontend compatibility
    const medObj = medication.toObject();
    const transformedMedication = {
      ...medObj,
      id: medObj._id.toString(), // Convert _id to id
      _id: undefined // Remove _id to avoid confusion
    };

    res.json({
      success: true,
      data: transformedMedication,
      message: 'Medication marked as taken',
      completedAt: medication.completedAt
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

    // Update medicine status
    medication.isTaken = false;
    medication.status = 'active';
    medication.completedAt = null;
    
    await medication.save();

    // Log the action for notification screen
    await logMedicineAction(medication.patientId, medication.name, 'skipped');

    // Transform MongoDB _id to id for frontend compatibility
    const medObj = medication.toObject();
    const transformedMedication = {
      ...medObj,
      id: medObj._id.toString(), // Convert _id to id
      _id: undefined // Remove _id to avoid confusion
    };

    res.json({
      success: true,
      data: transformedMedication,
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

    // Transform MongoDB _id to id for frontend compatibility
    const transformedMedications = medications.map(med => {
      const medObj = med.toObject();
      return {
        ...medObj,
        id: medObj._id.toString(), // Convert _id to id
        _id: undefined // Remove _id to avoid confusion
      };
    });

    res.json({
      success: true,
      data: transformedMedications,
      count: transformedMedications.length
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

    // Transform MongoDB _id to id for frontend compatibility
    const medObj = medication.toObject();
    const transformedMedication = {
      ...medObj,
      id: medObj._id.toString(), // Convert _id to id
      _id: undefined // Remove _id to avoid confusion
    };

    res.json({
      success: true,
      data: transformedMedication
    });
  } catch (error) {
    console.error('Error fetching medication:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch medication'
    });
  }
};

// Log medicine actions for notification screen
async function logMedicineAction(patientId, medicineName, action) {
  try {
    // This would save to a MedicineActionLog collection
    // For now, we'll just log to console
    console.log(`📝 Medicine Action Log: ${patientId} - ${medicineName} - ${action} at ${new Date()}`);
    
    // TODO: Implement actual logging to database
    // const actionLog = new MedicineActionLog({
    //   patientId,
    //   medicineName,
    //   action,
    //   timestamp: new Date()
    // });
    // await actionLog.save();
    
  } catch (error) {
    console.error('Error logging medicine action:', error);
  }
}

// Validate times based on frequency
function validateTimesForFrequency(frequency, times) {
  if (!Array.isArray(times) || times.length === 0) {
    return { isValid: false, message: 'Times array is required' };
  }

  let requiredCount = 0;
  let minCount = 0;
  let maxCount = 0;
  
  switch (frequency) {
    case 'Once daily':
      requiredCount = 1;
      minCount = 1;
      maxCount = 1;
      break;
    case 'Twice daily':
      requiredCount = 2;
      minCount = 2;
      maxCount = 2;
      break;
    case 'Three times daily':
      requiredCount = 3;
      minCount = 3;
      maxCount = 3;
      break;
    case 'Every 4 hours':
      requiredCount = 2; // Start and end time only
      minCount = 2;
      maxCount = 2;
      break;
    case 'Every 6 hours':
      requiredCount = 2; // Start and end time only
      minCount = 2;
      maxCount = 2;
      break;
    case 'Every 8 hours':
      requiredCount = 2; // Start and end time only
      minCount = 2;
      maxCount = 2;
      break;
    case 'Every 12 hours':
      requiredCount = 2; // Start and end time only
      minCount = 2;
      maxCount = 2;
      break;
    default:
      return { isValid: false, message: 'Invalid frequency' };
  }

  if (times.length < minCount || times.length > maxCount) {
    return { 
      isValid: false, 
      message: `Frequency '${frequency}' requires ${minCount} time(s), but ${times.length} provided` 
    };
  }

  // Validate time format (HH:MM)
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  for (const time of times) {
    if (!timeRegex.test(time)) {
      return { isValid: false, message: `Invalid time format: ${time}. Use HH:MM format` };
    }
  }

  return { isValid: true, message: 'Times validation passed' };
}

module.exports = {
  getMedicationsByUser,
  createMedication,
  createUserMedication,
  updateMedication,
  deleteMedication,
  markAsTaken,
  markAsNotTaken,
  getPendingMedications,
  getMedicationById
}; 