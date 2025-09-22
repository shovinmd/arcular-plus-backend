const NurseTalk = require('../models/NurseTalk');
const User = require('../models/User');
const Nurse = require('../models/Nurse');
const Hospital = require('../models/Hospital');

// Get nurses in the same hospital
const getHospitalNurses = async (req, res) => {
  try {
    console.log('🏥 NurseTalk: Getting hospital nurses for UID:', req.user.uid);
    const currentUser = await User.findOne({ uid: req.user.uid });
    if (!currentUser) {
      console.log('❌ NurseTalk: User not found for UID:', req.user.uid);
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    console.log('👤 NurseTalk: Found user:', currentUser.fullName, 'ID:', currentUser._id);

    // Try different ways to find nurse profile
    let nurseProfile = await Nurse.findOne({ userId: currentUser._id });
    console.log('🔍 NurseTalk: Found nurse profile by userId:', nurseProfile ? 'Yes' : 'No');
    
    if (!nurseProfile) {
      // Try finding by UID directly
      nurseProfile = await Nurse.findOne({ uid: req.user.uid });
      console.log('🔍 NurseTalk: Found nurse profile by uid:', nurseProfile ? 'Yes' : 'No');
    }
    
    if (!nurseProfile) {
      // Try finding by email
      nurseProfile = await Nurse.findOne({ email: currentUser.email });
      console.log('🔍 NurseTalk: Found nurse profile by email:', nurseProfile ? 'Yes' : 'No');
    }
    if (nurseProfile) {
      console.log('🏥 NurseTalk: Nurse hospitalAffiliation:', nurseProfile.hospitalAffiliation);
      console.log('🏥 NurseTalk: Nurse affiliatedHospitals:', nurseProfile.affiliatedHospitals?.length || 0);
    }
    
    if (!nurseProfile) {
      console.log('❌ NurseTalk: No nurse profile found, creating minimal profile');
      // Create a minimal nurse profile for NurseTalk functionality
      try {
        nurseProfile = await Nurse.create({
          uid: req.user.uid,
          fullName: currentUser.fullName || 'Unknown Nurse',
          email: currentUser.email || `${req.user.uid}@temp.com`,
          mobileNumber: '0000000000',
          hospitalAffiliation: 'Default Hospital', // Default hospital
          qualification: 'RN',
          isApproved: true,
          createdAt: new Date()
        });
        console.log('✅ NurseTalk: Created minimal nurse profile');
      } catch (createError) {
        console.error('❌ NurseTalk: Failed to create nurse profile:', createError.message);
        return res.status(500).json({ success: false, message: 'Failed to create nurse profile' });
      }
    }
    
    if (!nurseProfile.hospitalAffiliation) {
      console.log('❌ NurseTalk: No hospital affiliation found');
      return res.status(404).json({ success: false, message: 'Nurse hospital not found' });
    }

    // Get all nurses in the same hospital (using hospitalAffiliation)
    console.log('🔍 NurseTalk: Searching for nurses with hospitalAffiliation:', nurseProfile.hospitalAffiliation);
    const hospitalNurses = await Nurse.find({ 
      hospitalAffiliation: nurseProfile.hospitalAffiliation,
      isApproved: true 
    })
      .populate('userId', 'fullName email uid')
      .lean();
    
    console.log('👥 NurseTalk: Found hospital nurses:', hospitalNurses.length);

    // Get online status (simplified - in real app, use WebSocket or Redis)
    const nurses = hospitalNurses.map(nurse => ({
      id: nurse._id,
      userId: nurse.userId._id,
      name: nurse.userId.fullName,
      email: nurse.userId.email,
      uid: nurse.userId.uid,
      qualification: nurse.qualification,
      isOnline: Math.random() > 0.3, // Mock online status
      lastSeen: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000)
    }));

    console.log('✅ NurseTalk: Returning nurses:', nurses.length);
    res.json({ success: true, data: nurses });
  } catch (error) {
    console.error('Error fetching hospital nurses:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch nurses', error: error.message });
  }
};

// Send message to another nurse
const sendMessage = async (req, res) => {
  try {
    const { receiverId, message, patientArcId, patientName, messageType = 'chat' } = req.body;

    if (!receiverId || !message) {
      return res.status(400).json({ success: false, message: 'receiverId and message are required' });
    }

    const currentUser = await User.findOne({ uid: req.user.uid });
    if (!currentUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Get nurse profile for hospital context
    const nurseProfile = await Nurse.findOne({ userId: currentUser._id });
    if (!nurseProfile || !nurseProfile.hospitalId) {
      return res.status(404).json({ success: false, message: 'Nurse hospital not found' });
    }

    const nurseTalk = new NurseTalk({
      message,
      messageType,
      senderId: currentUser._id,
      receiverId,
      hospitalId: nurseProfile.hospitalId,
      patientArcId,
      patientName,
      status: 'sent'
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
    const { receiverId } = req.params;
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 100);

    const currentUser = await User.findOne({ uid: req.user.uid });
    if (!currentUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const messages = await NurseTalk.find({
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
    const currentUser = await User.findOne({ uid: req.user.uid });
    if (!currentUser) {
      console.log('❌ NurseTalk: User not found for handover notes UID:', req.user.uid);
      return res.status(404).json({ success: false, message: 'User not found' });
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

    const handoverNotes = await NurseTalk.find({
      hospitalId: nurseProfile.hospitalAffiliation,
      messageType: 'handover'
    })
    .sort({ createdAt: -1 })
    .limit(20)
    .populate('senderId', 'fullName email')
    .populate('receiverId', 'fullName email');

    res.json({ success: true, data: handoverNotes });
  } catch (error) {
    console.error('Error fetching handover notes:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch handover notes', error: error.message });
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
