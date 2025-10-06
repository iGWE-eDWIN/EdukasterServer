const User = require('../models/user');
const { formatUser, isTutorAvailable } = require('../utils/formatDetails');

// ✅ GET available tutors for current day/time
const getAvailableTutors = async (req, res) => {
  try {
    // Example: pass ?day=Monday&time=10:30&ampm=AM
    // console.log(req.query);
    const { day, time, ampm } = req.query;

    if (!day || !time || !ampm) {
      return res
        .status(400)
        .json({ message: 'day, time, and ampm are required' });
    }

    const tutors = await User.find({
      role: 'tutor',
      isApproved: true,
      isActive: true,
    }).select('-password');

    const availableTutors = tutors
      .filter((tutor) => {
        const available = isTutorAvailable(tutor, day, time, ampm);
        // console.log(tutor.name, 'available?', available);
        return available;
      })
      .map(formatUser);
    console.log(availableTutors);
    res.status(200).json({ availableTutors });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
// ✅ GET tutor by ID
const getTutorById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: 'Tutor ID is required' });
    }

    const tutor = await User.findById(id).select('-password');

    if (!tutor) {
      return res.status(404).json({ message: 'Tutor not found' });
    }

    res.status(200).json(formatUser(tutor));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all tutors
const getAllTutors = async (req, res) => {};

module.exports = { getAvailableTutors, getTutorById, getAllTutors };
