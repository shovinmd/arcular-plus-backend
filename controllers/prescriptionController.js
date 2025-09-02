const Prescription = require('../models/Prescription');

// Return prescriptions for a patient (only doctor-prescribed)
exports.getByUserAndStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.query;
    const query = { userId };
    if (status) query.status = status;
    const items = await Prescription.find(query).sort({ prescriptionDate: -1 });
    res.json({ success: true, data: items });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

// Convert a prescription into medicine entries (structure only; actual creation handled on client/medication routes)
exports.transformToMedicines = async (req, res) => {
  try {
    const { id } = req.params;
    const presc = await Prescription.findById(id);
    if (!presc) {
      return res.status(404).json({ success: false, error: 'Prescription not found' });
    }
    const medicines = (presc.medications || []).map(m => ({
      name: m.name,
      dosage: m.dose,
      frequency: m.frequency,
      duration: m.duration,
      times: m.times || [],
      instructions: m.instructions || null,
    }));
    res.json({ success: true, data: medicines });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};


