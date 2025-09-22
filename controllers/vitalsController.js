const PatientVital = require('../models/PatientVital');

// POST /api/vitals/record
const recordVitals = async (req, res) => {
  try {
    const firebaseUser = req.user;
    if (!firebaseUser || !firebaseUser.uid) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const body = req.body || {};
    const { patientId } = body;
    if (!patientId) {
      return res.status(400).json({ success: false, error: 'patientId is required' });
    }

    // Basic required fields
    const required = ['temperature', 'heartRate', 'respiratoryRate', 'systolic', 'diastolic', 'spo2', 'weightKg', 'heightCm'];
    for (const f of required) {
      if (body[f] === undefined || body[f] === null || body[f] === '') {
        return res.status(400).json({ success: false, error: `Missing required field: ${f}` });
      }
    }

    // Compute BMI
    let bmi = body.bmi;
    if (!bmi) {
      const hMeters = Number(body.heightCm) / 100;
      if (hMeters > 0) {
        bmi = Number(body.weightKg) / (hMeters * hMeters);
      }
    }

    const vital = await PatientVital.create({
      patientId: body.patientId,
      patientName: body.patientName,
      nurseId: firebaseUser.uid,
      hospitalId: body.hospitalId,
      assignmentId: body.assignmentId,
      temperature: body.temperature,
      heartRate: body.heartRate,
      respiratoryRate: body.respiratoryRate,
      systolic: body.systolic,
      diastolic: body.diastolic,
      spo2: body.spo2,
      weightKg: body.weightKg,
      heightCm: body.heightCm,
      bmi,
      glucoseRandom: body.glucoseRandom,
      glucoseFasting: body.glucoseFasting,
      glucosePostMeal: body.glucosePostMeal,
      painLevel: body.painLevel,
      menstrualNote: body.menstrualNote,
      hydrationMl: body.hydrationMl,
      sleepHours: body.sleepHours,
      sleepQuality: body.sleepQuality,
      ecgSummary: body.ecgSummary,
      ventilatorFlow: body.ventilatorFlow,
      infusionNotes: body.infusionNotes,
      gcsScore: body.gcsScore,
      neuroNotes: body.neuroNotes,
      notes: body.notes || '',
      recordedAt: new Date(),
    });

    return res.json({ success: true, message: 'Vitals recorded', data: vital });
  } catch (error) {
    console.error('Error recording vitals:', error);
    return res.status(500).json({ success: false, error: 'Failed to record vitals', details: error.message });
  }
};

// GET /api/vitals/patient/:patientId
const getVitalsForPatient = async (req, res) => {
  try {
    const { patientId } = req.params;
    const vitals = await PatientVital.find({ patientId }).sort({ recordedAt: -1 }).limit(100);
    return res.json({ success: true, data: vitals });
  } catch (error) {
    console.error('Error fetching vitals:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch vitals', details: error.message });
  }
};

module.exports = { recordVitals, getVitalsForPatient };


