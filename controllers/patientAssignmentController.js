const PatientAssignment = require('../models/PatientAssignment');
const User = require('../models/User');
const Nurse = require('../models/Nurse');
const Hospital = require('../models/Hospital');

// Create a new patient assignment
const createAssignment = async (req, res) => {
  try {
    const firebaseUser = req.user;
    if (!firebaseUser || !firebaseUser.uid) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const {
      patientArcId,
      doctorArcId,
      nurseId,
      ward,
      shift,
      assignmentDate,
      assignmentTime,
      notes
    } = req.body;

    // Validate required fields
    if (!patientArcId || !doctorArcId || !nurseId || !ward || !shift || !assignmentDate || !assignmentTime) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    // Find hospital by current user
    const hospital = await Hospital.findOne({ uid: firebaseUser.uid });
    if (!hospital) {
      return res.status(404).json({ success: false, error: 'Hospital not found' });
    }

    // Find patient by ARC ID
    const patient = await User.findOne({
      $or: [{ arcId: patientArcId }, { healthQrId: patientArcId }]
    });
    if (!patient) {
      return res.status(404).json({ success: false, error: 'Patient not found' });
    }

    // Find doctor by multiple identifiers for compatibility (User collection)
    let doctor = await User.findOne({
      $and: [
        { $or: [
          { arcId: doctorArcId },
          { healthQrId: doctorArcId },
          { uid: doctorArcId },
          { email: doctorArcId }
        ] },
        { $or: [ { type: 'doctor' }, { role: 'doctor' } ] }
      ]
    });
    
    // Fallback: if not found in User, try Doctor model, then map to User by uid/email
    if (!doctor) {
      const DoctorModel = require('../models/Doctor');
      const doctorDoc = await DoctorModel.findOne({
        $or: [
          { arcId: doctorArcId },
          { uid: doctorArcId },
          { email: doctorArcId }
        ]
      });
      if (doctorDoc) {
        // Try to resolve linked User by uid or email
        doctor = await User.findOne({ $or: [ { uid: doctorDoc.uid }, { email: doctorDoc.email } ] });
        if (!doctor) {
          return res.status(404).json({ success: false, error: 'Doctor not found (no linked user account)' });
        }
      }
    }
    if (!doctor) {
      return res.status(404).json({ success: false, error: 'Doctor not found' });
    }

    // Find nurse by ID
    let nurse = await Nurse.findOne({ uid: nurseId });
    if (!nurse) {
      const mongoose = require('mongoose');
      if (mongoose.isValidObjectId(nurseId)) {
        nurse = await Nurse.findById(nurseId);
      }
    }
    if (!nurse) {
      return res.status(404).json({ success: false, error: 'Nurse not found' });
    }

    // Check if nurse is affiliated with this hospital
    const isAffiliated = nurse.affiliatedHospitals.some(
      (affiliation) => String(affiliation.hospitalId) === String(hospital._id)
    );
    if (!isAffiliated) {
      return res.status(400).json({
        success: false,
        error: 'Nurse is not affiliated with this hospital'
      });
    }

    // Create assignment
    const assignment = new PatientAssignment({
      patientId: patient._id,
      patientArcId: patient.arcId || patientArcId,
      patientName: patient.fullName,
      doctorId: doctor._id,
      doctorArcId: doctor.arcId || doctorArcId,
      doctorName: doctor.fullName,
      nurseId: nurse._id,
      nurseName: nurse.fullName,
      hospitalId: hospital._id,
      hospitalName: hospital.hospitalName,
      ward,
      shift,
      assignmentDate: new Date(assignmentDate),
      assignmentTime,
      notes: notes || '',
      status: 'assigned'
    });

    await assignment.save();

    res.status(201).json({
      success: true,
      message: 'Patient assignment created successfully',
      data: assignment
    });
  } catch (error) {
    console.error('Error creating patient assignment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create patient assignment',
      details: error.message
    });
  }
};

// Get assignments for a doctor
const getDoctorAssignments = async (req, res) => {
  try {
    const firebaseUser = req.user;
    if (!firebaseUser || !firebaseUser.uid) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const doctor = await User.findOne({ uid: firebaseUser.uid, userType: 'doctor' });
    if (!doctor) {
      return res.status(404).json({ success: false, error: 'Doctor not found' });
    }

    const assignments = await PatientAssignment.find({ doctorId: doctor._id })
      .populate('patientId', 'fullName arcId email phone')
      .populate('nurseId', 'fullName uid')
      .sort({ assignmentDate: -1, createdAt: -1 });

    res.json({
      success: true,
      data: assignments
    });
  } catch (error) {
    console.error('Error fetching doctor assignments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch doctor assignments',
      details: error.message
    });
  }
};

// Get assignments for a nurse
const getNurseAssignments = async (req, res) => {
  try {
    const firebaseUser = req.user;
    if (!firebaseUser || !firebaseUser.uid) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const nurse = await Nurse.findOne({ uid: firebaseUser.uid });
    if (!nurse) {
      return res.status(404).json({ success: false, error: 'Nurse not found' });
    }

    const assignments = await PatientAssignment.find({ nurseId: nurse._id })
      .populate('patientId', 'fullName arcId email phone')
      .populate('doctorId', 'fullName arcId email phone')
      .sort({ assignmentDate: -1, createdAt: -1 });

    res.json({
      success: true,
      data: assignments
    });
  } catch (error) {
    console.error('Error fetching nurse assignments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch nurse assignments',
      details: error.message
    });
  }
};

// Get assignments for a hospital
const getHospitalAssignments = async (req, res) => {
  try {
    const firebaseUser = req.user;
    if (!firebaseUser || !firebaseUser.uid) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const hospital = await Hospital.findOne({ uid: firebaseUser.uid });
    if (!hospital) {
      return res.status(404).json({ success: false, error: 'Hospital not found' });
    }

    const assignments = await PatientAssignment.find({ hospitalId: hospital._id })
      .populate('patientId', 'fullName arcId email phone')
      .populate('doctorId', 'fullName arcId email phone')
      .populate('nurseId', 'fullName uid')
      .sort({ assignmentDate: -1, createdAt: -1 });

    res.json({
      success: true,
      data: assignments
    });
  } catch (error) {
    console.error('Error fetching hospital assignments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch hospital assignments',
      details: error.message
    });
  }
};

// Update assignment status (mark as completed)
const updateAssignmentStatus = async (req, res) => {
  try {
    const firebaseUser = req.user;
    if (!firebaseUser || !firebaseUser.uid) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { assignmentId } = req.params;
    const { status, notes, completedBy } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'Status is required'
      });
    }

    // Find assignment
    const assignment = await PatientAssignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({ success: false, error: 'Assignment not found' });
    }

    // Check if user is authorized to update this assignment
    const nurse = await Nurse.findOne({ uid: firebaseUser.uid });
    const doctor = await User.findOne({ uid: firebaseUser.uid, userType: 'doctor' });
    
    const isAuthorized = (nurse && String(nurse._id) === String(assignment.nurseId)) ||
                        (doctor && String(doctor._id) === String(assignment.doctorId));
    
    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update this assignment'
      });
    }

    // Update assignment
    assignment.status = status;
    if (notes) assignment.notes = notes;
    if (status === 'completed') {
      assignment.completedAt = new Date();
      assignment.completedBy = completedBy || (nurse ? 'nurse' : 'doctor');
    }
    assignment.updatedAt = new Date();

    await assignment.save();

    res.json({
      success: true,
      message: 'Assignment status updated successfully',
      data: assignment
    });
  } catch (error) {
    console.error('Error updating assignment status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update assignment status',
      details: error.message
    });
  }
};

// Delete assignment (only by hospital)
const deleteAssignment = async (req, res) => {
  try {
    const firebaseUser = req.user;
    if (!firebaseUser || !firebaseUser.uid) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { assignmentId } = req.params;

    // Find hospital
    const hospital = await Hospital.findOne({ uid: firebaseUser.uid });
    if (!hospital) {
      return res.status(404).json({ success: false, error: 'Hospital not found' });
    }

    // Find and delete assignment
    const assignment = await PatientAssignment.findOneAndDelete({
      _id: assignmentId,
      hospitalId: hospital._id
    });

    if (!assignment) {
      return res.status(404).json({ success: false, error: 'Assignment not found' });
    }

    res.json({
      success: true,
      message: 'Assignment deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting assignment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete assignment',
      details: error.message
    });
  }
};

// Get assignment statistics
const getAssignmentStats = async (req, res) => {
  try {
    const firebaseUser = req.user;
    if (!firebaseUser || !firebaseUser.uid) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const hospital = await Hospital.findOne({ uid: firebaseUser.uid });
    if (!hospital) {
      return res.status(404).json({ success: false, error: 'Hospital not found' });
    }

    const stats = await PatientAssignment.aggregate([
      { $match: { hospitalId: hospital._id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const totalAssignments = await PatientAssignment.countDocuments({ hospitalId: hospital._id });
    const todayAssignments = await PatientAssignment.countDocuments({
      hospitalId: hospital._id,
      assignmentDate: {
        $gte: new Date(new Date().setHours(0, 0, 0, 0)),
        $lt: new Date(new Date().setHours(23, 59, 59, 999))
      }
    });

    res.json({
      success: true,
      data: {
        totalAssignments,
        todayAssignments,
        statusBreakdown: stats.reduce((acc, stat) => {
          acc[stat._id] = stat.count;
          return acc;
        }, {})
      }
    });
  } catch (error) {
    console.error('Error fetching assignment stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch assignment statistics',
      details: error.message
    });
  }
};

module.exports = {
  createAssignment,
  getDoctorAssignments,
  getNurseAssignments,
  getHospitalAssignments,
  updateAssignmentStatus,
  deleteAssignment,
  getAssignmentStats
};
