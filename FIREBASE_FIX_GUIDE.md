# 🔥 Firebase Admin SDK JWT Signature Error - Fix Guide

## ❌ **Error Description:**
```
Error: Failed to create Firebase user: Credential implementation provided to initializeApp() 
via the "credential" property failed to fetch a valid Google OAuth2 access token with 
the following error: "invalid_grant: Invalid JWT Signature."
```

## 🔍 **Root Causes:**
1. **Service Account Key Expired/Revoked** - Most likely cause
2. **Server Time Not Synced** - Less common
3. **Corrupted Service Account Key File**
4. **Firebase Project Settings Changed**

## 🚀 **Immediate Fix Steps:**

### **Step 1: Generate New Service Account Key**

1. **Go to Firebase Console:**
   - Visit: https://console.firebase.google.com/
   - Select your project: `arcularplus-7e66c`

2. **Navigate to Service Accounts:**
   - Click **Project Settings** (gear icon)
   - Go to **Service Accounts** tab
   - Click **Firebase Admin SDK**

3. **Generate New Key:**
   - Click **Generate New Private Key**
   - Download the JSON file
   - **IMPORTANT:** This will invalidate the old key

4. **Replace the Key File:**
   - Rename downloaded file to `serviceAccountKey.json`
   - Replace the existing file in `node_backend/` folder

### **Step 2: Update Environment Variables (Optional)**

If you want to use environment variables instead of file:

```bash
# In your Render environment variables:
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"arcularplus-7e66c",...}
FIREBASE_PROJECT_ID=arcularplus-7e66c
```

### **Step 3: Test the Fix**

1. **Restart your backend server**
2. **Test Firebase Admin:**
   - Visit: `/api/firebase-status`
   - Visit: `/api/test-firebase`

## 🔧 **Alternative Solutions:**

### **Option A: Use Default Credentials (Recommended for Production)**

The system will automatically fall back to default credentials if service account fails:

```javascript
// This happens automatically in firebase.js
admin.initializeApp({
  projectId: 'arcularplus-7e66c'
});
```

### **Option B: Environment Variable Service Account**

Set the entire service account JSON as an environment variable:

```bash
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"arcularplus-7e66c",...}'
```

## 📋 **Verification Steps:**

1. **Check Firebase Status:**
   ```bash
   GET /api/firebase-status
   ```

2. **Test Firebase Admin:**
   ```bash
   GET /api/test-firebase
   ```

3. **Try Creating Staff:**
   - Use the admin dashboard
   - Should work without JWT signature errors

## 🚨 **If Still Not Working:**

### **Check Server Time:**
```bash
# On your server
date
# Should be within 1-2 minutes of current time
```

### **Check Firebase Project:**
- Ensure project `arcularplus-7e66c` exists
- Verify Firebase Admin SDK is enabled
- Check if billing is set up (required for some features)

### **Check Service Account Permissions:**
- Service account should have `Firebase Admin` role
- Should have access to Authentication and other services

## 📞 **Support:**

If the issue persists:
1. Check Firebase Console for any project-level issues
2. Verify the new service account key has correct permissions
3. Ensure your Firebase project is on the correct plan

## ✅ **Expected Result:**

After applying the fix:
- ✅ Firebase Admin SDK initializes successfully
- ✅ Staff creation works without JWT errors
- ✅ Firebase users are created successfully
- ✅ MongoDB records are saved correctly

---

**Last Updated:** $(date)
**Status:** Ready for implementation
