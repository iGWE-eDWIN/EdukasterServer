const express = require('express');
const { auth, authorize } = require('../middleware/auth');
const {
  getWalletBalance,
  fundWallet,
  verifyWalletFunding,
  adminFundWallet,
} = require('../controller/wallet');

const router = new express.Router();

// Get wallet balance and transactions
router.get('/wallet', auth, authorize('student'), getWalletBalance);
// Initialize wallet funding
router.post('/wallet/fund', auth, authorize('student'), fundWallet);
// Verify wallet funding
router.post(
  '/verfy/:reference',
  auth,
  authorize('student'),
  verifyWalletFunding
);
// Admin fund user wallet
router.post(
  '/wallet/admin-fund/:userId',
  auth,
  authorize('admin'),
  adminFundWallet
);

module.exports = router;
