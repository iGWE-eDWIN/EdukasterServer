const express = require('express');
const { auth, authorize } = require('../middleware/auth');
const {
  getWalletBalance,
  fundWallet,
  verifyWalletFunding,
  adminFundWallet,
  tutorWithdrawl,
} = require('../controller/wallet');

const router = new express.Router();

// Get wallet balance and transactions
router.get('/wallet', auth, getWalletBalance);
// Initialize wallet funding
router.post('/wallet/fund', auth, authorize('student'), fundWallet);
// Verify wallet funding
router.get('/wallet/verify/:reference', verifyWalletFunding);
// Admin fund user wallet
router.post(
  '/wallet/admin-fund/:userId',
  auth,
  authorize('admin'),
  adminFundWallet
);

// Tutor withdrawal
router.post('/wallet/withdraw', auth, authorize('tutor'), tutorWithdrawl);

module.exports = router;
