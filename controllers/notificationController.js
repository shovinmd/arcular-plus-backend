const Notification = require('../models/Notification');

exports.getNotificationsByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const notifications = await Notification.find({ userId });
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}; 