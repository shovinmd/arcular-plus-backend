const Reminder = require('../models/Reminder');
const User = require('../models/User');
const Doctor = require('../models/Doctor');
const Nurse = require('../models/Nurse');
const Hospital = require('../models/Hospital');

// Create a new reminder
const createReminder = async (req, res) => {
  try {
    const {
      title,
      notes,
      patientArcId,
      patientId,
      doctorId,
      nurseId,
      hospitalId,
      priority = 'medium',
      dueAt,
      dueTime,
      category = 'general',
      isRecurring = false,
      recurringPattern,
      recurringInterval = 1,
      tags = []
    } = req.body;

    // Validate required fields
    if (!title || !patientArcId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: title, patientArcId'
      });
    }

    // Resolve missing IDs when not provided by client
    let resolvedPatientId = patientId;
    let resolvedDoctorId = doctorId;
    let resolvedHospitalId = hospitalId;

    // Resolve doctor from authenticated user if not provided
    if (!resolvedDoctorId && req.user && req.user.uid) {
      const doctorUser = await User.findOne({ uid: req.user.uid });
      if (doctorUser) {
        resolvedDoctorId = doctorUser._id;
      }
    }

    // Resolve patient by ARC ID if not provided
    if (!resolvedPatientId) {
      const patient = await User.findOne({
        $or: [
          { healthQrId: patientArcId },
          { arcId: patientArcId },
        ],
      });
      if (patient) {
        resolvedPatientId = patient._id;
      }
    }

    // Try to resolve hospital from latest patient assignment, or from doctor's profile
    if (!resolvedHospitalId) {
      try {
        const PatientAssignment = require('../models/PatientAssignment');
        const latestAssignment = await PatientAssignment.findOne({ patientArcId })
          .sort({ createdAt: -1 })
          .lean();
        if (latestAssignment && latestAssignment.hospitalId) {
          resolvedHospitalId = latestAssignment.hospitalId;
        }
      } catch (_) {
        // ignore if model not available
      }
      if (!resolvedHospitalId && resolvedDoctorId) {
        // Try from Doctor profile
        const doctorProfile = await Doctor.findOne({ userId: resolvedDoctorId }).lean();
        if (doctorProfile && doctorProfile.hospitalId) {
          resolvedHospitalId = doctorProfile.hospitalId;
        }
      }
    }

    // Final validation after auto-resolution
    if (!resolvedPatientId || !resolvedDoctorId || !resolvedHospitalId) {
      return res.status(400).json({
        success: false,
        message: 'Unable to resolve patient/doctor/hospital. Provide patientId, doctorId, and hospitalId or ensure ARC ID and authenticated doctor are valid.'
      });
    }

    // Verify patient exists
    const patient = await User.findById(resolvedPatientId);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    // Verify doctor exists
    const doctor = await User.findById(resolvedDoctorId);
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    // Verify hospital exists
    const hospital = await Hospital.findById(resolvedHospitalId);
    if (!hospital) {
      return res.status(404).json({
        success: false,
        message: 'Hospital not found'
      });
    }

    // Verify nurse if provided
    if (nurseId) {
      const nurse = await User.findById(nurseId);
      if (!nurse) {
        return res.status(404).json({
          success: false,
          message: 'Nurse not found'
        });
      }
    }

    // Parse due date if provided
    let parsedDueAt = null;
    if (dueAt) {
      parsedDueAt = new Date(dueAt);
      if (isNaN(parsedDueAt.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid due date format'
        });
      }
    }

    // Create reminder
    const reminder = new Reminder({
      title,
      notes,
      patientArcId,
      patientId: resolvedPatientId,
      doctorId: resolvedDoctorId,
      nurseId,
      hospitalId: resolvedHospitalId,
      priority,
      dueAt: parsedDueAt,
      dueTime,
      category,
      isRecurring,
      recurringPattern,
      recurringInterval,
      tags,
      createdBy: req.user.uid
    });

    await reminder.save();

    // Populate references for response
    await reminder.populate([
      { path: 'patientId', select: 'fullName email mobileNumber' },
      { path: 'doctorId', select: 'fullName email' },
      { path: 'nurseId', select: 'fullName email' },
      { path: 'hospitalId', select: 'name address' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Reminder created successfully',
      data: reminder
    });

  } catch (error) {
    console.error('Error creating reminder:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create reminder',
      error: error.message
    });
  }
};

// Get reminders by patient ARC ID
const getRemindersByPatientArcId = async (req, res) => {
  try {
    const { arcId } = req.params;
    const { status, priority, category } = req.query;

    if (!arcId) {
      return res.status(400).json({
        success: false,
        message: 'Patient ARC ID is required'
      });
    }

    // Build query
    const query = { patientArcId: arcId };

    if (status) {
      query.status = status;
    }
    if (priority) {
      query.priority = priority;
    }
    if (category) {
      query.category = category;
    }

    // Find reminders
    const reminders = await Reminder.find(query)
      .populate('patientId', 'fullName email mobileNumber')
      .populate('doctorId', 'fullName email')
      .populate('nurseId', 'fullName email')
      .populate('hospitalId', 'name address')
      .populate('createdBy', 'fullName email')
      .populate('updatedBy', 'fullName email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: reminders,
      count: reminders.length
    });

  } catch (error) {
    console.error('Error fetching reminders by ARC ID:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reminders',
      error: error.message
    });
  }
};

// Get reminders by patient ID
const getRemindersByPatientId = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { status, priority, category } = req.query;

    if (!patientId) {
      return res.status(400).json({
        success: false,
        message: 'Patient ID is required'
      });
    }

    // Build query
    const query = { patientId };

    if (status) {
      query.status = status;
    }
    if (priority) {
      query.priority = priority;
    }
    if (category) {
      query.category = category;
    }

    // Find reminders
    const reminders = await Reminder.find(query)
      .populate('patientId', 'fullName email mobileNumber')
      .populate('doctorId', 'fullName email')
      .populate('nurseId', 'fullName email')
      .populate('hospitalId', 'name address')
      .populate('createdBy', 'fullName email')
      .populate('updatedBy', 'fullName email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: reminders,
      count: reminders.length
    });

  } catch (error) {
    console.error('Error fetching reminders by patient ID:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reminders',
      error: error.message
    });
  }
};

// Update reminder status
const updateReminderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Reminder ID is required'
      });
    }

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    // Validate status
    const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be one of: ' + validStatuses.join(', ')
      });
    }

    // Find and update reminder
    const reminder = await Reminder.findById(id);
    if (!reminder) {
      return res.status(404).json({
        success: false,
        message: 'Reminder not found'
      });
    }

    // Update fields
    reminder.status = status;
    reminder.updatedBy = req.user.uid;

    if (notes) {
      reminder.notes = notes;
    }

    // Set completion timestamp if marking as completed
    if (status === 'completed') {
      reminder.completedAt = new Date();
      reminder.completedBy = req.user.uid;
    }

    await reminder.save();

    // Populate references for response
    await reminder.populate([
      { path: 'patientId', select: 'fullName email mobileNumber' },
      { path: 'doctorId', select: 'fullName email' },
      { path: 'nurseId', select: 'fullName email' },
      { path: 'hospitalId', select: 'name address' },
      { path: 'updatedBy', select: 'fullName email' }
    ]);

    res.json({
      success: true,
      message: 'Reminder status updated successfully',
      data: reminder
    });

  } catch (error) {
    console.error('Error updating reminder status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update reminder status',
      error: error.message
    });
  }
};

// Update reminder
const updateReminder = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Reminder ID is required'
      });
    }

    // Find reminder
    const reminder = await Reminder.findById(id);
    if (!reminder) {
      return res.status(404).json({
        success: false,
        message: 'Reminder not found'
      });
    }

    // Parse due date if provided
    if (updateData.dueAt) {
      const parsedDueAt = new Date(updateData.dueAt);
      if (isNaN(parsedDueAt.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid due date format'
        });
      }
      updateData.dueAt = parsedDueAt;
    }

    // Update fields
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        reminder[key] = updateData[key];
      }
    });

    reminder.updatedBy = req.user.uid;
    await reminder.save();

    // Populate references for response
    await reminder.populate([
      { path: 'patientId', select: 'fullName email mobileNumber' },
      { path: 'doctorId', select: 'fullName email' },
      { path: 'nurseId', select: 'fullName email' },
      { path: 'hospitalId', select: 'name address' },
      { path: 'updatedBy', select: 'fullName email' }
    ]);

    res.json({
      success: true,
      message: 'Reminder updated successfully',
      data: reminder
    });

  } catch (error) {
    console.error('Error updating reminder:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update reminder',
      error: error.message
    });
  }
};

// Delete reminder
const deleteReminder = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Reminder ID is required'
      });
    }

    const reminder = await Reminder.findByIdAndDelete(id);
    if (!reminder) {
      return res.status(404).json({
        success: false,
        message: 'Reminder not found'
      });
    }

    res.json({
      success: true,
      message: 'Reminder deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting reminder:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete reminder',
      error: error.message
    });
  }
};

// Get reminder by ID
const getReminderById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Reminder ID is required'
      });
    }

    const reminder = await Reminder.findById(id)
      .populate('patientId', 'fullName email mobileNumber')
      .populate('doctorId', 'fullName email')
      .populate('nurseId', 'fullName email')
      .populate('hospitalId', 'name address')
      .populate('createdBy', 'fullName email')
      .populate('updatedBy', 'fullName email');

    if (!reminder) {
      return res.status(404).json({
        success: false,
        message: 'Reminder not found'
      });
    }

    res.json({
      success: true,
      data: reminder
    });

  } catch (error) {
    console.error('Error fetching reminder by ID:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reminder',
      error: error.message
    });
  }
};

module.exports = {
  createReminder,
  getRemindersByPatientArcId,
  getRemindersByPatientId,
  updateReminderStatus,
  updateReminder,
  deleteReminder,
  getReminderById
};
