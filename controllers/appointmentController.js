const Appointment = require('../models/Appointment');
const User = require('../models/User');
const Hospital = require('../models/Hospital');
const nodemailer = require('nodemailer');
const fcmService = require('../services/fcmService');

// Create appointment
const createAppointment = async (req, res) => {
  try {
    const {
      doctorId,
      hospitalId,
      appointmentDate,
      appointmentTime,
      reason,
      symptoms,
      medicalHistory,
      appointmentType = 'consultation'
    } = req.body;

    const firebaseUser = req.user;
    if (!firebaseUser || !firebaseUser.uid) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid Firebase user' 
      });
    }

    // Get user information
    const user = await User.findOne({ uid: firebaseUser.uid });
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }

    // Get doctor information (accept uid or _id/id)
    const doctor = await User.findOne({
      type: 'doctor',
      $or: [
        { uid: doctorId },
        { _id: doctorId },
        { id: doctorId }
      ]
    });
    if (!doctor) {
      return res.status(404).json({ 
        success: false, 
        error: 'Doctor not found' 
      });
    }

    // Get hospital information (accept _id, id, name)
    let hospital = null;
    if (hospitalId) {
      hospital = await Hospital.findOne({
        $or: [
          { _id: hospitalId },
          { id: hospitalId },
          { hospitalName: hospitalId }
        ]
      });
    }

    // Check if appointment time is available
    const existingAppointment = await Appointment.findOne({
      doctorId: doctorId,
      appointmentDate: new Date(appointmentDate),
      appointmentTime: appointmentTime,
      appointmentStatus: { $in: ['pending', 'confirmed'] }
    });

    if (existingAppointment) {
      return res.status(400).json({
        success: false,
        error: 'This time slot is already booked'
      });
    }

    // Create appointment
    const appointment = new Appointment({
      userId: firebaseUser.uid,
      userEmail: user.email,
      userName: user.fullName,
      userPhone: user.mobileNumber,
      doctorId: doctorId,
      doctorName: doctor.fullName,
      doctorEmail: doctor.email,
      doctorPhone: doctor.mobileNumber,
      doctorSpecialization: doctor.specialization,
      doctorConsultationFee: doctor.consultationFee,
      hospitalId: hospitalId,
      hospitalName: hospital ? hospital.hospitalName : doctor.hospitalAffiliation,
      hospitalAddress: hospital ? hospital.address : doctor.address,
      appointmentDate: new Date(appointmentDate),
      appointmentTime: appointmentTime,
      appointmentType: appointmentType,
      reason: reason,
      symptoms: symptoms,
      medicalHistory: medicalHistory,
      consultationFee: doctor.consultationFee,
      paymentMethod: 'cash'
    });

    await appointment.save();

    // Send email confirmation
    await sendAppointmentConfirmationEmail(appointment);

    // Send FCM notification to doctor
    if (doctor.fcmToken) {
      await fcmService.sendToUser(doctor.uid, {
        title: 'New Appointment Request',
        body: `New appointment request from ${user.fullName} for ${appointmentDate}`,
        data: {
          type: 'appointment_request',
          appointmentId: appointment.appointmentId,
          userId: firebaseUser.uid
        }
      });
    }

    res.status(201).json({
      success: true,
      message: 'Appointment booked successfully',
      data: appointment
    });

  } catch (error) {
    console.error('Error creating appointment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create appointment'
    });
  }
};

// Get user appointments
const getUserAppointments = async (req, res) => {
  try {
    const firebaseUser = req.user;
    if (!firebaseUser || !firebaseUser.uid) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid Firebase user' 
      });
    }

    const { status, page = 1, limit = 10 } = req.query;
    const query = { userId: firebaseUser.uid };

    if (status) {
      query.appointmentStatus = status;
    }

    const appointments = await Appointment.find(query)
      .sort({ appointmentDate: -1, appointmentTime: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Appointment.countDocuments(query);

    res.json({
      success: true,
      data: appointments,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total: total
      }
    });

  } catch (error) {
    console.error('Error fetching user appointments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch appointments'
    });
  }
};

// Get doctor appointments
const getDoctorAppointments = async (req, res) => {
  try {
    const firebaseUser = req.user;
    if (!firebaseUser || !firebaseUser.uid) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid Firebase user' 
      });
    }

    const { status, date, page = 1, limit = 10 } = req.query;
    const query = { doctorId: firebaseUser.uid };

    if (status) {
      query.appointmentStatus = status;
    }

    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);
      query.appointmentDate = { $gte: startDate, $lt: endDate };
    }

    const appointments = await Appointment.find(query)
      .sort({ appointmentDate: 1, appointmentTime: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Appointment.countDocuments(query);

    res.json({
      success: true,
      data: appointments,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total: total
      }
    });

  } catch (error) {
    console.error('Error fetching doctor appointments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch appointments'
    });
  }
};

// Update appointment status
const updateAppointmentStatus = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { status, notes } = req.body;

    const firebaseUser = req.user;
    if (!firebaseUser || !firebaseUser.uid) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid Firebase user' 
      });
    }

    const appointment = await Appointment.findOne({ 
      appointmentId: appointmentId,
      doctorId: firebaseUser.uid 
    });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: 'Appointment not found'
      });
    }

    appointment.appointmentStatus = status;
    if (notes) appointment.notes = notes;

    if (status === 'confirmed') {
      appointment.confirmedAt = new Date();
    } else if (status === 'completed') {
      appointment.completedAt = new Date();
    } else if (status === 'cancelled') {
      appointment.cancelledAt = new Date();
    }

    await appointment.save();

    // Send notification to user
    const user = await User.findOne({ uid: appointment.userId });
    if (user && user.fcmToken) {
      await fcmService.sendToUser(user.uid, {
        title: 'Appointment Status Updated',
        body: `Your appointment with Dr. ${appointment.doctorName} has been ${status}`,
        data: {
          type: 'appointment_status_update',
          appointmentId: appointment.appointmentId,
          status: status
        }
      });
    }

    res.json({
      success: true,
      message: 'Appointment status updated successfully',
      data: appointment
    });

  } catch (error) {
    console.error('Error updating appointment status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update appointment status'
    });
  }
};

// Get available time slots for a doctor
const getAvailableTimeSlots = async (req, res) => {
  try {
    const { doctorId, date } = req.query;

    if (!doctorId || !date) {
      return res.status(400).json({
        success: false,
        error: 'Doctor ID and date are required'
      });
    }

    const appointmentDate = new Date(date);
    const startOfDay = new Date(appointmentDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(appointmentDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Get booked appointments for the date
    const bookedAppointments = await Appointment.find({
      doctorId: doctorId,
      appointmentDate: { $gte: startOfDay, $lte: endOfDay },
      appointmentStatus: { $in: ['pending', 'confirmed'] }
    });

    const bookedTimes = bookedAppointments.map(apt => apt.appointmentTime);

    // Generate available time slots (9 AM to 6 PM, 30-minute intervals)
    const availableSlots = [];
    const startHour = 9;
    const endHour = 18;

    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        if (!bookedTimes.includes(timeString)) {
          availableSlots.push(timeString);
        }
      }
    }

    res.json({
      success: true,
      data: availableSlots
    });

  } catch (error) {
    console.error('Error fetching available time slots:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch available time slots'
    });
  }
};

// Send appointment confirmation email (safe, optional)
const sendAppointmentConfirmationEmail = async (appointment) => {
  try {
    // Skip silently if email creds are not configured
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
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
      to: appointment.userEmail,
      subject: 'Appointment Confirmation - Arcular Plus',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #32CCBC;">Appointment Confirmation</h2>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>Appointment Details</h3>
            <p><strong>Appointment ID:</strong> ${appointment.appointmentId}</p>
            <p><strong>Doctor:</strong> Dr. ${appointment.doctorName}</p>
            <p><strong>Specialization:</strong> ${appointment.doctorSpecialization}</p>
            <p><strong>Hospital:</strong> ${appointment.hospitalName}</p>
            <p><strong>Date:</strong> ${appointment.appointmentDate.toDateString()}</p>
            <p><strong>Time:</strong> ${appointment.appointmentTime}</p>
            <p><strong>Consultation Fee:</strong> ₹${appointment.consultationFee}</p>
            <p><strong>Reason:</strong> ${appointment.reason}</p>
          </div>
          
          <div style="background-color: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h4>Important Notes:</h4>
            <ul>
              <li>Please arrive 15 minutes before your appointment time</li>
              <li>Bring a valid ID and any relevant medical documents</li>
              <li>Payment can be made at the hospital reception</li>
              <li>Contact the hospital if you need to reschedule or cancel</li>
            </ul>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            Thank you for choosing Arcular Plus for your healthcare needs.
          </p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    appointment.emailSent = true;
    await appointment.save();

  } catch (error) {
    console.error('Error sending appointment confirmation email:', error);
  }
};

module.exports = {
  createAppointment,
  getUserAppointments,
  getDoctorAppointments,
  updateAppointmentStatus,
  getAvailableTimeSlots
};