const User = require('../models/user');
const Subscription = require('../models/subcription');
const Wallet = require('../models/wallet');

const SUBSCRIPTION_PLANS = {
  'scholar-life': {
    name: 'Scholar Life',
    price: 15000,
    features: {
      unlimitedQuestions: true,
      solutionRequests: 3,
      weeklyStudyPlan: false,
      priorityResponse: false,
    },
  },
  'edu-pro': {
    name: 'Edu Pro',
    price: 25000,
    features: {
      unlimitedQuestions: true,
      solutionRequests: 5,
      weeklyStudyPlan: true,
      priorityResponse: true,
    },
  },
};

// Get subscription plans
const getSubPlans = (req, res) => {
  res.json({
    plans: SUBSCRIPTION_PLANS,
  });
};

// Get user subscription
const getUserSub = async (req, res) => {
  try {
    const id = req.user._id;

    const user = await User.findById(id);

    const currentSubscription = await Subscription.findOne({
      userId: id,
      status: 'active',
      endDate: { $gt: new Date() },
    }).sort({ createdAt: -1 });
    res.json({
      currentPlan: user.subscriptionPlan,
      subscriptionExpiresAt: user.subscriptionExpiresAt,
      subscription: currentSubscription,
      walletBalance: user.walletBalance,
      dailyQuestionViews: user.dailyQuestionViews,
      monthlySolutionRequests: user.monthlySolutionRequests,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Subscribe to plan using wallet
const subWithWallet = async (req, res) => {
  try {
    const id = req.user._id;
    const { plan } = req.body;

    if (!SUBSCRIPTION_PLANS[plan]) {
      return res.status(400).json({ message: 'Invalid subscription plan' });
    }
    const user = await User.findById(req.user._id);
    const planDetails = SUBSCRIPTION_PLANS[plan];

    // Check wallet balance
    if (user.walletBalance < planDetails.price) {
      return res.status(400).json({
        message: 'Insufficient wallet balance',
        required: planDetails.price,
        available: user.walletBalance,
      });
    }

    // Calculate subscription end date (30 days)
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);

    // Debit wallet
    const balanceBefore = user.walletBalance;
    user.walletBalance -= planDetails.price;
    user.subscriptionPlan = plan;
    user.subscriptionExpiresAt = endDate;
    user.monthlySolutionRequests = 0; // Reset monthly counter
    user.lastSolutionRequestMonth = new Date().toISOString().slice(0, 7);
    await user.save();

    // Create wallet transaction
    const transaction = new Wallet({
      userId: user._id,
      type: 'debit',
      amount: planDetails.price,
      description: `Subscription to ${planDetails.name}`,
      category: 'subscription',
      balanceBefore,
      balanceAfter: user.walletBalance,
    });
    await transaction.save();

    // Create subscription record
    const subscription = new Subscription({
      userId: user._id,
      plan,
      endDate,
      amount: planDetails.price,
      paymentMethod: 'wallet',
    });
    await subscription.save();
    res.json({
      message: 'Subscription activated successfully',
      subscription,
      walletBalance: user.walletBalance,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin change user subscription
const changeUserSub = async (req, res) => {
  try {
    const { userId } = req.params;
    const { plan } = req.body;
    console.log(req.body);

    if (plan !== 'free' && !SUBSCRIPTION_PLANS[plan]) {
      return res.status(400).json({ message: 'Invalid subscription plan' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.role !== 'student') {
      return res
        .status(400)
        .json({ message: 'Only students can have subscriptions' });
    }

    // Update user subscription
    user.subscriptionPlan = plan;

    if (plan === 'free') {
      user.subscriptionExpiresAt = null;
    } else {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);
      user.subscriptionExpiresAt = endDate;
    }

    user.monthlySolutionRequests = 0; // Reset monthly counter
    user.lastSolutionRequestMonth = new Date().toISOString().slice(0, 7);
    await user.save();
    // Create subscription record
    if (plan !== 'free') {
      const subscription = new Subscription({
        userId: user._id,
        plan,
        endDate: user.subscriptionExpiresAt,
        amount: SUBSCRIPTION_PLANS[plan].price,
        paymentMethod: 'admin',
        adminId: req.user._id,
      });

      await subscription.save();
    }

    res.json({
      message: 'User subscription updated successfully',
      user: {
        id: user._id,
        name: user.name,
        subscriptionPlan: user.subscriptionPlan,
        subscriptionExpiresAt: user.subscriptionExpiresAt,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getSubPlans,
  getUserSub,
  subWithWallet,
  changeUserSub,
};
