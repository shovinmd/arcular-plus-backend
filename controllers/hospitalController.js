const User = require('../models/User');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');

const REQUIRED_HOSPITAL_FIELDS = [
  'fullName', 'email', 'mobileNumber', 'hospitalName', 'registrationNumber', 'hospitalType', 'hospitalAddress', 'hospitalEmail', 'hospitalPhone', 'numberOfBeds', 'hasPharmacy', 'hasLab', 'departments'
];

exports.registerHospital = async (req, res) => {
  try {
    const firebaseUser = req.user; // set by auth middleware
    if (!firebaseUser || !firebaseUser.uid) {
      return res.status(400).json({ error: 'Invalid Firebase user' });
    }
    // Validate required fields
    for (const field of REQUIRED_HOSPITAL_FIELDS) {
      if (!req.body[field]) {
        return res.status(400).json({ error: `Missing required field: ${field}` });
      }
    }
    let user = await User.findOne({ uid: firebaseUser.uid });
    if (!user) {
      // Generate Arc ID
      const arcId = 'ARC-' + uuidv4().slice(0, 8).toUpperCase();
      // Generate QR code (using Arc ID)
      const qrCode = await QRCode.toDataURL(arcId);
      user = new User({
        uid: firebaseUser.uid,
        ...req.body,
        type: 'hospital',
        arcId,
        qrCode,
        status: 'active',
        createdAt: new Date(),
      });
      await user.save();
    } else {
      Object.assign(user, req.body);
      user.type = 'hospital';
      if (!user.arcId) {
        user.arcId = 'ARC-' + uuidv4().slice(0, 8).toUpperCase();
      }
      if (!user.qrCode && user.arcId) {
        user.qrCode = await QRCode.toDataURL(user.arcId);
      }
      await user.save();
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getHospitalProfile = async (req, res) => {
  try {
    const { uid } = req.params;
    const user = await User.findOne({ uid, type: 'hospital' });
    if (!user) return res.status(404).json({ error: 'Hospital not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateHospitalProfile = async (req, res) => {
  try {
    const { uid } = req.params;
    const updateData = req.body;
    const user = await User.findOne({ uid, type: 'hospital' });
    if (!user) {
      return res.status(404).json({ error: 'Hospital not found' });
    }
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        user[key] = updateData[key];
      }
    });
    if (!user.arcId) {
      user.arcId = 'ARC-' + uuidv4().slice(0, 8).toUpperCase();
    }
    if (!user.qrCode && user.arcId) {
      user.qrCode = await QRCode.toDataURL(user.arcId);
    }
    await user.save();
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
exports.getDoctors = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.addDoctor = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.removeDoctor = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.getDepartments = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.addDepartment = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.removeDepartment = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.getAppointments = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.createAppointment = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.updateAppointment = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.getAdmissions = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.admitPatient = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.updateAdmission = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.getPharmacyItems = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.addPharmacyItem = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.updatePharmacyItem = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.removePharmacyItem = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.getLabTests = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.addLabTest = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.updateLabTest = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.removeLabTest = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.getQrRecords = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.getAnalytics = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.getReports = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.getChatMessages = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.sendChatMessage = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.getShifts = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.createShift = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.updateShift = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.deleteShift = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.getBilling = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.createBillingEntry = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.getDocuments = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.uploadDocument = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.getNotifications = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.updateSettings = async (req, res) => res.status(501).json({ error: 'Not implemented' });
exports.getAllHospitals = async (req, res) => {
  try {
    const hospitals = await User.find({ type: 'hospital' });
    res.json(hospitals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}; 