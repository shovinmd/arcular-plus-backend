const fcmService = require('./fcmService');
const User = require('../models/User');
const MenstrualCycle = require('../models/MenstrualCycle');

class MenstrualReminderService {
  constructor() {
    this.reminderTypes = {
      NEXT_PERIOD: 'next_period',
      OVULATION: 'ovulation',
      FERTILE_WINDOW: 'fertile_window',
      PERIOD_START: 'period_start'
    };
  }

  // Calculate next period start date
  calculateNextPeriod(lastPeriodStart, cycleLength) {
    if (!lastPeriodStart || !cycleLength) return null;
    
    const lastDate = new Date(lastPeriodStart);
    const nextDate = new Date(lastDate);
    nextDate.setDate(lastDate.getDate() + cycleLength);
    
    return nextDate;
  }

  // Calculate ovulation date
  calculateOvulation(lastPeriodStart, cycleLength) {
    if (!lastPeriodStart || !cycleLength) return null;
    
    const lastDate = new Date(lastPeriodStart);
    const ovulationDate = new Date(lastDate);
    ovulationDate.setDate(lastDate.getDate() + (cycleLength - 14));
    
    return ovulationDate;
  }

  // Calculate fertile window (5 days around ovulation)
  calculateFertileWindow(lastPeriodStart, cycleLength) {
    if (!lastPeriodStart || !cycleLength) return null;
    
    const ovulationDate = this.calculateOvulation(lastPeriodStart, cycleLength);
    if (!ovulationDate) return null;
    
    const fertileStart = new Date(ovulationDate);
    fertileStart.setDate(ovulationDate.getDate() - 2);
    
    const fertileEnd = new Date(ovulationDate);
    fertileEnd.setDate(ovulationDate.getDate() + 2);
    
    return {
      start: fertileStart,
      end: fertileEnd,
      ovulation: ovulationDate
    };
  }

  // Check if today is a reminder day for a user
  async checkUserReminders(userId) {
    try {
      const user = await User.findOne({ uid: userId });
      if (!user || !user.fcmToken || !user.notificationPreferences?.menstrualReminders) {
        return null;
      }

      const menstrualData = await MenstrualCycle.findOne({ userId });
      if (!menstrualData || !menstrualData.lastPeriodStartDate) {
        return null;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const nextPeriod = this.calculateNextPeriod(
        menstrualData.lastPeriodStartDate, 
        menstrualData.cycleLength
      );
      
      const ovulation = this.calculateOvulation(
        menstrualData.lastPeriodStartDate, 
        menstrualData.cycleLength
      );
      
      const fertileWindow = this.calculateFertileWindow(
        menstrualData.lastPeriodStartDate, 
        menstrualData.cycleLength
      );

      const reminders = [];

      // Check next period reminder
      if (menstrualData.reminders?.nextPeriod && nextPeriod) {
        const nextPeriodDate = new Date(nextPeriod);
        nextPeriodDate.setHours(0, 0, 0, 0);
        
        if (this.isSameDay(today, nextPeriodDate)) {
          reminders.push({
            type: this.reminderTypes.NEXT_PERIOD,
            title: '🩸 Period Reminder',
            body: 'Your period is predicted to start today. Take care!',
            data: { screen: 'menstrual-cycle' }
          });
        }
      }

      // Check ovulation reminder
      if (menstrualData.reminders?.ovulation && ovulation) {
        const ovulationDate = new Date(ovulation);
        ovulationDate.setHours(0, 0, 0, 0);
        
        if (this.isSameDay(today, ovulationDate)) {
          reminders.push({
            type: this.reminderTypes.OVULATION,
            title: '🥚 Ovulation Day',
            body: 'Today is your predicted ovulation day.',
            data: { screen: 'menstrual-cycle' }
          });
        }
      }

      // Check fertile window reminder
      if (menstrualData.reminders?.fertileWindow && fertileWindow) {
        const fertileStart = new Date(fertileWindow.start);
        fertileStart.setHours(0, 0, 0, 0);
        
        if (this.isSameDay(today, fertileStart)) {
          reminders.push({
            type: this.reminderTypes.FERTILE_WINDOW,
            title: '🌱 Fertile Window',
            body: 'Your fertile window starts today and lasts for 5 days.',
            data: { screen: 'menstrual-cycle' }
          });
        }
      }

      return reminders;
    } catch (error) {
      console.error(`❌ Error checking reminders for user ${userId}:`, error);
      return null;
    }
  }

  // Send reminders to a specific user
  async sendUserReminders(userId) {
    try {
      const reminders = await this.checkUserReminders(userId);
      if (!reminders || reminders.length === 0) {
        return false;
      }

      let sentCount = 0;
      for (const reminder of reminders) {
        const success = await fcmService.sendToUser(userId, reminder);
        if (success) sentCount++;
      }

      console.log(`✅ Sent ${sentCount}/${reminders.length} reminders to user ${userId}`);
      return sentCount > 0;
    } catch (error) {
      console.error(`❌ Error sending reminders to user ${userId}:`, error);
      return false;
    }
  }

  // Process all users for daily reminders
  async processDailyReminders() {
    try {
      console.log('🕐 Starting daily menstrual reminder processing...');
      
      // Get all users with menstrual data and FCM tokens
      const users = await User.find({
        fcmToken: { $exists: true, $ne: null },
        'notificationPreferences.menstrualReminders': true
      });

      console.log(`📱 Found ${users.length} users with FCM tokens and menstrual reminders enabled`);

      let processedCount = 0;
      let successCount = 0;

      for (const user of users) {
        processedCount++;
        
        try {
          const success = await this.sendUserReminders(user.uid);
          if (success) successCount++;
          
          // Add small delay to avoid overwhelming FCM
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`❌ Error processing user ${user.uid}:`, error);
        }
      }

      console.log(`✅ Daily reminder processing complete: ${successCount}/${processedCount} users processed successfully`);
      return { processed: processedCount, success: successCount };
    } catch (error) {
      console.error('❌ Error in daily reminder processing:', error);
      return { processed: 0, success: 0, error: error.message };
    }
  }

  // Check if two dates are the same day
  isSameDay(date1, date2) {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  }

  // Get upcoming reminders for a user (next 30 days)
  async getUpcomingReminders(userId) {
    try {
      const user = await User.findOne({ uid: userId });
      if (!user || !user.notificationPreferences?.menstrualReminders) {
        return [];
      }

      const menstrualData = await MenstrualCycle.findOne({ userId });
      if (!menstrualData || !menstrualData.lastPeriodStartDate) {
        return [];
      }

      const today = new Date();
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(today.getDate() + 30);

      const reminders = [];
      let currentDate = new Date(menstrualData.lastPeriodStartDate);
      
      // Generate reminders for next 3 cycles
      for (let cycle = 0; cycle < 3; cycle++) {
        const nextPeriod = new Date(currentDate);
        nextPeriod.setDate(currentDate.getDate() + menstrualData.cycleLength);
        
        if (nextPeriod >= today && nextPeriod <= thirtyDaysFromNow) {
          reminders.push({
            date: nextPeriod,
            type: 'Next Period',
            description: 'Your period is predicted to start'
          });
        }

        const ovulation = new Date(nextPeriod);
        ovulation.setDate(nextPeriod.getDate() - 14);
        
        if (ovulation >= today && ovulation <= thirtyDaysFromNow) {
          reminders.push({
            date: ovulation,
            type: 'Ovulation',
            description: 'Your ovulation day'
          });
        }

        const fertileStart = new Date(ovulation);
        fertileStart.setDate(ovulation.getDate() - 2);
        
        if (fertileStart >= today && fertileStart <= thirtyDaysFromNow) {
          reminders.push({
            date: fertileStart,
            type: 'Fertile Window',
            description: 'Your fertile window starts'
          });
        }

        currentDate = nextPeriod;
      }

      // Sort by date
      reminders.sort((a, b) => a.date - b.date);
      
      return reminders;
    } catch (error) {
      console.error(`❌ Error getting upcoming reminders for user ${userId}:`, error);
      return [];
    }
  }
}

module.exports = new MenstrualReminderService();
