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
            `<p>We regret to inform you that your ${userType} registration requires additional information.</p>
             <p><strong>Reason for review:</strong> ${reason}</p>
             <p><strong>What you need to do:</strong></p>
             <ol>
               <li>Review the feedback above</li>
               <li>Update your registration details</li>
               <li>Ensure all required documents are properly uploaded</li>
               <li>Resubmit your registration</li>
             </ol>
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
  sendWelcomeEmail
};
