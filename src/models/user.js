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
    // Tutor-specific fields
    courseTitle: {
      type: String,
    },
    courseDetails: {
      type: String,
    },
    experience: {
      type: String,
    },

    category: {
      type: String,
      enum: ['academic', 'english', 'consultant', 'others'],
      default: 'others',
    },

    // Settings (frontend expects these)
    notification: {
      type: Boolean,
      default: true, // Notifications enabled
    },
    // subscription: {
    //   type: String,
    //   enum: ['free', 'premium', 'pro'],
    //   default: 'free',
    // },
    privacy: {
      type: String,
      enum: ['public', 'private'],
      default: 'public',
    },

    availability: [
      {
        day: { type: String },
        from: { type: String },
        to: { type: String },
        ampmFrom: { type: String, enum: ['AM', 'PM'], default: 'AM' },
        ampmTo: { type: String, enum: ['AM', 'PM'], default: 'AM' },
        active: { type: Boolean, default: false },
      },
    ],
    fees: {
      tutorFee: { type: Number, default: 0 }, // tutor’s own fee
      adminFee: { type: Number, default: 0 }, // admin’s portion
      totalFee: { type: Number, default: 0 }, // tutorFee + adminFee
    },
    rating: {
      type: Number,
      default: 0,
    },
    totalRatings: {
      type: Number,
      default: 0,
    },
    bio: String,
    // isVerified: {
    //   type: Boolean,
    //   default: false,
    // },

    rejectionReason: String, // For tutors, reason for rejection if not approved
    // Payment info
    paystackCustomerCode: String,
    totalEarnings: {
      type: Number,
      default: 0,
    },
    // Wallet and subscription info
    walletBalance: {
      type: Number,
      default: 0,
    },
    subscriptionPlan: {
      type: String,
      enum: ['free', 'scholar-life', 'edu-pro'],
      default: 'free',
    },
    subscriptionExpiresAt: Date,
    dailyQuestionViews: {
      type: Number,
      default: 0,
    },
    lastQuestionViewDate: Date,
    monthlySolutionRequests: {
      type: Number,
      default: 0,
    },
    lastSolutionRequestMonth: String,
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
    process.env.JWT_Secret
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

// Auto-detect tutor category
function detectCategory(courseTitle = '') {
  const title = courseTitle.trim().toLowerCase();
  const consultants = [
    'consultant',
    'business consultant',
    'career consultant',
    'education consultant',
  ];
  const englishCourses = [
    'pte',
    'toefl',
    'ielts',
    'sat',
    'gre',
    'english proficiency',
    'language test',
  ];
  const academicSubjects = [
    'mathematics',
    'math',
    'english',
    'physics',
    'chemistry',
    'biology',
    'economics',
    'government',
    'history',
    'geography',
    'literature',
    'computer science',
    'accounting',
    'commerce',
    'civic',
    'further mathematics',
    'agric',
  ];

  if (consultants.some((c) => title.includes(c))) return 'consultant';
  if (englishCourses.some((c) => title.includes(c))) return 'english';
  if (academicSubjects.some((c) => title.includes(c))) return 'academic';
  return 'others';
}

userSchema.pre('save', function (next) {
  if (this.role === 'tutor' && this.courseTitle) {
    this.category = detectCategory(this.courseTitle);
  }
  next();
});

userSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate();

  if (!update) return next();

  // Check both direct and nested courseTitle updates
  const courseTitle =
    update.courseTitle || (update.$set && update.$set.courseTitle);

  if (courseTitle) {
    const newCategory = detectCategory(courseTitle);

    // Make sure we apply to $set safely
    if (!update.$set) update.$set = {};
    update.$set.category = newCategory;

    this.setUpdate(update);
  }

  next();
});

const User = model('User', userSchema);

module.exports = User;
