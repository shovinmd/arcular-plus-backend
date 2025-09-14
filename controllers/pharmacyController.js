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
    console.log('🔍 Getting affiliated pharmacies for hospital ID:', hospitalId);
    
    const pharmacies = await Pharmacy.find({
      isApproved: true,
      approvalStatus: 'approved',
      status: 'active',
      'affiliatedHospitals.hospitalId': hospitalId,
    }).select('-__v').sort({ createdAt: -1 });

    console.log('🔍 Found pharmacies:', pharmacies.length);
    console.log('🔍 Pharmacy details:', pharmacies.map(p => ({
      _id: p._id,
      pharmacyName: p.pharmacyName,
      affiliatedHospitals: p.affiliatedHospitals
    })));

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

// Associate pharmacy with hospital by ARC ID
const associatePharmacyByArcId = async (req, res) => {
  try {
    console.log('🔗 AssociatePharmacyByArcId - Request body:', JSON.stringify(req.body, null, 2));
    console.log('🔗 AssociatePharmacyByArcId - User from auth:', JSON.stringify(req.user, null, 2));
    console.log('🔗 AssociatePharmacyByArcId - Headers:', JSON.stringify(req.headers, null, 2));
    
    const { arcId } = req.body;
    
    if (!arcId) {
      console.log('❌ Missing arcId in request body');
      return res.status(400).json({
        success: false,
        message: 'ARC ID is required'
      });
    }
    
    const hospitalUid = req.user.uid; // From Firebase auth middleware

    console.log(`🔗 Associating pharmacy with ARC ID: ${arcId} to hospital: ${hospitalUid}`);

    // Get hospital MongoDB ID
    const Hospital = require('../models/Hospital');
    const hospital = await Hospital.findOne({ uid: hospitalUid });
    console.log('🔗 Hospital found:', hospital ? 'Yes' : 'No');
    if (hospital) {
      console.log('🔗 Hospital details:', {
        _id: hospital._id,
        hospitalName: hospital.hospitalName,
        fullName: hospital.fullName,
        uid: hospital.uid
      });
    }
    
    if (!hospital) {
      console.log('❌ Hospital not found for UID:', hospitalUid);
      return res.status(404).json({
        success: false,
        message: 'Hospital not found'
      });
    }

    // Find pharmacy by ARC ID
    console.log('🔍 Searching for pharmacy with ARC ID:', arcId);
    const pharmacy = await Pharmacy.findOne({ 
      $or: [
        { arcId: arcId },
        { healthQrId: arcId },
        { uid: arcId }
      ]
    });
    console.log('🔍 Pharmacy found:', pharmacy ? 'Yes' : 'No');
    if (pharmacy) {
      console.log('🔍 Pharmacy details:', {
        _id: pharmacy._id,
        pharmacyName: pharmacy.pharmacyName,
        arcId: pharmacy.arcId,
        uid: pharmacy.uid,
        isApproved: pharmacy.isApproved,
        approvalStatus: pharmacy.approvalStatus
      });
    }

    if (!pharmacy) {
      console.log('❌ Pharmacy not found with ARC ID:', arcId);
      return res.status(404).json({
        success: false,
        message: 'Pharmacy not found with the provided ARC ID'
      });
    }

    // Check if pharmacy is approved
    if (!pharmacy.isApproved || pharmacy.approvalStatus !== 'approved') {
      console.log('❌ Pharmacy not approved:', {
        isApproved: pharmacy.isApproved,
        approvalStatus: pharmacy.approvalStatus
      });
      return res.status(400).json({
        success: false,
        message: 'Pharmacy is not approved and cannot be associated'
      });
    }

    // Check if already associated
    console.log('🔍 Current affiliated hospitals:', pharmacy.affiliatedHospitals);
    console.log('🔍 Looking for hospital ID:', hospital._id.toString());
    
    const existingAssociation = pharmacy.affiliatedHospitals.find(
      (affiliation) => affiliation.hospitalId === hospital._id.toString()
    );
    console.log('🔍 Existing association found:', existingAssociation ? 'Yes' : 'No');

    if (existingAssociation) {
      console.log('❌ Pharmacy already associated with this hospital');
      return res.status(400).json({
        success: false,
        message: 'Pharmacy is already associated with this hospital'
      });
    }

    // Add hospital association to pharmacy
    const newAssociation = {
      hospitalId: hospital._id.toString(),
      hospitalName: hospital.hospitalName || hospital.fullName,
      role: 'Partner',
      startDate: new Date(),
      isActive: true
    };
    console.log('🔗 Adding new association:', newAssociation);
    
    pharmacy.affiliatedHospitals.push(newAssociation);
    console.log('🔗 Updated affiliated hospitals:', pharmacy.affiliatedHospitals);

    try {
      await pharmacy.save();
      console.log('✅ Pharmacy saved successfully');
    } catch (saveError) {
      console.error('❌ Error saving pharmacy:', saveError);
      return res.status(500).json({
        success: false,
        message: 'Failed to save pharmacy association',
        error: saveError.message
      });
    }

    console.log(`✅ Pharmacy ${pharmacy.pharmacyName} associated with hospital ${hospital.hospitalName}`);

    res.json({
      success: true,
      message: 'Pharmacy associated successfully',
      data: {
        pharmacyId: pharmacy._id,
        pharmacyName: pharmacy.pharmacyName,
        hospitalId: hospital._id,
        hospitalName: hospital.hospitalName
      }
    });
  } catch (error) {
    console.error('❌ Error associating pharmacy by ARC ID:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to associate pharmacy',
      error: error.message
    });
  }
};

// Remove pharmacy association
const removePharmacyAssociation = async (req, res) => {
  try {
    const { pharmacyUid } = req.params;
    const hospitalUid = req.user.uid; // From Firebase auth middleware

    console.log(`🗑️ Removing pharmacy association: ${pharmacyUid} from hospital: ${hospitalUid}`);

    // Get hospital MongoDB ID
    const Hospital = require('../models/Hospital');
    const hospital = await Hospital.findOne({ uid: hospitalUid });
    if (!hospital) {
      return res.status(404).json({
        success: false,
        message: 'Hospital not found'
      });
    }

    // Find pharmacy by UID
    const pharmacy = await Pharmacy.findOne({ uid: pharmacyUid });
    if (!pharmacy) {
      return res.status(404).json({
        success: false,
        message: 'Pharmacy not found'
      });
    }

    // Remove hospital association from pharmacy
    pharmacy.affiliatedHospitals = pharmacy.affiliatedHospitals.filter(
      (affiliation) => affiliation.hospitalId !== hospital._id.toString()
    );

    await pharmacy.save();

    console.log(`✅ Pharmacy ${pharmacy.pharmacyName} disassociated from hospital ${hospital.hospitalName}`);

    res.json({
      success: true,
      message: 'Pharmacy association removed successfully'
    });
  } catch (error) {
    console.error('❌ Error removing pharmacy association:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove pharmacy association',
      error: error.message
    });
  }
};

// Note: Database cleanup function removed - no longer needed with the permanent fix

// Medicine inventory management methods
const getPharmacyMedicines = async (req, res) => {
  try {
    const { pharmacyId } = req.params;
    const { category, search, sortBy } = req.query;

    console.log('💊 Fetching medicines for pharmacy ID/UID:', pharmacyId);

    // First, try to find pharmacy by UID to get MongoDB ID
    const Pharmacy = require('../models/Pharmacy');
    let pharmacy = await Pharmacy.findOne({ uid: pharmacyId });
    
    if (!pharmacy) {
      // If not found by UID, try by MongoDB ID
      pharmacy = await Pharmacy.findById(pharmacyId);
    }
    
    if (!pharmacy) {
      return res.status(404).json({
        success: false,
        error: 'Pharmacy not found',
        message: 'No pharmacy found with the provided identifier'
      });
    }

    const actualPharmacyId = pharmacy._id.toString();
    console.log('✅ Found pharmacy:', pharmacy.pharmacyName, 'MongoDB ID:', actualPharmacyId);

    // Build filter object using the actual MongoDB ID
    let filter = { pharmacyId: actualPharmacyId };
    
    if (category && category !== 'All') {
      filter.category = category;
    }
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { supplier: { $regex: search, $options: 'i' } },
        { batchNumber: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort object
    let sort = {};
    switch (sortBy) {
      case 'Name':
        sort = { name: 1 };
        break;
      case 'Stock':
        sort = { stock: -1 };
        break;
      case 'Expiry':
        sort = { expiryDate: 1 };
        break;
      case 'Price':
        sort = { unitPrice: 1 };
        break;
      default:
        sort = { name: 1 };
    }

    const Medicine = require('../models/Medicine');
    const medicines = await Medicine.find(filter).sort(sort);

    console.log(`✅ Found ${medicines.length} medicines for pharmacy ${actualPharmacyId}`);

    res.json({
      success: true,
      data: medicines,
      count: medicines.length
    });
  } catch (error) {
    console.error('Error fetching pharmacy medicines:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      message: 'Failed to fetch medicines'
    });
  }
};

const addPharmacyMedicine = async (req, res) => {
  try {
    const { pharmacyId } = req.params;
    const medicineData = req.body;

    console.log('💊 Adding medicine for pharmacy ID/UID:', pharmacyId);

    // First, try to find pharmacy by UID to get MongoDB ID
    const Pharmacy = require('../models/Pharmacy');
    let pharmacy = await Pharmacy.findOne({ uid: pharmacyId });
    
    if (!pharmacy) {
      // If not found by UID, try by MongoDB ID
      pharmacy = await Pharmacy.findById(pharmacyId);
    }
    
    if (!pharmacy) {
      return res.status(404).json({
        success: false,
        error: 'Pharmacy not found',
        message: 'No pharmacy found with the provided identifier'
      });
    }

    const actualPharmacyId = pharmacy._id.toString();
    console.log('✅ Found pharmacy:', pharmacy.pharmacyName, 'MongoDB ID:', actualPharmacyId);

    // Add pharmacy ID and set status
    medicineData.pharmacyId = actualPharmacyId;
    medicineData.lastUpdated = new Date().toISOString().split('T')[0];
    
    // Determine status based on stock
    if (medicineData.stock <= 0) {
      medicineData.status = 'Out of Stock';
    } else if (medicineData.stock <= medicineData.minStock) {
      medicineData.status = 'Low Stock';
    } else {
      medicineData.status = 'In Stock';
    }

    const Medicine = require('../models/Medicine');
    const medicine = new Medicine(medicineData);
    await medicine.save();

    console.log('✅ Medicine added successfully:', medicine._id);

    res.status(201).json({
      success: true,
      data: medicine,
      message: 'Medicine added successfully'
    });
  } catch (error) {
    console.error('Error adding pharmacy medicine:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      message: 'Failed to add medicine'
    });
  }
};

const updatePharmacyMedicine = async (req, res) => {
  try {
    const { pharmacyId, medicineId } = req.params;
    const updateData = req.body;

    console.log('💊 Updating medicine:', medicineId, 'for pharmacy ID/UID:', pharmacyId);

    // First, try to find pharmacy by UID to get MongoDB ID
    const Pharmacy = require('../models/Pharmacy');
    let pharmacy = await Pharmacy.findOne({ uid: pharmacyId });
    
    if (!pharmacy) {
      // If not found by UID, try by MongoDB ID
      pharmacy = await Pharmacy.findById(pharmacyId);
    }
    
    if (!pharmacy) {
      return res.status(404).json({
        success: false,
        error: 'Pharmacy not found',
        message: 'No pharmacy found with the provided identifier'
      });
    }

    const actualPharmacyId = pharmacy._id.toString();
    console.log('✅ Found pharmacy:', pharmacy.pharmacyName, 'MongoDB ID:', actualPharmacyId);

    // Add last updated timestamp
    updateData.lastUpdated = new Date().toISOString().split('T')[0];
    
    // Determine status based on stock
    if (updateData.stock <= 0) {
      updateData.status = 'Out of Stock';
    } else if (updateData.stock <= updateData.minStock) {
      updateData.status = 'Low Stock';
    } else {
      updateData.status = 'In Stock';
    }

    const Medicine = require('../models/Medicine');
    const medicine = await Medicine.findOneAndUpdate(
      { _id: medicineId, pharmacyId: actualPharmacyId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!medicine) {
      return res.status(404).json({
        success: false,
        error: 'Medicine not found',
        message: 'Medicine not found or does not belong to this pharmacy'
      });
    }

    console.log('✅ Medicine updated successfully:', medicineId);

    res.json({
      success: true,
      data: medicine,
      message: 'Medicine updated successfully'
    });
  } catch (error) {
    console.error('Error updating pharmacy medicine:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      message: 'Failed to update medicine'
    });
  }
};

const deletePharmacyMedicine = async (req, res) => {
  try {
    const { pharmacyId, medicineId } = req.params;

    console.log('💊 Deleting medicine:', medicineId, 'for pharmacy ID/UID:', pharmacyId);

    // First, try to find pharmacy by UID to get MongoDB ID
    const Pharmacy = require('../models/Pharmacy');
    let pharmacy = await Pharmacy.findOne({ uid: pharmacyId });
    
    if (!pharmacy) {
      // If not found by UID, try by MongoDB ID
      pharmacy = await Pharmacy.findById(pharmacyId);
    }
    
    if (!pharmacy) {
      return res.status(404).json({
        success: false,
        error: 'Pharmacy not found',
        message: 'No pharmacy found with the provided identifier'
      });
    }

    const actualPharmacyId = pharmacy._id.toString();
    console.log('✅ Found pharmacy:', pharmacy.pharmacyName, 'MongoDB ID:', actualPharmacyId);

    const Medicine = require('../models/Medicine');
    const medicine = await Medicine.findOneAndDelete({
      _id: medicineId,
      pharmacyId: actualPharmacyId
    });

    if (!medicine) {
      return res.status(404).json({
        success: false,
        error: 'Medicine not found',
        message: 'Medicine not found or does not belong to this pharmacy'
      });
    }

    console.log('✅ Medicine deleted successfully:', medicineId);

    res.json({
      success: true,
      message: 'Medicine deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting pharmacy medicine:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      message: 'Failed to delete medicine'
    });
  }
};

const getPharmacyMedicineAlerts = async (req, res) => {
  try {
    const { pharmacyId } = req.params;

    console.log('💊 Fetching medicine alerts for pharmacy ID/UID:', pharmacyId);

    // First, try to find pharmacy by UID to get MongoDB ID
    const Pharmacy = require('../models/Pharmacy');
    let pharmacy = await Pharmacy.findOne({ uid: pharmacyId });
    
    if (!pharmacy) {
      // If not found by UID, try by MongoDB ID
      pharmacy = await Pharmacy.findById(pharmacyId);
    }
    
    if (!pharmacy) {
      return res.status(404).json({
        success: false,
        error: 'Pharmacy not found',
        message: 'No pharmacy found with the provided identifier'
      });
    }

    const actualPharmacyId = pharmacy._id.toString();
    console.log('✅ Found pharmacy:', pharmacy.pharmacyName, 'MongoDB ID:', actualPharmacyId);

    const Medicine = require('../models/Medicine');
    const alerts = await Medicine.find({
      pharmacyId: actualPharmacyId,
      $or: [
        { status: 'Low Stock' },
        { status: 'Out of Stock' }
      ]
    }).sort({ stock: 1 });

    console.log(`✅ Found ${alerts.length} medicine alerts for pharmacy ${actualPharmacyId}`);

    res.json({
      success: true,
      data: alerts,
      count: alerts.length
    });
  } catch (error) {
    console.error('Error fetching pharmacy medicine alerts:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      message: 'Failed to fetch medicine alerts'
    });
  }
};

const getPharmacyMedicineOverview = async (req, res) => {
  try {
    const { pharmacyId } = req.params;

    console.log('💊 Fetching medicine overview for pharmacy ID/UID:', pharmacyId);

    // First, try to find pharmacy by UID to get MongoDB ID
    const Pharmacy = require('../models/Pharmacy');
    let pharmacy = await Pharmacy.findOne({ uid: pharmacyId });
    
    if (!pharmacy) {
      // If not found by UID, try by MongoDB ID
      pharmacy = await Pharmacy.findById(pharmacyId);
    }
    
    if (!pharmacy) {
      return res.status(404).json({
        success: false,
        error: 'Pharmacy not found',
        message: 'No pharmacy found with the provided identifier'
      });
    }

    const actualPharmacyId = pharmacy._id.toString();
    console.log('✅ Found pharmacy:', pharmacy.pharmacyName, 'MongoDB ID:', actualPharmacyId);

    const Medicine = require('../models/Medicine');
    const medicines = await Medicine.find({ pharmacyId: actualPharmacyId });

    // Calculate statistics
    const totalMedicines = medicines.length;
    const inStock = medicines.filter(m => m.status === 'In Stock').length;
    const lowStock = medicines.filter(m => m.status === 'Low Stock').length;
    const outOfStock = medicines.filter(m => m.status === 'Out of Stock').length;
    
    const totalValue = medicines.reduce((sum, medicine) => {
      return sum + (medicine.stock * medicine.unitPrice);
    }, 0);

    // Get recent activity (last 5 medicines updated)
    const recentActivity = medicines
      .sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated))
      .slice(0, 5)
      .map(medicine => ({
        id: medicine._id,
        name: medicine.name,
        action: medicine.status === 'Out of Stock' ? 'out of stock' : 
                medicine.status === 'Low Stock' ? 'low stock alert' : 'stock updated',
        details: medicine.status === 'Out of Stock' ? 'Order placed with supplier' :
                medicine.status === 'Low Stock' ? `Only ${medicine.stock} units remaining` :
                'Stock level normal',
        time: medicine.lastUpdated,
        type: medicine.status
      }));

    const overview = {
      totalMedicines,
      inStock,
      lowStock,
      outOfStock,
      totalValue: totalValue.toFixed(2),
      recentActivity
    };

    console.log('✅ Medicine overview calculated for pharmacy:', pharmacyId);

    res.json({
      success: true,
      data: overview
    });
  } catch (error) {
    console.error('Error fetching pharmacy medicine overview:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      message: 'Failed to fetch medicine overview'
    });
  }
};

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
  getPharmacyApprovalStatus,
  associatePharmacyByArcId,
  removePharmacyAssociation,
  // Medicine management methods
  getPharmacyMedicines,
  addPharmacyMedicine,
  updatePharmacyMedicine,
  deletePharmacyMedicine,
  getPharmacyMedicineAlerts,
  getPharmacyMedicineOverview
}; 