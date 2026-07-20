/**
 * Email Service - Transactional Email via Resend
 *
 * Use for:
 * - Password resets
 * - Account verification
 * - Notifications
 * - Alerts
 */
const axios = require('axios');
const config = require('../config/env');

class EmailService {
  constructor() {
    // Defensive: never throw at construction (this is a startup-loaded singleton).
    this.apiKey = config.email?.resend?.apiKey;
    this.baseUrl = 'https://api.resend.com';
    this.fromEmail = config.email?.resend?.fromEmail || 'onboarding@resend.dev';
  }

  /**
   * Send an email
   */
  async sendEmail(options) {
    if (!this.apiKey) {
      throw new Error('Resend API key not configured');
    }

    const { to, subject, html, text, from = this.fromEmail, replyTo = null } = options;

    if (!to || !subject || (!html && !text)) {
      throw new Error('Missing required email parameters (to, subject, html/text)');
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/emails`,
        {
          from,
          to: Array.isArray(to) ? to : [to],
          subject,
          html,
          text,
          reply_to: replyTo,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );

      return {
        success: true,
        id: response.data.id,
        message: 'Email sent successfully',
      };
    } catch (error) {
      console.error('Resend email error:', error.response?.data || error.message);

      if (error.response?.status === 401) {
        throw new Error('Invalid Resend API key');
      }
      if (error.response?.status === 429) {
        throw new Error('Email rate limit exceeded');
      }

      throw new Error(`Email service failed: ${error.message}`);
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordReset(email, resetToken, resetUrl) {
    const subject = 'Reset Your Truegle Password';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .button {
            display: inline-block;
            padding: 12px 24px;
            background-color: #0066cc;
            color: white;
            text-decoration: none;
            border-radius: 4px;
            margin: 20px 0;
          }
          .footer { margin-top: 30px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Reset Your Password</h2>
          <p>You requested to reset your password for your Truegle account.</p>
          <p>Click the button below to reset your password:</p>
          <a href="${resetUrl}?token=${resetToken}" class="button">Reset Password</a>
          <p>Or copy and paste this link into your browser:</p>
          <p><a href="${resetUrl}?token=${resetToken}">${resetUrl}?token=${resetToken}</a></p>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request this, please ignore this email.</p>
          <div class="footer">
            <p>Truegle - Unbiased Search Engine</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({ to: email, subject, html });
  }

  /**
   * Send account verification email
   */
  async sendVerificationEmail(email, verificationToken, verificationUrl) {
    const subject = 'Verify Your Truegle Account';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .button {
            display: inline-block;
            padding: 12px 24px;
            background-color: #00cc66;
            color: white;
            text-decoration: none;
            border-radius: 4px;
            margin: 20px 0;
          }
          .footer { margin-top: 30px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Welcome to Truegle!</h2>
          <p>Thanks for signing up. Please verify your email address to get started.</p>
          <a href="${verificationUrl}?token=${verificationToken}" class="button">Verify Email</a>
          <p>Or copy and paste this link into your browser:</p>
          <p><a href="${verificationUrl}?token=${verificationToken}">${verificationUrl}?token=${verificationToken}</a></p>
          <div class="footer">
            <p>Truegle - Unbiased Search Engine</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({ to: email, subject, html });
  }

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(email, userName) {
    const subject = 'Welcome to Truegle!';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .footer { margin-top: 30px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Welcome to Truegle, ${userName}!</h2>
          <p>Your account has been successfully created.</p>
          <p>Truegle is committed to delivering unbiased, multi-perspective search results.</p>
          <p>Features you now have access to:</p>
          <ul>
            <li>Multi-perspective search results</li>
            <li>Bias detection and labeling</li>
            <li>Custom search filters</li>
            <li>Search history</li>
          </ul>
          <p>Happy searching!</p>
          <div class="footer">
            <p>Truegle - Radical Transparency in Search</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({ to: email, subject, html });
  }

  /**
   * Send a passwordless sign-in code
   */
  async sendLoginCode(email, code) {
    const subject = `Your Truegle sign-in code: ${code}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .code {
            font-size: 32px;
            font-weight: bold;
            letter-spacing: 8px;
            padding: 16px 24px;
            background-color: #f5f5f5;
            border-radius: 8px;
            display: inline-block;
            margin: 20px 0;
          }
          .footer { margin-top: 30px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Your sign-in code</h2>
          <p>Enter this code to sign in to Truegle:</p>
          <div class="code">${code}</div>
          <p>This code expires in 15 minutes. If you didn't request this, you can safely ignore this email.</p>
          <div class="footer">
            <p>Truegle - Unbiased Search Engine</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject,
      html,
      text: `Your Truegle sign-in code is ${code}. It expires in 15 minutes.`,
    });
  }

  /**
   * Send notification email
   */
  async sendNotification(email, title, message) {
    const subject = `Truegle Notification: ${title}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .message {
            background-color: #f5f5f5;
            padding: 15px;
            border-radius: 4px;
            margin: 20px 0;
          }
          .footer { margin-top: 30px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>${title}</h2>
          <div class="message">
            ${message}
          </div>
          <div class="footer">
            <p>Truegle - Unbiased Search Engine</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({ to: email, subject, html });
  }

  /**
   * Get email send history (if needed)
   */
  async getEmailHistory(limit = 10) {
    if (!this.apiKey) {
      throw new Error('Resend API key not configured');
    }

    try {
      const response = await axios.get(`${this.baseUrl}/emails`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        params: { limit },
        timeout: 5000,
      });

      return response.data.data || [];
    } catch (error) {
      console.error('Resend email history error:', error.message);
      return [];
    }
  }

  /**
   * Check service health
   */
  async healthCheck() {
    try {
      const response = await axios.get(`${this.baseUrl}/api-keys`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
        timeout: 5000,
      });
      return { healthy: true, keys: response.data.data?.length || 0 };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }
}

module.exports = new EmailService();
