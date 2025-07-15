const SOS = require('../models/SOS');

exports.sendSOS = async (req, res) => {
  try {
    const sos = new SOS(req.body);
    await sos.save();
    res.status(201).json(sos);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getSOSByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const records = await SOS.find({ userId });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}; 