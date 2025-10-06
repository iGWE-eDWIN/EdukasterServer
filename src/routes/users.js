const express = require('express');
const { auth, authorize } = require('../middleware/auth');
const {
  getAllUsers,
  getPendingTutorApprovals,
  approveTutor,
  rejectTutor,
  updateUserStatus,
  deleteUser,
} = require('../controller/users');

const router = new express.Router();

router.get('/users', auth, authorize('admin'), getAllUsers);
router.get(
  '/users/pending-tutors',
  auth,
  authorize('admin'),
  getPendingTutorApprovals
);
router.patch('/users/:id/approve', auth, authorize('admin'), approveTutor);
router.patch('/users/:id/reject', auth, authorize('admin'), rejectTutor);
router.patch('/users/:id/status', auth, authorize('admin'), updateUserStatus);
router.delete('/users/:id', auth, authorize('admin'), deleteUser);

module.exports = router;
