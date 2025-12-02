const Promotion = require('../models/promotion');
const User = require('../models/user');
const NotificationService = require('../services/notificationService');
const { sendPushNotification } = require('../services/pushService');

// Create a new promotion
const createPromotion = async (req, res) => {
  try {
    const { title, message, type } = req.body;
    const mediaUrl = req.file ? req.file.path : null;
    const promotion = new Promotion({ title, message, mediaUrl, type });
    await promotion.save();
    // Notify all users about the new promotion
    const users = await User.find({ pushToken: { $ne: null } });
    for (const user of users) {
      await sendPushNotification(user.pushToken, title, message, {
        image: mediaUrl,
      });
    }
    res
      .status(201)
      .json({ message: 'Promotion created successfully', promotion });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create promotion' });
  }
};
// Get all promotions
const getPromotions = async (req, res) => {
  try {
    const promotions = await Promotion.find().sort({ createdAt: -1 });
    res.status(200).json(promotions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch promotions' });
  }
};

module.exports = {
  createPromotion,
  getPromotions,
};
