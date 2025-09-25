const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const { sendMailSmart } = require('../services/emailService');

// Test email endpoint
router.post('/test-email', async (req, res) => {
  // Normalize password once for the entire handler so it's available in all blocks
  const normalizedPass = (process.env.EMAIL_PASS || '').replace(/\s+/g, '');
  // Declare testEmail in outer scope so fallback can reuse it
  let testEmail;
  try {
    console.log('🧪 Email test endpoint called');
    
    // Email configuration
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
    testEmail = {
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

    // Send email (centralized smart sender will use SMTP locally and Brevo on Render)
    const ok = await sendMailSmart({
      to: testEmail.to,
      subject: testEmail.subject,
      html: testEmail.html,
      text: undefined,
    });
    
    if (!ok) throw new Error('All providers failed');
    console.log('✅ Test email sent successfully');
    
    res.json({
      success: true,
      message: 'Test email sent successfully!',
      provider: process.env.BREVO_API_KEY ? 'brevo-or-smtp' : 'smtp',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Email test failed:', error.message);
    
    // Try direct SMTP fallback if desired (kept for logs)
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
      await fallbackTransporter.verify();
      await fallbackTransporter.sendMail(testEmail);
      
      console.log('✅ Test email sent via fallback');
      
      res.json({
        success: true,
        message: 'Test email sent successfully via fallback port!',
        method: 'smtp-587',
        timestamp: new Date().toISOString(),
        note: 'SMTP fallback path'
      });
      
    } catch (fallbackError) {
      console.error('❌ Fallback also failed:', fallbackError.message);
      
      // Final attempt via Brevo explicitly for test route (useful for platform with SMTP blocked)
      if (process.env.BREVO_API_KEY) {
        try {
          const ok2 = await sendMailSmart({ to: testEmail.to, subject: testEmail.subject, html: testEmail.html });
          if (ok2) {
            return res.json({
              success: true,
              message: 'Test email sent successfully via Brevo!',
              provider: 'brevo',
              timestamp: new Date().toISOString()
            });
          }
        } catch (e2) {
          console.error('❌ Brevo explicit send failed:', e2.message);
        }
      }
      res.status(500).json({ success: false, message: 'Email test failed', error: error.message, fallbackError: fallbackError.message, timestamp: new Date().toISOString() });
    }
  }
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production',
    emailConfigured: !!(process.env.BREVO_API_KEY || (process.env.EMAIL_USER && process.env.EMAIL_PASS)),
    provider: process.env.BREVO_API_KEY ? 'brevo' : (process.env.EMAIL_USER && process.env.EMAIL_PASS ? 'smtp' : 'none')
  });
});

module.exports = router;
