const LabReport = require('../models/LabReport');
const User = require('../models/User');
const Hospital = require('../models/Hospital');
const nodemailer = require('nodemailer');

// Get lab reports by hospital
const getLabReportsByHospital = async (req, res) => {
  try {
    const { hospitalId } = req.params;
    
    const reports = await LabReport.find({ hospitalId })
      .sort({ createdAt: -1 })
      .populate('labId', 'fullName arcId')
      .populate('patientId', 'fullName phone')
      .populate('doctorId', 'fullName specialization');

    res.json({
      success: true,
      data: reports
    });
  } catch (error) {
    console.error('Error fetching lab reports by hospital:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch lab reports',
      error: error.message
    });
  }
};

// Create lab test request
const createLabTestRequest = async (req, res) => {
  try {
    const {
      labId,
      patientId,
      patientName,
      testName,
      doctorId,
      hospitalId,
      prescription,
      urgency,
      notes
    } = req.body;

    const labReport = new LabReport({
      labId,
      patientId,
      patientName,
      testName,
      doctorId,
      hospitalId,
      prescription,
      urgency: urgency || 'normal',
      notes: notes || '',
      status: 'pending'
    });

    await labReport.save();

    // Send notification to lab (non-blocking)
    try {
      await sendTestRequestNotification(labReport);
    } catch (mailErr) {
      console.error('Test request notification failed (non-blocking):', mailErr);
    }

    res.status(201).json({
      success: true,
      message: 'Test request created successfully',
      data: labReport
    });
  } catch (error) {
    console.error('Error creating lab test request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create test request',
      error: error.message
    });
  }
};

// Update lab report status
const updateLabReportStatus = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { status, results, notes } = req.body;

    const report = await LabReport.findById(reportId);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Lab report not found'
      });
    }

    report.status = status;
    if (results) report.results = results;
    if (notes) report.notes = notes;
    report.updatedAt = new Date();

    await report.save();

    // Send notification to patient and doctor (non-blocking)
    if (status === 'completed') {
      try {
        await sendReportCompletionNotification(report);
      } catch (mailErr) {
        console.error('Report completion notification failed (non-blocking):', mailErr);
      }
    }

    res.json({
      success: true,
      message: 'Report status updated successfully',
      data: report
    });
  } catch (error) {
    console.error('Error updating lab report status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update report status',
      error: error.message
    });
  }
};

// Send test request notification to lab
const sendTestRequestNotification = async (report) => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log('⚠️ Skipping test request notification: EMAIL_USER or EMAIL_PASS not configured');
      return;
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: report.labEmail || 'lab@example.com', // You might need to get lab email from User model
      subject: 'New Test Request - Arcular Plus',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #3498db;">New Test Request</h2>
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>Test Request Details</h3>
            <p><strong>Patient:</strong> ${report.patientName}</p>
            <p><strong>Test:</strong> ${report.testName}</p>
            <p><strong>Urgency:</strong> ${report.urgency}</p>
            <p><strong>Prescription:</strong> ${report.prescription}</p>
            ${report.notes ? `<p><strong>Notes:</strong> ${report.notes}</p>` : ''}
          </div>
          <p>Please process this test request and update the status in your dashboard.</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('✅ Test request notification sent to lab');
  } catch (error) {
    console.error('Error sending test request notification:', error);
  }
};

// Send report completion notification
const sendReportCompletionNotification = async (report) => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log('⚠️ Skipping report completion notification: EMAIL_USER or EMAIL_PASS not configured');
      return;
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    // Email to patient
    const patientMailOptions = {
      from: process.env.EMAIL_USER,
      to: report.patientEmail || 'patient@example.com', // You might need to get patient email from User model
      subject: 'Lab Report Ready - Arcular Plus',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #27ae60;">Lab Report Ready</h2>
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>Report Details</h3>
            <p><strong>Test:</strong> ${report.testName}</p>
            <p><strong>Status:</strong> Completed</p>
            ${report.results ? `<p><strong>Results:</strong> ${report.results}</p>` : ''}
            ${report.notes ? `<p><strong>Notes:</strong> ${report.notes}</p>` : ''}
          </div>
          <p>Your lab report is now available in your health dashboard.</p>
        </div>
      `
    };

    await transporter.sendMail(patientMailOptions);
    console.log('✅ Report completion notification sent to patient');
  } catch (error) {
    console.error('Error sending report completion notification:', error);
  }
};

module.exports = {
  getLabReportsByHospital,
  createLabTestRequest,
  updateLabReportStatus,
  sendTestRequestNotification,
  sendReportCompletionNotification
};