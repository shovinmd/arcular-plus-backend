const express = require('express');
const router = express.Router();
const ratingController = require('../controllers/ratingController');
const firebaseAuthMiddleware = require('../middleware/firebaseAuthMiddleware');

// Submit rating for an order (requires authentication)
router.post('/submit', firebaseAuthMiddleware, ratingController.submitRating);

// Get ratings for a pharmacy (public)
router.get('/pharmacy/:pharmacyId', ratingController.getPharmacyRatings);

// Get user's ratings (requires authentication)
router.get('/user', firebaseAuthMiddleware, ratingController.getUserRatings);

// Get pharmacy rating summary (public)
router.get('/pharmacy/:pharmacyId/summary', ratingController.getPharmacyRatingSummary);

module.exports = router;
