const express = require('express');
const { auth } = require('../middleware/auth');
const {
  getAvailableTutors,
  getTutorById,
  getAllTutors,
} = require('../controller/tutors');

const router = new express.Router();
router.get('/tutors/available', auth, getAvailableTutors);
router.get('/tutors/all', auth, getAllTutors);
router.get('/tutors/:id', auth, getTutorById);
module.exports = router;
