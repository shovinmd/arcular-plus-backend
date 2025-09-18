const Rating = require('../models/Rating');
const Order = require('../models/Order');
const User = require('../models/User');
const Pharmacy = require('../models/Pharmacy');
const ProviderRating = require('../models/ProviderRating');
const Hospital = require('../models/Hospital');
const Doctor = require('../models/Doctor');

// Submit rating for an order
const submitRating = async (req, res) => {
  try {
    const { orderId, rating, review, medicineRatings } = req.body;
    const userId = req.user.uid;

    // Validate input
    if (!orderId || !rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Invalid rating data'
      });
    }

    // Check if order exists and belongs to user
    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (order.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to rate this order'
      });
    }

    // Check if order is delivered
    if (order.status !== 'Delivered') {
      return res.status(400).json({
        success: false,
        message: 'Can only rate delivered orders'
      });
    }

    // Check if already rated
    const existingRating = await Rating.findOne({ orderId });
    if (existingRating) {
      return res.status(400).json({
        success: false,
        message: 'Order already rated'
      });
    }

    // Get user and pharmacy info
    const user = await User.findOne({ uid: userId });
    const pharmacy = await Pharmacy.findOne({ uid: order.pharmacyId });

    // Create rating
    const newRating = new Rating({
      orderId,
      userId,
      pharmacyId: order.pharmacyId,
      rating,
      review: review || '',
      medicineRatings: medicineRatings || []
    });

    await newRating.save();

    // Update pharmacy average rating
    await updatePharmacyRating(order.pharmacyId);

    console.log(`⭐ Rating submitted for order ${orderId}: ${rating} stars`);

    res.json({
      success: true,
      message: 'Rating submitted successfully',
      data: newRating
    });

  } catch (error) {
    console.error('❌ Error submitting rating:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit rating',
      error: error.message
    });
  }
};

// Get ratings for a pharmacy
const getPharmacyRatings = async (req, res) => {
  try {
    const { pharmacyId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    console.log('🔍 Fetching ratings for pharmacy:', pharmacyId);

    // First, try to find pharmacy by UID to get MongoDB ID
    const Pharmacy = require('../models/Pharmacy');
    let pharmacy = await Pharmacy.findOne({ uid: pharmacyId });
    
    if (!pharmacy) {
      // If not found by UID, try by MongoDB ObjectId
      const mongoose = require('mongoose');
      if (mongoose.Types.ObjectId.isValid(pharmacyId)) {
        pharmacy = await Pharmacy.findById(pharmacyId);
      }
    }
    
    if (!pharmacy) {
      console.log('❌ Pharmacy not found:', pharmacyId);
      return res.status(404).json({
        success: false,
        message: 'Pharmacy not found'
      });
    }

    console.log('✅ Found pharmacy:', pharmacy.pharmacyName, 'MongoDB ID:', pharmacy._id);

    const skip = (page - 1) * limit;

    // Find ratings by pharmacy MongoDB ID
    const ratings = await Rating.find({ pharmacyId: pharmacy._id })
      .populate('userId', 'fullName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Rating.countDocuments({ pharmacyId: pharmacy._id });

    console.log(`✅ Found ${ratings.length} ratings for pharmacy ${pharmacy.pharmacyName}`);

    res.json({
      success: true,
      data: {
        ratings,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching pharmacy ratings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ratings',
      error: error.message
    });
  }
};

// Get user's ratings
const getUserRatings = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { page = 1, limit = 10 } = req.query;

    const skip = (page - 1) * limit;

    const ratings = await Rating.find({ userId })
      .populate('pharmacyId', 'pharmacyName location')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Rating.countDocuments({ userId });

    res.json({
      success: true,
      data: {
        ratings,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching user ratings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ratings',
      error: error.message
    });
  }
};

// Get user's provider ratings
const getUserProviderRatings = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { appointmentId, providerType, providerId } = req.query;

    let query = { userId };
    if (appointmentId) query.appointmentId = appointmentId;
    if (providerType) query.providerType = providerType;
    if (providerId) query.providerId = providerId;

    const ratings = await ProviderRating.find(query)
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: ratings
    });
  } catch (error) {
    console.error('❌ Error fetching user provider ratings:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch user provider ratings' });
  }
};

// Update pharmacy average rating
const updatePharmacyRating = async (pharmacyId) => {
  try {
    const ratings = await Rating.find({ pharmacyId });
    
    if (ratings.length === 0) return;

    const totalRating = ratings.reduce((sum, rating) => sum + rating.rating, 0);
    const averageRating = totalRating / ratings.length;

    await Pharmacy.findOneAndUpdate(
      { uid: pharmacyId },
      { 
        averageRating: Math.round(averageRating * 10) / 10,
        totalRatings: ratings.length
      }
    );

    console.log(`📊 Updated pharmacy ${pharmacyId} rating: ${averageRating.toFixed(1)}/5 (${ratings.length} ratings)`);

  } catch (error) {
    console.error('❌ Error updating pharmacy rating:', error);
  }
};

// Get pharmacy rating summary
const getPharmacyRatingSummary = async (req, res) => {
  try {
    const { pharmacyId } = req.params;
    
    console.log('🔍 Fetching rating summary for pharmacy:', pharmacyId);

    // First, try to find pharmacy by UID to get MongoDB ID
    const Pharmacy = require('../models/Pharmacy');
    let pharmacy = await Pharmacy.findOne({ uid: pharmacyId });
    
    if (!pharmacy) {
      // If not found by UID, try by MongoDB ObjectId
      const mongoose = require('mongoose');
      if (mongoose.Types.ObjectId.isValid(pharmacyId)) {
        pharmacy = await Pharmacy.findById(pharmacyId);
      }
    }
    
    if (!pharmacy) {
      console.log('❌ Pharmacy not found:', pharmacyId);
      return res.status(404).json({
        success: false,
        message: 'Pharmacy not found'
      });
    }

    console.log('✅ Found pharmacy:', pharmacy.pharmacyName, 'MongoDB ID:', pharmacy._id);
    
    // Find ratings by pharmacy MongoDB ID
    const ratings = await Rating.find({ pharmacyId: pharmacy._id });
    
    console.log(`✅ Found ${ratings.length} ratings for pharmacy ${pharmacy.pharmacyName}`);
    
    if (ratings.length === 0) {
      return res.json({
        success: true,
        data: {
          averageRating: 0,
          totalRatings: 0,
          ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
        }
      });
    }

    const totalRating = ratings.reduce((sum, rating) => sum + rating.rating, 0);
    const averageRating = totalRating / ratings.length;

    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    ratings.forEach(rating => {
      ratingDistribution[rating.rating]++;
    });

    res.json({
      success: true,
      data: {
        averageRating: Math.round(averageRating * 10) / 10,
        totalRatings: ratings.length,
        ratingDistribution
      }
    });

  } catch (error) {
    console.error('❌ Error fetching pharmacy rating summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch rating summary',
      error: error.message
    });
  }
};

// Submit rating for hospital or doctor after appointment
const submitProviderRating = async (req, res) => {
  try {
    const { appointmentId, providerType, providerId, rating, review } = req.body;
    const userId = req.user.uid;

    console.log('📝 Submitting provider rating:', {
      appointmentId,
      providerType,
      providerId,
      rating,
      review,
      userId
    });

    console.log('🔍 Validating provider type...');
    if (!['hospital', 'doctor'].includes(providerType)) {
      console.log('❌ Invalid provider type:', providerType);
      return res.status(400).json({ success: false, message: 'Invalid provider type' });
    }
    
    console.log('🔍 Validating required fields...');
    if (!appointmentId || !providerId || !rating || rating < 1 || rating > 5) {
      console.log('❌ Missing or invalid fields:', { appointmentId, providerId, rating });
      return res.status(400).json({ success: false, message: 'Missing or invalid fields' });
    }

    console.log('🔍 Checking for existing rating...');
    
    // Convert Firebase UID to appropriate format for lookup
    let lookupProviderId = providerId;
    
    if (providerType === 'hospital') {
      const Hospital = require('../models/Hospital');
      const hospital = await Hospital.findOne({ uid: providerId });
      if (hospital) {
        lookupProviderId = hospital._id.toString();
      }
    } else if (providerType === 'doctor') {
      const User = require('../models/User');
      const doctor = await User.findOne({ uid: providerId });
      if (doctor) {
        lookupProviderId = doctor._id.toString();
      }
    }
    
    // Check if this specific provider type is already rated for this appointment by this user
    const existing = await ProviderRating.findOne({ 
      appointmentId, 
      providerType, 
      providerId: lookupProviderId,
      userId
    });
    if (existing) {
      console.log('❌ Rating already exists for this appointment and provider by this user');
      return res.status(400).json({ 
        success: false, 
        message: `You have already rated this ${providerType} for this appointment`,
        existingRating: {
          rating: existing.rating,
          review: existing.review,
          createdAt: existing.createdAt
        }
      });
    }

    // Check if appointment exists and is completed
    const Appointment = require('../models/Appointment');
    const appointment = await Appointment.findOne({ 
      $or: [
        { _id: appointmentId },
        { appointmentId: appointmentId }
      ]
    });
    
    if (!appointment) {
      console.log('❌ Appointment not found:', appointmentId);
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    if (appointment.appointmentStatus !== 'completed') {
      console.log('❌ Appointment not completed:', appointment.appointmentStatus);
      return res.status(400).json({
        success: false,
        message: 'Can only rate completed appointments'
      });
    }
    console.log('✅ No existing rating found, proceeding...');

    // Convert Firebase UID to appropriate format for storage
    let storageProviderId = providerId;
    
    if (providerType === 'hospital') {
      const Hospital = require('../models/Hospital');
      const hospital = await Hospital.findOne({ uid: providerId });
      if (hospital) {
        storageProviderId = hospital._id.toString();
        console.log('🏥 Converted hospital UID to MongoDB _id:', storageProviderId);
      }
    } else if (providerType === 'doctor') {
      const User = require('../models/User');
      const doctor = await User.findOne({ uid: providerId });
      if (doctor) {
        storageProviderId = doctor._id.toString();
        console.log('👨‍⚕️ Converted doctor UID to MongoDB _id:', storageProviderId);
      }
    }

    console.log('💾 Creating ProviderRating document...');
    const pr = new ProviderRating({
      appointmentId,
      userId,
      providerType,
      providerId: storageProviderId, // Use converted ID for storage
      rating,
      review: review || ''
    });
    
    console.log('💾 Saving ProviderRating to database...');
    await pr.save();
    console.log('✅ ProviderRating saved successfully');

    // Update aggregate on provider doc if available
    const Model = providerType === 'hospital' ? Hospital : Doctor;
    if (Model) {
      try {
        const all = await ProviderRating.find({ providerType, providerId: storageProviderId });
        const avg = all.reduce((s, r) => s + r.rating, 0) / all.length;
        
        console.log(`🔍 Looking for ${providerType} with UID: ${providerId}`);
        
        // Try to find by UID first
        let updateResult = await Model.findOneAndUpdate(
          { uid: providerId },
          { averageRating: Math.round(avg * 10) / 10, totalRatings: all.length }
        );
        
        // If not found by UID, try by MongoDB _id
        if (!updateResult) {
          console.log(`⚠️ ${providerType} with UID ${providerId} not found, trying MongoDB _id`);
          updateResult = await Model.findByIdAndUpdate(
            providerId,
            { averageRating: Math.round(avg * 10) / 10, totalRatings: all.length }
          );
        }
        
        console.log(`📊 Updated ${providerType} ${providerId} rating: ${Math.round(avg * 10) / 10}/5 (${all.length} ratings)`);
        if (!updateResult) {
          console.log(`⚠️ ${providerType} with ID ${providerId} not found for rating update`);
        }
      } catch (updateError) {
        console.error(`❌ Error updating ${providerType} rating aggregate:`, updateError);
        // Don't fail the entire request if aggregate update fails
      }
    }

    res.json({ success: true, message: 'Provider rating submitted', data: pr });
  } catch (error) {
    console.error('❌ Error submitting provider rating:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to submit rating',
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Get ratings for a provider
const getProviderRatings = async (req, res) => {
  try {
    const { providerType, providerId } = req.params;
    const ratings = await ProviderRating.find({ providerType, providerId })
      .sort({ createdAt: -1 });
    res.json({ success: true, data: ratings });
  } catch (error) {
    console.error('❌ Error fetching provider ratings:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch ratings' });
  }
};

// Rating summary for a provider
const getProviderRatingSummary = async (req, res) => {
  try {
    const { providerType, providerId } = req.params;
    
    console.log('🔍 Fetching rating summary for:', { providerType, providerId });
    
    // Try to find ratings by providerId directly first
    let ratings = await ProviderRating.find({ providerType, providerId });
    
    // If no ratings found and this is a hospital, try to find by UID
    if (ratings.length === 0 && providerType === 'hospital') {
      console.log('🔍 No ratings found by providerId, checking if this is a Firebase UID...');
      
      // Check if this providerId is a Firebase UID by looking up the hospital
      const Hospital = require('../models/Hospital');
      const hospital = await Hospital.findOne({ uid: providerId });
      
      if (hospital) {
        console.log('✅ Found hospital by UID, looking for ratings by MongoDB _id:', hospital._id);
        ratings = await ProviderRating.find({ providerType, providerId: hospital._id.toString() });
      }
    }
    
    // If no ratings found and this is a doctor, try to find by UID
    if (ratings.length === 0 && providerType === 'doctor') {
      console.log('🔍 No ratings found by providerId, checking if this is a Firebase UID...');
      
      // Check if this providerId is a Firebase UID by looking up the doctor
      const User = require('../models/User');
      const doctor = await User.findOne({ uid: providerId });
      
      if (doctor) {
        console.log('✅ Found doctor by UID, looking for ratings by MongoDB _id:', doctor._id);
        ratings = await ProviderRating.find({ providerType, providerId: doctor._id.toString() });
      }
    }
    
    const avg = ratings.length
      ? Math.round((ratings.reduce((s, r) => s + r.rating, 0) / ratings.length) * 10) / 10
      : 0;
    
    console.log(`📊 Rating summary for ${providerType} ${providerId}: ${avg}/5 (${ratings.length} ratings)`);
    
    res.json({ success: true, data: { averageRating: avg, totalRatings: ratings.length } });
  } catch (error) {
    console.error('❌ Error fetching provider rating summary:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch rating summary' });
  }
};

module.exports = {
  submitRating,
  getPharmacyRatings,
  getUserRatings,
  getUserProviderRatings,
  getPharmacyRatingSummary,
  updatePharmacyRating,
  submitProviderRating,
  getProviderRatings,
  getProviderRatingSummary
};
