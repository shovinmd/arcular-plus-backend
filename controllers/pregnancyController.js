const PregnancyTracking = require('../models/PregnancyTracking');

exports.getPregnancyByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const data = await PregnancyTracking.find({ userId });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createPregnancy = async (req, res) => {
  try {
    const entry = new PregnancyTracking(req.body);
    await entry.save();
    res.status(201).json(entry);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.updatePregnancy = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await PregnancyTracking.findByIdAndUpdate(id, req.body, { new: true });
    if (!updated) return res.status(404).json({ error: 'Entry not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}; 