# 🔥 FCM Notification Setup Guide

## Overview
This guide explains how to set up and test Firebase Cloud Messaging (FCM) notifications for menstrual cycle reminders in the Arcular+ backend.

## 🚀 What's Been Implemented

### 1. **Enhanced FCM Service** (`services/fcmService.js`)
- ✅ Proper Firebase Admin initialization
- ✅ Automatic retry and error handling
- ✅ Support for Android, iOS, and Web notifications
- ✅ Custom notification icons and colors
- ✅ Token validation and cleanup

### 2. **Updated Menstrual Reminder Service** (`services/menstrualReminderService.js`)
- ✅ Uses **stored predictions** from database (not backend calculations)
- ✅ Sends reminders 1 day before events
- ✅ Supports all reminder types: period, ovulation, fertile window, period end
- ✅ Better logging and error handling

### 3. **Enhanced Cron Service** (`services/cronService.js`)
- ✅ FCM status checking before processing
- ✅ Better logging and monitoring
- ✅ Automatic FCM service initialization

### 4. **Test Endpoints**
- ✅ `/test-fcm` - Test FCM notifications
- ✅ `/test-reminders` - Manually trigger reminder processing
- ✅ `/fcm-status` - Check FCM service status
- ✅ `/cron-status` - Check cron job status

## 🔧 Current Setup Status

### Firebase Admin Configuration
- ✅ `firebase-admin` package installed
- ✅ Firebase initialization in `firebase.js`
- ✅ Environment variables configured

### What's Working
- ✅ Cron jobs scheduling (node-cron)
- ✅ Database queries and data processing
- ✅ Reminder logic and calculations

### What Needs Testing
- ⚠️ FCM token delivery to devices
- ⚠️ Push notification display
- ⚠️ Cross-platform compatibility

## 🧪 Testing the FCM System

### 1. **Check FCM Service Status**
```bash
GET /api/menstrual/fcm-status
```
This will show if Firebase Admin is properly initialized.

### 2. **Test FCM Notification**
```bash
POST /api/menstrual/test-fcm
Content-Type: application/json

{
  "userId": "your-user-id",
  "message": {
    "title": "Test Title",
    "body": "Test Body"
  }
}
```

### 3. **Test Reminder Processing**
```bash
POST /api/menstrual/test-reminders
```
This manually triggers the daily reminder processing.

### 4. **Check Cron Status**
```bash
GET /api/menstrual/cron-status
```
Shows the status of all scheduled jobs.

## 📱 How Notifications Work

### 1. **Daily Processing (12:00 PM IST - Noon)**
- Cron job runs every day at 12:00 PM (noon)
- Checks all users with menstrual data
- Finds users due for reminders
- Sends FCM notifications

### 2. **Reminder Types**
- **Period Reminder**: 1 day before predicted period start
- **Ovulation Reminder**: 1 day before predicted ovulation
- **Fertile Window**: 1 day before fertile window starts
- **Period End**: 1 day before predicted period end

### 3. **Notification Flow**
```
Database (stored predictions) → Reminder Service → FCM Service → Device
```

## 🚨 Troubleshooting

### Common Issues

#### 1. **"Firebase Admin not initialized"**
- Check if `firebase.js` is imported in `server.js`
- Verify environment variables are set
- Check for service account key file

#### 2. **"FCM service not ready"**
- Wait for Firebase Admin to initialize
- Check Firebase project configuration
- Verify service account permissions

#### 3. **"No valid FCM tokens found"**
- Users need to have FCM tokens stored
- Check if Flutter app is sending tokens to backend
- Verify token storage in User model

### Debug Steps

1. **Check server logs** for FCM initialization
2. **Verify Firebase project** configuration
3. **Test with a known user ID** that has FCM token
4. **Check device notification settings**

## 🔄 Next Steps

### 1. **Test with Real Device**
- Use a real Flutter app with FCM token
- Test notification delivery
- Verify notification display

### 2. **Monitor Daily Processing**
- Check logs at 9:00 AM IST
- Verify reminders are sent
- Monitor FCM delivery rates

### 3. **Optimize Notification Timing**
- Adjust reminder timing (currently 1 day before)
- Add multiple reminder options
- Implement user preference controls

## 📊 Expected Results

When working correctly, you should see:

```
✅ FCM Service initialized successfully
✅ FCM connected to project: arcularplus-7e66c
✅ Daily reminder processing completed
📊 Results: 5/5 users processed successfully
📱 Total reminders sent: 8
```

## 🆘 Need Help?

If you encounter issues:

1. Check the server logs for error messages
2. Verify Firebase project configuration
3. Test with the provided endpoints
4. Ensure users have valid FCM tokens

The system is designed to be robust and will automatically retry failed operations.
