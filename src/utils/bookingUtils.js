// returns whether two time intervals overlap
function isOverlap(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

// given a tutor.availability item and a date (day-of-week), generate Date start times for that day
// availability item: { day: 'Monday', from: '4:30', to: '17:30', ampmFrom: 'PM', ampmTo: 'PM', active: true }
// Assumes from/to are 'HH:MM' strings in 12-hour format — adjust as needed in your app.
function buildSlotsForDate(
  availabilityItem,
  targetDate,
  sessionDurationMinutes = 60
) {
  if (!availabilityItem.active) return [];
  // targetDate is a Date object for the day we want
  const [fromH, fromM] = availabilityItem.from.split(':').map(Number);
  const [toH, toM] = availabilityItem.to.split(':').map(Number);

  // convert grammar to 24h
  const fromHour24 =
    availabilityItem.ampmFrom === 'PM' && fromH !== 12
      ? fromH + 12
      : fromH === 12 && availabilityItem.ampmFrom === 'AM'
      ? 0
      : fromH;
  const toHour24 =
    availabilityItem.ampmTo === 'PM' && toH !== 12
      ? toH + 12
      : toH === 12 && availabilityItem.ampmTo === 'AM'
      ? 0
      : toH;

  const start = new Date(targetDate);
  start.setHours(fromHour24, fromM || 0, 0, 0);

  const end = new Date(targetDate);
  end.setHours(toHour24, toM || 0, 0, 0);

  const slots = [];
  const slotDurationMs = sessionDurationMinutes * 60 * 1000;
  let cursor = new Date(start);
  while (cursor.getTime() + slotDurationMs <= end.getTime()) {
    slots.push({
      start: new Date(cursor),
      end: new Date(cursor.getTime() + slotDurationMs),
    });
    cursor = new Date(cursor.getTime() + slotDurationMs);
  }
  return slots;
}

module.exports = { isOverlap, buildSlotsForDate };
