const multer = require('multer');
const Question = require('../models/question');
const User = require('../models/user');
const { getGridFSBucket } = require('../db/mongoose');
const convert = require('heic-convert');

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
      'image/heic', // iPhone photos
      'image/heif', // iPhone photos
      'image/webp', // Modern format
      'video/mp4',
      'video/quicktime',
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Invalid file type: ${file.mimetype}. Only PDF, images, and videos are allowed.`
        )
      );
    }
  },
});

// Upload past question (Student, Tutor, Admin)
const uploadQuestion = async (req, res) => {
  try {
    const { institution, courseTitle, courseCode, courseDetails } = req.body;
    // console.log(req.body);

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'At least one file is required' });
    }

    const gridfsBucket = getGridFSBucket();

    // Upload files to GridFS
    const uploadedFiles = await Promise.all(
      req.files.map(async (file) => {
        try {
          let buffer = file.buffer;
          let mimetype = file.mimetype;
          let originalname = file.originalname;
          // ✅ Convert HEIC → JPEG
          if (
            mimetype === 'image/heic' ||
            mimetype === 'image/heif' ||
            originalname.toLowerCase().endsWith('.heic')
          ) {
            buffer = await convert({
              buffer: file.buffer,
              format: 'JPEG',
              quality: 0.9,
            });
            mimetype = 'image/jpeg';
            originalname = originalname.replace(/\.heic$/i, '.jpg');
          }

          // Upload to GridFS
          return new Promise((resolve, reject) => {
            const uploadStream = gridfsBucket.openUploadStream(originalname, {
              metadata: {
                uploadedBy: req.user._id,
                contentType: mimetype,
              },
            });

            uploadStream.end(buffer);

            uploadStream.on('finish', () => {
              resolve({
                fileId: uploadStream.id,
                fileName: originalname,
                fileSize: file.size,
                mimetype,
              });
            });

            uploadStream.on('error', reject);
          });
        } catch (error) {
          throw new Error(`File processing error: ${error.message}`);
        }
      })
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

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;

    const query = {};

    // Only show approved questions to non-admin users
    if (approved === 'true' && (!req.user || req.user.role !== 'admin')) {
      query.isApproved = true;
    }

    // Free student daily question view limiter
    if (req.user?.role === 'student') {
      const user = await User.findById(req.user._id);
      if (user?.subscriptionPlan === 'free') {
        const today = new Date().toDateString();
        const lastViewDate = user.lastQuestionViewDate?.toDateString() || null;

        if (lastViewDate !== today) {
          user.dailyQuestionViews = 0;
          user.lastQuestionViewDate = new Date();
          await user.save();
        }

        if (user.dailyQuestionViews >= 7) {
          query.uploadedBy = user._id;
        }
      }
    }

    // Search and filter logic
    if (search) {
      query.$or = [
        { institution: { $regex: search, $options: 'i' } },
        { courseTitle: { $regex: search, $options: 'i' } },
        { courseCode: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } },
      ];
    }

    if (institution && !search) query.institution = institution;
    if (courseTitle && !search) query.courseTitle = courseTitle;
    if (courseCode && !search) query.courseCode = courseCode;

    const questions = await Question.find(query)
      .populate('uploadedBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum);

    const total = await Question.countDocuments(query);

    const questionsWithUrls = questions.map((question) => {
      const questionObj = question.toObject();
      questionObj.images = (questionObj.images || []).map((img) => ({
        ...img,
        url: `${req.protocol}://${req.get('host')}/questions/file/${
          img.fileId
        }`,
      }));
      return {
        ...questionObj,
        updatedAt: questionObj.updatedAt || questionObj.createdAt,
      };
    });

    res.json({
      questions: questionsWithUrls,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      total,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

const getQuestionById = async (req, res) => {
  try {
    const { id } = req.params;
    const question = await Question.findById(id).populate(
      'uploadedBy',
      'name email'
    );

    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    // Count view only for student users
    if (req.user && req.user.role === 'student') {
      const user = await User.findById(req.user._id);

      // Free plan check
      if (user.subscriptionPlan === 'free') {
        const today = new Date().toDateString();
        const lastViewDate = user.lastQuestionViewDate
          ? user.lastQuestionViewDate.toDateString()
          : null;

        // Reset daily counter if new day
        if (lastViewDate !== today) {
          user.dailyQuestionViews = 0;
          user.lastQuestionViewDate = new Date();
          await user.save();
        }

        // If not their own upload, increment view
        if (String(question.uploadedBy._id) !== String(user._id)) {
          if (user.dailyQuestionViews >= 7) {
            return res.status(403).json({
              message:
                'Daily question view limit reached. Upgrade to continue viewing.',
              dailyLimit: 7,
              viewsToday: user.dailyQuestionViews,
            });
          }

          user.dailyQuestionViews += 1;
          await user.save();
        }
      }
    }

    // Add file URLs
    const questionObj = question.toObject();
    questionObj.images = questionObj.images.map((img) => ({
      ...img,
      url: `${req.protocol}://${req.get('host')}/questions/file/${img.fileId}`,
    }));

    res.json(questionObj);
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
  getQuestionById,
  getUploads,
  approveQuestion,
  deletePastQuestion,
};
