const admin = require('firebase-admin');
const User = require('../models/User');
const path = require('path');

// Admin web interface controller
class AdminWebController {
  
  // Get admin login page
  getLoginPage(req, res) {
    res.sendFile(path.join(__dirname, '../public/admin/login.html'));
  }

  // Admin login
  async login(req, res) {
    try {
      const { email, password } = req.body;
      
      // Verify admin credentials (you can store these in environment variables)
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@arcular.com';
      const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
      
      if (email === adminEmail && password === adminPassword) {
        // Create session or JWT token
        req.session.adminLoggedIn = true;
        req.session.adminEmail = email;
        
        res.json({ success: true, message: 'Login successful' });
      } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
      }
    } catch (error) {
      console.error('Admin login error:', error);
      res.status(500).json({ success: false, message: 'Login failed' });
    }
  }

  // Get admin dashboard
  async getDashboard(req, res) {
    try {
      if (!req.session.adminLoggedIn) {
        return res.redirect('/admin/login');
      }

      // Get system statistics
      const stats = await this.getSystemStats();
      
      res.sendFile(path.join(__dirname, '../public/admin/dashboard.html'));
    } catch (error) {
      console.error('Dashboard error:', error);
      res.status(500).json({ success: false, message: 'Failed to load dashboard' });
    }
  }

  // Get staff list
  async getStaffList(req, res) {
    try {
      if (!req.session.adminLoggedIn) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const staff = await User.find({ userType: 'arc_staff' }).select('-password');
      res.json({ success: true, data: staff });
    } catch (error) {
      console.error('Get staff error:', error);
      res.status(500).json({ success: false, message: 'Failed to get staff list' });
    }
  }

  // Create new staff member
  async createStaff(req, res) {
    try {
      if (!req.session.adminLoggedIn) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

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
      if (!req.session.adminLoggedIn) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const { id } = req.params;
      const updateData = req.body;

      const staff = await User.findByIdAndUpdate(
        id,
        { ...updateData, updatedAt: new Date() },
        { new: true }
      );

      if (!staff) {
        return res.status(404).json({ success: false, message: 'Staff not found' });
      }

      res.json({ success: true, message: 'Staff updated successfully', data: staff });
    } catch (error) {
      console.error('Update staff error:', error);
      res.status(500).json({ success: false, message: 'Failed to update staff' });
    }
  }

  // Delete staff member
  async deleteStaff(req, res) {
    try {
      if (!req.session.adminLoggedIn) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const { id } = req.params;
      const staff = await User.findById(id);

      if (!staff) {
        return res.status(404).json({ success: false, message: 'Staff not found' });
      }

      // Delete from Firebase
      await admin.auth().deleteUser(staff.uid);

      // Delete from MongoDB
      await User.findByIdAndDelete(id);

      res.json({ success: true, message: 'Staff deleted successfully' });
    } catch (error) {
      console.error('Delete staff error:', error);
      res.status(500).json({ success: false, message: 'Failed to delete staff' });
    }
  }

  // Get create staff page
  getCreateStaffPage(req, res) {
    if (!req.session.adminLoggedIn) {
      return res.redirect('/admin/login');
    }
    res.sendFile(path.join(__dirname, '../public/admin/create_staff.html'));
  }

  // Get edit staff page
  getEditStaffPage(req, res) {
    if (!req.session.adminLoggedIn) {
      return res.redirect('/admin/login');
    }
    res.sendFile(path.join(__dirname, '../public/admin/edit_staff.html'));
  }

  // Get system overview
  async getSystemOverview(req, res) {
    try {
      if (!req.session.adminLoggedIn) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

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
      if (!req.session.adminLoggedIn) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

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
