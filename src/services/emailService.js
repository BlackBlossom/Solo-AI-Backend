// Email service with support for both Resend and SMTP
const { Resend } = require('resend');
const nodemailer = require('nodemailer');
const logger = require('../utils/logger');
const configService = require('./configService');

class EmailService {
  constructor() {
    this.resend = null;
    this.smtpTransporter = null;
    this.provider = 'resend'; // Default provider
    this.fromEmail = 'noreply@soloai.com';
    this.fromName = 'Solo AI';
    this.initialized = false;
  }

  /**
   * Initialize email service based on settings
   * Automatically detects provider from database settings
   */
  async initialize() {
    try {
      const emailConfig = await configService.getEmailConfig();
      
      // Debug log for troubleshooting (can be commented out in production)
      // logger.info('Email config fetched:', { 
      //   provider: emailConfig?.provider,
      //   hasResendConfig: !!emailConfig?.resend,
      //   hasResendApiKey: !!emailConfig?.resend?.apiKey,
      //   hasSMTPConfig: !!emailConfig?.smtp
      // });
      
      this.provider = emailConfig.provider || 'resend';

      if (this.provider === 'smtp') {
        this.fromEmail = emailConfig.smtp?.fromEmail || 'noreply@soloai.com';
        this.fromName = emailConfig.smtp?.fromName || 'Solo AI';
        await this.initializeSMTP(emailConfig.smtp);
      } else {
        this.fromEmail = emailConfig.resend?.fromEmail || 'noreply@soloai.com';
        this.fromName = emailConfig.resend?.fromName || 'Solo AI';
        await this.initializeResend(emailConfig.resend);
      }

      // Mark as initialized even if no valid email provider configured
      // The service will gracefully handle email sending by checking provider availability
      this.initialized = true;
      
      if (this.resend || this.smtpTransporter) {
        logger.info(`Email service initialized with ${this.provider.toUpperCase()} provider (${this.fromEmail})`);
      } else {
        logger.warn('Email service initialized but no valid provider configured. Emails will not be sent.');
      }
    } catch (error) {
      logger.warn('Email service initialization encountered an issue:', error.message);
      logger.warn('Application will continue without email functionality.');
      this.initialized = true; // Mark as initialized to prevent repeated attempts
    }
  }

  /**
   * Initialize Resend email provider
   */
  async initializeResend(resendConfig) {
    // Debug log for troubleshooting (can be commented out in production)
    // logger.info('Resend config received:', { 
    //   hasConfig: !!resendConfig, 
    //   hasApiKey: !!resendConfig?.apiKey,
    //   apiKeyLength: resendConfig?.apiKey?.length || 0,
    //   apiKeyPrefix: resendConfig?.apiKey?.substring(0, 6) || 'none'
    // });

    if (!resendConfig?.apiKey) {
      logger.warn('Resend API key not provided. Email service will be disabled.');
      this.resend = null;
      return; // Return gracefully without throwing
    }

    try {
      this.resend = new Resend(resendConfig.apiKey);
      logger.info('Resend email provider initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Resend:', error.message);
      // Detailed error logging (can be commented out in production)
      // logger.error('Resend error details:', {
      //   message: error.message,
      //   stack: error.stack,
      //   name: error.name
      // });
      this.resend = null;
      // Don't throw - allow service to continue without email
    }
  }

  /**
   * Initialize SMTP email provider
   */
  async initializeSMTP(smtpConfig) {
    if (!smtpConfig?.host || !smtpConfig?.user || !smtpConfig?.pass) {
      logger.warn('SMTP configuration incomplete. Email service will be disabled.');
      this.smtpTransporter = null;
      return; // Return gracefully without throwing
    }

    try {
      this.smtpTransporter = nodemailer.createTransport({
        host: smtpConfig.host,
        port: smtpConfig.port || 587,
        secure: smtpConfig.secure || false,
        auth: {
          user: smtpConfig.user,
          pass: smtpConfig.pass
        }
      });

      // Verify connection
      await this.smtpTransporter.verify();
      logger.info('SMTP email provider initialized and verified successfully');
    } catch (error) {
      logger.error('Failed to initialize SMTP:', error.message);
      this.smtpTransporter = null;
      // Don't throw - allow service to continue without email
    }
  }

  /**
   * Reinitialize email service (call after settings update)
   */
  async reinitialize() {
    logger.info('Reinitializing email service with updated settings...');
    this.initialized = false;
    this.resend = null;
    this.smtpTransporter = null;
    await this.initialize();
  }

  /**
   * Send email using configured provider
   */
  async sendEmail(to, subject, html) {
    // Ensure service is initialized
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.initialized) {
      logger.warn('Email service not available - skipping email');
      return { success: false, message: 'Email service not configured' };
    }

    try {
      if (this.provider === 'smtp' && this.smtpTransporter) {
        return await this.sendViaSMTP(to, subject, html);
      } else if (this.provider === 'resend' && this.resend) {
        return await this.sendViaResend(to, subject, html);
      } else {
        logger.error(`No valid email provider configured. Provider: ${this.provider}`);
        return { success: false, message: 'No email provider configured' };
      }
    } catch (error) {
      logger.error('Failed to send email:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send email via Resend
   */
  async sendViaResend(to, subject, html) {
    const result = await this.resend.emails.send({
      from: `${this.fromName} <${this.fromEmail}>`,
      to,
      subject,
      html
    });

    logger.info('Email sent via Resend:', { to, subject, id: result.id });
    return { success: true, id: result.id, provider: 'resend' };
  }

  /**
   * Send email via SMTP
   */
  async sendViaSMTP(to, subject, html) {
    const result = await this.smtpTransporter.sendMail({
      from: `${this.fromName} <${this.fromEmail}>`,
      to,
      subject,
      html
    });

    logger.info('Email sent via SMTP:', { to, subject, messageId: result.messageId });
    return { success: true, messageId: result.messageId, provider: 'smtp' };
  }

  // Send welcome email
  async sendWelcomeEmail(user) {
    return await this.sendEmail(
      user.email,
      'Welcome to Video Editing Platform!',
      this.getWelcomeEmailTemplate(user)
    );
  }

  // Send email verification
  async sendEmailVerification(user, verificationToken) {
    const urls = await configService.getUrls();
    const verificationUrl = `${urls.frontendUrl || process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
    
    return await this.sendEmail(
      user.email,
      'Verify Your Email Address',
      this.getEmailVerificationTemplate(user, verificationUrl)
    );
  }

  // Send post published notification
  async sendPostPublishedNotification(user, post) {
    return await this.sendEmail(
      user.email,
      'Your Video Has Been Published!',
      this.getPostPublishedTemplate(user, post)
    );
  }

  // Send OTP email for email verification
  async sendEmailOtp(user, otp) {
    return await this.sendEmail(
      user.email,
      'Verify Your Email - OTP Code',
      this.getEmailOtpTemplate(user, otp)
    );
  }

  // Send password reset OTP
  async sendPasswordResetOtp(user, otp) {
    return await this.sendEmail(
      user.email,
      'Password Reset OTP Code',
      this.getPasswordResetOtpTemplate(user, otp)
    );
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