const express = require('express');
const router = express.Router();

// Accept session events and email users
router.post('/event', async (req, res) => {
  try {
    const { uid, role, type, timestamp, platform, email, location } = req.body || {};
    if (!uid || !type) {
      return res.status(400).json({ success: false, error: 'uid and type are required' });
    }

    // Always respond immediately to avoid client timeouts; do email async
    res.status(204).send();

    // Fire-and-forget email (if recipient provided and email service configured)
    process.nextTick(async () => {
      try {
        if (!email) return; // no recipient, skip silently
        const { sendSessionEmail } = require('../services/emailService');
        const attachments = [];

        const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const emailPromise = sendSessionEmail({
          to: email,
          subject: `Arcular+ ${type === 'logout' ? 'Logout' : 'Login'} Activity`,
          action: type,
          device: platform,
          ip: ipAddress,
          location,
          timestamp,
          attachments,
        });

        // Add 7s safety timeout so we never hang the event loop
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Email send timeout')), 7000)
        );

        await Promise.race([emailPromise, timeoutPromise]).catch((err) => {
          console.error('Session email send skipped:', err.message);
        });
      } catch (err) {
        console.error('Session email task error:', err.message);
      }
    });
  } catch (e) {
    console.error('Session event error:', e);
    // Response is already sent; just ensure no throw bubbles
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
      const logoPath = path.join(__dirname, '..', 'assets', 'logo1.png');
      if (fs.existsSync(logoPath)) {
        attachments.push({ filename: 'logo1.png', path: logoPath, cid: 'brandlogo' });
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


