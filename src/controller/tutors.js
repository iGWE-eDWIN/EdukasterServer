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

const rateTutor = async (req, res) => {
  try {
    const tutorId = req.params.id;
    const studentId = req.user._id;
    const { value } = req.body; // 1–5

    if (!value || value < 1 || value > 5)
      return res
        .status(400)
        .json({ message: 'Rating must be between 1 and 5' });

    const tutor = await User.findById(tutorId);
    if (!tutor) return res.status(404).json({ message: 'Tutor not found' });
    if (tutor.role !== 'tutor')
      return res.status(400).json({ message: 'User is not a tutor' });

    // Check if student has rated before
    const existingRating = tutor.ratings.find(
      (r) => r.student.toString() === studentId.toString()
    );

    if (existingRating) {
      // Update existing rating
      existingRating.value = value;
    } else {
      // Add new rating
      tutor.ratings.push({ student: studentId, value });
    }

    // Recalculate totals
    tutor.totalRatings = tutor.ratings.length;
    tutor.averageRating =
      tutor.ratings.reduce((acc, r) => acc + r.value, 0) / tutor.totalRatings;

    await tutor.save();

    res.json({
      message: 'Rating submitted',
      averageRating: tutor.averageRating,
      totalRatings: tutor.totalRatings,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const unrateTutor = async (req, res) => {
  try {
    const tutorId = req.params.id;
    const studentId = req.user._id;

    const tutor = await User.findById(tutorId);
    if (!tutor) return res.status(404).json({ message: 'Tutor not found' });

    tutor.ratings = tutor.ratings.filter(
      (r) => r.student.toString() !== studentId.toString()
    );

    tutor.totalRatings = tutor.ratings.length;
    tutor.averageRating =
      tutor.totalRatings === 0
        ? 0
        : tutor.ratings.reduce((acc, r) => acc + r.value, 0) /
          tutor.totalRatings;

    await tutor.save();

    res.json({
      message: 'Rating removed',
      averageRating: tutor.averageRating,
      totalRatings: tutor.totalRatings,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get all tutors
// const getAllTutors = async (req, res) => {
//   try {
//     const { search, category } = req.query;
//     const filters = { role: 'tutor', isApproved: true };

//     // 🔍 Search filter
//     if (search) {
//       filters.$or = [
//         { name: { $regex: search, $options: 'i' } },
//         { courseTitle: { $regex: search, $options: 'i' } },
//         { courseDetails: { $regex: search, $options: 'i' } },
//         { institution: { $regex: search, $options: 'i' } },
//       ];
//     }

//     // 🏷️ Category filter
//     if (category) {
//       if (
//         ['academic', 'english', 'consultant'].includes(category.toLowerCase())
//       ) {
//         filters.category = category.toLowerCase();
//       }
//     }

//     const tutors = await User.find(filters)
//       .select('name courseTitle experience rating category avatar fees')
//       .sort({ createdAt: -1 });

//     res.status(200).json({
//       success: true,
//       count: tutors.length,
//       tutors,
//     });
//   } catch (error) {
//     console.error('getTutors error:', error);
//     res.status(500).json({ success: false, message: error.message });
//   }
// };

const getAllTutors = async (req, res) => {
  try {
    const { search, category } = req.query;
    const filters = { role: 'tutor', isApproved: true };

    if (search) {
      filters.$or = [
        { name: { $regex: search, $options: 'i' } },
        { courseTitle: { $regex: search, $options: 'i' } },
        { courseDetails: { $regex: search, $options: 'i' } },
        { institution: { $regex: search, $options: 'i' } },
      ];
    }

    if (
      category &&
      category.toLowerCase() !== 'all' &&
      ['academic', 'english', 'consultant'].includes(category.toLowerCase())
    ) {
      filters.category = category.toLowerCase();
    }

    const tutors = await User.find(filters)
      .select('name courseTitle experience rating category avatar fees')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: tutors.length,
      tutors: tutors.map(formatUser), // ✅ Important
    });
  } catch (error) {
    console.error('getTutors error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// const getAllTutors = async (req, res) => {
//   try {
//     const { search, category } = req.query;

//     // Base filter: Only approved tutors
//     const baseFilters = { role: 'tutor', isApproved: true };
//     const andConditions = [baseFilters];

//     // 🔍 Apply search ONLY if non-empty and valid
//     if (search && search.trim().length > 1) {
//       const term = search.trim();

//       // Escape regex special characters to avoid accidental partial matches
//       const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

//       // \b ensures “word boundary” match (e.g., Edwin matches only Edwin, not Edwine)
//       const exactRegex = new RegExp(`\\b${escapedTerm}\\b`, 'i');

//       andConditions.push({
//         $or: [
//           { name: exactRegex },
//           { courseTitle: exactRegex },
//           { courseDetails: exactRegex },
//           { institution: exactRegex },
//         ],
//       });
//     }

//     // 📂 Category filter (optional)
//     if (
//       category &&
//       category.toLowerCase() !== 'all' &&
//       ['academic', 'english', 'consultant'].includes(category.toLowerCase())
//     ) {
//       andConditions.push({ category: category.toLowerCase() });
//     }

//     // ✅ Final Query
//     const tutors = await User.find({ $and: andConditions })
//       .select('name courseTitle experience rating category avatar fees')
//       .sort({ createdAt: -1 });

//     // 🚫 Prevent “no-match” fallback
//     if (search && tutors.length === 0) {
//       return res.status(200).json({
//         success: true,
//         count: 0,
//         tutors: [],
//         message: `No tutors found matching "${search}"`,
//       });
//     }

//     res.status(200).json({
//       success: true,
//       count: tutors.length,
//       tutors: tutors.map(formatUser),
//     });
//   } catch (error) {
//     console.error('getTutors error:', error);
//     res.status(500).json({ success: false, message: error.message });
//   }
// };

module.exports = {
  getAvailableTutors,
  getTutorById,
  getAllTutors,
  rateTutor,
  unrateTutor,
};
