require('dotenv').config();
const mongoose = require('mongoose');
const { Schema, model } = mongoose;

NewsSubscriberSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

// prevent duplicate email or phone if user already subscribed
NewsSubscriberSchema.index({ email: 1 }, { unique: true });
NewsSubscriberSchema.index({ phone: 1 }, { unique: true });

const Subscriber = model('Subscriber', NewsSubscriberSchema);

module.exports = Subscriber;
