const mongoose = require('mongoose');
const Pharmacy = require('./models/Pharmacy');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/arcular_plus', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function checkPharmacyDatabase() {
  try {
    console.log('🔍 Checking pharmacy database...');
    
    // Count total pharmacies
    const totalPharmacies = await Pharmacy.countDocuments();
    console.log('📊 Total pharmacies in database:', totalPharmacies);
    
    if (totalPharmacies > 0) {
      // Get all pharmacies
      const pharmacies = await Pharmacy.find({}).select('pharmacyName email isApproved approvalStatus registrationDate');
      console.log('\n📋 All pharmacies:');
      pharmacies.forEach((pharmacy, index) => {
        console.log(`${index + 1}. ${pharmacy.pharmacyName} (${pharmacy.email})`);
        console.log(`   - Approved: ${pharmacy.isApproved}`);
        console.log(`   - Status: ${pharmacy.approvalStatus}`);
        console.log(`   - Registered: ${pharmacy.registrationDate}`);
        console.log('');
      });
    } else {
      console.log('❌ No pharmacies found in database');
    }
    
    // Check for the specific email
    const specificPharmacy = await Pharmacy.findOne({ email: 'vfshfdht@gmail.com' });
    if (specificPharmacy) {
      console.log('✅ Found specific pharmacy:', specificPharmacy.pharmacyName);
    } else {
      console.log('❌ Specific pharmacy not found');
    }
    
  } catch (error) {
    console.error('❌ Error checking pharmacy database:', error);
  } finally {
    mongoose.connection.close();
  }
}

// Run the check
checkPharmacyDatabase();
