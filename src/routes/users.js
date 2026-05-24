const express = require('express');
const { auth, authorize } = require('../middleware/auth');
const {
  getAllUsers,
  getPendingTutorApprovals,
  approveTutor,
  rejectTutor,
  updateUserStatus,
  deleteUser,
  getUserDetails,
  updateUserDetails,
  changeUsersPassword,
  changeUserRole,
  setTutorAdminFee,
  getDailyLoginStreak,
} = require('../controller/users');

const router = new express.Router();
router.get('/users/avatar/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('avatar');

    if (!user || !user.avatar?.data) {
      return res.status(404).send('No avatar');
    }

    res.set('Content-Type', user.avatar.contentType);
    res.set('Cache-Control', 'public, max-age=86400'); // cache 1 day

    return res.send(user.avatar.data);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

router.get('/users', auth, authorize('admin'), getAllUsers);
router.get(
  '/users/pending-tutors',
  auth,
  authorize('admin'),
  getPendingTutorApprovals,
);
router.patch('/users/:id/approve', auth, authorize('admin'), approveTutor);
router.patch('/users/:id/reject', auth, authorize('admin'), rejectTutor);
router.patch('/users/:id/status', auth, authorize('admin'), updateUserStatus);
router.delete('/users/:id', auth, authorize('admin'), deleteUser);
router.get('/users/:id/details', auth, authorize('admin'), getUserDetails);
router.patch('/users/:id/details', auth, authorize('admin'), updateUserDetails);
router.patch(
  '/users/:id/password',
  auth,
  authorize('admin'),
  changeUsersPassword,
);
router.patch('/users/:id/role', auth, authorize('admin'), changeUserRole);

router.put('/users/tutor-fees', auth, authorize('admin'), setTutorAdminFee);

// Admin track daily login streak
router.get(
  '/users/daily-login-streak',
  auth,
  authorize('admin'),
  getDailyLoginStreak,
);

module.exports = router;
