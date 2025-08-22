const express = require('express');
const router = express.Router();
const firebaseAuthMiddleware = require('../middleware/firebaseAuthMiddleware');
const Medication = require('../models/Medication');
const Notification = require('../models/Notification');

// Get all medications for a user
router.get('/user/:userId', firebaseAuthMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const medications = await Medication.find({ userId }).sort({ prescribedDate: -1 });
    
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
});

// Get medication by ID
router.get('/:id', firebaseAuthMiddleware, async (req, res) => {
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
});

// Create new medication (for doctors/pharmacies to add medications)
router.post('/', firebaseAuthMiddleware, async (req, res) => {
  try {
    const {
      userId,
      name,
      dose,
      frequency,
      type,
      prescribedDate,
      endDate,
      doctorName,
      pharmacyName,
      notes,
      instructions
    } = req.body;

    const medication = new Medication({
      userId,
      name,
      dose,
      frequency,
      type,
      prescribedDate: prescribedDate ? new Date(prescribedDate) : new Date(),
      endDate: endDate ? new Date(endDate) : null,
      doctorName,
      pharmacyName,
      notes,
      instructions,
      isTaken: false,
      createdAt: new Date()
    });

    await medication.save();

    // Create notification for user
    try {
      const userNotification = new Notification({
        userId: userId,
        title: 'New Medication Prescribed',
        message: `You have been prescribed ${name}. Click to view details.`,
        type: 'medication',
        isRead: false,
        actionUrl: `/medications/${medication._id}`,
        createdAt: new Date(),
      });
      await userNotification.save();
    } catch (notificationError) {
      console.error('Error creating user notification:', notificationError);
    }

    res.status(201).json({
      success: true,
      data: medication,
      message: 'Medication created successfully'
    });
  } catch (error) {
    console.error('Error creating medication:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create medication'
    });
  }
});

// Update medication (for pharmacies to update medication details)
router.put('/:id', firebaseAuthMiddleware, async (req, res) => {
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

    // Update fields
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        if (key === 'prescribedDate' || key === 'endDate') {
          medication[key] = new Date(updateData[key]);
        } else {
          medication[key] = updateData[key];
        }
      }
    });

    medication.updatedAt = new Date();
    await medication.save();

    // Create notification for user about updated medication
    try {
      const userNotification = new Notification({
        userId: medication.userId,
        title: 'Medication Updated',
        message: `Your ${medication.name} medication details have been updated. Click to view.`,
        type: 'medication',
        isRead: false,
        actionUrl: `/medications/${medication._id}`,
        createdAt: new Date(),
      });
      await userNotification.save();
    } catch (notificationError) {
      console.error('Error creating update notification:', notificationError);
    }

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
});

// Update medication taken status (for users to mark as taken)
router.patch('/:id/taken', firebaseAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { isTaken } = req.body;

    const medication = await Medication.findById(id);
    if (!medication) {
      return res.status(404).json({
        success: false,
        error: 'Medication not found'
      });
    }

    medication.isTaken = isTaken;
    medication.updatedAt = new Date();
    await medication.save();

    res.json({
      success: true,
      data: medication,
      message: 'Medication status updated successfully'
    });
  } catch (error) {
    console.error('Error updating medication status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update medication status'
    });
  }
});

// Delete medication
router.delete('/:id', firebaseAuthMiddleware, async (req, res) => {
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
});

// Get medications by pharmacy (for pharmacy staff to see their medications)
router.get('/pharmacy/:pharmacyId', firebaseAuthMiddleware, async (req, res) => {
  try {
    const { pharmacyId } = req.params;
    const medications = await Medication.find({ pharmacyId }).sort({ prescribedDate: -1 });
    
    res.json({
      success: true,
      data: medications,
      count: medications.length
    });
  } catch (error) {
    console.error('Error fetching medications by pharmacy:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch medications'
    });
  }
});

module.exports = router; 