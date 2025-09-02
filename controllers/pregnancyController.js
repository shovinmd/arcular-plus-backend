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

// Get doctor's weekly notes for a user
exports.getWeeklyNotes = async (req, res) => {
  try {
    const { userId } = req.params;
    const { week } = req.query;
    const records = await PregnancyTracking.findOne({ userId }, { weeklyNotes: 1, _id: 0 });
    if (!records || !records.weeklyNotes) return res.json([]);
    if (week) {
      const w = parseInt(week);
      return res.json(records.weeklyNotes.filter(n => n.week === w));
    }
    res.json(records.weeklyNotes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Post/update doctor weekly note
exports.upsertWeeklyNote = async (req, res) => {
  try {
    const { userId } = req.params;
    const { week, title, content, postedBy } = req.body;
    if (!week) return res.status(400).json({ error: 'week is required' });
    const doc = await PregnancyTracking.findOneAndUpdate(
      { userId },
      { $pull: { weeklyNotes: { week } } },
      { new: true, upsert: true }
    );
    doc.weeklyNotes.push({ week, title, content, postedBy });
    await doc.save();
    res.json({ success: true, data: doc.weeklyNotes.filter(n => n.week === week) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};