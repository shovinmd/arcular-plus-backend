const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const path = require('path');
require('dotenv').config();

// Import routes
const userRoutes = require('./routes/userRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const medicationRoutes = require('./routes/medicationRoutes');
const reportRoutes = require('./routes/reportRoutes');
const doctorRoutes = require('./routes/doctorRoutes');
const labReportRoutes = require('./routes/labReportRoutes');
const pregnancyRoutes = require('./routes/pregnancyRoutes');
const menstrualRoutes = require('./routes/menstrualRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const sosRoutes = require('./routes/sosRoutes');
const qrRoutes = require('./routes/qrRoutes');
const hospitalRoutes = require('./routes/hospitalRoutes');
const adminRoutes = require('./routes/adminRoutes');
const arcStaffRoutes = require('./routes/arcStaffRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(compression());
app.use(morgan('combined'));
app.use(cors({
  origin: '*', // or specify your frontend URL
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/users', userRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/medications', medicationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/lab-reports', labReportRoutes);
app.use('/api/pregnancy', pregnancyRoutes);
app.use('/api/menstrual-cycle', menstrualRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/sos', sosRoutes);
app.use('/api/users/qr', qrRoutes);
app.use('/api/hospitals', hospitalRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/arc-staff', arcStaffRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Arcular+ Backend is running',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Connect to MongoDB
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/arcular_plus';
    await mongoose.connect(mongoURI);
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
};

// Start server
const startServer = async () => {
  await connectDB();
  
  app.listen(PORT, () => {
    console.log(`🚀 Arcular+ Backend server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  });
};

startServer(); 
