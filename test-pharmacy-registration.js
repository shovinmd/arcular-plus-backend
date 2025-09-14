const mongoose = require('mongoose');
const Pharmacy = require('./models/Pharmacy');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/arcular_plus', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function testPharmacyRegistration() {
  try {
    console.log('🧪 Testing pharmacy registration...');
    
    // Create a test pharmacy user
    const testPharmacy = new Pharmacy({
      uid: 'test-pharmacy-uid-123',
      fullName: 'Test Pharmacy',
      pharmacyName: 'Test Pharmacy',
      email: 'test-pharmacy@example.com',
      mobileNumber: '9876543210',
      alternateMobile: '9876543211',
      ownerName: 'Test Owner',
      pharmacistName: 'Test Pharmacist',
      type: 'pharmacy',
      licenseNumber: 'TEST-LICENSE-123',
      licenseDocumentUrl: 'default_license_url',
      drugLicenseUrl: 'default_drug_license_url',
      premisesCertificateUrl: 'default_premises_url',
      servicesProvided: ['Medicine Delivery', 'Consultation'],
      drugsAvailable: ['General Medicine', 'Prescription Drugs'],
      homeDelivery: true,
      operatingHours: {
        openTime: '09:00',
        closeTime: '21:00',
        workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
      },
      pharmacistLicenseNumber: 'PHARM-LICENSE-123',
      pharmacistQualification: 'B.Pharm',
      pharmacistExperienceYears: 5,
      address: 'Test Address',
      city: 'Test City',
      state: 'Test State',
      pincode: '123456',
      longitude: 77.123456,
      latitude: 28.123456,
      geoCoordinates: { lat: 28.123456, lng: 77.123456 },
      profileImageUrl: 'default_profile_url',
      status: 'active',
      isApproved: false,
      approvalStatus: 'pending',
      registrationDate: new Date(),
    });
    
    console.log('💾 Attempting to save test pharmacy...');
    const savedPharmacy = await testPharmacy.save();
    console.log('✅ Test pharmacy saved successfully with ID:', savedPharmacy._id);
    console.log('📋 Pharmacy details:', {
      pharmacyName: savedPharmacy.pharmacyName,
      email: savedPharmacy.email,
      licenseNumber: savedPharmacy.licenseNumber,
      isApproved: savedPharmacy.isApproved,
      approvalStatus: savedPharmacy.approvalStatus
    });
    
    // Clean up - delete the test pharmacy
    await Pharmacy.findByIdAndDelete(savedPharmacy._id);
    console.log('🧹 Test pharmacy cleaned up');
    
  } catch (error) {
    console.error('❌ Error testing pharmacy registration:', error);
    console.error('❌ Error details:', {
      name: error.name,
      message: error.message,
      code: error.code,
      keyPattern: error.keyPattern,
      keyValue: error.keyValue
    });
  } finally {
    mongoose.connection.close();
  }
}

// Run the test
testPharmacyRegistration();
