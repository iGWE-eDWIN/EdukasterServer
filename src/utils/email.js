// utils/email.js
const nodemailer = require('nodemailer');
const path = require('path');

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

async function sendEmail(to, subject, html) {
  await transporter.sendMail({
    from: `"Edukaster" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
    encoding: 'utf-8',
    attachments: [
      {
        filename: 'logo.png',
        path: path.join(__dirname, 'logo.png'), // Put the uploaded image here
        cid: 'edukaster-logo', // Use this in the HTML <img src="cid:edukaster-logo" />
      },
    ],
  });
}

module.exports = { sendEmail };
