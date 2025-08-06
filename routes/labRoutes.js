const express = require('express');
const router = express.Router();
const labController = require('../controllers/labController');
const { authenticateToken } = require('../middleware/auth');

// Public routes
router.post('/register', labController.registerLab);
router.get('/all', labController.getAllLabs);
router.get('/city/:city', labController.getLabsByCity);
router.get('/service/:service', labController.getLabsByService);

// Protected routes
router.get('/:id', authenticateToken, labController.getLabById);
router.get('/uid/:uid', authenticateToken, labController.getLabByUID);
router.put('/:id', authenticateToken, labController.updateLab);
router.delete('/:id', authenticateToken, labController.deleteLab);

// Admin routes
router.get('/admin/pending', authenticateToken, labController.getPendingApprovals);
router.post('/admin/approve/:id', authenticateToken, labController.approveLab);
router.post('/admin/reject/:id', authenticateToken, labController.rejectLab);

module.exports = router; 