const express = require('express');
const router = express.Router();
const { getBanks, resolveAccount } = require('../controller/bank');
const { auth, authorize } = require('../middleware/auth');

// GET /api/banks
router.get('/banks', auth, authorize('tutor'), getBanks);

// Get bank name
router.post('/banks/resolve-account', auth, authorize('tutor'), resolveAccount);
module.exports = router;
