// utils/email.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'mail.edukaster.com',
  port: process.env.EMAIL_PORT || 465,
  secure: true, // use TLS false if port 587
  auth: {
    user: process.env.EMAIL_USER, // e.g. no-reply@edukaster.com
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

async function sendEmail(to, subject, text) {
  await transporter.sendMail({
    from: `"Edukaster" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text,
  });
}

module.exports = { sendEmail };
