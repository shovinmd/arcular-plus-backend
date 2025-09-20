const express = require('express');
const router = express.Router();
const firebaseAuthMiddleware = require('../middleware/firebaseAuthMiddleware');

// Import models and services
const TestRequest = require('../models/TestRequest');
const User = require('../models/User');
const Hospital = require('../models/Hospital');
const Lab = require('../models/Lab');

// Create a new test request (Hospital)
const createTestRequest = async (req, res) => {
  try {
    const firebaseUser = req.user;
    if (!firebaseUser || !firebaseUser.uid) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const {
      labId,
      patientArcId,
      testName,
      testType,
      testDescription,
      urgency,
      notes,
      doctorNotes
    } = req.body;

    // Validate required fields
    if (!labId || !patientArcId || !testName || !testType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: labId, patientArcId, testName, testType'
      });
    }

    // Get hospital information
    const hospital = await Hospital.findOne({ uid: firebaseUser.uid });
    if (!hospital) {
      return res.status(404).json({ success: false, error: 'Hospital not found' });
    }

    // Get lab information
    let lab = await Lab.findOne({ uid: labId });
    if (!lab) {
      const mongoose = require('mongoose');
      if (mongoose.isValidObjectId(labId)) {
        lab = await Lab.findById(labId);
      }
    }
    if (!lab) {
      return res.status(404).json({ success: false, error: 'Lab not found' });
    }

    // Get patient information
    const patient = await User.findOne({
      $or: [{ arcId: patientArcId }, { healthQrId: patientArcId }]
    });
    if (!patient) {
      return res.status(404).json({ success: false, error: 'Patient not found' });
    }

    // Create test request
    const testRequest = new TestRequest({
      requestId: `TR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      hospitalId: hospital._id,
      hospitalName: hospital.hospitalName || hospital.fullName,
      hospitalUid: hospital.uid,
      labId: lab._id,
      labName: lab.labName || lab.fullName,
      labUid: lab.uid,
      patientId: patient._id,
      patientArcId: patientArcId,
      patientName: patient.fullName,
      patientEmail: patient.email || '',
      patientMobile: patient.mobileNumber || '',
      testName,
      testType,
      testDescription: testDescription || '',
      urgency: urgency || 'Normal',
      notes: notes || '',
      doctorNotes: doctorNotes || '',
      status: 'Pending'
    });

    const savedRequest = await testRequest.save();

    // Send email notification to lab
    try {
      const emailService = require('../services/emailService');
      await emailService.sendTestRequestEmail({
        labName: lab.labName || lab.fullName,
        labEmail: lab.email,
        hospitalName: hospital.hospitalName || hospital.fullName,
        patientName: patient.fullName,
        patientArcId: patientArcId,
        testName: testName,
        testType: testType,
        urgency: urgency || 'Normal',
        requestId: savedRequest.requestId,
        requestedDate: new Date().toLocaleDateString(),
      });
      console.log('✅ Test request email sent to lab:', lab.email);
    } catch (emailError) {
      console.error('❌ Failed to send test request email:', emailError);
      // Don't fail the request if email fails
    }

    res.status(201).json({
      success: true,
      message: 'Test request created successfully',
      data: savedRequest
    });

  } catch (error) {
    console.error('Error creating test request:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validationErrors
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to create test request',
      details: error.message
    });
  }
};

// Get test requests for a lab
const getLabTestRequests = async (req, res) => {
  try {
    const firebaseUser = req.user;
    if (!firebaseUser || !firebaseUser.uid) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { status } = req.query;
    const lab = await Lab.findOne({ uid: firebaseUser.uid });
    if (!lab) {
      return res.status(404).json({ success: false, error: 'Lab not found' });
    }

    let query = { labId: lab._id };
    if (status) {
      query.status = status;
    }

    const testRequests = await TestRequest.find(query)
      .populate('hospitalId', 'hospitalName fullName')
      .populate('patientId', 'fullName email mobileNumber')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: testRequests
    });

  } catch (error) {
    console.error('Error fetching lab test requests:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch test requests'
    });
  }
};

// Get test requests for a hospital
const getHospitalTestRequests = async (req, res) => {
  try {
    const firebaseUser = req.user;
    if (!firebaseUser || !firebaseUser.uid) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { status } = req.query;
    const hospital = await Hospital.findOne({ uid: firebaseUser.uid });
    if (!hospital) {
      return res.status(404).json({ success: false, error: 'Hospital not found' });
    }

    let query = { hospitalId: hospital._id };
    if (status) {
      query.status = status;
    }

    const testRequests = await TestRequest.find(query)
      .populate('labId', 'labName fullName')
      .populate('patientId', 'fullName email mobileNumber')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: testRequests
    });

  } catch (error) {
    console.error('Error fetching hospital test requests:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch test requests'
    });
  }
};

// Get test requests for a patient
const getPatientTestRequests = async (req, res) => {
  try {
    const { patientArcId } = req.params;
    
    const testRequests = await TestRequest.find({ patientArcId })
      .populate('hospitalId', 'hospitalName fullName')
      .populate('labId', 'labName fullName')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: testRequests
    });

  } catch (error) {
    console.error('Error fetching patient test requests:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch test requests'
    });
  }
};

// Update test request status (Lab)
const updateTestRequestStatus = async (req, res) => {
  try {
    const firebaseUser = req.user;
    if (!firebaseUser || !firebaseUser.uid) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { requestId } = req.params;
    const { status, labNotes, scheduledDate, scheduledTime, appointmentSlot, preparationInstructions, billAmount, paymentOptions } = req.body;

    const lab = await Lab.findOne({ uid: firebaseUser.uid });
    if (!lab) {
      return res.status(404).json({ success: false, error: 'Lab not found' });
    }

    const testRequest = await TestRequest.findOne({ requestId, labId: lab._id });
    if (!testRequest) {
      return res.status(404).json({ success: false, error: 'Test request not found' });
    }

    // Update the test request
    const updateData = { status };
    if (labNotes) updateData.labNotes = labNotes;
    if (scheduledDate) updateData.scheduledDate = new Date(scheduledDate);
    if (scheduledTime) updateData.scheduledTime = scheduledTime;
    if (appointmentSlot) updateData.appointmentSlot = appointmentSlot;
    if (preparationInstructions) updateData.preparationInstructions = preparationInstructions;
    if (billAmount !== undefined) updateData.billAmount = billAmount;
    if (paymentOptions) updateData.paymentOptions = paymentOptions;
    
    // Set completion date if status is 'Completed'
    if (status === 'Completed') {
      updateData.completedAt = new Date();
    }

    const updatedRequest = await TestRequest.findByIdAndUpdate(
      testRequest._id,
      updateData,
      { new: true }
    ).populate('hospitalId', 'hospitalName fullName')
     .populate('patientId', 'fullName email mobileNumber');

    // Send email notification if status is 'Admitted'
    if (status === 'Admitted') {
      try {
        const emailService = require('../services/emailService');
        await emailService.sendAppointmentEmail({
          patientName: updatedRequest.patientName,
          patientEmail: updatedRequest.patientEmail,
          labName: updatedRequest.labName,
          testName: updatedRequest.testName,
          scheduledDate: updatedRequest.scheduledDate ? updatedRequest.scheduledDate.toLocaleDateString() : 'TBD',
          scheduledTime: updatedRequest.scheduledTime || 'TBD',
          requestId: updatedRequest.requestId,
          billAmount: updatedRequest.billAmount,
          paymentOptions: updatedRequest.paymentOptions,
        });
        console.log('✅ Appointment email sent to patient:', updatedRequest.patientEmail);
      } catch (emailError) {
        console.error('❌ Failed to send appointment email:', emailError);
        // Don't fail the request if email fails
      }
    }

    // Send email notifications if status is 'Completed'
    if (status === 'Completed') {
      try {
        const emailService = require('../services/emailService');
        
        // Send email to patient
        await emailService.sendTestCompletionEmailToPatient({
          patientName: updatedRequest.patientName,
          patientEmail: updatedRequest.patientEmail,
          labName: updatedRequest.labName,
          testName: updatedRequest.testName,
          requestId: updatedRequest.requestId,
        });
        console.log('✅ Test completion email sent to patient:', updatedRequest.patientEmail);
        
        // Send email to hospital
        await emailService.sendTestCompletionEmailToHospital({
          hospitalEmail: updatedRequest.hospitalEmail || updatedRequest.hospitalId?.email,
          hospitalName: updatedRequest.hospitalName,
          patientName: updatedRequest.patientName,
          patientArcId: updatedRequest.patientArcId,
          labName: updatedRequest.labName,
          testName: updatedRequest.testName,
          requestId: updatedRequest.requestId,
        });
        console.log('✅ Test completion email sent to hospital:', updatedRequest.hospitalEmail || updatedRequest.hospitalId?.email);
      } catch (emailError) {
        console.error('❌ Failed to send test completion emails:', emailError);
        // Don't fail the request if email fails
      }
    }

    res.json({
      success: true,
      message: 'Test request status updated successfully',
      data: updatedRequest
    });

  } catch (error) {
    console.error('Error updating test request status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update test request status'
    });
  }
};

// Upload test report (Lab)
const uploadTestReport = async (req, res) => {
  try {
    const firebaseUser = req.user;
    if (!firebaseUser || !firebaseUser.uid) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { requestId } = req.params;
    const { reportUrl, reportFileName } = req.body;

    const lab = await Lab.findOne({ uid: firebaseUser.uid });
    if (!lab) {
      return res.status(404).json({ success: false, error: 'Lab not found' });
    }

    const testRequest = await TestRequest.findOne({ requestId, labId: lab._id });
    if (!testRequest) {
      return res.status(404).json({ success: false, error: 'Test request not found' });
    }

    // Update the test request with report
    const updatedRequest = await TestRequest.findByIdAndUpdate(
      testRequest._id,
      {
        status: 'Completed',
        completedAt: new Date(),
        reportUrl,
        reportFileName
      },
      { new: true }
    ).populate('hospitalId', 'hospitalName fullName')
     .populate('patientId', 'fullName email mobileNumber');

    res.json({
      success: true,
      message: 'Test report uploaded successfully',
      data: updatedRequest
    });

  } catch (error) {
    console.error('Error uploading test report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload test report'
    });
  }
};

// Get test request statistics
const getTestRequestStats = async (req, res) => {
  try {
    const firebaseUser = req.user;
    if (!firebaseUser || !firebaseUser.uid) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { userType } = req.query;
    let matchQuery = {};

    if (userType === 'lab') {
      const lab = await Lab.findOne({ uid: firebaseUser.uid });
      if (!lab) {
        return res.status(404).json({ success: false, error: 'Lab not found' });
      }
      matchQuery.labId = lab._id;
    } else if (userType === 'hospital') {
      const hospital = await Hospital.findOne({ uid: firebaseUser.uid });
      if (!hospital) {
        return res.status(404).json({ success: false, error: 'Hospital not found' });
      }
      matchQuery.hospitalId = hospital._id;
    }

    const stats = await TestRequest.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const totalRequests = await TestRequest.countDocuments(matchQuery);
    const pendingRequests = await TestRequest.countDocuments({ ...matchQuery, status: 'Pending' });
    const completedRequests = await TestRequest.countDocuments({ ...matchQuery, status: 'Completed' });

    res.json({
      success: true,
      data: {
        totalRequests,
        pendingRequests,
        completedRequests,
        statusBreakdown: stats
      }
    });

  } catch (error) {
    console.error('Error fetching test request stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch test request statistics'
    });
  }
};


// Routes
router.post('/create', firebaseAuthMiddleware, createTestRequest);
router.get('/lab', firebaseAuthMiddleware, getLabTestRequests);
router.get('/hospital', firebaseAuthMiddleware, getHospitalTestRequests);
router.get('/patient/:patientArcId', getPatientTestRequests);
router.put('/:requestId/status', firebaseAuthMiddleware, updateTestRequestStatus);
router.put('/:requestId/report', firebaseAuthMiddleware, uploadTestReport);
router.get('/stats', firebaseAuthMiddleware, getTestRequestStats);

module.exports = router;
