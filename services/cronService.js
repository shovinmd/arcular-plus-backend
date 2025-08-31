const cron = require('node-cron');
const menstrualReminderService = require('./menstrualReminderService');
const fcmService = require('./fcmService');

class CronService {
  constructor() {
    this.jobs = new Map();
    this.isInitialized = false;
  }

  // Initialize all cron jobs
  async initialize() {
    if (this.isInitialized) {
      console.log('⚠️ Cron service already initialized');
      return;
    }

    try {
      console.log('🚀 Initializing cron service...');
      
      // Check FCM service status first
      await this.checkFCMStatus();
      
      // Schedule daily menstrual reminder processing at 12:00 PM (noon)
      this.scheduleMenstrualReminders();
      
      // Schedule health check every hour
      this.scheduleHealthCheck();
      
      // Schedule cleanup job every day at 2:00 AM
      this.scheduleCleanupJob();
      
      this.isInitialized = true;
      console.log('✅ Cron service initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing cron service:', error);
      throw error;
    }
  }

  // Check FCM service status
  async checkFCMStatus() {
    try {
      console.log('🔍 Checking FCM service status...');
      
      // Wait a bit for FCM service to initialize
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const fcmStatus = fcmService.getStatus();
      console.log('📱 FCM Service Status:', fcmStatus);
      
      if (!fcmStatus.isInitialized) {
        console.log('⚠️ FCM service not fully initialized, but continuing...');
      } else {
        console.log('✅ FCM service is ready for notifications');
      }
    } catch (error) {
      console.error('❌ Error checking FCM status:', error);
    }
  }

  // Schedule daily menstrual reminder processing
  scheduleMenstrualReminders() {
    try {
      // Run every day at 12:00 PM (noon)
      const job = cron.schedule('0 12 * * *', async () => {
        console.log('🕐 Running daily menstrual reminder processing...');
        console.log('📅 Date:', new Date().toLocaleDateString('en-US', { 
          timeZone: 'Asia/Kolkata',
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }));
        
        try {
          // Check FCM status before processing
          const fcmStatus = fcmService.getStatus();
          if (!fcmStatus.isInitialized) {
            console.log('⚠️ FCM service not ready, attempting to initialize...');
            await fcmService.initialize();
          }
          
          const startTime = Date.now();
          const result = await menstrualReminderService.processDailyReminders();
          const endTime = Date.now();
          
          console.log(`✅ Daily reminder processing completed in ${endTime - startTime}ms`);
          console.log(`📊 Results: ${result.success}/${result.processed} users processed successfully`);
          console.log(`📱 Total reminders sent: ${result.totalReminders || 0}`);
          
          // Log to monitoring system if available
          this.logReminderProcessing(result);
        } catch (error) {
          console.error('❌ Error in daily reminder processing:', error);
          this.logError('Daily reminder processing failed', error);
        }
      }, {
        scheduled: true,
        timezone: 'Asia/Kolkata' // Indian timezone
      });

      this.jobs.set('menstrualReminders', job);
      console.log('✅ Scheduled daily menstrual reminders at 12:00 PM IST (noon)');
    } catch (error) {
      console.error('❌ Error scheduling menstrual reminders:', error);
    }
  }

  // Schedule health check
  scheduleHealthCheck() {
    try {
      // Run every hour
      const job = cron.schedule('0 * * * *', async () => {
        console.log('🏥 Running hourly health check...');
        
        try {
          const healthStatus = await this.performHealthCheck();
          console.log('✅ Health check completed:', healthStatus);
          
          // Check FCM service health
          const fcmStatus = fcmService.getStatus();
          console.log('📱 FCM Service Health:', fcmStatus);
          
        } catch (error) {
          console.error('❌ Health check failed:', error);
        }
      }, {
        scheduled: true,
        timezone: 'Asia/Kolkata'
      });

      this.jobs.set('healthCheck', job);
      console.log('✅ Scheduled hourly health check');
    } catch (error) {
      console.error('❌ Error scheduling health check:', error);
    }
  }

  // Schedule cleanup job
  scheduleCleanupJob() {
    try {
      // Run every day at 2:00 AM
      const job = cron.schedule('0 2 * * *', async () => {
        console.log('🧹 Running daily cleanup job...');
        
        try {
          await this.performCleanup();
          console.log('✅ Daily cleanup completed');
        } catch (error) {
          console.error('❌ Daily cleanup failed:', error);
        }
      }, {
        scheduled: true,
        timezone: 'Asia/Kolkata'
      });

      this.jobs.set('cleanup', job);
      console.log('✅ Scheduled daily cleanup at 2:00 AM IST');
    } catch (error) {
      console.error('❌ Error scheduling cleanup job:', error);
    }
  }

  // Perform health check
  async performHealthCheck() {
    try {
      const healthStatus = {
        timestamp: new Date().toISOString(),
        service: 'CronService',
        status: 'healthy',
        activeJobs: this.jobs.size,
        jobDetails: [],
        fcmStatus: fcmService.getStatus()
      };

      // Check each job status
      for (const [jobName, job] of this.jobs) {
        healthStatus.jobDetails.push({
          name: jobName,
          running: job.running,
          lastRun: job.lastDate,
          nextRun: job.nextDate
        });
      }

      return healthStatus;
    } catch (error) {
      console.error('❌ Error performing health check:', error);
      throw error;
    }
  }

  // Perform cleanup tasks
  async performCleanup() {
    try {
      console.log('🧹 Starting cleanup tasks...');
      
      // Clean up old logs (keep last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      // Add any specific cleanup logic here
      // For example: clean old notification logs, expired tokens, etc.
      
      console.log('✅ Cleanup tasks completed');
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
      throw error;
    }
  }

  // Manually trigger menstrual reminder processing
  async triggerMenstrualReminders() {
    try {
      console.log('🚀 Manually triggering menstrual reminder processing...');
      
      // Check FCM status first
      const fcmStatus = fcmService.getStatus();
      if (!fcmStatus.isInitialized) {
        console.log('⚠️ FCM service not ready, attempting to initialize...');
        await fcmService.initialize();
      }
      
      const startTime = Date.now();
      const result = await menstrualReminderService.processDailyReminders();
      const endTime = Date.now();
      
      console.log(`✅ Manual reminder processing completed in ${endTime - startTime}ms`);
      console.log(`📊 Results: ${result.success}/${result.processed} users processed successfully`);
      console.log(`📱 Total reminders sent: ${result.totalReminders || 0}`);
      
      return result;
    } catch (error) {
      console.error('❌ Error in manual reminder processing:', error);
      throw error;
    }
  }

  // Get all scheduled jobs status
  getJobsStatus() {
    const status = {};
    
    for (const [jobName, job] of this.jobs) {
      status[jobName] = {
        running: job.running,
        lastRun: job.lastDate,
        nextRun: job.nextDate,
        scheduled: job.scheduled
      };
    }
    
    return status;
  }

  // Stop all cron jobs
  stopAllJobs() {
    console.log('🛑 Stopping all cron jobs...');
    
    for (const [jobName, job] of this.jobs) {
      try {
        job.stop();
        console.log(`✅ Stopped job: ${jobName}`);
      } catch (error) {
        console.error(`❌ Error stopping job ${jobName}:`, error);
      }
    }
    
    this.jobs.clear();
    this.isInitialized = false;
    console.log('✅ All cron jobs stopped');
  }

  // Restart all cron jobs
  async restart() {
    console.log('🔄 Restarting cron service...');
    
    try {
      this.stopAllJobs();
      await this.initialize();
      console.log('✅ Cron service restarted successfully');
    } catch (error) {
      console.error('❌ Error restarting cron service:', error);
      throw error;
    }
  }

  // Log reminder processing results
  logReminderProcessing(result) {
    // This can be extended to log to external monitoring systems
    // For now, just console log
    console.log(`📊 Reminder Processing Log: ${new Date().toISOString()}`);
    console.log(`   - Processed: ${result.processed}`);
    console.log(`   - Successful: ${result.success}`);
    console.log(`   - Failed: ${result.processed - result.success}`);
    console.log(`   - Total Reminders: ${result.totalReminders || 0}`);
  }

  // Log errors
  logError(message, error) {
    // This can be extended to log to external error tracking systems
    console.error(`🚨 Error Log: ${new Date().toISOString()}`);
    console.error(`   - Message: ${message}`);
    console.error(`   - Error: ${error.message}`);
    console.error(`   - Stack: ${error.stack}`);
  }
}

module.exports = new CronService();
