const { admin } = require('../firebase');
const path = require('path');
const { sendApprovalEmail, sendDocumentReviewNotification } = require('../services/emailService');

// Staff web interface controller
class StaffWebController {
  
  // Get staff login page
  getLoginPage(req, res) {
    res.sendFile(path.join(__dirname, '../../Arcular Pluse Webpage/ARCstaff/login.html'));
  }

  // Staff login - Firebase authentication is handled on the frontend
  async login(req, res) {
    try {
      // This endpoint is not needed since Firebase handles authentication on the frontend
      // The frontend will send Firebase ID tokens to protected API endpoints
      res.status(501).json({ success: false, message: 'Use Firebase authentication on frontend' });
    } catch (error) {
      console.error('Staff login error:', error);
      res.status(500).json({ success: false, message: 'Login failed' });
    }
  }

  // Get staff dashboard
  async getDashboard(req, res) {
    try {
      // Authentication is handled by middleware for API calls
      // For page serving, we'll allow access and let the frontend handle auth
      res.sendFile(path.join(__dirname, '../../Arcular Pluse Webpage/ARCstaff/arcstaff-dashboard.html'));
    } catch (error) {
      console.error('Dashboard error:', error);
      res.status(500).json({ success: false, message: 'Failed to load dashboard' });
    }
  }

  // Verify staff access (for login)
  async verifyStaff(req, res) {
    try {
      console.log('🔍 Staff verification request:', {
        email: req.body.email,
        uid: req.body.uid,
        firebaseUid: req.firebaseUid
      });

      // Check if staff exists in MongoDB
      const ArcStaff = require('../models/ArcStaff');
      const staff = await ArcStaff.findOne({ 
        email: req.body.email,
        uid: req.body.uid,
        userType: { $in: ['arc_staff', 'super_admin'] },
        isApproved: true
      });

      if (!staff) {
        console.log('❌ Staff not found or not approved:', req.body.email);
        return res.status(404).json({ 
          success: false, 
          message: 'Staff account not found or not approved. Please contact administrator.' 
        });
      }

      console.log('✅ Staff verified successfully:', {
        email: staff.email,
        userType: staff.userType,
        name: staff.fullName
      });

      res.json({
        success: true,
        message: 'Staff access verified',
        data: {
          email: staff.email,
          uid: staff.firebaseUid,
          userType: staff.userType,
          fullName: staff.fullName,
          isApproved: staff.isApproved
        }
      });

    } catch (error) {
      console.error('❌ Staff verification error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to verify staff access' 
      });
    }
  }

  // Test endpoint to check staff accounts (remove in production)
  async testStaffAccounts(req, res) {
    try {
      const ArcStaff = require('../models/ArcStaff');
      const allStaff = await ArcStaff.find({}).select('email uid userType fullName isApproved');
      
      console.log('📊 All staff accounts:', allStaff);
      
      res.json({
        success: true,
        message: 'Staff accounts found',
        count: allStaff.length,
        data: allStaff
      });
    } catch (error) {
      console.error('❌ Test staff accounts error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to get staff accounts' 
      });
    }
  }

  // Create test staff account (remove in production)
  async createTestStaffAccount(req, res) {
    try {
      const { email, uid, fullName } = req.body;
      console.log('🔧 Creating test staff account:', { email, uid, fullName });

      const ArcStaff = require('../models/ArcStaff');
      
      // Check if staff already exists
      const existingStaff = await ArcStaff.findOne({ email });
      if (existingStaff) {
        return res.json({
          success: true,
          message: 'Staff account already exists',
          data: existingStaff
        });
      }

      // Create new staff account
      const newStaff = new ArcStaff({
        uid: uid,
        email: email,
        fullName: fullName || email.split('@')[0],
        userType: 'arc_staff',
        role: 'arc_staff',
        isApproved: true,
        approvalStatus: 'approved',
        status: 'active',
        profileComplete: true,
        canApproveHospitals: true,
        canApproveDoctors: true,
        canApproveLabs: true,
        canApprovePharmacies: true,
        canApproveNurses: true,
        canViewReports: true,
        canManageUsers: false
      });

      await newStaff.save();
      console.log('✅ Test staff account created:', newStaff.email);

      res.json({
        success: true,
        message: 'Test staff account created successfully',
        data: newStaff
      });

    } catch (error) {
      console.error('❌ Create test staff account error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to create test staff account' 
      });
    }
  }

  // Get staff profile (for dashboard)
  async getStaffProfile(req, res) {
    try {
      const { uid } = req.params;
      console.log('🔍 Getting staff profile for UID:', uid);

      const ArcStaff = require('../models/ArcStaff');
      const staff = await ArcStaff.findOne({ 
        uid: uid,
        isApproved: true
      }).select('-__v');

      if (!staff) {
        console.log('❌ Staff profile not found for UID:', uid);
        return res.status(404).json({ 
          success: false, 
          message: 'Staff profile not found' 
        });
      }

      console.log('✅ Staff profile found:', {
        email: staff.email,
        userType: staff.userType,
        name: staff.fullName
      });

      res.json({
        success: true,
        message: 'Staff profile loaded',
        data: {
          uid: staff.uid,
          email: staff.email,
          fullName: staff.fullName,
          userType: staff.userType,
          role: staff.role,
          isApproved: staff.isApproved,
          department: staff.department,
          designation: staff.designation,
          permissions: {
            canApproveHospitals: staff.canApproveHospitals,
            canApproveDoctors: staff.canApproveDoctors,
            canApproveLabs: staff.canApproveLabs,
            canApprovePharmacies: staff.canApprovePharmacies,
            canApproveNurses: staff.canApproveNurses,
            canViewReports: staff.canViewReports,
            canManageUsers: staff.canManageUsers
          }
        }
      });

    } catch (error) {
      console.error('❌ Get staff profile error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to get staff profile' 
      });
    }
  }

  // Get pending approvals
  async getPendingApprovals(req, res) {
    try {
      console.log('🔍 Fetching pending approvals from all service provider models...');
      
      // Import all role models
      const Hospital = require('../models/Hospital');
      const Doctor = require('../models/Doctor');
      const Nurse = require('../models/Nurse');
      const Pharmacy = require('../models/Pharmacy');
      const Lab = require('../models/Lab');

      // Fetch pending users from each model
      const [pendingHospitals, pendingDoctors, pendingNurses, pendingPharmacies, pendingLabs] = await Promise.all([
        Hospital.find({ approvalStatus: 'pending' }).select('-__v'),
        Doctor.find({ approvalStatus: 'pending' }).select('-__v'),
        Nurse.find({ approvalStatus: 'pending' }).select('-__v'),
        Pharmacy.find({ approvalStatus: 'pending' }).select('-__v'),
        Lab.find({ approvalStatus: 'pending' }).select('-__v')
      ]);

      // Add userType to each user and combine all results
      const pendingUsers = [
        ...pendingHospitals.map(h => ({ ...h.toObject(), userType: 'hospital' })),
        ...pendingDoctors.map(d => ({ ...d.toObject(), userType: 'doctor' })),
        ...pendingNurses.map(n => ({ ...n.toObject(), userType: 'nurse' })),
        ...pendingPharmacies.map(p => ({ ...p.toObject(), userType: 'pharmacy' })),
        ...pendingLabs.map(l => ({ ...l.toObject(), userType: 'lab' }))
      ];

      console.log(`✅ Found ${pendingUsers.length} pending users:`, {
        hospitals: pendingHospitals.length,
        doctors: pendingDoctors.length,
        nurses: pendingNurses.length,
        pharmacies: pendingPharmacies.length,
        labs: pendingLabs.length
      });

      res.json({ success: true, data: pendingUsers });
    } catch (error) {
      console.error('❌ Get pending approvals error:', error);
      res.status(500).json({ success: false, message: 'Failed to get pending approvals' });
    }
  }

  // Get pending approvals by user type
  async getPendingByType(req, res) {
    try {
      console.log('🔍 Fetching pending approvals for user type:', req.params.userType);
      
      const { userType } = req.params;
      let pendingUsers = [];

      // Import and query the appropriate model based on user type
      switch (userType.toLowerCase()) {
        case 'hospital':
          const Hospital = require('../models/Hospital');
          pendingUsers = await Hospital.find({ approvalStatus: 'pending' }).select('-__v');
          break;
        case 'doctor':
          const Doctor = require('../models/Doctor');
          pendingUsers = await Doctor.find({ approvalStatus: 'pending' }).select('-__v');
          break;
        case 'nurse':
          const Nurse = require('../models/Nurse');
          pendingUsers = await Nurse.find({ approvalStatus: 'pending' }).select('-__v');
          break;
        case 'pharmacy':
          const Pharmacy = require('../models/Pharmacy');
          pendingUsers = await Pharmacy.find({ approvalStatus: 'pending' }).select('-__v');
          break;
        case 'lab':
          const Lab = require('../models/Lab');
          pendingUsers = await Lab.find({ approvalStatus: 'pending' }).select('-__v');
          break;
        default:
          return res.status(400).json({ 
            success: false, 
            message: 'Invalid user type. Must be one of: hospital, doctor, nurse, pharmacy, lab' 
          });
      }

      // Add userType to each user
      const usersWithType = pendingUsers.map(user => ({ 
        ...user.toObject(), 
        userType: userType.toLowerCase() 
      }));

      console.log(`✅ Found ${usersWithType.length} pending ${userType}s`);

      res.json({ success: true, data: usersWithType });
    } catch (error) {
      console.error('❌ Get pending by type error:', error);
      res.status(500).json({ success: false, message: 'Failed to get pending approvals' });
    }
  }

  // Note: Old approveUser, rejectUser, and requestDocuments methods removed
  // These are replaced by the working approveStakeholder and rejectStakeholder methods
  // that properly handle all service provider models

  // Get users by type
  async getUsersByType(req, res) {
    try {
      console.log('🔍 Fetching users by type:', req.params.userType);
      
      const { userType } = req.params;
      let users = [];

      // Import and query the appropriate model based on user type
      switch (userType.toLowerCase()) {
        case 'hospital':
          const Hospital = require('../models/Hospital');
          users = await Hospital.find().select('-__v');
          break;
        case 'doctor':
          const Doctor = require('../models/Doctor');
          users = await Doctor.find().select('-__v');
          break;
        case 'nurse':
          const Nurse = require('../models/Nurse');
          users = await Nurse.find().select('-__v');
          break;
        case 'pharmacy':
          const Pharmacy = require('../models/Pharmacy');
          users = await Pharmacy.find().select('-__v');
          break;
        case 'lab':
          const Lab = require('../models/Lab');
          users = await Lab.find().select('-__v');
          break;
        default:
          return res.status(400).json({ 
            success: false, 
            message: 'Invalid user type. Must be one of: hospital, doctor, nurse, pharmacy, lab' 
          });
      }

      // Add userType to each user
      const usersWithType = users.map(user => ({ 
        ...user.toObject(), 
        userType: userType.toLowerCase() 
      }));

      console.log(`✅ Found ${usersWithType.length} ${userType}s`);

      res.json({ success: true, data: usersWithType });
    } catch (error) {
      console.error('❌ Get users by type error:', error);
      res.status(500).json({ success: false, message: 'Failed to get users' });
    }
  }

  // Get user details
  async getUserDetails(req, res) {
    try {
      console.log('🔍 Fetching user details for:', req.params.userType, 'ID:', req.params.userId);
      
      const { userType, userId } = req.params;
      let user = null;

      // Import and query the appropriate model based on user type
      switch (userType.toLowerCase()) {
        case 'hospital':
          const Hospital = require('../models/Hospital');
          user = await Hospital.findById(userId).select('-__v');
          break;
        case 'doctor':
          const Doctor = require('../models/Doctor');
          user = await Doctor.findById(userId).select('-__v');
          break;
        case 'nurse':
          const Nurse = require('../models/Nurse');
          user = await Nurse.findById(userId).select('-__v');
          break;
        case 'pharmacy':
          const Pharmacy = require('../models/Pharmacy');
          user = await Pharmacy.findById(userId).select('-__v');
          break;
        case 'lab':
          const Lab = require('../models/Lab');
          user = await Lab.findById(userId).select('-__v');
          break;
        default:
          return res.status(400).json({ 
            success: false, 
            message: 'Invalid user type. Must be one of: hospital, doctor, nurse, pharmacy, lab' 
          });
      }

      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // Add userType to user data
      const userData = { ...user.toObject(), userType: userType.toLowerCase() };

      console.log(`✅ Found ${userType} with ID: ${userId}`);

      res.json({ success: true, data: userData });
    } catch (error) {
      console.error('❌ Get user details error:', error);
      res.status(500).json({ success: false, message: 'Failed to get user details' });
    }
  }

  // Get user documents with enhanced details
  async getUserDocuments(req, res) {
    try {
      console.log('🔍 Fetching user documents for:', req.params.userType, 'ID:', req.params.userId);
      
      const { userType, userId } = req.params;
      let user = null;

      // Import and query the appropriate model based on user type
      switch (userType.toLowerCase()) {
        case 'hospital':
          const Hospital = require('../models/Hospital');
          user = await Hospital.findById(userId);
          break;
        case 'doctor':
          const Doctor = require('../models/Doctor');
          user = await Doctor.findById(userId);
          break;
        case 'nurse':
          const Nurse = require('../models/Nurse');
          user = await Nurse.findById(userId);
          break;
        case 'pharmacy':
          const Pharmacy = require('../models/Pharmacy');
          user = await Pharmacy.findById(userId);
          break;
        case 'lab':
          const Lab = require('../models/Lab');
          user = await Lab.findById(userId);
          break;
        default:
          return res.status(400).json({ 
            success: false, 
            message: 'Invalid user type. Must be one of: hospital, doctor, nurse, pharmacy, lab' 
          });
      }

      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // Extract comprehensive document URLs and details based on user type
      let documents = {};
      let additionalInfo = {};
      
      switch (userType.toLowerCase()) {
        case 'hospital':
          documents = {
            license: user.licenseDocumentUrl,
            registration: user.registrationCertificateUrl,
            businessLicense: user.businessLicenseUrl,
            taxRegistration: user.taxRegistrationUrl,
            insuranceCertificate: user.insuranceCertificateUrl
          };
          additionalInfo = {
            hospitalName: user.hospitalName,
            registrationNumber: user.registrationNumber,
            contactNumber: user.contactNumber,
            address: user.address,
            specialization: user.specialization,
            bedCount: user.bedCount,
            establishedYear: user.establishedYear
          };
          break;
        case 'doctor':
          documents = {
            license: user.licenseDocumentUrl,
            medicalRegistration: user.medicalRegistrationNumber,
            degreeCertificate: user.degreeCertificateUrl,
            specializationCertificate: user.specializationCertificateUrl,
            experienceCertificate: user.experienceCertificateUrl
          };
          additionalInfo = {
            fullName: user.fullName,
            medicalRegistrationNumber: user.medicalRegistrationNumber,
            specialization: user.specialization,
            experience: user.experience,
            contactNumber: user.contactNumber,
            address: user.address,
            qualifications: user.qualifications
          };
          break;
        case 'nurse':
          documents = {
            license: user.licenseDocumentUrl,
            nursingRegistration: user.nursingRegistrationNumber,
            degreeCertificate: user.degreeCertificateUrl,
            experienceCertificate: user.experienceCertificateUrl
          };
          additionalInfo = {
            fullName: user.fullName,
            nursingRegistrationNumber: user.nursingRegistrationNumber,
            department: user.department,
            experience: user.experience,
            contactNumber: user.contactNumber,
            address: user.address,
            qualifications: user.qualifications
          };
          break;
        case 'pharmacy':
          documents = {
            license: user.licenseDocumentUrl,
            drugLicense: user.drugLicenseUrl,
            premisesCertificate: user.premisesCertificateUrl,
            taxRegistration: user.taxRegistrationUrl,
            insuranceCertificate: user.insuranceCertificateUrl
          };
          additionalInfo = {
            pharmacyName: user.pharmacyName,
            drugLicenseNumber: user.drugLicenseNumber,
            contactNumber: user.contactNumber,
            address: user.address,
            ownerName: user.ownerName,
            establishedYear: user.establishedYear
          };
          break;
        case 'lab':
          documents = {
            license: user.licenseUrl,
            accreditationCertificate: user.accreditationCertificateUrl,
            equipmentCertificate: user.equipmentCertificateUrl,
            qualityCertificate: user.qualityCertificateUrl,
            taxRegistration: user.taxRegistrationUrl
          };
          additionalInfo = {
            labName: user.labName,
            licenseNumber: user.licenseNumber,
            contactNumber: user.contactNumber,
            address: user.address,
            ownerName: user.ownerName,
            establishedYear: user.establishedYear,
            specializations: user.specializations
          };
          break;
      }

      // Filter out undefined/null documents
      const filteredDocuments = Object.fromEntries(
        Object.entries(documents).filter(([key, value]) => value != null)
      );

      res.json({ 
        success: true, 
        data: {
          documents: filteredDocuments,
          additionalInfo: additionalInfo,
          userType: userType.toLowerCase(),
          userId: userId,
          approvalStatus: user.approvalStatus,
          isApproved: user.isApproved
        }
      });
    } catch (error) {
      console.error('Get user documents error:', error);
      res.status(500).json({ success: false, message: 'Failed to get user documents' });
    }
  }

  // Verify documents
  async verifyDocuments(req, res) {
    try {
      console.log('🔍 Verifying documents for:', req.params.userType, 'ID:', req.params.userId);
      
      const { userType, userId } = req.params;
      const { verificationStatus, notes } = req.body;
      let user = null;

      // Import and query the appropriate model based on user type
      switch (userType.toLowerCase()) {
        case 'hospital':
          const Hospital = require('../models/Hospital');
          user = await Hospital.findById(userId);
          break;
        case 'doctor':
          const Doctor = require('../models/Doctor');
          user = await Doctor.findById(userId);
          break;
        case 'nurse':
          const Nurse = require('../models/Nurse');
          user = await Nurse.findById(userId);
          break;
        case 'pharmacy':
          const Pharmacy = require('../models/Pharmacy');
          user = await Pharmacy.findById(userId);
          break;
        case 'lab':
          const Lab = require('../models/Lab');
          user = await Lab.findById(userId);
          break;
        default:
          return res.status(400).json({ 
            success: false, 
            message: 'Invalid user type. Must be one of: hospital, doctor, nurse, pharmacy, lab' 
          });
      }

      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // Update document verification status
      user.documentVerificationStatus = verificationStatus;
      user.documentVerificationNotes = notes;
      user.documentVerifiedBy = req.firebaseUid;
      user.documentVerifiedAt = new Date();
      user.updatedAt = new Date();

      await user.save();

      console.log(`✅ Documents verified for ${userType} with ID: ${userId}`);

      res.json({ 
        success: true, 
        message: 'Documents verified successfully',
        data: user
      });
    } catch (error) {
      console.error('❌ Verify documents error:', error);
      res.status(500).json({ success: false, message: 'Failed to verify documents' });
    }
  }

  // Get pending stakeholders (matching frontend expectations)
  async getPendingStakeholders(req, res) {
    try {
      // Authentication is handled by middleware
      
      // Import all role models
      const Hospital = require('../models/Hospital');
      const Doctor = require('../models/Doctor');
      const Nurse = require('../models/Nurse');
      const Pharmacy = require('../models/Pharmacy');
      const Lab = require('../models/Lab');

      // Get pending users from each role model
      const [pendingHospitals, pendingDoctors, pendingNurses, pendingPharmacies, pendingLabs] = await Promise.all([
        Hospital.find({ approvalStatus: 'pending' }),
        Doctor.find({ approvalStatus: 'pending' }),
        Nurse.find({ approvalStatus: 'pending' }),
        Pharmacy.find({ approvalStatus: 'pending' }),
        Lab.find({ approvalStatus: 'pending' })
      ]);

      // Transform and combine all pending users
      const allPendingUsers = [
        ...pendingHospitals.map(h => ({ ...h.toObject(), type: 'hospital' })),
        ...pendingDoctors.map(d => ({ ...d.toObject(), type: 'doctor' })),
        ...pendingNurses.map(n => ({ ...n.toObject(), type: 'nurse' })),
        ...pendingPharmacies.map(p => ({ ...p.toObject(), type: 'pharmacy' })),
        ...pendingLabs.map(l => ({ ...l.toObject(), type: 'lab' }))
      ];

      // Transform data to match frontend expectations
      const transformedStakeholders = allPendingUsers.map(user => ({
        _id: user._id,
        name: user.fullName || user.hospitalName || user.pharmacyName || user.labName,
        fullName: user.fullName || user.hospitalName || user.pharmacyName || user.labName,
        email: user.email,
        type: user.type,
        status: user.status || 'pending',
        documents: this.extractDocuments(user),
        submittedAt: user.registrationDate || user.createdAt
      }));

      res.json(transformedStakeholders);
    } catch (error) {
      console.error('Get pending stakeholders error:', error);
      res.status(500).json({ success: false, message: 'Failed to get pending stakeholders' });
    }
  }

  // Approve stakeholder (matching frontend expectations)
  async approveStakeholder(req, res) {
    try {
      console.log('🔍 Approving stakeholder with ID:', req.params.id);
      
      // Authentication is handled by middleware
      const { id } = req.params;

      // Import all role models
      const Hospital = require('../models/Hospital');
      const Doctor = require('../models/Doctor');
      const Nurse = require('../models/Nurse');
      const Pharmacy = require('../models/Pharmacy');
      const Lab = require('../models/Lab');

      // Try to find the user in each model
      let user = await Hospital.findById(id);
      let userType = 'hospital';
      
      if (!user) {
        user = await Doctor.findById(id);
        userType = 'doctor';
      }
      if (!user) {
        user = await Nurse.findById(id);
        userType = 'nurse';
      }
      if (!user) {
        user = await Pharmacy.findById(id);
        userType = 'pharmacy';
      }
      if (!user) {
        user = await Lab.findById(id);
        userType = 'lab';
      }

      if (!user) {
        console.log('❌ User not found in any role model');
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      console.log('✅ Found user in model:', userType, 'with email:', user.email);

      // Update user status
      user.isApproved = true;
      user.approvalStatus = 'approved';
      user.status = 'active';
      user.approvedBy = req.firebaseUid;
      user.approvedAt = new Date();

      await user.save();
      console.log('✅ User status updated successfully');

      // Send approval email
      try {
        const userName = user.fullName || user.hospitalName || user.pharmacyName || user.labName;
        console.log('📧 Sending approval email to:', user.email, 'for user:', userName);
        
        await sendApprovalEmail(user.email, userName, userType, true, '');
        console.log('✅ Approval email sent successfully');
      } catch (emailError) {
        console.error('❌ Error sending approval email:', emailError);
        // Don't fail the approval if email fails
      }

      // Prepare comprehensive response data
      const responseData = {
        id: user._id,
        email: user.email,
        userType: userType,
        approvalStatus: user.approvalStatus,
        approvedAt: user.approvedAt,
        approvedBy: user.approvedBy,
        // Include basic info for dashboard access
        basicInfo: {
          name: user.fullName || user.hospitalName || user.pharmacyName || user.labName,
          contactNumber: user.contactNumber,
          address: user.address
        },
        // Dashboard access instructions
        dashboardAccess: {
          message: `${userType.charAt(0).toUpperCase() + userType.slice(1)} can now login to their dashboard`,
          loginUrl: `/auth/login`, // Frontend will handle the routing
          dashboardUrl: `/${userType}/dashboard` // Frontend will handle the routing
        }
      };

      res.json({ 
        success: true, 
        message: 'Stakeholder approved successfully',
        data: responseData
      });
    } catch (error) {
      console.error('❌ Approve stakeholder error:', error);
      res.status(500).json({ success: false, message: 'Failed to approve stakeholder' });
    }
  }

  // Reject stakeholder (matching frontend expectations)
  async rejectStakeholder(req, res) {
    try {
      console.log('🔍 Rejecting stakeholder with ID:', req.params.id);
      
      // Authentication is handled by middleware
      const { id } = req.params;
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({ success: false, message: 'Rejection reason is required' });
      }

      // Import all role models
      const Hospital = require('../models/Hospital');
      const Doctor = require('../models/Doctor');
      const Nurse = require('../models/Nurse');
      const Pharmacy = require('../models/Pharmacy');
      const Lab = require('../models/Lab');

      // Try to find the user in each model
      let user = await Hospital.findById(id);
      let userType = 'hospital';
      
      if (!user) {
        user = await Doctor.findById(id);
        userType = 'doctor';
      }
      if (!user) {
        user = await Nurse.findById(id);
        userType = 'nurse';
      }
      if (!user) {
        user = await Pharmacy.findById(id);
        userType = 'pharmacy';
      }
      if (!user) {
        user = await Lab.findById(id);
        userType = 'lab';
      }

      if (!user) {
        console.log('❌ User not found in any role model');
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      console.log('✅ Found user in model:', userType, 'with email:', user.email);

      // Update user status
      user.isApproved = false;
      user.approvalStatus = 'rejected';
      user.status = 'rejected';
      user.rejectedBy = req.firebaseUid;
      user.rejectedAt = new Date();
      user.rejectionReason = reason;

      await user.save();
      console.log('✅ User status updated successfully');

      // Send rejection email
      try {
        const userName = user.fullName || user.hospitalName || user.pharmacyName || user.labName;
        console.log('📧 Sending rejection email to:', user.email, 'for user:', userName);
        
        await sendApprovalEmail(user.email, userName, userType, false, reason);
        console.log('✅ Rejection email sent successfully');
      } catch (emailError) {
        console.error('❌ Error sending rejection email:', emailError);
        // Don't fail the rejection if email fails
      }

      res.json({ 
        success: true, 
        message: 'Stakeholder rejected successfully',
        data: {
          id: user._id,
          email: user.email,
          userType: userType,
          approvalStatus: user.approvalStatus,
          rejectedAt: user.rejectedAt,
          rejectedBy: user.rejectedBy,
          rejectionReason: user.rejectionReason
        }
      });
    } catch (error) {
      console.error('❌ Reject stakeholder error:', error);
      res.status(500).json({ success: false, message: 'Failed to reject stakeholder' });
    }
  }

  // Request documents from stakeholder
  async requestDocuments(req, res) {
    try {
      console.log('🔍 Requesting documents from stakeholder with ID:', req.params.id);
      
      // Authentication is handled by middleware
      const { id } = req.params;
      const { requiredDocuments, deadline, notes } = req.body;

      if (!requiredDocuments || !Array.isArray(requiredDocuments) || requiredDocuments.length === 0) {
        return res.status(400).json({ success: false, message: 'Required documents list is required' });
      }

      // Import all role models
      const Hospital = require('../models/Hospital');
      const Doctor = require('../models/Doctor');
      const Nurse = require('../models/Nurse');
      const Pharmacy = require('../models/Pharmacy');
      const Lab = require('../models/Lab');

      // Try to find the user in each model
      let user = await Hospital.findById(id);
      let userType = 'hospital';
      
      if (!user) {
        user = await Doctor.findById(id);
        userType = 'doctor';
      }
      if (!user) {
        user = await Nurse.findById(id);
        userType = 'nurse';
      }
      if (!user) {
        user = await Pharmacy.findById(id);
        userType = 'pharmacy';
      }
      if (!user) {
        user = await Lab.findById(id);
        userType = 'lab';
      }

      if (!user) {
        console.log('❌ User not found in any role model');
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      console.log('✅ Found user in model:', userType, 'with email:', user.email);

      // Store document request
      user.documentRequests = user.documentRequests || [];
      user.documentRequests.push({
        requestedBy: req.firebaseUid,
        requestedAt: new Date(),
        requiredDocuments: requiredDocuments,
        deadline: deadline ? new Date(deadline) : null,
        notes: notes || '',
        status: 'pending'
      });

      await user.save();
      console.log('✅ Document request stored successfully');

      // Send document request notification email
      try {
        const userName = user.fullName || user.hospitalName || user.pharmacyName || user.labName;
        console.log('📧 Sending document request notification to:', user.email, 'for user:', userName);
        
        await sendDocumentReviewNotification(user.email, userName, userType, requiredDocuments, deadline, notes);
        console.log('✅ Document request notification sent successfully');
      } catch (emailError) {
        console.error('❌ Error sending document request notification:', emailError);
        // Don't fail the request if email fails
      }

      res.json({ 
        success: true, 
        message: 'Document request sent successfully',
        data: {
          id: user._id,
          email: user.email,
          userType: userType,
          documentRequest: user.documentRequests[user.documentRequests.length - 1]
        }
      });
    } catch (error) {
      console.error('❌ Request documents error:', error);
      res.status(500).json({ success: false, message: 'Failed to request documents' });
    }
  }

  // Helper method to extract documents for frontend
  extractDocuments(user) {
    const documents = [];
    
    // Determine user type from the user object
    let userType = user.type || user.userType;
    
    // If we can't determine from type, try to infer from the model
    if (!userType) {
      if (user.hospitalName) userType = 'hospital';
      else if (user.medicalRegistrationNumber) userType = 'doctor';
      else if (user.nursingRegistrationNumber) userType = 'nurse';
      else if (user.pharmacyName) userType = 'pharmacy';
      else if (user.labName) userType = 'lab';
    }
    
    switch (userType) {
      case 'hospital':
        if (user.licenseDocumentUrl) documents.push({ name: 'License', url: user.licenseDocumentUrl });
        if (user.registrationDocumentUrl) documents.push({ name: 'Registration', url: user.registrationDocumentUrl });
        if (user.businessLicenseUrl) documents.push({ name: 'Business License', url: user.businessLicenseUrl });
        if (user.taxRegistrationUrl) documents.push({ name: 'Tax Registration', url: user.taxRegistrationUrl });
        if (user.insuranceCertificateUrl) documents.push({ name: 'Insurance Certificate', url: user.insuranceCertificateUrl });
        break;
      case 'doctor':
        if (user.licenseDocumentUrl) documents.push({ name: 'Medical License', url: user.licenseDocumentUrl });
        if (user.medicalRegistrationDocumentUrl) documents.push({ name: 'Medical Registration', url: user.medicalRegistrationDocumentUrl });
        if (user.degreeCertificateUrl) documents.push({ name: 'Degree Certificate', url: user.degreeCertificateUrl });
        if (user.specializationCertificateUrl) documents.push({ name: 'Specialization Certificate', url: user.specializationCertificateUrl });
        if (user.experienceCertificateUrl) documents.push({ name: 'Experience Certificate', url: user.experienceCertificateUrl });
        break;
      case 'nurse':
        if (user.licenseDocumentUrl) documents.push({ name: 'Nursing License', url: user.licenseDocumentUrl });
        if (user.nursingRegistrationDocumentUrl) documents.push({ name: 'Nursing Registration', url: user.nursingRegistrationDocumentUrl });
        if (user.degreeCertificateUrl) documents.push({ name: 'Degree Certificate', url: user.degreeCertificateUrl });
        if (user.experienceCertificateUrl) documents.push({ name: 'Experience Certificate', url: user.experienceCertificateUrl });
        break;
      case 'pharmacy':
        if (user.licenseDocumentUrl) documents.push({ name: 'Pharmacy License', url: user.licenseDocumentUrl });
        if (user.drugLicenseUrl) documents.push({ name: 'Drug License', url: user.drugLicenseUrl });
        if (user.premisesCertificateUrl) documents.push({ name: 'Premises Certificate', url: user.premisesCertificateUrl });
        if (user.taxRegistrationUrl) documents.push({ name: 'Tax Registration', url: user.taxRegistrationUrl });
        if (user.insuranceCertificateUrl) documents.push({ name: 'Insurance Certificate', url: user.insuranceCertificateUrl });
        break;
      case 'lab':
        if (user.licenseUrl) documents.push({ name: 'Lab License', url: user.licenseUrl });
        if (user.accreditationCertificateUrl) documents.push({ name: 'Accreditation Certificate', url: user.accreditationCertificateUrl });
        if (user.equipmentCertificateUrl) documents.push({ name: 'Equipment Certificate', url: user.equipmentCertificateUrl });
        if (user.qualityCertificateUrl) documents.push({ name: 'Quality Certificate', url: user.qualityCertificateUrl });
        if (user.taxRegistrationUrl) documents.push({ name: 'Tax Registration', url: user.taxRegistrationUrl });
        break;
    }
    
    return documents;
  }

  // Get comprehensive service provider details for staff review
  async getServiceProviderDetails(req, res) {
    try {
      console.log('🔍 Fetching comprehensive service provider details for:', req.params.userType, 'ID:', req.params.userId);
      
      const { userType, userId } = req.params;
      let user = null;

      // Import and query the appropriate model based on user type
      switch (userType.toLowerCase()) {
        case 'hospital':
          const Hospital = require('../models/Hospital');
          user = await Hospital.findById(userId);
          break;
        case 'doctor':
          const Doctor = require('../models/Doctor');
          user = await Doctor.findById(userId);
          break;
        case 'nurse':
          const Nurse = require('../models/Nurse');
          user = await Nurse.findById(userId);
          break;
        case 'pharmacy':
          const Pharmacy = require('../models/Pharmacy');
          user = await Pharmacy.findById(userId);
          break;
        case 'lab':
          const Lab = require('../models/Lab');
          user = await Lab.findById(userId);
          break;
        default:
          return res.status(400).json({ 
            success: false, 
            message: 'Invalid user type. Must be one of: hospital, doctor, nurse, pharmacy, lab' 
          });
      }

      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // Extract comprehensive information based on user type
      let providerInfo = {};
      let documents = {};
      
      switch (userType.toLowerCase()) {
        case 'hospital':
          providerInfo = {
            basicInfo: {
              hospitalName: user.hospitalName,
              registrationNumber: user.registrationNumber,
              contactNumber: user.contactNumber,
              email: user.email,
              address: user.address,
              specialization: user.specialization,
              bedCount: user.bedCount,
              establishedYear: user.establishedYear,
              ownerName: user.ownerName
            },
            status: {
              approvalStatus: user.approvalStatus,
              isApproved: user.isApproved,
              status: user.status,
              registrationDate: user.registrationDate,
              approvedAt: user.approvedAt,
              approvedBy: user.approvedBy
            }
          };
          documents = {
            license: user.licenseDocumentUrl,
            registration: user.registrationCertificateUrl,
            businessLicense: user.businessLicenseUrl,
            taxRegistration: user.taxRegistrationUrl,
            insuranceCertificate: user.insuranceCertificateUrl
          };
          break;
        case 'doctor':
          providerInfo = {
            basicInfo: {
              fullName: user.fullName,
              medicalRegistrationNumber: user.medicalRegistrationNumber,
              specialization: user.specialization,
              experience: user.experience,
              contactNumber: user.contactNumber,
              email: user.email,
              address: user.address,
              qualifications: user.qualifications,
              dateOfBirth: user.dateOfBirth,
              gender: user.gender
            },
            status: {
              approvalStatus: user.approvalStatus,
              isApproved: user.isApproved,
              status: user.status,
              registrationDate: user.registrationDate,
              approvedAt: user.approvedAt,
              approvedBy: user.approvedBy
            }
          };
          documents = {
            license: user.licenseDocumentUrl,
            medicalRegistration: user.medicalRegistrationNumber,
            degreeCertificate: user.degreeCertificateUrl,
            specializationCertificate: user.specializationCertificateUrl,
            experienceCertificate: user.experienceCertificateUrl
          };
          break;
        case 'nurse':
          providerInfo = {
            basicInfo: {
              fullName: user.fullName,
              nursingRegistrationNumber: user.nursingRegistrationNumber,
              department: user.department,
              experience: user.experience,
              contactNumber: user.contactNumber,
              email: user.email,
              address: user.address,
              qualifications: user.qualifications,
              dateOfBirth: user.dateOfBirth,
              gender: user.gender
            },
            status: {
              approvalStatus: user.approvalStatus,
              isApproved: user.isApproved,
              status: user.status,
              registrationDate: user.registrationDate,
              approvedAt: user.approvedAt,
              approvedBy: user.approvedBy
            }
          };
          documents = {
            license: user.licenseDocumentUrl,
            nursingRegistration: user.nursingRegistrationNumber,
            degreeCertificate: user.degreeCertificateUrl,
            experienceCertificate: user.experienceCertificateUrl
          };
          break;
        case 'pharmacy':
          providerInfo = {
            basicInfo: {
              pharmacyName: user.pharmacyName,
              drugLicenseNumber: user.drugLicenseNumber,
              contactNumber: user.contactNumber,
              email: user.email,
              address: user.address,
              ownerName: user.ownerName,
              establishedYear: user.establishedYear,
              businessType: user.businessType
            },
            status: {
              approvalStatus: user.approvalStatus,
              isApproved: user.isApproved,
              status: user.status,
              registrationDate: user.registrationDate,
              approvedAt: user.approvedAt,
              approvedBy: user.approvedBy
            }
          };
          documents = {
            license: user.licenseDocumentUrl,
            drugLicense: user.drugLicenseUrl,
            premisesCertificate: user.premisesCertificateUrl,
            taxRegistration: user.taxRegistrationUrl,
            insuranceCertificate: user.insuranceCertificateUrl
          };
          break;
        case 'lab':
          providerInfo = {
            basicInfo: {
              labName: user.labName,
              licenseNumber: user.licenseNumber,
              contactNumber: user.contactNumber,
              email: user.email,
              address: user.address,
              ownerName: user.ownerName,
              establishedYear: user.establishedYear,
              specializations: user.specializations
            },
            status: {
              approvalStatus: user.approvalStatus,
              isApproved: user.isApproved,
              status: user.status,
              registrationDate: user.registrationDate,
              approvedAt: user.approvedAt,
              approvedBy: user.approvedBy
            }
          };
          documents = {
            license: user.licenseUrl,
            accreditationCertificate: user.accreditationCertificateUrl,
            equipmentCertificate: user.equipmentCertificateUrl,
            qualityCertificate: user.qualityCertificateUrl,
            taxRegistration: user.taxRegistrationUrl
          };
          break;
      }

      // Filter out undefined/null documents
      const filteredDocuments = Object.fromEntries(
        Object.entries(documents).filter(([key, value]) => value != null)
      );

      res.json({ 
        success: true, 
        data: {
          userType: userType.toLowerCase(),
          userId: userId,
          providerInfo: providerInfo,
          documents: filteredDocuments,
          // Approval workflow info
          approvalWorkflow: {
            canApprove: user.approvalStatus === 'pending',
            canReject: user.approvalStatus === 'pending',
            requiresDocuments: Object.keys(filteredDocuments).length > 0,
            nextSteps: user.approvalStatus === 'pending' 
              ? 'Review documents and approve/reject application'
              : user.approvalStatus === 'approved'
              ? 'User can access dashboard'
              : 'User can reapply after addressing rejection reason'
          }
        }
      });
    } catch (error) {
      console.error('❌ Get service provider details error:', error);
      res.status(500).json({ success: false, message: 'Failed to get service provider details' });
    }
  }

  // Get pending profile changes from staff
  async getPendingProfileChanges(req, res) {
    try {
      console.log('Getting pending profile changes...');
      
      // For now, return empty array - this will be implemented when we add profile change functionality
      // In the future, this would query a ProfileChange model
      res.json({
        success: true,
        pendingChanges: []
      });
    } catch (error) {
      console.error('Error getting pending profile changes:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get pending profile changes'
      });
    }
  }

  // Approve a profile change
  async approveProfileChange(req, res) {
    try {
      const { changeId } = req.params;
      console.log('Approving profile change:', changeId);
      
      // For now, return success - this will be implemented when we add profile change functionality
      res.json({
        success: true,
        message: 'Profile change approved successfully'
      });
    } catch (error) {
      console.error('Error approving profile change:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to approve profile change'
      });
    }
  }

  // Reject a profile change
  async rejectProfileChange(req, res) {
    try {
      const { changeId } = req.params;
      const { reason } = req.body;
      console.log('Rejecting profile change:', changeId, 'Reason:', reason);
      
      // For now, return success - this will be implemented when we add profile change functionality
      res.json({
        success: true,
        message: 'Profile change rejected successfully'
      });
    } catch (error) {
      console.error('Error rejecting profile change:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reject profile change'
      });
    }
  }

  // Submit a profile change request
  async submitProfileChange(req, res) {
    try {
      const { fieldName, oldValue, newValue, reason } = req.body;
      const staffUid = req.firebaseUid;
      
      console.log('Staff profile change request:', {
        staffUid,
        fieldName,
        oldValue,
        newValue,
        reason
      });

      // For now, return success - this will be implemented when we add profile change functionality
      // In the future, this would save to a ProfileChange model and notify admin
      res.json({
        success: true,
        message: 'Profile change request submitted successfully. Waiting for admin approval.'
      });
    } catch (error) {
      console.error('Error submitting profile change:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to submit profile change request'
      });
    }
  }
}

module.exports = new StaffWebController();
