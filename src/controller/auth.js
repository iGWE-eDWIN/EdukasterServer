const User = require('../models/user');
const paystackService = require('../services/paystackService');
const bcrypt = require('bcryptjs');
const { formatUser } = require('../utils/formatDetails');

// Register user
const registerUser = async (req, res) => {
  try {
    const { email, password, name, role } = req.body;
    // console.log(req.body);

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create user
    const userData = {
      email,
      password,
      name,
      role,
    };
    const user = new User(userData);
    await user.save();
    // const user = await new User(userData);
    // await user.save();

    // Send approval notification for tutors
    if (role === 'tutor') {
      // In a real app, you might send an email notification to admin
      console.log(`New tutor registration pending approval: ${user.email}`);
    }

    // Create Paystack customer for students
    if (role === 'student') {
      try {
        const customerData = await paystackService.createCustomer({
          email: user.email,
          firstName: user.name.split(' ')[0],
          lastName: user.name.split(' ').slice(1).join(' '),
        });

        user.paystackCustomerCode = customerData.data.customer_code;
        await user.save();
      } catch (error) {
        console.error('Paystack customer creation failed:', error.message);
      }
    }

    // ✅ Generate tokens using model method
    const { accessToken, refreshToken } = await user.generateAuthToken();

    res.status(201).json({
      message: 'User registered successfully',
      user: formatUser(user),
      accessToken,
      refreshToken,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const loginUser = async (req, res) => {
  try {
    // console.log(req.body);
    const { email, password } = req.body;
    const user = await User.findByCredentials(email, password);
    // Check if account is active
    if (!user.isActive) {
      return res.status(401).json({ message: 'Account is suspended' });
    }

    // ✅ Generate tokens using model method
    const { accessToken, refreshToken } = await user.generateAuthToken();

    res.status(200).json({
      message: 'User logged in successfully',
      user: formatUser(user),
      accessToken,
      refreshToken,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Refresh token
const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(401).json({ message: 'Refresh token required' });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findOne({
      _id: decoded._id,
      'tokens.token': refreshToken,
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    // Generate new tokens
    const { accessToken, refreshToken: newRefreshToken } =
      await user.generateAuthToken();

    res.status(200).json({
      message: 'Tokens refreshed successfully',
      accessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: error.message || 'Failed to refresh token' });
  }
};

// Get current user
const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({
      message: 'Current user retrieved successfully',
      user: formatUser(user),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Change password
const changePassword = async (req, res) => {
  try {
    const userId = req.user._id; // populated by your auth middleware
    const { oldPassword, newPassword } = req.body;
    // console.log(req.body);

    if (!oldPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: 'Both old and new passwords are required' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // check old password
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Old password is incorrect' });
    }

    // update new password (will trigger pre-save hook in model)
    user.password = newPassword;
    user.passwordChangedAt = Date.now(); // optional: track password change
    await user.save();

    res.status(200).json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// Update profile (avatar, goal, about)
const updateProfile = async (req, res) => {
  try {
    const userId = req.user._id; // Auth middleware puts user into req.user
    const {
      goal,
      about,
      courseTitle,
      courseDetails,
      experience,
      availableDays,
      tutorFee,
    } = req.body;

    // console.log(req.body);
    console.log(tutorFee);
    const updates = {};
    if (goal) updates.goal = goal;
    if (about) updates.about = about;
    if (courseTitle) updates.courseTitle = courseTitle;
    if (courseDetails) updates.courseDetails = courseDetails;
    if (experience) updates.experience = experience;

    // ✅ Update tutor fee only — do not compute total yet
    if (tutorFee !== undefined) {
      updates['fees.tutorFee'] = Number(tutorFee);
    }

    if (availableDays) {
      const parsedDays =
        typeof availableDays === 'string'
          ? JSON.parse(availableDays)
          : availableDays;
      const available = Object.entries(parsedDays).map(([day, data]) => ({
        day,
        from: data.from,
        to: data.to,
        ampmFrom: data.ampmFrom,
        ampmTo: data.ampmTo,
        active: data.active,
      }));
      updates.availability = available;
    }

    // If avatar uploaded
    if (req.file) {
      updates.avatar = {
        data: req.file.buffer,
        contentType: req.file.mimetype,
      };
    }

    // console.log(updates);

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true }
    );
    // console.log(user.fees);
    // console.log(user);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({
      message: 'Profile updated successfully',
      user: formatUser(user),
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

module.exports = {
  registerUser,
  loginUser,
  refreshToken,
  getCurrentUser,
  changePassword,
  updateProfile,
};
