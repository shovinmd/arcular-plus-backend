const Report = require('../models/Report');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { validationResult } = require('express-validator');
const { admin, isStorageAvailable } = require('../firebase');

// Initialize Firebase Storage bucket only if needed
let bucket;
if (isStorageAvailable()) {
  try {
    bucket = admin.storage().bucket();
    console.log('✅ Firebase Storage initialized successfully');
  } catch (error) {
    console.warn('⚠️ Firebase Storage bucket creation failed:', error.message);
    bucket = null;
  }
} else {
  console.warn('⚠️ Firebase Storage not available - check project configuration');
  bucket = null;
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadPath = process.env.UPLOAD_PATH || './uploads';
    try {
      await fs.mkdir(uploadPath, { recursive: true });
      cb(null, uploadPath);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images, PDFs, and Word documents are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  // No explicit file size limit (be cautious of hosting constraints)
});

// Get reports for a user
const getReportsByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { category, limit } = req.query;

    console.log('🔍 Fetching reports for userId:', userId);
    console.log('🔍 Query params - category:', category, 'limit:', limit);

    // First, let's check if the user exists and has any reports at all
    const totalReports = await Report.countDocuments({});
    console.log('📊 Total reports in database:', totalReports);
    
    const userReportsCount = await Report.countDocuments({ patientId: userId });
    console.log('📊 Reports for this user:', userReportsCount);

    let reports;
    try {
      if (category) {
        console.log('🔍 Using findByCategory method');
        reports = await Report.findByCategory(userId, category);
      } else if (limit) {
        console.log('🔍 Using findRecent method');
        reports = await Report.findRecent(userId, parseInt(limit));
      } else {
        console.log('🔍 Using findByPatient method');
        reports = await Report.findByPatient(userId);
      }
    } catch (methodError) {
      console.log('⚠️ Static method failed, using direct query as fallback');
      console.log('⚠️ Method error:', methodError.message);
      
      // Fallback: direct query
      console.log('🔄 Using fallback direct query...');
      reports = await Report.find({ patientId: userId }).sort({ uploadedAt: -1 });
    }

    console.log('✅ Reports found:', reports.length);
    if (reports.length > 0) {
      console.log('📋 First report sample:', JSON.stringify(reports[0], null, 2));
    }
    console.log('📋 Reports data:', JSON.stringify(reports, null, 2));

    res.json({
      success: true,
      data: reports,
      count: reports.length
    });
  } catch (error) {
    console.error('❌ Error fetching reports:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch reports'
    });
  }
};

// Upload report file
const uploadReport = async (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded.');
  
  // Check if Firebase Storage is available
  if (!bucket) {
    // Fallback to local file storage
    try {
      const fileName = Date.now() + '-' + req.file.originalname;
      const filePath = path.join(__dirname, '..', 'uploads', fileName);
      
      // Ensure uploads directory exists
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      
      // Move file to uploads directory
      await fs.rename(req.file.path, filePath);
      
      const localUrl = `/uploads/${fileName}`;
      res.status(200).json({ 
        success: true,
        url: localUrl,
        message: 'File uploaded to local storage successfully',
        storage: 'local'
      });
    } catch (error) {
      console.error('Local upload error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to upload file to local storage'
      });
    }
    return;
  }
  
  // Use Firebase Storage
  try {
    const blob = bucket.file(Date.now() + '-' + req.file.originalname);
    const blobStream = blob.createWriteStream();
    
    blobStream.on('error', err => {
      console.error('Firebase Storage upload error:', err);
      res.status(500).json({
        success: false,
        error: 'Failed to upload file to Firebase Storage'
      });
    });
    
    blobStream.on('finish', async () => {
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
      res.status(200).json({ 
        success: true,
        url: publicUrl,
        message: 'File uploaded to Firebase Storage successfully',
        storage: 'firebase'
      });
    });
    
    blobStream.end(req.file.buffer);
  } catch (error) {
    console.error('Firebase upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload file to Firebase Storage'
    });
  }
};

// Delete report
const deleteReport = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🗑️ Delete request received for report ID:', id);
    console.log('🔍 Request params:', req.params);
    console.log('🔍 Request body:', req.body);
    
    const report = await Report.findById(id);

    if (!report) {
      console.log('❌ Report not found for deletion');
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }

    console.log('📋 Report to delete:', JSON.stringify(report, null, 2));

    console.log('ℹ️ Only deleting from MongoDB (Firebase files remain for data integrity)');

    // Delete the report record from database
    console.log('🗄️ Deleting report from database...');
    console.log('🔍 Report ID to delete:', id);
    console.log('🔍 Report exists before deletion:', !!report);
    
    const deleteResult = await Report.findByIdAndDelete(id);
    console.log('🗄️ Delete result:', deleteResult);
    
    // Verify deletion
    const verifyReport = await Report.findById(id);
    console.log('🔍 Report still exists after deletion:', !!verifyReport);
    
    console.log('✅ Report deleted from database:', deleteResult);

    if (deleteResult) {
      res.json({
        success: true,
        message: 'Report deleted successfully'
      });
    } else {
      console.log('❌ Delete operation returned null/undefined');
      res.status(500).json({
        success: false,
        error: 'Delete operation failed'
      });
    }

  } catch (error) {
    console.error('❌ Error deleting report:', error);
    console.error('❌ Error details:', error.message);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Failed to delete report'
    });
  }
};

// Update report
const updateReport = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const report = await Report.findById(id);
    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }

    // Update report
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        report[key] = updateData[key];
      }
    });

    await report.save();

    res.json({
      success: true,
      data: report,
      message: 'Report updated successfully'
    });
  } catch (error) {
    console.error('Error updating report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update report'
    });
  }
};

// Search reports
const searchReports = async (req, res) => {
  try {
    const { userId } = req.params;
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    const reports = await Report.search(userId, q);

    res.json({
      success: true,
      data: reports,
      count: reports.length
    });
  } catch (error) {
    console.error('Error searching reports:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search reports'
    });
  }
};

// Get report by ID
const getReportById = async (req, res) => {
  try {
    const { id } = req.params;
    const report = await Report.findById(id);

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Error fetching report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch report'
    });
  }
};

// Save report metadata (for files uploaded via Firebase Storage)
const saveReportMetadata = async (req, res) => {
  try {
    const { name, url, type, patientId, description, category, fileSize, mimeType } = req.body;

    console.log('📝 Saving report metadata:');
    console.log('  - name:', name);
    console.log('  - url:', url);
    console.log('  - type:', type);
    console.log('  - patientId:', patientId);
    console.log('  - description:', description);
    console.log('  - category:', category);
    console.log('  - fileSize:', fileSize);
    console.log('  - mimeType:', mimeType);

    // Validate required fields
    if (!name || !url || !patientId) {
      console.log('❌ Missing required fields');
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, url, and patientId are required'
      });
    }

    // Only allow PDF files
    if (type.toLowerCase() !== 'pdf') {
      console.log('❌ Invalid file type:', type);
      return res.status(400).json({
        success: false,
        error: `Only PDF files are allowed. Received: ${type}`
      });
    }

    // Create new report with metadata
    const report = new Report({
      name,
      url,
      type: 'pdf',
      patientId,
      // doctorId is optional for user-uploaded reports
      description: description || '',
      category: category || 'Other',
      fileSize: fileSize || 0,
      mimeType: 'application/pdf',
      status: 'uploaded'
    });

    console.log('📋 Created report object:', JSON.stringify(report, null, 2));

    // Validate the report object before saving
    const validationError = report.validateSync();
    if (validationError) {
      console.log('❌ Validation error:', validationError.message);
      return res.status(400).json({
        success: false,
        error: 'Validation error: ' + validationError.message
      });
    }

    await report.save();

    console.log('✅ Report saved successfully with ID:', report._id);

    res.status(201).json({
      success: true,
      data: report,
      message: 'Report metadata saved successfully'
    });

  } catch (error) {
    console.error('❌ Error saving report metadata:', error);
    console.error('❌ Error details:', error.message);
    console.error('❌ Error stack:', error.stack);
    
    // Check if it's a MongoDB validation error
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        error: 'Validation errors: ' + validationErrors.join(', ')
      });
    }
    
    // Check if it's a duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'Report with this name already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to save report metadata'
    });
  }
};

// Test endpoint to check Report model
const testReportModel = async (req, res) => {
  try {
    console.log('🧪 Testing Report model...');
    
    // Test basic find
    const allReports = await Report.find({});
    console.log('✅ Basic find works, found ${allReports.length} reports');
    
    // Test find by patientId
    const testUserId = 'test123';
    const userReports = await Report.find({ patientId: testUserId });
    console.log('✅ Find by patientId works, found ${userReports.length} reports for $testUserId');
    
    // Test schema
    console.log('📋 Report schema fields:', Object.keys(Report.schema.paths));
    
    res.json({
      success: true,
      message: 'Report model test completed',
      totalReports: allReports.length,
      schemaFields: Object.keys(Report.schema.paths)
    });
  } catch (error) {
    console.error('❌ Report model test failed:', error);
    res.status(500).json({
      success: false,
      error: 'Report model test failed: ' + error.message
    });
  }
};

module.exports = {
  getReportsByUser,
  uploadReport,
  deleteReport,
  updateReport,
  searchReports,
  getReportById,
  saveReportMetadata,
  testReportModel
}; 