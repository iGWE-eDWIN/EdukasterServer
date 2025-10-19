// src/services/notificationService.js

/**
 * Simple Notification Service
 *
 * This handles basic notifications for now — like console logs or in-app notifications.
 * Later, you can expand it to send emails, SMS, or push messages.
 */

const User = require('../models/user'); // ✅ adjust the path if needed

const NotificationService = {
  async send({ userId, title, message }) {
    try {
      // Optional: Fetch the user to confirm they exist
      const user = await User.findById(userId);
      if (!user) {
        console.warn(`⚠️ Notification skipped: user ${userId} not found`);
        return;
      }

      // For now, just log to console (you can extend this later)
      console.log(`📢 Notification to ${user.name} (${user.email}):`);
      console.log(`   Title: ${title}`);
      console.log(`   Message: ${message}`);

      // If you had an actual notification model or email system:
      // await Notification.create({ userId, title, message });
    } catch (err) {
      console.error('❌ NotificationService.send error:', err.message);
    }
  },
};

module.exports = NotificationService;
