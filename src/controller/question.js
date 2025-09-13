const express = require('express');
const multer = require('multer');
const Question = require('../models/question');
const { getGridFSBucket } = require('../db/mongoose');

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per file
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/jpg',
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF and images are allowed.'));
    }
  },
});

// Upload past question (Student, Tutor, Admin)
const uploadQuestion = async (req, res) => {
  try {
    const { institution, courseTitle, courseCode, courseDetails } = req.body;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'At least one file is required' });
    }

    const gridfsBucket = getGridFSBucket();

    // Upload files to GridFS
    const uploadedFiles = await Promise.all(
      req.files.map(
        (file) =>
          new Promise((resolve, reject) => {
            const uploadStream = gridfsBucket.openUploadStream(
              file.originalname,
              {
                metadata: {
                  uploadedBy: req.user._id,
                  contentType: file.mimetype,
                },
              }
            );

            uploadStream.end(file.buffer);

            uploadStream.on('finish', () => {
              resolve({
                fileId: uploadStream.id,
                fileName: file.originalname,
                fileSize: file.size,
                mimeType: file.mimetype,
              });
            });

            uploadStream.on('error', reject);
          })
      )
    );

    // Save question in DB
    const question = new Question({
      institution,
      courseTitle,
      courseCode,
      courseDetails,
      images: uploadedFiles,
      uploadedBy: req.user._id,
      uploaderRole: req.user.role,
    });

    await question.save();

    const populatedQuestion = await Question.findById(question._id).populate(
      'uploadedBy',
      'name email'
    );

    res.status(201).json({
      message: 'Question uploaded successfully. Awaiting admin approval.',
      question: populatedQuestion,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all questions (with search and filters)
const getAllQuestions = async (req, res) => {
  try {
    const {
      search,
      institution,
      courseTitle,
      courseCode,
      page = 1,
      limit = 20,
      approved = 'true',
    } = req.query;

    const query = {};

    // Only show approved questions to non-admin users
    if (approved === 'true' && (!req.user || req.user.role !== 'admin')) {
      query.isApproved = true;
    }

    if (search) {
      query.$or = [
        { tags: { $in: [new RegExp(search, 'i')] } },
        { courseTitle: { $regex: search, $options: 'i' } },
        { courseCode: { $regex: search, $options: 'i' } },
      ];
    }

    if (institution) query.institution = institution;
    if (courseTitle) query.courseTitle = courseTitle;
    if (courseCode) query.courseCode = courseCode;

    const questions = await Question.find(query)
      .populate('uploadedBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Question.countDocuments(query);

    res.json({
      questions,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get my uploads
const getUploads = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;

    const query = { uploadedBy: req.user._id };
    if (status === 'approved') query.isApproved = true;
    if (status === 'pending') query.isApproved = false;

    const questions = await Question.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Question.countDocuments(query);

    res.json({
      questions,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Aprove past question (Admin)
const approveQuestion = async (req, res) => {
  try {
    const { id } = req.params;

    const question = await Question.findById(id);
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    question.isApproved = true;
    await question.save();

    const populatedQuestion = await Question.findById(question._id).populate(
      'uploadedBy',
      'name email'
    );

    res.json({
      message: 'Question approved successfully',
      question: populatedQuestion,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete past question (Admin or uploader)
const deletePastQuestion = async (req, res) => {
  try {
    const { id } = req.params;

    const question = await Question.findById(id);
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    // Check permissions
    if (
      req.user.role !== 'admin' &&
      question.uploadedBy.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // Delete file(s) from GridFS
    const gridfsBucket = getGridFSBucket();
    for (const img of question.images) {
      await gridfsBucket.delete(img.fileId);
    }

    // Delete question record
    await Question.findByIdAndDelete(id);

    res.json({ message: 'Question deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  upload,
  uploadQuestion,
  getAllQuestions,
  getUploads,
  approveQuestion,
  deletePastQuestion,
};
