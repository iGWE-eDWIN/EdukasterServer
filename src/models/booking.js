require('dotenv').config();
const mongoose = require('mongoose');
const { Schema, model } = mongoose;

// bookingSchema = new Schema(
//   {
//     studentId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User',
//       required: true,
//     },
//     tutorId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User',
//       required: true,
//     },
//     sessionType: {
//       type: String,
//       enum: ['1on1', 'group'],
//       required: true,
//     },
//     subject: {
//       type: String,
//       required: true,
//     },
//     scheduledDate: {
//       type: Date,
//       required: true,
//     },
//     duration: {
//       type: Number, // in minutes
//       required: true,
//     },
//     amount: {
//       type: Number,
//       required: true,
//     },
//     status: {
//       type: String,
//       enum: ['pending', 'confirmed', 'completed', 'cancelled'],
//       default: 'pending',
//     },
//     paymentStatus: {
//       type: String,
//       enum: ['pending', 'paid', 'refunded'],
//       default: 'pending',
//     },
//     paystackReference: String,
//     paystackTransactionId: String,
//     adminConfirmed: {
//       type: Boolean,
//       default: false,
//     },
//     sessionNotes: String,
//     rating: {
//       type: Number,
//       min: 1,
//       max: 5,
//     },
//     review: String,
//     completedAt: Date,
//   },
//   {
//     timestamps: true,
//   }
// );

bookingSchema = new Schema(
  {
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
    sessionType: {
      type: String,
      enum: ['1on1', 'group'],
      required: true,
      default: '1on1',
    },
    courseTitle: { type: String, required: true }, // you said tutor booking is based on courseTitle
    scheduledDate: {
      type: Date,
      required: true,
    },
    duration: {
      type: Number, // minutes
      required: true,
      default: 60,
    },
    amount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'completed', 'cancelled'],
      default: 'pending',
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'refunded'],
      default: 'pending',
    },
    paystackReference: String,
    paystackTransactionId: String,
    adminConfirmed: {
      type: Boolean,
      default: false,
    },
    meetingLink: String,
    sessionNotes: String,
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    review: String,
    completedAt: Date,
  },
  { timestamps: true }
);

const Booking = model('Booking', bookingSchema);
module.exports = Booking;
