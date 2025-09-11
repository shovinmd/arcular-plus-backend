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
const { admin, testFirebaseConnection, isStorageAvailable } = require('./firebase');

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
const fcmRoutes = require('./routes/fcmRoutes');
const sosRoutes = require('./routes/sosRoutes');
const qrRoutes = require('./routes/qrRoutes');
const hospitalRoutes = require('./routes/hospitalRoutes');
const adminRoutes = require('./routes/adminRoutes');
const arcStaffRoutes = require('./routes/arcStaffRoutes');
const nurseRoutes = require('./routes/nurseRoutes');
const pharmacyRoutes = require('./routes/pharmacyRoutes');
const labRoutes = require('./routes/labRoutes');
const healthHistoryRoutes = require('./routes/healthHistoryRoutes');
const orderRoutes = require('./routes/orderRoutes');
const pharmacyInventoryRoutes = require('./routes/pharmacyInventoryRoutes');
const medicineRoutes = require('./routes/medicineRoutes');

// Import web interface routes
const adminWebRoutes = require('./routes/adminWebRoutes');
const staffWebRoutes = require('./routes/staffWebRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(compression());
app.use(morgan('combined'));

// CORS configuration - more permissive for development
if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
  // Development: Allow all origins
  app.use(cors({
    origin: true, // Allow all origins
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Origin', 'Accept', 'Access-Control-Allow-Origin'],
    preflightContinue: false,
    optionsSuccessStatus: 204
  }));
  console.log('🌍 Development mode: CORS allows all origins');
} else {
  // Production: Restrict to specific origins
  app.use(cors({
    origin: [
      'https://arcular-plus-sup-admin-staffs-hown.vercel.app',
      'https://arcular-plus-sup-admin-staffs-xdw9.vercel.app',
      'https://arcular-plus-sup-admin-staffs.vercel.app',
      'https://arcular-plus-staffs.vercel.app',
      'https://arcular-plus-backend-man-65aq.vercel.app',
      'https://arcular-plus-backend-man.vercel.app',
      'http://localhost:55853',
      'http://localhost:3000',
      'http://localhost:59123',
      'http://localhost:64413',
      'http://127.0.0.1:5500',
      'http://127.0.0.1:3000',
      'http://localhost:8080',
      'http://localhost:8000',
      'http://localhost:5000',
      'http://localhost:4000',
      'http://localhost:55383',
      'http://localhost:3002',
      'http://localhost:3003',
      'http://localhost:3004',
      'http://localhost:3005',
      'http://localhost:3006',
      'http://localhost:3007',
      'http://localhost:3008',
      'http://localhost:3009',
      'http://localhost:3010',
      'null'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Origin', 'Accept', 'Access-Control-Allow-Origin'],
    preflightContinue: false,
    optionsSuccessStatus: 204
  }));
  console.log('🌍 Production mode: CORS restricted to specific origins');
}

// Additional CORS headers for preflight requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.status(200).end();
    return;
  }
  
  next();
});
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
app.use('/api/fcm', fcmRoutes);
app.use('/api/sos', sosRoutes);
app.use('/api/users/qr', qrRoutes);
app.use('/api/hospitals', hospitalRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/arc-staff', arcStaffRoutes);
app.use('/api/nurses', nurseRoutes);
app.use('/api/pharmacies', pharmacyRoutes);
app.use('/api/labs', labRoutes);
app.use('/api/health-history', healthHistoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/pharmacy-inventory', pharmacyInventoryRoutes);
app.use('/api/medicines', medicineRoutes);

// Test endpoint to verify CORS
app.get('/api/test-cors', (req, res) => {
  res.json({ 
    message: 'CORS test successful!', 
    timestamp: new Date().toISOString(),
    origin: req.headers.origin,
    userAgent: req.headers['user-agent']
  });
});

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
    const testResult = await testFirebaseConnection();
    
    if (testResult.success) {
      res.json({ 
        status: 'OK', 
        message: testResult.message,
        firebaseApps: admin.apps.length,
        canListUsers: true,
        userCount: testResult.userCount
      });
    } else {
      res.status(500).json({ 
        error: 'Firebase Admin test failed',
        message: testResult.error,
        suggestion: testResult.suggestion,
        firebaseApps: admin.apps.length
      });
    }
  } catch (error) {
    res.status(500).json({ 
      error: 'Firebase Admin test failed',
      message: error.message,
      firebaseApps: admin.apps.length,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Simple Firebase Admin status endpoint
app.get('/api/firebase-status', (req, res) => {
  res.json({
    status: 'OK',
    firebaseApps: admin.apps.length,
    firebaseInitialized: admin.apps.length > 0,
    projectId: admin.apps[0]?.options?.projectId || 'Unknown',
    storageAvailable: isStorageAvailable(),
    timestamp: new Date().toISOString()
  });
});

// Test Firebase Storage endpoint
app.get('/api/test-firebase-storage', (req, res) => {
  try {
    if (!isStorageAvailable()) {
      return res.status(500).json({
        error: 'Firebase Storage not available',
        message: 'Firebase Storage is not configured or available',
        suggestion: 'Check Firebase project settings and ensure Storage is enabled'
      });
    }
    
    const bucket = admin.storage().bucket();
    res.json({
      status: 'OK',
      message: 'Firebase Storage is working',
      bucketName: bucket.name,
      storageAvailable: true
    });
  } catch (error) {
    res.status(500).json({
      error: 'Firebase Storage test failed',
      message: error.message,
      storageAvailable: false
    });
  }
});

// Simple ping endpoint for health checks
app.get("/ping", (req, res) => {
  res.json({ status: "UP", timestamp: Date.now() });
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

// Import cron service
const cronService = require('./services/cronService');
const { startCleanupScheduler } = require('./services/cleanupService');

// Start server
const startServer = async () => {
  await connectDB();
  
  // Initialize cron service for menstrual reminders
  try {
    await cronService.initialize();
    console.log('✅ Cron service initialized for menstrual reminders');
  } catch (error) {
    console.error('❌ Failed to initialize cron service:', error);
  }
  
  // Initialize cleanup scheduler for expired medications
  try {
    startCleanupScheduler();
    console.log('✅ Cleanup scheduler initialized for expired medications');
  } catch (error) {
    console.error('❌ Failed to initialize cleanup scheduler:', error);
  }
  
  app.listen(PORT, () => {
    console.log(`🚀 Arcular+ Backend server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`⏰ Cron jobs: Daily reminders at 9:00 AM IST`);
  });
};

startServer(); 
