const Appointment = require('../models/Appointment');
const User = require('../models/User');
const Hospital = require('../models/Hospital');
const nodemailer = require('nodemailer');
const fcmService = require('../services/fcmService');
const mongoose = require('mongoose');

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

    // Get doctor information from Doctor model (accept uid or valid ObjectId/id)
    const mongoose = require('mongoose');
    const Doctor = require('../models/Doctor');
    const doctorOr = [{ uid: doctorId }, { arcId: doctorId }];
    if (mongoose.Types.ObjectId.isValid(doctorId)) {
      doctorOr.push({ _id: doctorId });
    }
    const doctor = await Doctor.findOne({ $or: doctorOr });
    if (!doctor) {
      return res.status(404).json({ 
        success: false, 
        error: 'Doctor not found' 
      });
    }

    // Get hospital information from Hospital model (accept _id, uid, arcId, name) with safe ObjectId
    let hospital = null;
    if (hospitalId) {
      const Hospital = require('../models/Hospital');
      const hospitalOr = [{ uid: hospitalId }, { arcId: hospitalId }, { hospitalName: hospitalId }];
      if (mongoose.Types.ObjectId.isValid(hospitalId)) {
        hospitalOr.push({ _id: hospitalId });
      }
      hospital = await Hospital.findOne({ $or: hospitalOr });
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

    // Generate appointment ID
    const appointmentId = `APT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Resolve hospital id fallback from doctor's affiliation if not provided
    let resolvedHospitalId = hospital ? hospital._id : null;
    
    if (!resolvedHospitalId && doctor.affiliatedHospitals && doctor.affiliatedHospitals.length > 0) {
      // Find the first active hospital affiliation
      const activeHospital = doctor.affiliatedHospitals.find(aff => aff.isActive !== false);
      if (activeHospital) {
        // Try to find the hospital by ID or name
        const Hospital = require('../models/Hospital');
        const hospitalLookup = await Hospital.findOne({
          $or: [
            { _id: activeHospital.hospitalId },
            { hospitalName: activeHospital.hospitalName },
            { uid: activeHospital.hospitalId }
          ]
        });
        if (hospitalLookup) {
          resolvedHospitalId = hospitalLookup._id;
          hospital = hospitalLookup;
        }
      }
    }
    
    if (!resolvedHospitalId) {
      return res.status(400).json({
        success: false,
        error: 'Hospital information not found for this doctor'
      });
    }

    // Create appointment
    const appointment = new Appointment({
      appointmentId: appointmentId,
      userId: firebaseUser.uid,
      userEmail: user.email,
      userName: user.fullName,
      userPhone: user.mobileNumber,
      patientId: firebaseUser.uid,
      patientName: user.fullName,
      patientPhone: user.mobileNumber,
      patientEmail: user.email,
      doctorId: doctorId,
      doctorName: doctor.fullName,
      doctorEmail: doctor.email,
      doctorPhone: doctor.mobileNumber,
      doctorSpecialization: doctor.specialization,
      doctorConsultationFee: doctor.consultationFee,
      hospitalId: resolvedHospitalId,
      hospitalName: hospital ? hospital.hospitalName : (doctor.affiliatedHospitals && doctor.affiliatedHospitals.length > 0 ? doctor.affiliatedHospitals[0].hospitalName : ''),
      hospitalAddress: hospital ? hospital.address : doctor.address,
      appointmentDate: new Date(appointmentDate),
      appointmentTime: appointmentTime,
      appointmentType: appointmentType,
      reason: reason,
      symptoms: symptoms,
      medicalHistory: medicalHistory,
      consultationFee: doctor.consultationFee,
      paymentMethod: 'cash',
      appointmentStatus: 'confirmed'
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
          appointmentId: appointmentId,
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

// Get user appointments by userId (for health summary and calendar)
const getUserAppointmentsById = async (req, res) => {
  try {
    const { userId } = req.params;
    const firebaseUser = req.user;
    
    if (!firebaseUser || !firebaseUser.uid) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid Firebase user' 
      });
    }

    // Allow users to get their own appointments or admin/staff to get any user's appointments
    if (firebaseUser.uid !== userId && firebaseUser.type !== 'admin' && firebaseUser.type !== 'arc_staff') {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied' 
      });
    }

    const { status, page = 1, limit = 50 } = req.query;
    const query = { userId: userId };

    if (status) {
      query.appointmentStatus = status;
    }

    console.log('🔍 Backend: Searching for appointments with query:', query);
    
    const appointments = await Appointment.find(query)
      .sort({ appointmentDate: -1, appointmentTime: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Appointment.countDocuments(query);
    
    console.log('🔍 Backend: Found appointments:', appointments.length, 'Total:', total);

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
    console.error('Error fetching user appointments by ID:', error);
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

// Get hospital appointments
const getHospitalAppointments = async (req, res) => {
  try {
    const { hospitalId } = req.params;
    const firebaseUser = req.user;
    
    if (!firebaseUser || !firebaseUser.uid) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid Firebase user' 
      });
    }

    const { status, date, page = 1, limit = 50 } = req.query;
    const query = { hospitalId: hospitalId };

    if (status) {
      query.appointmentStatus = status;
    }

    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);
      query.appointmentDate = { $gte: startDate, $lt: endDate };
    }

    console.log('🔍 Backend: Fetching hospital appointments for hospitalId:', hospitalId);
    console.log('🔍 Backend: Query:', query);
    
    const appointments = await Appointment.find(query)
      .sort({ appointmentDate: -1, appointmentTime: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Appointment.countDocuments(query);
    
    console.log('🔍 Backend: Found appointments:', appointments.length, 'Total:', total);

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
    console.error('Error fetching hospital appointments:', error);
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

    // Send email notification based on status
    try {
      if (status === 'confirmed') {
        await sendAppointmentConfirmationEmail(appointment);
      } else if (status === 'cancelled') {
        await sendAppointmentCancellationEmails(appointment);
      } else if (status === 'completed') {
        await sendAppointmentCompletionEmail(appointment, 0);
      } else if (status === 'rescheduled') {
        await sendAppointmentRescheduleEmail(appointment);
      }
    } catch (emailError) {
      console.error('Error sending email notification:', emailError);
      // Don't fail the request if email fails
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
            <p><strong>Doctor:</strong> ${appointment.doctorName}</p>
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

// Send appointment cancellation emails to user and hospital
const sendAppointmentCancellationEmails = async (appointment) => {
  try {
    // Skip silently if email creds are not configured
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log('⚠️ Skipping cancellation emails: EMAIL_USER or EMAIL_PASS not configured');
      return;
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const appointmentDateFormatted = new Date(appointment.appointmentDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Email to user
    const userMailOptions = {
      from: process.env.EMAIL_USER,
      to: appointment.userEmail,
      subject: 'Appointment Cancelled - Arcular Plus',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #e74c3c;">Appointment Cancelled</h2>
          
          <div style="background-color: #fdf2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #e74c3c;">
            <h3>Your appointment has been cancelled</h3>
            <p><strong>Appointment ID:</strong> ${appointment.appointmentId}</p>
            <p><strong>Patient:</strong> ${appointment.patientName || 'Patient'}</p>
            <p><strong>Doctor:</strong> ${appointment.doctorName}</p>
            <p><strong>Specialization:</strong> ${appointment.doctorSpecialization}</p>
            <p><strong>Hospital:</strong> ${appointment.hospitalName}</p>
            <p><strong>Date:</strong> ${appointmentDateFormatted}</p>
            <p><strong>Time:</strong> ${appointment.appointmentTime}</p>
            <p><strong>Status:</strong> <span style="color: #e74c3c; font-weight: bold;">CANCELLED</span></p>
            <p><strong>Reason:</strong> ${appointment.cancellationReason || appointment.reason || 'No reason provided'}</p>
          </div>
          
          <div style="background-color: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h4>Next Steps:</h4>
            <ul>
              <li>You can book a new appointment anytime through the app</li>
              <li>If you need to reschedule, please contact the hospital directly</li>
              <li>Any consultation fees will be refunded as per hospital policy</li>
            </ul>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            Thank you for using Arcular Plus. We apologize for any inconvenience.
          </p>
        </div>
      `
    };

    // Email to hospital (if hospital email is available)
    const hospitalEmail = `hospital@${appointment.hospitalName.toLowerCase().replaceAll(' ', '')}.com`;
    const hospitalMailOptions = {
      from: process.env.EMAIL_USER,
      to: hospitalEmail,
      subject: `Appointment Cancelled - ${appointment.appointmentId}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #e74c3c;">Appointment Cancelled</h2>
          
          <div style="background-color: #fdf2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #e74c3c;">
            <h3>Patient has cancelled their appointment</h3>
            <p><strong>Appointment ID:</strong> ${appointment.appointmentId}</p>
            <p><strong>Patient:</strong> ${appointment.userName}</p>
            <p><strong>Patient Email:</strong> ${appointment.userEmail}</p>
            <p><strong>Patient Phone:</strong> ${appointment.userPhone}</p>
            <p><strong>Doctor:</strong> ${appointment.doctorName}</p>
            <p><strong>Date:</strong> ${appointmentDateFormatted}</p>
            <p><strong>Time:</strong> ${appointment.appointmentTime}</p>
            <p><strong>Reason:</strong> ${appointment.reason}</p>
          </div>
          
          <div style="background-color: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h4>Action Required:</h4>
            <ul>
              <li>Update your appointment schedule</li>
              <li>Process any refunds as per your policy</li>
              <li>Contact patient if follow-up is needed</li>
            </ul>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            This is an automated notification from Arcular Plus.
          </p>
        </div>
      `
    };

    // Send emails
    await transporter.sendMail(userMailOptions);
    console.log('✅ Cancellation email sent to user:', appointment.userEmail);
    
    await transporter.sendMail(hospitalMailOptions);
    console.log('✅ Cancellation email sent to hospital:', hospitalEmail);

  } catch (error) {
    console.error('Error sending appointment cancellation emails:', error);
  }
};

// Cancel appointment
const cancelAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const firebaseUser = req.user;
    
    if (!firebaseUser || !firebaseUser.uid) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid Firebase user' 
      });
    }

    console.log('🔍 Backend: Cancelling appointment:', appointmentId, 'for user:', firebaseUser.uid);
    console.log('🔍 Backend: Looking for appointment with appointmentId:', appointmentId);

    // Find the appointment by _id or appointmentId and userId
    let appointment = null;
    
    // First try to find by MongoDB _id
    if (mongoose.isValidObjectId(appointmentId)) {
      appointment = await Appointment.findOne({
        _id: appointmentId,
        userId: firebaseUser.uid
      });
    }
    
    // If not found by _id, try by appointmentId field
    if (!appointment) {
      appointment = await Appointment.findOne({
        appointmentId: appointmentId,
        userId: firebaseUser.uid
      });
    }

    console.log('🔍 Backend: Query result:', appointment ? 'Found' : 'Not found');

    if (!appointment) {
      console.log('❌ Appointment not found:', appointmentId, 'for user:', firebaseUser.uid);
      return res.status(404).json({
        success: false,
        error: 'Appointment not found or access denied'
      });
    }

    console.log('✅ Found appointment:', appointment.appointmentId, 'for user:', appointment.userId);

    // Check if appointment can be cancelled (not in the past)
    const now = new Date();
    const appointmentDateTime = new Date(appointment.appointmentDate);
    
    if (appointmentDateTime <= now) {
      return res.status(400).json({
        success: false,
        error: 'Cannot cancel past appointments'
      });
    }

    // Send cancellation emails before deleting
    await sendAppointmentCancellationEmails(appointment);

    // Delete the appointment by _id or appointmentId
    let deleteResult = null;
    
    // First try to delete by MongoDB _id
    if (mongoose.isValidObjectId(appointmentId)) {
      deleteResult = await Appointment.findOneAndDelete({
        _id: appointmentId,
        userId: firebaseUser.uid
      });
    }
    
    // If not found by _id, try by appointmentId field
    if (!deleteResult) {
      deleteResult = await Appointment.findOneAndDelete({
        appointmentId: appointmentId,
        userId: firebaseUser.uid
      });
    }

    if (!deleteResult) {
      console.log('❌ Failed to delete appointment:', appointmentId);
      return res.status(500).json({
        success: false,
        error: 'Failed to delete appointment'
      });
    }
    
    console.log('✅ Backend: Appointment cancelled successfully:', appointmentId);

    res.json({
      success: true,
      message: 'Appointment cancelled successfully'
    });

  } catch (error) {
    console.error('❌ Error cancelling appointment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel appointment'
    });
  }
};


// Send appointment reschedule email
const sendAppointmentRescheduleEmail = async (appointment) => {
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
      subject: 'Appointment Rescheduled - Arcular Plus',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #f39c12;">Appointment Rescheduled</h2>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>Appointment Details</h3>
            <p><strong>Appointment ID:</strong> ${appointment.appointmentId}</p>
            <p><strong>Patient:</strong> ${appointment.patientName || 'Patient'}</p>
            <p><strong>Doctor:</strong> ${appointment.doctorName}</p>
            <p><strong>Specialization:</strong> ${appointment.doctorSpecialization}</p>
            <p><strong>Hospital:</strong> ${appointment.hospitalName}</p>
            <p><strong>New Date:</strong> ${appointment.appointmentDate.toDateString()}</p>
            <p><strong>New Time:</strong> ${appointment.appointmentTime}</p>
            <p><strong>Status:</strong> <span style="color: #f39c12; font-weight: bold;">RESCHEDULED</span></p>
            ${appointment.rescheduleReason ? `<p><strong>Reason:</strong> ${appointment.rescheduleReason}</p>` : ''}
          </div>
          
          <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
            <p style="margin: 0; color: #856404;"><strong>Important:</strong> Your appointment has been rescheduled to the new date and time shown above.</p>
            <p style="margin: 5px 0 0 0; color: #856404;">Please contact the hospital if you have any questions or need to make further changes.</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://arcular-pluse-a-unified-healthcare-peach.vercel.app/" style="background-color: #32CCBC; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">Visit Arcular Plus</a>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('Appointment reschedule email sent successfully');
  } catch (error) {
    console.error('Error sending appointment reschedule email:', error);
  }
};

// Reschedule appointment by hospital
const rescheduleAppointmentByHospital = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { newDate, newTime, reason } = req.body;

    let appointment = null;
    if (mongoose.isValidObjectId(appointmentId)) {
      appointment = await Appointment.findById(appointmentId);
    }
    if (!appointment) {
      appointment = await Appointment.findOne({ appointmentId });
    }
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Ensure patient name is set
    if (!appointment.patientName && appointment.userName) {
      appointment.patientName = appointment.userName;
    }
    if (!appointment.patientId && appointment.userId) {
      appointment.patientId = appointment.userId;
    }

    // Update appointment
    appointment.appointmentDate = new Date(newDate);
    appointment.appointmentTime = newTime;
    appointment.status = 'rescheduled';
    appointment.appointmentStatus = 'rescheduled';
    appointment.rescheduleReason = reason;
    appointment.rescheduledAt = new Date();

    await appointment.save();

    // Send notification to patient (non-blocking)
    try {
      console.log('📧 Sending reschedule email to:', appointment.userEmail);
      await sendAppointmentRescheduleEmail(appointment);
      console.log('✅ Reschedule email sent successfully');
    } catch (mailErr) {
      console.error('❌ Reschedule: email send failed (non-blocking):', mailErr);
    }

    res.json({
      success: true,
      message: 'Appointment rescheduled successfully',
      data: appointment
    });
  } catch (error) {
    console.error('Error rescheduling appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reschedule appointment',
      error: error.message
    });
  }
};

// Cancel appointment by hospital
const cancelAppointmentByHospital = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { reason } = req.body;

    let appointment = null;
    if (mongoose.isValidObjectId(appointmentId)) {
      appointment = await Appointment.findById(appointmentId);
    }
    if (!appointment) {
      appointment = await Appointment.findOne({ appointmentId });
    }
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Ensure patient name is set
    if (!appointment.patientName && appointment.userName) {
      appointment.patientName = appointment.userName;
    }
    if (!appointment.patientId && appointment.userId) {
      appointment.patientId = appointment.userId;
    }

    // Set cancellation reason
    appointment.cancellationReason = reason || 'No reason provided';
    appointment.status = 'cancelled';
    appointment.appointmentStatus = 'cancelled';

    // Send notification to patient before deleting (non-blocking)
    try {
      console.log('📧 Sending cancellation email to:', appointment.userEmail);
      await sendAppointmentCancellationEmails(appointment);
      console.log('✅ Cancellation email sent successfully');
    } catch (mailErr) {
      console.error('❌ Cancel: email send failed (non-blocking):', mailErr);
    }

    // Delete the appointment from database
    console.log('🗑️ Deleting appointment:', appointment._id);
    await Appointment.findByIdAndDelete(appointment._id);
    console.log('✅ Appointment deleted successfully');

    res.json({
      success: true,
      message: 'Appointment cancelled and deleted successfully',
      data: {
        appointmentId: appointment._id,
        status: 'cancelled',
        deletedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Error cancelling appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel appointment',
      error: error.message
    });
  }
};

// Complete appointment and send bill
const completeAppointment = async (req, res) => {
  try {
    console.log('🔄 Complete appointment request received');
    const { appointmentId } = req.params;
    const { billAmount, notes, paymentMethod } = req.body;
    
    console.log('📋 Complete request data:', { appointmentId, billAmount, notes, paymentMethod });

    // Validate payment method
    const validPaymentMethods = ['cash', 'card', 'upi', 'online', 'insurance'];
    const finalPaymentMethod = validPaymentMethods.includes(paymentMethod) ? paymentMethod : 'cash';
    console.log('💳 Payment method validation:', { original: paymentMethod, final: finalPaymentMethod });

    let appointment = null;
    if (mongoose.isValidObjectId(appointmentId)) {
      appointment = await Appointment.findById(appointmentId);
    }
    if (!appointment) {
      appointment = await Appointment.findOne({ appointmentId });
    }
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Update appointment status - consultation done, payment completed
    appointment.status = 'completed';
    appointment.appointmentStatus = 'completed';
    appointment.consultationCompletedAt = new Date();
    appointment.completedAt = new Date();
    appointment.billAmount = billAmount || 0;
    appointment.completionNotes = notes;
    appointment.paymentStatus = 'paid';
    appointment.paymentMethod = finalPaymentMethod;

    // Ensure patient name is set
    if (!appointment.patientName && appointment.userName) {
      appointment.patientName = appointment.userName;
    }
    if (!appointment.patientId && appointment.userId) {
      appointment.patientId = appointment.userId;
    }
    
    // Ensure all required fields are present
    if (!appointment.userEmail) {
      appointment.userEmail = 'unknown@example.com';
    }
    if (!appointment.userPhone) {
      appointment.userPhone = 'N/A';
    }
    if (!appointment.doctorEmail) {
      appointment.doctorEmail = 'doctor@example.com';
    }
    if (!appointment.doctorPhone) {
      appointment.doctorPhone = 'N/A';
    }
    if (!appointment.doctorSpecialization) {
      appointment.doctorSpecialization = 'General Practice';
    }
    if (!appointment.doctorConsultationFee) {
      appointment.doctorConsultationFee = 0;
    }
    if (!appointment.hospitalName) {
      appointment.hospitalName = 'Unknown Hospital';
    }
    if (!appointment.hospitalAddress) {
      appointment.hospitalAddress = 'N/A';
    }
    if (!appointment.reason) {
      appointment.reason = 'General consultation';
    }
    if (!appointment.consultationFee) {
      appointment.consultationFee = 0;
    }

    console.log('🔄 Updating appointment status to completed:', appointment._id);
    console.log('📋 Appointment data:', {
      patientName: appointment.patientName,
      userName: appointment.userName,
      patientId: appointment.patientId,
      userId: appointment.userId
    });
    
    try {
      await appointment.save();
      console.log('✅ Appointment status updated successfully');
    } catch (saveError) {
      console.error('❌ Error saving appointment:', saveError);
      return res.status(500).json({
        success: false,
        message: 'Failed to save appointment',
        error: saveError.message
      });
    }

    // Save to health history (create a new health record)
    try {
      const HealthRecord = require('../models/HealthRecord');
      const healthRecord = new HealthRecord({
        patientId: appointment.patientId || appointment.userId || 'unknown',
        patientName: appointment.patientName || appointment.userName || 'Unknown Patient',
        patientPhone: appointment.patientPhone || appointment.userPhone || 'N/A',
        hospitalId: appointment.hospitalId || 'unknown',
        hospitalName: appointment.hospitalName || 'Unknown Hospital',
        doctorId: appointment.doctorId || 'unknown',
        doctorName: appointment.doctorName || 'Unknown Doctor',
        appointmentId: appointment._id.toString(),
        visitDate: appointment.consultationCompletedAt,
        consultationFee: billAmount || 0,
        diagnosis: notes || 'Appointment completed',
        treatment: 'Consultation completed',
        status: 'completed'
      });

      await healthRecord.save();
      console.log('✅ Health record created successfully');
    } catch (healthRecordError) {
      console.error('❌ Error creating health record:', healthRecordError);
      // Don't fail the entire operation for health record creation
    }

    // Send completion email with payment details (non-blocking)
    try {
      console.log('📧 Sending completion email...');
      await sendAppointmentCompletionEmail(appointment, billAmount);
      console.log('✅ Completion email sent successfully');
    } catch (mailErr) {
      console.error('❌ Complete: email send failed (non-blocking):', mailErr);
    }

    // Keep the appointment for records - DO NOT DELETE

    console.log('📤 Sending completion response for appointment:', appointment._id, 'Status:', appointment.status);
    
    res.json({
      success: true,
      message: 'Appointment completed successfully',
      data: {
        appointmentId: appointment._id,
        billAmount: billAmount || 0,
        appointment: {
          id: appointment._id,
          status: appointment.status,
          completedAt: appointment.completedAt,
          billAmount: appointment.billAmount,
          completionNotes: appointment.completionNotes
        }
      }
    });
  } catch (error) {
    console.error('Error completing appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete appointment',
      error: error.message
    });
  }
};

// Create offline appointment (for walk-in patients)
const createOfflineAppointment = async (req, res) => {
  try {
    const {
      patientName,
      patientPhone,
      patientEmail,
      patientAge,
      patientGender,
      doctorId,
      appointmentDate,
      appointmentTime,
      reason,
      notes
    } = req.body;

    const firebaseUser = req.user;
    if (!firebaseUser || !firebaseUser.uid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Firebase user'
      });
    }

    // Get hospital information
    const hospital = await Hospital.findOne({ uid: firebaseUser.uid });
    if (!hospital) {
      return res.status(404).json({
        success: false,
        error: 'Hospital not found'
      });
    }

    // Get doctor information
    const mongoose = require('mongoose');
    const Doctor = require('../models/Doctor');
    const doctorOr = [{ uid: doctorId }, { arcId: doctorId }];
    if (mongoose.Types.ObjectId.isValid(doctorId)) {
      doctorOr.push({ _id: doctorId });
    }
    const doctor = await Doctor.findOne({ $or: doctorOr });
    if (!doctor) {
      return res.status(404).json({
        success: false,
        error: 'Doctor not found'
      });
    }

    // Create appointment
    const appointment = new Appointment({
      appointmentId: `APT-${Date.now()}`,
      patientId: 'offline', // Special ID for offline appointments
      patientName,
      patientPhone,
      patientEmail,
      patientAge,
      patientGender,
      doctorId: doctor._id,
      doctorName: doctor.fullName,
      doctorSpecialization: doctor.specialization,
      hospitalId: hospital._id,
      hospitalName: hospital.hospitalName,
      appointmentDate: new Date(appointmentDate),
      appointmentTime,
      reason,
      notes,
      status: 'confirmed',
      appointmentStatus: 'confirmed',
      appointmentType: 'offline',
      createdAt: new Date()
    });

    await appointment.save();

    // Send confirmation email to patient
    try {
      await sendOfflineAppointmentConfirmationEmail(appointment, hospital, doctor);
      console.log('📧 Offline appointment confirmation email sent successfully');
    } catch (emailError) {
      console.error('❌ Failed to send offline appointment confirmation email:', emailError);
      // Don't fail the appointment creation if email fails
    }

    res.json({
      success: true,
      message: 'Offline appointment created successfully',
      data: appointment
    });
  } catch (error) {
    console.error('Error creating offline appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create offline appointment',
      error: error.message
    });
  }
};

// Send appointment completion email with payment details
const sendAppointmentCompletionEmail = async (appointment, billAmount) => {
  try {
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
      subject: 'Appointment Completed - Payment Details - Arcular Plus',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #27ae60;">Appointment Completed Successfully</h2>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>Appointment Details</h3>
            <p><strong>Appointment ID:</strong> ${appointment.appointmentId}</p>
            <p><strong>Patient:</strong> ${appointment.patientName || 'Patient'}</p>
            <p><strong>Doctor:</strong> ${appointment.doctorName}</p>
            <p><strong>Hospital:</strong> ${appointment.hospitalName}</p>
            <p><strong>Date:</strong> ${appointment.appointmentDate.toDateString()}</p>
            <p><strong>Time:</strong> ${appointment.appointmentTime}</p>
            <p><strong>Status:</strong> <span style="color: #f39c12; font-weight: bold;">CONSULTATION COMPLETED</span></p>
          </div>
          
          <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #27ae60;">
            <h3 style="color: #27ae60;">Payment Information</h3>
            <p><strong>Bill Amount:</strong> ₹${billAmount || 0}</p>
            <p><strong>Payment Method:</strong> ${appointment.paymentMethod || 'Offline Payment'}</p>
            <p><strong>Payment Status:</strong> <span style="color: #27ae60; font-weight: bold;">PAID</span></p>
            <p style="color: #666; font-size: 14px;"><strong>Thank you for choosing our hospital!</strong> Your appointment has been successfully completed.</p>
          </div>
          
          ${appointment.completionNotes ? `
          <div style="background-color: #f0f8ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #007bff;">
            <h3 style="color: #007bff;">Consultation Notes</h3>
            <p style="color: #333; line-height: 1.6;">${appointment.completionNotes}</p>
          </div>
          ` : ''}
          
          <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
            <p style="margin: 0; color: #856404;"><strong>Thank you for choosing our hospital!</strong></p>
            <p style="margin: 5px 0 0 0; color: #856404;">We hope you had a great experience. Please visit us again if needed.</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://arcular-pluse-a-unified-healthcare-peach.vercel.app/" style="background-color: #32CCBC; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">Visit Arcular Plus</a>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('Appointment completion email sent successfully');
  } catch (error) {
    console.error('Error sending appointment completion email:', error);
  }
};

// Mark appointment as fully completed after payment
const completePayment = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { paymentMethod } = req.body;

    // Validate payment method
    const validPaymentMethods = ['cash', 'card', 'upi', 'online', 'insurance'];
    const finalPaymentMethod = validPaymentMethods.includes(paymentMethod) ? paymentMethod : 'cash';

    let appointment = null;
    if (mongoose.isValidObjectId(appointmentId)) {
      appointment = await Appointment.findById(appointmentId);
    }
    if (!appointment) {
      appointment = await Appointment.findOne({ appointmentId });
    }
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Update appointment status to fully completed
    appointment.status = 'completed';
    appointment.appointmentStatus = 'completed';
    appointment.paymentStatus = 'paid';
    appointment.paymentMethod = finalPaymentMethod;
    appointment.completedAt = new Date();

    console.log('💳 Completing payment for appointment:', appointment._id);
    await appointment.save();
    console.log('✅ Payment completed successfully');

    res.json({
      success: true,
      message: 'Payment completed successfully',
      data: {
        appointmentId: appointment._id,
        status: appointment.status,
        paymentStatus: appointment.paymentStatus,
        paymentMethod: appointment.paymentMethod
      }
    });
  } catch (error) {
    console.error('Error completing payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete payment',
      error: error.message
    });
  }
};

// Send offline appointment confirmation email
const sendOfflineAppointmentConfirmationEmail = async (appointment, hospital, doctor) => {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: appointment.patientEmail,
      subject: `Appointment Confirmation - ${hospital.hospitalName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2c3e50; margin: 0;">Appointment Confirmed</h1>
            <p style="color: #7f8c8d; margin: 5px 0;">${hospital.hospitalName}</p>
          </div>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="color: #2c3e50; margin-top: 0;">Appointment Details</h2>
            <p><strong>Patient Name:</strong> ${appointment.patientName}</p>
            <p><strong>Doctor:</strong> Dr. ${doctor.fullName}</p>
            <p><strong>Specialization:</strong> ${doctor.specialization}</p>
            <p><strong>Date & Time:</strong> ${new Date(appointment.appointmentDate).toLocaleDateString()} at ${appointment.appointmentTime}</p>
            <p><strong>Appointment Type:</strong> Walk-in (Offline)</p>
            <p><strong>Status:</strong> <span style="color: #27ae60; font-weight: bold;">CONFIRMED</span></p>
          </div>
          
          <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #27ae60;">
            <h3 style="color: #27ae60;">Important Information</h3>
            <p>Please arrive 15 minutes before your scheduled appointment time.</p>
            <p>Bring a valid ID and any relevant medical documents.</p>
            <p>If you need to reschedule or cancel, please contact the hospital directly.</p>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <a href="https://arcular-pluse-a-unified-healthcare-peach.vercel.app/" 
               style="background-color: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Visit Our Website
            </a>
          </div>
          
          <div style="text-align: center; margin-top: 20px; color: #7f8c8d; font-size: 12px;">
            <p>Thank you for choosing ${hospital.hospitalName}!</p>
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('📧 Offline appointment confirmation email sent to:', appointment.patientEmail);
  } catch (error) {
    console.error('❌ Error sending offline appointment confirmation email:', error);
    throw error;
  }
};

module.exports = {
  createAppointment,
  getUserAppointments,
  getUserAppointmentsById,
  getDoctorAppointments,
  getHospitalAppointments,
  updateAppointmentStatus,
  cancelAppointment,
  getAvailableTimeSlots,
  rescheduleAppointmentByHospital,
  cancelAppointmentByHospital,
  completeAppointment,
  completePayment,
  createOfflineAppointment,
  sendAppointmentCompletionEmail,
  sendOfflineAppointmentConfirmationEmail
};