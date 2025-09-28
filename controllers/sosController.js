const SOSRequest = require('../models/SOSRequest');
const HospitalSOS = require('../models/HospitalSOS');
const Hospital = require('../models/Hospital');
const HospitalAlert = require('../models/HospitalAlert');

// Helper function to calculate distance between two coordinates
const calculateDistance = (coord1, coord2) => {
  const R = 6371; // Earth's radius in kilometers
  
  // Ensure coordinates are numbers and preserve precision
  const lat1 = parseFloat(coord1[1]);
  const lon1 = parseFloat(coord1[0]);
  const lat2 = parseFloat(coord2[1]);
  const lon2 = parseFloat(coord2[0]);
  
  // Convert to radians with high precision
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  // Haversine formula with high precision
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  
  const distance = R * c;
  
  // Log high-precision calculation for debugging
  console.log(`📏 Distance calculation: (${lat1.toFixed(15)}, ${lon1.toFixed(15)}) to (${lat2.toFixed(15)}, ${lon2.toFixed(15)}) = ${distance.toFixed(6)}km`);
  
  return distance;
};

// Utility function to synchronize hospital coordinates
async function synchronizeHospitalCoordinates() {
  try {
    console.log('🔄 Synchronizing hospital coordinates...');
    
    const hospitals = await Hospital.find({}).lean();
    let updatedCount = 0;
    
    for (const hospital of hospitals) {
      let needsUpdate = false;
      const updateData = {};
      
      // Check if coordinates need synchronization
      const hasLonLat = typeof hospital.longitude === 'number' && typeof hospital.latitude === 'number';
      const hasGeo = hospital.geoCoordinates && typeof hospital.geoCoordinates.lng === 'number' && typeof hospital.geoCoordinates.lat === 'number';
      const hasLocation = hospital.location && Array.isArray(hospital.location.coordinates) && hospital.location.coordinates.length === 2;
      
      let lon, lat;
      
      // Determine source coordinates
      if (hasLonLat) {
        lon = hospital.longitude;
        lat = hospital.latitude;
      } else if (hasGeo) {
        lon = hospital.geoCoordinates.lng;
        lat = hospital.geoCoordinates.lat;
      } else if (hasLocation) {
        lon = hospital.location.coordinates[0];
        lat = hospital.location.coordinates[1];
      }
      
      // Update missing coordinate formats
      if (typeof lon === 'number' && typeof lat === 'number') {
        if (!hasLonLat) {
          updateData.longitude = lon;
          updateData.latitude = lat;
          needsUpdate = true;
        }
        
        if (!hasGeo) {
          updateData.geoCoordinates = { lng: lon, lat: lat };
          needsUpdate = true;
        }
        
        if (!hasLocation) {
          updateData.location = {
            type: 'Point',
            coordinates: [lon, lat]
          };
          needsUpdate = true;
        }
        
        if (needsUpdate) {
          await Hospital.updateOne(
            { _id: hospital._id },
            { $set: updateData }
          );
          updatedCount++;
          console.log(`✅ Synchronized coordinates for: ${hospital.hospitalName || hospital.uid}`);
        }
      }
    }
    
    console.log(`🎯 Synchronization complete: ${updatedCount} hospitals updated`);
    return { success: true, updatedCount };
  } catch (error) {
    console.error('❌ Error synchronizing hospital coordinates:', error);
    return { success: false, error: error.message };
  }
}
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
    
    // Preserve full precision of coordinates
    const lon = parseFloat(location.longitude);
    const lat = parseFloat(location.latitude);
    
    console.log(`🔍 Finding hospitals near coordinates: ${lat}, ${lon}`);
    console.log(`📍 Raw coordinates: lat=${location.latitude}, lon=${location.longitude}`);
    console.log(`📍 Parsed coordinates: lat=${lat}, lon=${lon}`);
    console.log(`📍 Coordinate precision: lat=${lat.toFixed(15)}, lon=${lon.toFixed(15)}`);
    
    // Validate coordinates with better precision handling
    if (isNaN(lat) || isNaN(lon) || lat === 0 || lon === 0) {
      console.log(`⚠️ Invalid coordinates detected: lat=${lat}, lon=${lon}`);
      console.log(`📍 Using fallback: Get ALL active hospitals`);
      
            // If coordinates are invalid, get hospitals in same city and pincode
            const cityHospitals = await Hospital.find({ 
              isApproved: true, 
              status: 'active',
              $or: [
                { city: city },
                { hospitalCity: city },
                { pincode: pincode }
              ]
            })
              .select('uid hospitalName primaryPhone email address location geoCoordinates longitude latitude city hospitalCity pincode')
              .limit(100)
              .lean();
              
            nearbyHospitals = cityHospitals || [];
            console.log(`📍 Fallback: Found ${nearbyHospitals.length} hospitals in city: ${city}, pincode: ${pincode}`);
    } else {
      // Log coordinate validation success
      console.log(`✅ Valid high-precision coordinates: lat=${lat.toFixed(15)}, lon=${lon.toFixed(15)}`);
      
      try {
        // Try geo $near if index exists - PRIMARY RADIUS 25KM
        nearbyHospitals = await Hospital.find({
          status: 'active',
          isApproved: true,
          location: {
            $near: {
              $geometry: {
                type: 'Point',
                coordinates: [lon, lat] // [longitude, latitude] order - MongoDB preserves precision
              },
              $maxDistance: 15000 // Primary: 15km radius
            }
          }
        }).lean();
        
        console.log(`📍 Geo query found ${nearbyHospitals.length} hospitals within 15km`);
        
        // Filter out any hospitals without usable coordinates (defensive)
        nearbyHospitals = nearbyHospitals.filter(h => Array.isArray(h?.location?.coordinates) && h.location.coordinates.length === 2);
        
      } catch (geoError) {
        console.log(`⚠️ Geo query failed, using Haversine calculation: ${geoError.message}`);
        
        // Improved fallback: Get ALL active hospitals and calculate distance
        const candidates = await Hospital.find({ 
          status: 'active', 
          isApproved: true 
        })
          .select('uid hospitalName primaryPhone email address location geoCoordinates longitude latitude city hospitalCity')
          .limit(1000) // Increased limit to get more hospitals
          .lean();
          
        console.log(`🔍 Found ${candidates.length} total active hospitals to check`);
        
        nearbyHospitals = candidates
          .map(h => {
            const hLon = h?.location?.coordinates?.[0] ?? h?.longitude ?? h?.geoCoordinates?.lng;
            const hLat = h?.location?.coordinates?.[1] ?? h?.latitude ?? h?.geoCoordinates?.lat;
            if (typeof hLon === 'number' && typeof hLat === 'number' && !isNaN(hLon) && !isNaN(hLat)) {
              const d = calculateDistance([lon, lat], [hLon, hLat]);
              return { ...h, _distanceKm: d };
            }
            return null;
          })
          .filter(Boolean)
          .filter(h => h._distanceKm <= 15) // Primary: 15km
          .sort((a, b) => a._distanceKm - b._distanceKm);
          
        console.log(`📍 Haversine calculation found ${nearbyHospitals.length} hospitals within 15km`);
        
        // Log some example distances for debugging
        if (nearbyHospitals.length > 0) {
          console.log(`📍 Sample distances: ${nearbyHospitals.slice(0, 3).map(h => `${h.hospitalName}: ${h._distanceKm.toFixed(2)}km`).join(', ')}`);
        }
      }

      // If still no hospitals found, expand search to 25km
      if (!nearbyHospitals || nearbyHospitals.length === 0) {
        console.log(`⚠️ No hospitals found within 15km, expanding to 25km`);
        
        try {
          const expandedCandidates = await Hospital.find({ 
            status: 'active', 
            isApproved: true 
          })
            .select('uid hospitalName primaryPhone email address location geoCoordinates longitude latitude city hospitalCity')
            .limit(1000)
            .lean();
            
          nearbyHospitals = expandedCandidates
            .map(h => {
              const hLon = h?.location?.coordinates?.[0] ?? h?.longitude ?? h?.geoCoordinates?.lng;
              const hLat = h?.location?.coordinates?.[1] ?? h?.latitude ?? h?.geoCoordinates?.lat;
              if (typeof hLon === 'number' && typeof hLat === 'number' && !isNaN(hLon) && !isNaN(hLat)) {
                const d = calculateDistance([lon, lat], [hLon, hLat]);
                return { ...h, _distanceKm: d };
              }
              return null;
            })
            .filter(Boolean)
            .filter(h => h._distanceKm <= 25) // Fallback: 25km
            .sort((a, b) => a._distanceKm - b._distanceKm);
            
          console.log(`📍 Expanded search found ${nearbyHospitals.length} hospitals within 25km`);
        } catch (expandedErr) {
          console.error('❌ Expanded search failed:', expandedErr.message);
          nearbyHospitals = [];
        }
      }

      // Emergency fallback: If still no hospitals, search within 50km for critical cases
      if (!nearbyHospitals || nearbyHospitals.length === 0) {
        console.log(`🚨 Emergency fallback: No hospitals found, searching within 50km`);
        
        try {
          const emergencyCandidates = await Hospital.find({ 
            status: 'active', 
            isApproved: true 
          }).lean();
          
          const emergencyHospitals = emergencyCandidates
            .map(h => {
              // Try multiple coordinate formats
              let hLat, hLng;
              
              if (h.geoCoordinates && h.geoCoordinates.lat && h.geoCoordinates.lng) {
                hLat = h.geoCoordinates.lat;
                hLng = h.geoCoordinates.lng;
              } else if (h.latitude && h.longitude) {
                hLat = h.latitude;
                hLng = h.longitude;
              } else if (h.location && Array.isArray(h.location.coordinates) && h.location.coordinates.length === 2) {
                hLng = h.location.coordinates[0]; // longitude
                hLat = h.location.coordinates[1]; // latitude
              }
              
              if (typeof hLat === 'number' && typeof hLng === 'number') {
                const d = _calculateDistance(lat, lon, hLat, hLng);
                return { ...h, _distanceKm: d };
              }
              return null;
            })
            .filter(Boolean)
            .filter(h => h._distanceKm <= 50) // Emergency: 50km
            .sort((a, b) => a._distanceKm - b._distanceKm);
            
          nearbyHospitals = emergencyHospitals;
          console.log(`🚨 Emergency search found ${nearbyHospitals.length} hospitals within 50km`);
        } catch (emergencyErr) {
          console.error('❌ Emergency search failed:', emergencyErr.message);
          nearbyHospitals = [];
        }
      }

      // Last resort: Get hospitals in same city and pincode if still none found
      if (!nearbyHospitals || nearbyHospitals.length === 0) {
        console.log(`⚠️ No hospitals found in radius, searching same city and pincode`);
        
        try {
          // Search hospitals in same city and pincode
          const cityHospitals = await Hospital.find({ 
            isApproved: true, 
            status: 'active',
            $or: [
              { city: city },
              { hospitalCity: city },
              { pincode: pincode }
            ]
          })
            .select('uid hospitalName primaryPhone email address location geoCoordinates longitude latitude city hospitalCity pincode')
            .limit(100)
            .lean();
            
          nearbyHospitals = cityHospitals || [];
          console.log(`📍 City/Pincode search: Found ${nearbyHospitals.length} hospitals in city: ${city}, pincode: ${pincode}`);
        } catch (citySearchErr) {
          console.error('❌ City/Pincode search failed:', citySearchErr.message);
          nearbyHospitals = [];
        }
      }
    }
    
    if (!nearbyHospitals || nearbyHospitals.length === 0) {
      console.log(`❌ No hospitals found at all`);
      return;
    }
    
    console.log(`✅ Final result: ${nearbyHospitals.length} hospitals will be notified`);

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
    // Only check for truly active requests, not cancelled ones
    let existingRequest = await SOSRequest.findOne({
      patientId,
      status: { $in: ['pending', 'accepted', 'hospitalReached', 'admitted'] }
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
      hospitalSOS.hospitalStatus = 'admitted';
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

// Confirm patient admission (for users)
const confirmPatientAdmission = async (req, res) => {
  try {
    const { sosRequestId, hospitalId } = req.body;

    console.log(`👤 User confirming admission for SOS ${sosRequestId} with hospital ${hospitalId}`);

    // Find the SOS request
    const sosRequest = await SOSRequest.findById(sosRequestId);
    if (!sosRequest) {
      return res.status(404).json({
        success: false,
        message: 'SOS request not found'
      });
    }

    // Verify the hospital ID matches the accepted hospital
    const hospitalSOS = await HospitalSOS.findOne({
      sosRequestId: sosRequestId,
      hospitalId: hospitalId,
      hospitalStatus: 'admitted'
    });

    if (!hospitalSOS) {
      return res.status(400).json({
        success: false,
        message: 'Invalid hospital ID or patient not admitted to this hospital'
      });
    }

    // Update SOS request status to confirmed admission
    await SOSRequest.updateOne(
      { _id: sosRequestId },
      { 
        status: 'admissionConfirmed',
        admissionConfirmedAt: new Date(),
        confirmedHospitalId: hospitalId
      }
    );

    // Update hospital SOS status
    await HospitalSOS.updateOne(
      { sosRequestId: sosRequestId, hospitalId: hospitalId },
      { 
        hospitalStatus: 'admissionConfirmed',
        admissionConfirmedAt: new Date()
      }
    );

    console.log(`✅ Patient admission confirmed by user for hospital ${hospitalId}`);

    res.json({
      success: true,
      message: 'Admission confirmed successfully',
      data: {
        sosRequestId: sosRequestId,
        status: 'admissionConfirmed',
        hospitalId: hospitalId
      }
    });

  } catch (error) {
    console.error('❌ Error confirming admission:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Confirm hospital reached (for users)
const confirmHospitalReached = async (req, res) => {
  try {
    const { sosRequestId, hospitalId, doctorId } = req.body;

    console.log(`🏥 User confirming hospital reached for SOS ${sosRequestId} with hospital ${hospitalId}${doctorId ? ` and doctor ${doctorId}` : ''}`);

    // Find the SOS request
    const sosRequest = await SOSRequest.findById(sosRequestId);
    if (!sosRequest) {
      return res.status(404).json({
        success: false,
        message: 'SOS request not found'
      });
    }

    // Verify the hospital ID matches the accepted hospital
    const hospitalSOS = await HospitalSOS.findOne({
      sosRequestId: sosRequestId,
      hospitalId: hospitalId,
      hospitalStatus: 'accepted'
    });

    if (!hospitalSOS) {
      return res.status(400).json({
        success: false,
        message: 'Invalid hospital ID or hospital has not accepted this SOS request'
      });
    }

    // Update SOS request status to hospital reached
    await SOSRequest.updateOne(
      { _id: sosRequestId },
      { 
        status: 'hospitalReached',
        hospitalReachedAt: new Date(),
        reachedHospitalId: hospitalId,
        reachedDoctorId: doctorId || null
      }
    );

    // Update hospital SOS status
    await HospitalSOS.updateOne(
      { sosRequestId: sosRequestId, hospitalId: hospitalId },
      { 
        hospitalStatus: 'hospitalReached',
        hospitalReachedAt: new Date(),
        reachedDoctorId: doctorId || null
      }
    );

    // Update all other hospitals to "handledByOther"
    await HospitalSOS.updateMany(
      { 
        sosRequestId: sosRequestId,
        hospitalId: { $ne: hospitalId }
      },
      { 
        hospitalStatus: 'handledByOther',
        handledByOtherAt: new Date()
      }
    );

    console.log(`✅ Hospital reached confirmed by user for hospital ${hospitalId}`);

    res.json({
      success: true,
      message: 'Hospital reached confirmed successfully',
      data: {
        sosRequestId: sosRequestId,
        status: 'hospitalReached',
        hospitalId: hospitalId,
        doctorId: doctorId
      }
    });

  } catch (error) {
    console.error('❌ Error confirming hospital reached:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// SOS Escalation System - Handle automatic emergency calls and retries
const handleSOSEscalation = async (req, res) => {
  try {
    const { sosRequestId } = req.params;
    
    console.log(`🚨 Handling SOS escalation for request: ${sosRequestId}`);
    
    // Find the SOS request
    const sosRequest = await SOSRequest.findById(sosRequestId);
    if (!sosRequest) {
      return res.status(404).json({
        success: false,
        message: 'SOS request not found'
      });
    }
    
    // Check if SOS is still active (not cancelled, not completed)
    const activeStatuses = ['pending', 'accepted', 'hospitalReached'];
    if (!activeStatuses.includes(sosRequest.status)) {
      console.log(`⚠️ SOS request ${sosRequestId} is no longer active (status: ${sosRequest.status})`);
      return res.status(200).json({
        success: true,
        message: 'SOS request is no longer active',
        action: 'none'
      });
    }
    
    // Check if any hospital has accepted or reached
    const acceptedHospital = await HospitalSOS.findOne({
      sosRequestId: sosRequestId,
      hospitalStatus: { $in: ['accepted', 'hospitalReached', 'admitted'] }
    });
    
    if (acceptedHospital) {
      console.log(`✅ Hospital ${acceptedHospital.hospitalId} has already accepted SOS ${sosRequestId}`);
      
      // If hospital has reached, only call emergency contact (not 123)
      if (acceptedHospital.hospitalStatus === 'hospitalReached') {
        console.log(`🏥 Hospital has reached patient, only calling emergency contact`);
        
        let emergencyCalls = [];
        if (sosRequest.emergencyContact && sosRequest.emergencyContact.phone) {
          emergencyCalls.push({
            number: sosRequest.emergencyContact.phone,
            type: 'emergency_contact',
            triggered: true,
            reason: 'Hospital has reached patient - emergency contact notification'
          });
        }
        
        return res.status(200).json({
          success: true,
          message: 'Hospital has reached patient - emergency contact called',
          action: 'emergency_contact_only',
          emergencyCalls: emergencyCalls,
          acceptedHospital: acceptedHospital.hospitalId
        });
      }
      
      // If hospital has accepted but not reached yet
      if (acceptedHospital.hospitalStatus === 'accepted') {
        console.log(`🏥 Hospital has accepted SOS, checking if emergency services were called`);
        
        // Check if emergency services (123) were already called
        const emergencyServicesCalled = sosRequest.emergencyCallsTriggered?.some(call => 
          call.number === '123' && call.type === 'emergency_services'
        ) || false;
        
        if (emergencyServicesCalled) {
          console.log(`🚨 Emergency services (123) were already called, need to coordinate`);
          
          // Update SOS request with coordination info
          sosRequest.coordinationRequired = true;
          sosRequest.coordinationReason = 'Hospital accepted after emergency services called';
          sosRequest.coordinationStatus = 'pending';
          await sosRequest.save();
          
          // Call emergency contact to inform about coordination
          let emergencyCalls = [];
          if (sosRequest.emergencyContact && sosRequest.emergencyContact.phone) {
            emergencyCalls.push({
              number: sosRequest.emergencyContact.phone,
              type: 'emergency_contact',
              triggered: true,
              reason: 'Hospital accepted - coordinate with emergency services (123)'
            });
          }
          
          return res.status(200).json({
            success: true,
            message: 'Hospital accepted after emergency services called - coordination required',
            action: 'coordination_required',
            emergencyCalls: emergencyCalls,
            acceptedHospital: acceptedHospital.hospitalId,
            coordinationRequired: true,
            coordinationReason: 'Hospital accepted after emergency services called'
          });
        }
      }
      
      return res.status(200).json({
        success: true,
        message: 'Hospital has already accepted the SOS',
        action: 'none',
        acceptedHospital: acceptedHospital.hospitalId
      });
    }
    
    // Check timeout - if more than 2 minutes have passed
    const now = new Date();
    const timeSinceCreation = now - sosRequest.createdAt;
    const twoMinutes = 2 * 60 * 1000; // 2 minutes in milliseconds
    
    let action = 'none';
    let emergencyCalls = [];
    
    if (timeSinceCreation >= twoMinutes) {
      console.log(`⏰ SOS ${sosRequestId} timeout reached (${Math.round(timeSinceCreation / 1000)}s)`);
      
      // Trigger emergency calls
      action = 'emergency_calls';
      emergencyCalls = [
        {
          number: '123',
          type: 'emergency_services',
          triggered: true,
          reason: 'No hospital response within 2 minutes'
        }
      ];
      
      // Add emergency contact call if available
      if (sosRequest.emergencyContact && sosRequest.emergencyContact.phone) {
        emergencyCalls.push({
          number: sosRequest.emergencyContact.phone,
          type: 'emergency_contact',
          triggered: true,
          reason: 'Emergency contact notification'
        });
      }
      
      // Update SOS request with escalation info
      sosRequest.escalationTriggered = true;
      sosRequest.escalationTriggeredAt = now;
      sosRequest.emergencyCallsTriggered = emergencyCalls;
      await sosRequest.save();
      
      console.log(`🚨 Emergency calls triggered for SOS ${sosRequestId}:`, emergencyCalls);
    }
    
    // Check if we should retry SOS request (every 5 minutes)
    const lastRetry = sosRequest.lastRetryAt || sosRequest.createdAt;
    const timeSinceLastRetry = now - lastRetry;
    const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds
    
    let shouldRetry = false;
    if (timeSinceLastRetry >= fiveMinutes && !acceptedHospital) {
      console.log(`🔄 Retrying SOS request ${sosRequestId} (${Math.round(timeSinceLastRetry / 1000)}s since last retry)`);
      
      // Retry by updating timeout and re-notifying hospitals
      sosRequest.timeoutAt = new Date(now.getTime() + 2 * 60 * 1000); // Reset 2-minute timeout
      sosRequest.lastRetryAt = now;
      sosRequest.retryCount = (sosRequest.retryCount || 0) + 1;
      await sosRequest.save();
      
      // Re-notify hospitals
      await ensureHospitalSOSForRequest(
        sosRequest,
        { longitude: sosRequest.location.coordinates[0], latitude: sosRequest.location.coordinates[1] },
        sosRequest.address,
        sosRequest.city,
        sosRequest.state,
        sosRequest.pincode,
        sosRequest.emergencyType,
        sosRequest.description,
        sosRequest.severity
      );
      
      shouldRetry = true;
      action = action === 'none' ? 'retry' : action + '_and_retry';
      
      console.log(`🔄 SOS request ${sosRequestId} retried (attempt ${sosRequest.retryCount})`);
    }
    
    res.status(200).json({
      success: true,
      message: 'SOS escalation handled',
      data: {
        sosRequestId: sosRequestId,
        status: sosRequest.status,
        action: action,
        emergencyCalls: emergencyCalls,
        shouldRetry: shouldRetry,
        retryCount: sosRequest.retryCount || 0,
        timeSinceCreation: Math.round(timeSinceCreation / 1000),
        timeSinceLastRetry: Math.round(timeSinceLastRetry / 1000)
      }
    });
    
  } catch (error) {
    console.error('❌ Error handling SOS escalation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to handle SOS escalation',
      error: error.message
    });
  }
};

// Get SOS escalation status
const getSOSEscalationStatus = async (req, res) => {
  try {
    const { sosRequestId } = req.params;
    
    const sosRequest = await SOSRequest.findById(sosRequestId);
    if (!sosRequest) {
      return res.status(404).json({
        success: false,
        message: 'SOS request not found'
      });
    }
    
    const now = new Date();
    const timeSinceCreation = now - sosRequest.createdAt;
    const timeSinceLastRetry = sosRequest.lastRetryAt ? now - sosRequest.lastRetryAt : timeSinceCreation;
    
    // Check if any hospital has accepted
    const acceptedHospital = await HospitalSOS.findOne({
      sosRequestId: sosRequestId,
      hospitalStatus: { $in: ['accepted', 'hospitalReached', 'admitted'] }
    });
    
    res.status(200).json({
      success: true,
      data: {
        sosRequestId: sosRequestId,
        status: sosRequest.status,
        escalationTriggered: sosRequest.escalationTriggered || false,
        escalationTriggeredAt: sosRequest.escalationTriggeredAt,
        emergencyCallsTriggered: sosRequest.emergencyCallsTriggered || [],
        retryCount: sosRequest.retryCount || 0,
        lastRetryAt: sosRequest.lastRetryAt,
        timeSinceCreation: Math.round(timeSinceCreation / 1000),
        timeSinceLastRetry: Math.round(timeSinceLastRetry / 1000),
        hasAcceptedHospital: !!acceptedHospital,
        acceptedHospitalId: acceptedHospital?.hospitalId
      }
    });
    
  } catch (error) {
    console.error('❌ Error getting SOS escalation status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get SOS escalation status',
      error: error.message
    });
  }
};

// Handle coordination between emergency services and hospitals
const handleEmergencyCoordination = async (req, res) => {
  try {
    const { sosRequestId } = req.params;
    const { coordinationAction, coordinationDetails } = req.body;
    
    console.log(`🤝 Handling emergency coordination for SOS: ${sosRequestId}`);
    console.log(`📋 Coordination action: ${coordinationAction}`);
    
    // Find the SOS request
    const sosRequest = await SOSRequest.findById(sosRequestId);
    if (!sosRequest) {
      return res.status(404).json({
        success: false,
        message: 'SOS request not found'
      });
    }
    
    // Check if coordination is required
    if (!sosRequest.coordinationRequired) {
      return res.status(400).json({
        success: false,
        message: 'No coordination required for this SOS request'
      });
    }
    
    // Handle different coordination actions
    switch (coordinationAction) {
      case 'emergency_services_cancelled':
        console.log(`🚨 Emergency services (123) cancelled for SOS ${sosRequestId}`);
        
        // Update coordination status
        sosRequest.coordinationStatus = 'emergency_services_cancelled';
        sosRequest.coordinationDetails = {
          action: coordinationAction,
          details: coordinationDetails,
          updatedAt: new Date()
        };
        await sosRequest.save();
        
        // Notify emergency contact about cancellation
        let emergencyCalls = [];
        if (sosRequest.emergencyContact && sosRequest.emergencyContact.phone) {
          emergencyCalls.push({
            number: sosRequest.emergencyContact.phone,
            type: 'emergency_contact',
            triggered: true,
            reason: 'Hospital will handle - inform emergency services (123) if they arrive'
          });
        }
        
        res.status(200).json({
          success: true,
          message: 'Coordination handled - hospital will manage the case',
          data: {
            sosRequestId: sosRequestId,
            coordinationStatus: sosRequest.coordinationStatus,
            emergencyCalls: emergencyCalls,
            message: 'Hospital will handle the case. If emergency services (123) arrive, inform them that hospital is already responding.'
          }
        });
        break;
        
      case 'hospital_cancelled':
        console.log(`🏥 Hospital cancelled for SOS ${sosRequestId}`);
        
        // Update coordination status
        sosRequest.coordinationStatus = 'hospital_cancelled';
        sosRequest.coordinationDetails = {
          action: coordinationAction,
          details: coordinationDetails,
          updatedAt: new Date()
        };
        await sosRequest.save();
        
        // Emergency services (123) will continue handling
        res.status(200).json({
          success: true,
          message: 'Hospital coordination handled',
          data: {
            sosRequestId: sosRequestId,
            coordinationStatus: sosRequest.coordinationStatus,
            message: 'Emergency services (123) will continue handling the case'
          }
        });
        break;
        
      case 'both_responding':
        console.log(`🤝 Both emergency services and hospital responding for SOS ${sosRequestId}`);
        
        // Update coordination status
        sosRequest.coordinationStatus = 'both_responding';
        sosRequest.coordinationDetails = {
          action: coordinationAction,
          details: coordinationDetails,
          updatedAt: new Date()
        };
        await sosRequest.save();
        
        // Notify emergency contact about coordination
        let coordinationCalls = [];
        if (sosRequest.emergencyContact && sosRequest.emergencyContact.phone) {
          coordinationCalls.push({
            number: sosRequest.emergencyContact.phone,
            type: 'emergency_contact',
            triggered: true,
            reason: 'Both emergency services (123) and hospital responding - coordinate when they arrive'
          });
        }
        
        res.status(200).json({
          success: true,
          message: 'Coordination handled - both services responding',
          data: {
            sosRequestId: sosRequestId,
            coordinationStatus: sosRequest.coordinationStatus,
            emergencyCalls: coordinationCalls,
            message: 'Both emergency services (123) and hospital are responding. Coordinate when emergency services arrive.'
          }
        });
        break;
        
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid coordination action'
        });
    }
    
  } catch (error) {
    console.error('❌ Error handling emergency coordination:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to handle emergency coordination',
      error: error.message
    });
  }
};

// Get coordination status
const getCoordinationStatus = async (req, res) => {
  try {
    const { sosRequestId } = req.params;
    
    const sosRequest = await SOSRequest.findById(sosRequestId);
    if (!sosRequest) {
      return res.status(404).json({
        success: false,
        message: 'SOS request not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: {
        sosRequestId: sosRequestId,
        coordinationRequired: sosRequest.coordinationRequired || false,
        coordinationStatus: sosRequest.coordinationStatus || 'none',
        coordinationReason: sosRequest.coordinationReason,
        coordinationDetails: sosRequest.coordinationDetails,
        emergencyCallsTriggered: sosRequest.emergencyCallsTriggered || [],
        hasAcceptedHospital: !!await HospitalSOS.findOne({
          sosRequestId: sosRequestId,
          hospitalStatus: { $in: ['accepted', 'hospitalReached', 'admitted'] }
        })
      }
    });
    
  } catch (error) {
    console.error('❌ Error getting coordination status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get coordination status',
      error: error.message
    });
  }
};

// Discharge patient from hospital
const dischargePatient = async (req, res) => {
  try {
    const { hospitalId } = req.params;
    const { sosRequestId, dischargeDetails } = req.body;
    
    console.log(`🏥 Discharging patient from hospital: ${hospitalId}`);
    console.log(`📋 SOS Request ID: ${sosRequestId}`);
    console.log(`📋 Discharge Details:`, dischargeDetails);
    
    // Find the SOS request
    const sosRequest = await SOSRequest.findById(sosRequestId);
    if (!sosRequest) {
      return res.status(404).json({
        success: false,
        message: 'SOS request not found'
      });
    }
    
    // Find the hospital SOS record
    const hospitalSOS = await HospitalSOS.findOne({
      sosRequestId: sosRequestId,
      hospitalId: hospitalId
    });
    
    if (!hospitalSOS) {
      return res.status(404).json({
        success: false,
        message: 'Hospital SOS record not found'
      });
    }
    
    // Check if patient is actually admitted
    if (hospitalSOS.hospitalStatus !== 'admitted') {
      return res.status(400).json({
        success: false,
        message: 'Patient is not admitted to this hospital'
      });
    }
    
    // Update hospital SOS status to discharged
    hospitalSOS.hospitalStatus = 'discharged';
    hospitalSOS.dischargeDetails = {
      dischargedAt: new Date(),
      dischargedBy: req.user.uid, // Hospital staff who discharged
      dischargeReason: dischargeDetails.dischargeReason || 'Treatment completed',
      dischargeNotes: dischargeDetails.dischargeNotes || '',
      followUpRequired: dischargeDetails.followUpRequired || false,
      followUpDate: dischargeDetails.followUpDate || null,
      medications: dischargeDetails.medications || [],
      instructions: dischargeDetails.instructions || ''
    };
    
    await hospitalSOS.save();
    
    // Update main SOS request status
    sosRequest.status = 'discharged';
    sosRequest.dischargedAt = new Date();
    sosRequest.dischargedBy = hospitalId;
    await sosRequest.save();
    
    // Update all other hospitals to show patient discharged
    await HospitalSOS.updateMany(
      {
        sosRequestId: sosRequestId,
        hospitalId: { $ne: hospitalId }
      },
      {
        $set: {
          hospitalStatus: 'patientDischarged',
          patientDischargedAt: new Date(),
          dischargedByHospital: hospitalId
        }
      }
    );
    
    console.log(`✅ Patient successfully discharged from hospital ${hospitalId}`);
    
    res.status(200).json({
      success: true,
      message: 'Patient discharged successfully',
      data: {
        sosRequestId: sosRequestId,
        hospitalId: hospitalId,
        dischargeDetails: hospitalSOS.dischargeDetails,
        dischargedAt: hospitalSOS.dischargeDetails.dischargedAt,
        status: 'discharged'
      }
    });
    
  } catch (error) {
    console.error('❌ Error discharging patient:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to discharge patient',
      error: error.message
    });
  }
};

};

// Send alert to specific hospital
const sendHospitalAlert = async (req, res) => {
  try {
    const {
      hospitalId,
      hospitalName,
      patientId,
      patientName,
      patientPhone,
      location,
      address,
      alertType,
      timestamp
    } = req.body;

    // Validate required fields
    if (!hospitalId || !patientId) {
      return res.status(400).json({
        success: false,
        message: 'Hospital ID and Patient ID are required'
      });
    }

    // Find the hospital
    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) {
      return res.status(404).json({
        success: false,
        message: 'Hospital not found'
      });
    }

    // Create hospital alert record
    const hospitalAlert = new HospitalAlert({
      hospitalId,
      hospitalName: hospitalName || hospital.hospitalName,
      patientId,
      patientName,
      patientPhone,
      location: {
        type: 'Point',
        coordinates: [location.longitude, location.latitude]
      },
      address,
      alertType: alertType || 'direct_hospital_alert',
      status: 'pending',
      timestamp: new Date(timestamp),
      createdAt: new Date()
    });

    await hospitalAlert.save();

    // Send notification to hospital (you can implement FCM here)
    // For now, we'll just log it
    console.log(`🚨 Direct alert sent to hospital: ${hospital.hospitalName}`);
    console.log(`📍 Patient: ${patientName} (${patientPhone})`);
    console.log(`📍 Location: ${address}`);

    res.json({
      success: true,
      message: 'Alert sent to hospital successfully',
      data: {
        alertId: hospitalAlert._id,
        hospitalName: hospital.hospitalName,
        timestamp: hospitalAlert.createdAt
      }
    });

  } catch (error) {
    console.error('❌ Error sending hospital alert:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send hospital alert',
      error: error.message
    });
  }
};

module.exports = {
  createSOSRequest,
  getHospitalSOSRequests,
  acceptSOSRequest,
  markPatientAdmitted,
  confirmPatientAdmission,
  confirmHospitalReached,
  getPatientSOSHistory,
  cancelSOSRequest,
  getSOSStatistics,
  getSOSRequestById,
  handleSOSEscalation,
  getSOSEscalationStatus,
  handleEmergencyCoordination,
  getCoordinationStatus,
  dischargePatient,
  synchronizeHospitalCoordinates,
  sendHospitalAlert,
};

