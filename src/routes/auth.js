const express = require('express');
const { auth } = require('../middleware/auth');
const upload = require('../middleware/uploads');

const {
  registerUser,
  loginUser,
  refreshToken,
  getCurrentUser,
  changePassword,
  updateProfile,
} = require('../controller/auth');

const router = new express.Router();
// User registration route
router.post('/register', registerUser);

// User login route
router.post('/login', loginUser);

// Token refresh route
router.post('/refresh-token', refreshToken);

// Get current user route
router.get('/me', auth, getCurrentUser);

// Change password route
router.post('/change-password', auth, changePassword);

// Update profile route
router.patch('/update-profile', auth, upload.single('avatar'), updateProfile);

module.exports = router;
