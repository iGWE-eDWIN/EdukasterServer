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

const fundWallet = async (req, res) => {
  try {
    const id = req.user._id;
    const { amount } = req.body;

    if (!amount || amount < 100) {
      return res
        .status(400)
        .json({ message: 'Minimum funding amount is ₦100' });
    }

    const user = await User.findById(id);

    const reference = paystackService.generateReference();
    // Initialize Paystack transaction
    const paymentData = await paystackService.initializeTransaction({
      email: user.email,
      amount: amount,
      reference,
      //   callback_url: `${process.env.FRONTEND_URL}/wallet/callback`,
      metadata: {
        userId: id,
        type: 'wallet_funding',
        amount,
      },
    });

    res.json({
      message: 'Wallet funding initialized',
      data: paymentData.data,
      reference,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Verify wallet funding
const verifyWalletFunding = async () => {
  try {
    const id = req.user._id;
    const { reference } = req.params;

    // verify with Paystack
    const verification = await paystackService.verifyTransaction(reference);

    if (!verification.status || verification.data.status !== 'success') {
      return res.status(400).json({ message: 'Payment verification failed' });
    }

    const user = await User.findById(id);
    const amount = verification.data.amount / 100; // Convert from kobo

    // Update wallet balance
    const balanceBefore = user.walletBalance;
    user.walletBalance += amount;
    await user.save();

    // Create transaction record
    const transaction = new Wallet({
      userId: user._id,
      type: 'credit',
      amount,
      description: 'Wallet funding via Paystack',
      category: 'funding',
      balanceBefore,
      balanceAfter: user.walletBalance,
      reference,
      paystackReference: reference,
    });

    await transaction.save();

    res.json({
      message: 'Wallet funded successfully',
      walletBalance: user.walletBalance,
      transaction,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin fund user wallet
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
