// Simple email test script for Arcular Plus backend
// Run this from the project root: node test-email-script.js

const https = require('https');

const BACKEND_URL = 'https://arcular-plus-backend.onrender.com';
const TEST_EMAIL = 'shovinmaster1285@gmail.com'; // Change this to your email

async function testEmailAPI() {
  console.log('🧪 Testing Arcular Plus Email Service');
  console.log('🌐 Backend URL:', BACKEND_URL);
  console.log('📧 Test Email:', TEST_EMAIL);
  console.log('');

  const postData = JSON.stringify({
    testEmail: TEST_EMAIL
  });

  const options = {
    hostname: 'arcular-plus-backend.onrender.com',
    port: 443,
    path: '/api/test/test-email',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log('📊 Response Status:', res.statusCode);
          console.log('📋 Response Data:', JSON.stringify(response, null, 2));
          
          if (res.statusCode === 200 && response.success) {
            console.log('✅ Email test successful!');
            console.log('📧 Check your inbox for the test email.');
          } else {
            console.log('❌ Email test failed');
          }
          
          resolve(response);
        } catch (error) {
          console.error('❌ Failed to parse response:', error.message);
          console.log('Raw response:', data);
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Request failed:', error.message);
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

async function testHealthCheck() {
  console.log('🏥 Testing backend health...');
  
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'arcular-plus-backend.onrender.com',
      port: 443,
      path: '/api/test/health',
      method: 'GET'
    }, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log('📊 Health Check Response:', JSON.stringify(response, null, 2));
          
          if (response.emailConfigured) {
            console.log('✅ Email is configured on backend');
          } else {
            console.log('❌ Email is NOT configured on backend');
            console.log('💡 Make sure EMAIL_USER and EMAIL_PASS are set in environment variables');
          }
          
          resolve(response);
        } catch (error) {
          console.error('❌ Failed to parse health response:', error.message);
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Health check failed:', error.message);
      reject(error);
    });

    req.end();
  });
}

// Run tests
async function runTests() {
  try {
    console.log('🚀 Starting email tests...\n');
    
    // Test health check first
    await testHealthCheck();
    console.log('');
    
    // Test email sending
    await testEmailAPI();
    
    console.log('\n🏁 Tests completed!');
    console.log('💡 If email test failed, check:');
    console.log('   1. EMAIL_USER and EMAIL_PASS environment variables are set');
    console.log('   2. Gmail App Password is correct (no spaces)');
    console.log('   3. Backend deployment is running');
    console.log('   4. Network connectivity to Gmail SMTP servers');
    
  } catch (error) {
    console.error('💥 Test suite failed:', error.message);
    process.exit(1);
  }
}

runTests();
