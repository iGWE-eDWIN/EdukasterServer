const { createPromotion, getPromotions } = require('../controller/promotion');
const { auth } = require('../middleware/auth');
const upload = require('../middleware/uploads');

const router = new require('express').Router();

// Create a new promotion
router.post('/promotions', auth, upload.single('media'), createPromotion);

// Get all promotions
router.get('/promotions', getPromotions);

module.exports = router;
