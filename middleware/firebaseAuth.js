const admin = require('../firebase');

// Firebase authentication middleware
const verifyFirebaseToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ No authorization header or invalid format');
      return res.status(401).json({ 
        success: false, 
        message: 'No token provided' 
      });
    }

    const idToken = authHeader.split('Bearer ')[1];
    console.log('🔐 Token received, length:', idToken.length);
    
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      console.log('✅ Token verified for UID:', decodedToken.uid);
      req.user = decodedToken;
      req.firebaseUid = decodedToken.uid;
      next();
    } catch (firebaseError) {
      console.error('❌ Firebase token verification failed:', firebaseError);
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token' 
      });
    }
  } catch (error) {
    console.error('❌ Auth middleware error:', error);
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
      console.log('❌ No firebaseUid in request');
      return res.status(401).json({ 
        success: false, 
        message: 'User not authenticated' 
      });
    }

    console.log('🔍 Checking admin role for UID:', req.firebaseUid);

    // Check if user exists in ArcStaff model and has admin or super_admin role
    const ArcStaff = require('../models/ArcStaff');
    const user = await ArcStaff.findOne({ 
      uid: req.firebaseUid,
      userType: { $in: ['admin', 'super_admin'] },
      isApproved: true 
    });

    console.log('🔍 Found user in ArcStaff:', user ? 'Yes' : 'No');
    if (user) {
      console.log('🔍 User details:', {
        uid: user.uid,
        userType: user.userType,
        isApproved: user.isApproved,
        profileComplete: user.profileComplete
      });
    }

    if (!user) {
      console.log('❌ Admin access denied for UID:', req.firebaseUid);
      return res.status(403).json({ 
        success: false, 
        message: 'Admin access required' 
      });
    }

    console.log('✅ Admin access granted for UID:', req.firebaseUid);
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

    // Check if user exists in ArcStaff model and has staff role
    const ArcStaff = require('../models/ArcStaff');
    const user = await ArcStaff.findOne({ 
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
