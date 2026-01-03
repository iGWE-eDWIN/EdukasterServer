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
  enableTwoFactorEmail,
  verifyTwoFactorEmail,
  disableTwoFactorEmail,
  verifyTwoFactorLogin,
  verifyEmail,
  savePushToken,
  deleteAccount,
} = require('../controller/auth');

const router = new express.Router();
// User registration route
router.post('/register', registerUser);

// Email verification route
router.post('/verify-email', verifyEmail);

// User login route
router.post('/login', loginUser);

// verify two-factor authentication during login
router.post('/verify-2fa-login', verifyTwoFactorLogin);

// enable two-factor authentication via email
router.post('/enable-2fa-email', auth, enableTwoFactorEmail);

// verify two-factor authentication via email
router.post('/verify-2fa-email', auth, verifyTwoFactorEmail);

// disable two-factor authentication via email
router.post('/disable-2fa-email', auth, disableTwoFactorEmail);

// Token refresh route
router.post('/refresh-token', refreshToken);

// Get current user route
router.get('/me', auth, getCurrentUser);

// Change password route
router.post('/change-password', auth, changePassword);

// Update profile route
router.patch('/update-profile', auth, upload.single('avatar'), updateProfile);

// Delete account
router.delete('/delete-account', auth, deleteAccount);

// Save push notification token route
router.post('/save-push-token', auth, savePushToken);

module.exports = router;
