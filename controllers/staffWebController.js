const admin = require('firebase-admin');
const User = require('../models/User');
const path = require('path');
const { sendApprovalEmail, sendDocumentReviewNotification } = require('../services/emailService');

// Staff web interface controller
class StaffWebController {
  
  // Get staff login page
  getLoginPage(req, res) {
    res.sendFile(path.join(__dirname, '../public/staff/login.html'));
  }

  // Staff login
  async login(req, res) {
    try {
      const { email, password } = req.body;
      
      // Verify staff credentials using Firebase
      try {
        const userRecord = await admin.auth().getUserByEmail(email);
        
        // Check if user exists in MongoDB and is staff
        const staff = await User.findOne({ 
          uid: userRecord.uid, 
          userType: 'arc_staff',
          isApproved: true 
        });

        if (staff) {
          // Create session
          req.session.staffLoggedIn = true;
          req.session.staffUid = userRecord.uid;
          req.session.staffEmail = email;
          
          res.json({ success: true, message: 'Login successful' });
        } else {
          res.status(401).json({ success: false, message: 'Unauthorized access' });
        }
      } catch (firebaseError) {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
      }
    } catch (error) {
      console.error('Staff login error:', error);
      res.status(500).json({ success: false, message: 'Login failed' });
    }
  }

  // Get staff dashboard
  async getDashboard(req, res) {
    try {
      if (!req.session.staffLoggedIn) {
        return res.redirect('/staff/login');
      }

      res.sendFile(path.join(__dirname, '../public/staff/dashboard.html'));
    } catch (error) {
      console.error('Dashboard error:', error);
      res.status(500).json({ success: false, message: 'Failed to load dashboard' });
    }
  }

  // Get pending approvals
  async getPendingApprovals(req, res) {
    try {
      if (!req.session.staffLoggedIn) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

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
      if (!req.session.staffLoggedIn) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

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
      if (!req.session.staffLoggedIn) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

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
      user.approvedBy = req.session.staffUid;
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
      if (!req.session.staffLoggedIn) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

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
      user.rejectedBy = req.session.staffUid;
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
      if (!req.session.staffLoggedIn) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

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
      if (!req.session.staffLoggedIn) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

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
      if (!req.session.staffLoggedIn) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

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
      if (!req.session.staffLoggedIn) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

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
            license: user.licenseDocumentUrl,
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
      if (!req.session.staffLoggedIn) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const { userType, userId } = req.params;
      const { verificationStatus, notes } = req.body;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // Update document verification status
      user.documentVerificationStatus = verificationStatus;
      user.documentVerificationNotes = notes;
      user.documentVerifiedBy = req.session.staffUid;
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
}

module.exports = new StaffWebController();
