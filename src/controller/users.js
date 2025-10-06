const User = require('../models/user');
const { formatUser } = require('../utils/formatDetails');

// Get all users
const getAllUsers = async (req, res) => {
  try {
    let { role, status, page = 1, limit = 20, search } = req.query;

    page = Number(page) || 1;
    limit = Math.min(Number(limit) || 20, 100);

    const query = {};
    if (role) query.role = role;
    if (status === 'approved') query.isApproved = true;
    if (status === 'pending') query.isApproved = false;
    if (status === 'active') query.isActive = true;
    if (status === 'suspended') query.isActive = false;

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    res.status(200).json({
      message: 'Users retrieved successfully',
      users: users.map(formatUser),
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (error) {
    console.error('getAllUsers error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get pending tutor approvals (Admin only)
const getPendingTutorApprovals = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const tutors = await User.find({
      role: 'tutor',
      isApproved: false,
      isActive: true,
    })
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments({
      role: 'tutor',
      isApproved: false,
      isActive: true,
    });

    res.status(200).json({
      message: 'Pending tutor approvals retrieved successfully',
      tutors: tutors.map(formatUser),
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Approve tutor (Admin only)
const approveTutor = async (req, res) => {
  try {
    const { id } = req.params;
    const tutor = await User.findById(id);
    if (!tutor) {
      return res.status(404).json({ message: 'Tutor not found' });
    }

    if (tutor.role !== 'tutor') {
      return res.status(400).json({ message: 'User is not a tutor' });
    }

    tutor.isApproved = true;
    await tutor.save();

    // In a real app, send approval email to tutor
    console.log(`Tutor approved: ${tutor.email}`);

    res.status(200).json({
      message: 'Tutor approved successfully',
      tutor: formatUser(tutor),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Reject tutor (Admin only)
const rejectTutor = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const tutor = await User.findById(id);
    if (!tutor) {
      return res.status(404).json({ message: 'Tutor not found' });
    }

    if (tutor.role !== 'tutor') {
      return res.status(400).json({ message: 'User is not a tutor' });
    }

    // tutor.isApproved = false;
    tutor.isActive = false;
    tutor.rejectionReason = reason || 'No reason provided';
    await tutor.save();

    // In a real app, send rejection email to tutor
    // console.log(`Tutor rejected: ${tutor.email}`);

    res.status(200).json({
      message: 'Tutor rejected successfully',
      tutor: formatUser(tutor),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update user status (Admin only)
const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.isActive = isActive !== undefined ? isActive : user.isActive;
    // user.isApproved = isApproved !== undefined ? isApproved : user.isApproved;

    await user.save();

    res.status(200).json({
      message: 'User status updated successfully',
      user: formatUser(user),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete user (Admin only)
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // await user.remove();
    await User.findByIdAndDelete(id);

    res.status(200).json({
      message: 'User deleted successfully',
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getAllUsers,
  getPendingTutorApprovals,
  approveTutor,
  rejectTutor,
  updateUserStatus,
  deleteUser,
};
