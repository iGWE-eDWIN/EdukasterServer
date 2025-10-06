const formatUser = (user) => {
  if (!user) return null;

  const userObj = user.toObject();

  if (userObj.avatar && userObj.avatar.data) {
    userObj.avatar = `data:${
      userObj.avatar.contentType
    };base64,${userObj.avatar.data.toString('base64')}`;
  } else {
    userObj.avatar = null; // or default placeholder
  }

  delete userObj.password; // never send password
  delete userObj.tokens; // optional, hide tokens array

  // Ensure availability is fully included
  if (userObj.availability && userObj.availability.length > 0) {
    userObj.availability = userObj.availability.map((slot) => ({
      day: slot.day,
      from: slot.from,
      to: slot.to,
      ampmFrom: slot.ampmFrom,
      ampmTo: slot.ampmTo,
      active: slot.active,
    }));
  } else {
    userObj.availability = [];
  }
  return userObj;
};

const isTutorAvailable = (tutor, day, currentTime, ampm) => {
  if (!tutor.availability) return false;

  return tutor.availability.some((slot) => {
    if (!slot.active) return false;
    if (slot.day !== day) return false;
    if (slot.day !== day) return false;
    if (!slot.from || !slot.to) return false;

    // // Compare AM/PM
    // if (slot.ampmFrom !== ampm || slot.ampmTo !== ampm) {
    //   return false;
    // }

    // Convert to minutes for easier comparison
    // const timeToMinutes = (time) => {
    //   const [h, m] = time.split(':').map(Number);
    //   return h * 60 + (m || 0);
    // };

    // const now = timeToMinutes(currentTime);
    // const from = timeToMinutes(slot.from);
    // const to = timeToMinutes(slot.to);

    // Convert time string + AM/PM to minutes (0–1439)
    const timeToMinutes = (time, period) => {
      let [h, m] = time.split(':').map(Number);
      if (!m) m = 0;
      if (period === 'PM' && h !== 12) h += 12;
      if (period === 'AM' && h === 12) h = 0;
      return h * 60 + m;
    };

    const now = timeToMinutes(currentTime, ampm);
    const from = timeToMinutes(slot.from, slot.ampmFrom);
    const to = timeToMinutes(slot.to, slot.ampmTo);

    return now >= from && now <= to;
  });
};

module.exports = { formatUser, isTutorAvailable };
