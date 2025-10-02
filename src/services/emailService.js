const { Resend } = require('resend');
const logger = require('../utils/logger');

class EmailService {
  constructor() {
    this.resend = null;
    this.fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
    this.initializeResend();
  }

  // Initialize Resend client
  initializeResend() {
    if (!process.env.RESEND_API_KEY) {
      logger.warn('Resend API key not provided. Email service will be disabled.');
      return;
    }

    this.resend = new Resend(process.env.RESEND_API_KEY);
    logger.info('Resend email service initialized successfully');
  }

  // Send welcome email
  async sendWelcomeEmail(user) {
    if (!this.resend) {
      logger.warn('Email service not available - skipping welcome email');
      return { success: false, message: 'Email service not configured' };
    }

    try {
      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to: [user.email],
        subject: 'Welcome to Video Editing Platform!',
        html: this.getWelcomeEmailTemplate(user)
      });

      logger.info('Welcome email sent successfully:', { userId: user._id, email: user.email, emailId: result.data?.id });
      
      return { success: true, messageId: result.data?.id };
    } catch (error) {
      logger.error('Failed to send welcome email:', error);
      return { success: false, error: error.message };
    }
  }

  // Send password reset email
  async sendPasswordResetEmail(user, resetToken) {
    if (!this.resend) {
      logger.warn('Email service not available - skipping password reset email');
      return { success: false, message: 'Email service not configured' };
    }

    try {
      const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
      
      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to: [user.email],
        subject: 'Password Reset Request',
        html: this.getPasswordResetEmailTemplate(user, resetUrl)
      });

      logger.info('Password reset email sent successfully:', { userId: user._id, email: user.email, emailId: result.data?.id });
      
      return { success: true, messageId: result.data?.id };
    } catch (error) {
      logger.error('Failed to send password reset email:', error);
      return { success: false, error: error.message };
    }
  }

  // Send email verification
  async sendEmailVerification(user, verificationToken) {
    if (!this.resend) {
      logger.warn('Email service not available - skipping email verification');
      return { success: false, message: 'Email service not configured' };
    }

    try {
      const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
      
      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to: [user.email],
        subject: 'Verify Your Email Address',
        html: this.getEmailVerificationTemplate(user, verificationUrl)
      });

      logger.info('Email verification sent successfully:', { userId: user._id, email: user.email, emailId: result.data?.id });
      
      return { success: true, messageId: result.data?.id };
    } catch (error) {
      logger.error('Failed to send email verification:', error);
      return { success: false, error: error.message };
    }
  }

  // Send post published notification
  async sendPostPublishedNotification(user, post) {
    if (!this.resend) {
      return { success: false, message: 'Email service not configured' };
    }

    try {
      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to: [user.email],
        subject: 'Your Video Has Been Published!',
        html: this.getPostPublishedTemplate(user, post)
      });

      logger.info('Post published notification sent:', { userId: user._id, postId: post._id, emailId: result.data?.id });
      
      return { success: true, messageId: result.data?.id };
    } catch (error) {
      logger.error('Failed to send post notification:', error);
      return { success: false, error: error.message };
    }
  }

  // Welcome email template
  getWelcomeEmailTemplate(user) {
    return `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        <h2 style="color: #333;">Welcome to Video Editing Platform!</h2>
        <p>Hi ${user.name},</p>
        <p>Thank you for joining our video editing platform! We're excited to help you create and share amazing content.</p>
        
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>What you can do now:</h3>
          <ul>
            <li>Upload and edit your videos</li>
            <li>Connect your social media accounts</li>
            <li>Generate AI-powered captions</li>
            <li>Schedule posts across multiple platforms</li>
          </ul>
        </div>
        
        <p>If you have any questions, feel free to reach out to our support team.</p>
        <p>Happy creating!</p>
        <p>The Video Editing Platform Team</p>
      </div>
    `;
  }

  // Password reset email template
  getPasswordResetEmailTemplate(user, resetUrl) {
    return `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        <h2 style="color: #333;">Password Reset Request</h2>
        <p>Hi ${user.name},</p>
        <p>You requested a password reset for your account. Click the button below to reset your password:</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Reset Password
          </a>
        </div>
        
        <p>If you didn't request this reset, please ignore this email. The link will expire in 1 hour.</p>
        <p>For security reasons, please don't share this link with anyone.</p>
        
        <p>Best regards,<br>The Video Editing Platform Team</p>
      </div>
    `;
  }

  // Email verification template
  getEmailVerificationTemplate(user, verificationUrl) {
    return `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        <h2 style="color: #333;">Verify Your Email Address</h2>
        <p>Hi ${user.name},</p>
        <p>Please verify your email address by clicking the button below:</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" style="background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Verify Email
          </a>
        </div>
        
        <p>If you didn't create this account, please ignore this email.</p>
        
        <p>Best regards,<br>The Video Editing Platform Team</p>
      </div>
    `;
  }

  // Post published notification template
  getPostPublishedTemplate(user, post) {
    return `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        <h2 style="color: #333;">Your Video Has Been Published! 🎉</h2>
        <p>Hi ${user.name},</p>
        <p>Great news! Your video "${post.video?.title || 'Untitled'}" has been successfully published to your social media accounts.</p>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Publication Details:</h3>
          <p><strong>Caption:</strong> ${post.caption.substring(0, 100)}${post.caption.length > 100 ? '...' : ''}</p>
          <p><strong>Platforms:</strong> ${post.platforms.map(p => p.name).join(', ')}</p>
          <p><strong>Published:</strong> ${new Date(post.publishedAt).toLocaleDateString()}</p>
        </div>
        
        <p>You can track the performance of your post in your dashboard.</p>
        
        <p>Keep creating amazing content!</p>
        <p>The Video Editing Platform Team</p>
      </div>
    `;
  }
}

module.exports = new EmailService();