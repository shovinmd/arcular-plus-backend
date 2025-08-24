const express = require('express');
const adminController = require('../controllers/adminWebController');
const router = express.Router();

// Admin web interface routes
router.get('/login', adminController.getLoginPage);
router.post('/login', adminController.login);
router.get('/dashboard', adminController.getDashboard);
router.get('/staff', adminController.getStaffList);
router.post('/staff', adminController.createStaff);
router.put('/staff/:id', adminController.updateStaff);
router.delete('/staff/:id', adminController.deleteStaff);

// Staff management
router.get('/staff/create', adminController.getCreateStaffPage);
router.get('/staff/:id/edit', adminController.getEditStaffPage);

// System overview
router.get('/overview', adminController.getSystemOverview);
router.get('/analytics', adminController.getAnalytics);

module.exports = router;
