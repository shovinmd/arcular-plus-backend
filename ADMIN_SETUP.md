# Admin System Setup Guide

## Overview
This guide explains how to set up the admin and staff web interface for Arcular Plus.

## Features
- **Admin Panel**: Full system access and control
- **Staff Panel**: Review and approve user registrations
- **Web Interface**: Accessible via browser and Flutter app WebView
- **Firebase Integration**: Secure authentication for staff members

## Setup Steps

### 1. Environment Variables
Create a `.env` file in the `node_backend` directory with the following variables:

```env
# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/arcular_plus

# Firebase Admin SDK
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY_ID=your-private-key-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour Private Key Here\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=your-service-account-email@your-project.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=your-client-id
FIREBASE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
FIREBASE_TOKEN_URI=https://oauth2.googleapis.com/token
FIREBASE_AUTH_PROVIDER_X509_CERT_URL=https://www.googleapis.com/oauth2/v1/certs
FIREBASE_CLIENT_X509_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/your-service-account-email%40your-project.iam.gserviceaccount.com

# Email Configuration
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# Admin Credentials
ADMIN_EMAIL=admin@arcular.com
ADMIN_PASSWORD=admin123

# Session Secret
SESSION_SECRET=your-super-secret-session-key-here

# Server Port
PORT=3000
```

### 2. Default Admin Credentials
- **Email**: admin@arcular.com
- **Password**: admin123

**⚠️ IMPORTANT**: Change these credentials in production!

### 3. Access URLs
- **Admin Panel**: http://localhost:3000/admin/login
- **Staff Panel**: http://localhost:3000/staff/login

### 4. Flutter App Integration
The admin system is accessible from the Flutter app through:
- **Admin Selection Screen**: Choose between admin and staff access
- **WebView Integration**: Loads the web interface within the app
- **Cross-Platform**: Works on mobile, web, and desktop

## How It Works

### Admin Flow
1. Admin logs in with email/password
2. Creates staff accounts with Firebase authentication
3. Staff accounts are stored in MongoDB
4. Staff can then log in and review registrations

### Staff Flow
1. Staff logs in with Firebase credentials
2. Views pending user registrations
3. Reviews documents and user information
4. Approves, rejects, or requests additional documents
5. Sends email notifications to users

### User Registration Flow
1. User registers through Flutter app
2. Registration is stored with 'pending' status
3. Staff reviews the registration
4. Staff approves/rejects or requests documents
5. User receives email notification
6. If approved, user can access their dashboard

## Security Features
- **Session Management**: Secure server-side sessions
- **Firebase Authentication**: For staff members
- **Role-Based Access**: Different permissions for admin vs staff
- **Email Notifications**: Secure communication with users

## File Structure
```
node_backend/
├── controllers/
│   ├── adminWebController.js    # Admin web interface logic
│   └── staffWebController.js    # Staff web interface logic
├── routes/
│   ├── adminWebRoutes.js        # Admin web routes
│   └── staffWebRoutes.js        # Staff web routes
├── public/
│   ├── admin/                   # Admin web pages
│   │   ├── login.html
│   │   └── dashboard.html
│   └── staff/                   # Staff web pages
│       ├── login.html
│       └── dashboard.html
└── services/
    └── emailService.js          # Email notification service
```

## Troubleshooting

### Common Issues
1. **Session not working**: Check SESSION_SECRET in .env
2. **Firebase auth failing**: Verify Firebase Admin SDK credentials
3. **Email not sending**: Check EMAIL_USER and EMAIL_PASS
4. **WebView not loading**: Ensure server is running on correct port

### Testing
1. Start the backend server: `npm start`
2. Access admin panel: http://localhost:3000/admin/login
3. Create staff accounts through admin dashboard
4. Test staff login and approval workflow

## Production Considerations
- Use strong, unique passwords
- Enable HTTPS
- Set secure session cookies
- Implement rate limiting
- Add logging and monitoring
- Regular security audits
