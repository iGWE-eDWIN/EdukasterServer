require('dotenv').config();
const mongoose = require('mongoose');
const { Schema, model } = mongoose;

paymentSchema = new Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    tutorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    platformCommission: {
      type: Number,
      required: true,
    },
    tutorAmount: {
      type: Number,
      required: true,
    },
    paystackReference: {
      type: String,
      required: true,
      unique: true,
    },
    paystackTransactionId: String,
    status: {
      type: String,
      enum: ['pending', 'successful', 'failed', 'refunded'],
      default: 'pending',
    },
    adminConfirmed: {
      type: Boolean,
      default: false,
    },
    tutorPaid: {
      type: Boolean,
      default: false,
    },
    paidToTutorAt: Date,
    metadata: {
      type: Object,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

const Payment = model('Payment', paymentSchema);

module.exports = Payment;
