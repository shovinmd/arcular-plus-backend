const User = require('../models/User');

exports.getUserByQrId = async (req, res) => {
  try {
    const { qrId } = req.params;
    const user = await User.findOne({ healthQrId: qrId });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}; 