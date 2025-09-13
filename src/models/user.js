require('dotenv').config();
const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');
const { Schema, model } = mongoose;
const jwt = require('jsonwebtoken');

userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      validate(value) {
        if (!validator.isEmail(value)) {
          throw new Error('Email is invalid');
        }
      },
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      minlength: [6, 'Password must be at least 6 characters'],
      trim: true,
      validate(value) {
        if (value.toLowerCase().includes('password')) {
          throw new Error(`Password can not contain 'Password'`);
        }
      },
    },

    passwordChangedAt: {
      type: Date,
    },
    name: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['student', 'tutor', 'admin'],
      required: true,
    },
    avatar: {
      data: Buffer,
      contentType: String,
    },
    isApproved: {
      type: Boolean,
      default: function () {
        return this.role === 'student' || this.role === 'admin';
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Common Profile Fields (for frontend)
    about: {
      type: String, // Bio/description
    },
    goal: {
      type: String, // Student's learning goal
    },

    // Settings (frontend expects these)
    notification: {
      type: Boolean,
      default: true, // Notifications enabled
    },
    subscription: {
      type: String,
      enum: ['free', 'premium', 'pro'],
      default: 'free',
    },
    privacy: {
      type: String,
      enum: ['public', 'private'],
      default: 'public',
    },

    availability: [
      {
        day: String,
        startTime: String,
        endTime: String,
      },
    ],
    rating: {
      type: Number,
      default: 0,
    },
    totalRatings: {
      type: Number,
      default: 0,
    },
    bio: String,
    isVerified: {
      type: Boolean,
      default: false,
    },
    // Payment info
    paystackCustomerCode: String,
    totalEarnings: {
      type: Number,
      default: 0,
    },
    tokens: [
      {
        token: {
          type: String,
          required: true,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Generating jason web token (jwt) for authentication
userSchema.methods.generateAuthToken = async function () {
  const user = this;
  // const token = jwt.sign({ _id: user._id.toString() }, process.env.JWT_Secret);
  // user.tokens = user.tokens.concat({ token });
  // await user.save({ validateBeforeSave: true });

  // return token;
  // Access token (short life)
  const accessToken = jwt.sign(
    { _id: user._id.toString() },
    process.env.JWT_Secret,
    { expiresIn: '15m' }
  );

  // Refresh token (long life)
  const refreshToken = jwt.sign(
    { _id: user._id.toString() },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );

  // Save refresh token in DB for this user
  // user.tokens = user.tokens.concat({ token: refreshToken });
  // Instead of concat, replace old token
  user.tokens = [{ token: refreshToken }];
  await user.save({ validateBeforeSave: false });

  return { accessToken, refreshToken };
};

// Authenticating username and password
userSchema.statics.findByCredentials = async (email, password) => {
  const user = await User.findOne({ email });

  if (!user) throw new Error('User not found');

  const isMatch = await bcrypt.compare(password, user.password);
  // console.log(user.password);
  // console.log(isMatch);
  if (!isMatch) throw new Error('Unable to login');

  return user;
};

// Creating a hashing middleware to hash the plain text password
userSchema.pre('save', async function (next) {
  const user = this;

  // Only hash password if it was moldified or hasn't been hashed
  if (!user.isModified('password')) {
    return next();
    // user.password = await bcrypt.hash(user.password, 8);
  }
  try {
    const salt = await bcrypt.genSalt(10);
    if (salt) user.password = await bcrypt.hash(user.password, salt);

    user.passwordChangedAt = Date.now();
    next();
    // console.log(user.password);
  } catch (error) {
    next(error);
  }
});

const User = model('User', userSchema);

module.exports = User;
