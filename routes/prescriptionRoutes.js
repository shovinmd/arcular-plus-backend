const express = require('express');
const router = express.Router();
const firebaseAuthMiddleware = require('../middleware/firebaseAuthMiddleware');
const Prescription = require('../models/Prescription');
const prescriptionController = require('../controllers/prescriptionController');
const User = require('../models/User');
const Doctor = require('../models/Doctor');
const Hospital = require('../models/Hospital');
const { authenticateToken: auth } = require('../middleware/auth');

// Debug: log router mount and requests
console.log('🩺 Prescription routes loaded');
router.use((req, res, next) => {
  try {
    console.log(`🩺 [prescriptions] ${req.method} ${req.path}`);
  } catch (_) {}
  next();
});

// Quick health probe for router
router.get('/health', (req, res) => {
  res.json({ ok: true, route: 'prescriptions', timestamp: Date.now() });
});

// Helper to process create with UID-based payload or legacy
async function handleCreateWithUidOrLegacy(req, res) {
  console.log('🩺 handleCreateWithUidOrLegacy invoked');
  const body = req.body || {};
  console.log('🩺 payload keys:', Object.keys(body || {}));
  // UID-based branch
  if (body.patientArcId && body.doctorId && body.hospitalId) {
    console.log('🩺 using UID-based create');
    const { patientArcId, doctorId: doctorUid, hospitalId: hospitalUid, diagnosis, medications, instructions, followUpDate, notes } = body;
    console.log('🩺 resolving doctor by uid:', doctorUid);
    let doctorUser = await User.findOne({ uid: doctorUid });
    let doctor = doctorUser;
    if (!doctorUser) {
      // Fallback to Doctor model
      const doctorModel = await Doctor.findOne({ uid: doctorUid });
      if (doctorModel) {
        doctor = {
          _id: doctorModel._id,
          fullName: doctorModel.fullName,
          specialization: doctorModel.specialization,
        };
      }
    }
    console.log('🩺 doctor resolved?', !!doctor);
    console.log('🩺 resolving hospital by uid:', hospitalUid);
    const hospital = await Hospital.findOne({ uid: hospitalUid });
    console.log('🩺 hospital resolved?', !!hospital);
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });
    if (!hospital) return res.status(404).json({ success: false, message: 'Hospital not found' });
    const patient = await User.findOne({ healthQrId: patientArcId });
    console.log('🩺 patient resolved?', !!patient, 'arcId:', patientArcId);
    const newRx = new Prescription({
      patientArcId,
      patientId: patient?.uid,
      patientName: patient?.fullName,
      hospitalId: hospital._id,
      hospitalName: hospital.fullName,
      doctorId: doctor._id,
      doctorName: doctor.fullName,
      doctorSpecialization: doctor.specialization,
      diagnosis,
      medications: medications || [],
      instructions,
      followUpDate: followUpDate ? new Date(followUpDate) : null,
      notes,
      status: 'Active',
      createdBy: doctor._id,
      updatedBy: doctor._id,
    });
    await newRx.save();
    const out = res.status(201).json({ success: true, message: 'Prescription created successfully', data: newRx });
    console.log('🩺 prescription created with UID branch');
    return out;
  }
  // Legacy path
  console.log('🩺 using legacy create');
  const { userId, patientName, patientMobile, patientEmail, doctorId, doctorName, doctorSpecialty, diagnosis, medications, instructions, followUpDate, notes } = body;
  const legacyRx = new Prescription({ userId, patientName, patientMobile, patientEmail, doctorId, doctorName, doctorSpecialty, diagnosis, medications, instructions, followUpDate, notes });
  await legacyRx.save();
  const out = res.status(201).json({ success: true, data: legacyRx, message: 'Prescription created successfully' });
  console.log('🩺 prescription created with legacy branch');
  return out;
}

// Create new prescription (Firebase auth)
router.post('/create', firebaseAuthMiddleware, async (req, res) => {
  try {
    await handleCreateWithUidOrLegacy(req, res);
  } catch (error) {
    console.error('Error creating prescription:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating prescription',
      error: error.message
    });
  }
});

// Get prescriptions by patient ARC ID
router.get('/patient/:patientArcId', firebaseAuthMiddleware, async (req, res) => {
  try {
    console.log('🩺 Patient prescriptions request:', req.params.patientArcId);
    const { patientArcId } = req.params;
    const { status } = req.query;

    // Build query
    const query = { patientArcId };
    if (status) {
      query.status = status;
    }

    console.log('🩺 Querying prescriptions for patient:', patientArcId, 'status:', status);

    const prescriptions = await Prescription.find(query)
      .populate({
        path: 'patientId',
        select: 'fullName email mobileNumber healthQrId',
        options: { strictPopulate: false }
      })
      .populate({
        path: 'doctorId',
        select: 'fullName specialization',
        options: { strictPopulate: false }
      })
      .populate({
        path: 'hospitalId',
        select: 'hospitalName address',
        options: { strictPopulate: false }
      })
      .sort({ createdAt: -1 });

    console.log('🩺 Found prescriptions for patient:', prescriptions.length);

    res.json({
      success: true,
      data: prescriptions,
      count: prescriptions.length
    });
  } catch (error) {
    console.error('Error fetching prescriptions by patient:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching prescriptions',
      error: error.message
    });
  }
});

// Get prescriptions by doctor (accept Firebase UID)
router.get('/doctor/:doctorId', firebaseAuthMiddleware, async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { status } = req.query;

    // Resolve doctor by UID from User or Doctor model
    let doctor = await User.findOne({ uid: doctorId });
    if (!doctor) {
      const doctorModel = await Doctor.findOne({ uid: doctorId });
      if (doctorModel) {
        doctor = { _id: doctorModel._id };
      }
    }
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    // Build query by Mongo ObjectId
    const query = { doctorId: doctor._id };
    if (status) query.status = status;

    const prescriptions = await Prescription.find(query)
      .sort({ createdAt: -1 })
      .populate('hospitalId', 'fullName')
      .lean();

    res.json({ success: true, data: prescriptions, count: prescriptions.length });
  } catch (error) {
    console.error('Error fetching prescriptions by doctor:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching prescriptions',
      error: error.message
    });
  }
});

// Update prescription (Firebase auth) - accepts UID updates for doctorId/hospitalId
router.put('/:prescriptionId', firebaseAuthMiddleware, async (req, res) => {
  try {
    const { prescriptionId } = req.params;
    const updates = req.body || {};

    const prescription = await Prescription.findById(prescriptionId);
    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      });
    }

    // Resolve doctorId/hospitalId when UIDs are provided
    const mongoose = require('mongoose');
    const isValidObjectId = (v) => mongoose.Types.ObjectId.isValid(v?.toString());

    if (typeof updates.doctorId === 'string' && updates.doctorId.length && !isValidObjectId(updates.doctorId)) {
      const docUser = await User.findOne({ uid: updates.doctorId });
      if (docUser) updates.doctorId = docUser._id;
      else {
        const DoctorModel = require('../models/Doctor');
        const d = await DoctorModel.findOne({ uid: updates.doctorId });
        if (d) updates.doctorId = d._id;
      }
    }
    if (typeof updates.hospitalId === 'string' && updates.hospitalId.length && !isValidObjectId(updates.hospitalId)) {
      const hosp = await Hospital.findOne({ uid: updates.hospitalId });
      if (hosp) updates.hospitalId = hosp._id;
    }

    Object.keys(updates).forEach((k) => {
      if (updates[k] !== undefined) {
        if (k === 'followUpDate') {
          prescription[k] = updates[k] ? new Date(updates[k]) : null;
        } else {
          prescription[k] = updates[k];
        }
      }
    });
    // Ensure updatedBy is a valid ObjectId reference
    prescription.updatedBy = prescription.doctorId;
    await prescription.save();

    res.json({
      success: true,
      message: 'Prescription updated successfully',
      data: prescription
    });
  } catch (error) {
    console.error('Error updating prescription:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating prescription',
      error: error.message
    });
  }
});

// Mark prescription as completed (Firebase auth)
router.put('/:prescriptionId/complete', firebaseAuthMiddleware, async (req, res) => {
  try {
    const { prescriptionId } = req.params;
    const { completionNotes } = req.body;

    const prescription = await Prescription.findById(prescriptionId);
    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      });
    }

    prescription.status = 'Completed';
    prescription.completionDate = new Date();
    if (completionNotes) prescription.completionNotes = completionNotes;
    prescription.updatedBy = prescription.doctorId; // set Mongo ObjectId
    await prescription.save();

    res.json({
      success: true,
      message: 'Prescription completed successfully',
      data: prescription
    });
  } catch (error) {
    console.error('Error completing prescription:', error);
    res.status(500).json({
      success: false,
      message: 'Error completing prescription',
      error: error.message
    });
  }
});

// Get all prescriptions for a user
router.get('/user/:userId', firebaseAuthMiddleware, async (req, res) => {
  try {
    console.log('🩺 User prescriptions request:', req.params.userId);
    const { userId } = req.params;
    const { status } = req.query;

    // Resolve Firebase UID to MongoDB ObjectId for patientId
    let patientMongoId = userId;
    
    // Check if userId is a Firebase UID (not a MongoDB ObjectId)
    if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
      console.log('🩺 Resolving user UID to MongoDB ObjectId:', userId);
      
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

    const prescriptions = await Prescription.find(query)
      .populate('patientId', 'fullName email mobileNumber healthQrId')
      .populate('doctorId', 'fullName specialization')
      .populate('hospitalId', 'hospitalName address')
      .sort({ createdAt: -1 });

    console.log('🩺 Found prescriptions for user:', prescriptions.length);

    res.json({
      success: true,
      data: prescriptions,
      count: prescriptions.length
    });
  } catch (error) {
    console.error('Error fetching prescriptions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch prescriptions'
    });
  }
});

// Optimized endpoint for app tabs (Active/Completed/Archived)
router.get('/user/:userId/by-status', firebaseAuthMiddleware, (req, res, next) => {
  // Disable caching to prevent 304 responses
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
}, prescriptionController.getByUserAndStatus);

// Transform a prescription to medicine payloads for client import
router.get('/:id/transform-to-medicines', firebaseAuthMiddleware, prescriptionController.transformToMedicines);


// Get prescriptions for hospitals
router.get('/hospital/:hospitalId', firebaseAuthMiddleware, async (req, res) => {
  try {
    console.log('🩺 Hospital prescriptions request:', req.params.hospitalId);
    const { hospitalId } = req.params;
    const { status } = req.query;

    // Resolve Firebase UID to MongoDB ObjectId
    let hospitalMongoId = hospitalId;
    
    // Check if hospitalId is a Firebase UID (not a MongoDB ObjectId)
    if (!hospitalId.match(/^[0-9a-fA-F]{24}$/)) {
      console.log('🩺 Resolving hospital UID to MongoDB ObjectId:', hospitalId);
      
      const hospital = await Hospital.findOne({ uid: hospitalId });
      if (hospital) {
        hospitalMongoId = hospital._id;
        console.log('🩺 Found hospital:', hospitalMongoId);
      } else {
        console.log('🩺 Hospital not found with UID:', hospitalId);
        return res.status(404).json({
          success: false,
          error: 'Hospital not found'
        });
      }
    } else {
      console.log('🩺 Using hospitalId as MongoDB ObjectId:', hospitalId);
    }

    let prescriptions;
    try {
      console.log('🩺 Querying prescriptions for hospital:', hospitalMongoId, 'status:', status);
      
      if (status) {
        prescriptions = await Prescription.find({ hospitalId: hospitalMongoId, status })
          .populate('patientId', 'fullName email mobileNumber healthQrId')
          .populate('doctorId', 'fullName specialization')
          .populate('hospitalId', 'hospitalName address')
          .sort({ prescriptionDate: -1 });
      } else {
        prescriptions = await Prescription.find({ hospitalId: hospitalMongoId })
          .populate('patientId', 'fullName email mobileNumber healthQrId')
          .populate('doctorId', 'fullName specialization')
          .populate('hospitalId', 'hospitalName address')
          .sort({ prescriptionDate: -1 });
      }
      
      console.log('🩺 Found prescriptions:', prescriptions.length);
    } catch (populateError) {
      console.log('🩺 Populate error, trying without populate:', populateError.message);
      // Fallback without populate if there are field issues
      if (status) {
        prescriptions = await Prescription.find({ hospitalId: hospitalMongoId, status })
          .sort({ prescriptionDate: -1 });
      } else {
        prescriptions = await Prescription.find({ hospitalId: hospitalMongoId })
          .sort({ prescriptionDate: -1 });
      }
      console.log('🩺 Found prescriptions (no populate):', prescriptions.length);
    }

    res.json({
      success: true,
      data: prescriptions,
      count: prescriptions.length
    });
  } catch (error) {
    console.error('Error fetching hospital prescriptions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch hospital prescriptions'
    });
  }
});

// Get prescriptions for pharmacies
router.get('/pharmacy/:pharmacyId', firebaseAuthMiddleware, async (req, res) => {
  try {
    const { pharmacyId } = req.params;
    const { status } = req.query;

    let prescriptions;
    if (status === 'dispensed') {
      prescriptions = await Prescription.findDispensed(pharmacyId);
    } else if (status) {
      prescriptions = await Prescription.find({ pharmacyId, status }).sort({ prescriptionDate: -1 });
    } else {
      prescriptions = await Prescription.findByPharmacy(pharmacyId);
    }

    res.json({
      success: true,
      data: prescriptions,
      count: prescriptions.length
    });
  } catch (error) {
    console.error('Error fetching pharmacy prescriptions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pharmacy prescriptions'
    });
  }
});

// Get pending refill requests for doctors
router.get('/doctor/:doctorId/pending-refills', firebaseAuthMiddleware, async (req, res) => {
  try {
    const { doctorId } = req.params;
    const prescriptions = await Prescription.findPendingRefills(doctorId);

    res.json({
      success: true,
      data: prescriptions,
      count: prescriptions.length
    });
  } catch (error) {
    console.error('Error fetching pending refills:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pending refills'
    });
  }
});

// Get prescription by ID
router.get('/:id', firebaseAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const prescription = await Prescription.findById(id);

    if (!prescription) {
      return res.status(404).json({
        success: false,
        error: 'Prescription not found'
      });
    }

    res.json({
      success: true,
      data: prescription
    });
  } catch (error) {
    console.error('Error fetching prescription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch prescription'
    });
  }
});

// Create new prescription
router.post('/', firebaseAuthMiddleware, async (req, res) => {
  try {
    await handleCreateWithUidOrLegacy(req, res);
  } catch (error) {
    console.error('Error creating prescription:', error);
    res.status(500).json({ success: false, error: 'Failed to create prescription' });
  }
});

// Safety net: handle POST to base or /create even if route matching fails earlier
router.post('*', firebaseAuthMiddleware, async (req, res, next) => {
  try {
    const p = req.path || '';
    if (p === '/' || p === '/create') {
      return await handleCreateWithUidOrLegacy(req, res);
    }
    return next();
  } catch (e) {
    console.error('Error in wildcard prescription create:', e);
    return res.status(500).json({ success: false, error: 'Failed to create prescription' });
  }
});

// Request refill
router.post('/:id/request-refill', firebaseAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const prescription = await Prescription.findById(id);

    if (!prescription) {
      return res.status(404).json({
        success: false,
        error: 'Prescription not found'
      });
    }

    await prescription.requestRefill();

    res.json({
      success: true,
      data: prescription,
      message: 'Refill request submitted successfully'
    });
  } catch (error) {
    console.error('Error requesting refill:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to request refill'
    });
  }
});

// Approve refill (doctor only)
router.post('/:id/approve-refill', firebaseAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { approvedBy } = req.body;

    const prescription = await Prescription.findById(id);

    if (!prescription) {
      return res.status(404).json({
        success: false,
        error: 'Prescription not found'
      });
    }

    await prescription.approveRefill(approvedBy);

    res.json({
      success: true,
      data: prescription,
      message: 'Refill approved successfully'
    });
  } catch (error) {
    console.error('Error approving refill:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to approve refill'
    });
  }
});

// Dispense medication (pharmacy only)
router.post('/:id/dispense', firebaseAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { pharmacyId, pharmacyName, dispensedBy } = req.body;

    const prescription = await Prescription.findById(id);

    if (!prescription) {
      return res.status(404).json({
        success: false,
        error: 'Prescription not found'
      });
    }

    await prescription.dispenseMedication(pharmacyId, pharmacyName, dispensedBy);

    res.json({
      success: true,
      data: prescription,
      message: 'Medication dispensed successfully'
    });
  } catch (error) {
    console.error('Error dispensing medication:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to dispense medication'
    });
  }
});

// Update prescription
router.put('/:id', firebaseAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const prescription = await Prescription.findById(id);
    if (!prescription) {
      return res.status(404).json({
        success: false,
        error: 'Prescription not found'
      });
    }

    // Update fields
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        if (key === 'prescriptionDate' || key === 'followUpDate') {
          prescription[key] = new Date(updateData[key]);
        } else {
          prescription[key] = updateData[key];
        }
      }
    });

    await prescription.save();

    res.json({
      success: true,
      data: prescription,
      message: 'Prescription updated successfully'
    });
  } catch (error) {
    console.error('Error updating prescription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update prescription'
    });
  }
});

// Update prescription status
router.patch('/:id/status', firebaseAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const prescription = await Prescription.findById(id);
    if (!prescription) {
      return res.status(404).json({
        success: false,
        error: 'Prescription not found'
      });
    }

    await prescription.updateStatus(status);

    res.json({
      success: true,
      data: prescription,
      message: 'Prescription status updated successfully'
    });
  } catch (error) {
    console.error('Error updating prescription status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update prescription status'
    });
  }
});

// Delete prescription
router.delete('/:id', firebaseAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const prescription = await Prescription.findById(id);

    if (!prescription) {
      return res.status(404).json({
        success: false,
        error: 'Prescription not found'
      });
    }

    await Prescription.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Prescription deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting prescription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete prescription'
    });
  }
});

module.exports = router;
