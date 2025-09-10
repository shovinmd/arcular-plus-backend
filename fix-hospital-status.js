const mongoose = require('mongoose');
const Hospital = require('./models/Hospital');

// Connect to MongoDB (production)
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/arcular_plus';

mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function fixHospitalStatus() {
  try {
    console.log('🔄 Starting hospital status fix...');
    
    // Find all hospitals that are approved but have pending status
    const hospitalsToFix = await Hospital.find({
      isApproved: true,
      approvalStatus: 'approved',
      status: 'pending'
    });
    
    console.log(`📊 Found ${hospitalsToFix.length} hospitals with approved status but pending state`);
    
    let updatedCount = 0;
    
    for (const hospital of hospitalsToFix) {
      console.log(`🏥 Fixing hospital: ${hospital.hospitalName} (${hospital.uid})`);
      
      // Update status to active
      await Hospital.findByIdAndUpdate(hospital._id, {
        $set: {
          status: 'active'
        }
      });
      
      console.log(`✅ Updated hospital ${hospital.hospitalName} status to active`);
      updatedCount++;
    }
    
    console.log(`🎉 Fix completed! Updated ${updatedCount} hospitals`);
    
    // Verify the fix
    const activeApprovedHospitals = await Hospital.find({
      isApproved: true,
      approvalStatus: 'approved',
      status: 'active'
    });
    
    console.log(`📊 Verification: ${activeApprovedHospitals.length} hospitals now have active status`);
    
  } catch (error) {
    console.error('❌ Fix failed:', error);
  } finally {
    mongoose.connection.close();
  }
}

fixHospitalStatus();
