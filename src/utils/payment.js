function computeShares(bookingAmount, tutor) {
  const hasCustomFees =
    tutor?.fees &&
    typeof tutor.fees.totalFee === 'number' &&
    tutor.fees.totalFee > 0;

  // --- CASE 1: CUSTOM FEES SET IN USER MODEL ---
  if (hasCustomFees) {
    const tutorShare = Number(tutor.fees.tutorFee || 0);
    const adminShare = Number(tutor.fees.adminFee || 0);

    return {
      tutorShare,
      adminShare,
      method: 'custom',
    };
  }

  // --- CASE 2: FALLBACK SPLIT (80/20) ---
  const tutorShare = Math.round(bookingAmount * 0.8);
  const adminShare = bookingAmount - tutorShare;

  return {
    tutorShare,
    adminShare,
    method: 'default',
  };
}

module.exports = { computeShares };
