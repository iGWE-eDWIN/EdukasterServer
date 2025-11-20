const paystackService = require('../services/paystackService');
const Wallet = require('../models/wallet');

// get paystack bank codes
const getBanks = async (req, res) => {
  try {
    const result = await paystackService.getBanks();

    if (result.success) {
      console.log(result);
      return res.json({ banks: result.data }); // send array of banks
    }

    return res.status(400).json({ message: result.message });
  } catch (err) {
    console.error('Error fetching banks:', err);
    return res.status(500).json({ message: 'Server error fetching banks' });
  }
};

const resolveAccount = async (req, res) => {
  try {
    const { accountNumber, bankCode } = req.body;

    if (!accountNumber || !bankCode) {
      return res.status(400).json({
        success: false,
        message: 'Account number and bank code required',
      });
    }

    const result = await paystackService.resolveAccount(
      accountNumber,
      bankCode
    );

    if (result.success) {
      return res.json({ success: true, accountName: result.accountName });
    } else {
      return res.status(400).json({ success: false, message: result.message });
    }
  } catch (error) {
    console.error('Error fetching banks:', err);
    return res.status(500).json({ message: error });
  }
};

module.exports = { getBanks, resolveAccount };
