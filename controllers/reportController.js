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
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB default
  }
});

// Get reports for a user
const getReportsByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { category, limit } = req.query;

    let reports;
    if (category) {
      reports = await Report.findByCategory(userId, category);
    } else if (limit) {
      reports = await Report.findRecent(userId, parseInt(limit));
    } else {
      reports = await Report.findByPatient(userId);
    }

    res.json({
      success: true,
      data: reports,
      count: reports.length
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
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
    const report = await Report.findById(id);

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }

    // Delete file from filesystem
    try {
      const filePath = path.join(__dirname, '..', report.url);
      await fs.unlink(filePath);
    } catch (fileError) {
      console.warn('File not found for deletion:', fileError.message);
    }

    await Report.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Report deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting report:', error);
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
    const { name, url, type, patientId, description, fileSize, mimeType } = req.body;

    // Validate required fields
    if (!name || !url || !patientId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, url, and patientId are required'
      });
    }

    // Create new report with metadata
    const report = new Report({
      name,
      url,
      type: type || 'document',
      patientId,
      // doctorId is optional for user-uploaded reports
      description: description || '',
      fileSize: fileSize || 0,
      mimeType: mimeType || 'application/octet-stream',
      status: 'uploaded'
    });

    await report.save();

    res.status(201).json({
      success: true,
      data: report,
      message: 'Report metadata saved successfully'
    });

  } catch (error) {
    console.error('Error saving report metadata:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save report metadata'
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
  saveReportMetadata
}; 