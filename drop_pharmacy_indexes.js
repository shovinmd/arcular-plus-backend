// Simple script to drop problematic pharmacy indexes
const { MongoClient } = require('mongodb');

async function dropPharmacyIndexes() {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017/test');
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db();
    const collection = db.collection('pharmacies');
    
    // List of problematic indexes to drop
    const problematicIndexes = [
      'drugLicenseNumber_1',
      'drugLicenseNumber_-1',
      'registrationNumber_1',
      'registrationNumber_-1',
      'drugLicense_1',
      'drugLicense_-1',
      'premisesLicense_1',
      'premisesLicense_-1',
      'pharmacyLicense_1',
      'pharmacyLicense_-1',
      'medicalRegistrationNumber_1',
      'medicalRegistrationNumber_-1',
      'hospitalRegistrationNumber_1',
      'hospitalRegistrationNumber_-1'
    ];
    
    console.log('🔧 Dropping problematic indexes...');
    
    for (const indexName of problematicIndexes) {
      try {
        await collection.dropIndex(indexName);
        console.log(`✅ Dropped ${indexName} index`);
      } catch (error) {
        if (error.code === 27) {
          console.log(`ℹ️ ${indexName} index does not exist`);
        } else {
          console.log(`⚠️ Error dropping ${indexName}: ${error.message}`);
        }
      }
    }
    
    console.log('✅ Index cleanup completed');
    
    // Show remaining indexes
    const indexes = await collection.indexes();
    console.log('📋 Remaining indexes:', indexes.map(idx => ({ name: idx.name, key: idx.key })));
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
    console.log('🔌 Connection closed');
  }
}

dropPharmacyIndexes();
