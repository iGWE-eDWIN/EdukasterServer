const express = require('express');
const { getGridFSBucket } = require('../db/mongoose');
const { auth, authorize, requireApproval } = require('../middleware/auth');
const {
  upload,
  createSolutionRequest,
  getAllSolutionRequest,
  getSolutionRequestById,
  addTutorResponse,
  getStudentSolutionRequests,
  getStudentSolutionById,
} = require('../controller/solution');

const router = new express.Router();

// Create solution request (Student)
router.post(
  '/solution/request',
  auth,
  authorize('student'),
  upload.array('files', 5),
  createSolutionRequest
);

// router.get('/solutions/file/:fileId', async (req, res) => {
//   try {
//     const { fileId } = req.params;
//     const gridfsBucket = getGridFSBucket();
//     // ✅ Set headers BEFORE any response
//     res.set({
//       'Access-Control-Allow-Origin': '*',
//       'Cross-Origin-Resource-Policy': 'cross-origin',
//       'Cache-Control': 'public, max-age=31536000',
//     });

//     // Convert string to ObjectId
//     const objectId = new mongoose.Types.ObjectId(fileId);

//     // Find the file
//     const files = await gridfsBucket.find({ _id: objectId }).toArray();
//     if (!files || files.length === 0) {
//       return res.status(404).json({ message: 'File not found' });
//     }

//     const file = files[0];
//     // Set proper content type
//     res.set(
//       'Content-Type',
//       file.metadata?.contentType || 'application/octet-stream'
//     );
//     res.set('Content-Length', file.length);

//     const downloadStream = gridfsBucket.openDownloadStream(objectId);
//     downloadStream.pipe(res);

//     downloadStream.on('error', (error) => {
//       res.status(500).json({ message: error.message });
//     });
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// });

router.get('/solutions/file/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const mongoose = require('mongoose'); // make sure this is imported
    const gridfsBucket = getGridFSBucket();

    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      return res.status(400).json({ message: 'Invalid file ID' });
    }

    const objectId = new mongoose.Types.ObjectId(fileId);
    const files = await gridfsBucket.find({ _id: objectId }).toArray();

    if (!files || files.length === 0) {
      return res.status(404).json({ message: 'File not found' });
    }

    const file = files[0];
    res.set('Content-Type', file.metadata?.contentType || 'image/jpeg');
    res.set('Content-Length', file.length);

    const downloadStream = gridfsBucket.openDownloadStream(objectId);
    downloadStream.pipe(res);

    downloadStream.on('error', (error) => {
      console.error('GridFS download error:', error);
      res.status(500).json({ message: 'Error streaming file' });
    });
  } catch (error) {
    console.error('Error in /solutions/file/:fileId:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get all solution requests (Tutor - available to pick up)
router.get(
  '/solutions/available',
  auth,
  authorize('tutor'),
  getAllSolutionRequest
);

// ✅ Get single solution request by ID
router.get('/solution/:id', auth, authorize('tutor'), getSolutionRequestById);

// Tutor adds a response
router.post('/solution/response', auth, authorize('tutor'), addTutorResponse);

// Get all solution requests for the logged-in student
router.get('/solution/student/requests', auth, getStudentSolutionRequests);

// ✅ Get single student solution request by ID
router.get(
  '/solution/student/:id',
  auth,
  authorize('student'),
  getStudentSolutionById
);

module.exports = router;
