const express = require('express');
const router = express.Router();
const ratingController = require('../controllers/ratingController');
const firebaseAuthMiddleware = require('../middleware/firebaseAuthMiddleware');

// Submit rating for an order (requires authentication)
router.post('/submit', firebaseAuthMiddleware, ratingController.submitRating);

// Get ratings for a pharmacy (public)
router.get('/pharmacy/:pharmacyId', ratingController.getPharmacyRatings);

// Provider (Hospital/Doctor) ratings
router.post('/provider/submit', firebaseAuthMiddleware, ratingController.submitProviderRating);
router.get('/provider/:providerId/:providerType', ratingController.getProviderRatings);
router.get('/provider/:providerId/:providerType/summary', ratingController.getProviderRatingSummary);

// Get user's ratings (requires authentication)
router.get('/user', firebaseAuthMiddleware, ratingController.getUserRatings);

// Get pharmacy rating summary (public)
router.get('/pharmacy/:pharmacyId/summary', ratingController.getPharmacyRatingSummary);

module.exports = router;
