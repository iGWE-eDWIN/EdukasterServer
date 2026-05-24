function calculateFees(tutorFee, percentage = 15) {
  const adminFee = Math.round((tutorFee * percentage) / 100);

  return {
    tutorFee,
    adminFee,
    totalFee: tutorFee,
    percentage,
  };
}
