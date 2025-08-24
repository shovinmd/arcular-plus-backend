const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const path = require('path');
const session = require('express-session');
require('dotenv').config();

// Import Firebase Admin (already initialized in firebase.js)
const admin = require('./firebase');

// Import routes
const userRoutes = require('./routes/userRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const medicationRoutes = require('./routes/medicationRoutes');
const reportRoutes = require('./routes/reportRoutes');
const doctorRoutes = require('./routes/doctorRoutes');
const prescriptionRoutes = require('./routes/prescriptionRoutes');
const labReportRoutes = require('./routes/labReportRoutes');
const pregnancyRoutes = require('./routes/pregnancyRoutes');
const menstrualRoutes = require('./routes/menstrualRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const sosRoutes = require('./routes/sosRoutes');
const qrRoutes = require('./routes/qrRoutes');
const hospitalRoutes = require('./routes/hospitalRoutes');
const adminRoutes = require('./routes/adminRoutes');
const arcStaffRoutes = require('./routes/arcStaffRoutes');
const nurseRoutes = require('./routes/nurseRoutes');
const pharmacyRoutes = require('./routes/pharmacyRoutes');
const labRoutes = require('./routes/labRoutes');

// Import web interface routes
const adminWebRoutes = require('./routes/adminWebRoutes');
const staffWebRoutes = require('./routes/staffWebRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(compression());
app.use(morgan('combined'));
app.use(cors({
  origin: [
    'https://arcular-plus-sup-admin-staffs-hown.vercel.app',
    'https://arcular-plus-sup-admin-staffs-xdw9.vercel.app',
    'https://arcular-plus-sup-admin-staffs.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'http://127.0.0.1:3000',
    'null' // Allow file:// protocol for local testing
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Origin', 'Accept'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'arcular-plus-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api/users', userRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/medications', medicationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/lab-reports', labReportRoutes);
app.use('/api/pregnancy', pregnancyRoutes);
app.use('/api/menstrual-cycle', menstrualRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/sos', sosRoutes);
app.use('/api/users/qr', qrRoutes);
app.use('/api/hospitals', hospitalRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/arc-staff', arcStaffRoutes);
app.use('/api/nurses', nurseRoutes);
app.use('/api/pharmacies', pharmacyRoutes);
app.use('/api/labs', labRoutes);

// Web Interface Routes
app.use('/admin', adminWebRoutes);
app.use('/staff', staffWebRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Arcular+ Backend is running',
    timestamp: new Date().toISOString(),
    firebaseAdmin: admin.apps.length > 0 ? 'Initialized' : 'Not Initialized'
  });
});

// Test Firebase Admin endpoint
app.get('/api/test-firebase', async (req, res) => {
  try {
    if (admin.apps.length === 0) {
      return res.status(500).json({ 
        error: 'Firebase Admin not initialized',
        apps: admin.apps.length
      });
    }
    
    // Test if we can list users (this will fail if not properly configured)
    const listUsersResult = await admin.auth().listUsers(1);
    
    res.json({ 
      status: 'OK', 
      message: 'Firebase Admin is working',
      firebaseApps: admin.apps.length,
      canListUsers: true,
      userCount: listUsersResult.users.length
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Firebase Admin test failed',
      message: error.message,
      firebaseApps: admin.apps.length
    });
  }
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
