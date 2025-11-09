require('dotenv').config();
const User = require('../models/user');
const Wallet = require('../models/wallet');
const paystackService = require('../services/paystackService');
const { formatUser } = require('../utils/formatDetails');

// Get wallet balance and transactions
const getWalletBalance = async (req, res) => {
  try {
    const id = req.user._id;
    const { page = 1, limit = 20 } = req.query;

    const user = await User.findById(id).select('walletBalance');

    const transactions = await Wallet.find({ userId: id })
      .populate('adminId', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Wallet.countDocuments({ userId: id });

    res.json({
      walletBalance: user.walletBalance,
      transactions,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// const fundWallet = async (req, res) => {
//   try {
//     const id = req.user._id;
//     const { amount } = req.body;

//     if (!amount || amount < 100) {
//       return res
//         .status(400)
//         .json({ message: 'Minimum funding amount is ₦100' });
//     }

//     const user = await User.findById(id);

//     const reference = paystackService.generateReference();

//     callbackUrl = `${process.env.FRONTEND_WEB_URL}/wallet/verify/${reference}`;
//     // Initialize Paystack transaction
//     const paymentData = await paystackService.initializeTransaction({
//       email: user.email,
//       amount: amount,
//       reference,
//       callback_url: callbackUrl,
//       metadata: {
//         userId: id,
//         type: 'wallet_funding',
//         amount,
//       },
//     });
//     // console.log(paymentData);
//     // console.log(paymentData.data.data.authorization_url);
//     res.json({
//       message: 'Wallet funding initialized',
//       // data: paymentData.data,
//       authorization_url: paymentData.data.data.authorization_url,
//       reference,
//     });
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };

// Verify wallet funding
// const verifyWalletFunding = async (req, res) => {
//   try {
//     const id = req.user._id;
//     const { reference } = req.params;

//     // verify with Paystack
//     const verification = await paystackService.verifyTransaction(reference);

//     if (!verification.status || verification.data.status !== 'success') {
//       return res.status(400).json({ message: 'Payment verification failed' });
//     }

//     const user = await User.findById(id);
//     const amount = verification.data.amount / 100; // Convert from kobo

//     // Update wallet balance
//     const balanceBefore = user.walletBalance;
//     user.walletBalance += amount;
//     await user.save();

//     // Create transaction record
//     const transaction = new Wallet({
//       userId: user._id,
//       type: 'credit',
//       amount,
//       description: 'Wallet funding via Paystack',
//       category: 'funding',
//       balanceBefore,
//       balanceAfter: user.walletBalance,
//       reference,
//       paystackReference: reference,
//     });

//     await transaction.save();

//     res.json({
//       message: 'Wallet funded successfully',
//       walletBalance: user.walletBalance,
//       transaction,
//     });
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };

// const verifyWalletFunding = async (req, res) => {
//   try {
//     const { reference } = req.params;

//     // Verify with Paystack
//     const verification = await paystackService.verifyTransaction(reference);

//     // Fix: Check correct response structure
//     if (!verification.success || verification.data.data.status !== 'success') {
//       // Redirect to frontend with error
//       return res.redirect(
//         `${process.env.FRONTEND_WEB_URL}/wallet?status=failed`
//       );
//     }

//     // Extract userId from metadata
//     const userId = verification.data.data.metadata.userId;
//     const amount = verification.data.data.amount / 100; // Convert from kobo

//     const user = await User.findById(userId);
//     if (!user) {
//       return res.redirect(
//         `${process.env.FRONTEND_WEB_URL}/wallet?status=failed`
//       );
//     }

//     // Update wallet balance
//     const balanceBefore = user.walletBalance;
//     user.walletBalance += amount;
//     await user.save();

//     // Create transaction record
//     const transaction = new Wallet({
//       userId: user._id,
//       type: 'credit',
//       amount,
//       description: 'Wallet funding via Paystack',
//       category: 'funding',
//       balanceBefore,
//       balanceAfter: user.walletBalance,
//       reference,
//       paystackReference: reference,
//     });

//     await transaction.save();

//     // Redirect to frontend with success
//     res.redirect(
//       `${process.env.FRONTEND_WEB_URL}/wallet?status=success&amount=${amount}`
//     );
//   } catch (error) {
//     console.error('Verification error:', error);
//     res.redirect(`${process.env.FRONTEND_WEB_URL}/wallet?status=failed`);
//   }
// };

// Admin fund user wallet

const fundWallet = async (req, res) => {
  try {
    const id = req.user._id;
    const { amount, redirectUri } = req.body;
    console.log(redirectUri);

    if (!amount || amount < 100) {
      return res
        .status(400)
        .json({ success: false, message: 'Minimum funding amount is ₦100' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: 'User not found' });
    }

    const reference = paystackService.generateReference();

    // ✅ Use correct callback for backend verification endpoint
    const callbackUrl = `${process.env.BACKEND_URL}/wallet/verify/${reference}`;

    // ✅ Amount should be multiplied by 100 here (Paystack expects kobo)
    const paymentData = await paystackService.initializeTransaction({
      email: user.email,
      amount: amount,
      reference,
      callback_url: callbackUrl,
      metadata: {
        userId: id,
        type: 'wallet_funding',
        amount,
        redirectUri,
      },
    });

    // ✅ Check for Paystack errors
    if (!paymentData.success) {
      console.error('Paystack Init Error:', paymentData.details);
      return res.status(400).json({
        success: false,
        message: paymentData.message,
        details: paymentData.details,
      });
    }

    // ✅ Return authorization URL to frontend
    res.status(200).json({
      success: true,
      message: 'Wallet funding initialized',
      authorization_url: paymentData.data.data.authorization_url,
      reference,
    });
  } catch (error) {
    console.error('fundWallet Error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// const verifyWalletFunding = async (req, res) => {
//   try {
//     const { reference } = req.params;

//     const verification = await paystackService.verifyTransaction(reference);

//     // ✅ Ensure we’re checking the correct structure
//     if (
//       !verification.success ||
//       !verification.data ||
//       verification.data.data.status !== 'success'
//     ) {
//       return res.redirect(`${process.env.FRONTEND_URL}/wallet?status=failed`);
//     }

//     const userId = verification.data.data.metadata.userId;
//     const amount = verification.data.data.amount / 100; // convert kobo → Naira

//     const user = await User.findById(userId);
//     if (!user) {
//       return res.redirect(`${process.env.FRONTEND_URL}/wallet?status=failed`);
//     }

//     const balanceBefore = user.walletBalance;
//     user.walletBalance += amount;
//     await user.save();

//     await Wallet.create({
//       userId: user._id,
//       type: 'credit',
//       amount,
//       description: 'Wallet funding via Paystack',
//       category: 'funding',
//       balanceBefore,
//       balanceAfter: user.walletBalance,
//       reference,
//       paystackReference: reference,
//     });

//     // ✅ Redirect to frontend with confirmation
//     res.redirect(
//       `${process.env.FRONTEND_URL}/wallet?status=success&amount=${amount}`
//     );
//   } catch (error) {
//     console.error('Verification error:', error);
//     res.redirect(`${process.env.FRONTEND_URL}/wallet?status=failed`);
//   }
// };

const verifyWalletFunding = async (req, res) => {
  try {
    const { reference } = req.params;
    const verification = await paystackService.verifyTransaction(reference);

    if (
      !verification.success ||
      !verification.data ||
      verification.data.data.status !== 'success'
    ) {
      return res
        .status(400)
        .json({ success: false, message: 'Transaction not successful' });
    }

    const userId = verification.data.data.metadata.userId;
    const amount = verification.data.data.amount / 100;
    const redirectUri = verification.data.data.metadata.redirectUri; // ✅ captured from metadata
    console.log(redirectUri);
    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: 'User not found' });
    }

    const balanceBefore = user.walletBalance;
    user.walletBalance += amount;
    await user.save();

    await Wallet.create({
      userId: user._id,
      type: 'credit',
      amount,
      description: 'Wallet funding via Paystack',
      category: 'funding',
      balanceBefore,
      balanceAfter: user.walletBalance,
      reference,
    });

    // console.log('Redirecting to:', redirectUri);

    // ✅ Redirect to app deep link if available
    if (redirectUri) {
      console.log('Redirecting to:', redirectUri);
      const redirectUrl = `${redirectUri}?status=success&amount=${amount}`;
      return res.redirect(302, redirectUrl);
    }

    // ✅ Respond with JSON only — no redirect
    res.json({
      success: true,
      message: 'Wallet funded successfully',
      amount,
      walletBalance: user.walletBalance,
    });
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ success: false, message: 'Verification failed' });
  }
};

const adminFundWallet = async (req, res) => {
  try {
    const { userId } = req.params;
    const { amount, description } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.role !== 'student') {
      return res
        .status(400)
        .json({ message: 'Only students can have wallet balance' });
    }
    // Update wallet balance
    const balanceBefore = user.walletBalance;
    user.walletBalance += amount;
    await user.save();

    // Create transaction record
    const transaction = new Wallet({
      userId: user._id,
      type: 'credit',
      amount,
      description: description || 'Admin wallet funding',
      category: 'admin_credit',
      balanceBefore,
      balanceAfter: user.walletBalance,
      adminId: req.user._id,
    });

    await transaction.save();

    res.json({
      message: 'Wallet funded successfully',
      user: {
        id: user._id,
        name: user.name,
        walletBalance: user.walletBalance,
      },
      transaction,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getWalletBalance,
  fundWallet,
  verifyWalletFunding,
  adminFundWallet,
};
