const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');

// Test email endpoint
router.post('/test-email', async (req, res) => {
  try {
    console.log('🧪 Email test endpoint called');
    
    // Email configuration
    const normalizedPass = (process.env.EMAIL_PASS || '').replace(/\s+/g, '');
    const emailConfig = {
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: normalizedPass
      },
      connectionTimeout: 10000,
      greetingTimeout: 5000,
      socketTimeout: 10000
    };

    // Create transporter
    const transporter = nodemailer.createTransport(emailConfig);

    // Test email content
    const testEmail = {
      from: process.env.EMAIL_USER,
      to: req.body.testEmail || process.env.EMAIL_USER, // Allow custom test email
      subject: '🧪 Arcular Plus Email Test - ' + new Date().toLocaleString(),
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2E7D32;">✅ Email Test Successful!</h2>
          <p>This is a test email from Arcular Plus backend deployment.</p>
          
          <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3>Test Details:</h3>
            <ul>
              <li><strong>Timestamp:</strong> ${new Date().toISOString()}</li>
              <li><strong>Environment:</strong> ${process.env.NODE_ENV || 'production'}</li>
              <li><strong>Backend URL:</strong> ${process.env.BACKEND_URL || 'Render'}</li>
              <li><strong>Test Type:</strong> Manual API Test</li>
            </ul>
          </div>
          
          <p style="color: #666;">If you received this email, the email service is working correctly!</p>
          
          <hr style="margin: 30px 0;">
          <p style="font-size: 12px; color: #999;">
            This is an automated test email from Arcular Plus backend.
          </p>
        </div>
      `
    };

    // Send email
    const result = await transporter.sendMail(testEmail);
    
    console.log('✅ Test email sent successfully');
    console.log('📧 Message ID:', result.messageId);
    
    res.json({
      success: true,
      message: 'Test email sent successfully!',
      messageId: result.messageId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Email test failed:', error.message);
    
    // Try fallback port 587
    try {
      console.log('🔄 Trying fallback port 587...');
      
      const fallbackConfig = {
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: process.env.EMAIL_USER,
          pass: normalizedPass
        },
        connectionTimeout: 10000,
        greetingTimeout: 5000,
        socketTimeout: 10000
      };
      
      const fallbackTransporter = nodemailer.createTransport(fallbackConfig);
      const fallbackResult = await fallbackTransporter.sendMail(testEmail);
      
      console.log('✅ Test email sent via fallback');
      
      res.json({
        success: true,
        message: 'Test email sent successfully via fallback port!',
        messageId: fallbackResult.messageId,
        timestamp: new Date().toISOString(),
        method: 'fallback'
      });
      
    } catch (fallbackError) {
      console.error('❌ Fallback also failed:', fallbackError.message);
      
      res.status(500).json({
        success: false,
        message: 'Email test failed',
        error: error.message,
        fallbackError: fallbackError.message,
        timestamp: new Date().toISOString()
      });
    }
  }
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production',
    emailConfigured: !!(process.env.EMAIL_USER && process.env.EMAIL_PASS)
  });
});

module.exports = router;
