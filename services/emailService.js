const nodemailer = require('nodemailer');
const https = require('https');

// Email configuration
const normalizedPass = (process.env.EMAIL_PASS || 'iywfgkyzywbyufew').replace(/\s+/g, '');
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  pool: true,
  maxConnections: 2,
  maxMessages: 50,
  connectionTimeout: 10000,
  socketTimeout: 15000,
  greetingTimeout: 7000,
  auth: {
    user: process.env.EMAIL_USER || 'shovinmicheldavid1285@gmail.com',
    pass: normalizedPass
  }
});

// Startup provider notice: prefer Brevo if configured; verify SMTP only when used
if (process.env.BREVO_API_KEY) {
  console.log('✉️  Email provider: Brevo HTTP (primary)');
} else if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  transporter.verify((err) => {
    if (err) {
      console.error('✉️  SMTP verify failed:', err.message);
    } else {
      console.log('✉️  SMTP transporter ready');
    }
  });
} else {
  console.warn('✉️  No email provider configured (set BREVO_API_KEY or EMAIL_USER/PASS)');
}

// =============== Provider-agnostic send helper ===============
async function sendMailSmart({ to, subject, html, text, attachments }) {
  try {
    if (!to || (typeof to === 'string' && to.trim().length === 0)) {
      console.warn('✉️  Skipping email send: no recipient provided');
      return false;
    }

    // Prefer Brevo if API key is present (avoids SMTP egress issues on some hosts)
    if (process.env.BREVO_API_KEY) {
      try {
        const ok = await sendViaBrevo({ to, subject, html, text, attachments });
        if (ok) return true;
      } catch (brevoPrimaryErr) {
        console.warn('✉️  Brevo primary send failed, falling back to SMTP:', brevoPrimaryErr.message);
      }
    }

    // Gmail SMTP send
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER || 'shovinmicheldavid1285@gmail.com',
        to,
        subject,
        html,
        text,
        attachments,
      });
      return true;
    } catch (primaryErr) {
      // Fallback to STARTTLS on port 587 if port 465 times out or is blocked
      console.warn('✉️  Primary SMTP send failed, attempting STARTTLS fallback:', primaryErr.message);
      try {
        const fallback = nodemailer.createTransport({
          host: 'smtp.gmail.com',
          port: 587,
          secure: false, // STARTTLS
          pool: false,
          connectionTimeout: 8000,
          socketTimeout: 12000,
          greetingTimeout: 6000,
          auth: {
            user: process.env.EMAIL_USER || 'shovinmicheldavid1285@gmail.com',
            pass: normalizedPass
          },
          tls: {
            ciphers: 'TLSv1.2',
          }
        });
        await fallback.verify().catch(() => {});
        await fallback.sendMail({
          from: process.env.EMAIL_USER || 'shovinmicheldavid1285@gmail.com',
          to,
          subject,
          html,
          text,
          attachments,
        });
        return true;
      } catch (fallbackErr) {
        console.error('✉️  Fallback SMTP (587) failed:', fallbackErr.message);
        // Final fallback: Brevo HTTP API if configured
        if (process.env.BREVO_API_KEY) {
          try {
            const ok = await sendViaBrevo({ to, subject, html, text, attachments });
            if (ok) return true;
          } catch (brevoErr) {
            console.error('✉️  Brevo HTTP send failed:', brevoErr.message);
          }
        }
        return false;
      }
    }
  } catch (err) {
    console.error('✉️  sendMailSmart failed:', err.message);
    return false;
  }
}

// Brevo (Sendinblue) HTTP sender
function sendBrevoRequest(payload) {
  return new Promise((resolve, reject) => {
    const data = Buffer.from(JSON.stringify(payload));
    const req = https.request({
      method: 'POST',
      hostname: 'api.brevo.com',
      path: '/v3/smtp/email',
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': data.length,
      },
      timeout: 12000,
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ ok: true, body });
        } else {
          reject(new Error(`Brevo status ${res.statusCode}: ${body}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error('Brevo request timeout'));
    });
    req.write(data);
    req.end();
  });
}

async function sendViaBrevo({ to, subject, html, text }) {
  const senderEmail = process.env.BREVO_SENDER_EMAIL || process.env.EMAIL_USER || 'no-reply@arcular.plus';
  const senderName = process.env.BREVO_SENDER_NAME || 'Arcular Plus';
  const recipients = Array.isArray(to) ? to : [to];
  const toArray = recipients
    .filter(Boolean)
    .map((addr) => ({ email: String(addr).trim() }))
    .filter((r) => r.email.length > 3);
  if (toArray.length === 0) throw new Error('No valid recipients for Brevo');

  const payload = {
    sender: { email: senderEmail, name: senderName },
    to: toArray,
    subject: subject || 'Arcular+ Notification',
    htmlContent: html || undefined,
    textContent: text || undefined,
  };
  await sendBrevoRequest(payload);
  return true;
}

// Fire-and-forget executor to avoid blocking API responses
function sendInBackground(label, fn) {
  try {
    process.nextTick(async () => {
      try {
        await fn();
        console.log(`✉️  ${label}: sent`);
      } catch (err) {
        console.error(`✉️  ${label}: failed`, err.message);
      }
    });
  } catch (_) {}
}

// Send registration confirmation email
const sendRegistrationConfirmation = async (userEmail, userName, userType) => {
  try {
    const subject = `${userType.charAt(0).toUpperCase() + userType.slice(1)} Registration Received`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center;">
          <h1>Arcular Plus</h1>
          <h2>${subject}</h2>
        </div>
        <div style="padding: 20px;">
          <p>Dear ${userName},</p>
          <p>Thank you for registering with Arcular Plus as a <strong>${userType}</strong>!</p>
          <p>Your registration has been received and is currently under review by our admin team. This process typically takes 24-48 hours.</p>
          <p><strong>What happens next?</strong></p>
          <ul>
            <li>Our team will review your submitted documents and information</li>
            <li>You'll receive an email notification once the review is complete</li>
            <li>If approved, you'll get access to your dashboard</li>
            <li>If additional information is needed, we'll let you know what's required</li>
          </ul>
          <p>In the meantime, you can:</p>
          <ul>
            <li>Check your registration status in the app</li>
            <li>Ensure all required documents are uploaded</li>
            <li>Contact support if you have any questions</li>
          </ul>
          <p>We appreciate your patience and look forward to having you on board!</p>
          <p>Best regards,<br>Arcular Plus Team</p>
        </div>
      </div>
    `;
    
    sendInBackground('Registration email', async () => {
      const ok = await sendMailSmart({ to: userEmail, subject, html });
      if (!ok) throw new Error('provider failed');
    });
  } catch (error) {
    console.error('❌ Error sending registration confirmation email:', error);
  }
};

// Send approval email
const sendApprovalEmail = async (userEmail, userName, userType, isApproved, reason = '') => {
  try {
    const subject = isApproved ? 
      `${userType.charAt(0).toUpperCase() + userType.slice(1)} Registration Approved` : 
      `${userType.charAt(0).toUpperCase() + userType.slice(1)} Registration Update`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center;">
          <h1>Arcular Plus</h1>
          <h2>${subject}</h2>
        </div>
        <div style="padding: 20px;">
          <p>Dear ${userName},</p>
          ${isApproved ? 
            `<p>🎉 <strong>Congratulations!</strong> Your ${userType} registration has been approved!</p>
             <p><strong>You can now access the dashboard!</strong></p>
             <p>You can now:</p>
             <ul>
               <li>Access your ${userType} dashboard</li>
               <li>Start using all available features</li>
               <li>Connect with other healthcare professionals</li>
               <li>Begin providing services to patients</li>
             </ul>
             <p><strong>Next Steps:</strong></p>
             <ol>
               <li>Log in to your Arcular Plus account</li>
               <li>Complete your profile setup</li>
               <li>Explore the dashboard features</li>
               <li>Start using the platform</li>
             </ol>` :
            `<p>We regret to inform you that your ${userType} registration has been rejected.</p>
             <p><strong>Staff Comments:</strong> ${reason}</p>
             <p><strong>What you need to do:</strong></p>
             <ol>
               <li>Review the staff feedback above</li>
               <li>Address the issues mentioned in the comments</li>
               <li>Update your registration details accordingly</li>
               <li>Ensure all required documents are properly uploaded</li>
               <li><strong>Try registering again after 24-48 hours later</strong></li>
             </ol>
             <p><strong>Important:</strong> Please wait 24-48 hours before attempting to register again. This gives you time to address the feedback and prepare a complete application.</p>
             <p>Our team is here to help. If you have any questions, please don't hesitate to contact support.</p>`
          }
          <p>Best regards,<br>Arcular Plus Team</p>
        </div>
      </div>
    `;
    
    sendInBackground('Approval email', async () => {
      const ok = await sendMailSmart({ to: userEmail, subject, html });
      if (!ok) throw new Error('provider failed');
    });
  } catch (error) {
    console.error('❌ Error sending approval email:', error);
  }
};

// Send document review notification
const sendDocumentReviewNotification = async (userEmail, userName, userType, missingDocuments) => {
  try {
    const subject = `${userType.charAt(0).toUpperCase() + userType.slice(1)} Registration - Documents Required`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #ff9800 0%, #ffb74d 100%); color: white; padding: 20px; text-align: center;">
          <h1>Arcular Plus</h1>
          <h2>${subject}</h2>
        </div>
        <div style="padding: 20px;">
          <p>Dear ${userName},</p>
          <p>We're reviewing your ${userType} registration and noticed that some required documents are missing or need to be updated.</p>
          <p><strong>Missing or incomplete documents:</strong></p>
          <ul>
            ${missingDocuments.map(doc => `<li>${doc}</li>`).join('')}
          </ul>
          <p><strong>Please take the following steps:</strong></p>
          <ol>
            <li>Log in to your Arcular Plus account</li>
            <li>Go to your registration section</li>
            <li>Upload the missing documents</li>
            <li>Ensure all information is complete and accurate</li>
            <li>Resubmit your registration</li>
          </ol>
          <p><strong>Important:</strong> Your registration cannot be approved until all required documents are properly submitted.</p>
          <p>If you need assistance or have questions about document requirements, please contact our support team.</p>
          <p>Best regards,<br>Arcular Plus Team</p>
        </div>
      </div>
    `;
    
    sendInBackground('Document review email', async () => {
      const ok = await sendMailSmart({ to: userEmail, subject, html });
      if (!ok) throw new Error('provider failed');
    });
  } catch (error) {
    console.error('❌ Error sending document review notification:', error);
  }
};

// Send welcome email for approved users
const sendWelcomeEmail = async (userEmail, userName, userType) => {
  try {
    const subject = `Welcome to Arcular Plus, ${userName}!`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #4caf50 0%, #81c784 100%); color: white; padding: 20px; text-align: center;">
          <h1>Arcular Plus</h1>
          <h2>Welcome aboard! 🎉</h2>
        </div>
        <div style="padding: 20px;">
          <p>Dear ${userName},</p>
          <p>Welcome to Arcular Plus! We're excited to have you as part of our healthcare community.</p>
          <p>As a <strong>${userType}</strong>, you now have access to:</p>
          <ul>
            <li>Your personalized dashboard</li>
            <li>Advanced healthcare management tools</li>
            <li>Patient interaction capabilities</li>
            <li>Professional networking opportunities</li>
            <li>24/7 platform support</li>
          </ul>
          <p><strong>Getting Started:</strong></p>
          <ol>
            <li>Complete your profile setup</li>
            <li>Explore the dashboard features</li>
            <li>Review the platform guidelines</li>
            <li>Start connecting with the community</li>
          </ol>
          <p>If you have any questions or need assistance, our support team is here to help!</p>
          <p>Best regards,<br>Arcular Plus Team</p>
        </div>
      </div>
    `;
    
    sendInBackground('Welcome email', async () => {
      const ok = await sendMailSmart({ to: userEmail, subject, html });
      if (!ok) throw new Error('provider failed');
    });
  } catch (error) {
    console.error('❌ Error sending welcome email:', error);
  }
};

// Send test request email to lab
const sendTestRequestEmail = async (data) => {
  try {
    const { labEmail, labName, hospitalName, patientName, patientArcId, testName, testType, urgency, requestId, notes } = data;
    
    const subject = `New Test Request from ${hospitalName}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center;">
          <h1>Arcular Plus</h1>
          <h2>New Test Request</h2>
        </div>
        <div style="padding: 20px;">
          <p>Dear ${labName},</p>
          <p>You have received a new test request from <strong>${hospitalName}</strong>.</p>
          
          <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0;">Request Details:</h3>
            <p><strong>Request ID:</strong> ${requestId}</p>
            <p><strong>Patient:</strong> ${patientName} (${patientArcId})</p>
            <p><strong>Test:</strong> ${testName}</p>
            <p><strong>Type:</strong> ${testType}</p>
            <p><strong>Urgency:</strong> ${urgency}</p>
            ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
          </div>
          
          <p>Please log in to your Arcular Plus dashboard to review and respond to this request.</p>
          <p>Best regards,<br>Arcular Plus Team</p>
        </div>
      </div>
    `;
    
    sendInBackground('Test request email', async () => {
      const ok = await sendMailSmart({ to: labEmail, subject, html });
      if (!ok) throw new Error('provider failed');
    });
  } catch (error) {
    console.error('❌ Error sending test request email:', error);
  }
};

// Send test admission email to patient
const sendTestAdmissionEmail = async (data) => {
  try {
    const { patientEmail, patientName, labName, testName, requestId, labNotes } = data;
    
    const subject = `Test Request Admitted by ${labName}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center;">
          <h1>Arcular Plus</h1>
          <h2>Test Request Admitted</h2>
        </div>
        <div style="padding: 20px;">
          <p>Dear ${patientName},</p>
          <p>Great news! Your test request has been admitted by <strong>${labName}</strong>.</p>
          
          <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0;">Request Details:</h3>
            <p><strong>Request ID:</strong> ${requestId}</p>
            <p><strong>Test:</strong> ${testName}</p>
            <p><strong>Lab:</strong> ${labName}</p>
            ${labNotes ? `<p><strong>Lab Notes:</strong> ${labNotes}</p>` : ''}
          </div>
          
          <p>You will receive another email with your appointment schedule once it's confirmed.</p>
          <p>Best regards,<br>Arcular Plus Team</p>
        </div>
      </div>
    `;
    
    sendInBackground('Test admission email', async () => {
      const ok = await sendMailSmart({ to: patientEmail, subject, html });
      if (!ok) throw new Error('provider failed');
    });
  } catch (error) {
    console.error('❌ Error sending test admission email:', error);
  }
};

// Send appointment email to patient
const sendAppointmentEmail = async (data) => {
  try {
    const { patientEmail, patientName, labName, testName, scheduledDate, scheduledTime, appointmentSlot, preparationInstructions, requestId, billAmount, paymentOptions } = data;
    
    const subject = `Test Appointment Scheduled - ${testName}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center;">
          <h1>Arcular Plus</h1>
          <h2>Appointment Scheduled</h2>
        </div>
        <div style="padding: 20px;">
          <p>Dear ${patientName},</p>
          <p>Your test appointment has been scheduled at <strong>${labName}</strong>.</p>
          
          <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0;">Appointment Details:</h3>
            <p><strong>Request ID:</strong> ${requestId}</p>
            <p><strong>Test:</strong> ${testName}</p>
            <p><strong>Lab:</strong> ${labName}</p>
            <p><strong>Date:</strong> ${scheduledDate}</p>
            <p><strong>Time:</strong> ${scheduledTime}</p>
            ${appointmentSlot ? `<p><strong>Slot:</strong> ${appointmentSlot}</p>` : ''}
          </div>
          
          ${billAmount && billAmount > 0 ? `
          <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
            <h3 style="color: #155724; margin-top: 0;">💰 Billing Information:</h3>
            <p style="color: #155724; font-size: 18px; font-weight: bold; margin: 10px 0;">
              Amount to Pay: ₹${billAmount.toFixed(2)}
            </p>
            ${paymentOptions && paymentOptions.length > 0 ? `
            <p style="color: #155724; margin: 10px 0;"><strong>Payment Options Available:</strong></p>
            <ul style="color: #155724; margin: 10px 0; padding-left: 20px;">
              ${paymentOptions.map(option => `<li>${option}</li>`).join('')}
            </ul>
            ` : ''}
            <p style="color: #155724; font-size: 14px; margin: 10px 0;">
              Please bring the payment amount with you on the day of your appointment.
            </p>
          </div>
          ` : ''}
          
          ${preparationInstructions ? `
          <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #856404; margin-top: 0;">Preparation Instructions:</h3>
            <p style="color: #856404;">${preparationInstructions}</p>
          </div>
          ` : ''}
          
          <p>Please arrive 15 minutes before your scheduled time.</p>
          <p>Best regards,<br>Arcular Plus Team</p>
        </div>
      </div>
    `;
    
    sendInBackground('Appointment email', async () => {
      const ok = await sendMailSmart({ to: patientEmail, subject, html });
      if (!ok) throw new Error('provider failed');
    });
  } catch (error) {
    console.error('❌ Error sending appointment email:', error);
  }
};

// Send report ready email to patient
const sendReportReadyEmail = async (data) => {
  try {
    const { patientEmail, patientName, labName, testName, requestId, reportUrl } = data;
    
    const subject = `Test Report Ready - ${testName}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center;">
          <h1>Arcular Plus</h1>
          <h2>Test Report Ready</h2>
        </div>
        <div style="padding: 20px;">
          <p>Dear ${patientName},</p>
          <p>Your test report is now ready!</p>
          
          <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0;">Report Details:</h3>
            <p><strong>Request ID:</strong> ${requestId}</p>
            <p><strong>Test:</strong> ${testName}</p>
            <p><strong>Lab:</strong> ${labName}</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${reportUrl}" style="background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              View Report
            </a>
          </div>
          
          <p>You can also access your report through the Arcular Plus app.</p>
          <p>Best regards,<br>Arcular Plus Team</p>
        </div>
      </div>
    `;
    
    sendInBackground('Report ready email', async () => {
      const ok = await sendMailSmart({ to: patientEmail, subject, html });
      if (!ok) throw new Error('provider failed');
    });
  } catch (error) {
    console.error('❌ Error sending report ready email:', error);
  }
};

// Session activity email with inline brand logo (CID)
const sendSessionEmail = async ({ to, subject, action, device, ip, location, timestamp, brandCid = 'brandlogo', attachments = [] }) => {
  const dt = new Date(timestamp || Date.now());
  const pretty = dt.toLocaleString();
  const loc = location && location.lat && location.lng ? `${location.lat}, ${location.lng}` : 'Not available';
  const html = `
  <div style="background:#f7f8fa;padding:24px;font-family:Segoe UI,Roboto,Arial,sans-serif;color:#111">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden">
      <tr>
        <td style="background:linear-gradient(90deg,#7c3aed,#a78bfa);padding:16px 20px;color:#fff;display:flex;align-items:center">
          <img src="cid:${brandCid}" width="32" height="32" alt="Logo" style="display:inline-block;border-radius:6px;margin-right:10px"/>
          <div style="font-size:16px;font-weight:700">Arcular+ Account Activity</div>
        </td>
      </tr>
      <tr>
        <td style="padding:24px">
          <div style="font-size:18px;font-weight:700;margin-bottom:8px">${action === 'logout' ? 'Logout' : 'Login'} detected</div>
          <div style="font-size:14px;color:#374151;margin-bottom:16px">If this was you, no action is needed. If not, please review your account activity.</div>

          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:14px;color:#111">
            <tr><td style="padding:8px 0;width:140px;color:#6b7280">Date & Time</td><td>${pretty}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280">Action</td><td style="text-transform:capitalize">${action}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280">Device</td><td>${device || 'Unknown'}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280">IP</td><td>${ip || 'Unknown'}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280">Location</td><td>${loc}</td></tr>
          </table>

          <div style="margin-top:20px">
            <a href="#" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:10px 14px;border-radius:8px;font-weight:600">Review activity</a>
          </div>

          <div style="margin-top:18px;font-size:12px;color:#6b7280">If the button doesn’t work, please open the Arcular+ app and check your profile activity.</div>
        </td>
      </tr>
      <tr>
        <td style="background:#f3f4f6;height:1px"></td>
      </tr>
      <tr>
        <td style="padding:14px 20px;font-size:12px;color:#6b7280">© ${new Date().getFullYear()} Arcular+. All rights reserved.</td>
      </tr>
    </table>
  </div>`;

  const ok = await sendMailSmart({ to, subject: subject || 'Arcular+ Session Activity', html, attachments });
  if (!ok) throw new Error('All email providers failed');
};

// Send test completion email to patient
const sendTestCompletionEmailToPatient = async (data) => {
  try {
    const { patientEmail, patientName, labName, testName, requestId } = data;
    
    const subject = `Your Test Report is Ready - ${testName}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center;">
          <h1>Arcular Plus</h1>
          <h2>Test Report Ready</h2>
        </div>
        <div style="padding: 20px;">
          <p>Dear ${patientName},</p>
          <p>Great news! Your test report is ready and has been uploaded to your Arcular Plus report session.</p>
          
          <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0;">Test Details:</h3>
            <p><strong>Request ID:</strong> ${requestId}</p>
            <p><strong>Test:</strong> ${testName}</p>
            <p><strong>Lab:</strong> ${labName}</p>
            <p><strong>Status:</strong> Completed</p>
          </div>
          
          <p>You can now view your report by logging into your Arcular Plus account and checking your lab reports section.</p>
          <p>If you have any questions, please contact your healthcare provider.</p>
          <p>Best regards,<br>Arcular Plus Team</p>
        </div>
      </div>
    `;
    
    sendInBackground('Test completion email (patient)', async () => {
      const ok = await sendMailSmart({ to: patientEmail, subject, html });
      if (!ok) throw new Error('provider failed');
    });
  } catch (error) {
    console.error('❌ Error sending test completion email to patient:', error);
  }
};

// Send test completion email to hospital
const sendTestCompletionEmailToHospital = async (data) => {
  try {
    const { hospitalEmail, hospitalName, patientName, patientArcId, labName, testName, requestId } = data;
    
    const subject = `Test Completed - ${testName} for Patient ${patientArcId}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center;">
          <h1>Arcular Plus</h1>
          <h2>Test Completed</h2>
        </div>
        <div style="padding: 20px;">
          <p>Dear ${hospitalName},</p>
          <p>Your requested patient test has been completed and uploaded. Please search for the patient ARC ID to get the report.</p>
          
          <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0;">Test Details:</h3>
            <p><strong>Request ID:</strong> ${requestId}</p>
            <p><strong>Patient:</strong> ${patientName}</p>
            <p><strong>Patient ARC ID:</strong> ${patientArcId}</p>
            <p><strong>Test:</strong> ${testName}</p>
            <p><strong>Lab:</strong> ${labName}</p>
            <p><strong>Status:</strong> Completed</p>
          </div>
          
          <p>You can now access the test report by logging into your Arcular Plus dashboard and searching for the patient using their ARC ID: <strong>${patientArcId}</strong></p>
          <p>Best regards,<br>Arcular Plus Team</p>
        </div>
      </div>
    `;
    
    sendInBackground('Test completion email (hospital)', async () => {
      const ok = await sendMailSmart({ to: hospitalEmail, subject, html });
      if (!ok) throw new Error('provider failed');
    });
  } catch (error) {
    console.error('❌ Error sending test completion email to hospital:', error);
  }
};

module.exports = {
  sendRegistrationConfirmation,
  sendApprovalEmail,
  sendDocumentReviewNotification,
  sendWelcomeEmail,
  sendSessionEmail,
  sendTestRequestEmail,
  sendTestAdmissionEmail,
  sendAppointmentEmail,
  sendReportReadyEmail,
  sendTestCompletionEmailToPatient,
  sendTestCompletionEmailToHospital,
  // Helpers
  sendMailSmart,
  sendInBackground,
};
