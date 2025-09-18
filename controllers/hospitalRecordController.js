const HospitalRecord = require('../models/HospitalRecord');
const UserModel = require('../models/User');
const Hospital = require('../models/Hospital');

// Create a new hospital record
const createHospitalRecord = async (req, res) => {
  try {
    const {
      patientArcId,
      patientId, // Firebase UID (optional fallback)
      visitType,
      chiefComplaint,
      diagnosis,
      treatment,
      prescription,
      vitalSigns,
      doctorId,
      notes,
      followUpRequired,
      followUpDate,
      appointmentId, // optional
      visitDate // optional
    } = req.body;

    // Resolve hospital: accept UID string or existing Mongo _id (from middleware)
    let hospitalObjectId = req.user?.hospitalId || null;
    if (!hospitalObjectId && req.body.hospitalId) {
      // Try as Mongo _id first; if invalid, resolve from UID
      const maybeId = req.body.hospitalId;
      let hospitalDoc = null;
      try {
        hospitalDoc = await Hospital.findById(maybeId);
      } catch (_) {}
      if (!hospitalDoc) {
        hospitalDoc = await Hospital.findOne({ uid: maybeId });
      }
      if (!hospitalDoc) {
        return res.status(404).json({ success: false, message: 'Hospital not found' });
      }
      hospitalObjectId = hospitalDoc._id;
    }

    if (!hospitalObjectId) {
      return res.status(400).json({ success: false, message: 'Hospital ID is required' });
    }

    // Get hospital details
    const hospital = await Hospital.findById(hospitalObjectId);
    if (!hospital) {
      return res.status(404).json({
        success: false,
        message: 'Hospital not found'
      });
    }

    // Find patient by ARC ID or patient ID
    let patient = null;
    if (patientArcId) {
      patient = await UserModel.findOne({ 
        healthQrId: patientArcId,
        userType: 'patient'
      });
    }
    
    // If not found by ARC ID, try to find by patient ID
    if (!patient && patientId) {
      patient = await UserModel.findOne({ 
        uid: patientId,
        userType: 'patient'
      });
    }

    if (!patient) {
      // Fallback: proceed with minimal patient information from request
      console.warn('⚠️ Patient not found by ARC ID or UID. Proceeding with request fields.');
      patient = {
        uid: patientId || undefined,
        fullName: req.body.patientName || 'Unknown Patient',
        email: req.body.patientEmail || '',
        mobileNumber: req.body.patientPhone || '',
        dateOfBirth: req.body.patientDateOfBirth || null,
        gender: req.body.patientGender || '',
        healthQrId: patientArcId || undefined,
      };
    }

    // Get doctor details if provided
    let doctor = null;
    if (doctorId) {
      doctor = await UserModel.findOne({ 
        uid: doctorId,
        userType: 'doctor'
      });
    }

    // Create hospital record
    const hospitalRecord = new HospitalRecord({
      hospitalId: hospitalObjectId,
      hospitalName: hospital.fullName,
      patientId: patient.uid,
      patientArcId: patient.healthQrId,
      patientName: patient.fullName,
      patientEmail: patient.email,
      patientPhone: patient.mobileNumber,
      patientDateOfBirth: patient.dateOfBirth,
      patientGender: patient.gender,
      visitType: visitType || 'appointment',
      chiefComplaint: chiefComplaint || diagnosis || notes || 'Consultation',
      diagnosis,
      treatment,
      prescription: prescription || [],
      vitalSigns: vitalSigns || {},
      doctorId: doctor?.uid,
      doctorName: doctor?.fullName,
      doctorSpecialization: doctor?.specialization,
      notes,
      followUpRequired: followUpRequired || false,
      followUpDate: followUpDate ? new Date(followUpDate) : null,
      visitDate: visitDate ? new Date(visitDate) : undefined,
      appointmentId
    });

    await hospitalRecord.save();

    res.status(201).json({
      success: true,
      message: 'Hospital record created successfully',
      data: hospitalRecord
    });

  } catch (error) {
    console.error('Error creating hospital record:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating hospital record',
      error: error.message
    });
  }
};

// Get all hospital records for a hospital
const getHospitalRecords = async (req, res) => {
  try {
    // Accept hospital UID via query (for screens that only have UID)
    let hospitalId = req.user.hospitalId;
    if (req.query.hospitalUid) {
      const h = await Hospital.findOne({ uid: req.query.hospitalUid });
      if (!h) {
        return res.status(404).json({ success: false, message: 'Hospital not found' });
      }
      hospitalId = h._id;
    }
    const { page = 1, limit = 10, search = '', status = 'all' } = req.query;

    const query = { hospitalId };
    
    // Add search filter
    if (search) {
      query.$or = [
        { patientName: { $regex: search, $options: 'i' } },
        { patientArcId: { $regex: search, $options: 'i' } },
        { chiefComplaint: { $regex: search, $options: 'i' } },
        { diagnosis: { $regex: search, $options: 'i' } }
      ];
    }

    // Add status filter
    if (status !== 'all') {
      query.status = status;
    }

    const records = await HospitalRecord.find(query)
      .sort({ visitDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('hospitalId', 'fullName address');

    const total = await HospitalRecord.countDocuments(query);

    res.json({
      success: true,
      data: records,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });

  } catch (error) {
    console.error('Error fetching hospital records:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching hospital records',
      error: error.message
    });
  }
};

// Get a specific hospital record
const getHospitalRecordById = async (req, res) => {
  try {
    const { recordId } = req.params;
    const hospitalId = req.user.hospitalId;

    const record = await HospitalRecord.findOne({
      _id: recordId,
      hospitalId
    }).populate('hospitalId', 'fullName address');

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Hospital record not found'
      });
    }

    res.json({
      success: true,
      data: record
    });

  } catch (error) {
    console.error('Error fetching hospital record:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching hospital record',
      error: error.message
    });
  }
};

// Update a hospital record
const updateHospitalRecord = async (req, res) => {
  try {
    const { recordId } = req.params;
    const hospitalId = req.user.hospitalId;
    const updateData = req.body;

    const record = await HospitalRecord.findOneAndUpdate(
      { _id: recordId, hospitalId },
      { ...updateData, updatedAt: new Date() },
      { new: true, runValidators: true }
    );

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Hospital record not found'
      });
    }

    res.json({
      success: true,
      message: 'Hospital record updated successfully',
      data: record
    });

  } catch (error) {
    console.error('Error updating hospital record:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating hospital record',
      error: error.message
    });
  }
};

// Delete a hospital record
const deleteHospitalRecord = async (req, res) => {
  try {
    const { recordId } = req.params;
    const hospitalId = req.user.hospitalId;

    const record = await HospitalRecord.findOneAndDelete({
      _id: recordId,
      hospitalId
    });

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Hospital record not found'
      });
    }

    res.json({
      success: true,
      message: 'Hospital record deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting hospital record:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting hospital record',
      error: error.message
    });
  }
};

// Get patient by ARC ID
const getPatientByArcId = async (req, res) => {
  try {
    const { arcId } = req.params;

    const patient = await UserModel.findOne({
      healthQrId: arcId,
      userType: 'patient'
    }).select('-password -tokens');

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found with the provided ARC ID'
      });
    }

    res.json({
      success: true,
      data: patient
    });

  } catch (error) {
    console.error('Error fetching patient by ARC ID:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching patient by ARC ID',
      error: error.message
    });
  }
};

// Get hospital records statistics
const getHospitalRecordsStats = async (req, res) => {
  try {
    const hospitalId = req.user.hospitalId;

    const totalRecords = await HospitalRecord.countDocuments({ hospitalId });
    const activeRecords = await HospitalRecord.countDocuments({ 
      hospitalId, 
      status: 'active' 
    });
    const completedRecords = await HospitalRecord.countDocuments({ 
      hospitalId, 
      status: 'completed' 
    });
    const todayRecords = await HospitalRecord.countDocuments({
      hospitalId,
      visitDate: {
        $gte: new Date(new Date().setHours(0, 0, 0, 0)),
        $lt: new Date(new Date().setHours(23, 59, 59, 999))
      }
    });

    res.json({
      success: true,
      data: {
        totalRecords,
        activeRecords,
        completedRecords,
        todayRecords
      }
    });

  } catch (error) {
    console.error('Error fetching hospital records stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching hospital records stats',
      error: error.message
    });
  }
};

module.exports = {
  createHospitalRecord,
  getHospitalRecords,
  getHospitalRecordById,
  updateHospitalRecord,
  deleteHospitalRecord,
  getPatientByArcId,
  getHospitalRecordsStats
};
