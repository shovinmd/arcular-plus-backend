const fcmService = require('./services/fcmService');
const menstrualReminderService = require('./services/menstrualReminderService');

// Test FCM service
async function testFCMService() {
  console.log('🧪 Testing FCM Service...');
  
  try {
    // Test sending a notification (you'll need a valid user ID and FCM token)
    const testUserId = 'test-user-id'; // Replace with actual test user ID
    const testNotification = {
      title: '🧪 Test Notification',
      body: 'This is a test notification from Arcular+',
      type: 'test',
      data: { screen: 'home' }
    };
    
    console.log('📱 Attempting to send test notification...');
    const result = await fcmService.sendToUser(testUserId, testNotification);
    console.log('✅ FCM Test Result:', result);
    
  } catch (error) {
    console.error('❌ FCM Test Error:', error.message);
  }
}

// Test menstrual reminder service
async function testMenstrualReminderService() {
  console.log('\n🧪 Testing Menstrual Reminder Service...');
  
  try {
    // Test date calculations
    const lastPeriodStart = new Date('2024-01-01');
    const cycleLength = 28;
    
    const nextPeriod = menstrualReminderService.calculateNextPeriod(lastPeriodStart, cycleLength);
    const ovulation = menstrualReminderService.calculateOvulation(lastPeriodStart, cycleLength);
    const fertileWindow = menstrualReminderService.calculateFertileWindow(lastPeriodStart, cycleLength);
    
    console.log('📅 Date Calculations:');
    console.log('  Last Period Start:', lastPeriodStart.toDateString());
    console.log('  Next Period:', nextPeriod?.toDateString());
    console.log('  Ovulation:', ovulation?.toDateString());
    console.log('  Fertile Window Start:', fertileWindow?.start.toDateString());
    console.log('  Fertile Window End:', fertileWindow?.end.toDateString());
    
  } catch (error) {
    console.error('❌ Menstrual Reminder Test Error:', error.message);
  }
}

// Test reminder checking
async function testReminderChecking() {
  console.log('\n🧪 Testing Reminder Checking...');
  
  try {
    // Test if today is a reminder day
    const testUserId = 'test-user-id'; // Replace with actual test user ID
    const reminders = await menstrualReminderService.checkUserReminders(testUserId);
    
    if (reminders && reminders.length > 0) {
      console.log('🔔 Found reminders for today:');
      reminders.forEach(reminder => {
        console.log(`  - ${reminder.title}: ${reminder.body}`);
      });
    } else {
      console.log('📭 No reminders for today');
    }
    
  } catch (error) {
    console.error('❌ Reminder Checking Test Error:', error.message);
  }
}

// Main test function
async function runTests() {
  console.log('🚀 Starting FCM Integration Tests...\n');
  
  await testFCMService();
  await testMenstrualReminderService();
  await testReminderChecking();
  
  console.log('\n✅ All tests completed!');
  console.log('\n📝 Note: Some tests may fail if:');
  console.log('  - No valid users exist in database');
  console.log('  - FCM tokens are not set');
  console.log('  - Firebase Admin is not configured');
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests };
