const admin = require('../firebase');
const User = require('../models/User');
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
      res.sendFile(path.join(__dirname, '../../Arcular Pluse Webpage/ARCstaff/index.html'));
    } catch (error) {
      console.error('Dashboard error:', error);
      res.status(500).json({ success: false, message: 'Failed to load dashboard' });
    }
  }

  // Get pending approvals
  async getPendingApprovals(req, res) {
    try {
      // Authentication is handled by middleware
      const pendingUsers = await User.find({ 
        status: 'pending',
        userType: { $in: ['hospital', 'doctor', 'nurse', 'pharmacy', 'lab'] }
      }).select('-password');

      res.json({ success: true, data: pendingUsers });
    } catch (error) {
      console.error('Get pending approvals error:', error);
      res.status(500).json({ success: false, message: 'Failed to get pending approvals' });
    }
  }

  // Get pending approvals by user type
  async getPendingByType(req, res) {
    try {
      // Authentication is handled by middleware
      const { userType } = req.params;
      const pendingUsers = await User.find({ 
        userType,
        status: 'pending'
      }).select('-password');

      res.json({ success: true, data: pendingUsers });
    } catch (error) {
      console.error('Get pending by type error:', error);
      res.status(500).json({ success: false, message: 'Failed to get pending approvals' });
    }
  }

  // Approve user
  async approveUser(req, res) {
    try {
      // Authentication is handled by middleware
      const { userType, userId } = req.params;
      const { notes } = req.body;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // Update user status
      user.isApproved = true;
      user.approvalStatus = 'approved';
      user.status = 'active';
      user.approvedBy = req.firebaseUid;
      user.approvedAt = new Date();
      user.approvalNotes = notes;

      await user.save();

      // Send approval email
      try {
        await sendApprovalEmail(user.email, user.fullName, userType, true, '');
        console.log('✅ Approval email sent to user');
      } catch (emailError) {
        console.error('❌ Error sending approval email:', emailError);
      }

      res.json({ 
        success: true, 
        message: 'User approved successfully',
        data: user
      });
    } catch (error) {
      console.error('Approve user error:', error);
      res.status(500).json({ success: false, message: 'Failed to approve user' });
    }
  }

  // Reject user
  async rejectUser(req, res) {
    try {
      // Authentication is handled by middleware
      const { userType, userId } = req.params;
      const { reason } = req.body;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // Update user status
      user.isApproved = false;
      user.approvalStatus = 'rejected';
      user.status = 'inactive';
      user.rejectedBy = req.firebaseUid;
      user.rejectedAt = new Date();
      user.rejectionReason = reason;

      await user.save();

      // Send rejection email
      try {
        await sendApprovalEmail(user.email, user.fullName, userType, false, reason);
        console.log('✅ Rejection email sent to user');
      } catch (emailError) {
        console.error('❌ Error sending rejection email:', emailError);
      }

      res.json({ 
        success: true, 
        message: 'User rejected successfully',
        data: user
      });
    } catch (error) {
      console.error('Reject user error:', error);
      res.status(500).json({ success: false, message: 'Failed to reject user' });
    }
  }

  // Request additional documents
  async requestDocuments(req, res) {
    try {
      // Authentication is handled by middleware
      const { userType, userId } = req.params;
      const { missingDocuments, notes } = req.body;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // Update user status
      user.approvalStatus = 'document_review';
      user.status = 'pending';
      user.documentReviewNotes = notes;
      user.updatedAt = new Date();

      await user.save();

      // Send document review notification
      try {
        await sendDocumentReviewNotification(user.email, user.fullName, userType, missingDocuments);
        console.log('✅ Document review notification sent to user');
      } catch (emailError) {
        console.error('❌ Error sending document review notification:', emailError);
      }

      res.json({ 
        success: true, 
        message: 'Document review request sent successfully',
        data: user
      });
    } catch (error) {
      console.error('Request documents error:', error);
      res.status(500).json({ success: false, message: 'Failed to request documents' });
    }
  }

  // Get users by type
  async getUsersByType(req, res) {
    try {
      // Authentication is handled by middleware
      const { userType } = req.params;
      const users = await User.find({ userType }).select('-password');

      res.json({ success: true, data: users });
    } catch (error) {
      console.error('Get users by type error:', error);
      res.status(500).json({ success: false, message: 'Failed to get users' });
    }
  }

  // Get user details
  async getUserDetails(req, res) {
    try {
      // Authentication is handled by middleware
      const { userType, userId } = req.params;
      const user = await User.findById(userId).select('-password');

      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      res.json({ success: true, data: user });
    } catch (error) {
      console.error('Get user details error:', error);
      res.status(500).json({ success: false, message: 'Failed to get user details' });
    }
  }

  // Get user documents
  async getUserDocuments(req, res) {
    try {
      // Authentication is handled by middleware
      const { userType, userId } = req.params;
      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // Extract document URLs based on user type
      let documents = {};
      
      switch (userType) {
        case 'hospital':
          documents = {
            license: user.licenseDocumentUrl,
            registration: user.registrationDocumentUrl
          };
          break;
        case 'doctor':
          documents = {
            license: user.licenseDocumentUrl,
            medicalRegistration: user.medicalRegistrationDocumentUrl
          };
          break;
        case 'nurse':
          documents = {
            license: user.licenseDocumentUrl,
            nursingRegistration: user.nursingRegistrationDocumentUrl
          };
          break;
        case 'pharmacy':
          documents = {
            license: user.licenseDocumentUrl,
            drugLicense: user.drugLicenseUrl,
            premisesCertificate: user.premisesCertificateUrl
          };
          break;
        case 'lab':
          documents = {
            license: user.licenseUrl,
            accreditationCertificate: user.accreditationCertificateUrl,
            equipmentCertificate: user.equipmentCertificateUrl
          };
          break;
      }

      res.json({ success: true, data: documents });
    } catch (error) {
      console.error('Get user documents error:', error);
      res.status(500).json({ success: false, message: 'Failed to get user documents' });
    }
  }

  // Verify documents
  async verifyDocuments(req, res) {
    try {
      // Authentication is handled by middleware
      const { userType, userId } = req.params;
      const { verificationStatus, notes } = req.body;

      const user = await User.findById(userId);
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

      res.json({ 
        success: true, 
        message: 'Documents verified successfully',
        data: user
      });
    } catch (error) {
      console.error('Verify documents error:', error);
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
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // Update user status
      user.isApproved = true;
      user.approvalStatus = 'approved';
      user.status = 'active';
      user.approvedBy = req.firebaseUid;
      user.approvedAt = new Date();

      await user.save();

      // Send approval email
      try {
        const userName = user.fullName || user.hospitalName || user.pharmacyName || user.labName;
        await sendApprovalEmail(user.email, userName, userType, true, '');
        console.log('✅ Approval email sent to user');
      } catch (emailError) {
        console.error('❌ Error sending approval email:', emailError);
      }

      res.json({ 
        success: true, 
        message: 'Stakeholder approved successfully'
      });
    } catch (error) {
      console.error('Approve stakeholder error:', error);
      res.status(500).json({ success: false, message: 'Failed to approve stakeholder' });
    }
  }

  // Reject stakeholder (matching frontend expectations)
  async rejectStakeholder(req, res) {
    try {
      // Authentication is handled by middleware
      const { id } = req.params;
      const { reason } = req.body;

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
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // Update user status
      user.isApproved = false;
      user.approvalStatus = 'rejected';
      user.status = 'inactive';
      user.rejectedBy = req.firebaseUid;
      user.rejectedAt = new Date();
      user.rejectionReason = reason || 'Application rejected';

      await user.save();

      // Send rejection email
      try {
        const userName = user.fullName || user.hospitalName || user.pharmacyName || user.labName;
        await sendApprovalEmail(user.email, userName, userType, false, reason || 'Application rejected');
        console.log('✅ Rejection email sent to user');
      } catch (emailError) {
        console.error('❌ Error sending rejection email:', emailError);
      }

      res.json({ 
        success: true, 
        message: 'Stakeholder rejected successfully'
      });
    } catch (error) {
      console.error('Reject stakeholder error:', error);
      res.status(500).json({ success: false, message: 'Failed to reject stakeholder' });
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
        break;
      case 'doctor':
        if (user.licenseDocumentUrl) documents.push({ name: 'Medical License', url: user.licenseDocumentUrl });
        if (user.medicalRegistrationDocumentUrl) documents.push({ name: 'Medical Registration', url: user.medicalRegistrationDocumentUrl });
        break;
      case 'nurse':
        if (user.licenseDocumentUrl) documents.push({ name: 'Nursing License', url: user.licenseDocumentUrl });
        if (user.nursingRegistrationDocumentUrl) documents.push({ name: 'Nursing Registration', url: user.nursingRegistrationDocumentUrl });
        break;
      case 'pharmacy':
        if (user.licenseDocumentUrl) documents.push({ name: 'Pharmacy License', url: user.licenseDocumentUrl });
        if (user.drugLicenseUrl) documents.push({ name: 'Drug License', url: user.drugLicenseUrl });
        if (user.premisesCertificateUrl) documents.push({ name: 'Premises Certificate', url: user.premisesCertificateUrl });
        break;
      case 'lab':
        if (user.licenseUrl) documents.push({ name: 'Lab License', url: user.licenseUrl });
        if (user.accreditationCertificateUrl) documents.push({ name: 'Accreditation Certificate', url: user.accreditationCertificateUrl });
        if (user.equipmentCertificateUrl) documents.push({ name: 'Equipment Certificate', url: user.equipmentCertificateUrl });
        break;
    }
    
    return documents;
  }
}

module.exports = new StaffWebController();
