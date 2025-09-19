const Prescription = require('../models/Prescription');

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
      frequency: m.frequency,
      duration: m.duration,
      times: m.times || [],
      instructions: m.instructions || null,
      type: m.type || 'tablet', // Default to tablet if not specified
      dose: m.dose, // Include dose field as required
    }));
    res.json({ success: true, data: medicines });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};


