require('dotenv').config();
const mongoose = require('mongoose');
const { Schema, model } = mongoose;

solutionSchema = new Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    questionText: String,
    questionImageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'uploads.files',
    },
    questionFileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'uploads.files',
    },
    subject: {
      type: String,
      required: true,
    },
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
    tutorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    solutionText: String,
    solutionFileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'uploads.files',
    },
    assignedAt: Date,
    completedAt: Date,
  },
  {
    timestamps: true,
  }
);

const Solution = model('Solution', solutionSchema);
