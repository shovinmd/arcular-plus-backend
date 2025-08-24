const Staff = require('../models/Staff');
const { admin } = require('../firebase'); // Firebase Admin SDK

// Create ARC staff (super admin only)
exports.createStaff = async (req, res) => {
  try {
    const { email, name, password, role } = req.body;
    // 1. Create user in Firebase Auth
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: name,
    });
    // 2. Save staff profile in MongoDB
    const staff = new Staff({
      firebaseUid: userRecord.uid,
      email,
      name,
      role: role || 'arcstaff',
    });
    await staff.save();
    res.status(201).json({ message: 'Staff created', staff });
  } catch (err) {
    console.error('Error creating staff:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get staff profile by Firebase UID
exports.getStaffProfile = async (req, res) => {
  try {
    const { firebaseUid } = req.params;
    const staff = await Staff.findOne({ firebaseUid });
    if (!staff) return res.status(404).json({ error: 'Staff not found' });
    res.json(staff);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// List all staff (super admin only)
exports.listStaff = async (req, res) => {
  try {
    const staffList = await Staff.find();
    res.json(staffList);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update staff profile (name/role)
exports.updateStaffProfile = async (req, res) => {
  try {
    const { firebaseUid } = req.params;
    const { name, role } = req.body;
    const staff = await Staff.findOneAndUpdate(
      { firebaseUid },
      { $set: { name, role } },
      { new: true }
    );
    if (!staff) return res.status(404).json({ error: 'Staff not found' });
    res.json(staff);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete staff (super admin only)
exports.deleteStaff = async (req, res) => {
  try {
    const { firebaseUid } = req.params;
    // Remove from Firebase Auth
    await admin.auth().deleteUser(firebaseUid);
    // Remove from MongoDB
    await Staff.findOneAndDelete({ firebaseUid });
    res.json({ message: 'Staff deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}; 