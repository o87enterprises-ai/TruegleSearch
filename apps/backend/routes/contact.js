const express = require('express');
const router = express.Router();
const emailService = require('../services/EmailService');
const logger = require('../utils/logger');

const INBOX = 'truegleai@proton.me';
const esc = (s) => String(s || '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));

/**
 * @route   POST /api/contact/advertise
 * @desc    Forward an advertiser inquiry to the Truegle inbox via Resend.
 * @access  Public
 */
router.post('/advertise', async (req, res) => {
  try {
    const { name, email, company, website, budget, message } = req.body || {};

    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'A valid email is required' });
    }

    const html = `
      <h2>New advertising inquiry</h2>
      <table style="font-family:Arial,sans-serif;font-size:14px">
        <tr><td><b>Name</b></td><td>${esc(name)}</td></tr>
        <tr><td><b>Email</b></td><td>${esc(email)}</td></tr>
        <tr><td><b>Company</b></td><td>${esc(company)}</td></tr>
        <tr><td><b>Website</b></td><td>${esc(website)}</td></tr>
        <tr><td><b>Budget</b></td><td>${esc(budget)}</td></tr>
      </table>
      <p style="font-family:Arial,sans-serif;font-size:14px;white-space:pre-wrap"><b>Message:</b><br>${esc(message)}</p>
    `;
    const text = `New advertising inquiry\nName: ${name}\nEmail: ${email}\nCompany: ${company}\nWebsite: ${website}\nBudget: ${budget}\n\n${message}`;

    await emailService.sendEmail({
      to: INBOX,
      subject: `Advertising inquiry — ${name}`,
      html,
      text,
      replyTo: email,
    });

    res.json({ success: true, message: 'Inquiry sent' });
  } catch (error) {
    logger.error('contact/advertise error:', error.message);
    // 502 signals the frontend to offer its mailto fallback.
    res.status(502).json({ error: 'Email service unavailable' });
  }
});

module.exports = router;
