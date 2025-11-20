// models/Session.js
const mongoose = require('mongoose');
const { Schema, model } = mongoose;

const sessionSchema = new Schema(
  {
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      unique: true,
    },
    tutorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    scheduledDate: { type: Date, required: true },
    duration: { type: Number, default: 60 }, // minutes
    amount: { type: Number, required: true },
    tutorShare: { type: Number, required: true },
    adminShare: { type: Number, required: true },
    status: {
      type: String,
      enum: ['scheduled', 'completed', 'cancelled'],
      default: 'scheduled',
    },
    completedAt: Date,
    payoutReference: String, // optional: id from paystack or transfer service
    notes: String,
  },
  { timestamps: true }
);

module.exports = model('Session', sessionSchema);
