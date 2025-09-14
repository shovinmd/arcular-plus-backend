const Pharmacy = require('../models/Pharmacy');
const { sendRegistrationConfirmation, sendApprovalEmail } = require('../services/emailService');

// Register a new pharmacy
const registerPharmacy = async (req, res) => {
  try {
    console.log('💊 Pharmacy registration request received');
    console.log('📋 Request body:', JSON.stringify(req.body, null, 2));

    // Map documents from RegistrationService format to expected format
    const { documents } = req.body;
    console.log('📄 Documents received:', documents);
    
    if (documents) {
      if (documents.pharmacy_license) {
        req.body.licenseDocumentUrl = documents.pharmacy_license;
        console.log('✅ Pharmacy license URL mapped:', documents.pharmacy_license);
      }
      if (documents.drug_license) {
        req.body.drugLicenseUrl = documents.drug_license;
        console.log('✅ Drug license URL mapped:', documents.drug_license);
      }
      if (documents.premises_certificate) {
        req.body.premisesCertificateUrl = documents.premises_certificate;
        console.log('✅ Premises certificate URL mapped:', documents.premises_certificate);
      }
      if (documents.profile_picture) {
        req.body.profileImageUrl = documents.profile_picture;
        console.log('✅ Profile picture URL mapped:', documents.profile_picture);
      }
    }

    const userData = req.body;
    const { uid, email } = userData;

    // Check if pharmacy already exists by email or UID
    const existingPharmacy = await Pharmacy.findOne({ 
      $or: [
        { uid: uid },
        { email: email }
      ]
    });
    if (existingPharmacy) {
      return res.status(400).json({ 
        success: false,
        error: 'Pharmacy already registered',
        message: 'A pharmacy with this email or UID already exists. Please try logging in instead.'
      });
    }

    // PERMANENT FIX: Remove any problematic fields that might cause E11000 errors
    // This ensures compatibility with old database indexes
    const cleanUserData = { ...userData };
    
    // Remove any fields that don't exist in the current Pharmacy model
    // This prevents E11000 errors from old database indexes
    delete cleanUserData.registrationNumber; // Remove if it exists
    delete cleanUserData.medicalRegistrationNumber; // Remove if it exists
    delete cleanUserData.hospitalRegistrationNumber; // Remove if it exists
    
    // Ensure required fields are present
    if (!cleanUserData.licenseNumber || cleanUserData.licenseNumber.trim() === '') {
      return res.status(400).json({ 
        success: false,
        error: 'License number is required' 
      });
    }

    // Create new pharmacy user in Pharmacy model
    const newPharmacy = new Pharmacy({
      ...cleanUserData,
      // Ensure all required fields are present with defaults if missing
      servicesProvided: cleanUserData.servicesProvided || [],
      drugsAvailable: cleanUserData.drugsAvailable || [],
      affiliatedHospitals: cleanUserData.affiliatedHospitals || cleanUserData.pharmacyAffiliatedHospitals || [],
      drugLicenseUrl: cleanUserData.drugLicenseUrl || cleanUserData.licenseDocumentUrl || 'default_drug_license_url',
      premisesCertificateUrl: cleanUserData.premisesCertificateUrl || cleanUserData.profileImageUrl || 'default_premises_url',
      licenseDocumentUrl: cleanUserData.licenseDocumentUrl || 'default_license_url',
      // New fields with proper defaults
      operatingHours: cleanUserData.operatingHours || {
        openTime: '09:00',
        closeTime: '21:00',
        workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
      },
      pharmacistLicenseNumber: cleanUserData.pharmacistLicenseNumber || '',
      pharmacistQualification: cleanUserData.pharmacistQualification || '',
      pharmacistExperienceYears: cleanUserData.pharmacistExperienceYears || 0,
      status: 'active', // Changed from 'pending' to 'active' (valid enum value)
      isApproved: false,
      approvalStatus: 'pending',
      registrationDate: new Date(),
    });

    const savedPharmacy = await newPharmacy.save();

    // Send registration confirmation email
    try {
      await sendRegistrationConfirmation(
        savedPharmacy.email, 
        savedPharmacy.fullName, 
        'pharmacy'
      );
      console.log('✅ Registration confirmation email sent to pharmacy');
    } catch (emailError) {
      console.error('❌ Error sending registration confirmation email:', emailError);
    }

    res.status(201).json({
      success: true,
      message: 'Pharmacy registration successful',
      data: savedPharmacy,
      arcId: savedPharmacy.arcId,
    });
  } catch (error) {
    console.error('Pharmacy registration error:', error);
    
    // Handle specific E11000 duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      const value = error.keyValue[field];
      
      if (field === 'licenseNumber') {
        return res.status(400).json({
          success: false,
          error: 'License number already exists. Please use a different license number.',
          field: 'licenseNumber'
        });
      } else if (field === 'email') {
        return res.status(400).json({
          success: false,
          error: 'Email already registered. Please use a different email address.',
          field: 'email'
        });
      } else if (field === 'uid') {
        return res.status(400).json({
          success: false,
          error: 'User already registered. Please try logging in instead.',
          field: 'uid'
        });
      } else {
        return res.status(400).json({
          success: false,
          error: `Duplicate ${field} value. Please use a different ${field}.`,
          field: field
        });
      }
    }
    
    // Handle other errors
    res.status(500).json({ 
      success: false,
      error: 'Pharmacy registration failed',
      details: error.message 
    });
  }
};

// Get pharmacy by ID
const getPharmacyById = async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findById(req.params.id);
    if (!pharmacy) {
      return res.status(404).json({
        success: false,
        message: 'Pharmacy not found'
      });
    }
    const data = pharmacy.toObject();
    data.type = 'pharmacy';
    res.json({
      success: true,
      data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get pharmacy',
      error: error.message
    });
  }
};

// Get pharmacy by UID
const getPharmacyByUID = async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findOne({ uid: req.params.uid });
    if (!pharmacy) {
      return res.status(404).json({
        success: false,
        message: 'Pharmacy not found'
      });
    }
    
    const data = pharmacy.toObject();
    data.type = 'pharmacy';
    
    // Ensure required fields for UserModel compatibility
    data.pharmacyLicenseNumber = data.licenseNumber; // Map licenseNumber to pharmacyLicenseNumber
    data.pharmacyAddress = data.address; // Map address to pharmacyAddress
    data.pharmacyServicesProvided = data.servicesProvided; // Map servicesProvided to pharmacyServicesProvided
    
    // Ensure all required fields for UserModel are present
    data.gender = data.gender || 'Other'; // Default gender if missing
    data.dateOfBirth = data.dateOfBirth ? new Date(data.dateOfBirth).toISOString() : new Date('0000-00-00').toISOString(); // Ensure proper date format
    data.createdAt = data.registrationDate ? new Date(data.registrationDate).toISOString() : new Date().toISOString(); // Use registrationDate as createdAt
    
    // Convert complex objects to strings for UserModel compatibility
    data.operatingHours = data.operatingHours ? JSON.stringify(data.operatingHours) : '';
    data.documents = data.documents ? JSON.stringify(data.documents) : '';
    data.affiliatedHospitals = data.affiliatedHospitals ? JSON.stringify(data.affiliatedHospitals) : '';
    data.medicineInventory = data.medicineInventory ? JSON.stringify(data.medicineInventory) : '';
    data.geoCoordinates = data.geoCoordinates ? JSON.stringify(data.geoCoordinates) : '';
    
    // Ensure arrays are properly formatted
    data.servicesProvided = data.servicesProvided || [];
    data.drugsAvailable = data.drugsAvailable || [];
    
    // Remove MongoDB specific fields that might cause issues
    delete data.__v;
    delete data._id;
    
    // Ensure all string fields are properly formatted
    data.uid = String(data.uid || '');
    data.fullName = String(data.fullName || '');
    data.email = String(data.email || '');
    data.mobileNumber = String(data.mobileNumber || '');
    data.alternateMobile = data.alternateMobile ? String(data.alternateMobile) : null;
    data.gender = String(data.gender || 'Other');
    data.address = String(data.address || '');
    data.city = String(data.city || '');
    data.state = String(data.state || '');
    data.pincode = String(data.pincode || '');
    data.pharmacyName = String(data.pharmacyName || '');
    data.licenseNumber = String(data.licenseNumber || '');
    data.pharmacyLicenseNumber = String(data.pharmacyLicenseNumber || '');
    data.pharmacyAddress = String(data.pharmacyAddress || '');
    data.ownerName = String(data.ownerName || '');
    data.pharmacistName = String(data.pharmacistName || '');
    data.pharmacistLicenseNumber = String(data.pharmacistLicenseNumber || '');
    data.pharmacistQualification = String(data.pharmacistQualification || '');
    data.profileImageUrl = String(data.profileImageUrl || '');
    data.licenseDocumentUrl = String(data.licenseDocumentUrl || '');
    data.drugLicenseUrl = String(data.drugLicenseUrl || '');
    data.premisesCertificateUrl = String(data.premisesCertificateUrl || '');
    data.arcId = String(data.arcId || '');
    data.approvalStatus = String(data.approvalStatus || 'pending');
    
    // Ensure numeric fields are properly formatted
    data.longitude = Number(data.longitude) || 0;
    data.latitude = Number(data.latitude) || 0;
    data.pharmacistExperienceYears = Number(data.pharmacistExperienceYears) || 0;
    data.homeDelivery = Boolean(data.homeDelivery);
    data.isApproved = Boolean(data.isApproved);
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get pharmacy',
      error: error.message
    });
  }
};

// Get pharmacy by email
const getPharmacyByEmail = async (req, res) => {
  try {
    const { email } = req.params;
    const pharmacy = await Pharmacy.findOne({ email: email });
    if (!pharmacy) {
      return res.status(404).json({
        success: false,
        message: 'Pharmacy not found'
      });
    }
    
    const data = pharmacy.toObject();
    data.type = 'pharmacy';
    
    // Ensure required fields for UserModel compatibility
    data.pharmacyLicenseNumber = data.licenseNumber; // Map licenseNumber to pharmacyLicenseNumber
    data.pharmacyAddress = data.address; // Map address to pharmacyAddress
    data.pharmacyServicesProvided = data.servicesProvided; // Map servicesProvided to pharmacyServicesProvided
    
    // Ensure all required fields for UserModel are present
    data.gender = data.gender || 'Other'; // Default gender if missing
    data.dateOfBirth = data.dateOfBirth ? new Date(data.dateOfBirth).toISOString() : new Date('0000-00-00').toISOString(); // Ensure proper date format
    data.createdAt = data.registrationDate ? new Date(data.registrationDate).toISOString() : new Date().toISOString(); // Use registrationDate as createdAt
    
    // Convert complex objects to strings for UserModel compatibility
    data.operatingHours = data.operatingHours ? JSON.stringify(data.operatingHours) : '';
    data.documents = data.documents ? JSON.stringify(data.documents) : '';
    data.affiliatedHospitals = data.affiliatedHospitals ? JSON.stringify(data.affiliatedHospitals) : '';
    data.medicineInventory = data.medicineInventory ? JSON.stringify(data.medicineInventory) : '';
    data.geoCoordinates = data.geoCoordinates ? JSON.stringify(data.geoCoordinates) : '';
    
    // Ensure arrays are properly formatted
    data.servicesProvided = data.servicesProvided || [];
    data.drugsAvailable = data.drugsAvailable || [];
    
    // Remove MongoDB specific fields that might cause issues
    delete data.__v;
    delete data._id;
    
    // Ensure all string fields are properly formatted
    data.uid = String(data.uid || '');
    data.fullName = String(data.fullName || '');
    data.email = String(data.email || '');
    data.mobileNumber = String(data.mobileNumber || '');
    data.alternateMobile = data.alternateMobile ? String(data.alternateMobile) : null;
    data.gender = String(data.gender || 'Other');
    data.address = String(data.address || '');
    data.city = String(data.city || '');
    data.state = String(data.state || '');
    data.pincode = String(data.pincode || '');
    data.pharmacyName = String(data.pharmacyName || '');
    data.licenseNumber = String(data.licenseNumber || '');
    data.pharmacyLicenseNumber = String(data.pharmacyLicenseNumber || '');
    data.pharmacyAddress = String(data.pharmacyAddress || '');
    data.ownerName = String(data.ownerName || '');
    data.pharmacistName = String(data.pharmacistName || '');
    data.pharmacistLicenseNumber = String(data.pharmacistLicenseNumber || '');
    data.pharmacistQualification = String(data.pharmacistQualification || '');
    data.profileImageUrl = String(data.profileImageUrl || '');
    data.licenseDocumentUrl = String(data.licenseDocumentUrl || '');
    data.drugLicenseUrl = String(data.drugLicenseUrl || '');
    data.premisesCertificateUrl = String(data.premisesCertificateUrl || '');
    data.arcId = String(data.arcId || '');
    data.approvalStatus = String(data.approvalStatus || 'pending');
    
    // Ensure numeric fields are properly formatted
    data.longitude = Number(data.longitude) || 0;
    data.latitude = Number(data.latitude) || 0;
    data.pharmacistExperienceYears = Number(data.pharmacistExperienceYears) || 0;
    data.homeDelivery = Boolean(data.homeDelivery);
    data.isApproved = Boolean(data.isApproved);
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get pharmacy',
      error: error.message
    });
  }
};

// Get all pharmacies
const getAllPharmacies = async (req, res) => {
  try {
    const pharmacies = await Pharmacy.find({ isApproved: true });
    const withType = pharmacies.map(p => { const d = p.toObject(); d.type = 'pharmacy'; return d; });
    res.json({
      success: true,
      data: withType
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get pharmacies',
      error: error.message
    });
  }
};

// Update pharmacy
const updatePharmacy = async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true }
    );
    if (!pharmacy) {
      return res.status(404).json({
        success: false,
        message: 'Pharmacy not found'
      });
    }
    res.json({
      success: true,
      message: 'Pharmacy updated successfully',
      data: pharmacy
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update pharmacy',
      error: error.message
    });
  }
};

// Update pharmacy by UID
const updatePharmacyByUID = async (req, res) => {
  try {
    const { uid } = req.params;
    const updates = req.body;
    
    console.log(`🔄 Updating pharmacy with UID: ${uid}`);
    console.log('📝 Update data:', JSON.stringify(updates, null, 2));
    
    // Find pharmacy by UID and update
    const pharmacy = await Pharmacy.findOneAndUpdate(
      { uid: uid },
      { ...updates, updatedAt: new Date() },
      { new: true }
    );
    
    if (!pharmacy) {
      return res.status(404).json({
        success: false,
        message: 'Pharmacy not found'
      });
    }
    
    console.log(`✅ Pharmacy updated successfully: ${pharmacy.pharmacyName}`);
    
    res.json({
      success: true,
      message: 'Pharmacy updated successfully',
      data: pharmacy
    });
  } catch (error) {
    console.error('❌ Error updating pharmacy by UID:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update pharmacy',
      error: error.message
    });
  }
};

// Delete pharmacy
const deletePharmacy = async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findByIdAndDelete(req.params.id);
    if (!pharmacy) {
      return res.status(404).json({
        success: false,
        message: 'Pharmacy not found'
      });
    }
    res.json({
      success: true,
      message: 'Pharmacy deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete pharmacy',
      error: error.message
    });
  }
};

// Get pharmacies by city
const getPharmaciesByCity = async (req, res) => {
  try {
    const pharmacies = await Pharmacy.findByCity(req.params.city);
    res.json({
      success: true,
      data: pharmacies
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get pharmacies by city',
      error: error.message
    });
  }
};

// Get pharmacies by drug
const getPharmaciesByDrug = async (req, res) => {
  try {
    const pharmacies = await Pharmacy.findByDrug(req.params.drugName);
    res.json({
      success: true,
      data: pharmacies
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get pharmacies by drug',
      error: error.message
    });
  }
};

// Search pharmacies
const searchPharmacies = async (req, res) => {
  try {
    const { query, city, specialization } = req.query;
    
    let searchCriteria = {};
    
    if (query) {
      searchCriteria.$or = [
        { pharmacyName: { $regex: query, $options: 'i' } },
        { ownerName: { $regex: query, $options: 'i' } },
        { pharmacistName: { $regex: query, $options: 'i' } }
      ];
    }
    
    if (city) {
      searchCriteria.city = { $regex: city, $options: 'i' };
    }
    
    if (specialization) {
      searchCriteria.specialization = { $regex: specialization, $options: 'i' };
    }
    
    // Only return approved pharmacies
    searchCriteria.isApproved = true;
    
    const pharmacies = await Pharmacy.find(searchCriteria).limit(20);
    
    res.json({
      success: true,
      data: pharmacies,
      count: pharmacies.length
    });
  } catch (error) {
    console.error('Error searching pharmacies:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search pharmacies',
      error: error.message
    });
  }
};

// Get pending approvals
const getPendingApprovals = async (req, res) => {
  try {
    const pharmacies = await Pharmacy.getPendingApprovals();
    res.json({
      success: true,
      data: pharmacies
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get pending approvals',
      error: error.message
    });
  }
};

// Approve pharmacy
const approvePharmacy = async (req, res) => {
  try {
    const { notes } = req.body;
    const pharmacy = await Pharmacy.approvePharmacy(req.params.id, req.user.uid, notes);
    if (!pharmacy) {
      return res.status(404).json({
        success: false,
        message: 'Pharmacy not found'
      });
    }

    // Send approval email
    try {
      await sendApprovalEmail(pharmacy.email, pharmacy.fullName, 'pharmacy', true, notes);
      console.log('✅ Approval email sent to pharmacy');
    } catch (emailError) {
      console.error('❌ Error sending approval email:', emailError);
    }

    res.json({
      success: true,
      message: 'Pharmacy approved successfully',
      data: pharmacy
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to approve pharmacy',
      error: error.message
    });
  }
};

// Reject pharmacy
const rejectPharmacy = async (req, res) => {
  try {
    const { reason } = req.body;
    const pharmacy = await Pharmacy.rejectPharmacy(req.params.id, req.user.uid, reason);
    if (!pharmacy) {
      return res.status(404).json({
        success: false,
        message: 'Pharmacy not found'
      });
    }

    // Send rejection email
    try {
      await sendApprovalEmail(pharmacy.email, pharmacy.fullName, 'pharmacy', false, reason);
      console.log('✅ Rejection email sent to pharmacy');
    } catch (emailError) {
      console.error('❌ Error sending rejection email:', emailError);
    }

    res.json({
      success: true,
      message: 'Pharmacy rejected successfully',
      data: pharmacy
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to reject pharmacy',
      error: error.message
    });
  }
};

// Get pending approvals for staff
const getPendingApprovalsForStaff = async (req, res) => {
  try {
    const pendingPharmacies = await Pharmacy.find({ 
      isApproved: false, 
      approvalStatus: 'pending' 
    }).select('-__v').sort({ createdAt: -1 });

    res.json({
      success: true,
      data: pendingPharmacies,
      count: pendingPharmacies.length
    });
  } catch (error) {
    console.error('Error fetching pending approvals for staff:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pending approvals'
    });
  }
};

// Approve pharmacy by staff
const approvePharmacyByStaff = async (req, res) => {
  try {
    const { pharmacyId } = req.params;
    const { approvedBy, notes } = req.body;
    
    console.log(`🔍 Approving pharmacy with ID: ${pharmacyId}`);
    console.log(`📝 Approval notes: ${notes}`);
    console.log(`👤 Approved by: ${approvedBy}`);
    
    // Try to find pharmacy by either Firebase uid or Mongo _id
    let pharmacy = null;
    try {
      const mongoose = require('mongoose');
      const isObjectId = mongoose.isValidObjectId(pharmacyId);
      console.log('🔎 Lookup strategy:', isObjectId ? 'by _id' : 'by uid');
      if (isObjectId) {
        pharmacy = await Pharmacy.findById(pharmacyId);
      }
      if (!pharmacy) {
        pharmacy = await Pharmacy.findOne({ uid: pharmacyId });
      }
    } catch (lookupErr) {
      console.error('❌ Lookup error, trying uid fallback:', lookupErr);
      pharmacy = await Pharmacy.findOne({ uid: pharmacyId });
    }
    
    if (!pharmacy) {
      console.log(`❌ Pharmacy not found with ID: ${pharmacyId}`);
      return res.status(404).json({
        success: false,
        error: 'Pharmacy not found'
      });
    }

    console.log(`✅ Found pharmacy: ${pharmacy.pharmacyName} (${pharmacy.email})`);
    console.log(`📊 Current status: ${pharmacy.status}, isApproved: ${pharmacy.isApproved}, approvalStatus: ${pharmacy.approvalStatus}`);

    // Update approval status (make idempotent)
    const wasAlreadyApproved = pharmacy.isApproved && pharmacy.approvalStatus === 'approved' && pharmacy.status === 'active';
    
    if (!wasAlreadyApproved) {
      pharmacy.isApproved = true;
      pharmacy.approvalStatus = 'approved';
      pharmacy.status = 'active';
      pharmacy.approvedAt = new Date();
      pharmacy.approvedBy = approvedBy || 'staff';
      pharmacy.approvalNotes = notes || 'Approved by staff';
      
      await pharmacy.save();
      console.log(`✅ Pharmacy approval status updated successfully`);
    } else {
      console.log(`ℹ️ Pharmacy was already approved, no changes made`);
    }

    // Send approval email (only if not already approved)
    if (!wasAlreadyApproved) {
      try {
        await sendApprovalEmail(pharmacy.email, pharmacy.pharmacyName, 'pharmacy', true, notes);
        console.log('✅ Approval email sent to pharmacy');
      } catch (emailError) {
        console.error('❌ Error sending approval email:', emailError);
        // Don't fail the request if email fails
      }
    }
    
    res.json({
      success: true,
      message: wasAlreadyApproved ? 'Pharmacy was already approved' : 'Pharmacy approved successfully',
      data: {
        _id: pharmacy._id,
        uid: pharmacy.uid,
        pharmacyName: pharmacy.pharmacyName,
        email: pharmacy.email,
        status: pharmacy.status,
        isApproved: pharmacy.isApproved,
        approvalStatus: pharmacy.approvalStatus,
        approvedAt: pharmacy.approvedAt,
        approvedBy: pharmacy.approvedBy
      }
    });
  } catch (error) {
    console.error('❌ Error approving pharmacy by staff:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to approve pharmacy',
      details: error.message
    });
  }
};

// Reject pharmacy by staff
const rejectPharmacyByStaff = async (req, res) => {
  try {
    const { pharmacyId } = req.params;
    const { rejectedBy, reason, category, nextSteps } = req.body;
    
    const pharmacy = await Pharmacy.findById(pharmacyId);
    if (!pharmacy) {
      return res.status(404).json({
        success: false,
        error: 'Pharmacy not found'
      });
    }

    // Update rejection status
    pharmacy.isApproved = false;
    pharmacy.approvalStatus = 'rejected';
    pharmacy.rejectedAt = new Date();
    pharmacy.rejectedBy = rejectedBy || 'staff';
    pharmacy.rejectionReason = reason;
    pharmacy.rejectionCategory = category;
    pharmacy.nextSteps = nextSteps;
    
    await pharmacy.save();

    // Send rejection email
    try {
      await sendApprovalEmail(pharmacy.email, pharmacy.pharmacyName, 'pharmacy', false, reason);
      console.log('✅ Rejection email sent to pharmacy');
    } catch (emailError) {
      console.error('❌ Error sending rejection email:', emailError);
    }
    
    res.json({
      success: true,
      message: 'Pharmacy rejected successfully',
      data: pharmacy
    });
  } catch (error) {
    console.error('Error rejecting pharmacy by staff:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reject pharmacy'
    });
  }
};

// Get pharmacies by affiliation (hospital Mongo _id)
const getPharmaciesByAffiliation = async (req, res) => {
  try {
    const { hospitalId } = req.params;
    const pharmacies = await Pharmacy.find({
      isApproved: true,
      approvalStatus: 'approved',
      status: 'active',
      'affiliatedHospitals.hospitalId': hospitalId,
    }).select('-__v').sort({ createdAt: -1 });

    res.json({ success: true, data: pharmacies, count: pharmacies.length });
  } catch (error) {
    console.error('Error fetching pharmacies by affiliation:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch pharmacies by affiliation' });
  }
};

// Get pharmacy approval status
const getPharmacyApprovalStatus = async (req, res) => {
  try {
    const { uid } = req.params;
    const pharmacy = await Pharmacy.findOne({ uid });
    
    if (!pharmacy) {
      return res.status(404).json({
        success: false,
        message: 'Pharmacy not found'
      });
    }

    res.json({
      success: true,
      data: {
        isApproved: pharmacy.isApproved,
        approvalStatus: pharmacy.approvalStatus,
        status: pharmacy.status,
        approvedAt: pharmacy.approvedAt,
        approvedBy: pharmacy.approvedBy
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pharmacy approval status',
      error: error.message
    });
  }
};

// Note: Database cleanup function removed - no longer needed with the permanent fix

module.exports = {
  registerPharmacy,
  getAllPharmacies,
  getPharmacyById,
  getPharmacyByUID,
  getPharmacyByEmail,
  updatePharmacy,
  updatePharmacyByUID,
  deletePharmacy,
  getPharmaciesByCity,
  getPharmaciesByDrug,
  searchPharmacies,
  getPendingApprovals,
  approvePharmacy,
  rejectPharmacy,
  getPendingApprovalsForStaff,
  approvePharmacyByStaff,
  rejectPharmacyByStaff,
  getPharmaciesByAffiliation,
  getPharmacyApprovalStatus
}; 