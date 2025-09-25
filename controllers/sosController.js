const SOSRequest = require('../models/SOSRequest');
const HospitalSOS = require('../models/HospitalSOS');
const Hospital = require('../models/Hospital');

// Helper function to calculate distance between two coordinates
const calculateDistance = (coord1, coord2) => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (coord2[1] - coord1[1]) * Math.PI / 180;
  const dLon = (coord2[0] - coord1[0]) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(coord1[1] * Math.PI / 180) * Math.cos(coord2[1] * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Helper to create HospitalSOS records for an SOSRequest
async function ensureHospitalSOSForRequest(
  sosRequest,
  location,
  address,
  city,
  state,
  pincode,
  emergencyType,
  description,
  severity
) {
  try {
    let nearbyHospitals = [];
    try {
      // Try geo $near if index exists
      nearbyHospitals = await Hospital.find({
        status: 'active',
        isApproved: true,
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [location.longitude, location.latitude]
            },
            $maxDistance: 25000
          }
        }
      }).lean();
      // Filter out any hospitals without usable coordinates (defensive)
      nearbyHospitals = nearbyHospitals.filter(h => Array.isArray(h?.location?.coordinates) && h.location.coordinates.length === 2);
    } catch (geoError) {
      // Fallback to Haversine filter over capped set
      const candidates = await Hospital.find({ status: 'active', isApproved: true })
        .select('uid hospitalName primaryPhone email address location geoCoordinates longitude latitude')
        .limit(200)
        .lean();
      const lon = Number(location.longitude);
      const lat = Number(location.latitude);
      nearbyHospitals = candidates
        .map(h => {
          const hLon = h?.location?.coordinates?.[0] ?? h?.longitude ?? h?.geoCoordinates?.lng;
          const hLat = h?.location?.coordinates?.[1] ?? h?.latitude ?? h?.geoCoordinates?.lat;
          if (typeof hLon === 'number' && typeof hLat === 'number') {
            const d = calculateDistance([lon, lat], [hLon, hLat]);
            return { ...h, _distanceKm: d };
          }
          return null;
        })
        .filter(Boolean)
        .filter(h => h._distanceKm <= 25)
        .sort((a, b) => a._distanceKm - b._distanceKm);
    }

    if (!nearbyHospitals || nearbyHospitals.length === 0) {
      // City-wide fallback: notify all approved+active hospitals in same city
      try {
        const cityHospitals = await Hospital.find({
          isApproved: true,
          status: 'active',
          $or: [
            { city: { $regex: new RegExp(`^${city}$`, 'i') } },
            { hospitalCity: { $regex: new RegExp(`^${city}$`, 'i') } },
          ],
        })
          .select('uid hospitalName primaryPhone email address location geoCoordinates longitude latitude')
          .limit(200)
          .lean();
        if (Array.isArray(cityHospitals) && cityHospitals.length > 0) {
          nearbyHospitals = cityHospitals;
        } else {
          // Last resort: notify all approved+active hospitals (no city filter)
          const all = await Hospital.find({ isApproved: true, status: 'active' })
            .select('uid hospitalName primaryPhone email address location geoCoordinates longitude latitude')
            .limit(200)
            .lean();
          nearbyHospitals = all || [];
        }
      } catch (fallbackErr) {
        console.error('❌ City/all fallback failed:', fallbackErr.message);
        nearbyHospitals = [];
      }
      if (!nearbyHospitals || nearbyHospitals.length === 0) {
        return;
      }
    }

    const promises = nearbyHospitals.map(async (hospital) => {
      // Avoid duplicates
      const hospitalUid = hospital?.uid || (hospital?._id ? String(hospital._id) : undefined);
      const exists = hospitalUid
        ? await HospitalSOS.findOne({ sosRequestId: sosRequest._id, hospitalId: hospitalUid })
        : null;
      if (exists) return exists;

      const hCoords = (Array.isArray(hospital?.location?.coordinates) && hospital.location.coordinates.length === 2)
        ? hospital.location.coordinates
        : (typeof hospital.longitude === 'number' && typeof hospital.latitude === 'number')
          ? [hospital.longitude, hospital.latitude]
          : (hospital.geoCoordinates && typeof hospital.geoCoordinates.lng === 'number' && typeof hospital.geoCoordinates.lat === 'number')
            ? [hospital.geoCoordinates.lng, hospital.geoCoordinates.lat]
            : null;
      // Build safe fields with fallbacks to satisfy required schema
      const safeHospitalId = hospitalUid || 'unknown-hospital';
      const safeHospitalName = hospital.hospitalName || hospital.fullName || 'Unknown Hospital';
      const safeHospitalPhone = hospital.primaryPhone || hospital.hospitalPhone || hospital.mobileNumber || 'N/A';
      const safeHospitalEmail = hospital.hospitalEmail || hospital.email || '';
      const safeHospitalAddress = hospital.hospitalAddress || hospital.address || 'Address not available';

      try {
        const hospitalSOS = new HospitalSOS({
          sosRequestId: sosRequest._id,
          hospitalId: safeHospitalId,
          hospitalName: safeHospitalName,
          hospitalPhone: safeHospitalPhone,
          hospitalEmail: safeHospitalEmail,
          hospitalLocation: {
            type: 'Point',
            coordinates: Array.isArray(hCoords) ? hCoords : [location.longitude, location.latitude]
          },
          hospitalAddress: safeHospitalAddress,
          patientInfo: {
            patientId: sosRequest.patientId,
            patientName: sosRequest.patientName,
            patientPhone: sosRequest.patientPhone,
            patientEmail: sosRequest.patientEmail,
            patientAge: sosRequest.patientAge,
            patientGender: sosRequest.patientGender,
            emergencyContact: sosRequest.emergencyContact
          },
          emergencyDetails: {
            emergencyType: emergencyType || 'Medical',
            description,
            severity: severity || 'High',
            location: {
              address: address || 'Address not available',
              city: city || 'Unknown City',
              state: state || 'Unknown State',
              pincode: pincode || '000000',
              coordinates: [location.longitude, location.latitude]
            }
          }
        });
        return await hospitalSOS.save();
      } catch (saveErr) {
        console.error('❌ Failed to create HospitalSOS for hospital:', safeHospitalName, '-', saveErr.message);
        return null;
      }
    });
    await Promise.all(promises);
  } catch (e) {
    console.error('❌ ensureHospitalSOSForRequest error:', e);
  }
}

// Create new SOS request
const createSOSRequest = async (req, res) => {
  try {
    const {
      patientId,
      patientName,
      patientPhone,
      patientEmail,
      patientAge,
      patientGender,
      emergencyContact,
      location,
      address,
      city,
      state,
      pincode,
      emergencyType,
      description,
      severity
    } = req.body;

    // Validate required fields
    if (!patientId || !patientName || !patientPhone || !location || !address || !city) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Check for duplicate active SOS requests from same patient
    let existingRequest = await SOSRequest.findOne({
      patientId,
      status: { $in: ['pending', 'accepted'] }
    });

    if (existingRequest) {
      // Update existing pending/accepted request with latest details (idempotent re-activation)
      try {
        existingRequest.patientName = patientName || existingRequest.patientName;
        existingRequest.patientPhone = patientPhone || existingRequest.patientPhone;
        existingRequest.patientEmail = patientEmail || existingRequest.patientEmail;
        existingRequest.patientAge = typeof patientAge === 'number' ? patientAge : existingRequest.patientAge;
        existingRequest.patientGender = patientGender || existingRequest.patientGender;
        if (emergencyContact) {
          existingRequest.emergencyContact = emergencyContact;
        }
        if (location && typeof location.longitude === 'number' && typeof location.latitude === 'number') {
          existingRequest.location = {
            type: 'Point',
            coordinates: [location.longitude, location.latitude]
          };
        }
        existingRequest.address = address || existingRequest.address;
        existingRequest.city = city || existingRequest.city;
        existingRequest.state = state || existingRequest.state;
        existingRequest.pincode = pincode || existingRequest.pincode;
        existingRequest.emergencyType = emergencyType || existingRequest.emergencyType || 'Medical';
        existingRequest.description = description ?? existingRequest.description;
        existingRequest.severity = severity || existingRequest.severity || 'High';
        // Extend timeout if still pending
        if (existingRequest.status === 'pending') {
          existingRequest.timeoutAt = new Date(Date.now() + 2 * 60 * 1000);
        }
        await existingRequest.save();
      } catch (updateErr) {
        console.error('❌ Error updating existing SOS request:', updateErr);
      }

      // Ensure HospitalSOS records exist/updated
      await ensureHospitalSOSForRequest(existingRequest, location, address, city, state, pincode, emergencyType, description, severity);

      return res.status(200).json({
        success: true,
        message: 'Active SOS request updated and returned',
        data: {
          sosRequestId: existingRequest._id,
          status: existingRequest.status,
          timeoutAt: existingRequest.timeoutAt,
          nearbyHospitals: await HospitalSOS.countDocuments({ sosRequestId: existingRequest._id })
        }
      });
    }

    // Set timeout (2 minutes from now)
    const timeoutAt = new Date(Date.now() + 2 * 60 * 1000);

    // Create SOS request
    const sosRequest = new SOSRequest({
      patientId,
      patientName,
      patientPhone,
      patientEmail,
      patientAge,
      patientGender,
      emergencyContact,
      location: {
        type: 'Point',
        coordinates: [location.longitude, location.latitude]
      },
      address,
      city,
      state,
      pincode,
      emergencyType: emergencyType || 'Medical',
      description,
      severity: severity || 'High',
      timeoutAt
    });

    await sosRequest.save();

    // Create HospitalSOS records (with geo $near first, then fallback)
    await ensureHospitalSOSForRequest(
      sosRequest,
      location,
      address,
      city,
      state,
      pincode,
      emergencyType,
      description,
      severity
    );

    res.status(201).json({
      success: true,
      message: 'SOS request created successfully',
      data: {
        sosRequestId: sosRequest._id,
        status: sosRequest.status,
        // nearbyHospitals count is computed inside ensureHospitalSOSForRequest;
        // return count of created HospitalSOS records for this request
        nearbyHospitals: await HospitalSOS.countDocuments({ sosRequestId: sosRequest._id }),
        timeoutAt: sosRequest.timeoutAt
      }
    });

  } catch (error) {
    console.error('Error creating SOS request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create SOS request',
      error: error.message
    });
  }
};

// Get SOS requests for a specific hospital
const getHospitalSOSRequests = async (req, res) => {
  try {
    const { hospitalId } = req.params;
    const { status } = req.query;

    console.log('🏥 Fetching SOS requests for hospital:', hospitalId);
    console.log('📊 Status filter:', status);

    if (!hospitalId) {
      return res.status(400).json({
        success: false,
        message: 'Hospital ID is required'
      });
    }

    // Resolve hospitalId to stored identifier in HospitalSOS (we store Hospital.uid)
    let resolvedHospitalId = hospitalId;
    try {
      const hospitalDoc = await Hospital.findOne({ uid: hospitalId }).lean();
      if (hospitalDoc) {
        resolvedHospitalId = hospitalDoc.uid;
      } else {
        // Try treating hospitalId as MongoDB ObjectId
        const mongoose = require('mongoose');
        if (mongoose.isValidObjectId(hospitalId)) {
          const byObjectId = await Hospital.findById(hospitalId).lean();
          if (byObjectId && byObjectId.uid) {
            resolvedHospitalId = byObjectId.uid;
          }
        }
      }
    } catch (resolveErr) {
      console.error('❌ Error resolving hospitalId for SOS requests:', resolveErr.message);
    }

    // Match records saved with either Hospital.uid (preferred) or the raw provided id
    let query = { hospitalId: { $in: [resolvedHospitalId, hospitalId] } };
    if (status) {
      query.hospitalStatus = status;
    }

    console.log('🔍 Query:', query);

    const hospitalSOSRequests = await HospitalSOS.find(query)
      .populate('sosRequestId')
      .sort({ createdAt: -1 })
      .limit(50); // Limit results to prevent timeout

    console.log(`✅ Found ${hospitalSOSRequests.length} SOS requests for hospital ${hospitalId}`);

    res.json({
      success: true,
      data: hospitalSOSRequests,
      count: hospitalSOSRequests.length
    });

  } catch (error) {
    console.error('❌ Error fetching hospital SOS requests:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch SOS requests',
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Accept SOS request
const acceptSOSRequest = async (req, res) => {
  try {
    const { hospitalId } = req.params;
    const { sosRequestId, staffInfo } = req.body;

    // Check if SOS request exists and is still pending
    const sosRequest = await SOSRequest.findById(sosRequestId);
    if (!sosRequest) {
      return res.status(404).json({
        success: false,
        message: 'SOS request not found'
      });
    }

    if (sosRequest.status !== 'pending') {
      return res.status(409).json({
        success: false,
        message: 'SOS request is no longer available'
      });
    }

    // Check if request has timed out
    if (sosRequest.hasTimedOut()) {
      sosRequest.status = 'timeout';
      await sosRequest.save();
      return res.status(410).json({
        success: false,
        message: 'SOS request has timed out'
      });
    }

    // Update SOS request with acceptance
    sosRequest.status = 'accepted';
    sosRequest.acceptedBy = {
      hospitalId,
      hospitalName: staffInfo.hospitalName,
      acceptedAt: new Date(),
      acceptedByStaff: staffInfo
    };
    sosRequest.calculateResponseTime();
    await sosRequest.save();

    // Update HospitalSOS record
    const hospitalSOS = await HospitalSOS.findOne({
      sosRequestId,
      hospitalId
    });

    if (hospitalSOS) {
      hospitalSOS.hospitalStatus = 'accepted';
      hospitalSOS.responseDetails = {
        respondedAt: new Date(),
        respondedBy: staffInfo,
        responseTime: sosRequest.responseTime,
        distance: hospitalSOS.emergencyDetails.location.coordinates ? 
          calculateDistance(
            hospitalSOS.hospitalLocation.coordinates,
            hospitalSOS.emergencyDetails.location.coordinates
          ) : null
      };
      await hospitalSOS.addAction('accepted', staffInfo, 'SOS request accepted');
      await hospitalSOS.save();
    }

    // Update all other hospitals to "handledByOther"
    await HospitalSOS.updateMany(
      {
        sosRequestId,
        hospitalId: { $ne: hospitalId }
      },
      {
        $set: { hospitalStatus: 'handledByOther' }
      }
    );

    res.json({
      success: true,
      message: 'SOS request accepted successfully',
      data: {
        sosRequestId: sosRequest._id,
        status: sosRequest.status,
        responseTime: sosRequest.responseTime
      }
    });

  } catch (error) {
    console.error('Error accepting SOS request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to accept SOS request',
      error: error.message
    });
  }
};

// Mark patient as admitted
const markPatientAdmitted = async (req, res) => {
  try {
    const { hospitalId } = req.params;
    const { sosRequestId, admissionDetails } = req.body;

    // Check if SOS request exists and is accepted by this hospital
    const sosRequest = await SOSRequest.findById(sosRequestId);
    if (!sosRequest) {
      return res.status(404).json({
        success: false,
        message: 'SOS request not found'
      });
    }

    if (sosRequest.acceptedBy.hospitalId !== hospitalId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to update this SOS request'
      });
    }

    if (sosRequest.status !== 'accepted') {
      return res.status(409).json({
        success: false,
        message: 'SOS request must be accepted before marking as admitted'
      });
    }

    // Update SOS request
    sosRequest.status = 'admitted';
    sosRequest.admissionDetails = {
      admittedAt: new Date(),
      admittedByStaff: admissionDetails.staffInfo,
      wardNumber: admissionDetails.wardNumber,
      bedNumber: admissionDetails.bedNumber,
      notes: admissionDetails.notes
    };
    await sosRequest.save();

    // Update HospitalSOS record
    const hospitalSOS = await HospitalSOS.findOne({
      sosRequestId,
      hospitalId
    });

    if (hospitalSOS) {
      await hospitalSOS.addAction('marked_admitted', admissionDetails.staffInfo, admissionDetails.notes);
      await hospitalSOS.save();
    }

    res.json({
      success: true,
      message: 'Patient marked as admitted successfully',
      data: {
        sosRequestId: sosRequest._id,
        status: sosRequest.status,
        admittedAt: sosRequest.admissionDetails.admittedAt
      }
    });

  } catch (error) {
    console.error('Error marking patient as admitted:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark patient as admitted',
      error: error.message
    });
  }
};

// Get patient's SOS history
const getPatientSOSHistory = async (req, res) => {
  try {
    const { patientId } = req.params;

    const sosHistory = await SOSRequest.find({ patientId })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: sosHistory
    });

  } catch (error) {
    console.error('Error fetching patient SOS history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch SOS history',
      error: error.message
    });
  }
};

// Cancel SOS request
const cancelSOSRequest = async (req, res) => {
  try {
    const { sosRequestId } = req.params;
    const { reason } = req.body;

    const sosRequest = await SOSRequest.findById(sosRequestId);
    if (!sosRequest) {
      return res.status(404).json({
        success: false,
        message: 'SOS request not found'
      });
    }

    if (sosRequest.status === 'cancelled') {
      return res.status(409).json({
        success: false,
        message: 'SOS request is already cancelled'
      });
    }

    sosRequest.status = 'cancelled';
    await sosRequest.save();

    // Update all HospitalSOS records
    await HospitalSOS.updateMany(
      { sosRequestId },
      { $set: { hospitalStatus: 'cancelled' } }
    );

    res.json({
      success: true,
      message: 'SOS request cancelled successfully'
    });

  } catch (error) {
    console.error('Error cancelling SOS request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel SOS request',
      error: error.message
    });
  }
};

// Get SOS request by ID (for polling)
const getSOSRequestById = async (req, res) => {
  try {
    const { sosRequestId } = req.params;
    if (!sosRequestId) {
      return res.status(400).json({ success: false, message: 'sosRequestId is required' });
    }

    const sosRequest = await SOSRequest.findById(sosRequestId);
    if (!sosRequest) {
      return res.status(404).json({ success: false, message: 'SOS request not found' });
    }

    return res.status(200).json({ success: true, data: sosRequest });
  } catch (error) {
    console.error('Error fetching SOS request by id:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch SOS request', error: error.message });
  }
};

// Get SOS statistics
const getSOSStatistics = async (req, res) => {
  try {
    const { hospitalId } = req.params;
    const { startDate, endDate } = req.query;

    let matchQuery = {};
    if (hospitalId) {
      matchQuery.hospitalId = hospitalId;
    }
    if (startDate && endDate) {
      matchQuery.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const stats = await HospitalSOS.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$hospitalStatus',
          count: { $sum: 1 },
          avgResponseTime: { $avg: '$responseDetails.responseTime' }
        }
      }
    ]);

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Error fetching SOS statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch SOS statistics',
      error: error.message
    });
  }
};

module.exports = {
  createSOSRequest,
  getHospitalSOSRequests,
  acceptSOSRequest,
  markPatientAdmitted,
  getPatientSOSHistory,
  cancelSOSRequest,
  getSOSStatistics,
  getSOSRequestById
};
