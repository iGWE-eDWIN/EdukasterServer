const User = require('../models/user');
const Wallet = require('../models/wallet');
const { formatUser } = require('../utils/formatDetails');
const { sendEmail } = require('../utils/email');

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

    // 1️⃣ Find tutor
    const tutor = await User.findById(id);
    console.log('Approving tutor:', id, tutor?.email);
    if (!tutor) {
      return res.status(404).json({ message: 'Tutor not found' });
    }

    if (tutor.role !== 'tutor') {
      return res.status(400).json({ message: 'User is not a tutor' });
    }

    // 2️⃣ Approve tutor in DB
    tutor.isApproved = true;
    await tutor.save();

    console.log(`Tutor approved: ${tutor?.email}`);

    // 3️⃣ Send approval email safely
    if (tutor?.email) {
      try {
        await sendEmail(
          tutor?.email,
          'Your tutor application has been approved',
          `Congratulations ${tutor.name}, your application has been approved.`
        );
      } catch (emailError) {
        console.error(
          `Failed to send approval email to ${tutor.email}:`,
          emailError
        );
        // Optionally: you could store a flag to retry sending email later
      }
    } else {
      console.warn(`Tutor ${tutor.name} has no email defined. Skipping email.`);
    }

    // 4️⃣ Return success response
    res.status(200).json({
      message: 'Tutor approved successfully',
      tutor: formatUser(tutor),
    });
  } catch (error) {
    // Only DB or unexpected errors reach here
    console.error('Error approving tutor:', error);
    res.status(500).json({ message: 'Failed to approve tutor' });
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
    await sendEmail(
      tutor.email,
      'Your tutor application has been rejected',
      `Dear ${tutor.name}, we regret to inform you that your application has been rejected. Reason: ${tutor.rejectionReason}`
    );

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

// Get user details (Admin only)
const getUserDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select('-password');

    if (!user) {
      return res.status(404).json({
        message: 'User not found',
      });
    }
    // Get recent wallet transactions if student
    let recentTransactions = [];
    if (user.role === 'student') {
      recentTransactions = await Wallet.find({ userId: id })
        .populate('adminId', 'name email')
        .sort({ createAt: -1 })
        .limit(10);
    }

    res.json({
      message: 'User detail gotten successfully',
      user: formatUser(user),
      recentTransactions,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update user details (Admin only)
const updateUserDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    // Remove sensitive fields that shouldn't be updated this way
    delete updates.password;
    delete updates._id;
    delete updates.__v;

    const user = await User.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    }).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: 'User updated successfully',
      user: formatUser(user),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Change user password (Admin only)
const changeUsersPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res
        .status(400)
        .json({ message: 'Password must be at least 6 characters' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // update new password (will trigger pre-save hook in model)
    user.password = newPassword;
    user.passwordChangedAt = Date.now(); // optional: track password change
    await user.save();
    res.status(200).json({
      message: 'Password changed successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Change user role (Admin only)
const changeUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['student', 'tutor', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const oldRole = user.role;
    user.role = role;

    // Set approval status based on new role
    if (role === 'tutor') {
      user.isApproved = false; // Tutors need approval
    } else {
      user.isApproved = true; // Students and admins are auto-approved
    }

    await user.save();

    res.json({
      message: `User role changed from ${oldRole} to ${role}`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isApproved: user.isApproved,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin sets their own fee for a tutor
// const setTutorAdminFee = async (req, res) => {
//   try {
//     const { tutorId } = req.params;
//     const { adminFee } = req.body;
//     console.log(tutorId, adminFee);

//     const tutor = await User.findById(tutorId);
//     if (!tutor || tutor.role !== 'tutor') {
//       return res.status(404).json({ message: 'Tutor not found' });
//     }

//     tutor.fees.adminFee = Number(adminFee) || 0;
//     tutor.fees.totalFee = tutor.fees.tutorFee + tutor.fees.adminFee; // ✅ totalFee computed here
//     await tutor.save();
//     console.log(tutor.fees.tutorFee);
//     console.log(tutor.fees.totalFee);

//     res.status(200).json({
//       message: 'Tutor admin fee set successfully',
//       user: formatUser(tutor),
//     });
//   } catch (error) {
//     console.error('setTutorAdminFee error:', error);
//     res.status(500).json({ message: error.message });
//   }
// };

const setTutorAdminFee = async (req, res) => {
  try {
    const { tutorId } = req.params;
    const { adminFee } = req.body;

    const tutor = await User.findById(tutorId);
    if (!tutor || tutor.role !== 'tutor') {
      return res.status(404).json({ message: 'Tutor not found' });
    }

    const newAdminFee = Number(adminFee) || 0;
    const tutorFee = Number(tutor.fees?.tutorFee || 0);
    const totalFee = tutorFee + newAdminFee;

    tutor.fees.adminFee = newAdminFee;
    tutor.fees.totalFee = totalFee;
    tutor.markModified('fees'); // ✅ ensures nested save works
    await tutor.save();

    console.log(tutor.fees.adminFee);
    console.log(tutor.fees.tutorFee);
    console.log(tutor.fees.totalFee);

    res.status(200).json({
      message: 'Tutor admin fee set successfully',
      user: formatUser(tutor),
    });
  } catch (error) {
    console.error('setTutorAdminFee error:', error);
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
  getUserDetails,
  updateUserDetails,
  changeUsersPassword,
  changeUserRole,
  setTutorAdminFee,
};
