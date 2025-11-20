const express = require('express');
const { auth } = require('../middleware/auth');
const {
  getAvailableTutors,
  getTutorById,
  getAllTutors,
  rateTutor,
  unrateTutor,
} = require('../controller/tutors');

const router = new express.Router();
router.get('/tutors/available', auth, getAvailableTutors);
router.get('/tutors/all', auth, getAllTutors);
router.get('/tutors/:id', auth, getTutorById);

router.patch('/tutors/:id/rate', auth, rateTutor);
router.patch('/tutors/:id/unrate', auth, unrateTutor);
module.exports = router;
