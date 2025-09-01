const express = require('express');
const router = express.Router();
const firebaseAuthMiddleware = require('../middleware/firebaseAuthMiddleware');
const User = require('../models/User');
const Appointment = require('../models/Appointment');
const Medication = require('../models/Medication');
const LabReport = require('../models/LabReport');
const MenstrualCycle = require('../models/MenstrualCycle');
const Prescription = require('../models/Prescription');

// Get comprehensive health history for a user
router.get('/:userId', firebaseAuthMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const { type, limit = 50 } = req.query;

    // Get user info to check gender
    const user = await User.findOne({ uid: userId });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const healthHistory = {
      user: {
        fullName: user.fullName,
        gender: user.gender,
        dateOfBirth: user.dateOfBirth,
        bloodGroup: user.bloodGroup
      },
      timeline: [],
      appointments: [],
      medications: [],
      reports: [],
      prescriptions: []
    };

    // Add menstrual data only for female users
    if (user.gender && user.gender.toLowerCase() === 'female') {
      const menstrualData = await MenstrualCycle.findByUser(userId);
      healthHistory.menstrual = menstrualData;
    }

    // Get appointments
    const appointments = await Appointment.find({ userId })
      .sort({ appointmentDate: -1 })
      .limit(parseInt(limit));

    healthHistory.appointments = appointments.map(appointment => ({
      id: appointment._id,
      type: 'appointment',
      title: `Appointment with ${appointment.doctorName || 'Doctor'}`,
      description: appointment.reason || 'Medical consultation',
      date: appointment.appointmentDate,
      status: appointment.status,
      doctor: appointment.doctorName,
      specialty: appointment.specialty,
      hospital: appointment.hospitalName,
      notes: appointment.notes
    }));

    // Get medications
    const medications = await Medication.find({ userId })
      .sort({ prescribedDate: -1 })
      .limit(parseInt(limit));

    healthHistory.medications = medications.map(medication => ({
      id: medication._id,
      type: 'medication',
      title: `Prescribed ${medication.name}`,
      description: `${medication.dosage} - ${medication.frequency}`,
      date: medication.prescribedDate,
      status: medication.status,
      name: medication.name,
      dosage: medication.dosage,
      frequency: medication.frequency,
      doctor: medication.doctorName,
      notes: medication.notes
    }));

    // Get lab reports
    const reports = await LabReport.find({ userId })
      .sort({ reportDate: -1 })
      .limit(parseInt(limit));

    healthHistory.reports = reports.map(report => ({
      id: report._id,
      type: 'report',
      title: `${report.testName} Report`,
      description: report.testType || 'Laboratory test',
      date: report.reportDate,
      status: report.status || 'completed',
      testName: report.testName,
      testType: report.testType,
      lab: report.labName,
      result: report.result,
      notes: report.notes
    }));

    // Get prescriptions
    const prescriptions = await Prescription.find({ userId })
      .sort({ prescriptionDate: -1 })
      .limit(parseInt(limit));

    healthHistory.prescriptions = prescriptions.map(prescription => ({
      id: prescription._id,
      type: 'prescription',
      title: `Prescription by ${prescription.doctorName}`,
      description: prescription.diagnosis,
      date: prescription.prescriptionDate,
      status: prescription.status,
      doctor: prescription.doctorName,
      specialty: prescription.doctorSpecialty,
      diagnosis: prescription.diagnosis,
      medications: prescription.medications,
      instructions: prescription.instructions
    }));

    // Create timeline by combining all events
    healthHistory.timeline = [
      ...healthHistory.appointments,
      ...healthHistory.medications,
      ...healthHistory.reports,
      ...healthHistory.prescriptions
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    // Filter by type if specified
    if (type && type !== 'all') {
      healthHistory.timeline = healthHistory.timeline.filter(item => item.type === type);
    }

    res.json({
      success: true,
      data: healthHistory,
      count: healthHistory.timeline.length
    });
  } catch (error) {
    console.error('Error fetching health history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch health history'
    });
  }
});

// Get menstrual cycle history for female users
router.get('/:userId/menstrual', firebaseAuthMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;

    // Check if user is female
    const user = await User.findOne({ uid: userId });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    if (!user.gender || user.gender.toLowerCase() !== 'female') {
      return res.status(400).json({
        success: false,
        error: 'Menstrual tracking is only available for female users'
      });
    }

    const menstrualData = await MenstrualCycle.findByUser(userId);
    
    if (!menstrualData) {
      return res.json({
        success: true,
        data: {
          cycleHistory: [],
          ovulationData: [],
          symptoms: [],
          predictions: {
            nextPeriod: null,
            ovulationDay: null,
            fertileWindow: []
          }
        }
      });
    }

    const formattedData = {
      cycleHistory: menstrualData.cycleHistory || [],
      ovulationData: menstrualData.ovulationData || [],
      symptoms: menstrualData.symptoms || [],
      predictions: {
        nextPeriod: menstrualData.nextPeriod,
        ovulationDay: menstrualData.ovulationDay,
        fertileWindow: menstrualData.fertileWindow || []
      },
      settings: {
        cycleLength: menstrualData.cycleLength,
        periodDuration: menstrualData.periodDuration,
        reminders: {
          nextPeriod: menstrualData.remindNextPeriod,
          fertileWindow: menstrualData.remindFertileWindow,
          ovulation: menstrualData.remindOvulation,
          time: menstrualData.reminderTime
        }
      }
    };

    res.json({
      success: true,
      data: formattedData
    });
  } catch (error) {
    console.error('Error fetching menstrual data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch menstrual data'
    });
  }
});

// Add menstrual cycle entry
router.post('/:userId/menstrual/cycle', firebaseAuthMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate, flow, symptoms, notes, mood, energy } = req.body;

    // Check if user is female
    const user = await User.findOne({ uid: userId });
    if (!user || !user.gender || user.gender.toLowerCase() !== 'female') {
      return res.status(400).json({
        success: false,
        error: 'Menstrual tracking is only available for female users'
      });
    }

    let menstrualData = await MenstrualCycle.findByUser(userId);
    
    if (!menstrualData) {
      menstrualData = new MenstrualCycle({
        userId,
        lastPeriodStartDate: startDate,
        cycleLength: 28,
        periodDuration: 5
      });
    }

    const cycleEntry = {
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      flow: flow || 'medium',
      symptoms: symptoms || [],
      notes: notes || '',
      mood: mood || '',
      energy: energy || 'medium'
    };

    await menstrualData.addCycleEntry(cycleEntry);

    res.json({
      success: true,
      data: menstrualData,
      message: 'Cycle entry added successfully'
    });
  } catch (error) {
    console.error('Error adding cycle entry:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add cycle entry'
    });
  }
});

// Add ovulation data
router.post('/:userId/menstrual/ovulation', firebaseAuthMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const { date, cervicalMucus, basalTemperature, lhSurge, notes } = req.body;

    // Check if user is female
    const user = await User.findOne({ uid: userId });
    if (!user || !user.gender || user.gender.toLowerCase() !== 'female') {
      return res.status(400).json({
        success: false,
        error: 'Menstrual tracking is only available for female users'
      });
    }

    let menstrualData = await MenstrualCycle.findByUser(userId);
    
    if (!menstrualData) {
      menstrualData = new MenstrualCycle({ userId });
    }

    const ovulationEntry = {
      date: new Date(date),
      cervicalMucus: cervicalMucus || '',
      basalTemperature: basalTemperature || null,
      lhSurge: lhSurge || false,
      notes: notes || ''
    };

    await menstrualData.addOvulationData(ovulationEntry);

    res.json({
      success: true,
      data: menstrualData,
      message: 'Ovulation data added successfully'
    });
  } catch (error) {
    console.error('Error adding ovulation data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add ovulation data'
    });
  }
});

// Add symptom entry
router.post('/:userId/menstrual/symptoms', firebaseAuthMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const { date, type, symptoms, severity, notes } = req.body;

    // Check if user is female
    const user = await User.findOne({ uid: userId });
    if (!user || !user.gender || user.gender.toLowerCase() !== 'female') {
      return res.status(400).json({
        success: false,
        error: 'Menstrual tracking is only available for female users'
      });
    }

    let menstrualData = await MenstrualCycle.findByUser(userId);
    
    if (!menstrualData) {
      menstrualData = new MenstrualCycle({ userId });
    }

    const symptomEntry = {
      date: new Date(date),
      type: type || 'other',
      symptoms: symptoms || [],
      severity: severity || 'mild',
      notes: notes || ''
    };

    await menstrualData.addSymptom(symptomEntry);

    res.json({
      success: true,
      data: menstrualData,
      message: 'Symptom entry added successfully'
    });
  } catch (error) {
    console.error('Error adding symptom entry:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add symptom entry'
    });
  }
});

// Get health history statistics
router.get('/:userId/stats', firebaseAuthMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;

    const [appointments, medications, reports, prescriptions] = await Promise.all([
      Appointment.countDocuments({ userId }),
      Medication.countDocuments({ userId }),
      LabReport.countDocuments({ userId }),
      Prescription.countDocuments({ userId })
    ]);

    const stats = {
      appointments,
      medications,
      reports,
      prescriptions,
      total: appointments + medications + reports + prescriptions
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching health history stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch health history statistics'
    });
  }
});

module.exports = router;
