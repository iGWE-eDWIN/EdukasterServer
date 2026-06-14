// controllers/sessions.js
const mongoose = require('mongoose');
const Booking = require('../models/booking');
const Session = require('../models/session');
const User = require('../models/user');
const Wallet = require('../models/wallet'); // transaction model
const { computeShares } = require('../utils/payment');



// const completeBooking = async (req, res) => {
//   const userId = req.user._id;
//   const bookingId = req.params.id;

//   const session = await mongoose.startSession();

//   try {
//     session.startTransaction();

//     // 🔹 Fetch booking
//     const booking = await Booking.findById(bookingId).session(session);
//     if (!booking) {
//       throw { status: 404, message: 'Booking not found' };
//     }

//     const isGroup = booking.type === 'group';

//     // 🔹 Authorization
//     if (!isGroup) {
//       // 1–1 session
//       if (String(booking.studentId) !== String(userId)) {
//         throw { status: 403, message: 'Not authorized' };
//       }
//     } else {
//       // Group session
//       const isParticipant = booking.participants?.some(
//         (id) => String(id) === String(userId),
//       );

//       if (!isParticipant) {
//         throw {
//           status: 403,
//           message: 'Not authorized for this group session',
//         };
//       }
//     }

//     // 🔹 Prevent double completion
//     if (booking.status === 'completed') {
//       throw { status: 400, message: 'Booking already completed' };
//     }

//     // 🔹 Optional: Ensure session was approved first
//     if (booking.status !== 'approved') {
//       throw {
//         status: 400,
//         message: 'Only approved sessions can be completed',
//       };
//     }

//     // 🔹 Fetch tutor
//     const tutor = await User.findById(booking.tutorId).session(session);
//     if (!tutor) {
//       throw { status: 404, message: 'Tutor not found' };
//     }

//     // 🔹 Compute shares
//     const { tutorShare, adminShare } = computeShares(booking.amount, tutor);

//     // 🔹 Create or update Session record
//     let sess = await Session.findOne({ bookingId: booking._id }).session(
//       session,
//     );

//     if (!sess) {
//       const created = await Session.create(
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
//         { session },
//       );

//       sess = created[0];
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

//     // 🔥 CREDIT TUTOR ONLY FOR 1–1 SESSION
//     if (!isGroup) {
//       const balanceBefore = tutor.walletBalance || 0;

//       tutor.walletBalance = balanceBefore + tutorShare;
//       tutor.totalEarnings = (tutor.totalEarnings || 0) + tutorShare;

//       await tutor.save({ session });

//       // Fetch student name
//       const student = await User.findById(booking.studentId)
//         .select('name')
//         .session(session);

//       await Wallet.create(
//         [
//           {
//             userId: tutor._id,
//             type: 'credit',
//             amount: tutorShare,
//             description: `Payout for completed session with ${
//               student?.name || 'student'
//             }`,
//             category: 'payout',
//             balanceBefore,
//             balanceAfter: tutor.walletBalance,
//             metadata: {
//               bookingId: booking._id,
//               sessionId: sess._id,
//               studentName: student?.name || null,
//             },
//           },
//         ],
//         { session },
//       );
//     }

//     await session.commitTransaction();
//     session.endSession();

//     return res.json({
//       success: true,
//       message: isGroup
//         ? 'Group session confirmed. Awaiting admin payout.'
//         : 'Booking confirmed successfully. Tutor credited.',
//       booking,
//       session: sess,
//     });
//   } catch (err) {
//     await session.abortTransaction();
//     session.endSession();

//     console.error('completeBooking error:', err);

//     return res.status(err.status || 500).json({
//       message: err.message || 'Unable to complete booking',
//     });
//   }
// };


const AppError = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

const completeBooking = async (req, res) => {
  const userId = req.user._id;
  const bookingId = req.params.id;

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const booking = await Booking.findById(bookingId).session(session);
    if (!booking) throw AppError(404, 'Booking not found');

    const isGroup = booking.sessionType === 'group';

    if (!isGroup) {
      if (String(booking.studentId) !== String(userId)) {
        throw AppError(403, 'Not authorized');
      }
    } else {
      const isParticipant = booking.groupStudents?.some(
        (item) => String(item.student) === String(userId),
      );

      if (!isParticipant) {
        throw AppError(403, 'Not authorized for this group session');
      }
    }

    if (booking.status === 'completed') {
      throw AppError(400, 'Booking already completed');
    }

    if (booking.status !== 'confirmed') {
      throw AppError(400, 'Only confirmed sessions can be completed');
    }

    const tutor = await User.findById(booking.tutorId).session(session);
    if (!tutor) throw AppError(404, 'Tutor not found');

    const { tutorShare, adminShare } = computeShares(booking.amount, tutor);

    let sess = await Session.findOne({ bookingId: booking._id }).session(session);

    if (!sess) {
      const created = await Session.create(
        [{
          bookingId: booking._id,
          tutorId: booking.tutorId,
          studentId: booking.studentId,
          scheduledDate: booking.scheduledDate,
          duration: booking.duration,
          amount: booking.amount,
          tutorShare,
          adminShare,
          status: 'completed',
          completedAt: new Date(),
        }],
        { session }
      );

      sess = created[0];
    }

    booking.status = 'completed';
    booking.completedAt = new Date();
    await booking.save({ session });

    if (!isGroup) {
      const balanceBefore = tutor.walletBalance || 0;

      tutor.walletBalance = balanceBefore + tutorShare;
      tutor.totalEarnings = (tutor.totalEarnings || 0) + tutorShare;

      await tutor.save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    return res.json({
      success: true,
      message: 'Session completed successfully',
      booking,
      session: sess,
    });

  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    console.error('completeBooking error:', err);

    return res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Unable to complete booking',
    });
  }
};

module.exports = { completeBooking };
