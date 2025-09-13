const express = require('express');
const { auth, authorize, requireApproval } = require('../middleware/auth');
const {
  upload,
  getAllQuestions,
  uploadQuestion,
  getUploads,
  approveQuestion,
  deletePastQuestion,
} = require('../controller/question');

const router = new express.Router();

// Upload past question route
router.post(
  '/upload',
  auth,
  authorize('student', 'tutor', 'admin'),
  requireApproval,
  upload.array('files', 10),
  uploadQuestion // allow up to 10 files
);

// Get all past questions (with search and filters) route
router.get('/all-questions', getAllQuestions);

// Get my uploads
router.get('my-uploads', auth, getUploads);

// Approve past question (Admin) route
router.patch('/:id/approve', auth, authorize('admin'), approveQuestion);

// Delete past question (Admin or uploader) route
router.delete('/:id/delete', auth, deletePastQuestion);
