const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Booking = require('../models/booking');
const User = require('../models/user');
const Wallet = require('../models/wallet');
const Session = require('../models/session');
const { isOverlap, buildSlotsForDate } = require('../utils/bookingUtils');
const paystackService = require('../services/paystackService');
const NotificationService = require('../services/notificationService');
// const fs = require('fs');
// const path = require('path');
const { computeShares } = require('../utils/payment');
const { sendEmail } = require('../utils/email');
const { sendPushNotification } = require('../services/pushService');
// const fs = require('fs');
// const path = require('path');

const getTutorAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    const tutor = await User.findById(id);

    if (!tutor) return res.status(404).json({ message: 'Tutor not found' });

    // return availability for the next N days (say 7)
    const days = 7;
    const result = [];

    for (let i = 0; i < days; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const dayName = d.toLocaleString('en-US', { weekday: 'long' });
      const availItem = (tutor.availability || []).find(
        (a) => a.day.toLowerCase() === dayName.toLowerCase() && a.active,
      );
      if (!availItem) continue;

      // generate potential slots
      const slots = buildSlotsForDate(availItem, d, 60); // 1h sessions

      // fetch bookings that day for tutor
      const dayStart = new Date(d);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(d);
      dayEnd.setHours(23, 59, 59, 999);

      const bookingsThatDay = await Booking.find({
        tutorId: tutor._id,
        scheduledDate: { $gte: dayStart, $lte: dayEnd },
        status: { $in: ['pending', 'confirmed'] },
      });

      // filter out slots that overlap existing bookings
      const freeSlots = slots.filter((slot) => {
        return !bookingsThatDay.some((b) => {
          const bStart = new Date(b.scheduledDate);
          const bEnd = new Date(bStart.getTime() + b.duration * 60000);
          return isOverlap(slot.start, slot.end, bStart, bEnd);
        });
      });

      if (freeSlots.length) {
        result.push({
          date: d.toISOString(),
          dayName,
          slots: freeSlots.map((s) => ({
            start: s.start.toISOString(),
            end: s.end.toISOString(),
          })),
        });
      }
    }

    res.json({ tutorId: tutor._id, availability: result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// const bookTutor = async (req, res) => {
//   try {
//     const studentId = req.user._id;

//     const {
//       tutorId,
//       courseTitle,
//       scheduledDate,
//       sessionType = '1on1',
//       duration = 60,
//       paymentMethod = 'wallet',
//       redirectUrl,
//     } = req.body;

//     if (!tutorId || !scheduledDate || !courseTitle) {
//       return res.status(400).json({ message: 'Missing required fields' });
//     }

//     const tutor = await User.findById(tutorId);
//     if (!tutor || tutor.role !== 'tutor') {
//       return res.status(404).json({ message: 'Tutor not found' });
//     }

//     const amount =
//       tutor.fees?.totalFee ||
//       (tutor.fees?.tutorFee || 0) + (tutor.fees?.adminFee || 0);

//     if (!amount || amount <= 0) {
//       return res.status(400).json({ message: 'Invalid tutor fee' });
//     }

//     // 💳 Wallet Payment (instant)
//     if (paymentMethod === 'wallet') {
//       const student = await User.findById(studentId);

//       if (!student || student.walletBalance < amount) {
//         return res.status(402).json({ message: 'Insufficient wallet balance' });
//       }

//       const requestedStart = new Date(scheduledDate);
//       const requestedEnd = new Date(
//         requestedStart.getTime() + duration * 60000,
//       );

//       // Check overlapping bookings
//       const bookingsThatDay = await Booking.find({
//         tutorId,
//         status: { $in: ['pending', 'confirmed'] },
//       });

//       const collides = bookingsThatDay.some((b) => {
//         const bStart = new Date(b.scheduledDate);
//         const bEnd = new Date(bStart.getTime() + b.duration * 60000);
//         return requestedStart < bEnd && requestedEnd > bStart;
//       });

//       if (collides) {
//         return res
//           .status(400)
//           .json({ message: 'Requested slot already booked' });
//       }

//       // Deduct wallet
//       const balanceBefore = student.walletBalance;
//       student.walletBalance -= amount;
//       await student.save();

//       const booking = await Booking.create({
//         studentId,
//         tutorId,
//         courseTitle,
//         scheduledDate: requestedStart,
//         duration,
//         amount,
//         sessionType,
//         paymentMethod: 'wallet',
//         status: 'confirmed',
//         paymentStatus: 'paid',
//         attachment,
//       });

//       // Wallet transaction
//       await Wallet.create({
//         userId: student._id,
//         type: 'debit',
//         amount,
//         description: `Booking with tutor ${tutor.name} for ${courseTitle}`,
//         category: 'booking',
//         balanceBefore,
//         balanceAfter: student.walletBalance,
//       });

//       // Create session
//       const { tutorShare, adminShare } = computeShares(amount, tutor);
//       await Session.create({
//         bookingId: booking._id,
//         tutorId,
//         studentId,
//         scheduledDate: requestedStart,
//         duration,
//         amount,
//         tutorShare,
//         adminShare,
//         status: 'scheduled',
//       });

//       return res.status(200).json({
//         success: true,
//         message: 'Booking confirmed via wallet',
//         booking,
//         walletBalance: student.walletBalance,
//       });
//     }

//     // 💳 Paystack Payment (deferred booking)
//     if (paymentMethod === 'paystack') {
//       const reference = paystackService.generateReference();
//       const callbackUrl = `${process.env.BACKEND_URL}/bookings/verify/${reference}`;

//       const paymentData = await paystackService.initializeTransaction({
//         email: req.user.email,
//         amount,
//         reference,
//         callback_url: callbackUrl,
//         metadata: {
//           studentId,
//           tutorId,
//           courseTitle,
//           scheduledDate,
//           duration,
//           sessionType,
//           amount,
//           redirectUrl,
//         },
//       });

//       if (!paymentData.success) {
//         return res.status(400).json({ message: paymentData.message });
//       }

//       return res.status(200).json({
//         success: true,
//         message: 'Booking initialized. Complete payment via Paystack',
//         authorization_url: paymentData.data.data.authorization_url,
//         reference,
//       });
//     }

//     return res.status(400).json({ message: 'Invalid payment method' });
//   } catch (err) {
//     console.error('bookTutor error:', err);
//     res.status(500).json({ message: err.message });
//   }
// };

// bookTutor with file upload handling
const bookTutor = async (req, res) => {
  try {
    const studentId = req.user._id;

    // ✅ attachment MUST be inside the function
    // const uploadedFile = req.file
    //   ? {
    //       filename: req.file.filename,
    //       mimeType: req.file.mimetype,
    //       originalName: req.file.originalname,
    //       size: req.file.size,
    //     }
    //   : null;

    let uploadedFileData = null;

    if (req.file) {
      const uploadDir =
        process.env.NODE_ENV === 'production'
          ? '/tmp/bookings'
          : path.join(__dirname, '..', 'uploads', 'bookings');

      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const uniqueName = `${Date.now()}-${req.file.originalname}`;
      const filePath = path.join(uploadDir, uniqueName);

      fs.writeFileSync(filePath, req.file.buffer);

      uploadedFileData = {
        filename: uniqueName,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        url: `${req.protocol}://${req.get('host')}/bookings/file/${uniqueName}`,
      };
    }

    const {
      tutorId,
      courseTitle,
      scheduledDate,
      sessionType = '1on1',
      duration = 60,
      paymentMethod = 'wallet',
      redirectUrl,
    } = req.body;

    if (!tutorId || !scheduledDate || !courseTitle) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const tutor = await User.findById(tutorId);
    if (!tutor || tutor.role !== 'tutor') {
      return res.status(404).json({ message: 'Tutor not found' });
    }

    // 🔹 Handle English Proficiency Group Session
    // if (courseTitle === 'English Proficiency') {
    //   const GROUP_AMOUNT = 140000;
    //   // Check if a group session exists for this tutor
    //   let booking = await Booking.findOne({
    //     tutorId,
    //     courseTitle,
    //     sessionType: 'group',
    //     status: { $in: ['pending', 'confirmed'] },
    //   });

    //   if (!booking) {
    //     // Create a new group session
    //     booking = await Booking.create({
    //       tutorId,
    //       studentId,
    //       courseTitle,
    //       sessionType: 'group',
    //       groupStudents: [studentId],
    //       scheduledDate: new Date(scheduledDate),
    //       duration: 42 * 24 * 60, // 6 weeks in minutes
    //       amount: 140000,
    //       paymentStatus: 'pending',
    //       status: 'pending',
    //       uploadedFile: uploadedFileData,
    //     });
    //   }

    //   // Add student if not already enrolled
    //   if (booking.groupStudents.includes(studentId)) {
    //     return res
    //       .status(400)
    //       .json({ message: 'You have already joined this session' });
    //   }

    //   // booking.groupStudents.push(studentId);
    //   // await booking.save();

    //   if (!booking.groupStudents.includes(studentId)) {
    //     booking.groupStudents.push(studentId);
    //     booking.studentId = studentId; // ensure schema validation passes
    //     await booking.save();
    //   }

    //   // Handle payment for group session
    //   if (paymentMethod === 'wallet') {
    //     const student = await User.findById(studentId);
    //     if (!student || student.walletBalance < GROUP_AMOUNT) {
    //       return res
    //         .status(402)
    //         .json({ message: 'Insufficient wallet balance for group session' });
    //     }

    //     const balanceBefore = student.walletBalance;
    //     student.walletBalance -= GROUP_AMOUNT;
    //     await student.save();

    //     booking.groupStudents.push(studentId);
    //     booking.paymentStatus = 'paid';
    //     // booking.status = 'confirmed';
    //     await booking.save();

    //     await Wallet.create({
    //       userId: student._id,
    //       type: 'debit',
    //       amount: 140000,
    //       description: `Booking for English Proficiency with ${tutor.name}`,
    //       category: 'booking',
    //       balanceBefore: balanceBefore,
    //       balanceAfter: student.walletBalance,
    //     });

    //     return res.status(200).json({
    //       success: true,
    //       message: 'Joined English Proficiency session',
    //       booking,
    //       walletBalance: student.walletBalance,
    //     });
    //   }

    //   // For Paystack, you would implement similar logic as the individual booking, but ensure that the booking is created/updated with sessionType 'group' and handle payments accordingly.
    //   if (paymentMethod === 'paystack') {
    //     const reference = paystackService.generateReference();
    //     const callbackUrl = `${process.env.BACKEND_URL}/bookings/verify/${reference}`;

    //     const paymentData = await paystackService.initializeTransaction({
    //       email: req.user.email,
    //       amount: GROUP_AMOUNT,
    //       reference,
    //       callback_url: callbackUrl,
    //       metadata: {
    //         studentId,
    //         tutorId,
    //         courseTitle,
    //         scheduledDate,
    //         duration: 42 * 24 * 60,
    //         sessionType: 'group',
    //         amount: GROUP_AMOUNT,
    //         redirectUrl,
    //         isEnglishGroup: true, // 🔥 important flag
    //         uploadedFile: uploadedFileData,
    //       },
    //     });

    //     if (!paymentData.success) {
    //       return res.status(400).json({ message: paymentData.message });
    //     }

    //     return res.status(200).json({
    //       success: true,
    //       message: 'Complete payment to join English Proficiency session',
    //       authorization_url: paymentData.data.data.authorization_url,
    //       reference,
    //     });
    //   }

    //   return res.status(400).json({ message: 'Invalid payment method' });
    // }

    // 🔹 Handle English Proficiency Group Session
    if (courseTitle === 'English Proficiency') {
      const GROUP_AMOUNT = 140000;

      // 1️⃣ Find existing active group for THIS tutor
      let booking = await Booking.findOne({
        tutorId,
        courseTitle,
        sessionType: 'group',
        status: { $in: ['pending', 'confirmed'] },
      });

      // 2️⃣ If group doesn't exist → create empty group
      if (!booking) {
        booking = await Booking.create({
          tutorId,
          studentId, // required by schema
          courseTitle,
          sessionType: 'group',
          groupStudents: [],
          scheduledDate: new Date(scheduledDate),
          duration: 42 * 24 * 60, // 6 weeks
          amount: GROUP_AMOUNT,
          paymentStatus: 'pending',
          status: 'pending',
          uploadedFile: uploadedFileData,
        });
      }

      // 3️⃣ Check if student already joined THIS tutor's group
      const alreadyJoined = booking.groupStudents.some(
        (id) => id.toString() === studentId.toString(),
      );

      if (alreadyJoined) {
        return res.status(400).json({
          message: 'You have already joined this session',
        });
      }

      // ================= WALLET PAYMENT =================
      if (paymentMethod === 'wallet') {
        const student = await User.findById(studentId);

        if (!student || student.walletBalance < GROUP_AMOUNT) {
          return res.status(402).json({
            message: 'Insufficient wallet balance for group session',
          });
        }

        const balanceBefore = student.walletBalance;

        // Deduct wallet first
        student.walletBalance -= GROUP_AMOUNT;
        await student.save();

        // Add student safely (no duplicates)
        await Booking.updateOne(
          { _id: booking._id },
          { $addToSet: { groupStudents: studentId } },
        );

        booking.paymentStatus = 'paid';
        await booking.save();

        await Wallet.create({
          userId: student._id,
          type: 'debit',
          amount: GROUP_AMOUNT,
          description: `English Proficiency with ${tutor.name}`,
          category: 'booking',
          balanceBefore,
          balanceAfter: student.walletBalance,
        });

        return res.status(200).json({
          success: true,
          message: 'Successfully joined English Proficiency session',
          booking,
          walletBalance: student.walletBalance,
        });
      }

      // ================= PAYSTACK PAYMENT =================
      if (paymentMethod === 'paystack') {
        const reference = paystackService.generateReference();
        const callbackUrl = `${process.env.BACKEND_URL}/bookings/verify/${reference}`;

        const paymentData = await paystackService.initializeTransaction({
          email: req.user.email,
          amount: GROUP_AMOUNT,
          reference,
          callback_url: callbackUrl,
          metadata: {
            studentId,
            tutorId,
            courseTitle,
            scheduledDate,
            duration: 42 * 24 * 60,
            sessionType: 'group',
            amount: GROUP_AMOUNT,
            redirectUrl,
            isEnglishGroup: true,
            uploadedFile: uploadedFileData,
          },
        });

        if (!paymentData.success) {
          return res.status(400).json({ message: paymentData.message });
        }

        return res.status(200).json({
          success: true,
          message: 'Complete payment to join English Proficiency session',
          authorization_url: paymentData.data.data.authorization_url,
          reference,
        });
      }

      return res.status(400).json({ message: 'Invalid payment method' });
    }

    const amount =
      tutor.fees?.totalFee ||
      (tutor.fees?.tutorFee || 0) + (tutor.fees?.adminFee || 0);

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid tutor fee' });
    }

    const requestedStart = new Date(scheduledDate);
    const requestedEnd = new Date(requestedStart.getTime() + duration * 60000);

    const bookingsThatDay = await Booking.find({
      tutorId,
      status: { $in: ['pending', 'approved'] },
    });

    const collides = bookingsThatDay.some((b) => {
      const bStart = new Date(b.scheduledDate);
      const bEnd = new Date(bStart.getTime() + b.duration * 60000);
      return requestedStart < bEnd && requestedEnd > bStart;
    });

    if (collides) {
      return res.status(400).json({ message: 'Requested slot already booked' });
    }

    // ================= WALLET PAYMENT =================
    if (paymentMethod === 'wallet') {
      const student = await User.findById(studentId);

      if (!student || student.walletBalance < amount) {
        return res.status(402).json({ message: 'Insufficient wallet balance' });
      }

      const balanceBefore = student.walletBalance;
      student.walletBalance -= amount;
      await student.save();

      const booking = await Booking.create({
        studentId,
        tutorId,
        courseTitle,
        scheduledDate: requestedStart,
        duration,
        amount,
        sessionType,
        paymentMethod: 'wallet',
        status: 'pending', // 🔒 admin must approve
        paymentStatus: 'paid',
        uploadedFile: uploadedFileData,
      });

      await Wallet.create({
        userId: student._id,
        type: 'debit',
        amount,
        description: `Booking with tutor ${tutor.name} for ${courseTitle}`,
        category: 'booking',
        balanceBefore,
        balanceAfter: student.walletBalance,
      });

      return res.status(200).json({
        success: true,
        message: 'Booking created. Awaiting admin approval',
        booking,
        walletBalance: student.walletBalance,
      });
    }

    // ================= PAYSTACK PAYMENT =================
    if (paymentMethod === 'paystack') {
      const reference = paystackService.generateReference();
      const callbackUrl = `${process.env.BACKEND_URL}/bookings/verify/${reference}`;

      const paymentData = await paystackService.initializeTransaction({
        email: req.user.email,
        amount,
        reference,
        callback_url: callbackUrl,
        metadata: {
          studentId,
          tutorId,
          courseTitle,
          scheduledDate,
          duration,
          sessionType,
          amount,
          redirectUrl,
          uploadedFile: uploadedFileData, // ✅ preserve file info
        },
      });

      if (!paymentData.success) {
        return res.status(400).json({ message: paymentData.message });
      }

      return res.status(200).json({
        success: true,
        message: 'Complete payment to finish booking',
        authorization_url: paymentData.data.data.authorization_url,
        reference,
      });
    }

    return res.status(400).json({ message: 'Invalid payment method' });
  } catch (err) {
    console.error('bookTutor error:', err);
    res.status(500).json({ message: err.message });
  }
};

// const verifyBookingPayment = async (req, res) => {
//   try {
//     const { reference } = req.params;

//     const verification = await paystackService.verifyTransaction(reference);
//     if (
//       !verification.success ||
//       !verification.data?.data ||
//       verification.data.data.status !== 'success'
//     ) {
//       const redirectFail =
//         verification?.data?.data?.metadata?.redirectUrl || '/';
//       return res.redirect(`${redirectFail}?status=failed`);
//     }

//     const meta = verification.data.data.metadata;
//     const {
//       studentId,
//       tutorId,
//       courseTitle,
//       scheduledDate,
//       duration,
//       sessionType,
//       amount,
//       redirectUrl,
//     } = meta;

//     // Create booking only after successful payment
//     const requestedStart = new Date(scheduledDate);

//     const booking = await Booking.create({
//       studentId,
//       tutorId,
//       courseTitle,
//       scheduledDate: requestedStart,
//       duration,
//       sessionType,
//       amount,
//       paymentMethod: 'paystack',
//       status: 'confirmed',
//       paymentStatus: 'paid',
//       paystackReference: reference,
//     });

//     // Create session
//     const tutor = await User.findById(tutorId);
//     const { tutorShare, adminShare } = computeShares(amount, tutor);
//     await Session.create({
//       bookingId: booking._id,
//       tutorId,
//       studentId,
//       scheduledDate: requestedStart,
//       duration,
//       amount,
//       tutorShare,
//       adminShare,
//       status: 'scheduled',
//     });

//     // Optional: wallet transaction record
//     await Wallet.create({
//       userId: studentId,
//       type: 'debit',
//       amount,
//       description: `Booking payment for tutor ${tutor?.name}`,
//       category: 'booking',
//       balanceBefore: 0,
//       balanceAfter: 0,
//       paymentMethod: 'paystack',
//     });

//     // ✅ Redirect back to mobile/web app
//     const redirect = `${redirectUrl}?status=success&amount=${amount}&reference=${reference}`;
//     console.log('Redirecting to:', redirect);
//     return res.redirect(redirect);
//   } catch (err) {
//     console.error('verifyBookingPayment error:', err);
//     return res.status(500).send('Payment verification failed');
//   }
// };

// verfy with file upload handling
const verifyBookingPayment = async (req, res) => {
  try {
    const { reference } = req.params;

    const verification = await paystackService.verifyTransaction(reference);

    if (
      !verification.success ||
      !verification.data?.data ||
      verification.data.data.status !== 'success'
    ) {
      const redirectFail =
        verification?.data?.data?.metadata?.redirectUrl || '/';
      return res.redirect(`${redirectFail}?status=failed`);
    }

    const meta = verification.data.data.metadata;

    const {
      studentId,
      tutorId,
      courseTitle,
      scheduledDate,
      duration,
      sessionType,
      amount,
      redirectUrl,
      uploadedFile, // ✅ restored correctly
      isEnglishGroup,
    } = meta;

    // ================= ENGLISH PROFICIENCY GROUP =================
    // if (isEnglishGroup) {
    //   let booking = await Booking.findOne({
    //     tutorId,
    //     courseTitle,
    //     sessionType: 'group',
    //     status: { $in: ['pending', 'confirmed'] },
    //   });

    //   if (!booking) {
    //     booking = await Booking.create({
    //       tutorId,
    //       courseTitle,
    //       sessionType: 'group',
    //       groupStudents: [],
    //       scheduledDate: new Date(scheduledDate),
    //       duration,
    //       amount,
    //       paymentMethod: 'paystack',
    //       paymentStatus: 'paid',
    //       status: 'pending',
    //       paystackReference: reference,
    //     });
    //   }

    //   if (!booking.groupStudents.includes(studentId)) {
    //     booking.groupStudents.push(studentId);
    //   }

    //   booking.paymentStatus = 'paid';
    //   await booking.save();

    //   await Wallet.create({
    //     userId: studentId,
    //     type: 'debit',
    //     amount,
    //     description: `English Proficiency group payment`,
    //     category: 'booking',
    //     balanceBefore: 0,
    //     balanceAfter: 0,
    //     paymentMethod: 'paystack',
    //   });

    //   const redirect = `${redirectUrl}?status=success&amount=${amount}&reference=${reference}`;
    //   return res.redirect(redirect);
    // }

    if (isEnglishGroup) {
      const GROUP_AMOUNT = amount;

      let booking = await Booking.findOne({
        tutorId,
        courseTitle,
        sessionType: 'group',
        status: { $in: ['pending', 'confirmed'] },
      });

      if (!booking) {
        booking = await Booking.create({
          tutorId,
          studentId,
          courseTitle,
          sessionType: 'group',
          groupStudents: [],
          scheduledDate: new Date(scheduledDate),
          duration,
          amount: GROUP_AMOUNT,
          paymentMethod: 'paystack',
          paymentStatus: 'paid',
          status: 'pending',
          paystackReference: reference,
        });
      }

      // Prevent duplicates
      await Booking.updateOne(
        { _id: booking._id },
        { $addToSet: { groupStudents: studentId } },
      );

      booking.paymentStatus = 'paid';
      await booking.save();

      await Wallet.create({
        userId: studentId,
        type: 'debit',
        amount: GROUP_AMOUNT,
        description: `English Proficiency group payment`,
        category: 'booking',
        balanceBefore: 0,
        balanceAfter: 0,
        paymentMethod: 'paystack',
      });

      const redirect = `${redirectUrl}?status=success&amount=${GROUP_AMOUNT}&reference=${reference}`;
      return res.redirect(redirect);
    }

    // 1 on 1
    const requestedStart = new Date(scheduledDate);

    const booking = await Booking.create({
      studentId,
      tutorId,
      courseTitle,
      scheduledDate: requestedStart,
      duration,
      sessionType,
      amount,
      paymentMethod: 'paystack',
      status: 'pending', // 🔒 admin approval required
      paymentStatus: 'paid',
      paystackReference: reference,
      uploadedFile,
    });

    const tutor = await User.findById(tutorId);
    const { tutorShare, adminShare } = computeShares(amount, tutor);

    await Session.create({
      bookingId: booking._id,
      tutorId,
      studentId,
      scheduledDate: requestedStart,
      duration,
      amount,
      tutorShare,
      adminShare,
      status: 'scheduled',
    });

    await Wallet.create({
      userId: studentId,
      type: 'debit',
      amount,
      description: `Booking payment for tutor ${tutor?.name}`,
      category: 'booking',
      balanceBefore: 0,
      balanceAfter: 0,
      paymentMethod: 'paystack',
    });

    const redirect = `${redirectUrl}?status=success&amount=${amount}&reference=${reference}`;
    return res.redirect(redirect);
  } catch (err) {
    console.error('verifyBookingPayment error:', err);
    return res.status(500).send('Payment verification failed');
  }
};

// const getPendingBookings = async (req, res) => {
//   try {
//     const bookings = await Booking.find({
//       status: 'confirmed',
//       adminConfirmed: { $ne: true },
//     })
//       .populate('studentId', 'name email avatar')
//       .populate('tutorId', 'name email avatar')
//       .sort({ createdAt: -1 });

//     res.status(200).json({ success: true, count: bookings.length, bookings });
//   } catch (err) {
//     console.error('getPendingBookings error:', err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// };

const getPendingBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({
      status: 'pending',
      adminConfirmed: { $ne: true },
    })
      .populate('studentId', 'name email avatar')
      .populate('tutorId', 'name email avatar')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: bookings.length,
      bookings,
    });
  } catch (err) {
    console.error('getPendingBookings error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const getTutorBookings = async (req, res) => {
  try {
    const tutorId = req.user._id;

    // Fetch all confirmed, admin-approved bookings for this tutor
    const bookings = await Booking.find({
      tutorId,
      adminConfirmed: true,
      status: 'confirmed',
    })
      .populate('studentId', 'name email avatar')
      .sort({ scheduledDate: -1 });

    const formattedBookings = bookings.map((b) => {
      const student = b.studentId;

      let avatarBase64 = null;
      if (student?.avatar?.data && student?.avatar?.contentType) {
        // Convert Buffer to Base64
        avatarBase64 = `data:${
          student.avatar.contentType
        };base64,${student.avatar.data.toString('base64')}`;
      }

      return {
        _id: b._id,
        courseTitle: b.courseTitle,
        scheduledDate: b.scheduledDate,
        duration: b.duration,
        sessionType: b.sessionType,
        amount: b.amount,
        paymentStatus: b.paymentStatus,
        adminConfirmed: b.adminConfirmed,
        status: b.status,
        meetingLink: b.meetingLink,

        // 👇 FILE IS NOW VISIBLE TO TUTOR
        studentFile: b.uploadedFile
          ? {
              url: b.uploadedFile.url,
              originalName: b.uploadedFile.originalName,
              mimeType: b.uploadedFile.mimeType,
              size: b.uploadedFile.size,
            }
          : null,

        studentId: {
          _id: student._id,
          name: student.name,
          email: student.email,
          avatar: avatarBase64,
        },
      };
    });

    res.json({ success: true, bookings: formattedBookings });
    // console.log(formattedBookings);
  } catch (err) {
    console.error('getTutorBookings error:', err);
    res.status(500).json({ message: err.message });
  }
};

// const getBookingDetailsForStudent = async (req, res) => {
//   try {
//     const studentId = req.user._id;
//     const { bookingId } = req.params;

//     const booking = await Booking.findOne({
//       _id: bookingId,
//       studentId,
//     })
//       .populate('tutorId', 'name email avatar fees totalEarnings')
//       .populate('studentId', 'name email avatar');

//     if (!booking)
//       return res
//         .status(404)
//         .json({ message: 'Booking not found or unauthorized' });

//     const tutor = booking.tutorId;
//     const student = booking.studentId;

//     // ✅ Only show meeting link if approved by admin
//     const responseData = {
//       _id: booking._id,
//       courseTitle: booking.courseTitle,
//       scheduledDate: booking.scheduledDate,
//       duration: booking.duration,
//       amount: booking.amount,
//       sessionType: booking.sessionType,
//       paymentStatus: booking.paymentStatus,
//       status: booking.status,
//       reference: booking.reference,
//       adminConfirmed: booking.adminConfirmed,
//       meetingLink: booking.adminConfirmed ? booking.meetingLink : null,
//       createdAt: booking.createdAt,
//       updatedAt: booking.updatedAt,

//       tutor: {
//         _id: tutor._id,
//         name: tutor.name,
//         email: tutor.email,
//         avatar: tutor.avatar || null, // ✅ include tutor avatar
//         totalEarnings: tutor.totalEarnings || 0,
//       },
//       student: {
//         _id: student._id,
//         name: student.name,
//         email: student.email,
//         avatar: student.avatar || null, // ✅ include student avatar
//       },
//     };

//     res.json({ success: true, booking: responseData });
//   } catch (err) {
//     console.error('getBookingDetailsForStudent error:', err);
//     res.status(500).json({ message: err.message });
//   }
// };

// const getBookingDetailsForTutor = async (req, res) => {
//   try {
//     const tutorId = req.user._id;
//     const { bookingId } = req.params;
//     console.log('Logged in user:', req.user);
//     console.log('Requested bookingId:', req.params.bookingId);

//    const booking = await Booking.findOne({
//   _id: bookingId,
//   $or: [{ tutorId: req.user._id }, { studentId: req.user._id }],
// })
//       .populate('studentId', 'name email avatar')
//       .populate('tutorId', 'name email avatar fees totalEarnings');

//     if (!booking)
//       return res
//         .status(404)
//         .json({ message: 'Booking not found or unauthorized' });

//     const tutor = booking.tutorId;
//     const student = booking.studentId;

//     const responseData = {
//       _id: booking._id,
//       courseTitle: booking.courseTitle,
//       scheduledDate: booking.scheduledDate,
//       duration: booking.duration,
//       amount: booking.amount,
//       sessionType: booking.sessionType,
//       paymentStatus: booking.paymentStatus,
//       status: booking.status,
//       reference: booking.reference,
//       adminConfirmed: booking.adminConfirmed,
//       meetingLink: booking.adminConfirmed ? booking.meetingLink : null,
//       createdAt: booking.createdAt,
//       updatedAt: booking.updatedAt,

//       tutor: {
//         _id: tutor._id,
//         name: tutor.name,
//         email: tutor.email,
//         avatar: tutor.avatar || null, // ✅ include tutor avatar
//         totalEarnings: tutor.totalEarnings || 0,
//       },
//       student: {
//         _id: student._id,
//         name: student.name,
//         email: student.email,
//         avatar: student.avatar || null, // ✅ include student avatar
//       },
//     };

//     res.json({ success: true, booking: responseData });
//   } catch (err) {
//     console.error('getBookingDetailsForTutor error:', err);
//     res.status(500).json({ message: err.message });
//   }
// };

// const approveBooking = async (req, res) => {
//   try {
//     const { bookingId } = req.params;
//     const { meetingLink } = req.body;

//     const booking = await Booking.findById(bookingId);
//     if (!booking) return res.status(404).json({ message: 'Booking not found' });

//     // Mark admin confirmed
//     booking.adminConfirmed = true;
//     booking.meetingLink = meetingLink;
//     booking.status = 'confirmed';
//     await booking.save();

//     // Credit tutor
//     const tutor = await User.findById(booking.tutorId);
//     const tutorFee = tutor.fees?.tutorFee || 0;
//     tutor.totalEarnings = (tutor.totalEarnings || 0) + Number(tutorFee);
//     await tutor.save();

//     // Notify student
//     NotificationService.send({
//       userId: booking.studentId,
//       title: 'Booking Approved',
//       message: `Your session with ${tutor.firstName} is confirmed. Meeting link: ${meetingLink}`,
//     });

//     res.json({ message: 'Booking approved', booking });
//   } catch (err) {
//     console.error('approveBooking error:', err);
//     res.status(500).json({ message: err.message });
//   }
// };

//////////////////////AND

// const getBookingDetails = async (req, res) => {
//   try {
//     const userId = req.user._id;
//     const { bookingId } = req.params;

//     const booking = await Booking.findOne({
//       _id: bookingId,
//       $or: [{ tutorId: userId }, { studentId: userId }],
//     })
//       .populate('studentId', 'name email avatar about goal')
//       .populate('tutorId', 'name email avatar fees totalEarnings');

//     if (!booking) {
//       return res
//         .status(404)
//         .json({ message: 'Booking not found or unauthorized' });
//     }

//     // 🔹 Always allow confirmation if booking is confirmed but not completed
//     const canConfirmCompletion =
//       booking.status === 'confirmed' && !booking.completedAt;

//     const { tutorId: tutor, studentId: student } = booking;

//     const responseData = {
//       _id: booking._id,
//       courseTitle: booking.courseTitle,
//       scheduledDate: booking.scheduledDate,
//       duration: booking.duration,
//       amount: booking.amount,
//       sessionType: booking.sessionType,
//       paymentStatus: booking.paymentStatus,
//       status: booking.status,
//       reference: booking.reference,
//       adminConfirmed: booking.adminConfirmed,
//       meetingLink: booking.adminConfirmed ? booking.meetingLink : null,
//       createdAt: booking.createdAt,
//       updatedAt: booking.updatedAt,

//       // ✅ Always show confirm button if not completed
//       canConfirmCompletion,

//       tutor: {
//         _id: tutor._id,
//         name: tutor.name,
//         email: tutor.email,
//         avatar: tutor.avatar || null,
//         totalEarnings: tutor.totalEarnings || 0,
//       },
//       student: {
//         _id: student._id,
//         name: student.name,
//         email: student.email,
//         about: student.about,
//         goal: student.goal,
//         avatar:
//           student.avatar?.data && student.avatar?.contentType
//             ? `data:${
//                 student.avatar.contentType
//               };base64,${student.avatar.data.toString('base64')}`
//             : null,
//       },
//     };

//     res.json({ success: true, booking: responseData });
//   } catch (err) {
//     console.error('getBookingDetails error:', err);
//     res.status(500).json({ message: err.message });
//   }
// };

// const approveBooking = async (req, res) => {
//   try {
//     const { bookingId } = req.params;
//     const { meetingLink } = req.body;

//     const booking = await Booking.findById(bookingId);
//     if (!booking) return res.status(404).json({ message: 'Booking not found' });
//     if (booking.adminConfirmed)
//       return res.status(400).json({ message: 'Booking already approved' });

//     const tutor = await User.findById(booking.tutorId);
//     if (!tutor) return res.status(404).json({ message: 'Tutor not found' });

//     const student = await User.findById(booking.studentId);
//     if (!student) return res.status(404).json({ message: 'Student not found' });

//     const tutorFee = tutor.fees?.tutorFee || 0;

//     // Update booking
//     booking.adminConfirmed = true;
//     booking.meetingLink = meetingLink;
//     booking.status = 'confirmed';
//     await booking.save();

//     // Credit tutor
//     tutor.totalEarnings = (tutor.totalEarnings || 0) + Number(tutorFee);
//     await tutor.save();

//     // Notify student
//     await NotificationService.send({
//       userId: booking.studentId,
//       title: 'Booking Approved',
//       message: `Your session with ${tutor.name} is confirmed. Meeting link: ${meetingLink}`,
//     });

//     // Send mail to tutor and student about session
//     let html;
//     try {
//       html = `
//   <div style="font-family: Arial, sans-serif; padding: 20px;">
//     <div style="max-width: 500px; margin: auto; background: #0B0447; padding: 25px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">

//       <div style="text-align: center; margin-bottom: 20px;">
//         <img src="cid:edukaster-logo" alt="Edukaster Logo" style="width: 180px;" />
//       </div>

//       <h2 style="color: #f6f6f6; text-align: center;">Session Confirmed</h2>

//       <p style="font-size: 15px; color: #f6f6f6;">
//         Your session with <strong>${student?.name}</strong> is confirmed.
//       </p>

//       <p style="font-size: 15px; color: #f6f6f6;">
//         Meeting link: <a href="${meetingLink}" style="color: #ff7a00;">${meetingLink}</a>
//       </p>

//       <p style="margin-top: 25px; font-size: 13px; color: #f6f6f6; text-align: center;">
//         © ${new Date().getFullYear()} Edukaster. All rights reserved.
//       </p>
//     </div>
//   </div>
// `;
//       await sendEmail(tutor?.email, 'Booking Session', html);
//     } catch (mailErr) {
//       return res.status(500).json({
//         message:
//           'Failed to send booking session email. Please try again later.',
//         error: mailErr.message,
//       });
//     }

//     try {
//       html = `
//   <div style="font-family: Arial, sans-serif; padding: 20px;">
//     <div style="max-width: 500px; margin: auto; background: #0B0447; padding: 25px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">

//       <div style="text-align: center; margin-bottom: 20px;">
//         <img src="cid:edukaster-logo" alt="Edukaster Logo" style="width: 180px;" />
//       </div>

//       <h2 style="color: #f6f6f6; text-align: center;">Session Confirmed</h2>

//       <p style="font-size: 15px; color: #f6f6f6;">
//         Your session with <strong>${tutor?.name}</strong> is confirmed.
//       </p>

//       <p style="font-size: 15px; color: #f6f6f6;">
//         Meeting link: <a href="${meetingLink}" style="color: #ff7a00;">${meetingLink}</a>
//       </p>

//       <p style="margin-top: 25px; font-size: 13px; color: #f6f6f6; text-align: center;">
//         © ${new Date().getFullYear()} Edukaster. All rights reserved.
//       </p>
//     </div>
//   </div>
// `;
//       await sendEmail(student?.email, 'Booking Session', html);
//     } catch (mailErr) {
//       return res.status(500).json({
//         message:
//           'Failed to send booking session email. Please try again later.',
//         error: mailErr.message,
//       });
//     }

//     // Return updated booking with populated student
//     const updatedBooking = await Booking.findById(bookingId).populate(
//       'studentId',
//       'firstName lastName email avatar'
//     );

//     res.json({ message: 'Booking approved', booking: updatedBooking });
//   } catch (err) {
//     console.error('approveBooking error:', err);
//     res.status(500).json({ message: err.message });
//   }
// };

// const getStudentBookings = async (req, res) => {
//   try {
//     const studentId = req.user._id; // auth middleware should set req.user

//     // Fetch upcoming bookings approved by admin
//     const bookings = await Booking.find({
//       studentId,
//       adminConfirmed: true,
//       status: 'confirmed',
//       scheduledDate: { $gte: new Date() }, // only upcoming bookings
//     })
//       .populate('tutorId', 'name email avatar') // get tutor details
//       .sort({ scheduledDate: 1 });

//     res.json({ success: true, bookings });
//   } catch (err) {
//     console.error('getStudentBookings error:', err);
//     res.status(500).json({ message: err.message });
//   }
// };

// const getBookingDetails = async (req, res) => {
//   try {
//     const userId = req.user._id;
//     const { bookingId } = req.params;

//     const booking = await Booking.findOne({
//       _id: bookingId,
//       $or: [{ tutorId: userId }, { studentId: userId }],
//     })
//       .populate('studentId', 'name email avatar about goal')
//       .populate('tutorId', 'name email avatar fees totalEarnings');

//     if (!booking) {
//       return res
//         .status(404)
//         .json({ message: 'Booking not found or unauthorized' });
//     }

//     // 🔹 Always allow confirmation if booking is confirmed but not completed
//     const canConfirmCompletion =
//       booking.status === 'confirmed' && !booking.completedAt;

//     const { tutorId: tutor, studentId: student } = booking;

//     const responseData = {
//       _id: booking._id,
//       courseTitle: booking.courseTitle,
//       scheduledDate: booking.scheduledDate,
//       duration: booking.duration,
//       amount: booking.amount,
//       sessionType: booking.sessionType,
//       paymentStatus: booking.paymentStatus,
//       status: booking.status,
//       reference: booking.reference,
//       adminConfirmed: booking.adminConfirmed,
//       meetingLink: booking.adminConfirmed ? booking.meetingLink : null,
//       createdAt: booking.createdAt,
//       updatedAt: booking.updatedAt,

//       // ✅ Always show confirm button if not completed
//       canConfirmCompletion,

//       tutor: {
//         _id: tutor._id,
//         name: tutor.name,
//         email: tutor.email,
//         avatar: tutor.avatar || null,
//         totalEarnings: tutor.totalEarnings || 0,
//       },
//       student: {
//         _id: student._id,
//         name: student.name,
//         email: student.email,
//         about: student.about,
//         goal: student.goal,
//         avatar:
//           student.avatar?.data && student.avatar?.contentType
//             ? `data:${
//                 student.avatar.contentType
//               };base64,${student.avatar.data.toString('base64')}`
//             : null,
//       },
//     };

//     res.json({ success: true, booking: responseData });
//   } catch (err) {
//     console.error('getBookingDetails error:', err);
//     res.status(500).json({ message: err.message });
//   }
// };

// const getBookingDetails = async (req, res) => {
//   try {
//     const userId = req.user._id;
//     const { bookingId } = req.params;

//     const booking = await Booking.findOne({
//       _id: bookingId,
//       $or: [{ tutorId: userId }, { studentId: userId }],
//     })
//       .populate('studentId', 'name email avatar about goal')
//       .populate('tutorId', 'name email avatar fees totalEarnings');

//     if (!booking) {
//       return res
//         .status(404)
//         .json({ message: 'Booking not found or unauthorized' });
//     }

//     const student = booking.studentId;
//     const tutor = booking.tutorId;

//     // ✅ build public file URL
//     // const studentFile = booking.uploadedFile
//     //   ? {
//     //       originalName: booking.uploadedFile.originalName,
//     //       mimeType: booking.uploadedFile.mimeType,
//     //       size: booking.uploadedFile.size,
//     //       url: `${req.protocol}://${req.get('host')}/bookings/file/${booking.uploadedFile.filename}`,
//     //     }
//     //   : null;

//     const responseData = {
//       _id: booking._id,
//       courseTitle: booking.courseTitle,
//       scheduledDate: booking.scheduledDate,
//       duration: booking.duration,
//       amount: booking.amount,
//       sessionType: booking.sessionType,
//       paymentStatus: booking.paymentStatus,
//       status: booking.status,
//       adminConfirmed: booking.adminConfirmed,
//       meetingLink: booking.adminConfirmed ? booking.meetingLink : null,
//       createdAt: booking.createdAt,

//       // studentFile: booking.uploadedFile
//       //   ? {
//       //       originalName: booking.uploadedFile.originalName,
//       //       mimeType: booking.uploadedFile.mimeType,
//       //       size: booking.uploadedFile.size,
//       //       url: `${req.protocol}://${req.get('host')}/bookings/file/${booking.uploadedFile.filename}`,
//       //     }
//       //   : null,

//       studentFile: booking.uploadedFile
//         ? {
//             originalName: booking.uploadedFile.originalName,
//             mimeType: booking.uploadedFile.mimeType,
//             size: booking.uploadedFile.size,
//             url: `data:${booking.uploadedFile.mimeType};base64,${booking.uploadedFile.data}`,
//           }
//         : null,

//       student: student && {
//         _id: student._id,
//         name: student.name,
//         email: student.email,
//         about: student.about,
//         goal: student.goal,
//         avatar:
//           student.avatar?.data && student.avatar?.contentType
//             ? `data:${student.avatar.contentType};base64,${student.avatar.data.toString('base64')}`
//             : null,
//       },

//       tutor: tutor && {
//         _id: tutor._id,
//         name: tutor.name,
//         email: tutor.email,
//         totalEarnings: tutor.totalEarnings || 0,
//         avatar:
//           tutor.avatar?.data && tutor.avatar?.contentType
//             ? `data:${tutor.avatar.contentType};base64,${tutor.avatar.data.toString('base64')}`
//             : null,
//       },
//     };

//     res.json({ success: true, booking: responseData });
//   } catch (err) {
//     console.error('getBookingDetails error:', err);
//     res.status(500).json({ message: err.message });
//   }
// };

const getBookingDetails = async (req, res) => {
  try {
    const userId = req.user._id;
    const { bookingId } = req.params;

    const booking = await Booking.findOne({
      _id: bookingId,
      $or: [{ tutorId: userId }, { studentId: userId }],
    })
      .populate('studentId', 'name email avatar about goal')
      .populate('tutorId', 'name email avatar fees totalEarnings')
      .populate('groupStudents', 'name email avatar about goal');

    if (!booking) {
      return res
        .status(404)
        .json({ message: 'Booking not found or unauthorized' });
    }

    const isGroupSession = booking.sessionType === 'group';

    //     // 🔹 Always allow confirmation if booking is confirmed but not completed
    const canConfirmCompletion =
      booking.status === 'confirmed' && !booking.completedAt;

    const student = booking.studentId;
    const tutor = booking.tutorId;

    // Build file URL if uploaded
    const studentFile = booking.uploadedFile
      ? {
          originalName: booking.uploadedFile.originalName,
          mimeType: booking.uploadedFile.mimeType,
          size: booking.uploadedFile.size,
          url: `${req.protocol}://${req.get('host')}/bookings/file/${booking.uploadedFile.filename}`,
        }
      : null;

    const responseData = {
      _id: booking._id,
      courseTitle: booking.courseTitle,
      scheduledDate: booking.scheduledDate,
      duration: booking.duration,
      amount: booking.amount,
      sessionType: booking.sessionType,
      paymentStatus: booking.paymentStatus,
      status: booking.status,
      adminConfirmed: booking.adminConfirmed,
      meetingLink: booking.adminConfirmed ? booking.meetingLink : null,
      createdAt: booking.createdAt,

      canConfirmCompletion,

      studentFile,
      student: student
        ? {
            _id: student._id,
            name: student.name,
            email: student.email,
            about: student.about,
            goal: student.goal,
            avatar: student.avatar
              ? `${req.protocol}://${req.get('host')}/users/avatar/${student._id}`
              : null,
          }
        : null,
      tutor: tutor
        ? {
            _id: tutor._id,
            name: tutor.name,
            email: tutor.email,
            totalEarnings: tutor.totalEarnings || 0,
            avatar: tutor.avatar
              ? `${req.protocol}://${req.get('host')}/users/avatar/${tutor._id}`
              : null,
          }
        : null,
    };

    // 🔹 1-on-1 Booking Response
    if (!isGroupSession) {
      responseData.student = booking.studentId
        ? {
            _id: booking.studentId._id,
            name: booking.studentId.name,
            email: booking.studentId.email,
            about: booking.studentId.about,
            goal: booking.studentId.goal,
            avatar: booking.studentId.avatar
              ? `${req.protocol}://${req.get('host')}/users/avatar/${booking.studentId._id}`
              : null,
          }
        : null;
    }

    // 🔹 Group Booking Response
    if (isGroupSession) {
      responseData.groupStudents = booking.groupStudents.map((student) => ({
        _id: student._id,
        name: student.name,
        email: student.email,
        about: student.about,
        goal: student.goal,
        avatar: student.avatar
          ? `${req.protocol}://${req.get('host')}/users/avatar/${student._id}`
          : null,
      }));

      responseData.totalStudents = booking.groupStudents.length;
    }

    res.json({ success: true, booking: responseData });
  } catch (err) {
    console.error('getBookingDetails error:', err);
    res.status(500).json({ message: err.message });
  }
};

const getStudentBookings = async (req, res) => {
  try {
    const studentId = req.user._id;

    const bookings = await Booking.find({
      studentId,
      adminConfirmed: true, // ✅ approved by admin
      status: 'confirmed', // ✅ confirmed bookings only
      scheduledDate: { $gte: new Date() }, // ✅ only future/upcoming sessions
    })
      .populate('tutorId', 'name email avatar')
      .sort({ scheduledDate: 1 }); // earliest first

    res.json({ success: true, bookings });
  } catch (err) {
    console.error('getStudentBookings error:', err);
    res.status(500).json({ message: err.message });
  }
};

// const approveBooking = async (req, res) => {
//   try {
//     const { bookingId } = req.params;
//     const { meetingLink } = req.body;

//     const booking = await Booking.findById(bookingId);
//     if (!booking) return res.status(404).json({ message: 'Booking not found' });
//     if (booking.adminConfirmed)
//       return res.status(400).json({ message: 'Booking already approved' });

//     const tutor = await User.findById(booking.tutorId);
//     if (!tutor) return res.status(404).json({ message: 'Tutor not found' });

//     const student = await User.findById(booking.studentId);
//     if (!student) return res.status(404).json({ message: 'Student not found' });

//     const tutorFee = tutor.fees?.tutorFee || 0;

//     // Update booking
//     booking.adminConfirmed = true;
//     booking.meetingLink = meetingLink;
//     booking.status = 'confirmed';
//     await booking.save();

//     // Credit tutor
//     tutor.totalEarnings = (tutor.totalEarnings || 0) + Number(tutorFee);
//     await tutor.save();

//     // Notify student
//     await NotificationService.send({
//       userId: booking.studentId,
//       title: 'Booking Approved',
//       message: `Your session with ${tutor.name} is confirmed. Meeting link: ${meetingLink}`,
//     });

//     // Push Notification to student
//     if (student.pushToken) {
//       await sendPushNotification({
//         pushToken: student.pushToken,
//         title: 'Session Approved',
//         message: `Your session with ${tutor.name} is confirmed. Meeting link: ${meetingLink}`,
//       });
//     }

//     // Push Notification to tutor
//     if (tutor.pushToken) {
//       await sendPushNotification({
//         pushToken: tutor.pushToken,
//         title: 'Session Approved',
//         message: `Your session with ${student.name} is confirmed. Meeting link: ${meetingLink}`,
//       });
//     }

//     // 2 Hours reminder to student and tutor
//     const sessionTime = new Date(booking.date);
//     const reminderTime = new Date(sessionTime.getTime() - 2 * 60 * 60 * 1000);

//     schedule.scheduleJob(reminderTime, async () => {
//       // Send reminder to student
//       if (student.pushToken) {
//         await sendPushNotification({
//           pushToken: student.pushToken,
//           title: 'Session Reminder',
//           message: `Reminder: Your session with ${tutor.name} starts in 2 hours. Meeting link: ${meetingLink}`,
//         });
//       }

//       // Send reminder to tutor
//       if (tutor.pushToken) {
//         await sendPushNotification({
//           pushToken: tutor.pushToken,
//           title: 'Session Reminder',
//           message: `Reminder: Your session with ${student.name} starts in 2 hours. Meeting link: ${meetingLink}`,
//         });
//       }
//     });

//     // Send mail to tutor and student about session
//     let html;
//     try {
//       html = `
//   <div style="font-family: Arial, sans-serif; padding: 20px;">
//     <div style="max-width: 500px; margin: auto; background: #0B0447; padding: 25px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">

//       <div style="text-align: center; margin-bottom: 20px;">
//         <img src="cid:edukaster-logo" alt="Edukaster Logo" style="width: 180px;" />
//       </div>

//       <h2 style="color: #f6f6f6; text-align: center;">Session Confirmed</h2>

//       <p style="font-size: 15px; color: #f6f6f6;">
//         Your session with <strong>${student?.name}</strong> is confirmed.
//       </p>

//       <p style="font-size: 15px; color: #f6f6f6;">
//         Meeting link: <a href="${meetingLink}" style="color: #ff7a00;">${meetingLink}</a>
//       </p>

//       <p style="margin-top: 25px; font-size: 13px; color: #f6f6f6; text-align: center;">
//         © ${new Date().getFullYear()} Edukaster. All rights reserved.
//       </p>
//     </div>
//   </div>
// `;
//       await sendEmail(tutor?.email, 'Booking Session', html);
//     } catch (mailErr) {
//       return res.status(500).json({
//         message:
//           'Failed to send booking session email. Please try again later.',
//         error: mailErr.message,
//       });
//     }

//     try {
//       html = `
//   <div style="font-family: Arial, sans-serif; padding: 20px;">
//     <div style="max-width: 500px; margin: auto; background: #0B0447; padding: 25px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">

//       <div style="text-align: center; margin-bottom: 20px;">
//         <img src="cid:edukaster-logo" alt="Edukaster Logo" style="width: 180px;" />
//       </div>

//       <h2 style="color: #f6f6f6; text-align: center;">Session Confirmed</h2>

//       <p style="font-size: 15px; color: #f6f6f6;">
//         Your session with <strong>${tutor?.name}</strong> is confirmed.
//       </p>

//       <p style="font-size: 15px; color: #f6f6f6;">
//         Meeting link: <a href="${meetingLink}" style="color: #ff7a00;">${meetingLink}</a>
//       </p>

//       <p style="margin-top: 25px; font-size: 13px; color: #f6f6f6; text-align: center;">
//         © ${new Date().getFullYear()} Edukaster. All rights reserved.
//       </p>
//     </div>
//   </div>
// `;
//       await sendEmail(student?.email, 'Booking Session', html);
//     } catch (mailErr) {
//       return res.status(500).json({
//         message:
//           'Failed to send booking session email. Please try again later.',
//         error: mailErr.message,
//       });
//     }

//     // Return updated booking with populated student
//     const updatedBooking = await Booking.findById(bookingId).populate(
//       'studentId',
//       'firstName lastName email avatar',
//     );

//     res.json({ message: 'Booking approved', booking: updatedBooking });
//   } catch (err) {
//     console.error('approveBooking error:', err);
//     res.status(500).json({ message: err.message });
//   }
// };

const approveBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { meetingLink } = req.body;

    if (!meetingLink) {
      return res.status(400).json({ message: 'Meeting link is required' });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (booking.adminConfirmed) {
      return res.status(400).json({ message: 'Booking already approved' });
    }

    const tutor = await User.findById(booking.tutorId);
    if (!tutor) {
      return res.status(404).json({ message: 'Tutor not found' });
    }

    const student = await User.findById(booking.studentId);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const isGroupSession = booking.sessionType === 'group';

    // const tutorFee = tutor.fees?.tutorFee || 0;

    /* =======================
       UPDATE BOOKING (UNLOCK)
    ======================= */
    booking.adminConfirmed = true;
    booking.status = 'confirmed';
    booking.meetingLink = meetingLink;
    await booking.save();

    /* =======================
       CREDIT TUTOR (ONCE)
    ======================= */
    // tutor.totalEarnings = (tutor.totalEarnings || 0) + Number(tutorFee);
    // await tutor.save();
    // CREDIT TUTOR (1-ON-1 ONLY)

    if (!isGroupSession) {
      const tutorFee = tutor.fees?.tutorFee || 0;

      tutor.totalEarnings = (tutor.totalEarnings || 0) + Number(tutorFee);

      await tutor.save();
    }

    /* =======================
       NOTIFICATIONS
    ======================= */

    if (isGroupSession) {
      // Notify ALL group students
      const students = await User.find({
        _id: { $in: booking.groupStudents },
      });

      for (const student of students) {
        await NotificationService.send({
          userId: student._id,
          title: 'Group Session Approved',
          message: `Your English Proficiency session is confirmed. Meeting link: ${meetingLink}`,
        });

        if (student.pushToken) {
          await sendPushNotification({
            pushToken: student.pushToken,
            title: 'Session Approved',
            message: `Your English Proficiency session is confirmed.`,
          });
        }

        await sendEmail(
          student.email,
          'English Proficiency Session Confirmed',
          `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
    <div style="max-width: 500px; margin: auto; background: #0B0447; padding: 25px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">

      <div style="text-align: center; margin-bottom: 20px;">
        <img src="cid:edukaster-logo" alt="Edukaster Logo" style="width: 180px;" />
      </div>

      <h2 style="color: #f6f6f6; text-align: center;">Session Confirmed</h2>

      <p style="font-size: 15px; color: #f6f6f6;">
       Your English Proficiency session with ${tutor?.name} has been confirmed.
      </p>

      <p style="font-size: 15px; color: #f6f6f6;">
        Meeting link: <a href="${meetingLink}" style="color: #ff7a00;">${meetingLink}</a>
      </p>

      <p style="margin-top: 25px; font-size: 13px; color: #f6f6f6; text-align: center;">
        © ${new Date().getFullYear()} Edukaster. All rights reserved.
      </p>
    </div>
  </div>
          `,
        );
      }

      // Notify tutor once
      if (tutor.pushToken) {
        await sendPushNotification({
          pushToken: tutor.pushToken,
          title: 'Group Session Approved',
          message: `Your English Proficiency group session has been confirmed.`,
        });
      }

      await sendEmail(
        tutor.email,
        'Group Session Confirmed',
        `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
    <div style="max-width: 500px; margin: auto; background: #0B0447; padding: 25px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">

      <div style="text-align: center; margin-bottom: 20px;">
        <img src="cid:edukaster-logo" alt="Edukaster Logo" style="width: 180px;" />
      </div>

      <h2 style="color: #f6f6f6; text-align: center;">Session Confirmed</h2>

      <p style="font-size: 15px; color: #f6f6f6;">
      Your English Proficiency group session has been approved.
      </p>

      <p style="font-size: 15px; color: #f6f6f6;">
        Meeting link: <a href="${meetingLink}" style="color: #ff7a00;">${meetingLink}</a>
      </p>

      <p style="margin-top: 25px; font-size: 13px; color: #f6f6f6; text-align: center;">
        © ${new Date().getFullYear()} Edukaster. All rights reserved.
      </p>
    </div>
  </div>
        `,
      );
    } else {
      // ===== 1-ON-1 FLOW =====
      const student = await User.findById(booking.studentId);
      if (!student) {
        return res.status(404).json({ message: 'Student not found' });
      }

      await NotificationService.send({
        userId: booking.studentId,
        title: 'Booking Approved',
        message: `Your session with ${tutor.name} is confirmed. Meeting link: ${meetingLink}`,
      });

      if (student.pushToken) {
        await sendPushNotification({
          pushToken: student.pushToken,
          title: 'Session Approved',
          message: `Your session with ${tutor.name} is confirmed. Meeting link: ${meetingLink}`,
        });
      }

      if (tutor.pushToken) {
        await sendPushNotification({
          pushToken: tutor.pushToken,
          title: 'Session Approved',
          message: `Your session with ${student.name} is confirmed. Meeting link: ${meetingLink}`,
        });
      }

      /* =======================
       2-HOUR REMINDER (FIXED)
    ======================= */
      const sessionTime = new Date(booking.scheduledDate);
      const reminderTime = new Date(sessionTime.getTime() - 2 * 60 * 60 * 1000);

      if (reminderTime > new Date()) {
        schedule.scheduleJob(reminderTime, async () => {
          if (student.pushToken) {
            await sendPushNotification({
              pushToken: student.pushToken,
              title: 'Session Reminder',
              message: `Reminder: Your session with ${tutor.name} starts in 2 hours. Meeting link: ${meetingLink}`,
            });
          }

          if (tutor.pushToken) {
            await sendPushNotification({
              pushToken: tutor.pushToken,
              title: 'Session Reminder',
              message: `Reminder: Your session with ${student.name} starts in 2 hours. Meeting link: ${meetingLink}`,
            });
          }
        });
      }

      /* =======================
       EMAILS (UNCHANGED LOGIC)
    ======================= */
      // Send mail to tutor and student about session
      let html;
      try {
        html = `
  <div style="font-family: Arial, sans-serif; padding: 20px;">
    <div style="max-width: 500px; margin: auto; background: #0B0447; padding: 25px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">

      <div style="text-align: center; margin-bottom: 20px;">
        <img src="cid:edukaster-logo" alt="Edukaster Logo" style="width: 180px;" />
      </div>

      <h2 style="color: #f6f6f6; text-align: center;">Session Confirmed</h2>

      <p style="font-size: 15px; color: #f6f6f6;">
        Your session with <strong>${student?.name}</strong> is confirmed.
      </p>

      <p style="font-size: 15px; color: #f6f6f6;">
        Meeting link: <a href="${meetingLink}" style="color: #ff7a00;">${meetingLink}</a>
      </p>

      <p style="margin-top: 25px; font-size: 13px; color: #f6f6f6; text-align: center;">
        © ${new Date().getFullYear()} Edukaster. All rights reserved.
      </p>
    </div>
  </div>
`;
        await sendEmail(tutor?.email, 'Booking Session', html);
      } catch (mailErr) {
        return res.status(500).json({
          message:
            'Failed to send booking session email. Please try again later.',
          error: mailErr.message,
        });
      }

      try {
        html = `
  <div style="font-family: Arial, sans-serif; padding: 20px;">
    <div style="max-width: 500px; margin: auto; background: #0B0447; padding: 25px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">

      <div style="text-align: center; margin-bottom: 20px;">
        <img src="cid:edukaster-logo" alt="Edukaster Logo" style="width: 180px;" />
      </div>

      <h2 style="color: #f6f6f6; text-align: center;">Session Confirmed</h2>

      <p style="font-size: 15px; color: #f6f6f6;">
        Your session with <strong>${tutor?.name}</strong> is confirmed.
      </p>

      <p style="font-size: 15px; color: #f6f6f6;">
        Meeting link: <a href="${meetingLink}" style="color: #ff7a00;">${meetingLink}</a>
      </p>

      <p style="margin-top: 25px; font-size: 13px; color: #f6f6f6; text-align: center;">
        © ${new Date().getFullYear()} Edukaster. All rights reserved.
      </p>
    </div>
  </div>
`;
        await sendEmail(student?.email, 'Booking Session', html);
      } catch (mailErr) {
        return res.status(500).json({
          message:
            'Failed to send booking session email. Please try again later.',
          error: mailErr.message,
        });
      }
    }
    /* =======================
       RETURN UPDATED BOOKING
       (FILE NOW VISIBLE)
    ======================= */
    const updatedBooking = await Booking.findById(bookingId)
      .populate('studentId', 'firstName lastName email avatar')
      .populate('tutorId', 'firstName lastName email avatar');

    return res.json({
      success: true,
      message: 'Booking approved successfully',
      booking: updatedBooking,
    });
  } catch (err) {
    console.error('approveBooking error:', err);
    return res.status(500).json({ message: err.message });
  }
};

const getTodayClassesForTutor = async (req, res) => {
  try {
    const tutorId = req.user._id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const bookings = await Booking.find({
      tutorId,
      adminConfirmed: true,
      status: 'confirmed',
      scheduledDate: { $gte: today, $lt: tomorrow },
    })
      .populate('studentId', 'name email avatar')
      .sort({ scheduledDate: 1 });

    const formatted = bookings.map((b) => ({
      _id: b._id,
      student: b.studentId?.name || 'Unknown Student',
      date: new Date(b.scheduledDate).toLocaleDateString('en-CA'),
      time: new Date(b.scheduledDate).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
      desc: b.courseTitle || '',
      avatar:
        b.studentId?.avatar?.data && b.studentId?.avatar?.contentType
          ? `data:${
              b.studentId.avatar.contentType
            };base64,${b.studentId.avatar.data.toString('base64')}`
          : null,
    }));

    res.json({ success: true, classes: formatted });
  } catch (err) {
    console.error('getTodayClassesForTutor error:', err);
    res.status(500).json({ message: err.message });
  }
};

const rateBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { rating, review } = req.body;
    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    if (booking.studentId.toString() !== req.user._id.toString())
      return res.status(403).json({ message: 'Not allowed' });

    booking.rating = rating;
    booking.review = review;
    booking.status = 'completed';
    booking.completedAt = new Date();
    await booking.save();

    // update tutor aggregate rating
    const tutor = await User.findById(booking.tutorId);
    tutor.totalRatings = (tutor.totalRatings || 0) + 1;
    // new average rating:
    tutor.rating =
      ((tutor.rating || 0) * (tutor.totalRatings - 1) + rating) /
      tutor.totalRatings;
    await tutor.save();

    res.json({ message: 'Thanks for rating', booking });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// const bookTutor = async (req, res) => {
//   try {
//     const studentId = req.user._id;
//     const {
//       tutorId,
//       courseTitle,
//       scheduledDate,
//       sessionType = '1on1',
//       duration = 60,
//       paymentMethod = 'wallet',
//       redirectUrl,
//     } = req.body;

//     if (!tutorId || !scheduledDate || !courseTitle) {
//       return res.status(400).json({ message: 'Missing required fields' });
//     }

//     const tutor = await User.findById(tutorId);
//     if (!tutor || tutor.role !== 'tutor') {
//       return res.status(404).json({ message: 'Tutor not found' });
//     }

//     // Handle file upload if present
//     let uploadedFileData = null;
//     if (req.file) {
//       const uploadDir =
//         process.env.NODE_ENV === 'production'
//           ? '/tmp/bookings'
//           : path.join(__dirname, '..', 'uploads', 'bookings');

//       if (!fs.existsSync(uploadDir))
//         fs.mkdirSync(uploadDir, { recursive: true });

//       const uniqueName = `${Date.now()}-${req.file.originalname}`;
//       const filePath = path.join(uploadDir, uniqueName);
//       fs.writeFileSync(filePath, req.file.buffer);

//       uploadedFileData = {
//         filename: uniqueName,
//         originalName: req.file.originalname,
//         mimeType: req.file.mimetype,
//         size: req.file.size,
//         url: `${req.protocol}://${req.get('host')}/bookings/file/${uniqueName}`,
//       };
//     }

//     // 🔹 English Proficiency group session
//     if (courseTitle === 'English Proficiency') {
//       const GROUP_AMOUNT = 140000;

//       // Check for existing group session
//       let booking = await Booking.findOne({
//         tutorId,
//         courseTitle,
//         sessionType: 'group',
//         status: { $in: ['pending', 'confirmed'] },
//       });

//       if (!booking) {
//         booking = await Booking.create({
//           tutorId,
//           courseTitle,
//           sessionType: 'group',
//           groupStudents: [studentId],
//           scheduledDate: new Date(scheduledDate),
//           duration: 42 * 24 * 60, // 6 weeks in minutes
//           amount: GROUP_AMOUNT,
//           paymentStatus: 'pending',
//           status: 'pending',
//           uploadedFile: uploadedFileData,
//         });
//       }

//       if (booking.groupStudents.includes(studentId)) {
//         return res
//           .status(400)
//           .json({ message: 'You have already joined this session' });
//       }

//       if (paymentMethod === 'wallet') {
//         const student = await User.findById(studentId);
//         if (!student || student.walletBalance < GROUP_AMOUNT) {
//           return res
//             .status(402)
//             .json({ message: 'Insufficient wallet balance for group session' });
//         }

//         const balanceBefore = student.walletBalance;
//         student.walletBalance -= GROUP_AMOUNT;
//         await student.save();

//         booking.groupStudents.push(studentId);
//         booking.paymentStatus = 'paid';
//         await booking.save();

//         await Wallet.create({
//           userId: student._id,
//           type: 'debit',
//           amount: GROUP_AMOUNT,
//           description: `Booking for English Proficiency with ${tutor.name}`,
//           category: 'booking',
//           balanceBefore,
//           balanceAfter: student.walletBalance,
//         });

//         return res.status(200).json({
//           success: true,
//           message: 'Joined English Proficiency session',
//           booking,
//           walletBalance: student.walletBalance,
//         });
//       }

//       if (paymentMethod === 'paystack') {
//         const reference = paystackService.generateReference();
//         const callbackUrl = `${process.env.BACKEND_URL}/bookings/verify/${reference}`;

//         const paymentData = await paystackService.initializeTransaction({
//           email: req.user.email,
//           amount: GROUP_AMOUNT,
//           reference,
//           callback_url: callbackUrl,
//           metadata: {
//             studentId,
//             tutorId,
//             courseTitle,
//             scheduledDate,
//             duration: 42 * 24 * 60,
//             sessionType: 'group',
//             amount: GROUP_AMOUNT,
//             redirectUrl,
//             isEnglishGroup: true,
//             uploadedFile: uploadedFileData,
//           },
//         });

//         if (!paymentData.success)
//           return res.status(400).json({ message: paymentData.message });

//         return res.status(200).json({
//           success: true,
//           message: 'Complete payment to join English Proficiency session',
//           authorization_url: paymentData.data.data.authorization_url,
//           reference,
//         });
//       }

//       return res.status(400).json({ message: 'Invalid payment method' });
//     }

//     // 🔹 1on1 sessions
//     const amount =
//       tutor.fees?.totalFee ??
//       (tutor.fees?.tutorFee || 0) + (tutor.fees?.adminFee || 0);

//     if (!amount || amount <= 0) {
//       return res.status(400).json({ message: 'Invalid tutor fee' });
//     }

//     const requestedStart = new Date(scheduledDate);
//     const requestedEnd = new Date(requestedStart.getTime() + duration * 60000);

//     const collides = await Booking.exists({
//       tutorId,
//       status: { $in: ['pending', 'approved'] },
//       $expr: {
//         $and: [
//           { $lt: ['$scheduledDate', requestedEnd] },
//           {
//             $gt: [
//               { $add: ['$scheduledDate', { $multiply: ['$duration', 60000] }] },
//               requestedStart,
//             ],
//           },
//         ],
//       },
//     });

//     if (collides)
//       return res.status(400).json({ message: 'Requested slot already booked' });

//     if (paymentMethod === 'wallet') {
//       const student = await User.findById(studentId);
//       if (!student || student.walletBalance < amount) {
//         return res.status(402).json({ message: 'Insufficient wallet balance' });
//       }

//       const balanceBefore = student.walletBalance;
//       student.walletBalance -= amount;
//       await student.save();

//       const booking = await Booking.create({
//         studentId,
//         tutorId,
//         courseTitle,
//         scheduledDate: requestedStart,
//         duration,
//         amount,
//         sessionType,
//         paymentMethod: 'wallet',
//         status: 'pending',
//         paymentStatus: 'paid',
//         uploadedFile: uploadedFileData,
//       });

//       await Wallet.create({
//         userId: student._id,
//         type: 'debit',
//         amount,
//         description: `Booking with tutor ${tutor.name} for ${courseTitle}`,
//         category: 'booking',
//         balanceBefore,
//         balanceAfter: student.walletBalance,
//       });

//       return res.status(200).json({
//         success: true,
//         message: 'Booking created. Awaiting admin approval',
//         booking,
//         walletBalance: student.walletBalance,
//       });
//     }

//     if (paymentMethod === 'paystack') {
//       const reference = paystackService.generateReference();
//       const callbackUrl = `${process.env.BACKEND_URL}/bookings/verify/${reference}`;

//       const paymentData = await paystackService.initializeTransaction({
//         email: req.user.email,
//         amount,
//         reference,
//         callback_url: callbackUrl,
//         metadata: {
//           studentId,
//           tutorId,
//           courseTitle,
//           scheduledDate,
//           duration,
//           sessionType,
//           amount,
//           redirectUrl,
//           uploadedFile: uploadedFileData,
//         },
//       });

//       if (!paymentData.success)
//         return res.status(400).json({ message: paymentData.message });

//       return res.status(200).json({
//         success: true,
//         message: 'Complete payment to finish booking',
//         authorization_url: paymentData.data.data.authorization_url,
//         reference,
//       });
//     }

//     return res.status(400).json({ message: 'Invalid payment method' });
//   } catch (err) {
//     console.error('bookTutor error:', err);
//     res.status(500).json({ message: err.message });
//   }
// };

module.exports = {
  getTutorAvailability,
  bookTutor,
  verifyBookingPayment,
  approveBooking,
  rateBooking,
  getTutorBookings,
  getStudentBookings,
  getPendingBookings,
  getBookingDetails,
  getTodayClassesForTutor,
};
