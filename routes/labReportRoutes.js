const express = require('express');
const router = express.Router();
const firebaseAuthMiddleware = require('../middleware/firebaseAuthMiddleware');
const LabReport = require('../models/LabReport');
const Notification = require('../models/Notification');

// Get all lab reports for a user
router.get('/user/:userId', firebaseAuthMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const labReports = await LabReport.find({ userId }).sort({ reportDate: -1 });
    
    res.json({
      success: true,
      data: labReports,
      count: labReports.length
    });
  } catch (error) {
    console.error('Error fetching lab reports:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch lab reports'
    });
  }
});

// Get lab report by ID
router.get('/:id', firebaseAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const labReport = await LabReport.findById(id);
    
    if (!labReport) {
      return res.status(404).json({
        success: false,
        error: 'Lab report not found'
      });
    }
    
    res.json({
      success: true,
      data: labReport
    });
  } catch (error) {
    console.error('Error fetching lab report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch lab report'
    });
  }
});

// Create new lab report (for labs to add reports)
router.post('/', firebaseAuthMiddleware, async (req, res) => {
  try {
    const {
      userId,
      testName,
      testType,
      result,
      normalRange,
      unit,
      labName,
      doctorName,
      notes,
      fileUrl
    } = req.body;

    const labReport = new LabReport({
      userId,
      testName,
      testType,
      result,
      normalRange,
      unit,
      labName,
      doctorName,
      notes,
      fileUrl,
      reportDate: new Date()
    });

    await labReport.save();

    // Create notification for user
    try {
      const userNotification = new Notification({
        userId: userId,
        title: 'New Lab Report Available',
        message: `Your ${testName} lab report is ready. Click to view.`,
        type: 'lab_report',
        isRead: false,
        actionUrl: `/lab-reports/${labReport._id}`,
        createdAt: new Date(),
      });
      await userNotification.save();
    } catch (notificationError) {
      console.error('Error creating user notification:', notificationError);
    }

    res.status(201).json({
      success: true,
      data: labReport,
      message: 'Lab report created successfully'
    });
  } catch (error) {
    console.error('Error creating lab report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create lab report'
    });
  }
});

// Update lab report (for labs to update existing reports)
router.put('/:id', firebaseAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const labReport = await LabReport.findById(id);
    if (!labReport) {
      return res.status(404).json({
        success: false,
        error: 'Lab report not found'
      });
    }

    // Update fields
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        if (key === 'reportDate') {
          labReport[key] = new Date(updateData[key]);
        } else {
          labReport[key] = updateData[key];
        }
      }
    });

    labReport.updatedAt = new Date();
    await labReport.save();

    // Create notification for user about updated report
    try {
      const userNotification = new Notification({
        userId: labReport.userId,
        title: 'Lab Report Updated',
        message: `Your ${labReport.testName} lab report has been updated. Click to view.`,
        type: 'lab_report',
        isRead: false,
        actionUrl: `/lab-reports/${labReport._id}`,
        createdAt: new Date(),
      });
      await userNotification.save();
    } catch (notificationError) {
      console.error('Error creating update notification:', notificationError);
    }

    res.json({
      success: true,
      data: labReport,
      message: 'Lab report updated successfully'
    });
  } catch (error) {
    console.error('Error updating lab report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update lab report'
    });
  }
});

// Delete lab report
router.delete('/:id', firebaseAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const labReport = await LabReport.findById(id);
    
    if (!labReport) {
      return res.status(404).json({
        success: false,
        error: 'Lab report not found'
      });
    }
    
    await LabReport.findByIdAndDelete(id);
    
    res.json({
      success: true,
      message: 'Lab report deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting lab report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete lab report'
    });
  }
});

// Get lab reports by lab (for lab staff to see their reports)
router.get('/lab/:labId', firebaseAuthMiddleware, async (req, res) => {
  try {
    const { labId } = req.params;
    const labReports = await LabReport.find({ labId }).sort({ reportDate: -1 });
    
    res.json({
      success: true,
      data: labReports,
      count: labReports.length
    });
  } catch (error) {
    console.error('Error fetching lab reports by lab:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch lab reports'
    });
  }
});

module.exports = router; 