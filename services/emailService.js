const nodemailer = require('nodemailer');

// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'shovinmicheldavid1285@gmail.com',
    pass: process.env.EMAIL_PASS || 'qybb pcvk fact dnly'
  }
});

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
    
    await transporter.sendMail({
      from: process.env.EMAIL_USER || 'your-email@gmail.com',
      to: userEmail,
      subject: subject,
      html: html
    });
    
    console.log(`✅ Registration confirmation email sent to ${userEmail}`);
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
    
    await transporter.sendMail({
      from: process.env.EMAIL_USER || 'your-email@gmail.com',
      to: userEmail,
      subject: subject,
      html: html
    });
    
    console.log(`✅ Approval email sent to ${userEmail} - Status: ${isApproved ? 'Approved' : 'Review Required'}`);
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
    
    await transporter.sendMail({
      from: process.env.EMAIL_USER || 'your-email@gmail.com',
      to: userEmail,
      subject: subject,
      html: html
    });
    
    console.log(`✅ Document review notification sent to ${userEmail}`);
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
    
    await transporter.sendMail({
      from: process.env.EMAIL_USER || 'your-email@gmail.com',
      to: userEmail,
      subject: subject,
      html: html
    });
    
    console.log(`✅ Welcome email sent to ${userEmail}`);
  } catch (error) {
    console.error('❌ Error sending welcome email:', error);
  }
};

module.exports = {
  sendRegistrationConfirmation,
  sendApprovalEmail,
  sendDocumentReviewNotification,
  sendWelcomeEmail,
  sendSessionEmail,
};

// Session activity email with inline brand logo (CID)
async function sendSessionEmail({ to, subject, action, device, ip, location, timestamp, brandCid = 'brandlogo', attachments = [] }) {
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

  await transporter.sendMail({
    from: process.env.EMAIL_USER || 'your-email@gmail.com',
    to,
    subject: subject || 'Arcular+ Session Activity',
    html,
    attachments,
  });
}
