const mongoose = require('mongoose');

const providerRatingSchema = new mongoose.Schema({
  appointmentId: {
    type: String,
    required: true,
    index: true,
    unique: true,
  },
  userId: {
    type: String,
    required: true,
    index: true,
  },
  providerType: {
    type: String,
    enum: ['hospital', 'doctor'],
    required: true,
    index: true,
  },
  providerId: {
    type: String,
    required: true,
    index: true,
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
  review: {
    type: String,
    maxlength: 500,
    default: '',
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

providerRatingSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('ProviderRating', providerRatingSchema);


