const NurseTalk = require('../models/NurseTalk');
// In-memory typing indicator store (ephemeral per process)
// key: `${senderId}->${receiverId}` => timestamp (ms)
const typingState = new Map();

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
            fullName: nurse.fullName || (req.user.email ? req.user.email.split('@')[0] : 'Nurse'),
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
          userId: n._id, // Add userId field for frontend compatibility
          name: n.fullName,
          email: n.email,
          uid: n.uid,
          qualification: n.qualification,
          isOnline: n.lastSeen ? (nowTs - new Date(n.lastSeen).getTime() < 30*1000) : false,
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
    

    // Get online status (simplified - in real app, use WebSocket or Redis)
    // Exclude the current nurse from the list
    const now = Date.now();
    
    
    // Also check if current user exists in the hospital nurses list
    const currentUserInList = hospitalNurses.find(n => 
      String(n.uid) === String(req.user.uid) || 
      String(n.email || '').toLowerCase() === String(req.user.email || '').toLowerCase()
    );
    if (currentUserInList) {
      console.log('⚠️ NurseTalk: Current user found in hospital nurses list!', {
        _id: currentUserInList._id,
        fullName: currentUserInList.fullName,
        email: currentUserInList.email,
        uid: currentUserInList.uid
      });
    } else {
      console.log('✅ NurseTalk: Current user not found in hospital nurses list (good)');
    }
    
    const nurses = hospitalNurses
      .filter(n => {
        // Multiple ways to identify the same user
        const isSameUid = String(n.uid) === String(req.user.uid);
        const isSameEmail = String(n.email || '').toLowerCase() === String(currentUser.email || '').toLowerCase();
        const isSameUserId = String(n.userId || n._id) === String(currentUser._id);
        
        // Additional check: compare with req.user.email directly
        const isSameReqEmail = String(n.email || '').toLowerCase() === String(req.user.email || '').toLowerCase();
        
        // Check if this is the current user
        const isCurrentUser = isSameUid || isSameEmail || isSameUserId || isSameReqEmail;
        
        
        // Exclude if this is the current user
        return !isCurrentUser;
      })
      .map(nurse => {
        const lastSeenTs = nurse.lastSeen ? new Date(nurse.lastSeen).getTime() : 0;
        const isOnline = lastSeenTs > 0 && (now - lastSeenTs) < 30 * 1000; // 30 seconds
        const timeDiff = lastSeenTs ? Math.round((now - lastSeenTs) / 1000) : 'never';
        return {
          id: nurse._id,
          userId: nurse.userId || nurse._id, // Prefer profile.userId if present
          name: nurse.fullName,
          email: nurse.email,
          uid: nurse.uid,
          qualification: nurse.qualification,
          isOnline,
          lastSeen: nurse.lastSeen || null,
        };
      });

    console.log('✅ NurseTalk: Returning nurses:', nurses.length);
    
    // Final safety check - ensure current user is not in the returned list
    const currentUserStillInList = nurses.find(n => 
      String(n.uid) === String(req.user.uid) || 
      String(n.email || '').toLowerCase() === String(req.user.email || '').toLowerCase()
    );
    if (currentUserStillInList) {
      console.log('❌ NurseTalk: CRITICAL ERROR - Current user still in filtered list!', {
        _id: currentUserStillInList.id,
        name: currentUserStillInList.name,
        email: currentUserStillInList.email,
        uid: currentUserStillInList.uid
      });
      // Remove the current user from the list as a safety measure
      const filteredNurses = nurses.filter(n => 
        String(n.uid) !== String(req.user.uid) && 
        String(n.email || '').toLowerCase() !== String(req.user.email || '').toLowerCase()
      );
      console.log('🔧 NurseTalk: Safety filtered nurses count:', filteredNurses.length);
      return res.json({ success: true, data: filteredNurses });
    }
    
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

    console.log('📤 NurseTalk: Sending message:', {
      receiverId,
      message: message?.substring(0, 50) + '...',
      messageType,
      senderUid: req.user.uid
    });

    if (!message) {
      return res.status(400).json({ success: false, message: 'receiverId and message are required' });
    }

    // Resolve receiverId to ObjectId - try multiple approaches
    const mongoose = require('mongoose');
    let resolvedReceiverId = receiverId;
    
    
    // If it's already a valid ObjectId, try to find the corresponding User
    if (mongoose.Types.ObjectId.isValid(receiverId)) {
      // First try to find User by _id
      let candidate = await User.findById(receiverId);
      if (candidate) {
        resolvedReceiverId = String(candidate._id);
      } else {
        // Try to find User by Nurse model ID (if receiverId is a Nurse _id)
        const nurse = await Nurse.findById(receiverId);
        if (nurse) {
          
          // Try multiple ways to find the corresponding User
          if (nurse.userId) {
            candidate = await User.findById(nurse.userId);
            if (candidate) {
              resolvedReceiverId = String(candidate._id);
            }
          }
          
          // If userId didn't work, try by uid
          if (!candidate && nurse.uid) {
            candidate = await User.findOne({ uid: nurse.uid });
            if (candidate) {
              resolvedReceiverId = String(candidate._id);
            }
          }
          
          // If uid didn't work, try by email
          if (!candidate && nurse.email) {
            candidate = await User.findOne({ email: nurse.email });
            if (candidate) {
              resolvedReceiverId = String(candidate._id);
            }
          }
        }
        // If still not found, try by uid or email
        if (!candidate) {
          candidate = await User.findOne({
            $or: [ 
              { uid: receiverId }, 
              { email: receiverId }
            ]
          });
          if (candidate) {
            resolvedReceiverId = String(candidate._id);
          }
        }
      }
      
      if (!candidate) {
        return res.status(400).json({ success: false, message: 'Valid receiver not found' });
      }
    } else {
      const candidate = await User.findOne({
        $or: [ 
          { uid: receiverId }, 
          { email: receiverId },
          { _id: receiverId }
        ]
      });
      if (candidate) {
        resolvedReceiverId = String(candidate._id);
      } else {
        return res.status(400).json({ success: false, message: 'Valid receiver not found' });
      }
    }

    let currentUser = await User.findOne({ uid: req.user.uid });
    if (!currentUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Get nurse profile for hospital context
    let nurseProfile = await Nurse.findOne({ userId: currentUser._id });
    if (!nurseProfile) nurseProfile = await Nurse.findOne({ uid: currentUser.uid });
    if (!nurseProfile && currentUser.email) nurseProfile = await Nurse.findOne({ email: currentUser.email });
    // Ensure current user has a display name for UI (populate from nurse profile if missing)
    try {
      const needsNameUpdate = !currentUser.fullName || currentUser.fullName === 'Unknown User';
      if (needsNameUpdate && nurseProfile?.fullName) {
        currentUser.fullName = nurseProfile.fullName;
        await currentUser.save();
      }
    } catch (nameErr) {
      console.log('⚠️ NurseTalk: Could not update user fullName:', nameErr.message);
    }

    // Determine hospital context for the message
    let resolvedHospitalId = null;
    let hospitalAffiliation = null;
    
    // Try to get hospital ID from affiliatedHospitals first
    if (Array.isArray(nurseProfile.affiliatedHospitals) && nurseProfile.affiliatedHospitals.length > 0) {
      const activeHospital = nurseProfile.affiliatedHospitals.find(h => h.isActive !== false) || nurseProfile.affiliatedHospitals[0];
      resolvedHospitalId = activeHospital.hospitalId;
    }
    
    // Fallback to hospitalAffiliation if no hospitalId found
    if (!resolvedHospitalId && nurseProfile.hospitalAffiliation) {
      hospitalAffiliation = nurseProfile.hospitalAffiliation;
      // Try to find hospital by name to get its ID
      const Hospital = require('../models/Hospital');
      const hospital = await Hospital.findOne({ name: nurseProfile.hospitalAffiliation });
      if (hospital) {
        resolvedHospitalId = hospital._id;
      }
    }
    
    if (!nurseProfile || (!resolvedHospitalId && !hospitalAffiliation)) {
      return res.status(404).json({ success: false, message: 'Nurse hospital not found' });
    }

    const nurseTalk = new NurseTalk({
      message,
      messageType,
      senderId: currentUser._id,
      receiverId: resolvedReceiverId,
      hospitalId: resolvedHospitalId,
      hospitalAffiliation: hospitalAffiliation,
      patientArcId,
      patientName,
      status: 'sent',
      createdAt: new Date()
    });

    console.log('💾 NurseTalk: Saving message with data:', {
      senderId: currentUser._id,
      receiverId: resolvedReceiverId,
      hospitalId: resolvedHospitalId,
      hospitalAffiliation,
      messageType
    });
    console.log('💾 NurseTalk: Current user details for sending:', {
      _id: currentUser._id,
      fullName: currentUser.fullName,
      email: currentUser.email,
      uid: currentUser.uid
    });
    console.log('💾 NurseTalk: Receiver details for sending:', {
      original: receiverId,
      resolved: resolvedReceiverId
    });

    await nurseTalk.save();
    console.log('✅ NurseTalk: Message saved with ID:', nurseTalk._id);

    // Populate sender details
    await nurseTalk.populate([
      { path: 'senderId', select: 'fullName email' },
      { path: 'receiverId', select: 'fullName email' },
      { path: 'hospitalId', select: 'name' }
    ]);

    // Update sender's presence after sending message - try multiple approaches
    try {
      const currentUser = await User.findOne({ uid: req.user.uid });
      if (currentUser) {
        // Try by userId first
        let updated = await Nurse.findOneAndUpdate(
          { userId: currentUser._id },
          { lastSeen: new Date() },
          { upsert: true }
        );
        
        // Try by uid if not found
        if (!updated) {
          updated = await Nurse.findOneAndUpdate(
            { uid: req.user.uid },
            { lastSeen: new Date() },
            { upsert: true }
          );
        }
        
        // Try by email if still not found
        if (!updated && currentUser.email) {
          updated = await Nurse.findOneAndUpdate(
            { email: currentUser.email },
            { lastSeen: new Date() },
            { upsert: true }
          );
        }
      }
    } catch (presenceError) {
      console.log('⚠️ Could not update presence after sending message:', presenceError.message);
    }

    console.log('📤 NurseTalk: Message sent successfully from', nurseTalk.senderId?.fullName, 'to', nurseTalk.receiverId?.fullName);
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

    console.log('💬 NurseTalk: Getting messages for receiverId:', receiverId);
    
    const currentUser = await User.findOne({ uid: req.user.uid });
    if (!currentUser) {
      console.log('❌ NurseTalk: Current user not found for UID:', req.user.uid);
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    console.log('👤 NurseTalk: Current user:', currentUser.fullName, 'ID:', currentUser._id);

    // Resolve receiverId to ObjectId - same logic as sendMessage
    const mongoose = require('mongoose');
    let resolvedReceiverId = receiverId;
    
    
    // If it's already a valid ObjectId, try to find the corresponding User
    if (mongoose.Types.ObjectId.isValid(receiverId)) {
      // First try to find User by _id
      let candidate = await User.findById(receiverId);
      if (candidate) {
        resolvedReceiverId = String(candidate._id);
      } else {
        // Try to find User by Nurse model ID (if receiverId is a Nurse _id)
        const nurse = await Nurse.findById(receiverId);
        if (nurse) {
          
          // Try multiple ways to find the corresponding User
          if (nurse.userId) {
            candidate = await User.findById(nurse.userId);
            if (candidate) {
              resolvedReceiverId = String(candidate._id);
            }
          }
          
          // If userId didn't work, try by uid
          if (!candidate && nurse.uid) {
            candidate = await User.findOne({ uid: nurse.uid });
            if (candidate) {
              resolvedReceiverId = String(candidate._id);
            }
          }
          
          // If uid didn't work, try by email
          if (!candidate && nurse.email) {
            candidate = await User.findOne({ email: nurse.email });
            if (candidate) {
              resolvedReceiverId = String(candidate._id);
            }
          }
        }
        // If still not found, try by uid or email
        if (!candidate) {
          candidate = await User.findOne({
            $or: [ 
              { uid: receiverId }, 
              { email: receiverId }
            ]
          });
          if (candidate) {
            resolvedReceiverId = String(candidate._id);
          }
        }
      }
      
      if (!candidate) {
        return res.status(400).json({ success: false, message: 'Receiver not found' });
      }
    } else {
      // Try to find by uid, email, or _id
      const candidate = await User.findOne({
        $or: [ 
          { uid: receiverId }, 
          { email: receiverId },
          { _id: receiverId }
        ]
      });
      if (candidate) {
        resolvedReceiverId = String(candidate._id);
      } else {
        return res.status(400).json({ success: false, message: 'Receiver not found' });
      }
    }

    const currentIdStr = String(currentUser._id);
    const receiverIdStr = String(resolvedReceiverId);

    console.log('💬 NurseTalk: Searching messages between:', currentIdStr, 'and', receiverIdStr);
    console.log('💬 NurseTalk: Current user details:', {
      _id: currentUser._id,
      fullName: currentUser.fullName,
      email: currentUser.email,
      uid: currentUser.uid
    });
    console.log('💬 NurseTalk: Receiver ID details:', {
      original: receiverId,
      resolved: resolvedReceiverId,
      currentIdStr: currentIdStr,
      receiverIdStr: receiverIdStr
    });

    // Only fetch direct chat messages here; handover is shown in its own tab
    const messages = await NurseTalk.find({
      messageType: 'chat',
      $or: [
        // Correct normalized ObjectId pairs
        { senderId: currentUser._id, receiverId: resolvedReceiverId },
        { senderId: resolvedReceiverId, receiverId: currentUser._id },
        // Legacy variants where one or both ids may have been saved as strings
        { senderId: currentIdStr, receiverId: resolvedReceiverId },
        { senderId: resolvedReceiverId, receiverId: currentIdStr },
        { senderId: currentUser._id, receiverId: receiverIdStr },
        { senderId: receiverIdStr, receiverId: currentUser._id },
        { senderId: currentIdStr, receiverId: receiverIdStr },
        { senderId: receiverIdStr, receiverId: currentIdStr },
      ]
    })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('senderId', 'fullName email uid')
    .populate('receiverId', 'fullName email uid')
    .populate('hospitalId', 'name');

    console.log('💬 NurseTalk: Found', messages.length, 'messages');
    
    // Check if populate worked by looking at the first message
    if (messages.length > 0) {
      const firstMsg = messages[0];
      console.log('🔍 NurseTalk: First message populate check:');
      console.log('  - senderId type:', typeof firstMsg.senderId);
      console.log('  - senderId value:', firstMsg.senderId);
      console.log('  - receiverId type:', typeof firstMsg.receiverId);
      console.log('  - receiverId value:', firstMsg.receiverId);
      
      // Check if senderId is populated (should be an object with fullName)
      if (firstMsg.senderId && typeof firstMsg.senderId === 'object' && firstMsg.senderId.fullName) {
        console.log('✅ SenderId is properly populated:', firstMsg.senderId.fullName);
      } else {
        console.log('❌ SenderId is NOT populated, it is:', firstMsg.senderId);
      }
      
      // Check if receiverId is populated
      if (firstMsg.receiverId && typeof firstMsg.receiverId === 'object' && firstMsg.receiverId.fullName) {
        console.log('✅ ReceiverId is properly populated:', firstMsg.receiverId.fullName);
      } else {
        console.log('❌ ReceiverId is NOT populated, it is:', firstMsg.receiverId);
      }
    }
    
    // Log first few messages for debugging
    messages.slice(0, 3).forEach((msg, i) => {
      console.log(`💬 Message ${i + 1}:`, {
        sender: msg.senderId?.fullName || 'Unknown',
        receiver: msg.receiverId?.fullName || 'Unknown',
        message: msg.message?.substring(0, 50) + '...',
        createdAt: msg.createdAt
      });
    });

    // If populate didn't work, manually fetch user details
    const processedMessages = [];
    for (const msg of messages.reverse()) {
      let processedMsg = msg.toObject();
      
      // If senderId is not populated (still an ObjectId), fetch user details
      if (msg.senderId && typeof msg.senderId === 'object' && msg.senderId._id && !msg.senderId.fullName) {
        const senderUser = await User.findById(msg.senderId._id).select('fullName email uid');
        if (senderUser) {
          processedMsg.senderId = {
            _id: senderUser._id,
            fullName: senderUser.fullName,
            email: senderUser.email,
            uid: senderUser.uid
          };
        }
      }
      
      // If receiverId is not populated, fetch user details
      if (msg.receiverId && typeof msg.receiverId === 'object' && msg.receiverId._id && !msg.receiverId.fullName) {
        const receiverUser = await User.findById(msg.receiverId._id).select('fullName email uid');
        if (receiverUser) {
          processedMsg.receiverId = {
            _id: receiverUser._id,
            fullName: receiverUser.fullName,
            email: receiverUser.email,
            uid: receiverUser.uid
          };
        }
      }
      
      processedMessages.push(processedMsg);
    }
    
    res.json({ success: true, data: processedMessages });
  } catch (error) {
    console.error('❌ Error fetching messages:', error);
    console.error('❌ Error stack:', error.stack);
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
            fullName: nurse.fullName || (req.user.email ? req.user.email.split('@')[0] : 'Nurse'),
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
    
    // Determine hospital context for filtering handover notes
    let hospitalFilter = {};
    
    // Try to get hospital ID from affiliatedHospitals first
    if (Array.isArray(nurseProfile.affiliatedHospitals) && nurseProfile.affiliatedHospitals.length > 0) {
      const activeHospital = nurseProfile.affiliatedHospitals.find(h => h.isActive !== false) || nurseProfile.affiliatedHospitals[0];
      if (activeHospital.hospitalId) {
        hospitalFilter.hospitalId = activeHospital.hospitalId;
        console.log('🏥 NurseTalk: Filtering handover by hospitalId:', activeHospital.hospitalId);
      }
    }
    
    // Fallback to hospitalAffiliation if no hospitalId found
    if (!hospitalFilter.hospitalId && nurseProfile.hospitalAffiliation) {
      // Find hospital by name to get its ID
      const Hospital = require('../models/Hospital');
      const hospital = await Hospital.findOne({ name: nurseProfile.hospitalAffiliation });
      if (hospital) {
        hospitalFilter.hospitalId = hospital._id;
        console.log('🏥 NurseTalk: Filtering handover by hospital name:', nurseProfile.hospitalAffiliation, 'ID:', hospital._id);
      } else {
        // If hospital not found by name, filter by hospitalAffiliation string
        hospitalFilter.hospitalAffiliation = nurseProfile.hospitalAffiliation;
        console.log('🏥 NurseTalk: Filtering handover by hospitalAffiliation string:', nurseProfile.hospitalAffiliation);
      }
    }
    
    if (!hospitalFilter.hospitalId && !hospitalFilter.hospitalAffiliation) {
      console.log('❌ NurseTalk: No hospital context found for handover filtering');
      return res.status(404).json({ success: false, message: 'Nurse hospital not found' });
    }

    // Get handover notes filtered by hospital context
    const handoverNotes = await NurseTalk.find({
      messageType: 'handover',
      ...hospitalFilter
    })
    .sort({ createdAt: -1 })
    .limit(20)
    .populate('senderId', 'fullName email')
    .populate('receiverId', 'fullName email')
    .populate('hospitalId', 'name');

    console.log('📝 NurseTalk: Found', handoverNotes.length, 'handover notes for hospital context');
    
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

// Ping presence (update lastSeen)
const pingPresence = async (req, res) => {
  try {
    console.log('🏓 NurseTalk: Ping presence for UID:', req.user.uid);
    
    const currentUser = await User.findOne({ uid: req.user.uid });
    if (!currentUser) {
      console.log('❌ NurseTalk: User not found for presence ping UID:', req.user.uid);
      return res.status(404).json({ success: false, message: 'User not found' });
    }


    // Update nurse's lastSeen timestamp - try multiple approaches
    const update = { lastSeen: new Date() };
    let updated = null;
    
    // Try by userId first
    updated = await Nurse.findOneAndUpdate(
      { userId: currentUser._id },
      update,
      { new: true }
    );
    
    // Try by uid if not found
    if (!updated) {
      updated = await Nurse.findOneAndUpdate(
        { uid: currentUser.uid }, 
        update, 
        { new: true }
      );
    }
    
    // Try by email if still not found
    if (!updated && currentUser.email) {
      updated = await Nurse.findOneAndUpdate(
        { email: currentUser.email }, 
        update, 
        { new: true }
      );
    }
    
    // If still not found, create a minimal nurse profile
    if (!updated) {
      try {
        updated = await Nurse.create({
          uid: currentUser.uid,
          fullName: currentUser.fullName || 'Unknown Nurse',
          email: currentUser.email || `${currentUser.uid}@temp.com`,
          mobileNumber: '0000000000',
          hospitalAffiliation: 'Default Hospital',
          qualification: 'RN',
          isApproved: true,
          lastSeen: new Date(),
          createdAt: new Date()
        });
        console.log('✅ NurseTalk: Created minimal nurse profile for presence');
      } catch (createError) {
        console.log('⚠️ NurseTalk: Could not create nurse profile for presence:', createError.message);
      }
    }

    if (updated) {
      console.log('✅ NurseTalk: Presence updated successfully for:', updated.fullName);
    } else {
      console.log('❌ NurseTalk: Failed to update presence');
    }

    res.json({ success: true, message: 'Presence updated' });
  } catch (error) {
    console.error('❌ Error updating presence:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ success: false, message: 'Failed to update presence', error: error.message });
  }
};

// Set typing status for a short period (7s)
const setTyping = async (req, res) => {
  try {
    let { receiverId } = req.body || {};
    const currentUser = await User.findOne({ uid: req.user.uid });
    if (!currentUser) return res.status(404).json({ success: false, message: 'User not found' });

    // Resolve receiver similar to send flow
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(receiverId)) {
      const candidate = await User.findOne({ $or: [{ uid: receiverId }, { email: receiverId }] });
      if (candidate) receiverId = String(candidate._id);
    }
    const key = `${String(currentUser._id)}->${String(receiverId)}`;
    typingState.set(key, Date.now());
    return res.json({ success: true });
  } catch (e) {
    console.error('Error setTyping:', e);
    return res.status(500).json({ success: false, message: 'Failed to set typing' });
  }
};

// Get peer typing status (is the other user typing to me?)
const getTypingStatus = async (req, res) => {
  try {
    let { receiverId } = req.params; // here receiverId = other nurse id I am viewing
    const currentUser = await User.findOne({ uid: req.user.uid });
    if (!currentUser) return res.status(404).json({ success: false, message: 'User not found' });

    const key = `${String(receiverId)}->${String(currentUser._id)}`;
    const ts = typingState.get(key);
    const isTyping = ts && (Date.now() - ts) < 7000; // 7 seconds staleness
    if (!isTyping && ts) typingState.delete(key);
    return res.json({ success: true, typing: !!isTyping });
  } catch (e) {
    console.error('Error getTypingStatus:', e);
    return res.status(500).json({ success: false, message: 'Failed to get typing status' });
  }
};

module.exports = {
  getHospitalNurses,
  sendMessage,
  getMessages,
  getHandoverNotes,
  markAsRead,
  getUnreadCount,
  pingPresence,
  setTyping,
  getTypingStatus
};
