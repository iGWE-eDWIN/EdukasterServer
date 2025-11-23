const multer = require('multer');
const mongoose = require('mongoose');
const Solution = require('../models/solution');
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

// Create solution request (Student)
const createSolutionRequest = async (req, res) => {
  try {
    const id = req.user._id;
    const { title, question } = req.body;
    const files = req.files || [];

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Check subscription limits
    // if (user.subscriptionPlan === 'free') {
    //   return res.status(403).json({
    //     message:
    //       'Solution requests not available on free plan. Please upgrade to continue.',
    //   });
    // }

    // Handle monthly reset
    // const currentMonth = new Date().toISOString().slice(0, 7);
    // if (user.lastSolutionRequestMonth !== currentMonth) {
    //   user.monthlySolutionRequests = 0;
    //   user.lastSolutionRequestMonth = currentMonth;
    // }

    // const planLimits = {
    //   'scholar-life': 3,
    //   'edu-pro': 5,
    // };

    // const monthlyLimit = planLimits[user.subscriptionPlan];
    // if (user.monthlySolutionRequests >= monthlyLimit) {
    //   return res.status(403).json({
    //     message: `Monthly solution request limit reached (${monthlyLimit}). Upgrade for more requests.`,
    //     monthlyLimit,
    //     requestsUsed: user.monthlySolutionRequests,
    //   });
    // }

    // Auto-assign urgency
    // const urgencyByPlan = {
    //   'edu-pro': 'high',
    //   'scholar-life': 'medium',
    //   free: 'low',
    // };
    // const urgency = urgencyByPlan[user.subscriptionPlan] || 'medium';

    const gridfsBucket = getGridFSBucket();

    // ✅ Upload all files to GridFS
    const uploadedFiles = await Promise.all(
      files.map(async (file) => {
        try {
          let buffer = file.buffer;
          let mimetype = file.mimetype;
          let originalname = file.originalname;

          // Convert HEIC → JPEG
          if (
            mimetype === 'image/heic' ||
            mimetype === 'image/heif' ||
            originalname.toLowerCase().endsWith('.heic')
          ) {
            buffer = await convert({
              buffer,
              format: 'JPEG',
              quality: 0.9,
            });
            mimetype = 'image/jpeg';
            originalname = originalname.replace(/\.heic$/i, '.jpg');
          }

          return new Promise((resolve, reject) => {
            const uploadStream = gridfsBucket.openUploadStream(originalname, {
              metadata: {
                uploadedBy: id,
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

    // ✅ Save Solution Request
    const solutionRequest = new Solution({
      studentId: id,
      title,
      question,
      attachments: uploadedFiles,
      // urgency,
      status: 'pending',
    });

    await solutionRequest.save();

    // Increment monthly counter
    // user.monthlySolutionRequests += 1;
    await user.save();

    const populatedRequest = await Solution.findById(
      solutionRequest._id
    ).populate('studentId', 'name email institution course');

    // ✅ Add file URLs for your UI
    const requestWithUrls = {
      ...populatedRequest.toObject(),
      attachments: uploadedFiles.map((file) => ({
        ...file,
        url: `${req.protocol}://${req.get('host')}/solutions/file/${
          file.fileId
        }`,
      })),
    };

    res.status(201).json({
      message: 'Solution request created successfully',
      request: requestWithUrls,
    });
  } catch (error) {
    console.error('Error creating solution request:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get all solution requests (Tutor - available to pick up)
const getAllSolutionRequest = async (req, res) => {
  try {
    // Fetch all solution requests (Tutor)
    const requests = await Solution.find()
      .populate('studentId', 'name email institution course avatar')
      .sort({
        // urgency: -1, // High → Medium → Low
        createdAt: -1, // Newest first
      });

    // ✅ Add file URLs + student profile image
    const requestsWithUrls = requests.map((request) => {
      const reqObj = request.toObject();

      // Add file URLs for each attachment
      reqObj.attachments = reqObj.attachments.map((file) => ({
        ...file,
        url: `${req.protocol}://${req.get('host')}/solutions/file/${
          file.fileId
        }`,
      }));

      // Add student profile image URL (if exists)
      // ✅ Convert avatar buffer to base64
      if (reqObj.studentId?.avatar?.data) {
        reqObj.studentId.avatarUrl = `data:${
          reqObj.studentId.avatar.contentType
        };base64,${reqObj.studentId.avatar.data.toString('base64')}`;
      } else {
        // Default avatar fallback
        reqObj.studentId.avatarUrl =
          'https://ui-avatars.com/api/?name=User&background=random';
      }

      return reqObj;
    });
    // console.log(JSON.stringify(requestsWithUrls, null, 2));

    res.json({
      success: true,
      total: requestsWithUrls.length,
      requests: requestsWithUrls,
    });
  } catch (error) {
    console.error('Error fetching solution requests:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ Get a single solution request by ID
const getSolutionRequestById = async (req, res) => {
  try {
    const { id } = req.params;

    // ✅ Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid request ID' });
    }

    // ✅ Find the specific request
    const request = await Solution.findById(id)
      .populate('studentId', 'name email institution course ')
      .populate('tutorResponses.tutorId', 'name email avatar');
    if (!request) {
      return res
        .status(404)
        .json({ success: false, message: 'Request not found' });
    }

    if (!request) {
      return res
        .status(404)
        .json({ success: false, message: 'Request not found' });
    }

    // // ✅ Increment views
    // request.views = (request.views || 0) + 1;
    // await request.save();

    // ✅ Convert to plain object
    const reqObj = request.toObject();

    // ✅ Add file URLs
    // reqObj.attachments = reqObj.attachments.map((file) => ({
    //   ...file,
    //   url: `${req.protocol}://${req.get('host')}/solutions/file/${file.fileId}`,
    // }));
    // ✅ Format attachments using the solution.attachments field
    reqObj.attachments = reqObj.attachments.map((file) => ({
      fileName: file.fileName,
      url: `${req.protocol}://${req.get('host')}/solutions/file/${file.fileId}`, // use solution field
    }));

    // Format tutorResponses with avatar
    reqObj.tutorResponses = reqObj.tutorResponses.map((resp) => {
      const tutor = resp.tutorId;
      const tutorAvatar = tutor?.avatar?.data
        ? `data:${tutor.avatar.contentType};base64,${tutor.avatar.data.toString(
            'base64'
          )}`
        : `https://ui-avatars.com/api/?name=${encodeURIComponent(
            tutor?.name || 'Tutor'
          )}&background=random`;

      return {
        _id: resp._id,
        tutorId: tutor?._id,
        tutorName: tutor?.name || 'Tutor',
        tutorAvatar,
        response: resp.response,
        createdAt: resp.createdAt,
      };
    });
    // console.log(reqObj);

    res.status(200).json({ success: true, request: reqObj });
  } catch (error) {
    console.error('Error fetching solution request by ID:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Add a tutor response to a solution request
const addTutorResponse = async (req, res) => {
  try {
    const { solutionRequestId, response } = req.body;
    const tutorId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(solutionRequestId)) {
      return res.status(400).json({ message: 'Invalid solution request ID' });
    }

    const solution = await Solution.findById(solutionRequestId).populate(
      'tutorResponses.tutorId',
      'name email avatar'
    );
    if (!solution) {
      return res.status(404).json({ message: 'Solution request not found' });
    }

    const newResponse = {
      tutorId,
      response,
      createdAt: new Date(),
    };

    solution.tutorResponses.push(newResponse);

    await solution.save();

    // Get the latest tutor response with populated tutor info
    const latestResponse =
      solution.tutorResponses[solution.tutorResponses.length - 1];
    const tutor = await User.findById(latestResponse.tutorId);

    const tutorAvatar =
      tutor?.avatar && tutor.avatar.data
        ? `data:${tutor.avatar.contentType};base64,${tutor.avatar.data.toString(
            'base64'
          )}`
        : `https://ui-avatars.com/api/?name=${encodeURIComponent(
            tutor?.name || 'Tutor'
          )}&background=random`;

    res.status(200).json({
      success: true,
      message: 'Response added',
      tutorResponse: {
        _id: latestResponse._id,
        tutorId: latestResponse.tutorId,
        tutorName: tutor?.name || 'Tutor',
        tutorAvatar,
        response: latestResponse.response,
        createdAt: latestResponse.createdAt,
      },
    });
  } catch (error) {
    console.error('Error adding tutor response:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get all solution requests for the logged-in student
const getStudentSolutionRequests = async (req, res) => {
  try {
    const studentId = req.user._id;

    // Fetch all solutions for this student
    const requests = await Solution.find({ studentId })
      .populate('studentId', 'name email avatar')
      .populate('tutorResponses.tutorId', 'name avatar')
      .sort({ createdAt: -1 }); // newest first

    // Format requests
    const requestsWithUrls = requests.map((request) => {
      const reqObj = request.toObject();

      // Add file URLs
      reqObj.attachments = reqObj.attachments.map((file) => ({
        fileName: file.fileName,
        url: `${req.protocol}://${req.get('host')}/solutions/file/${
          file.fileId
        }`,
      }));

      // Format tutor responses with avatar
      reqObj.tutorResponses = reqObj.tutorResponses.map((resp) => ({
        _id: resp._id,
        response: resp.response,
        createdAt: resp.createdAt,
        tutorName: resp.tutorId?.name || 'Tutor',
        tutorAvatar: resp.tutorId?.avatar?.data
          ? `data:${
              resp.tutorId.avatar.contentType
            };base64,${resp.tutorId.avatar.data.toString('base64')}`
          : `https://ui-avatars.com/api/?name=${encodeURIComponent(
              resp.tutorId?.name || 'Tutor'
            )}&background=random`,
      }));

      // Student avatar
      reqObj.studentId.avatarUrl = reqObj.studentId?.avatar?.data
        ? `data:${
            reqObj.studentId.avatar.contentType
          };base64,${reqObj.studentId.avatar.data.toString('base64')}`
        : `https://ui-avatars.com/api/?name=${encodeURIComponent(
            reqObj.studentId?.name || 'User'
          )}&background=random`;

      return reqObj;
    });

    // console.log(requestsWithUrls);

    res.status(200).json({
      success: true,
      total: requestsWithUrls.length,
      requests: requestsWithUrls,
    });
  } catch (error) {
    console.error('Error fetching student solution requests:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getStudentSolutionById = async (req, res) => {
  try {
    const { id } = req.params;
    const studentId = req.user._id;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid solution request ID' });
    }

    // Find the solution request and ensure it belongs to the student
    const request = await Solution.findOne({ _id: id, studentId })
      .populate('studentId', 'name email avatar')
      .populate('tutorResponses.tutorId', 'name avatar');

    if (!request) {
      return res
        .status(404)
        .json({ success: false, message: 'Solution request not found' });
    }

    const reqObj = request.toObject();

    // Add file URLs
    reqObj.attachments = reqObj.attachments.map((file) => ({
      fileName: file.fileName,
      url: `${req.protocol}://${req.get('host')}/solutions/file/${file.fileId}`,
    }));

    // Tutor responses with avatar
    reqObj.tutorResponses = reqObj.tutorResponses.map((resp) => ({
      _id: resp._id,
      response: resp.response,
      createdAt: resp.createdAt,
      tutorName: resp.tutorId?.name || 'Tutor',
      tutorAvatar: resp.tutorId?.avatar?.data
        ? `data:${
            resp.tutorId.avatar.contentType
          };base64,${resp.tutorId.avatar.data.toString('base64')}`
        : `https://ui-avatars.com/api/?name=${encodeURIComponent(
            resp.tutorId?.name || 'Tutor'
          )}&background=random`,
    }));

    // Student avatar
    reqObj.studentId.avatarUrl = reqObj.studentId?.avatar?.data
      ? `data:${
          reqObj.studentId.avatar.contentType
        };base64,${reqObj.studentId.avatar.data.toString('base64')}`
      : `https://ui-avatars.com/api/?name=${encodeURIComponent(
          reqObj.studentId?.name || 'User'
        )}&background=random`;

    res.status(200).json({ success: true, request: reqObj });
  } catch (error) {
    console.error('Error fetching student solution by ID:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  upload,
  createSolutionRequest,
  getAllSolutionRequest,
  getSolutionRequestById,
  addTutorResponse,
  getStudentSolutionRequests,
  getStudentSolutionById,
};
