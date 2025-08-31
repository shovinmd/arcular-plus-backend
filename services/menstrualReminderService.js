const fcmService = require('./fcmService');
const User = require('../models/User');
const MenstrualCycle = require('../models/MenstrualCycle');

class MenstrualReminderService {
  constructor() {
    this.reminderTypes = {
      NEXT_PERIOD: 'next_period',
      OVULATION: 'ovulation',
      FERTILE_WINDOW: 'fertile_window',
      PERIOD_END: 'period_end'
    };
  }

  // Check if today is a reminder day for a user using STORED predictions
  async checkUserReminders(userId) {
    try {
      const user = await User.findOne({ uid: userId });
      if (!user || !user.fcmToken || !user.notificationPreferences?.menstrualReminders) {
        console.log(`⚠️ User ${userId} not eligible for reminders:`, {
          hasUser: !!user,
          hasFcmToken: !!user?.fcmToken,
          menstrualRemindersEnabled: user?.notificationPreferences?.menstrualReminders
        });
        return null;
      }

      const menstrualData = await MenstrualCycle.findOne({ userId });
      if (!menstrualData) {
        console.log(`⚠️ No menstrual data found for user ${userId}`);
        return null;
      }

      // Use STORED predictions from database (calculated by frontend)
      const nextPeriod = menstrualData.nextPeriod;
      const ovulationDay = menstrualData.ovulationDay;
      const fertileWindow = menstrualData.fertileWindow;
      const periodEnd = menstrualData.periodEnd;

      console.log(`🔍 Checking reminders for user ${userId}:`, {
        nextPeriod: nextPeriod,
        ovulationDay: ovulationDay,
        fertileWindow: fertileWindow,
        periodEnd: periodEnd,
        remindNextPeriod: menstrualData.remindNextPeriod,
        remindOvulation: menstrualData.remindOvulation,
        remindFertileWindow: menstrualData.remindFertileWindow
      });

      if (!nextPeriod && !ovulationDay && !fertileWindow && !periodEnd) {
        console.log(`⚠️ No stored predictions found for user ${userId}`);
        return null;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      console.log(`📅 Today's date: ${today.toDateString()} (${today.toISOString()})`);
      
      const reminders = [];

      // Check next period reminder (1 day before)
      if (menstrualData.remindNextPeriod && nextPeriod) {
        const nextPeriodDate = new Date(nextPeriod);
        nextPeriodDate.setHours(0, 0, 0, 0);
        
        // Send reminder 1 day before
        const reminderDate = new Date(nextPeriodDate);
        reminderDate.setDate(nextPeriodDate.getDate() - 1);
        
        console.log(`🔍 Next period check:`, {
          nextPeriodDate: nextPeriodDate.toDateString(),
          reminderDate: reminderDate.toDateString(),
          today: today.toDateString(),
          isReminderDay: this.isSameDay(today, reminderDate)
        });
        
        if (this.isSameDay(today, reminderDate)) {
          reminders.push({
            type: this.reminderTypes.NEXT_PERIOD,
            title: '🩸 Period Reminder',
            body: 'Your period is predicted to start tomorrow. Take care!',
            data: { 
              screen: 'menstrual-cycle',
              reminderType: 'next_period',
              predictedDate: nextPeriodDate.toISOString()
            }
          });
        }
      }

      // Check ovulation reminder (1 day before)
      if (menstrualData.remindOvulation && ovulationDay) {
        const ovulationDate = new Date(ovulationDay);
        ovulationDate.setHours(0, 0, 0, 0);
        
        // Send reminder 1 day before
        const reminderDate = new Date(ovulationDate);
        reminderDate.setDate(ovulationDate.getDate() - 1);
        
        if (this.isSameDay(today, reminderDate)) {
          reminders.push({
            type: this.reminderTypes.OVULATION,
            title: '🥚 Ovulation Reminder',
            body: 'Your ovulation day is predicted for tomorrow.',
            data: { 
              screen: 'menstrual-cycle',
              reminderType: 'ovulation',
              predictedDate: ovulationDate.toISOString()
            }
          });
        }
      }

      // Check fertile window reminder (1 day before start)
      if (menstrualData.remindFertileWindow && fertileWindow && fertileWindow.start) {
        const fertileStart = new Date(fertileWindow.start);
        fertileStart.setHours(0, 0, 0, 0);
        
        // Send reminder 1 day before fertile window starts
        const reminderDate = new Date(fertileStart);
        reminderDate.setDate(fertileStart.getDate() - 1);
        
        if (this.isSameDay(today, reminderDate)) {
          reminders.push({
            type: this.reminderTypes.FERTILE_WINDOW,
            title: '🌱 Fertile Window Reminder',
            body: 'Your fertile window starts tomorrow and lasts for 5 days.',
            data: { 
              screen: 'menstrual-cycle',
              reminderType: 'fertile_window',
              startDate: fertileStart.toISOString(),
              endDate: fertileWindow.end ? fertileWindow.end.toISOString() : null
            }
          });
        }
      }

      // Check period end reminder (1 day before)
      if (periodEnd) {
        const periodEndDate = new Date(periodEnd);
        periodEndDate.setHours(0, 0, 0, 0);
        
        // Send reminder 1 day before period ends
        const reminderDate = new Date(periodEndDate);
        reminderDate.setDate(periodEndDate.getDate() - 1);
        
        if (this.isSameDay(today, reminderDate)) {
          reminders.push({
            type: this.reminderTypes.PERIOD_END,
            title: '🩸 Period Ending Soon',
            body: 'Your period is predicted to end tomorrow.',
            data: { 
              screen: 'menstrual-cycle',
              reminderType: 'period_end',
              predictedDate: periodEndDate.toISOString()
            }
          });
        }
      }

      if (reminders.length > 0) {
        console.log(`📅 Found ${reminders.length} reminders for user ${userId} on ${today.toDateString()}`);
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

      console.log(`📱 Sending ${reminders.length} reminders to user ${userId}`);

      let sentCount = 0;
      for (const reminder of reminders) {
        try {
          const success = await fcmService.sendToUser(userId, reminder);
          if (success) {
            sentCount++;
            console.log(`✅ Sent ${reminder.type} reminder to user ${userId}`);
          } else {
            console.log(`❌ Failed to send ${reminder.type} reminder to user ${userId}`);
          }
          
          // Small delay between notifications
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`❌ Error sending ${reminder.type} reminder to user ${userId}:`, error);
        }
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
      let totalRemindersSent = 0;

      for (const user of users) {
        processedCount++;
        
        try {
          console.log(`\n👤 Processing user ${user.uid} (${user.fullName || 'Unknown'})`);
          
          const success = await this.sendUserReminders(user.uid);
          if (success) {
            successCount++;
            // Count how many reminders were sent
            const reminders = await this.checkUserReminders(user.uid);
            if (reminders) {
              totalRemindersSent += reminders.length;
            }
          }
          
          // Add small delay to avoid overwhelming FCM
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(`❌ Error processing user ${user.uid}:`, error);
        }
      }

      console.log(`\n📊 Daily reminder processing complete:`);
      console.log(`   - Users processed: ${processedCount}`);
      console.log(`   - Users with successful reminders: ${successCount}`);
      console.log(`   - Total reminders sent: ${totalRemindersSent}`);
      
      return { 
        processed: processedCount, 
        success: successCount, 
        totalReminders: totalRemindersSent 
      };
    } catch (error) {
      console.error('❌ Error in daily reminder processing:', error);
      return { processed: 0, success: 0, totalReminders: 0, error: error.message };
    }
  }

  // Check if two dates are the same day
  isSameDay(date1, date2) {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  }

  // Get upcoming reminders for a user (for dashboard display)
  async getUpcomingReminders(userId, days = 30) {
    try {
      const menstrualData = await MenstrualCycle.findOne({ userId });
      if (!menstrualData) {
        return [];
      }

      const today = new Date();
      const futureDate = new Date();
      futureDate.setDate(today.getDate() + days);

      const reminders = [];

      // Check next period
      if (menstrualData.remindNextPeriod && menstrualData.nextPeriod) {
        const nextPeriod = new Date(menstrualData.nextPeriod);
        if (nextPeriod >= today && nextPeriod <= futureDate) {
          reminders.push({
            type: 'next_period',
            title: '🩸 Period Reminder',
            body: 'Your period is predicted to start',
            date: nextPeriod,
            daysUntil: Math.ceil((nextPeriod - today) / (1000 * 60 * 60 * 24))
          });
        }
      }

      // Check ovulation
      if (menstrualData.remindOvulation && menstrualData.ovulationDay) {
        const ovulation = new Date(menstrualData.ovulationDay);
        if (ovulation >= today && ovulation <= futureDate) {
          reminders.push({
            type: 'ovulation',
            title: '🥚 Ovulation Day',
            body: 'Your ovulation day is predicted',
            date: ovulation,
            daysUntil: Math.ceil((ovulation - today) / (1000 * 60 * 60 * 24))
          });
        }
      }

      // Check fertile window
      if (menstrualData.remindFertileWindow && menstrualData.fertileWindow && menstrualData.fertileWindow.start) {
        const fertileStart = new Date(menstrualData.fertileWindow.start);
        if (fertileStart >= today && fertileStart <= futureDate) {
          reminders.push({
            type: 'fertile_window',
            title: '🌱 Fertile Window',
            body: 'Your fertile window starts',
            date: fertileStart,
            daysUntil: Math.ceil((fertileStart - today) / (1000 * 60 * 60 * 24))
          });
        }
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
