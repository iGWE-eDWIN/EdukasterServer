const User = require('../models/user');
const paystackService = require('../services/paystackService');
const bcrypt = require('bcryptjs');
const { formatUser } = require('../utils/formatDetails');
const { sendEmail } = require('../utils/email');
const tempUsers = new Map();

// Register user
// const registerUser = async (req, res) => {
//   try {
//     const {
//       email,
//       password,
//       name,
//       username,
//       role,
//       institutionType,
//       institution,
//     } = req.body;

//     if (!email || !password || !name || !username || !role) {
//       return res
//         .status(400)
//         .json({ message: 'Please fill all required fields.' });
//     }

//     const existingUser = await User.findOne({ $or: [{ email }, { username }] });
//     if (existingUser) {
//       return res
//         .status(400)
//         .json({ message: 'Email or username already exists.' });
//     }

//     const user = new User({
//       email,
//       password,
//       name,
//       username,
//       role,
//       institutionType: institutionType || null,
//       institution: institution || '',
//       isVerified: false,
//     });

//     const otp = Math.floor(100000 + Math.random() * 900000).toString();
//     const otpExpires = Date.now() + 5 * 60 * 1000;

//     user.twoFactorEmailOTP = otp;
//     user.twoFactorEmailExpires = otpExpires;
//     await user.save();

//     // ✅ Respond first (fast)
//     res.status(200).json({
//       verificationRequired: true,
//       message: 'OTP sent to your email for verification.',
//       email: user.email,
//     });

//     // 📩 Then send email in background (non-blocking)
//     sendEmail(
//       user.email,
//       'Edukaster Email Verification',
//       `Welcome to Edukaster!\nYour verification code is ${otp}\n\nIt expires in 5 minutes.`
//     )
//       .then(() => console.log(`✅ Email sent to ${user.email}`))
//       .catch((err) => console.error(`❌ Failed to send email:`, err.message));
//   } catch (error) {
//     console.error('❌ Register user error:', error);
//     res.status(500).json({ message: error.message });
//   }
// };

// const registerUser = async (req, res) => {
//   try {
//     // const { email, password, name, role } = req.body;
//     const {
//       email,
//       password,
//       name,
//       username,
//       role,
//       institutionType,
//       institution,
//     } = req.body;

//     // console.log(req.body);
//     // Validate mandatory fields
//     if (!email || !password || !name || !username || !role) {
//       return res
//         .status(400)
//         .json({ message: 'Please fill all required fields.' });
//     }

//     // Check if user exists
//     // const existingUser = await User.findOne({ email });
//     // if (existingUser) {
//     //   return res.status(400).json({ message: 'User already exists' });
//     // }
//     const existingUser = await User.findOne({
//       $or: [{ email }, { username }],
//     });
//     if (existingUser) {
//       return res
//         .status(400)
//         .json({ message: 'Email or username already exists.' });
//     }

//     // Create user
//     const user = new User({
//       email,
//       password,
//       name,
//       username,
//       role,
//       institutionType: institutionType || null,
//       institution: institution || '',
//       isVerified: false,
//     });
//     // const userData = {
//     //   email,
//     //   password,
//     //   name,
//     //   username,
//     //   role,
//     //   isVerified: false
//     // };

//     // // Only students should have institution details
//     // if (role === 'student') {
//     //   userData.institutionType = institutionType || null;
//     //   userData.institution = institution || '';
//     // }

//     // const user = new User(userData);

//     // Generate Otp
//     const otp = Math.floor(100000 + Math.random() * 900000).toString();
//     const otpExpires = Date.now() + 5 * 60 * 1000; // 5 minutes from now

//     user.twoFactorEmailOTP = otp;
//     user.twoFactorEmailExpires = otpExpires;
//     await user.save();

//     await sendEmail(
//       user.email,
//       'Edukaster Email Verification',
//       `Welcome to Edukaster!\nYour verification code is ${otp}\n\nIt expires in 5 minutes.`
//     );

//     res.status(200).json({
//       verificationRequired: true,
//       message: 'OTP sent to your email for verification.',
//       email: user.email,
//     });
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };

// Verify registration email otp and complete registration
// const verifyEmail = async (req, res) => {
//   try {
//     const { email, otp } = req.body;

//     const user = await User.findOne({ email });
//     if (!user) {
//       return res.status(404).json({ message: 'User not found' });
//     }

//     if (!user.twoFactorEmailOTP || Date.now() > user.twoFactorEmailExpires) {
//       return res.status(400).json({ message: 'OTP expired or not found.' });
//     }

//     if (user.twoFactorEmailOTP !== otp) {
//       return res.status(400).json({ message: 'Invalid OTP' });
//     }

//     // Clear OTP fields
//     user.isVerified = true;
//     user.twoFactorEmailOTP = null;
//     user.twoFactorEmailExpires = null;

//     // Tutor approval logic
//     if (user.role === 'tutor') {
//       user.isApproved = false; // Tutors need admin approval
//       await sendEmail(
//         user.email,
//         'Tutor Registration Pending Approval',
//         'Your registration as a tutor is pending approval. Contact support for approval.'
//       );
//     }

//     // Paystack customer creation for students
//     if (user.role === 'student') {
//       try {
//         const customerData = await paystackService.createCustomer({
//           email: user.email,
//           firstName: user.name.split(' ')[0],
//           lastName: user.name.split(' ').slice(1).join(' '),
//         });

//         user.paystackCustomerCode = customerData.data.customer_code;
//         await user.save();
//       } catch (error) {
//         console.error('Paystack customer creation failed:', error.message);
//       }
//     }

//     // Save user updates
//     await user.save();

//     // ✅ Generate tokens using model method
//     const { accessToken, refreshToken } = await user.generateAuthToken();

//     res.status(200).json({
//       message: '2FA login successful',
//       user: formatUser(user),
//       accessToken,
//       refreshToken,
//     });
//   } catch (error) {
//     res.status(500).json({ message: error.message || 'Server error' });
//   }
// };

const verifyEmail = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const tempUser = tempUsers.get(email);

    if (!tempUser) {
      return res
        .status(400)
        .json({ message: 'No pending registration found or OTP expired.' });
    }

    if (Date.now() > tempUser.otpExpires) {
      tempUsers.delete(email);
      return res
        .status(400)
        .json({ message: 'OTP expired. Please register again.' });
    }

    if (otp !== tempUser.otp) {
      return res
        .status(400)
        .json({ message: 'Invalid OTP. Please try again.' });
    }

    // Create user in MongoDB
    const user = new User({
      email: tempUser.email,
      password: tempUser.password,
      name: tempUser.name,
      username: tempUser.username,
      role: tempUser.role,
      institutionType: tempUser.institutionType,
      institution: tempUser.institution,
      isVerified: true,
    });

    // Tutor approval or Paystack creation
    if (user.role === 'tutor') {
      user.isApproved = false;

      const html = `
  <div style="font-family: Arial, sans-serif; padding: 20px;">
    <div style="max-width: 500px; margin: auto; background: #0B0447; padding: 25px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
      
      <div style="text-align: center; margin-bottom: 20px;">
        <img src="cid:edukaster-logo" alt="Edukaster Logo" style="width: 180px;" />
      </div>

      <h2 style="color: #f6f6f6; text-align: center;">Tutor Registration Pending</h2>
      
      <p style="font-size: 15px; color: #f6f6f6; line-height: 1.5;">
        Hello 👋,
        <br/><br/>
        Thank you for registering as a tutor on <strong>Edukaster</strong>.
      </p>

      <p style="font-size: 15px; color: #f6f6f6; line-height: 1.5;">
        Your account is currently <strong>pending approval</strong>. Our review team is verifying your details.
      </p>

      <p style="font-size: 15px; color: #f6f6f6; line-height: 1.5;">
        You will receive another email once your tutor account is approved.
      </p>

      <p style="margin-top: 25px; font-size: 13px; color: #f6f6f6; text-align: center;">
        © ${new Date().getFullYear()} Edukaster. All rights reserved.
      </p>

    </div>
  </div>
`;
      try {
        await sendEmail(
          user.email,
          'Tutor Registration Pending Approval',
          html
        );
      } catch (mailErr) {
        return res.status(500).json({
          message:
            'Registration successful, but failed to send approval email. Contact support.',
          error: mailErr.message,
        });
      }
    }

    if (user.role === 'student') {
      try {
        const customerData = await paystackService.createCustomer({
          email: user.email,
          firstName: user.name.split(' ')[0],
          lastName: user.name.split(' ').slice(1).join(' '),
        });
        user.paystackCustomerCode = customerData.data.customer_code;
      } catch (error) {
        console.error('Paystack creation failed:', error.message);
      }
    }

    await user.save();
    tempUsers.delete(email); // Clean up

    const { accessToken, refreshToken } = await user.generateAuthToken();

    res.status(200).json({
      message: 'Email verified successfully. Registration complete.',
      user: formatUser(user),
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error('❌ Verify email error:', error);
    res.status(500).json({ message: error.message });
  }
};

const registerUser = async (req, res) => {
  try {
    const {
      email,
      password,
      name,
      username,
      role,
      institutionType,
      institution,
    } = req.body;

    if (!email || !password || !name || !username || !role) {
      return res
        .status(400)
        .json({ message: 'Please fill all required fields.' });
    }

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: 'Email or username already exists.' });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = Date.now() + 5 * 60 * 1000; // 5 mins

    // Store temp user data in memory (for 10 minutes)
    tempUsers.set(email, {
      email,
      password,
      name,
      username,
      role,
      institutionType: institutionType || null,
      institution: institution || '',
      otp,
      otpExpires,
    });

    // Auto-expire after 5 minutes
    setTimeout(() => tempUsers.delete(email), 19 * 60 * 1000);

    // Send OTP via email

    const html = `
  <div style="font-family: Arial, sans-serif; padding: 20px;">
    <div style="max-width: 500px; margin: auto; background: #0B0447; padding: 25px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
      
      <div style="text-align: center; margin-bottom: 20px;">
        <img src="cid:edukaster-logo" alt="Edukaster Logo" style="width: 180px;" />
      </div>

      <h2 style="color: #f6f6f6; text-align: center;">Verify Your Email</h2>
      
      <p style="font-size: 15px; color: #f6f6f6;">
        Welcome to <strong>Edukaster</strong> 🎓  
        We're excited to have you on board!
      </p>

      <p style="font-size: 15px; color: #f6f6f6;">
        Your verification code is:
      </p>

      <div style="text-align: center; margin: 25px 0;">
        <div style="display: inline-block; background: #ff7a00; color: white; padding: 12px 25px; font-size: 22px; border-radius: 6px; letter-spacing: 3px;">
          <strong>${otp}</strong>
        </div>
      </div>

      <p style="font-size: 14px; color: #f6f6f6;">
        This code will expire in <strong>5 minutes</strong>.
      </p>

      <p style="margin-top: 25px; font-size: 13px; color: #f6f6f6; text-align: center;">
        © ${new Date().getFullYear()} Edukaster. All rights reserved.
      </p>
    </div>
  </div>
`;

    try {
      await sendEmail(email, 'Edukaster Email Verification', html);
      // console.log(`✅ Verification email sent to ${email}`);
    } catch (mailErr) {
      // console.error('❌ Failed to send email:', mailErr.message);
      return res.status(500).json({
        message: 'Failed to send verification email. Please try again later.',
        error: mailErr.message,
      });
    }

    // sendEmail(email, 'Edukaster Email Verification', html)
    //   .then(() => console.log(`✅ Verification email sent to ${email}`))
    //   .catch((err) => console.error('❌ Failed to send email:', err.message));

    res.status(200).json({
      verificationRequired: true,
      message: 'OTP sent to your email for verification.',
      email,
    });
  } catch (error) {
    console.error('❌ Register user error:', error);
    res.status(500).json({ message: error.message });
  }
};

const loginUser = async (req, res) => {
  try {
    // console.log(req.body);
    const { email, password } = req.body;
    // 🧠 Verify credentials
    const user = await User.findByCredentials(email, password);
    // console.log(user);
    if (!user) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(401).json({ message: 'Account is suspended' });
    }

    //Check if 2FA is enabled
    if (user.twoFactorEnabled) {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpExpires = Date.now() + 5 * 60 * 1000; // 5 minutes from now

      user.twoFactorEmailOTP = otp;
      user.twoFactorEmailExpires = otpExpires;
      await user.save();

      // Send OTP email
      try {
        const html = `
  <div style="font-family: Arial, sans-serif; background: #0B0447; padding:20px;">
    <div style="max-width:520px; margin:20px auto; background: ; border-radius:10px; padding:26px; box-shadow:0 6px 18px rgba(0,0,0,0.08);">
      
      <div style="text-align:center; margin-bottom:18px;">
        <img src="cid:edukaster-logo" alt="Edukaster" style="width:140px; max-width:60%;" />
      </div>

      <h2 style="color: #ffffff; text-align:center; margin:6px 0 12px;">Edukaster 2FA Verification</h2>

      <p style="font-size:15px; color: #ffffff; text-align:center; line-height:1.6; margin:0 0 18px;">
        Use the verification code below to complete your login.
      </p>

      <div style="text-align:center; margin:20px 0;">
        <div style="
          display:inline-block;
          background: #ff7a00;
          padding:12px 28px;
          border-radius:8px;
          font-weight:700;
          font-size:28px;
          letter-spacing:6px;
          color: #ffffff;
        ">
          ${otp}
        </div>
      </div>

      <p style="font-size:14px; color: #ffffff; text-align:center; margin:10px 0 0;">
        This code will expire in <strong>5 minutes</strong>. If you didn't request this, please ignore this email.
      </p>

      <p style="font-size:13px; color: #ffffff; text-align:center; margin:22px 0 0;">
        © ${new Date().getFullYear()} Edukaster. All rights reserved.
      </p>
    </div>
  </div>
`;
        await sendEmail(user.email, 'Edukaster 2FA Verification', html);
      } catch (mailErr) {
        console.error('2FA Email Error:', mailErr.message);
        // 🟡 Stop here — don't issue tokens yet
        return res.status(200).json({
          // twoFAEnabled: true,
          message:
            '2FA is enabled, but email could not be sent. Fix SMTP first.',
          error: mailErr.message,
        });
      }

      return res.status(200).json({
        twoFAEnabled: true,
        message: '2FA is enabled. Please check your email for the OTP code.',
      });
    }

    // ✅ If 2FA not enabled, issue tokens immediately
    // ✅ Generate tokens using model method
    const { accessToken, refreshToken } = await user.generateAuthToken();

    res.status(200).json({
      message: 'User logged in successfully',
      user: formatUser(user),
      accessToken,
      refreshToken,
    });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Login failed' });
  }
};

// background: #0B0447

// verify 2fa login
const verifyTwoFactorLogin = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (
      user.twoFactorEmailOTP !== otp ||
      Date.now() > user.twoFactorEmailExpires
    ) {
      return res.status(400).json({ message: 'Invalid OTP', failed });
    }

    // Clear OTP fields
    user.twoFactorEmailOTP = null;
    user.twoFactorEmailExpires = null;
    await user.save();

    // ✅ Generate tokens using model method
    const { accessToken, refreshToken } = await user.generateAuthToken();

    res.status(200).json({
      message: '2FA login successful',
      user: formatUser(user),
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error('2FA Verify Login Error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
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

// enable 2fa via email otp
const enableTwoFactorEmail = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = Date.now() + 5 * 60 * 1000; // 5 minutes from now

    user.twoFactorEmailOTP = otp;
    user.twoFactorEmailExpires = otpExpires;
    await user.save();

    // Send OTP email

    const html = `
<div style="font-family: Arial, sans-serif; padding:20px;">
  <div style="max-width:500px; margin:auto; background: #0B0447; border-radius:10px; padding:30px; box-shadow:0 4px 12px rgba(0,0,0,0.1);">

    <div style="text-align:center; ">
      <img src="cid:edukaster-logo" alt="Edukaster Logo" style="width:120px; margin-bottom:20px;" />
    </div>

    <h2 style="color: #f7f7f7; text-align:center; margin-bottom:10px;">
      Edukaster 2FA Verification
    </h2>

    <p style="font-size:15px; color: #f7f7f7; text-align:center; line-height:1.6;">
      Use the verification code below to enable 2FA.
    </p>

    <div style="text-align:center; margin:25px 0;">
      <div style="
        display:inline-block;
        font-size:32px;
        letter-spacing:8px;
        font-weight:bold;
        color: #f7f7f7;
        background: #ED7B00;
        padding:12px 25px;
        border-radius:8px;
      ">
        ${otp}
      </div>
    </div>

    <p style="font-size:14px; color: #f7f7f7; line-height:1.6;">
      This OTP will expire in <strong>5 minutes</strong>.  
      If you did not request this code, please ignore this email.
    </p>

    <p style="font-size:13px; color: #f7f7f7; text-align:center; margin-top:30px;">
      © ${new Date().getFullYear()} Edukaster. All rights reserved.
    </p>
  </div>
</div>
`;

    try {
      await sendEmail(user.email, 'Edukaster 2FA Verification', html);
    } catch (mailErr) {
      return res.status(500).json({
        message: 'Failed to send 2FA OTP email. Please try again later.',
        error: mailErr.message,
      });
    }

    res.status(200).json({ message: 'OTP sent to email' });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// verify 2fa via email otp
const verifyTwoFactorEmail = async (req, res) => {
  try {
    const userId = req.user._id;
    const { otp } = req.body;
    console.log(otp);

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (
      !user.twoFactorEmailOTP ||
      user.twoFactorEmailOTP !== otp ||
      Date.now() > user.twoFactorEmailExpires
    ) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    user.twoFactorEnabled = true;
    user.twoFAEnabled = true;
    user.twoFactorEmailOTP = null;
    user.twoFactorEmailExpires = null;
    await user.save();

    res.status(200).json({ message: '2FA enabled successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// disable 2fa via email otp
const disableTwoFactorEmail = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.twoFactorEnabled = false;
    user.twoFAEnabled = false;
    user.twoFactorEmailOTP = null;
    user.twoFactorEmailExpires = null;
    await user.save();

    res.status(200).json({ message: '2FA disabled successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Server error' });
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

// Delete user account (self)
const deleteAccount = async (req, res) => {
  try {
    const userId = req.user._id;

    // Optional: prevent admin self-delete (your choice)
    // if (req.user.role === 'admin') {
    //   return res.status(403).json({ message: 'Admins cannot delete their account.' });
    // }

    // Delete user
    await User.findByIdAndDelete(userId);

    return res.status(200).json({
      message: 'Account deleted successfully',
    });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      message: error.message || 'Failed to delete account',
    });
  }
};

// Save Push Notification Token
const savePushToken = async (req, res) => {
  try {
    const userId = req.user._id;
    const { pushToken } = req.body;
    if (!pushToken) {
      return res.status(400).json({ message: 'Push token is required' });
    }
    const user = await User.findByIdAndUpdate(
      userId,
      { pushToken },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({ message: 'Push token saved successfully' });
  } catch (error) {
    console.error('Save push token error:', error);
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
  enableTwoFactorEmail,
  verifyTwoFactorEmail,
  disableTwoFactorEmail,
  verifyTwoFactorLogin,
  verifyEmail,
  savePushToken,
  deleteAccount,
};
