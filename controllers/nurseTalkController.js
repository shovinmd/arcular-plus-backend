const NurseTalk = require('../models/NurseTalk');
const User = require('../models/User');
const Nurse = require('../models/Nurse');
const Hospital = require('../models/Hospital');

// Get nurses in the same hospital
const getHospitalNurses = async (req, res) => {
  try {
    console.log('🏥 NurseTalk: Getting hospital nurses for UID:', req.user.uid);
    let currentUser = await User.findOne({ uid: req.user.uid });
    if (!currentUser) {
      console.log('❌ NurseTalk: User not found for UID:', req.user.uid, '→ attempting fallback from Nurse profile');
      // Fallback: try to create a minimal User from Nurse profile so routes work
      const nurse = await Nurse.findOne({ uid: req.user.uid });
      if (nurse) {
        try {
          currentUser = await User.create({
            uid: req.user.uid,
            email: req.user.email || nurse.email || `${req.user.uid}@temp.com`,
            fullName: nurse.fullName || 'Unknown User',
            type: 'nurse',
            arcId: `TEMP-${req.user.uid}-${Date.now()}`,
            createdAt: new Date(),
          });
          console.log('✅ NurseTalk: Minimal user created from Nurse profile');
        } catch (e) {
          console.log('⚠️ NurseTalk: Could not create minimal user:', e.message);
        }
      }
      if (!currentUser) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
    }
    console.log('👤 NurseTalk: Found user:', currentUser.fullName, 'ID:', currentUser._id);

    // Try different ways to find nurse profile (Nurse stores uid/email directly)
    let nurseProfile = await Nurse.findOne({ uid: req.user.uid });
    console.log('🔍 NurseTalk: Found nurse profile by uid:', nurseProfile ? 'Yes' : 'No');

    if (!nurseProfile && currentUser.email) {
      nurseProfile = await Nurse.findOne({ email: currentUser.email });
      console.log('🔍 NurseTalk: Found nurse profile by email:', nurseProfile ? 'Yes' : 'No');
    }
    if (nurseProfile) {
      console.log('🏥 NurseTalk: Nurse hospitalAffiliation:', nurseProfile.hospitalAffiliation);
      console.log('🏥 NurseTalk: Nurse affiliatedHospitals:', nurseProfile.affiliatedHospitals?.length || 0);
    }
    
    // If still not found, fall back to a general nurses list (same app-wide visibility)
    if (!nurseProfile) {
      console.log('ℹ️ NurseTalk: No nurse profile found; returning general approved nurses list (fallback)');
      const general = await Nurse.find({ isApproved: true })
        .select('fullName email uid qualification lastSeen')
        .limit(50)
        .lean();
      const nowTs = Date.now();
      const mapped = general
        .filter(n => String(n.uid) !== String(req.user.uid) && String(n.email || '') !== String(currentUser.email || ''))
        .map(n => ({
          id: n._id,
          name: n.fullName,
          email: n.email,
          uid: n.uid,
          qualification: n.qualification,
          isOnline: n.lastSeen ? (nowTs - new Date(n.lastSeen).getTime() < 2*60*1000) : false,
          lastSeen: n.lastSeen || null,
        }));
      return res.json({ success: true, data: mapped });
    }
    
    // Determine hospital context: prefer affiliatedHospitals.hospitalId
    let hospitalIdFilter = undefined;
    if (Array.isArray(nurseProfile.affiliatedHospitals) && nurseProfile.affiliatedHospitals.length > 0) {
      const active = nurseProfile.affiliatedHospitals.find(h => h.isActive !== false) || nurseProfile.affiliatedHospitals[0];
      hospitalIdFilter = String(active.hospitalId || '');
    }

    let hospitalNurses = [];
    if (hospitalIdFilter && hospitalIdFilter.length > 0) {
      console.log('🔍 NurseTalk: Searching nurses by hospitalId:', hospitalIdFilter);
      hospitalNurses = await Nurse.find({
        isApproved: true,
        'affiliatedHospitals.hospitalId': hospitalIdFilter,
      }).select('fullName email uid qualification affiliatedHospitals').lean();
    } else if (nurseProfile.hospitalAffiliation) {
      console.log('🔍 NurseTalk: Searching nurses by hospitalAffiliation:', nurseProfile.hospitalAffiliation);
      hospitalNurses = await Nurse.find({
        isApproved: true,
        hospitalAffiliation: nurseProfile.hospitalAffiliation,
      }).select('fullName email uid qualification affiliatedHospitals').lean();
    } else {
      console.log('ℹ️ NurseTalk: No hospital context; returning empty list');
      return res.json({ success: true, data: [] });
    }
    
    console.log('👥 NurseTalk: Found hospital nurses:', hospitalNurses.length);

    // Get online status (simplified - in real app, use WebSocket or Redis)
    // Exclude the current nurse from the list
    const now = Date.now();
    const nurses = hospitalNurses
      .filter(n => String(n.uid) !== String(req.user.uid) && String(n.email || '') !== String(currentUser.email || ''))
      .map(nurse => {
        const lastSeenTs = nurse.lastSeen ? new Date(nurse.lastSeen).getTime() : 0;
        const isOnline = lastSeenTs && (now - lastSeenTs) < 2 * 60 * 1000; // 2 minutes
        return {
          id: nurse._id,
          name: nurse.fullName,
          email: nurse.email,
          uid: nurse.uid,
          qualification: nurse.qualification,
          isOnline,
          lastSeen: nurse.lastSeen || null,
        };
      });

    console.log('✅ NurseTalk: Returning nurses:', nurses.length);
    
    // If no nurses found, return empty array instead of error
    if (nurses.length === 0) {
      console.log('ℹ️ NurseTalk: No nurses found, returning empty array');
    }
    
    res.json({ success: true, data: nurses });
  } catch (error) {
    console.error('❌ Error fetching hospital nurses:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch nurses', 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Send message to another nurse
const sendMessage = async (req, res) => {
  try {
    let { receiverId, message, patientArcId, patientName, messageType = 'chat' } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, message: 'receiverId and message are required' });
    }

    // Resolve receiverId from uid/email if needed
    if (!receiverId || receiverId.length < 12) {
      // Try to find by uid or email
      const byUid = await User.findOne({ uid: receiverId });
      const byEmail = !byUid && receiverId?.includes('@') ? await User.findOne({ email: receiverId }) : null;
      const target = byUid || byEmail;
      if (target) {
        receiverId = String(target._id);
      }
    }

    if (!receiverId) {
      return res.status(400).json({ success: false, message: 'Valid receiver not found' });
    }

    const currentUser = await User.findOne({ uid: req.user.uid });
    if (!currentUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Get nurse profile for hospital context
    let nurseProfile = await Nurse.findOne({ userId: currentUser._id });
    if (!nurseProfile) nurseProfile = await Nurse.findOne({ uid: currentUser.uid });
    if (!nurseProfile && currentUser.email) nurseProfile = await Nurse.findOne({ email: currentUser.email });
    // Use hospitalAffiliation if hospitalId is not present
    const resolvedHospitalId = nurseProfile?.hospitalId || nurseProfile?.affiliatedHospitals?.[0]?.hospitalId || null;
    if (!nurseProfile || !resolvedHospitalId) {
      return res.status(404).json({ success: false, message: 'Nurse hospital not found' });
    }

    const nurseTalk = new NurseTalk({
      message,
      messageType,
      senderId: currentUser._id,
      receiverId,
      hospitalId: resolvedHospitalId,
      patientArcId,
      patientName,
      status: 'sent',
      createdAt: new Date()
    });

    await nurseTalk.save();

    // Populate sender details
    await nurseTalk.populate([
      { path: 'senderId', select: 'fullName email' },
      { path: 'receiverId', select: 'fullName email' },
      { path: 'hospitalId', select: 'name' }
    ]);

    res.status(201).json({ success: true, data: nurseTalk });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ success: false, message: 'Failed to send message', error: error.message });
  }
};

// Get messages between two nurses
const getMessages = async (req, res) => {
  try {
    let { receiverId } = req.params;
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 100);

    const currentUser = await User.findOne({ uid: req.user.uid });
    if (!currentUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Resolve receiverId to ObjectId if a uid/email was passed
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(receiverId)) {
      const candidate = await User.findOne({
        $or: [ { uid: receiverId }, { email: receiverId } ]
      });
      if (candidate) receiverId = String(candidate._id);
    }

    // Only fetch direct chat messages here; handover is shown in its own tab
    const messages = await NurseTalk.find({
      messageType: 'chat',
      $or: [
        { senderId: currentUser._id, receiverId: receiverId },
        { senderId: receiverId, receiverId: currentUser._id }
      ]
    })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('senderId', 'fullName email')
    .populate('receiverId', 'fullName email')
    .populate('hospitalId', 'name');

    res.json({ success: true, data: messages.reverse() });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch messages', error: error.message });
  }
};

// Get handover notes for the hospital
const getHandoverNotes = async (req, res) => {
  try {
    console.log('📝 NurseTalk: Getting handover notes for UID:', req.user.uid);
    let currentUser = await User.findOne({ uid: req.user.uid });
    if (!currentUser) {
      console.log('❌ NurseTalk: User not found for handover notes UID:', req.user.uid, '→ attempting fallback from Nurse profile');
      const nurse = await Nurse.findOne({ uid: req.user.uid });
      if (nurse) {
        try {
          currentUser = await User.create({
            uid: req.user.uid,
            email: req.user.email || nurse.email || `${req.user.uid}@temp.com`,
            fullName: nurse.fullName || 'Unknown User',
            type: 'nurse',
            arcId: `TEMP-${req.user.uid}-${Date.now()}`,
            createdAt: new Date(),
          });
          console.log('✅ NurseTalk: Minimal user created for handover');
        } catch (e) {
          console.log('⚠️ NurseTalk: Could not create minimal user for handover:', e.message);
        }
      }
      if (!currentUser) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
    }

    let nurseProfile = await Nurse.findOne({ userId: currentUser._id });
    if (!nurseProfile) {
      nurseProfile = await Nurse.findOne({ uid: req.user.uid });
    }
    if (!nurseProfile) {
      nurseProfile = await Nurse.findOne({ email: currentUser.email });
    }
    
    if (!nurseProfile) {
      // Create minimal nurse profile
      try {
        nurseProfile = await Nurse.create({
          uid: req.user.uid,
          fullName: currentUser.fullName || 'Unknown Nurse',
          email: currentUser.email || `${req.user.uid}@temp.com`,
          mobileNumber: '0000000000',
          hospitalAffiliation: 'Default Hospital',
          qualification: 'RN',
          isApproved: true,
          createdAt: new Date()
        });
      } catch (createError) {
        return res.status(500).json({ success: false, message: 'Failed to create nurse profile' });
      }
    }
    
    if (!nurseProfile.hospitalAffiliation) {
      return res.status(404).json({ success: false, message: 'Nurse hospital not found' });
    }

    // For now, get all handover notes since we don't have proper hospitalId mapping
    const handoverNotes = await NurseTalk.find({
      messageType: 'handover'
    })
    .sort({ createdAt: -1 })
    .limit(20)
    .populate('senderId', 'fullName email')
    .populate('receiverId', 'fullName email');

    res.json({ success: true, data: handoverNotes });
  } catch (error) {
    console.error('❌ Error fetching handover notes:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch handover notes', 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Mark message as read
const markAsRead = async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await NurseTalk.findById(messageId);
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    message.status = 'read';
    message.readAt = new Date();
    await message.save();

    res.json({ success: true, data: message });
  } catch (error) {
    console.error('Error marking message as read:', error);
    res.status(500).json({ success: false, message: 'Failed to mark message as read', error: error.message });
  }
};

// Get unread message count
const getUnreadCount = async (req, res) => {
  try {
    const currentUser = await User.findOne({ uid: req.user.uid });
    if (!currentUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const unreadCount = await NurseTalk.countDocuments({
      receiverId: currentUser._id,
      status: { $in: ['sent', 'delivered'] }
    });

    res.json({ success: true, count: unreadCount });
  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(500).json({ success: false, message: 'Failed to get unread count', error: error.message });
  }
};

module.exports = {
  getHospitalNurses,
  sendMessage,
  getMessages,
  getHandoverNotes,
  markAsRead,
  getUnreadCount
};
