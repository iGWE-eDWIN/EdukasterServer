const express = require('express');
const { auth, authorize } = require('../middleware/auth');
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

const router = express.Router();
router.get('/bookings/tutor/:id/availability', auth, getTutorAvailability);
router.post('/bookings', auth, bookTutor);
router.get('/bookings/verify/:reference', verifyBookingPayment);

// Admin only
router.get('/bookings/pending', auth, authorize('admin'), getPendingBookings);
router.patch(
  '/bookings/:bookingId/approve',
  auth,
  authorize('admin'),
  approveBooking
);
router.patch('/bookings/:bookingId/rate', auth, rateBooking);
router.get('/bookings/all', auth, authorize('tutor'), getTutorBookings);
router.get(
  '/bookings/students/me',
  auth,
  authorize('student'),
  getStudentBookings
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

router.get('/bookings/:bookingId', auth, getBookingDetails);

router.get(
  '/bookings/tutor/today-classes',
  auth,
  authorize('tutor'),
  getTodayClassesForTutor
);

module.exports = router;
