const Report = require('../models/Report');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { validationResult } = require('express-validator');
const admin = require('../firebase');
const bucket = admin.storage().bucket();

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
  const blob = bucket.file(Date.now() + '-' + req.file.originalname);
  const blobStream = blob.createWriteStream();
  blobStream.on('error', err => res.status(500).send(err));
  blobStream.on('finish', async () => {
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
    res.status(200).json({ url: publicUrl });
  });
  blobStream.end(req.file.buffer);
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

module.exports = {
  getReportsByUser,
  uploadReport,
  deleteReport,
  updateReport,
  searchReports,
  getReportById
}; 