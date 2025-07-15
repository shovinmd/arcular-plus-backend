# Arcular+ Backend API

A comprehensive Node.js backend for the Arcular+ healthcare application.

## Features

- User management (Patients/Hospitals)
- Appointment scheduling
- Medication tracking
- Report upload and management
- Doctor management
- File upload support

## Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create `.env` file:
   ```env
   PORT=3000
   MONGODB_URI=mongodb://localhost:27017/arcular_plus
   JWT_SECRET=your-secret-key
   ```

3. Start server:
   ```bash
   npm run dev
   ```

## API Endpoints

### Health Check
- `GET /api/health`

### Users
- `GET /api/users/:uid`
- `POST /api/users`
- `PUT /api/users/:uid`

### Appointments
- `GET /api/appointments/user/:userId`
- `POST /api/appointments`
- `PUT /api/appointments/:id`
- `DELETE /api/appointments/:id`

### Medications
- `GET /api/medications/user/:userId`
- `POST /api/medications`
- `PUT /api/medications/:id`
- `DELETE /api/medications/:id`

### Reports
- `GET /api/reports/user/:userId`
- `POST /api/reports/upload`
- `DELETE /api/reports/:id`

### Doctors
- `GET /api/doctors`
- `POST /api/doctors`
- `PUT /api/doctors/:id`
- `DELETE /api/doctors/:id` 