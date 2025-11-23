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
        (a) => a.day.toLowerCase() === dayName.toLowerCase() && a.active
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

const bookTutor = async (req, res) => {
  try {
    const studentId = req.user._id;
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

    const amount =
      tutor.fees?.totalFee ||
      (tutor.fees?.tutorFee || 0) + (tutor.fees?.adminFee || 0);

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid tutor fee' });
    }

    // 💳 Wallet Payment (instant)
    if (paymentMethod === 'wallet') {
      const student = await User.findById(studentId);

      if (!student || student.walletBalance < amount) {
        return res.status(402).json({ message: 'Insufficient wallet balance' });
      }

      const requestedStart = new Date(scheduledDate);
      const requestedEnd = new Date(
        requestedStart.getTime() + duration * 60000
      );

      // Check overlapping bookings
      const bookingsThatDay = await Booking.find({
        tutorId,
        status: { $in: ['pending', 'confirmed'] },
      });

      const collides = bookingsThatDay.some((b) => {
        const bStart = new Date(b.scheduledDate);
        const bEnd = new Date(bStart.getTime() + b.duration * 60000);
        return requestedStart < bEnd && requestedEnd > bStart;
      });

      if (collides) {
        return res
          .status(400)
          .json({ message: 'Requested slot already booked' });
      }

      // Deduct wallet
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
        status: 'confirmed',
        paymentStatus: 'paid',
      });

      // Wallet transaction
      await Wallet.create({
        userId: student._id,
        type: 'debit',
        amount,
        description: `Booking with tutor ${tutor.name} for ${courseTitle}`,
        category: 'booking',
        balanceBefore,
        balanceAfter: student.walletBalance,
      });

      // Create session
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

      return res.status(200).json({
        success: true,
        message: 'Booking confirmed via wallet',
        booking,
        walletBalance: student.walletBalance,
      });
    }

    // 💳 Paystack Payment (deferred booking)
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
        },
      });

      if (!paymentData.success) {
        return res.status(400).json({ message: paymentData.message });
      }

      return res.status(200).json({
        success: true,
        message: 'Booking initialized. Complete payment via Paystack',
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
    } = meta;

    // Create booking only after successful payment
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
      status: 'confirmed',
      paymentStatus: 'paid',
      paystackReference: reference,
    });

    // Create session
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

    // Optional: wallet transaction record
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

    // ✅ Redirect back to mobile/web app
    const redirect = `${redirectUrl}?status=success&amount=${amount}&reference=${reference}`;
    console.log('Redirecting to:', redirect);
    return res.redirect(redirect);
  } catch (err) {
    console.error('verifyBookingPayment error:', err);
    return res.status(500).send('Payment verification failed');
  }
};

const getPendingBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({
      status: 'confirmed',
      adminConfirmed: { $ne: true },
    })
      .populate('studentId', 'name email avatar')
      .populate('tutorId', 'name email avatar')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: bookings.length, bookings });
  } catch (err) {
    console.error('getPendingBookings error:', err);
    res.status(500).json({ success: false, message: err.message });
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
//       redirectUrl, // ✅ added
//     } = req.body;

//     // 🔍 Validate required fields
//     if (!tutorId || !scheduledDate || !courseTitle) {
//       return res.status(400).json({ message: 'Missing required fields' });
//     }

//     const scheduled = new Date(scheduledDate);
//     if (isNaN(scheduled.getTime())) {
//       return res.status(400).json({ message: 'Invalid scheduledDate' });
//     }

//     // 🎓 Check tutor
//     const tutor = await User.findById(tutorId);
//     if (!tutor || tutor.role !== 'tutor') {
//       return res.status(404).json({ message: 'Tutor not found' });
//     }

//     // 💰 Compute amount
//     const amount =
//       tutor.fees?.totalFee ||
//       (tutor.fees?.tutorFee || 0) + (tutor.fees?.adminFee || 0);

//     if (!amount || amount <= 0) {
//       return res.status(400).json({ message: 'Invalid tutor fee' });
//     }

//     // ⏰ Prepare times
//     const requestedStart = new Date(scheduled);
//     const requestedEnd = new Date(requestedStart.getTime() + duration * 60000);

//     // 🕒 Check for overlapping bookings
//     const bookingsThatDay = await Booking.find({
//       tutorId,
//       status: { $in: ['pending', 'confirmed'] },
//     });

//     const collides = bookingsThatDay.some((b) => {
//       const bStart = new Date(b.scheduledDate);
//       const bEnd = new Date(bStart.getTime() + b.duration * 60000);
//       return requestedStart < bEnd && requestedEnd > bStart;
//     });

//     if (collides) {
//       return res.status(400).json({ message: 'Requested slot already booked' });
//     }

//     // 📦 Create booking
//     const reference = paystackService.generateReference();
//     const booking = await Booking.create({
//       studentId,
//       tutorId,
//       courseTitle,
//       scheduledDate: requestedStart,
//       duration,
//       amount,
//       sessionType,
//       paymentMethod,
//       reference,
//       status: 'pending',
//       paymentStatus: 'pending',
//     });

//     // 💳 Wallet Payment
//     if (paymentMethod === 'wallet') {
//       const student = await User.findById(studentId);

//       if (!student || student.walletBalance < amount) {
//         return res
//           .status(402)
//           .json({ message: 'Insufficient wallet balance', booking });
//       }

//       // 💵 Deduct from wallet
//       const balanceBefore = student.walletBalance;
//       student.walletBalance -= amount;
//       await student.save();

//       // 💼 Create wallet transaction
//       const transaction = new Wallet({
//         userId: student._id,
//         type: 'debit',
//         amount,
//         description: `Booking with tutor ${
//           tutor.name || ''
//         } for ${courseTitle}`,
//         category: 'booking',
//         balanceBefore,
//         balanceAfter: student.walletBalance,
//       });

//       // ✅ Confirm booking
//       booking.paymentStatus = 'paid';
//       booking.status = 'confirmed';

//       await transaction.save();

//       return res.status(200).json({
//         success: true,
//         message: 'Booking confirmed via wallet',
//         booking,
//         walletBalance: student.walletBalance,
//       });
//     }

//     // 💳 Paystack Payment
//     if (paymentMethod === 'paystack') {
//       const callbackUrl = `${process.env.BACKEND_URL}/bookings/verify/${reference}`;
//       const frontendRedirect = redirectUrl;
//       const paymentData = await paystackService.initializeTransaction({
//         email: req.user.email,
//         amount,
//         reference,
//         callback_url: callbackUrl,
//         metadata: {
//           bookingId: booking._id,
//           studentId,
//           tutorId,
//           redirectUrl: frontendRedirect, // ✅ store for later redirect
//         },
//       });

//       if (!paymentData.success) {
//         return res.status(400).json({ message: paymentData.message });
//       }
//       await booking.save();
//       return res.status(200).json({
//         success: true,
//         message: 'Booking initialized for Paystack payment',
//         booking,
//         authorization_url: paymentData.data.data.authorization_url,
//         reference,
//       });
//     }

//     // ⚠️ Default fallback
//     return res.status(400).json({ message: 'Invalid payment method' });
//   } catch (err) {
//     console.error('bookTutor error:', err);
//     res.status(500).json({ message: err.message });
//   }
// };

// const getPendingBookings = async (req, res) => {
//   try {
//     // Fetch all bookings that are awaiting admin approval
//     const bookings = await Booking.find({
//       adminConfirmed: { $ne: true }, // not yet confirmed
//       status: { $in: ['pending', 'awaiting_approval'] }, // flexible pending statuses
//     })
//       .populate('studentId', 'firstName lastName email avatar')
//       .populate('tutorId', 'firstName lastName email avatar')
//       .sort({ createdAt: -1 });

//     res.json({
//       success: true,
//       count: bookings.length,
//       bookings,
//     });
//   } catch (err) {
//     console.error('getPendingBookings error:', err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// };

// const verifyBookingPayment = async (req, res) => {
//   try {
//     // const { reference } = req.params;
//     // console.log(reference);
//     // if (!reference) {
//     //   return res.status(400).json({ message: 'Missing transaction reference' });
//     // }

//     let { reference } = req.params;

//     const verification = await paystackService.verifyTransaction(reference);

//     // Retrieve booking by ID from metadata
//     const bookingId = verification.data.data.metadata.bookingId;

//     const booking = await Booking.findById(bookingId);

//     if (!booking) {
//       console.log(
//         'Booking not found for reference:',
//         reference,
//         'ID:',
//         bookingId
//       );
//       return res.redirect(
//         `${process.env.FRONTEND_DEEP_LINK}/booking?status=failed`
//       );
//     }
//     // // Fallback: check query params if missing
//     // if (!reference && req.query.trxref) {
//     //   reference = req.query.trxref;
//     // }

//     // console.log('Verifying booking with reference:', reference);

//     // ✅ Verify transaction with Paystack
//     // const verification = await paystackService.verifyTransaction(reference);

//     // if (
//     //   !verification.success ||
//     //   !verification.data ||
//     //   verification.data.data.status !== 'success'
//     // ) {
//     //   await Booking.findOneAndUpdate({ reference }, { status: 'failed' });
//     //   return res.redirect(
//     //     `${process.env.FRONTEND_DEEP_LINK}/booking?status=failed`
//     //   );
//     // }

//     // ✅ Extract metadata
//     // const { bookingId, studentId, tutorId } =
//     //   verification.data.data.metadata || {};

//     // ✅ Fetch the booking
//     // const booking = await Booking.findOne({ reference });
//     // console.log(booking);
//     // if (!booking)
//     //   return res.redirect(
//     //     `${process.env.FRONTEND_DEEP_LINK}/booking?status=failed`
//     //   );

//     // Now search DB
//     // const booking = await Booking.findOne({ reference: reference.trim() });

//     // if (!booking) {
//     //   console.warn('Booking not found for reference:', reference);
//     //   // Redirect to success anyway if Paystack succeeded (optional)
//     //   return res.redirect(
//     //     `${process.env.FRONTEND_DEEP_LINK}/booking?status=failed`
//     //   );
//     // }

//     booking.status = 'confirmed';
//     booking.paymentStatus = 'paid';
//     await booking.save();

//     // ✅ Create wallet transaction for the student
//     // const student = await User.findById(studentId);
//     // if (student) {
//     //   const balanceBefore = student.walletBalance;
//     //   const newBalance = balanceBefore; // not deducted, since it’s Paystack

//     // }
//     const transaction = new Wallet({
//       // userId: student._id,
//       type: 'debit',
//       amount: booking.amount,
//       description: `Booking payment for tutor ${tutorId}`,
//       category: 'booking',
//       balanceBefore,
//       balanceAfter: newBalance,
//       paymentMethod: 'paystack',
//     });

//     await transaction.save();
//     // Optional: transfer tutor’s share or credit wallet here
//     res.redirect(
//       `${process.env.FRONTEND_DEEP_LINK}/booking?status=success&amount=${booking.amount}`
//     );
//   } catch (error) {
//     console.error('verifyBookingPayment error:', error);
//     res.redirect(`${process.env.FRONTEND_DEEP_LINK}/booking?status=failed`);
//   }
// };

// const verifyBookingPayment = async (req, res) => {
//   try {
//     const { reference } = req.params;
//     const verification = await paystackService.verifyTransaction(reference);

//     if (
//       !verification.success ||
//       verification.data.data.status !== 'success'
//     ) {
//       return res.redirect(`eduapp://booking?status=failed`);
//     }

//     const booking = await Booking.findOneAndUpdate(
//       { reference },
//       { status: 'confirmed', paymentVerified: true },
//       { new: true }
//     );

//     res.redirect(
//       `eduapp://booking?status=success&amount=${booking.amount}&reference=${reference}`
//     );
//   } catch (error) {
//     console.error('verifyBookingPayment error:', error);
//     res.redirect(`eduapp://booking?status=failed`);
//   }
// };

// Admin approve booking

// const verifyBookingPayment = async (req, res) => {
//   try {
//     const { reference } = req.params;

//     const verification = await paystackService.verifyTransaction(reference);
//     if (
//       !verification.success ||
//       !verification.data ||
//       verification.data.data.status !== 'success'
//     ) {
//       return res.redirect(`eduapp://booking?status=failed`);
//     }

//     const booking = await Booking.findOne({ reference });
//     if (!booking) return res.redirect(`eduapp://booking?status=failed`);

//     booking.paymentStatus = 'paid';
//     booking.status = 'confirmed';
//     await booking.save();

//     // ✅ Optionally create wallet transaction here
//     const user = await User.findById(booking.studentId);
//     if (user) {
//       const transaction = new Wallet({
//         userId: user._id,
//         type: 'debit',
//         amount: booking.amount,
//         description: `Tutor booking with ${booking.tutorId}`,
//         category: 'booking',
//         balanceBefore: user.walletBalance,
//         balanceAfter: user.walletBalance, // no deduction since paid externally
//       });
//       await transaction.save();
//     }

//     // ✅ Redirect using your deep link scheme
//     res.redirect(`eduapp://booking?status=success&reference=${reference}`);
//   } catch (error) {
//     console.error('verifyBookingPayment error:', error);
//     res.redirect(`eduapp://booking?status=failed`);
//   }
// };

// const verifyBookingPayment = async (req, res) => {
//   try {
//     const { reference } = req.params;
//     const verification = await paystackService.verifyTransaction(reference);
//     console.log(verification);

//     if (
//       !verification.success ||
//       !verification.data ||
//       verification.data.data.status !== 'success'
//     ) {
//       return res.redirect(
//         `${
//           process.env.FRONTEND_DEEP_LINK || process.env.FRONTEND_URL
//         }/booking?status=failed`
//       );
//     }

//     // ✅ Find booking
//     const booking = await Booking.findOne({ reference });
//     if (!booking) {
//       return res.redirect(
//         `${
//           process.env.FRONTEND_DEEP_LINK || process.env.FRONTEND_URL
//         }/booking?status=failed`
//       );
//     }

//     // ✅ Mark booking as paid
//     booking.paymentStatus = 'paid';
//     booking.paymentMethod = 'paystack';
//     await booking.save();

//     // ✅ Debit wallet if booking was via wallet
//     const user = await User.findById(booking.userId);
//     if (!user) {
//       return res.redirect(
//         `${
//           process.env.FRONTEND_DEEP_LINK || process.env.FRONTEND_URL
//         }/booking?status=failed`
//       );
//     }

//     // ✅ Create wallet transaction (record the debit)
//     const balanceBefore = user.walletBalance;
//     const newBalance = balanceBefore - booking.amount;

//     const transaction = new Wallet({
//       userId: user._id,
//       type: 'debit',
//       amount: booking.amount,
//       description: `Booking payment for ${booking.subject || 'tutor'}`,
//       category: 'booking',
//       balanceBefore,
//       balanceAfter: newBalance,
//     });

//     await transaction.save();

//     // Update user balance
//     user.walletBalance = newBalance;
//     await user.save();

//     // ✅ Redirect back to Expo app
//     const redirectUrl = `${
//       process.env.FRONTEND_DEEP_LINK || process.env.FRONTEND_URL
//     }/booking?status=success&amount=${booking.amount}&reference=${reference}`;

//     console.log(redirectUrl);
//     console.log('✅ Redirecting user to:', redirectUrl);
//     return res.redirect(redirectUrl);
//   } catch (error) {
//     console.log('verifyBookingPayment error:', error);
//     return res.redirect(
//       `${
//         process.env.FRONTEND_DEEP_LINK || process.env.FRONTEND_URL
//       }/booking?status=failed`
//     );
//   }
// };

////////////////////////
// const verifyBookingPayment = async (req, res) => {
//   try {
//     const { reference } = req.params;

//     // ✅ Verify with Paystack
//     const verification = await paystackService.verifyTransaction(reference);
//     console.log('Paystack verification:', verification);

//     if (!verification.success || verification.data?.status !== 'success') {
//       // return res.redirect(
//       //   `${
//       //     process.env.FRONTEND_DEEP_LINK || process.env.FRONTEND_URL
//       //   }/booking?status=failed`
//       // );

//       console.log('Error');
//     }

//     // ✅ Find booking in DB
//     const booking = await Booking.findOne({ reference });
//     if (!booking) {
//       // return res.redirect(
//       //   `${process.env.FRONTEND_DEEP_LINK || process.env.FRONTEND_URL}/booking?status=failed`
//       // );
//       console.log('No booking found');
//     }

//     // ✅ Only update if not already paid
//     if (booking.paymentStatus !== 'paid') {
//       booking.paymentStatus = 'paid';
//       booking.paymentMethod = 'paystack';
//       await booking.save();
//     }

//     // ✅ No wallet operations for Paystack payments

//     // ✅ Redirect back to app with success
//     const redirectUrl = `${
//       process.env.FRONTEND_DEEP_LINK || process.env.FRONTEND_URL
//     }/booking?status=success&amount=${booking.amount}&reference=${reference}`;

//     console.log('Redirecting to:', redirectUrl);
//     return res.redirect(redirectUrl);
//   } catch (error) {
//     console.error('verifyBookingPayment error:', error);
//     // return res.redirect(
//     //   `${process.env.FRONTEND_DEEP_LINK || process.env.FRONTEND_URL}/booking?status=failed`
//     // );
//   }
// };

///////////////////////

// const getPendingBookings = async (req, res) => {
//   try {
//     // Fetch all bookings that are awaiting admin approval
//     const bookings = await Booking.find({
//       adminConfirmed: { $ne: true }, // not yet confirmed
//       status: { $in: ['pending', 'awaiting_approval'] }, // flexible pending statuses
//     })
//       .populate('studentId', 'name email avatar')
//       .populate('tutorId', 'name email avatar')
//       .sort({ createdAt: -1 });

//     // 🧠 Transform the data for frontend (names + base64 avatar)
//     const formatted = bookings.map((b) => {
//       const tutor = b.tutorId
//         ? {
//             _id: b.tutorId._id,
//             name: b.tutorId.name,
//             email: b.tutorId.email,
//             avatar: b.tutorId.avatar?.data
//               ? `data:${
//                   b.tutorId.avatar.contentType
//                 };base64,${b.tutorId.avatar.data.toString('base64')}`
//               : null,
//           }
//         : null;

//       const student = b.studentId
//         ? {
//             _id: b.studentId._id,
//             name: b.studentId.name,
//             email: b.studentId.email,
//             avatar: b.studentId.avatar?.data
//               ? `data:${
//                   b.studentId.avatar.contentType
//                 };base64,${b.studentId.avatar.data.toString('base64')}`
//               : null,
//           }
//         : null;

//       return {
//         _id: b._id,
//         courseTitle: b.courseTitle,
//         sessionType: b.sessionType,
//         scheduledDate: b.scheduledDate,
//         status: b.status,
//         duration: b.duration,
//         amount: b.amount,
//         paymentStatus: b.paymentStatus,
//         adminConfirmed: b.adminConfirmed,
//         createdAt: b.createdAt,
//         updatedAt: b.updatedAt,
//         tutor,
//         student,
//       };
//     });

//     res.status(200).json({
//       success: true,
//       count: formatted.length,
//       bookings: formatted,
//     });
//   } catch (err) {
//     console.error('getPendingBookings error:', err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// };

// const verifyBookingPayment = async (req, res) => {
//   try {
//     const { reference } = req.params;
//     // console.log('Verifying booking with reference:', reference);

//     // ✅ Verify transaction with Paystack
//     const verification = await paystackService.verifyTransaction(reference);
//     console.log('Paystack verification:', verification);

//     if (
//       !verification.success ||
//       !verification.data ||
//       !verification.data.data ||
//       verification.data.data.status !== 'success'
//     ) {
//       // console.log('Payment verification failed for reference:', reference);
//       const redirectFail =
//         verification?.data?.data?.metadata?.redirectUrl ||
//         `eduapp/tutor/booking/${tutorId}`;
//       return res.redirect(`${redirectFail}?status=failed`);
//     }

//     // ✅ Retrieve bookingId from Paystack metadata
//     const bookingId = verification.data.data.metadata?.bookingId;
//     const redirectUrl = verification.data.data.metadata?.redirectUrl;
//     // console.log(redirectUrl);
//     if (!bookingId) {
//       // console.log(
//       //   'No bookingId found in Paystack metadata for reference:',
//       //   reference
//       // );
//       return res.redirect(`${redirectUrl}?status=failed`);
//     }

//     // ✅ Fetch booking by ID
//     const booking = await Booking.findById(bookingId);
//     if (!booking) {
//       // console.log('Booking not found for bookingId:', bookingId);
//       return res.redirect(`${redirectUrl}?status=failed`);
//     }

//     // ✅ Mark booking as paid
//     booking.paymentStatus = 'paid';
//     booking.paymentMethod = 'paystack';
//     booking.status = 'confirmed';
//     booking.paystackReference = reference;
//     booking.paystackTransactionId =
//       verification?.data?.data?.id ||
//       verification?.data?.data?.transaction ||
//       null;
//     await booking.save();

//     // Create a Session record (scheduled) if not exists
//     const existingSession = await Session.findOne({ bookingId: booking._id });
//     if (!existingSession) {
//       // fetch tutor to compute tutor/admin share
//       const tutor = await User.findById(booking.tutorId);
//       const { tutorShare, adminShare } = computeShares(booking.amount, tutor);

//       const session = await Session.create({
//         bookingId: booking._id,
//         tutorId: booking.tutorId,
//         studentId: booking.studentId,
//         scheduledDate: booking.scheduledDate,
//         duration: booking.duration,
//         amount: booking.amount,
//         tutorShare,
//         adminShare,
//         status: 'scheduled',
//       });
//       // optional: session saved
//       // session.save();
//     }

//     // ✅ Update student wallet if needed (optional)
//     const student = await User.findById(booking.studentId);
//     if (student) {
//       // You could update wallet or transaction history here if necessary
//       // console.log('Student found:', student._id);

//       const balanceBefore = student.walletBalance;
//       // not deducted, since it’s Paystack

//       const transaction = new Wallet({
//         userId: student._id,
//         type: 'debit',
//         amount: booking.amount,
//         description: `Booking payment for tutor `,
//         category: 'booking',
//         balanceBefore,
//         balanceAfter: balanceBefore,
//         paymentMethod: 'paystack',
//       });

//       await transaction.save();
//     }

//     // ✅ Redirect back to Expo app
//     const redirect = `${redirectUrl}?status=success&amount=${booking.amount}&reference=${reference}`;
//     console.log('✅ Redirecting user to:', redirect);
//     return res.redirect(redirect);
//   } catch (error) {
//     console.error('verifyBookingPayment error:', error);
//     const redirectFail =
//       verification?.data?.data?.metadata?.redirectUrl ||
//       `eduapp/tutor/booking/${tutorId}`;
//     return res.redirect(`${redirectFail}?status=failed`);
//   }
// };

// const approveBooking = async (req, res) => {
//   try {
//     const { bookingId } = req.params;
//     const { meetingLink } = req.body; // admin provides google meet link
//     const booking = await Booking.findById(bookingId);
//     if (!booking) return res.status(404).json({ message: 'Booking not found' });

//     // mark admin confirmed
//     booking.adminConfirmed = true;
//     booking.meetingLink = meetingLink;
//     booking.status = 'confirmed';
//     await booking.save();

//     // credit tutor: add tutorFee to their totalEarnings and record separately
//     const tutor = await User.findById(booking.tutorId);
//     const tutorFee = tutor.fees?.tutorFee || 0;
//     tutor.totalEarnings = (tutor.totalEarnings || 0) + Number(tutorFee);
//     await tutor.save();

//     // Optionally record an admin transaction record, notifications, etc.

//     res.json({ message: 'Booking approved', booking });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: err.message });
//   }
// };

// const getTutorBookings = async (req, res) => {
//   try {
//     const tutorId = req.user._id; // assuming you are using auth middleware

//     // Fetch bookings for this tutor that are approved by admin
//     // const bookings = await Booking.find({
//     //   tutorId,
//     //   adminConfirmed: true, // only admin approved bookings
//     //   status: 'confirmed',
//     // })
//     //   .populate('studentId', 'name email avatar')
//     //   .sort({ scheduledDate: 1 }); // upcoming first

//     // res.json({ success: true, bookings });
//     // console.log(bookings);
//     const bookings = await Booking.find({
//       tutorId,
//       adminConfirmed: true,
//       status: 'confirmed',
//     })
//       .populate('studentId', 'name email avatar')
//       .populate('tutorId', 'name email avatar')
//       .sort({ scheduledDate: 1 });

//     const formattedBookings = bookings.map((b) => {
//       const student = b.studentId;
//       const tutor = b.tutorId;

//       return {
//         _id: b._id,
//         courseTitle: b.courseTitle,
//         scheduledDate: b.scheduledDate,
//         duration: b.duration,
//         amount: b.amount,
//         sessionType: b.sessionType,
//         paymentStatus: b.paymentStatus,
//         status: b.status,
//         adminConfirmed: b.adminConfirmed,
//         meetingLink: b.meetingLink,

//         studentId: {
//           _id: student._id,
//           name: student.name,
//           email: student.email,
//           avatar: student.avatar?.url
//             ? `${req.protocol}://${req.get('host')}/${student.avatar.url}`
//             : null,
//         },

//         tutorId: {
//           _id: tutor._id,
//           name: tutor.name,
//           email: tutor.email,
//           avatar: tutor.avatar?.url
//             ? `${req.protocol}://${req.get('host')}/${tutor.avatar.url}`
//             : null,
//         },
//       };
//     });

//     res.json({ success: true, bookings: formattedBookings });
//     console.log(formattedBookings);
//   } catch (err) {
//     console.error('getTutorBookings error:', err);
//     res.status(500).json({ message: err.message });
//   }
// };

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

const getBookingDetails = async (req, res) => {
  try {
    const userId = req.user._id;
    const { bookingId } = req.params;

    const booking = await Booking.findOne({
      _id: bookingId,
      $or: [{ tutorId: userId }, { studentId: userId }],
    })
      .populate('studentId', 'name email avatar about goal')
      .populate('tutorId', 'name email avatar fees totalEarnings');

    if (!booking) {
      return res
        .status(404)
        .json({ message: 'Booking not found or unauthorized' });
    }

    // 🔹 Always allow confirmation if booking is confirmed but not completed
    const canConfirmCompletion =
      booking.status === 'confirmed' && !booking.completedAt;

    const { tutorId: tutor, studentId: student } = booking;

    const responseData = {
      _id: booking._id,
      courseTitle: booking.courseTitle,
      scheduledDate: booking.scheduledDate,
      duration: booking.duration,
      amount: booking.amount,
      sessionType: booking.sessionType,
      paymentStatus: booking.paymentStatus,
      status: booking.status,
      reference: booking.reference,
      adminConfirmed: booking.adminConfirmed,
      meetingLink: booking.adminConfirmed ? booking.meetingLink : null,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,

      // ✅ Always show confirm button if not completed
      canConfirmCompletion,

      tutor: {
        _id: tutor._id,
        name: tutor.name,
        email: tutor.email,
        avatar: tutor.avatar || null,
        totalEarnings: tutor.totalEarnings || 0,
      },
      student: {
        _id: student._id,
        name: student.name,
        email: student.email,
        about: student.about,
        goal: student.goal,
        avatar:
          student.avatar?.data && student.avatar?.contentType
            ? `data:${
                student.avatar.contentType
              };base64,${student.avatar.data.toString('base64')}`
            : null,
      },
    };

    res.json({ success: true, booking: responseData });
  } catch (err) {
    console.error('getBookingDetails error:', err);
    res.status(500).json({ message: err.message });
  }
};

const approveBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { meetingLink } = req.body;

    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.adminConfirmed)
      return res.status(400).json({ message: 'Booking already approved' });

    const tutor = await User.findById(booking.tutorId);
    if (!tutor) return res.status(404).json({ message: 'Tutor not found' });

    const student = await User.findById(booking.studentId);
    if (!student) return res.status(404).json({ message: 'Student not found' });

    const tutorFee = tutor.fees?.tutorFee || 0;

    // Update booking
    booking.adminConfirmed = true;
    booking.meetingLink = meetingLink;
    booking.status = 'confirmed';
    await booking.save();

    // Credit tutor
    tutor.totalEarnings = (tutor.totalEarnings || 0) + Number(tutorFee);
    await tutor.save();

    // Notify student
    await NotificationService.send({
      userId: booking.studentId,
      title: 'Booking Approved',
      message: `Your session with ${tutor.name} is confirmed. Meeting link: ${meetingLink}`,
    });

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
        message: 'Failed to send verification email. Please try again later.',
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
        message: 'Failed to send verification email. Please try again later.',
        error: mailErr.message,
      });
    }

    // Return updated booking with populated student
    const updatedBooking = await Booking.findById(bookingId).populate(
      'studentId',
      'firstName lastName email avatar'
    );

    res.json({ message: 'Booking approved', booking: updatedBooking });
  } catch (err) {
    console.error('approveBooking error:', err);
    res.status(500).json({ message: err.message });
  }
};

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
