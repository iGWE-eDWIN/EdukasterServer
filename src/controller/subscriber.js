const Subscriber = require('../models/subscriber');
const { sendEmail } = require('../utils/email');

const createSubscriber = async (req, res) => {
  try {
    const { email, phone } = req.body;

    if (!email || !phone) {
      return res.status(400).json({ message: 'Email and phone are required' });
    }

    // Check if subscriber already exists
    const existingSubscriber = await Subscriber.findOne({
      $or: [{ email }, { phone }],
    });
    if (existingSubscriber) {
      return res
        .status(400)
        .json({
          message: 'Subscriber with this email or phone already exists',
        });
    }

    // Create new subscriber
    const newSubscriber = new Subscriber({ email, phone });
    await newSubscriber.save();

    // Send confirmation email
    try {
      await sendEmail(
        email,
        'Subscription Confirmation',
        'Thank you for subscribing!'
      );
    } catch (emailError) {
      console.error('Error sending confirmation email:', emailError);
    }

    res
      .status(201)
      .json({
        message: 'Subscriber created successfully',
        subscriber: newSubscriber,
      });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

const getSubscribers = async (req, res) => {
  try {
    const subscribers = await Subscriber.find().sort({ createdAt: -1 });
    res.status(200).json(subscribers);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// send bulk email to all subscribers
const sendBulkEmail = async (req, res) => {
  try {
    const { subject, message } = req.body;

    if (!subject || !message) {
      return res
        .status(400)
        .json({ message: 'Subject and message are required' });
    }
    const subscribers = await Subscriber.find();

    const emailPromises = subscribers.map((subscriber) =>
      sendEmail(subscriber.email, subject, message)
    );
    await Promise.all(emailPromises);

    res.status(200).json({ message: 'Bulk email sent successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createSubscriber,
  getSubscribers,
  sendBulkEmail,
};
