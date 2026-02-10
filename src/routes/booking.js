const express = require('express');
const uploads = require('../middleware/bookingUpload');
const { auth, authorize } = require('../middleware/auth');
const uploads = require('../middleware/bookingUpload');
const {
  getTutorAvailability,
  bookTutor,
  verifyBookingPayment,
  approveBooking,
  rateBooking,
  getTutorBookings,
  getStudentBookings,
  getPendingBookings,
  getBookingDetails,
  getTodayClassesForTutor,
} = require('../controller/booking');
const path = require('path');
const fs = require('fs');

const router = express.Router();
router.get('/bookings/tutor/:id/availability', auth, getTutorAvailability);

router.post('/bookings', auth, uploads.single('attachment'), bookTutor);
router.get('/bookings/verify/:reference', verifyBookingPayment);

// Admin only
router.get('/bookings/pending', auth, authorize('admin'), getPendingBookings);
router.patch(
  '/bookings/:bookingId/approve',
  auth,
  authorize('admin'),
  approveBooking,
);
router.patch('/bookings/:bookingId/rate', auth, rateBooking);
router.get('/bookings/all', auth, authorize('tutor'), getTutorBookings);
router.get(
  '/bookings/students/me',
  auth,
  authorize('student'),
  getStudentBookings,
);

// router.get(
//   '/bookings/student/:bookingId',
//   auth,
//   authorize('tutor'),
//   getBookingDetailsForStudent
// );

// router.get(
//   '/bookings/tutors/:bookingId',
//   auth,
//   authorize('student'),
//   getBookingDetailsForTutor
// );

// const path =  'path';
// import fs from 'fs';

// Serve student uploaded files
// router.get('/bookings/file/:filename', auth, (req, res) => {
//   const { filename } = req.params;
//   const filePath = path.join(__dirname, '..', 'uploads', 'bookings', filename);

//   if (!fs.existsSync(filePath)) {
//     return res.status(404).json({ message: 'File not found' });
//   }

//   res.sendFile(filePath);
// });

// router.get('/bookings/file/:filename', (req, res) => {
//   const { filename } = req.params;

//   const baseDir =
//     process.env.NODE_ENV === 'production'
//       ? '/tmp/bookings'
//       : path.join(__dirname, '..', 'uploads', 'bookings');

//   const filePath = path.join(baseDir, filename);

//   if (!fs.existsSync(filePath)) {
//     return res.status(404).json({ message: 'File not found' });
//   }

//   res.setHeader('Content-Type', 'application/pdf');
//   res.setHeader('Content-Disposition', 'inline');

//   res.sendFile(filePath);
// });

router.get('/bookings/file/:filename', (req, res) => {
  const { filename } = req.params;

  const baseDir =
    process.env.NODE_ENV === 'production'
      ? '/tmp/bookings'
      : path.join(__dirname, '..', 'uploads', 'bookings');

  const filePath = path.join(baseDir, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: 'File not found' });
  }

  // 🔥 VERY IMPORTANT
  res.sendFile(filePath);
});

router.get('/bookings/:bookingId', auth, getBookingDetails);

router.get(
  '/bookings/tutor/today-classes',
  auth,
  authorize('tutor'),
  getTodayClassesForTutor,
);

module.exports = router;
