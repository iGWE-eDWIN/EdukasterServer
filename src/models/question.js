require('dotenv').config();
const mongoose = require('mongoose');
const { Schema, model } = mongoose;

const questionSchema = new Schema(
  {
    // School/institution the question comes from
    institution: {
      type: String,
      required: true,
    },

    // Course details
    courseTitle: {
      type: String,
      required: true,
    },
    courseCode: {
      type: String,
      required: true,
    },
    courseDetails: {
      type: String, // e.g. description, outline, lecturer name
    },

    // File storage (GridFS or external service)
    fileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'uploads.files',
    },
    fileName: String,
    fileSize: Number,
    mimeType: String,

    // Store images array (past questions can have multiple images)
    images: [
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

    // Who uploaded it (student, tutor, or admin)
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    uploaderRole: {
      type: String,
      enum: ['student', 'tutor', 'admin'],
      required: true,
    },

    // Moderation
    isApproved: {
      type: Boolean,
      default: false,
    },

    // tags: [String],
  },
  {
    timestamps: true,
  }
);

// Indexes for search optimization
questionSchema.index({
  institution: 1,
  courseTitle: 1,
  courseCode: 1,
});

questionSchema.index({ title: 'text', tags: 'text' });

const Question = model('Question', questionSchema);

module.exports = Question;
