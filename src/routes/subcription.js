const express = require('express');
const { auth, authorize } = require('../middleware/auth');
const {
  getSubPlans,
  getUserSub,
  subWithWallet,
  changeUserSub,
} = require('../controller/subcription');

const router = new express.Router();

// Get subscription plans
router.get('/subscription/plans', getSubPlans);
// Get user subscription
router.get(
  '/subscriptions/my-subscription',
  auth,
  authorize('student'),
  getUserSub
);
// Subscribe to plan using wallet
router.post('/subscribe', auth, authorize('student'), subWithWallet);
// Admin change user subscription
router.patch(
  '/admin-subscribe/:userId',
  auth,
  authorize('admin'),
  changeUserSub
);

module.exports = router;
