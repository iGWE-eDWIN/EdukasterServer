const fetch = require('node-fetch');
const User = require('../models/user');

// send push notification to a user
const sendPushNotification = async ({ pushToken, title, message, image }) => {
  try {
    if (!pushToken) {
      console.warn('⚠️ Push notification skipped: no push token provided');
      return;
    }
    const payload = {
      to: pushToken,
      title,
      body: message,
      data: { image },
    };
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      console.error(
        '❌ Failed to send push notification:',
        await response.text()
      );
    }
  } catch (error) {
    console.error('❌ Error sending push notification:', error);
  }
};

module.exports = {
  sendPushNotification,
};
