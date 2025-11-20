const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const { completeBooking } = require('../controller/sessions'); // file where completeBooking exported
router.patch('/session/:id/complete', auth, completeBooking);
module.exports = router;
