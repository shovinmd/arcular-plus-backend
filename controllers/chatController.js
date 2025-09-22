const ChatMessage = require('../models/ChatMessage');
const User = require('../models/User');

// Send a chat message (doctor or nurse)
exports.sendMessage = async (req, res) => {
  try {
    const { message, patientArcId, priority = 'Low', senderRole } = req.body;
    if (!message || !patientArcId || !senderRole) {
      return res.status(400).json({ success: false, message: 'message, patientArcId, senderRole required' });
    }

    // resolve current user ObjectId
    let currentUser = null;
    if (req.user && req.user.uid) currentUser = await User.findOne({ uid: req.user.uid });
    if (!currentUser) return res.status(401).json({ success: false, message: 'User not found' });

    // resolve patientId by ARC
    let patient = await User.findOne({ $or: [{ healthQrId: patientArcId }, { arcId: patientArcId }] });

    // resolve doctorId/nurseId based on role
    let doctorId = undefined;
    let nurseId = undefined;
    if (senderRole === 'doctor') {
      doctorId = currentUser._id;
    } else if (senderRole === 'nurse') {
      nurseId = currentUser._id;
    } else {
      return res.status(400).json({ success: false, message: 'Invalid senderRole' });
    }

    const chat = await ChatMessage.create({
      message,
      patientArcId,
      patientId: patient ? patient._id : undefined,
      doctorId,
      nurseId,
      senderRole,
      priority,
      status: 'sent',
      createdBy: currentUser._id,
    });

    await chat.populate([
      { path: 'patientId', select: 'fullName arcId healthQrId' },
      { path: 'doctorId', select: 'fullName' },
      { path: 'nurseId', select: 'fullName' },
      { path: 'createdBy', select: 'fullName uid' },
    ]);

    res.status(201).json({ success: true, data: chat });
  } catch (e) {
    console.error('sendMessage error', e);
    res.status(500).json({ success: false, message: 'Failed to send message', error: e.message });
  }
};

// Get chat by patient ARC ID
exports.getByPatientArcId = async (req, res) => {
  try {
    const { arcId } = req.params;
    const limit = Math.min(parseInt(req.query.limit || '200', 10), 500);

    const chats = await ChatMessage.find({ patientArcId: arcId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('patientId', 'fullName arcId healthQrId')
      .populate('doctorId', 'fullName')
      .populate('nurseId', 'fullName')
      .populate('createdBy', 'fullName uid');

    res.json({ success: true, data: chats });
  } catch (e) {
    console.error('getByPatientArcId error', e);
    res.status(500).json({ success: false, message: 'Failed to fetch chats', error: e.message });
  }
};

// Mark message read
exports.markRead = async (req, res) => {
  try {
    const { id } = req.params;
    const chat = await ChatMessage.findById(id);
    if (!chat) return res.status(404).json({ success: false, message: 'Message not found' });

    chat.status = 'read';
    await chat.save();

    res.json({ success: true, data: chat });
  } catch (e) {
    console.error('markRead error', e);
    res.status(500).json({ success: false, message: 'Failed to update message', error: e.message });
  }
};
