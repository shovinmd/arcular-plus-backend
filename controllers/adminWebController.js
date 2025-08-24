const admin = require('firebase-admin');
const User = require('../models/User');
const path = require('path');

// Admin web interface controller
class AdminWebController {
  
  // Get admin login page
  getLoginPage(req, res) {
    res.sendFile(path.join(__dirname, '../../Arcular Pluse Webpage/Superadmin/superadmin_login.html'));
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
      const staff = await User.find({ userType: 'arc_staff' }).select('-password');
      
      // Transform data to match frontend expectations
      const transformedStaff = staff.map(s => ({
        firebaseUid: s.uid,
        name: s.fullName,
        email: s.email,
        role: s.role || 'arcstaff',
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
      // Authentication is handled by middleware
      const { email, password, fullName, phone, role } = req.body;

      // Create Firebase user
      const userRecord = await admin.auth().createUser({
        email,
        password,
        displayName: fullName,
      });

      // Create staff user in MongoDB
      const newStaff = new User({
        uid: userRecord.uid,
        email,
        fullName,
        mobileNumber: phone,
        userType: 'arc_staff',
        role: role || 'staff',
        status: 'active',
        isApproved: true,
        registrationDate: new Date(),
      });

      await newStaff.save();

      res.json({ 
        success: true, 
        message: 'Staff created successfully',
        data: { uid: userRecord.uid, email, fullName }
      });
    } catch (error) {
      console.error('Create staff error:', error);
      res.status(500).json({ success: false, message: 'Failed to create staff' });
    }
  }

  // Update staff member
  async updateStaff(req, res) {
    try {
      // Authentication is handled by middleware
      const { id } = req.params; // This is the Firebase UID
      const updateData = req.body;

      const staff = await User.findOneAndUpdate(
        { uid: id },
        { 
          fullName: updateData.name,
          role: updateData.role,
          updatedAt: new Date() 
        },
        { new: true }
      );

      if (!staff) {
        return res.status(404).json({ success: false, message: 'Staff not found' });
      }

      res.json({ success: true, message: 'Staff updated successfully' });
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
      const staff = await User.findOne({ uid: id });

      if (!staff) {
        return res.status(404).json({ success: false, message: 'Staff not found' });
      }

      // Delete from Firebase
      await admin.auth().deleteUser(staff.uid);

      // Delete from MongoDB
      await User.findByIdAndDelete(staff._id);

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
    const totalUsers = await User.countDocuments();
    const pendingApprovals = await User.countDocuments({ status: 'pending' });
    const approvedUsers = await User.countDocuments({ isApproved: true });
    const totalStaff = await User.countDocuments({ userType: 'arc_staff' });

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
    
    const monthlyRegistrations = await User.countDocuments({
      registrationDate: { $gte: lastMonth }
    });

    const userTypeDistribution = await User.aggregate([
      { $group: { _id: '$userType', count: { $sum: 1 } } }
    ]);

    return {
      monthlyRegistrations,
      userTypeDistribution
    };
  }
}

module.exports = new AdminWebController();
