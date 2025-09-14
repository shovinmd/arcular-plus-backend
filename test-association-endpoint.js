const axios = require('axios');

async function testAssociationEndpoint() {
  try {
    // Test the endpoint directly
    const response = await axios.post('https://arcular-plus-backend.onrender.com/api/pharmacies/associate/by-arcid', {
      arcId: 'PHAR12345678'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token'
      }
    });
    
    console.log('✅ Response:', response.data);
  } catch (error) {
    console.log('❌ Error:', error.response?.data || error.message);
    console.log('❌ Status:', error.response?.status);
  }
}

testAssociationEndpoint();
