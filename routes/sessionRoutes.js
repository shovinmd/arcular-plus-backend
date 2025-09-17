const express = require('express');
const router = express.Router();

// Accept session events and email users
router.post('/event', async (req, res) => {
  try {
    const { uid, role, type, timestamp, platform, email, location } = req.body || {};
    if (!uid || !type) {
      return res.status(400).json({ success: false, error: 'uid and type are required' });
    }

    // Prepare email
    const { sendSessionEmail } = require('../services/emailService');
    const to = email || process.env.FALLBACK_SESSION_EMAIL || null;
    const attachments = [];
    // Attach brand logo from server assets if available
    try {
      const path = require('path');
      const fs = require('fs');
      const logoPath = path.join(__dirname, '..', 'assets', 'brand-logo.png');
      if (fs.existsSync(logoPath)) {
        attachments.push({ filename: 'brand-logo.png', path: logoPath, cid: 'brandlogo' });
      }
    } catch (_) {}

    if (to) {
      await sendSessionEmail({
        to,
        subject: `Arcular+ ${type === 'logout' ? 'Logout' : 'Login'} Activity`,
        action: type,
        device: platform,
        ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
        location,
        timestamp,
        attachments,
      });
    }

    // Optionally persist minimal log (skipped to avoid DB writes per request)
    return res.status(204).send();
  } catch (e) {
    console.error('Session event error:', e);
    return res.status(500).json({ success: false });
  }
});

// Test endpoint to force-send a sample session email
router.post('/test', async (req, res) => {
  try {
    const { to } = req.body || {};
    const { sendSessionEmail } = require('../services/emailService');
    const address = to || process.env.EMAIL_USER;
    if (!address) {
      return res.status(400).json({ success: false, error: 'No recipient configured' });
    }

    const attachments = [];
    try {
      const path = require('path');
      const fs = require('fs');
      const logoPath = path.join(__dirname, '..', 'assets', 'brand-logo.png');
      if (fs.existsSync(logoPath)) {
        attachments.push({ filename: 'brand-logo.png', path: logoPath, cid: 'brandlogo' });
      }
    } catch (_) {}

    await sendSessionEmail({
      to: address,
      subject: 'Arcular+ Test Session Email',
      action: 'login',
      device: 'Test Device',
      ip: '127.0.0.1',
      location: { lat: 12.9716, lng: 77.5946 },
      timestamp: new Date().toISOString(),
      attachments,
    });

    return res.status(200).json({ success: true });
  } catch (e) {
    console.error('Session test email error:', e);
    return res.status(500).json({ success: false });
  }
});

module.exports = router;


