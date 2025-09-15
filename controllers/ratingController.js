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

    const skip = (page - 1) * limit;

    const ratings = await Rating.find({ pharmacyId })
      .populate('userId', 'fullName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Rating.countDocuments({ pharmacyId });

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
    
    const ratings = await Rating.find({ pharmacyId });
    
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

    if (!['hospital', 'doctor'].includes(providerType)) {
      return res.status(400).json({ success: false, message: 'Invalid provider type' });
    }
    if (!appointmentId || !providerId || !rating) {
      return res.status(400).json({ success: false, message: 'Missing fields' });
    }

    // Check if this specific provider type is already rated for this appointment
    const existing = await ProviderRating.findOne({ 
      appointmentId, 
      providerType, 
      providerId 
    });
    if (existing) {
      return res.status(400).json({ 
        success: false, 
        message: `${providerType.charAt(0).toUpperCase() + providerType.slice(1)} already rated for this appointment` 
      });
    }

    const pr = new ProviderRating({
      appointmentId,
      userId,
      providerType,
      providerId,
      rating,
      review: review || ''
    });
    await pr.save();

    // Update aggregate on provider doc if available
    const Model = providerType === 'hospital' ? Hospital : Doctor;
    if (Model) {
      const all = await ProviderRating.find({ providerType, providerId });
      const avg = all.reduce((s, r) => s + r.rating, 0) / all.length;
      const updateResult = await Model.findOneAndUpdate(
        { uid: providerId },
        { averageRating: Math.round(avg * 10) / 10, totalRatings: all.length }
      );
      console.log(`📊 Updated ${providerType} ${providerId} rating: ${Math.round(avg * 10) / 10}/5 (${all.length} ratings)`);
      if (!updateResult) {
        console.log(`⚠️ ${providerType} with UID ${providerId} not found for rating update`);
      }
    }

    res.json({ success: true, message: 'Provider rating submitted', data: pr });
  } catch (error) {
    console.error('❌ Error submitting provider rating:', error);
    res.status(500).json({ success: false, message: 'Failed to submit rating' });
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
    const ratings = await ProviderRating.find({ providerType, providerId });
    const avg = ratings.length
      ? Math.round((ratings.reduce((s, r) => s + r.rating, 0) / ratings.length) * 10) / 10
      : 0;
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
  getPharmacyRatingSummary,
  updatePharmacyRating,
  submitProviderRating,
  getProviderRatings,
  getProviderRatingSummary
};
