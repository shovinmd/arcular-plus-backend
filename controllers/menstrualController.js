const MenstrualCycle = require('../models/MenstrualCycle');

exports.getMenstrualByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const data = await MenstrualCycle.find({ userId });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createMenstrual = async (req, res) => {
  try {
    // Check if user already has menstrual cycle data
    const existingData = await MenstrualCycle.findOne({ userId: req.body.userId });
    
    if (existingData) {
      // Update existing data
      const updated = await MenstrualCycle.findByIdAndUpdate(
        existingData._id, 
        req.body, 
        { new: true }
      );
      res.json(updated);
    } else {
      // Create new entry
      const entry = new MenstrualCycle(req.body);
      await entry.save();
      res.status(201).json(entry);
    }
  } catch (err) {
    console.error('❌ Error in createMenstrual:', err);
    res.status(400).json({ error: err.message });
  }
};

exports.updateMenstrual = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await MenstrualCycle.findByIdAndUpdate(id, req.body, { new: true });
    if (!updated) return res.status(404).json({ error: 'Entry not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}; 