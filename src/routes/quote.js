const express = require('express');
const { auth, authorize } = require('../middleware/auth');
const { createOrUpdateQuote,
    getDailyQuote} = require('../controller/quote')

const router = new express.Router();

// Create or update quote admin
router.post('/admin/qoute', auth, authorize('admin'), createOrUpdateQuote)

// get quote users
router.get('/quote', auth, getDailyQuote)

module.exports = router;