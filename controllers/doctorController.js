const Doctor = require('../models/Doctor');

// Register new doctor
const registerDoctor = async (req, res) => {
  try {
    console.log('🏥 Doctor registration request:', req.body);
    
    const {
      uid,
      fullName,
      email,
      mobileNumber,
      altPhoneNumber,
      gender,
      dateOfBirth,
      address,
      city,
      state,
      pincode,
      geoCoordinates,
      medicalRegistrationNumber,
      specialization,
      experienceYears,
      consultationFee,
      education,
      bio,
      affiliatedHospitals,
      currentHospital,
      workingHours,
      licenseDocumentUrl,
      profileImageUrl
    } = req.body;

    // Validate required fields
    const requiredFields = [
      'uid', 'fullName', 'email', 'mobileNumber', 'gender', 'dateOfBirth',
      'address', 'city', 'state', 'pincode', 'medicalRegistrationNumber',
      'specialization', 'experienceYears', 'consultationFee', 'licenseDocumentUrl'
    ];

    const missingFields = requiredFields.filter(field => !req.body[field]);
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    // Check if doctor with same medical registration number exists
    const existingDoctor = await Doctor.findOne({ medicalRegistrationNumber });
    if (existingDoctor) {
      return res.status(400).json({
        success: false,
        error: 'Doctor with this medical registration number already exists'
      });
    }

    // Check if email already exists
    const existingEmail = await Doctor.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        error: 'Email already registered'
      });
    }

    // Check if UID already exists
    const existingUID = await Doctor.findOne({ uid });
    if (existingUID) {
      return res.status(400).json({
        success: false,
        error: 'User already registered'
      });
    }

    // Create new doctor
    const doctor = new Doctor({
      uid,
      fullName,
      email,
      mobileNumber,
      altPhoneNumber,
      gender,
      dateOfBirth: new Date(dateOfBirth),
      address,
      city,
      state,
      pincode,
      geoCoordinates,
      medicalRegistrationNumber,
      specialization,
      experienceYears: parseInt(experienceYears),
      consultationFee: parseFloat(consultationFee),
      education,
      bio,
      affiliatedHospitals: affiliatedHospitals || [],
      currentHospital,
      workingHours,
      licenseDocumentUrl,
      profileImageUrl,
      // Temporarily set as approved for immediate access
      isApproved: true,
      approvalStatus: 'approved',
      status: 'active'
    });

    await doctor.save();

    console.log('✅ Doctor registered successfully:', doctor._id);

    res.status(201).json({
      success: true,
      message: 'Doctor registered successfully',
      data: {
        id: doctor._id,
        uid: doctor.uid,
        fullName: doctor.fullName,
        email: doctor.email,
        medicalRegistrationNumber: doctor.medicalRegistrationNumber,
        specialization: doctor.specialization,
        isApproved: doctor.isApproved,
        approvalStatus: doctor.approvalStatus
      }
    });
  } catch (error) {
    console.error('❌ Error registering doctor:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to register doctor'
    });
  }
};

// Get all doctors
const getAllDoctors = async (req, res) => {
  try {
    const doctors = await Doctor.findActive();
    
    // Add type field to each doctor
    const doctorsWithType = doctors.map(doctor => {
      const doctorData = doctor.toObject();
      doctorData.type = 'doctor';
      return doctorData;
    });
    
    res.json({
      success: true,
      data: doctorsWithType,
      count: doctorsWithType.length
    });
  } catch (error) {
    console.error('Error fetching doctors:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch doctors'
    });
  }
};

// Get doctor by ID
const getDoctorById = async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id);
    if (!doctor) {
      return res.status(404).json({
        success: false,
        error: 'Doctor not found'
      });
    }
    
    // Convert to plain object and add type field
    const doctorData = doctor.toObject();
    doctorData.type = 'doctor';
    
    res.json({
      success: true,
      data: doctorData
    });
  } catch (error) {
    console.error('Error fetching doctor:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch doctor'
    });
  }
};

// Get doctor by UID
const getDoctorByUID = async (req, res) => {
  try {
    const { uid } = req.params;
    console.log('🔍 Fetching doctor with UID:', uid);
    
    const doctor = await Doctor.findOne({ uid });
    if (!doctor) {
      return res.status(404).json({
        success: false,
        error: 'Doctor not found'
      });
    }
    
    console.log('✅ Found doctor:', doctor.fullName);
    
    // Convert to plain object and add type field
    const doctorData = doctor.toObject();
    doctorData.type = 'doctor';
    
    res.json({
      success: true,
      data: doctorData
    });
  } catch (error) {
    console.error('Error fetching doctor by UID:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch doctor'
    });
  }
};

// Update doctor
const updateDoctor = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const doctor = await Doctor.findByIdAndUpdate(
      id,
      { ...updateData, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    
    if (!doctor) {
      return res.status(404).json({
        success: false,
        error: 'Doctor not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Doctor updated successfully',
      data: doctor
    });
  } catch (error) {
    console.error('Error updating doctor:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update doctor'
    });
  }
};

// Delete doctor
const deleteDoctor = async (req, res) => {
  try {
    const { id } = req.params;
    const doctor = await Doctor.findByIdAndDelete(id);
    
    if (!doctor) {
      return res.status(404).json({
        success: false,
        error: 'Doctor not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Doctor deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting doctor:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete doctor'
    });
  }
};

// Get doctors by hospital
const getDoctorsByHospital = async (req, res) => {
  try {
    const { hospitalId } = req.params;
    const doctors = await Doctor.findByHospital(hospitalId);

    res.json({
      success: true,
      data: doctors,
      count: doctors.length
    });
  } catch (error) {
    console.error('Error fetching doctors by hospital:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch doctors'
    });
  }
};

// Get doctors by specialization
const getDoctorsBySpecialization = async (req, res) => {
  try {
    const { specialization } = req.params;
    const doctors = await Doctor.findBySpecialization(specialization);

    res.json({
      success: true,
      data: doctors,
      count: doctors.length
    });
  } catch (error) {
    console.error('Error fetching doctors by specialization:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch doctors'
    });
  }
};

// Search doctors
const searchDoctors = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    const doctors = await Doctor.search(q);
    res.json({
      success: true,
      data: doctors,
      count: doctors.length
    });
  } catch (error) {
    console.error('Error searching doctors:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search doctors'
    });
  }
};

// Get pending approvals
const getPendingApprovals = async (req, res) => {
  try {
    const pendingDoctors = await Doctor.getPendingApprovals();
    res.json({
      success: true,
      data: pendingDoctors,
      count: pendingDoctors.length
    });
  } catch (error) {
    console.error('Error fetching pending approvals:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pending approvals'
    });
  }
};

// Approve doctor
const approveDoctor = async (req, res) => {
  try {
    const { id } = req.params;
    const { approvedBy, notes } = req.body;
    
    const doctor = await Doctor.approveDoctor(id, approvedBy, notes);
    
    if (!doctor) {
      return res.status(404).json({
        success: false,
        error: 'Doctor not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Doctor approved successfully',
      data: doctor
    });
  } catch (error) {
    console.error('Error approving doctor:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to approve doctor'
    });
  }
};

// Reject doctor
const rejectDoctor = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectedBy, reason } = req.body;
    
    const doctor = await Doctor.rejectDoctor(id, rejectedBy, reason);
    
    if (!doctor) {
      return res.status(404).json({
        success: false,
        error: 'Doctor not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Doctor rejected successfully',
      data: doctor
    });
  } catch (error) {
    console.error('Error rejecting doctor:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reject doctor'
    });
  }
};

module.exports = {
  registerDoctor,
  getAllDoctors,
  getDoctorById,
  getDoctorByUID,
  updateDoctor,
  deleteDoctor,
  getDoctorsByHospital,
  getDoctorsBySpecialization,
  searchDoctors,
  getPendingApprovals,
  approveDoctor,
  rejectDoctor
}; 