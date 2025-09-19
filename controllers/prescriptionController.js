const Prescription = require('../models/Prescription');

// Helper function to generate default times based on frequency
function _generateDefaultTimes(frequency) {
  if (!frequency) return ['09:00']; // Default to morning if no frequency
  
  const freq = frequency.toLowerCase();
  
  if (freq.includes('once') || freq.includes('daily') || freq.includes('1')) {
    return ['09:00']; // Morning
  } else if (freq.includes('twice') || freq.includes('2')) {
    return ['09:00', '21:00']; // Morning and evening
  } else if (freq.includes('thrice') || freq.includes('three') || freq.includes('3')) {
    return ['09:00', '14:00', '21:00']; // Morning, afternoon, evening
  } else if (freq.includes('every') && freq.includes('4') && freq.includes('hour')) {
    return ['08:00', '12:00', '16:00', '20:00']; // Every 4 hours
  } else if (freq.includes('every') && freq.includes('6') && freq.includes('hour')) {
    return ['08:00', '14:00', '20:00']; // Every 6 hours
  } else if (freq.includes('every') && freq.includes('8') && freq.includes('hour')) {
    return ['08:00', '16:00', '00:00']; // Every 8 hours
  } else if (freq.includes('every') && freq.includes('12') && freq.includes('hour')) {
    return ['08:00', '20:00']; // Every 12 hours
  } else if (freq.includes('every') && freq.includes('hour')) {
    // Extract hour number if possible
    const hourMatch = freq.match(/(\d+)\s*hour/);
    if (hourMatch) {
      const hours = parseInt(hourMatch[1]);
      const times = [];
      for (let i = 0; i < 24; i += hours) {
        times.push(`${i.toString().padStart(2, '0')}:00`);
      }
      return times.slice(0, 6); // Limit to 6 times max
    }
    return ['09:00', '15:00', '21:00']; // Default 3 times
  } else {
    return ['09:00']; // Default to morning
  }
}

// Helper function to normalize frequency for validation
function _normalizeFrequency(frequency) {
  if (!frequency) return 'Once daily';
  
  const freq = frequency.toLowerCase();
  
  if (freq.includes('once') || freq.includes('daily') || freq.includes('1')) {
    return 'Once daily';
  } else if (freq.includes('twice') || freq.includes('2')) {
    return 'Twice daily';
  } else if (freq.includes('thrice') || freq.includes('three') || freq.includes('3')) {
    return 'Three times daily';
  } else if (freq.includes('every') && freq.includes('4') && freq.includes('hour')) {
    return 'Every 4 hours';
  } else if (freq.includes('every') && freq.includes('6') && freq.includes('hour')) {
    return 'Every 6 hours';
  } else if (freq.includes('every') && freq.includes('8') && freq.includes('hour')) {
    return 'Every 8 hours';
  } else if (freq.includes('every') && freq.includes('12') && freq.includes('hour')) {
    return 'Every 12 hours';
  } else {
    return 'Once daily'; // Default
  }
}

// Return prescriptions for a patient (only doctor-prescribed)
exports.getByUserAndStatus = async (req, res) => {
  try {
    console.log('🩺 User prescriptions by status request:', req.params.userId);
    const { userId } = req.params;
    const { status } = req.query;

    // Resolve Firebase UID to MongoDB ObjectId for patientId
    let patientMongoId = userId;
    
    // Check if userId is a Firebase UID (not a MongoDB ObjectId)
    if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
      console.log('🩺 Resolving user UID to MongoDB ObjectId:', userId);
      
      const User = require('../models/User');
      const user = await User.findOne({ uid: userId });
      if (user) {
        patientMongoId = user._id;
        console.log('🩺 Found user:', patientMongoId);
      } else {
        console.log('🩺 User not found with UID:', userId);
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }
    }

    // Build query
    const query = { patientId: patientMongoId };
    if (status) {
      query.status = status;
    }

    console.log('🩺 Querying prescriptions for user:', patientMongoId, 'status:', status);

    const items = await Prescription.find(query)
      .populate('patientId', 'fullName email mobileNumber healthQrId')
      .populate('doctorId', 'fullName specialization')
      .populate('hospitalId', 'hospitalName address')
      .sort({ prescriptionDate: -1 });

    console.log('🩺 Found prescriptions for user:', items.length);

    res.json({ success: true, data: items });
  } catch (e) {
    console.error('❌ Error fetching prescriptions by user and status:', e);
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
      frequency: _normalizeFrequency(m.frequency), // Normalize frequency for validation
      duration: m.duration,
      times: m.times && Array.isArray(m.times) && m.times.length > 0 
        ? m.times 
        : _generateDefaultTimes(m.frequency), // Generate default times based on frequency
      instructions: m.instructions || null,
      type: m.type || 'tablet', // Default to tablet if not specified
      dose: m.dose, // Include dose field as required
    }));
    res.json({ success: true, data: medicines });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};


