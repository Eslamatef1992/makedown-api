const nodemailer = require('nodemailer');
const env = require('./env');

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.mail.host,
      port: env.mail.port,
      secure: env.mail.secure,
      auth: env.mail.user ? { user: env.mail.user, pass: env.mail.password } : undefined,
    });
  }
  return transporter;
}

async function sendMail({ to, subject, html, text }) {
  if (!env.mail.host) {
    // No SMTP configured (e.g. local dev) — log instead of throwing so the
    // request flow (register/forgot-password) still completes.
    console.log(`[mailer] SMTP not configured. Would send to ${to}: ${subject}`);
    console.log(text || html);
    return;
  }
  await getTransporter().sendMail({ from: env.mail.from, to, subject, html, text });
}

function otpEmailTemplate({ name, code, purpose }) {
  const purposeCopy = {
    register: 'Verify your email to finish creating your Make Down account.',
    login: 'Use this code to sign in to Make Down.',
    reset_password: 'Use this code to reset your Make Down password.',
    change_email: 'Use this code to confirm your new email address.',
  };
  const subject = 'Your Make Down verification code';
  const text = `Hi ${name || ''},\n\n${purposeCopy[purpose] || ''}\n\nYour code: ${code}\n\nThis code expires shortly. If you didn't request this, you can ignore this email.\n\n— Make Down`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;">
      <h2 style="color:#DE317C;">Make Down</h2>
      <p>Hi ${name || ''},</p>
      <p>${purposeCopy[purpose] || ''}</p>
      <p style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#DE317C;">${code}</p>
      <p style="color:#666;font-size:13px;">This code expires shortly. If you didn't request this, you can ignore this email.</p>
    </div>`;
  return { subject, text, html };
}

module.exports = { sendMail, otpEmailTemplate };
