const mongoose = require('mongoose');
const Pharmacy = require('./models/Pharmacy');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/arcular_plus', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function clearDuplicatePharmacies() {
  try {
    console.log('🔍 Checking for duplicate pharmacies...');
    
    // Find all pharmacies
    const pharmacies = await Pharmacy.find({});
    console.log(`📊 Found ${pharmacies.length} total pharmacies`);
    
    // Group by email to find duplicates
    const emailGroups = {};
    pharmacies.forEach(pharmacy => {
      if (!emailGroups[pharmacy.email]) {
        emailGroups[pharmacy.email] = [];
      }
      emailGroups[pharmacy.email].push(pharmacy);
    });
    
    // Find duplicates
    const duplicates = Object.entries(emailGroups).filter(([email, pharms]) => pharms.length > 1);
    
    if (duplicates.length === 0) {
      console.log('✅ No duplicate pharmacies found');
      return;
    }
    
    console.log(`⚠️  Found ${duplicates.length} duplicate email groups`);
    
    // Keep the first pharmacy in each group, delete the rest
    let deletedCount = 0;
    for (const [email, pharms] of duplicates) {
      console.log(`📧 Email: ${email} - ${pharms.length} duplicates`);
      
      // Sort by creation date (keep the oldest)
      pharms.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      
      // Delete all except the first one
      for (let i = 1; i < pharms.length; i++) {
        await Pharmacy.findByIdAndDelete(pharms[i]._id);
        deletedCount++;
        console.log(`🗑️  Deleted duplicate pharmacy: ${pharms[i].pharmacyName}`);
      }
    }
    
    console.log(`✅ Cleanup complete! Deleted ${deletedCount} duplicate pharmacies`);
    
  } catch (error) {
    console.error('❌ Error clearing duplicates:', error);
  } finally {
    mongoose.connection.close();
  }
}

// Run the cleanup
clearDuplicatePharmacies();
