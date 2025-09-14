// Test script to verify pharmacy email login endpoint
const fetch = require('node-fetch');

async function testPharmacyEmailLogin() {
  try {
    console.log('🧪 Testing pharmacy email login endpoint...');
    
    // Test with the email from the logs
    const testEmail = 'vfg@gmail.com';
    
    const response = await fetch(`https://arcular-plus-backend.onrender.com/api/pharmacies/login-email/${testEmail}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const responseText = await response.text();
    console.log('📡 Response status:', response.status);
    console.log('📡 Response body:', responseText);

    if (response.status === 200) {
      const data = JSON.parse(responseText);
      if (data.success && data.data) {
        console.log('✅ Backend is returning pharmacy data successfully');
        console.log('📋 Data structure:', Object.keys(data.data));
        
        // Check if complex objects are converted to strings
        const hasStringifiedObjects = 
          typeof data.data.operatingHours === 'string' &&
          typeof data.data.documents === 'string' &&
          typeof data.data.affiliatedHospitals === 'string';
        
        if (hasStringifiedObjects) {
          console.log('✅ Complex objects are properly converted to strings');
        } else {
          console.log('❌ Complex objects are still nested objects');
        }
      } else {
        console.log('❌ Backend response format is incorrect');
        console.log('📋 Response structure:', Object.keys(data));
      }
    } else if (response.status === 401) {
      console.log('✅ Backend is responding (401 expected without auth token)');
    } else {
      console.log('❌ Backend returned unexpected status:', response.status);
    }

  } catch (error) {
    console.log('❌ Test failed:', error.message);
  }
}

testPharmacyEmailLogin();
