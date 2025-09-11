const { sendRegistrationConfirmation, sendApprovalEmail } = require('../services/emailService');
const Doctor = require('../models/Doctor');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');

// Register new doctor
const registerDoctor = async (req, res) => {
  try {
    console.log('🏥 Doctor registration request:', req.body);
    console.log('🔍 Extracted licenseNumber:', req.body.licenseNumber);
    console.log('🔍 Extracted licenseNumber type:', typeof req.body.licenseNumber);
    console.log('🔍 Specialization:', req.body.specialization);
    console.log('🔍 Specializations:', req.body.specializations);
    console.log('🔍 Specializations type:', typeof req.body.specializations);
    
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
      licenseNumber,
      specialization,
      specializations,
      experienceYears,
      consultationFee,
      education,
      qualification,
      qualifications,
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
      'licenseNumber', 'specialization', 'experienceYears', 'consultationFee'
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

    // Check if doctor with same license number exists
    const existingLicenseDoctor = await Doctor.findOne({ licenseNumber });
    if (existingLicenseDoctor) {
      return res.status(400).json({
        success: false,
        error: 'Doctor with this license number already exists'
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
      licenseNumber,
      specialization,
      specializations: Array.isArray(specializations) ? specializations : (specialization ? [specialization] : []),
      experienceYears: parseInt(experienceYears),
      consultationFee: parseFloat(consultationFee),
      education,
      qualification: qualification || '',
      qualifications: qualifications || [],
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

    console.log('🔍 Doctor object being created:', doctor);
    console.log('🔍 Doctor licenseNumber field:', doctor.licenseNumber);

    // Ensure licenseNumber is not null
    if (!licenseNumber || licenseNumber.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'License number is required and cannot be empty'
      });
    }

    // Set the licenseNumber explicitly to ensure it's not null
    doctor.licenseNumber = licenseNumber;
    
    // Handle licenseDocumentUrl - use from documents if not provided directly
    if (!licenseDocumentUrl && req.body.documents && req.body.documents.license_certificate) {
      doctor.licenseDocumentUrl = req.body.documents.license_certificate;
    } else if (licenseDocumentUrl) {
      doctor.licenseDocumentUrl = licenseDocumentUrl;
    }
    
    console.log('🔍 Final doctor licenseNumber before save:', doctor.licenseNumber);
    console.log('🔍 Final doctor licenseDocumentUrl before save:', doctor.licenseDocumentUrl);

    await doctor.save();

    console.log('✅ Doctor registered successfully:', doctor._id);
    console.log('🔍 Saved doctor specialization:', doctor.specialization);
    console.log('🔍 Saved doctor specializations:', doctor.specializations);
    console.log('🔍 Saved doctor specializations type:', typeof doctor.specializations);
    console.log('🔍 Saved doctor specializations length:', doctor.specializations?.length);

    // Send registration confirmation email
    try {
      await sendRegistrationConfirmation(
        doctor.email, 
        doctor.fullName, 
        'doctor'
      );
      console.log('✅ Registration confirmation email sent to doctor');
    } catch (emailError) {
      console.error('❌ Error sending registration confirmation email:', emailError);
    }

    res.status(201).json({
      success: true,
      message: 'Doctor registered successfully',
      data: {
        id: doctor._id,
        uid: doctor.uid,
        fullName: doctor.fullName,
        email: doctor.email,
        medicalRegistrationNumber: doctor.medicalRegistrationNumber,
        licenseNumber: doctor.licenseNumber,
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
    
    // Debug: Check specializations field
    console.log('🔍 Backend - Sample doctor data:');
    if (doctors.length > 0) {
      const sampleDoctor = doctors[0];
      console.log('  - Name:', sampleDoctor.fullName);
      console.log('  - Specialization:', sampleDoctor.specialization);
      console.log('  - Specializations:', sampleDoctor.specializations);
      console.log('  - Specializations type:', typeof sampleDoctor.specializations);
      console.log('  - Specializations length:', sampleDoctor.specializations?.length);
    }
    
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

// Get doctor by email
const getDoctorByEmail = async (req, res) => {
  try {
    const { email } = req.params;
    console.log('🔍 Fetching doctor with email:', email);
    
    const doctor = await Doctor.findOne({ email: email });
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
    console.error('Error fetching doctor by email:', error);
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

    // Send approval email
    try {
      await sendApprovalEmail(doctor.email, doctor.fullName, 'doctor', true, notes);
      console.log('✅ Approval email sent to doctor');
    } catch (emailError) {
      console.error('❌ Error sending approval email:', emailError);
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

    // Send rejection email
    try {
      await sendApprovalEmail(doctor.email, doctor.fullName, 'doctor', false, reason);
      console.log('✅ Rejection email sent to doctor');
    } catch (emailError) {
      console.error('❌ Error sending rejection email:', emailError);
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

// Get pending approvals for staff
const getPendingApprovalsForStaff = async (req, res) => {
  try {
    const pendingDoctors = await Doctor.find({ 
      isApproved: false, 
      approvalStatus: 'pending' 
    }).select('-__v').sort({ createdAt: -1 });

    res.json({
      success: true,
      data: pendingDoctors,
      count: pendingDoctors.length
    });
  } catch (error) {
    console.error('Error fetching pending approvals for staff:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pending approvals'
    });
  }
};

// Approve doctor by staff
const approveDoctorByStaff = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { approvedBy, notes } = req.body;
    
    console.log(`🔍 Approving doctor with ID: ${doctorId}`);
    console.log(`📝 Approval notes: ${notes}`);
    console.log(`👤 Approved by: ${approvedBy}`);
    
    // Try to find doctor by either Mongo _id or Firebase uid
    let doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      doctor = await Doctor.findOne({ uid: doctorId });
    }
    
    if (!doctor) {
      console.log(`❌ Doctor not found with ID: ${doctorId}`);
      return res.status(404).json({
        success: false,
        error: 'Doctor not found'
      });
    }

    console.log(`✅ Found doctor: ${doctor.fullName} (${doctor.email})`);
    console.log(`📊 Current status: ${doctor.status}, isApproved: ${doctor.isApproved}, approvalStatus: ${doctor.approvalStatus}`);

    // Update approval status (make idempotent)
    const wasAlreadyApproved = doctor.isApproved && doctor.approvalStatus === 'approved' && doctor.status === 'active';
    
    if (!wasAlreadyApproved) {
      doctor.isApproved = true;
      doctor.approvalStatus = 'approved';
      doctor.status = 'active';
      doctor.approvedAt = new Date();
      doctor.approvedBy = approvedBy || 'staff';
      doctor.approvalNotes = notes || 'Approved by staff';
      
      await doctor.save();
      console.log(`✅ Doctor approval status updated successfully`);
    } else {
      console.log(`ℹ️ Doctor was already approved, no changes made`);
    }

    // Send approval email (only if not already approved)
    if (!wasAlreadyApproved) {
      try {
        await sendApprovalEmail(doctor.email, doctor.fullName, 'doctor', true, notes);
        console.log('✅ Approval email sent to doctor');
      } catch (emailError) {
        console.error('❌ Error sending approval email:', emailError);
        // Don't fail the request if email fails
      }
    }
    
    res.json({
      success: true,
      message: wasAlreadyApproved ? 'Doctor was already approved' : 'Doctor approved successfully',
      data: {
        _id: doctor._id,
        uid: doctor.uid,
        fullName: doctor.fullName,
        email: doctor.email,
        status: doctor.status,
        isApproved: doctor.isApproved,
        approvalStatus: doctor.approvalStatus,
        approvedAt: doctor.approvedAt,
        approvedBy: doctor.approvedBy
      }
    });
  } catch (error) {
    console.error('❌ Error approving doctor by staff:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to approve doctor',
      details: error.message
    });
  }
};

// Reject doctor by staff
const rejectDoctorByStaff = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { rejectedBy, reason, category, nextSteps } = req.body;
    
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({
        success: false,
        error: 'Doctor not found'
      });
    }

    // Update rejection status
    doctor.isApproved = false;
    doctor.approvalStatus = 'rejected';
    doctor.rejectedAt = new Date();
    doctor.rejectedBy = rejectedBy || 'staff';
    doctor.rejectionReason = reason;
    doctor.rejectionCategory = category;
    doctor.nextSteps = nextSteps;
    
    await doctor.save();

    // Send rejection email
    try {
      await sendApprovalEmail(doctor.email, doctor.fullName, 'doctor', false, reason);
      console.log('✅ Rejection email sent to doctor');
    } catch (emailError) {
      console.error('❌ Error sending rejection email:', emailError);
    }
    
    res.json({
      success: true,
      message: 'Doctor rejected successfully',
      data: doctor
    });
  } catch (error) {
    console.error('Error rejecting doctor by staff:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reject doctor'
    });
  }
};

// Get doctors by affiliation (hospital Mongo _id)
const getDoctorsByAffiliation = async (req, res) => {
  try {
    const { hospitalId } = req.params;
    const doctors = await Doctor.find({
      isApproved: true,
      approvalStatus: 'approved',
      status: 'active',
      'affiliatedHospitals.hospitalId': hospitalId,
    }).select('-__v').sort({ createdAt: -1 });

    res.json({ success: true, data: doctors, count: doctors.length });
  } catch (error) {
    console.error('Error fetching doctors by affiliation:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch doctors by affiliation' });
  }
};


module.exports = {
  registerDoctor,
  getAllDoctors,
  getDoctorById,
  getDoctorByUID,
  getDoctorByEmail,
  updateDoctor,
  deleteDoctor,
  getDoctorsByHospital,
  getDoctorsBySpecialization,
  searchDoctors,
  getPendingApprovals,
  approveDoctor,
  rejectDoctor,
  getPendingApprovalsForStaff,
  approveDoctorByStaff,
  rejectDoctorByStaff,
  getDoctorsByAffiliation,
}; 