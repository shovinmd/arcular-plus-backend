const LabReport = require('../models/LabReport');

exports.getLabReportsByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const reports = await LabReport.find({ userId });
    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getLabReportById = async (req, res) => {
  try {
    const { id } = req.params;
    const report = await LabReport.findById(id);
    if (!report) return res.status(404).json({ error: 'Lab report not found' });
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.uploadLabReport = async (req, res) => {
  try {
    const report = new LabReport(req.body);
    await report.save();
    res.status(201).json(report);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.updateLabReport = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await LabReport.findByIdAndUpdate(id, req.body, { new: true });
    if (!updated) return res.status(404).json({ error: 'Lab report not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.deleteLabReport = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await LabReport.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ error: 'Lab report not found' });
    res.json({ message: 'Lab report deleted' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}; 