const mongoose = require('mongoose');

const patientVitalSchema = new mongoose.Schema(
  {
    patientId: { type: String, required: true, index: true },
    patientName: { type: String },
    nurseId: { type: String, required: true, index: true },
    hospitalId: { type: String },
    assignmentId: { type: String },
    // Basic vitals (required)
    temperature: { type: Number, required: true }, // Celsius
    heartRate: { type: Number, required: true }, // bpm
    respiratoryRate: { type: Number, required: true }, // breaths/min
    systolic: { type: Number, required: true },
    diastolic: { type: Number, required: true },
    spo2: { type: Number, required: true },
    weightKg: { type: Number, required: true },
    heightCm: { type: Number, required: true },
    bmi: { type: Number },
    // Extended vitals (optional)
    glucoseRandom: { type: Number },
    glucoseFasting: { type: Number },
    glucosePostMeal: { type: Number },
    painLevel: { type: Number, min: 0, max: 10 },
    menstrualNote: { type: String },
    hydrationMl: { type: Number },
    sleepHours: { type: Number },
    sleepQuality: { type: String },
    // Critical monitoring (optional)
    ecgSummary: { type: String },
    ventilatorFlow: { type: String },
    infusionNotes: { type: String },
    gcsScore: { type: Number },
    neuroNotes: { type: String },
    notes: { type: String },
    recordedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PatientVital', patientVitalSchema);


