require('dotenv').config();
const mongoose = require('mongoose');
const { Schema, model } = mongoose;

subcriptionSchema = new Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    plan: {
      type: String,
      enum: ['free', 'scholar-life', 'edu-pro'],
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'expired', 'cancelled'],
      default: 'active',
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
      required: true,
    },
    amount: {
      type: Number,
      required: function () {
        return this.plan !== 'free';
      },
    },
    paymentMethod: {
      type: String,
      enum: ['wallet', 'paystack', 'admin'],
      required: function () {
        return this.plan !== 'free';
      },
    },
    paystackReference: String,
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

const Subcription = model('Subcription', subcriptionSchema);
module.exports = Subcription;
