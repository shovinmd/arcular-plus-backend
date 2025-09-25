const nodemailer = require('nodemailer');

// Test email configuration
const normalizedPass = (process.env.EMAIL_PASS || 'iywf gkyz ywby ufew').replace(/\s+/g, '');
const testEmailConfig = {
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER || 'shovinmicheldavid1285@gmail.com',
    pass: normalizedPass
  },
  connectionTimeout: 10000,
  greetingTimeout: 5000,
  socketTimeout: 10000
};

// Create transporter
const transporter = nodemailer.createTransport(testEmailConfig);

async function testEmailConnection() {
  console.log('🧪 Testing email connection...');
  console.log('📧 Email User:', process.env.EMAIL_USER || 'NOT SET');
  console.log('🔑 Email Pass:', process.env.EMAIL_PASS ? '***SET***' : 'NOT SET');
  
  try {
    // Test connection
    await transporter.verify();
    console.log('✅ Email transporter verified successfully');
    
    // Send test email
    const testEmail = {
      from: process.env.EMAIL_USER || 'shovinmicheldavid1285@gmail.com',
      to: process.env.EMAIL_USER || 'shovinmicheldavid1285@gmail.com', // Send to self for testing
      subject: '🧪 Arcular Plus Email Test',
      html: `
        <h2>Email Test Successful!</h2>
        <p>This is a test email from Arcular Plus backend.</p>
        <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
        <p><strong>Environment:</strong> ${process.env.NODE_ENV || 'development'}</p>
        <p><strong>Backend URL:</strong> ${process.env.BACKEND_URL || 'localhost'}</p>
        <hr>
        <p><em>If you received this email, the email service is working correctly!</em></p>
      `
    };
    
    const result = await transporter.sendMail(testEmail);
    console.log('✅ Test email sent successfully!');
    console.log('📧 Message ID:', result.messageId);
    console.log('📬 Response:', result.response);
    
  } catch (error) {
    console.error('❌ Email test failed:');
    console.error('Error:', error.message);
    
    if (error.code === 'EAUTH') {
      console.error('🔐 Authentication failed. Check EMAIL_USER and EMAIL_PASS');
    } else if (error.code === 'ECONNECTION') {
      console.error('🌐 Connection failed. Check network and SMTP settings');
    } else if (error.code === 'ETIMEDOUT') {
      console.error('⏰ Connection timeout. Try again or check firewall');
    }
    
    // Try fallback port 587
    console.log('🔄 Trying fallback port 587...');
    try {
      const fallbackConfig = {
        ...testEmailConfig,
        port: 587,
        secure: false
      };
      
      const fallbackTransporter = nodemailer.createTransport(fallbackConfig);
      await fallbackTransporter.verify();
      console.log('✅ Fallback transporter verified successfully');
      
      const fallbackResult = await fallbackTransporter.sendMail(testEmail);
      console.log('✅ Test email sent via fallback!');
      console.log('📧 Message ID:', fallbackResult.messageId);
      
    } catch (fallbackError) {
      console.error('❌ Fallback also failed:', fallbackError.message);
    }
  }
}

// Run the test
testEmailConnection()
  .then(() => {
    console.log('🏁 Email test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Email test crashed:', error);
    process.exit(1);
  });
