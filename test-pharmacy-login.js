const mongoose = require('mongoose');
const Pharmacy = require('./models/Pharmacy');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/arcular_plus', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function testPharmacyLogin() {
  try {
    console.log('🔍 Testing pharmacy login for email: vfshfdht@gmail.com');
    
    const pharmacy = await Pharmacy.findOne({ email: 'vfshfdht@gmail.com' });
    
    if (!pharmacy) {
      console.log('❌ Pharmacy not found in database');
      return;
    }
    
    console.log('✅ Pharmacy found:');
    console.log('   - Name:', pharmacy.pharmacyName);
    console.log('   - Email:', pharmacy.email);
    console.log('   - UID:', pharmacy.uid);
    console.log('   - isApproved:', pharmacy.isApproved);
    console.log('   - approvalStatus:', pharmacy.approvalStatus);
    console.log('   - status:', pharmacy.status);
    console.log('   - Registration Date:', pharmacy.registrationDate);
    
    // Test the login response format
    const data = pharmacy.toObject();
    data.type = 'pharmacy';
    data.pharmacyLicenseNumber = data.licenseNumber;
    data.pharmacyAddress = data.address;
    data.pharmacyServicesProvided = data.servicesProvided;
    
    console.log('\n📤 Login response data:');
    console.log('   - type:', data.type);
    console.log('   - isApproved:', data.isApproved);
    console.log('   - approvalStatus:', data.approvalStatus);
    console.log('   - pharmacyName:', data.pharmacyName);
    console.log('   - pharmacyLicenseNumber:', data.pharmacyLicenseNumber);
    
  } catch (error) {
    console.error('❌ Error testing pharmacy login:', error);
  } finally {
    mongoose.connection.close();
  }
}

// Run the test
testPharmacyLogin();
