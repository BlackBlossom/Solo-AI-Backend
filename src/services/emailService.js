const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

class EmailService {
  constructor() {
    this.transporter = null;
    this.fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'noreply@example.com';
    this.fromName = process.env.SMTP_FROM_NAME || 'Video Editing Platform';
    this.initializeTransporter();
  }

  // Initialize Nodemailer SMTP transporter for Gmail
  initializeTransporter() {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      logger.warn('SMTP credentials not provided. Email service will be disabled.');
      logger.warn('Please configure SMTP_HOST, SMTP_USER, and SMTP_PASS in your .env file');
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        },
        tls: {
          // Do not fail on invalid certs (for development)
          rejectUnauthorized: process.env.NODE_ENV === 'production'
        }
      });

      // Verify connection configuration
      this.transporter.verify((error, success) => {
        if (error) {
          logger.error('SMTP connection failed:', error.message);
          logger.error('Please check your Gmail SMTP credentials and app password');
        } else {
          logger.info('Gmail SMTP email service initialized successfully');
          logger.info(`Email service ready to send from: ${this.fromEmail}`);
        }
      });
    } catch (error) {
      logger.error('Failed to initialize email transporter:', error.message);
      this.transporter = null;
    }
  }

  // Send welcome email
  async sendWelcomeEmail(user) {
    if (!this.transporter) {
      logger.warn('Email service not available - skipping welcome email');
      return { success: false, message: 'Email service not configured' };
    }

    try {
      const result = await this.transporter.sendMail({
        from: `"${this.fromName}" <${this.fromEmail}>`,
        to: user.email,
        subject: 'Welcome to Video Editing Platform!',
        html: this.getWelcomeEmailTemplate(user)
      });

      logger.info('Welcome email sent successfully:', { userId: user._id, email: user.email, messageId: result.messageId });
      
      return { success: true, messageId: result.messageId };
    } catch (error) {
      logger.error('Failed to send welcome email:', error);
      return { success: false, error: error.message };
    }
  }

  // Send email verification
  async sendEmailVerification(user, verificationToken) {
    if (!this.transporter) {
      logger.warn('Email service not available - skipping email verification');
      return { success: false, message: 'Email service not configured' };
    }

    try {
      const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
      
      const result = await this.transporter.sendMail({
        from: `"${this.fromName}" <${this.fromEmail}>`,
        to: user.email,
        subject: 'Verify Your Email Address',
        html: this.getEmailVerificationTemplate(user, verificationUrl)
      });

      logger.info('Email verification sent successfully:', { userId: user._id, email: user.email, messageId: result.messageId });
      
      return { success: true, messageId: result.messageId };
    } catch (error) {
      logger.error('Failed to send email verification:', error);
      return { success: false, error: error.message };
    }
  }

  // Send post published notification
  async sendPostPublishedNotification(user, post) {
    if (!this.transporter) {
      return { success: false, message: 'Email service not configured' };
    }

    try {
      const result = await this.transporter.sendMail({
        from: `"${this.fromName}" <${this.fromEmail}>`,
        to: user.email,
        subject: 'Your Video Has Been Published!',
        html: this.getPostPublishedTemplate(user, post)
      });

      logger.info('Post published notification sent:', { userId: user._id, postId: post._id, messageId: result.messageId });
      
      return { success: true, messageId: result.messageId };
    } catch (error) {
      logger.error('Failed to send post notification:', error);
      return { success: false, error: error.message };
    }
  }

  // Send OTP email for email verification
  async sendEmailOtp(user, otp) {
    if (!this.transporter) {
      logger.warn('Email service not available - skipping OTP email');
      return { success: false, message: 'Email service not configured' };
    }

    try {
      const result = await this.transporter.sendMail({
        from: `"${this.fromName}" <${this.fromEmail}>`,
        to: user.email,
        subject: 'Verify Your Email - OTP Code',
        html: this.getEmailOtpTemplate(user, otp)
      });

      logger.info('Email OTP sent successfully:', { userId: user._id, email: user.email, messageId: result.messageId });
      
      return { success: true, messageId: result.messageId };
    } catch (error) {
      logger.error('Failed to send email OTP:', error);
      return { success: false, error: error.message };
    }
  }

  // Send password reset OTP
  async sendPasswordResetOtp(user, otp) {
    if (!this.transporter) {
      logger.warn('Email service not available - skipping password reset OTP');
      return { success: false, message: 'Email service not configured' };
    }

    try {
      const result = await this.transporter.sendMail({
        from: `"${this.fromName}" <${this.fromEmail}>`,
        to: user.email,
        subject: 'Password Reset OTP Code',
        html: this.getPasswordResetOtpTemplate(user, otp)
      });

      logger.info('Password reset OTP sent successfully:', { userId: user._id, email: user.email, messageId: result.messageId });
      
      return { success: true, messageId: result.messageId };
    } catch (error) {
      logger.error('Failed to send password reset OTP:', error);
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

  // Email OTP verification template
  getEmailOtpTemplate(user, otp) {
    return `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; background-color: #f9f9f9; padding: 20px;">
        <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h2 style="color: #333; text-align: center; margin-bottom: 10px;">Email Verification</h2>
          <p style="text-align: center; color: #666; margin-bottom: 30px;">Hi ${user.name},</p>
          
          <p style="color: #666;">Please use the following OTP code to verify your email address:</p>
          
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 8px; margin: 30px 0; text-align: center;">
            <p style="color: white; font-size: 14px; margin: 0 0 10px 0;">Your OTP Code</p>
            <h1 style="color: white; font-size: 42px; letter-spacing: 8px; margin: 0; font-weight: bold;">${otp}</h1>
          </div>
          
          <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; color: #856404;"><strong>⚠️ Important:</strong></p>
            <ul style="margin: 10px 0 0 0; color: #856404;">
              <li>This OTP is valid for <strong>10 minutes</strong></li>
              <li>Do not share this code with anyone</li>
              <li>If you didn't request this, please ignore this email</li>
            </ul>
          </div>
          
          <p style="color: #666; font-size: 14px; margin-top: 30px;">If you have any questions, feel free to contact our support team.</p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          
          <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
            This is an automated email. Please do not reply.<br>
            © ${new Date().getFullYear()} ${this.fromName}. All rights reserved.
          </p>
        </div>
      </div>
    `;
  }

  // Password reset OTP template
  getPasswordResetOtpTemplate(user, otp) {
    return `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; background-color: #f9f9f9; padding: 20px;">
        <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h2 style="color: #333; text-align: center; margin-bottom: 10px;">Password Reset Request</h2>
          <p style="text-align: center; color: #666; margin-bottom: 30px;">Hi ${user.name},</p>
          
          <p style="color: #666;">We received a request to reset your password. Please use the following OTP code to proceed:</p>
          
          <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 20px; border-radius: 8px; margin: 30px 0; text-align: center;">
            <p style="color: white; font-size: 14px; margin: 0 0 10px 0;">Your OTP Code</p>
            <h1 style="color: white; font-size: 42px; letter-spacing: 8px; margin: 0; font-weight: bold;">${otp}</h1>
          </div>
          
          <div style="background: #f8d7da; border-left: 4px solid #dc3545; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; color: #721c24;"><strong>🔒 Security Notice:</strong></p>
            <ul style="margin: 10px 0 0 0; color: #721c24;">
              <li>This OTP is valid for <strong>10 minutes</strong></li>
              <li>Never share this code with anyone</li>
              <li>If you didn't request this, please secure your account immediately</li>
            </ul>
          </div>
          
          <p style="color: #666; font-size: 14px;">After verifying the OTP, you'll be able to set a new password for your account.</p>
          
          <p style="color: #666; font-size: 14px; margin-top: 30px;">If you have any concerns about your account security, please contact our support team immediately.</p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          
          <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
            This is an automated email. Please do not reply.<br>
            © ${new Date().getFullYear()} ${this.fromName}. All rights reserved.
          </p>
        </div>
      </div>
    `;
  }
}

module.exports = new EmailService();