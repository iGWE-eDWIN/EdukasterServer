// controllers/sessions.js
const mongoose = require('mongoose');
const Booking = require('../models/booking');
const Session = require('../models/session');
const User = require('../models/user');
const Wallet = require('../models/wallet'); // transaction model
const { computeShares } = require('../utils/payment');

// const completeBooking = async (req, res) => {
//   const userId = req.user._id; // student confirming completion
//   const bookingId = req.params.id;

//   const session = await mongoose.startSession();
//   try {
//     session.startTransaction();

//     const booking = await Booking.findById(bookingId).session(session);
//     if (!booking) {
//       await session.abortTransaction();
//       return res.status(404).json({ message: 'Booking not found' });
//     }

//     if (String(booking.studentId) !== String(userId)) {
//       await session.abortTransaction();
//       return res.status(403).json({ message: 'Not authorized' });
//     }

//     if (booking.status !== 'confirmed') {
//       await session.abortTransaction();
//       return res
//         .status(400)
//         .json({ message: 'Booking is not in a confirmable state' });
//     }

//     const scheduledEnd = new Date(booking.scheduledDate);
//     scheduledEnd.setMinutes(
//       scheduledEnd.getMinutes() + (booking.duration || 60)
//     );
//     const now = new Date();
//     const allowedConfirmAfter = new Date(
//       scheduledEnd.getTime() + 2 * 60 * 60 * 1000 // 30
//     );

//     if (now < scheduledEnd) {
//       await session.abortTransaction();
//       return res.status(400).json({ message: 'Session has not completed yet' });
//     }
//     if (now > allowedConfirmAfter) {
//       // depending on policy, allow or disallow late confirmations; here we allow but you may restrict
//     }

//     // Create or update session
//     let sess = await Session.findOne({ bookingId: booking._id }).session(
//       session
//     );
//     const tutor = await User.findById(booking.tutorId).session(session);
//     if (!tutor) {
//       await session.abortTransaction();
//       return res.status(404).json({ message: 'Tutor not found' });
//     }

//     const { tutorShare, adminShare } = computeShares(booking.amount, tutor);

//     if (!sess) {
//       sess = await Session.create(
//         [
//           {
//             bookingId: booking._id,
//             tutorId: booking.tutorId,
//             studentId: booking.studentId,
//             scheduledDate: booking.scheduledDate,
//             duration: booking.duration,
//             amount: booking.amount,
//             tutorShare,
//             adminShare,
//             status: 'completed',
//             completedAt: new Date(),
//           },
//         ],
//         { session }
//       );
//       sess = sess[0];
//     } else {
//       sess.status = 'completed';
//       sess.completedAt = new Date();
//       sess.tutorShare = tutorShare;
//       sess.adminShare = adminShare;
//       await sess.save({ session });
//     }

//     // Update booking
//     booking.status = 'completed';
//     booking.completedAt = new Date();
//     await booking.save({ session });

//     // Credit tutor wallet balance and create Wallet transaction
//     const balanceBefore = tutor.walletBalance || 0;
//     tutor.walletBalance = (tutor.walletBalance || 0) + tutorShare;
//     tutor.totalEarnings = (tutor.totalEarnings || 0) + tutorShare;
//     await tutor.save({ session });

//     const walletTx = new Wallet({
//       userId: tutor._id,
//       type: 'credit',
//       amount: tutorShare,
//       description: `Payout for completed session (booking ${booking._id})`,
//       category: 'payout',
//       balanceBefore,
//       balanceAfter: tutor.walletBalance,
//       metadata: {
//         bookingId: booking._id,
//         sessionId: sess._id,
//       },
//     });

//     await walletTx.save({ session });

//     await session.commitTransaction();
//     session.endSession();

//     return res.json({
//       success: true,
//       message: 'Session completed and tutor credited',
//       booking,
//       session: sess,
//     });
//   } catch (err) {
//     console.error('completeBooking error', err);
//     await session.abortTransaction();
//     session.endSession();
//     return res.status(500).json({ message: 'Unable to complete session' });
//   }
// };

// const completeBooking = async (req, res) => {
//   const userId = req.user._id; // student confirming completion
//   const bookingId = req.params.id;

//   const session = await mongoose.startSession();
//   try {
//     session.startTransaction();

//     // 🔹 Fetch booking
//     const booking = await Booking.findById(bookingId).session(session);
//     if (!booking) {
//       await session.abortTransaction();
//       return res.status(404).json({ message: 'Booking not found' });
//     }

//     // 🔹 Check authorization
//     if (String(booking.studentId) !== String(userId)) {
//       await session.abortTransaction();
//       return res.status(403).json({ message: 'Not authorized' });
//     }

//     // 🔹 Ensure booking is confirmable
//     if (booking.status === 'completed') {
//       await session.abortTransaction();
//       return res.status(400).json({ message: 'Booking already completed' });
//     }

//     // 🔹 Fetch tutor
//     const tutor = await User.findById(booking.tutorId).session(session);
//     if (!tutor) {
//       await session.abortTransaction();
//       return res.status(404).json({ message: 'Tutor not found' });
//     }

//     // 🔹 Compute shares
//     const { tutorShare, adminShare } = computeShares(booking.amount, tutor);

//     // 🔹 Create or update session
//     let sess = await Session.findOne({ bookingId: booking._id }).session(
//       session
//     );
//     if (!sess) {
//       sess = await Session.create(
//         [
//           {
//             bookingId: booking._id,
//             tutorId: booking.tutorId,
//             studentId: booking.studentId,
//             scheduledDate: booking.scheduledDate,
//             duration: booking.duration,
//             amount: booking.amount,
//             tutorShare,
//             adminShare,
//             status: 'completed',
//             completedAt: new Date(),
//           },
//         ],
//         { session }
//       );
//       sess = sess[0];
//     } else {
//       sess.status = 'completed';
//       sess.completedAt = new Date();
//       sess.tutorShare = tutorShare;
//       sess.adminShare = adminShare;
//       await sess.save({ session });
//     }

//     // 🔹 Update booking
//     booking.status = 'completed';
//     booking.completedAt = new Date();
//     await booking.save({ session });

//     // 🔹 Credit tutor wallet
//     const balanceBefore = tutor.walletBalance || 0;
//     tutor.walletBalance = (tutor.walletBalance || 0) + tutorShare;
//     tutor.totalEarnings = (tutor.totalEarnings || 0) + tutorShare;
//     await tutor.save({ session });

//     // 🔹 Fetch student name
//     const student = await User.findById(booking.studentId)
//       .select('name')
//       .session(session);

//     // 🔹 Create wallet transaction
//     const walletTx = new Wallet({
//       userId: tutor._id,
//       type: 'credit',
//       amount: tutorShare,
//       // description: `Payout for completed session (booking ${booking._id})`,
//       description: `Payout for completed session with ${
//         student?.name || 'student'
//       }`,
//       category: 'payout',
//       category: 'payout',
//       balanceBefore,
//       balanceAfter: tutor.walletBalance,
//       metadata: {
//         bookingId: booking._id,
//         sessionId: sess._id,
//         studentName: student?.name || null,
//       },
//     });
//     await walletTx.save({ session });

//     await session.commitTransaction();
//     session.endSession();

//     return res.json({
//       success: true,
//       message: 'Booking confirmed successfully. Tutor credited.',
//       booking,
//       session: sess,
//     });
//   } catch (err) {
//     console.error('completeBooking error', err);
//     await session.abortTransaction();
//     session.endSession();
//     return res.status(500).json({ message: 'Unable to complete booking' });
//   }
// };

const completeBooking = async (req, res) => {
  const userId = req.user._id;
  const bookingId = req.params.id;

  const booking = await Booking.findById(bookingId);
  if (!booking) return res.status(404).json({ message: 'Booking not found' });

  // 🔹 Check authorization
  if (
    booking.sessionType === '1on1' &&
    String(booking.studentId) !== String(userId)
  ) {
    return res.status(403).json({ message: 'Not authorized' });
  }
  if (
    booking.sessionType === 'group' &&
    !booking.groupStudents.includes(userId)
  ) {
    return res.status(403).json({ message: 'Not authorized' });
  }

  if (booking.status === 'completed')
    return res.status(400).json({ message: 'Booking already completed' });

  booking.status = 'completed';
  booking.completedAt = new Date();
  await booking.save();

  // 🔹 Tutor NOT credited automatically if group
  if (booking.sessionType === '1on1') {
    const tutor = await User.findById(booking.tutorId);
    const { tutorShare } = computeShares(booking.amount, tutor);
    tutor.totalEarnings += tutorShare;
    tutor.walletBalance = (tutor.walletBalance || 0) + tutorShare;
    await tutor.save();

    await Wallet.create({
      userId: tutor._id,
      type: 'credit',
      amount: tutorShare,
      description: `Payout for completed session with ${req.user.name}`,
      category: 'payout',
    });
  }

  return res.json({
    success: true,
    message: 'Booking marked as completed',
    booking,
  });
};

// const payGroupSessionTutor = async (req, res) => {
//   const booking = await Booking.findById(req.params.id);
//   if (!booking || booking.sessionType !== 'group') {
//     return res.status(404).json({ message: 'Group session not found' });
//   }

//   const tutor = await User.findById(booking.tutorId);
//   const totalAmount = booking.amount * booking.groupStudents.length;

//   tutor.totalEarnings = (tutor.totalEarnings || 0) + totalAmount;
//   tutor.walletBalance = (tutor.walletBalance || 0) + totalAmount;
//   await tutor.save();

//   await Wallet.create({
//     userId: tutor._id,
//     type: 'credit',
//     amount: totalAmount,
//     description: `Admin payout for English Proficiency session`,
//     category: 'payout',
//   });

//   res.json({ success: true, message: 'Tutor credited successfully', tutor });
// };

module.exports = { completeBooking };
