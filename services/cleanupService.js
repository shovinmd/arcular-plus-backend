const cron = require('node-cron');
const Medication = require('../models/Medication');

// Cleanup expired medications
const cleanupExpiredMedications = async () => {
  try {
    const now = new Date();
    
    // Find medications that have passed their end date
    const expiredMedications = await Medication.find({
      endDate: { $lt: now },
      status: { $ne: 'completed' }
    });

    if (expiredMedications.length === 0) {
      console.log('🧹 No expired medications found for cleanup');
      return { deletedCount: 0 };
    }

    // Delete expired medications
    const deleteResult = await Medication.deleteMany({
      endDate: { $lt: now },
      status: { $ne: 'completed' }
    });

    console.log(`🧹 Cleaned up ${deleteResult.deletedCount} expired medications`);
    console.log('Expired medications:', expiredMedications.map(med => ({
      id: med._id,
      name: med.name,
      endDate: med.endDate,
      patientId: med.patientId
    })));

    return { deletedCount: deleteResult.deletedCount };
  } catch (error) {
    console.error('❌ Error cleaning up expired medications:', error);
    throw error;
  }
};

// Schedule cleanup to run every hour
const startCleanupScheduler = () => {
  // Run cleanup every hour at minute 0
  cron.schedule('0 * * * *', async () => {
    console.log('🕐 Running scheduled cleanup of expired medications...');
    try {
      await cleanupExpiredMedications();
    } catch (error) {
      console.error('❌ Scheduled cleanup failed:', error);
    }
  });

  console.log('✅ Cleanup scheduler started - will run every hour');
};

// Manual cleanup function for testing
const runManualCleanup = async () => {
  console.log('🔧 Running manual cleanup of expired medications...');
  try {
    const result = await cleanupExpiredMedications();
    console.log(`✅ Manual cleanup completed. Deleted ${result.deletedCount} medications.`);
    return result;
  } catch (error) {
    console.error('❌ Manual cleanup failed:', error);
    throw error;
  }
};

module.exports = {
  cleanupExpiredMedications,
  startCleanupScheduler,
  runManualCleanup
};
