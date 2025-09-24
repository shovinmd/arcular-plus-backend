const Hospital = require('../models/Hospital');

// Update hospital geo location (and optional address fields) from dashboard/app
// Accepts either hospital UID or MongoDB ObjectId in :hospitalId
// Body: { latitude, longitude, address, city, state, pincode }
exports.updateHospitalLocation = async (req, res) => {
  try {
    const { hospitalId } = req.params;
    const { latitude, longitude, address, city, state, pincode } = req.body || {};

    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return res.status(400).json({ success: false, error: 'latitude and longitude are required as numbers' });
    }

    // Resolve hospital by uid first, then by _id
    let hospital = await Hospital.findOne({ uid: hospitalId });
    if (!hospital) {
      const mongoose = require('mongoose');
      if (mongoose.isValidObjectId(hospitalId)) {
        hospital = await Hospital.findById(hospitalId);
      }
    }

    if (!hospital) {
      return res.status(404).json({ success: false, error: 'Hospital not found' });
    }

    // Update GeoJSON location and legacy fields for compatibility
    hospital.location = {
      type: 'Point',
      coordinates: [Number(longitude), Number(latitude)], // [lng, lat]
    };
    hospital.longitude = Number(longitude);
    hospital.latitude = Number(latitude);
    hospital.geoCoordinates = { lng: Number(longitude), lat: Number(latitude) };

    if (address) hospital.address = address;
    if (city) hospital.city = city;
    if (state) hospital.state = state;
    if (pincode) hospital.pincode = pincode;

    await hospital.save();

    return res.json({
      success: true,
      message: 'Hospital location updated',
      data: {
        uid: hospital.uid,
        id: hospital._id,
        location: hospital.location,
        city: hospital.city,
        state: hospital.state,
        pincode: hospital.pincode,
      },
    });
  } catch (error) {
    console.error('❌ Error updating hospital location:', error);
    return res.status(500).json({ success: false, error: 'Failed to update hospital location' });
  }
};


