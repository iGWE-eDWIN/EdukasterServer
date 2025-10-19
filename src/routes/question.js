const express = require('express');
const { auth, authorize, requireApproval } = require('../middleware/auth');
const {
  upload,
  getAllQuestions,
  uploadQuestion,
  getUploads,
  approveQuestion,
  deletePastQuestion,
  getQuestionById,
} = require('../controller/question');
const { getGridFSBucket } = require('../db/mongoose');
const mongoose = require('mongoose');

const router = new express.Router();

// Upload past question route
router.post(
  '/questions/upload',
  auth,
  authorize('student', 'tutor', 'admin'),
  requireApproval,
  upload.array('files', 10),
  uploadQuestion // allow up to 10 files
);

// Get all past questions (with search and filters) route
router.get('/questions/all-questions', auth, getAllQuestions);

// Stream file from GridFS
router.get('/questions/file/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const gridfsBucket = getGridFSBucket();
    // ✅ Set headers BEFORE any response
    res.set({
      'Access-Control-Allow-Origin': '*',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'Cache-Control': 'public, max-age=31536000',
    });

    // Convert string to ObjectId
    const objectId = new mongoose.Types.ObjectId(fileId);

    // Find the file
    const files = await gridfsBucket.find({ _id: objectId }).toArray();

    if (!files || files.length === 0) {
      return res.status(404).json({ message: 'File not found' });
    }

    const file = files[0];

    // Set proper content type
    res.set(
      'Content-Type',
      file.metadata?.contentType || 'application/octet-stream'
    );
    res.set('Content-Length', file.length);

    // Stream the file
    const downloadStream = gridfsBucket.openDownloadStream(objectId);
    downloadStream.pipe(res);

    downloadStream.on('error', (error) => {
      res.status(500).json({ message: error.message });
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get a single question by ID (for detail view)
router.get('/questions/:id', auth, getQuestionById);

// Get my uploads
router.get('/questions/my-uploads', auth, getUploads);

// Approve past question (Admin) route
router.patch(
  '/questions/:id/approve',
  auth,
  authorize('admin'),
  approveQuestion
);

// Delete past question (Admin or uploader) route
router.delete('/questions/:id/delete', auth, deletePastQuestion);

module.exports = router;
