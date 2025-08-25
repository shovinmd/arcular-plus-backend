const { admin } = require('../firebase');
const path = require('path');

// Admin web interface controller
class AdminWebController {
  
  // Get admin login page
  getLoginPage(req, res) {
    res.sendFile(path.join(__dirname, '../../Arcular Pluse Webpage/Superadmin/index.html'));
  }

  // Admin login - Firebase authentication is handled on the frontend
  async login(req, res) {
    try {
      // This endpoint is not needed since Firebase handles authentication on the frontend
      // The frontend will send Firebase ID tokens to protected API endpoints
      res.status(501).json({ success: false, message: 'Use Firebase authentication on frontend' });
    } catch (error) {
      console.error('Admin login error:', error);
      res.status(500).json({ success: false, message: 'Login failed' });
    }
  }

  // Verify admin and create admin record if needed
  async verifyAdmin(req, res) {
    try {
      console.log('🔐 Admin verification request received:', req.body);
      
      const { email, uid, displayName } = req.body;
      
      if (!email || !uid) {
        console.log('❌ Missing required fields:', { email, uid });
        return res.status(400).json({ 
          success: false, 
          message: 'Email and UID are required' 
        });
      }

      // Check if user already exists in ArcStaff collection
      const ArcStaff = require('../models/ArcStaff');
      let adminUser = await ArcStaff.findOne({ uid });

      console.log('🔍 Existing admin user found:', adminUser ? 'Yes' : 'No');

      if (!adminUser) {
        // Create new admin user in MongoDB
        const adminData = {
          uid,
          email,
          fullName: displayName || email.split('@')[0],
          userType: 'super_admin',
          role: 'super_admin',
          status: 'active',
          isApproved: true,
          profileComplete: false,
          canApproveHospitals: true,
          canApproveDoctors: true,
          canApproveNurses: true,
          canApprovePharmacies: true,
          canApproveLabs: true,
          registrationDate: new Date(),
        };
        
        console.log('📝 Creating new admin with data:', adminData);
        
        adminUser = new ArcStaff(adminData);
        await adminUser.save();
        console.log('✅ New super admin created in MongoDB:', email);
      } else {
        // Update existing user to ensure they have admin privileges
        console.log('📝 Updating existing user to super admin');
        
        adminUser.userType = 'super_admin';
        adminUser.role = 'super_admin';
        adminUser.status = 'active';
        adminUser.isApproved = true;
        adminUser.profileComplete = false;
        adminUser.canApproveHospitals = true;
        adminUser.canApproveDoctors = true;
        adminUser.canApproveNurses = true;
        adminUser.canApprovePharmacies = true;
        adminUser.canApproveLabs = true;
        
        await adminUser.save();
        console.log('✅ Existing user updated to super admin:', email);
      }

      const responseData = {
        success: true, 
        message: 'Admin verified successfully',
        data: {
          uid: adminUser.uid,
          email: adminUser.email,
          fullName: adminUser.fullName,
          role: adminUser.role
        }
      };
      
      console.log('✅ Admin verification successful, sending response:', responseData);
      res.json(responseData);

    } catch (error) {
      console.error('❌ Verify admin error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to verify admin',
        error: error.message 
      });
    }
  }

  // Get admin dashboard
  async getDashboard(req, res) {
    try {
      // Authentication is handled by middleware for API calls
      // For page serving, we'll allow access and let the frontend handle auth
      res.sendFile(path.join(__dirname, '../../Arcular Pluse Webpage/Superadmin/index.html'));
    } catch (error) {
      console.error('Dashboard error:', error);
      res.status(500).json({ success: false, message: 'Failed to load dashboard' });
    }
  }

  // Get staff list
  async getStaffList(req, res) {
    try {
      // Authentication is handled by middleware
      const ArcStaff = require('../models/ArcStaff');
      const staff = await ArcStaff.find({ userType: { $in: ['arc_staff', 'staff'] } }).select('-password');
      
      // Transform data to match frontend expectations
      const transformedStaff = staff.map(s => ({
        uid: s.uid,
        fullName: s.fullName,
        email: s.email,
        mobileNumber: s.mobileNumber,
        role: s.role || 'arcstaff',
        department: s.department,
        designation: s.designation,
        address: s.address,
        status: s.status,
        createdAt: s.registrationDate || s.createdAt
      }));
      
      res.json(transformedStaff);
    } catch (error) {
      console.error('Get staff error:', error);
      res.status(500).json({ success: false, message: 'Failed to get staff list' });
    }
  }

  // Create new staff member
  async createStaff(req, res) {
    try {
      console.log('🔐 Creating new staff member...');
      console.log('📝 Request body:', req.body);
      
      // Authentication is handled by middleware
      const { email, password, fullName, phone, role, department, designation, address } = req.body;

      if (!fullName || !email || !password || !role) {
        console.log('❌ Missing required fields:', { fullName, email, password, role });
        return res.status(400).json({ 
          success: false, 
          message: 'Full name, email, password, and role are required' 
        });
      }

      console.log('🔍 Checking if staff already exists...');
      
      // Check if staff already exists
      const ArcStaff = require('../models/ArcStaff');
      const existingStaff = await ArcStaff.findOne({ email });
      if (existingStaff) {
        console.log('❌ Staff already exists with email:', email);
        return res.status(400).json({ 
          success: false, 
          message: 'Staff member with this email already exists' 
        });
      }

      console.log('✅ No existing staff found, proceeding with creation...');
      console.log('🔥 Creating Firebase user...');

      // Create Firebase user
      let userRecord;
      try {
        userRecord = await admin.auth().createUser({
          email,
          password,
          displayName: fullName,
        });
        console.log('✅ Firebase user created successfully:', userRecord.uid);
      } catch (firebaseError) {
        console.error('❌ Firebase user creation failed:', firebaseError);
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to create Firebase user: ' + firebaseError.message 
        });
      }

      console.log('📝 Creating MongoDB staff record...');

      // Create staff user in MongoDB
      const newStaff = new ArcStaff({
        uid: userRecord.uid,
        email,
        fullName,
        mobileNumber: phone,
        userType: 'arc_staff',
        role: role || 'arcstaff',
        department,
        designation,
        address,
        status: 'active',
        isApproved: true,
        profileComplete: true,
        registrationDate: new Date(),
        createdBy: req.firebaseUid || req.user?.uid || 'system'
      });

      console.log('📝 Staff data to save:', newStaff);

      try {
        await newStaff.save();
        console.log('✅ MongoDB staff record saved successfully');
      } catch (mongoError) {
        console.error('❌ MongoDB save failed:', mongoError);
        // Try to delete the Firebase user if MongoDB save fails
        try {
          await admin.auth().deleteUser(userRecord.uid);
          console.log('✅ Firebase user deleted after MongoDB save failure');
        } catch (deleteError) {
          console.error('❌ Failed to delete Firebase user after MongoDB save failure:', deleteError);
        }
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to save staff record: ' + mongoError.message 
        });
      }

      console.log('✅ Staff created successfully:', email);

      res.json({ 
        success: true, 
        message: 'Staff created successfully',
        data: { 
          uid: userRecord.uid, 
          email, 
          fullName,
          role: newStaff.role,
          department: newStaff.department,
          designation: newStaff.designation,
          status: newStaff.status
        }
      });
    } catch (error) {
      console.error('❌ Create staff error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to create staff: ' + error.message 
      });
    }
  }

  // Get staff by ID (for editing)
  async getStaffById(req, res) {
    try {
      // Authentication is handled by middleware
      const { id } = req.params; // This is the Firebase UID
      
      const ArcStaff = require('../models/ArcStaff');
      const staff = await ArcStaff.findOne({ uid: id }).select('-__v');

      if (!staff) {
        return res.status(404).json({ success: false, message: 'Staff not found' });
      }

      res.json({
        success: true,
        data: {
          uid: staff.uid,
          email: staff.email,
          fullName: staff.fullName,
          role: staff.role,
          department: staff.department,
          designation: staff.designation,
          mobileNumber: staff.mobileNumber,
          address: staff.address,
          status: staff.status,
          isApproved: staff.isApproved
        }
      });
    } catch (error) {
      console.error('Get staff by ID error:', error);
      res.status(500).json({ success: false, message: 'Failed to get staff details' });
    }
  }

  // Update staff member
  async updateStaff(req, res) {
    try {
      // Authentication is handled by middleware
      const { id } = req.params; // This is the Firebase UID
      const updateData = req.body;

      console.log('🔧 Updating staff with UID:', id, 'Data:', updateData);

      const ArcStaff = require('../models/ArcStaff');
      
      // Build update object with available fields
      const updateFields = {};
      if (updateData.fullName) updateFields.fullName = updateData.fullName;
      if (updateData.name) updateFields.fullName = updateData.name; // Handle both name and fullName
      if (updateData.role) updateFields.role = updateData.role;
      if (updateData.department) updateFields.department = updateData.department;
      if (updateData.designation) updateFields.designation = updateData.designation;
      if (updateData.mobileNumber) updateFields.mobileNumber = updateData.mobileNumber;
      if (updateData.phone) updateFields.mobileNumber = updateData.phone; // Handle both phone and mobileNumber
      if (updateData.address) updateFields.address = updateData.address;
      
      updateFields.updatedAt = new Date();

      const staff = await ArcStaff.findOneAndUpdate(
        { uid: id },
        updateFields,
        { new: true }
      );

      if (!staff) {
        return res.status(404).json({ success: false, message: 'Staff not found' });
      }

      console.log('✅ Staff updated successfully:', staff.email);
      res.json({ 
        success: true, 
        message: 'Staff updated successfully',
        data: staff
      });
    } catch (error) {
      console.error('Update staff error:', error);
      res.status(500).json({ success: false, message: 'Failed to update staff' });
    }
  }

  // Delete staff member
  async deleteStaff(req, res) {
    try {
      // Authentication is handled by middleware
      const { id } = req.params; // This is the Firebase UID
      const ArcStaff = require('../models/ArcStaff');
      const staff = await ArcStaff.findOne({ uid: id });

      if (!staff) {
        return res.status(404).json({ success: false, message: 'Staff not found' });
      }

      // Delete from Firebase
      await admin.auth().deleteUser(staff.uid);

      // Delete from MongoDB
      await ArcStaff.findByIdAndDelete(staff._id);

      res.json({ success: true, message: 'Staff deleted successfully' });
    } catch (error) {
      console.error('Delete staff error:', error);
      res.status(500).json({ success: false, message: 'Failed to delete staff' });
    }
  }

  // Get create staff page - redirects to dashboard since functionality is built-in
  getCreateStaffPage(req, res) {
    // Authentication is handled by middleware for API calls
    res.redirect('/admin/dashboard');
  }

  // Get edit staff page - redirects to dashboard since functionality is built-in
  getEditStaffPage(req, res) {
    // Authentication is handled by middleware for API calls
    res.redirect('/admin/dashboard');
  }

  // Get system overview
  async getSystemOverview(req, res) {
    try {
      // Authentication is handled by middleware
      const stats = await this.getSystemStats();
      res.json({ success: true, data: stats });
    } catch (error) {
      console.error('System overview error:', error);
      res.status(500).json({ success: false, message: 'Failed to get system overview' });
    }
  }

  // Get analytics
  async getAnalytics(req, res) {
    try {
      // Authentication is handled by middleware
      // Get analytics data
      const analytics = await this.getAnalyticsData();
      res.json({ success: true, data: analytics });
    } catch (error) {
      console.error('Analytics error:', error);
      res.status(500).json({ success: false, message: 'Failed to get analytics' });
    }
  }

  // Helper method to get system statistics
  async getSystemStats() {
    // Import all role models
    const Hospital = require('../models/Hospital');
    const Doctor = require('../models/Doctor');
    const Nurse = require('../models/Nurse');
    const Pharmacy = require('../models/Pharmacy');
    const Lab = require('../models/Lab');
    const ArcStaff = require('../models/ArcStaff');

    // Count users from each model
    const [totalHospitals, totalDoctors, totalNurses, totalPharmacies, totalLabs, totalStaff] = await Promise.all([
      Hospital.countDocuments(),
      Doctor.countDocuments(),
      Nurse.countDocuments(),
      Pharmacy.countDocuments(),
      Lab.countDocuments(),
      ArcStaff.countDocuments()
    ]);

    const totalUsers = totalHospitals + totalDoctors + totalNurses + totalPharmacies + totalLabs;

    // Count pending approvals from each model
    const [pendingHospitals, pendingDoctors, pendingNurses, pendingPharmacies, pendingLabs] = await Promise.all([
      Hospital.countDocuments({ approvalStatus: 'pending' }),
      Doctor.countDocuments({ approvalStatus: 'pending' }),
      Nurse.countDocuments({ approvalStatus: 'pending' }),
      Pharmacy.countDocuments({ approvalStatus: 'pending' }),
      Lab.countDocuments({ approvalStatus: 'pending' })
    ]);

    const pendingApprovals = pendingHospitals + pendingDoctors + pendingNurses + pendingPharmacies + pendingLabs;

    // Count approved users from each model
    const [approvedHospitals, approvedDoctors, approvedNurses, approvedPharmacies, approvedLabs] = await Promise.all([
      Hospital.countDocuments({ isApproved: true }),
      Doctor.countDocuments({ isApproved: true }),
      Nurse.countDocuments({ isApproved: true }),
      Pharmacy.countDocuments({ isApproved: true }),
      Lab.countDocuments({ isApproved: true })
    ]);

    const approvedUsers = approvedHospitals + approvedDoctors + approvedNurses + approvedPharmacies + approvedLabs;

    return {
      totalUsers,
      pendingApprovals,
      approvedUsers,
      totalStaff,
      approvalRate: totalUsers > 0 ? ((approvedUsers / totalUsers) * 100).toFixed(2) : 0
    };
  }

  // Helper method to get analytics data
  async getAnalyticsData() {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    
    // Import all role models
    const Hospital = require('../models/Hospital');
    const Doctor = require('../models/Doctor');
    const Nurse = require('../models/Nurse');
    const Pharmacy = require('../models/Pharmacy');
    const Lab = require('../models/Lab');

    // Count monthly registrations from each model
    const [monthlyHospitals, monthlyDoctors, monthlyNurses, monthlyPharmacies, monthlyLabs] = await Promise.all([
      Hospital.countDocuments({ registrationDate: { $gte: lastMonth } }),
      Doctor.countDocuments({ registrationDate: { $gte: lastMonth } }),
      Nurse.countDocuments({ registrationDate: { $gte: lastMonth } }),
      Pharmacy.countDocuments({ registrationDate: { $gte: lastMonth } }),
      Lab.countDocuments({ registrationDate: { $gte: lastMonth } })
    ]);

    const monthlyRegistrations = monthlyHospitals + monthlyDoctors + monthlyNurses + monthlyPharmacies + monthlyLabs;

    // Get user type distribution from each model
    const totalHospitals = await Hospital.countDocuments();
    const totalDoctors = await Doctor.countDocuments();
    const totalNurses = await Nurse.countDocuments();
    const totalPharmacies = await Pharmacy.countDocuments();
    const totalLabs = await Lab.countDocuments();

    const userTypeDistribution = [
      { _id: 'hospital', count: totalHospitals },
      { _id: 'doctor', count: totalDoctors },
      { _id: 'nurse', count: totalNurses },
      { _id: 'pharmacy', count: totalPharmacies },
      { _id: 'lab', count: totalLabs }
    ];

    return {
      monthlyRegistrations,
      userTypeDistribution
    };
  }

  // Update admin profile
  async updateAdminProfile(req, res) {
    try {
      console.log('🔐 Admin profile update request received:', req.body);
      
      const { uid, email, fullName, phone, department, designation, address } = req.body;
      
      if (!uid || !email) {
        return res.status(400).json({ 
          success: false, 
          message: 'UID and email are required' 
        });
      }

      // Find and update admin user in ArcStaff collection
      const ArcStaff = require('../models/ArcStaff');
      const adminUser = await ArcStaff.findOne({ uid });

      if (!adminUser) {
        return res.status(404).json({ 
          success: false, 
          message: 'Admin user not found' 
        });
      }

      // Update profile fields
      adminUser.fullName = fullName;
      adminUser.mobileNumber = phone;
      adminUser.department = department;
      adminUser.designation = designation;
      adminUser.address = address;
      adminUser.profileComplete = true;
      adminUser.updatedAt = new Date();

      await adminUser.save();
      console.log('✅ Admin profile updated successfully:', email);

      res.json({ 
        success: true, 
        message: 'Profile updated successfully',
        data: {
          uid: adminUser.uid,
          email: adminUser.email,
          fullName: adminUser.fullName,
          mobileNumber: adminUser.mobileNumber,
          department: adminUser.department,
          designation: adminUser.designation,
          address: adminUser.address,
          profileComplete: adminUser.profileComplete
        }
      });

    } catch (error) {
      console.error('❌ Update admin profile error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to update profile',
        error: error.message 
      });
    }
  }

  // Get admin profile
  async getAdminProfile(req, res) {
    try {
      const { uid } = req.params;
      
      if (!uid) {
        return res.status(400).json({ 
          success: false, 
          message: 'UID is required' 
        });
      }

      // Find admin user in ArcStaff collection
      const ArcStaff = require('../models/ArcStaff');
      const adminUser = await ArcStaff.findOne({ uid });

      if (!adminUser) {
        return res.status(404).json({ 
          success: false, 
          message: 'Admin user not found' 
        });
      }

      res.json({ 
        success: true, 
        data: {
          uid: adminUser.uid,
          email: adminUser.email,
          fullName: adminUser.fullName,
          mobileNumber: adminUser.mobileNumber,
          department: adminUser.department,
          designation: adminUser.designation,
          address: adminUser.address,
          profileComplete: adminUser.profileComplete || false
        }
      });

    } catch (error) {
      console.error('❌ Get admin profile error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to get profile',
        error: error.message 
      });
    }
  }
}

module.exports = new AdminWebController();
