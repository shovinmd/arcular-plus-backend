const admin = require('firebase-admin');

// Firebase authentication middleware
const verifyFirebaseToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        message: 'No token provided' 
      });
    }

    const idToken = authHeader.split('Bearer ')[1];
    
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      req.user = decodedToken;
      req.firebaseUid = decodedToken.uid;
      next();
    } catch (firebaseError) {
      console.error('Firebase token verification failed:', firebaseError);
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token' 
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Authentication failed' 
    });
  }
};

// Verify admin role middleware
const verifyAdminRole = async (req, res, next) => {
  try {
    if (!req.firebaseUid) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not authenticated' 
      });
    }

    // Check if user exists in MongoDB and has admin role
    const User = require('../models/User');
    const user = await User.findOne({ 
      uid: req.firebaseUid,
      userType: 'admin',
      isApproved: true
    });

    if (!user) {
      return res.status(403).json({ 
        success: false, 
        message: 'Admin access required' 
      });
    }

    req.adminUser = user;
    next();
  } catch (error) {
    console.error('Admin role verification error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Role verification failed' 
    });
  }
};

// Verify staff role middleware
const verifyStaffRole = async (req, res, next) => {
  try {
    if (!req.firebaseUid) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not authenticated' 
      });
    }

    // Check if user exists in MongoDB and has staff role
    const User = require('../models/User');
    const user = await User.findOne({ 
      uid: req.firebaseUid,
      userType: 'arc_staff',
      isApproved: true
    });

    if (!user) {
      return res.status(403).json({ 
        success: false, 
        message: 'Staff access required' 
      });
    }

    req.staffUser = user;
    next();
  } catch (error) {
    console.error('Staff role verification error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Role verification failed' 
    });
  }
};

module.exports = {
  verifyFirebaseToken,
  verifyAdminRole,
  verifyStaffRole
};
