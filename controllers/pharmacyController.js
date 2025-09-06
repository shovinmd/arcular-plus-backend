const Pharmacy = require('../models/Pharmacy');
const { sendRegistrationConfirmation, sendApprovalEmail } = require('../services/emailService');

// Register a new pharmacy
const registerPharmacy = async (req, res) => {
  try {
    console.log('💊 Pharmacy registration request received');
    console.log('📋 Request body:', JSON.stringify(req.body, null, 2));
    console.log('🔍 Checking for registrationNumber field:', req.body.registrationNumber);
    console.log('🔍 LicenseNumber field:', req.body.licenseNumber);

    // Map documents from RegistrationService format to expected format
    const { documents } = req.body;
    if (documents) {
      if (documents.pharmacy_license) {
        req.body.licenseDocumentUrl = documents.pharmacy_license;
      }
      if (documents.drug_license) {
        req.body.drugLicenseUrl = documents.drug_license;
      }
      if (documents.premises_certificate) {
        req.body.premisesCertificateUrl = documents.premises_certificate;
      }
    }

    const userData = req.body;

    // Extract only the fields we need (same approach as doctor controller)
    const {
      uid,
      fullName,
      email,
      mobileNumber,
      alternateMobile,
      address,
      city,
      state,
      pincode,
      longitude,
      latitude,
      pharmacyName,
      licenseNumber,
      ownerName,
      pharmacistName,
      servicesProvided,
      homeDelivery,
      profileImageUrl,
      licenseDocumentUrl,
      pharmacyAffiliatedHospitals
    } = userData;

    console.log('🔍 Extracted fields - licenseNumber:', licenseNumber);
    console.log('🔍 Extracted fields - pharmacyName:', pharmacyName);
    console.log('🔍 Extracted fields - uid:', uid);
    console.log('🔍 All extracted fields:', Object.keys({
      uid, fullName, email, mobileNumber, alternateMobile, address, city, state, pincode,
      longitude, latitude, pharmacyName, licenseNumber, ownerName, pharmacistName,
      servicesProvided, homeDelivery, profileImageUrl,
      licenseDocumentUrl, pharmacyAffiliatedHospitals
    }));
    
    // Check for any unexpected fields in userData that might cause issues
    const unexpectedFields = Object.keys(userData).filter(key => 
      !['uid', 'fullName', 'email', 'mobileNumber', 'alternateMobile', 'address', 'city', 'state', 'pincode',
        'longitude', 'latitude', 'pharmacyName', 'licenseNumber', 'ownerName', 'pharmacistName',
        'servicesProvided', 'homeDelivery', 'profileImageUrl',
        'licenseDocumentUrl', 'pharmacyAffiliatedHospitals', 'documents', 'status', 'registrationDate',
        'drugLicenseUrl', 'premisesCertificateUrl'].includes(key)
    );
    
    if (unexpectedFields.length > 0) {
      console.log('⚠️ Found unexpected fields in userData:', unexpectedFields);
    }

    // Check if pharmacy already exists
    const existingPharmacy = await Pharmacy.findOne({ uid });
    if (existingPharmacy) {
      return res.status(400).json({ error: 'Pharmacy already registered' });
    }

    // Check for any existing records with registrationNumber: null that might cause conflicts
    const conflictingRecords = await Pharmacy.find({ registrationNumber: null });
    if (conflictingRecords.length > 0) {
      console.log(`⚠️ Found ${conflictingRecords.length} existing records with registrationNumber: null`);
      // Try to update all conflicting records to remove the registrationNumber field
      try {
        await Pharmacy.updateMany(
          { registrationNumber: null },
          { $unset: { registrationNumber: 1 } }
        );
        console.log('✅ Removed registrationNumber field from all conflicting records');
      } catch (updateError) {
        console.log('❌ Failed to update conflicting records:', updateError.message);
      }
    }

    // Create new pharmacy with explicit field mapping (no spread operator)
    const pharmacyData = {
      uid,
      fullName,
      email,
      mobileNumber,
      alternateMobile,
      address,
      city,
      state,
      pincode,
      longitude,
      latitude,
      pharmacyName,
      licenseNumber,
      ownerName,
      pharmacistName,
      servicesProvided: servicesProvided || [],
      homeDelivery: homeDelivery || false,
      profileImageUrl: profileImageUrl || '',
      licenseDocumentUrl: licenseDocumentUrl || '',
      affiliatedHospitals: pharmacyAffiliatedHospitals || [],
      status: 'active',
      isApproved: false,
      approvalStatus: 'pending',
      registrationDate: new Date(),
    };
    
    console.log('🏗️ Created pharmacy data object');
    console.log('🔍 Pharmacy data keys:', Object.keys(pharmacyData));
    console.log('🔍 Pharmacy licenseNumber:', pharmacyData.licenseNumber);
    console.log('🔍 Pharmacy uid:', pharmacyData.uid);
    
    // Create pharmacy instance
    const newPharmacy = new Pharmacy(pharmacyData);
    
    // Explicitly ensure registrationNumber is not in the document
    if (newPharmacy.registrationNumber !== undefined) {
      delete newPharmacy.registrationNumber;
      console.log('🧹 Removed registrationNumber from pharmacy instance');
    }
    
    console.log('🔍 Final pharmacy document keys:', Object.keys(newPharmacy.toObject()));

    let savedPharmacy;
    try {
      // Try using create method first (simpler approach)
      savedPharmacy = await Pharmacy.create(pharmacyData);
      console.log('✅ Pharmacy created successfully:', savedPharmacy.pharmacyName);
    } catch (saveError) {
      console.error('❌ Pharmacy create failed:', saveError.message);
      console.error('❌ Create error details:', saveError);
      
      // If it's still a duplicate key error, try insertOne as fallback
      if (saveError.code === 11000) {
        console.log('❌ Duplicate key error detected');
        console.log('❌ Error details:', saveError.keyPattern, saveError.keyValue);
        
        // Try insertOne as fallback
        try {
          console.log('🔄 Trying insertOne fallback method...');
          const result = await Pharmacy.collection.insertOne(pharmacyData);
          console.log('✅ Pharmacy inserted successfully with ID:', result.insertedId);
          
          // Fetch the saved pharmacy to return it
          savedPharmacy = await Pharmacy.findById(result.insertedId);
          console.log('✅ Pharmacy fetched successfully:', savedPharmacy.pharmacyName);
        } catch (insertError) {
          console.error('❌ InsertOne fallback also failed:', insertError.message);
          throw saveError; // Re-throw original error
        }
      } else {
        throw saveError; // Re-throw to be handled by the outer catch
      }
    }

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
    
    const pharmacy = await Pharmacy.findById(pharmacyId);
    if (!pharmacy) {
      return res.status(404).json({
        success: false,
        error: 'Pharmacy not found'
      });
    }

    // Update approval status
    pharmacy.isApproved = true;
    pharmacy.approvalStatus = 'approved';
    pharmacy.approvedAt = new Date();
    pharmacy.approvedBy = approvedBy || 'staff';
    pharmacy.approvalNotes = notes || 'Approved by staff';
    
    await pharmacy.save();

    // Send approval email
    try {
      await sendApprovalEmail(pharmacy.email, pharmacy.pharmacyName, 'pharmacy', true, notes);
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
    console.error('Error approving pharmacy by staff:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to approve pharmacy'
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

module.exports = {
  registerPharmacy,
  getAllPharmacies,
  getPharmacyById,
  getPharmacyByUID,
  getPharmacyByEmail,
  updatePharmacy,
  deletePharmacy,
  getPharmaciesByCity,
  getPharmaciesByDrug,
  searchPharmacies,
  getPendingApprovals,
  approvePharmacy,
  rejectPharmacy,
  getPendingApprovalsForStaff,
  approvePharmacyByStaff,
  rejectPharmacyByStaff
}; 