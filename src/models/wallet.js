require('dotenv').config();
const mongoose = require('mongoose');
const { Schema, model } = mongoose;

walletSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: ['credit', 'debit'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      enum: [
        'funding',
        'booking',
        'subscription',
        'admin_credit',
        'refund',
        'payout', // 👈 ADD THIS
      ],
      required: true,
    },

    balanceBefore: {
      type: Number,
      required: true,
    },
    balanceAfter: {
      type: Number,
      required: true,
    },
    reference: String,
    paystackReference: String,
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    metadata: {
      type: Object,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

const Wallet = model('Wallet', walletSchema);
module.exports = Wallet;
