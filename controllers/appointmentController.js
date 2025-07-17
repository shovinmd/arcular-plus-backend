const Appointment = require('../models/Appointment');
const { validationResult } = require('express-validator');
const nodemailer = require('nodemailer');

// Configure transporter (replace with your SMTP credentials)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Get appointments for a user
const getAppointmentsByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { userType = 'patient' } = req.query;

    let appointments;
    if (userType === 'doctor') {
      appointments = await Appointment.findByDoctor(userId);
    } else {
      appointments = await Appointment.findByPatient(userId);
    }

    res.json({
      success: true,
      data: appointments,
      count: appointments.length
    });
  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch appointments'
    });
  }
};

// Create new appointment
const createAppointment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const {
      doctorName,
      doctorId,
      patientId,
      dateTime,
      status,
      notes,
      duration,
      location,
      type,
      patientEmail // <-- Make sure frontend sends this
    } = req.body;

    const appointment = new Appointment({
      doctorName,
      doctorId,
      patientId,
      dateTime: new Date(dateTime),
      status: status || 'Scheduled',
      notes,
      duration: duration || 30,
      location,
      type: type || 'Consultation'
    });

    await appointment.save();

    // Send confirmation email
    if (patientEmail) {
      const mailOptions = {
        from: 'shovinmicheldavid1285@gmail.com',
        to: patientEmail,
        subject: 'Appointment Confirmation',
        text: `Dear Patient,\n\nYour appointment with Dr. ${doctorName} is confirmed for ${dateTime}.\n\nThank you for using Arcular Plus!`,
      };
      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error('Error sending confirmation email:', error);
        } else {
          console.log('Confirmation email sent:', info.response);
        }
      });
    }

    res.status(201).json({
      success: true,
      data: appointment,
      message: 'Appointment created successfully'
    });
  } catch (error) {
    console.error('Error creating appointment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create appointment'
    });
  }
};

// Update appointment
const updateAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const appointment = await Appointment.findById(id);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: 'Appointment not found'
      });
    }

    // Update appointment
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        if (key === 'dateTime') {
          appointment[key] = new Date(updateData[key]);
        } else {
          appointment[key] = updateData[key];
        }
      }
    });

    await appointment.save();

    res.json({
      success: true,
      data: appointment,
      message: 'Appointment updated successfully'
    });
  } catch (error) {
    console.error('Error updating appointment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update appointment'
    });
  }
};

// Delete appointment
const deleteAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const appointment = await Appointment.findById(id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: 'Appointment not found'
      });
    }

    await Appointment.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Appointment deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting appointment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete appointment'
    });
  }
};

// Get upcoming appointments
const getUpcomingAppointments = async (req, res) => {
  try {
    const { userId } = req.params;
    const { userType = 'patient' } = req.query;

    const appointments = await Appointment.findUpcoming(userId, userType);

    res.json({
      success: true,
      data: appointments,
      count: appointments.length
    });
  } catch (error) {
    console.error('Error fetching upcoming appointments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch upcoming appointments'
    });
  }
};

// Get appointment by ID
const getAppointmentById = async (req, res) => {
  try {
    const { id } = req.params;
    const appointment = await Appointment.findById(id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: 'Appointment not found'
      });
    }

    res.json({
      success: true,
      data: appointment
    });
  } catch (error) {
    console.error('Error fetching appointment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch appointment'
    });
  }
};

module.exports = {
  getAppointmentsByUser,
  createAppointment,
  updateAppointment,
  deleteAppointment,
  getUpcomingAppointments,
  getAppointmentById
}; 