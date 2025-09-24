const express = require('express');
const router = express.Router();

// Accept session events and email users
router.post('/event', async (req, res) => {
  try {
    const { uid, role, type, timestamp, platform, email, location } = req.body || {};
    if (!uid || !type) {
      return res.status(400).json({ success: false, error: 'uid and type are required' });
    }

    // Respond immediately; send email in background if recipient provided
    res.status(204).send();

    process.nextTick(async () => {
      try {
        const to = email || null;
        console.log('SESSION_EMAIL: queued', {
          uid,
          role,
          type,
          email: !!to,
          platform,
          ts: timestamp,
        });
        if (!to) return;

        const { sendSessionEmail } = require('../services/emailService');
        const attachments = [];
        try {
          const path = require('path');
          const fs = require('fs');
          const logoPath = path.join(__dirname, '..', 'assets', 'logo1.png');
          if (fs.existsSync(logoPath)) {
            attachments.push({ filename: 'logo1.png', path: logoPath, cid: 'brandlogo' });
          }
        } catch (_) {}

        const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        await sendSessionEmail({
          to,
          subject: `Arcular+ ${type === 'logout' ? 'Logout' : 'Login'} Activity`,
          action: type,
          device: platform,
          ip: ipAddress,
          location,
          timestamp,
          attachments,
        });
        console.log('SESSION_EMAIL: sent', { uid, type, to });
      } catch (err) {
        console.error('SESSION_EMAIL: failed', { error: err.message });
      }
    });
  } catch (e) {
    console.error('Session event error:', e);
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


