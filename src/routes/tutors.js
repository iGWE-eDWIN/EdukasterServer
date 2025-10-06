const express = require('express');
const { auth } = require('../middleware/auth');
const {
  getAvailableTutors,
  getTutorById,
  getAllTutors,
} = require('../controller/tutors');

const router = new express.Router();
router.get('/tutors/available', auth, getAvailableTutors);
router.get('/tutors/:id', auth, getTutorById);
router.get('/tutors/all', auth, getAllTutors);
module.exports = router;
