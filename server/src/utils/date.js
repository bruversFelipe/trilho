export function toDateOnlyString(date) {
  const d = new Date(date);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

export function parseDateOnly(str) {
  // Interpret "YYYY-MM-DD" as UTC midnight so day-of-week math is stable.
  return new Date(`${str}T00:00:00.000Z`);
}

export function isSameDay(a, b) {
  return toDateOnlyString(a) === toDateOnlyString(b);
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function startOfWeek(date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const day = d.getUTCDay(); // 0=Sun .. 6=Sat
  return addDays(d, -day); // Sunday (UTC) of the same week
}

export function timeToMinutes(time) {
  if (!time) return null;
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function eachDayInRange(start, end) {
  const days = [];
  let cursor = new Date(start);
  cursor.setUTCHours(0, 0, 0, 0);
  const last = new Date(end);
  last.setUTCHours(0, 0, 0, 0);

  while (cursor <= last) {
    days.push(new Date(cursor));
    cursor = addDays(cursor, 1);
  }
  return days;
}
