require('dotenv').config();
const mongoose = require('mongoose');
const { Schema, model } = mongoose;

const solutionSchema = new Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    question: {
      type: String,
      required: true,
    },
    attachments: [
      {
        fileId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'uploads.files',
        },
        fileName: String,
        fileSize: Number,
        mimeType: String,
      },
    ],

    subject: String,
    urgency: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },

    status: {
      type: String,
      enum: ['pending', 'in-progress', 'completed', 'cancelled'],
      default: 'pending',
    },

    tutorResponses: [
      {
        tutorId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        response: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    solutionText: String,
    solutionFileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'uploads.files',
    },
    assignedAt: Date,
    completedAt: Date,
  },
  { timestamps: true }
);

const Solution = model('Solution', solutionSchema);
module.exports = Solution;
