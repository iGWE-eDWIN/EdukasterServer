const express = require('express');

const router = express.Router();
const {
  createSubscriber,
  getSubscribers,
  sendBulkEmail,
} = require('../controller/subscriber');

// POST /api/subscribers
router.post('/subscribers', createSubscriber);

// GET /api/subscribers
router.get('/subscribers', getSubscribers);

// POST /api/subscribers/bulk-email
router.post('/subscribers/bulk-email', sendBulkEmail);

module.exports = router;
