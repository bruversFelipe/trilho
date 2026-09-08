// Calendar days in this app are plain dates with no time-of-day meaning (a task's
// `date`, a week's start, a month's grid cell). The API always represents them as
// UTC midnight for that calendar day (e.g. picking "2026-09-03" in a date input
// becomes 2026-09-03T00:00:00.000Z on the server). Every helper below reads/writes
// those values using UTC getters/setters so a "calendar day" means the same thing
// everywhere, regardless of the viewer's own timezone. The one bridge from the
// viewer's real local clock into this UTC-anchored world is `today()`.

export const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
export const MONTH_LABELS = [
  'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

/** The viewer's real "today", anchored as a UTC-midnight calendar day so it plugs
 * into the rest of these (UTC-based) helpers. Uses local getters on purpose - this
 * is the only place "today" should be derived from the browser's wall clock. */
export function today() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

export function dateKey(date) {
  const d = new Date(date);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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
  return addDays(d, -day); // Sunday of the same week
}

export function startOfMonth(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function addMonths(date, count) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + count, 1));
}

export function isSameDay(a, b) {
  return dateKey(a) === dateKey(b);
}

export function isToday(date) {
  return isSameDay(date, today());
}

export function getWeekDays(weekStart) {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

/** Returns an array of 6 weeks (each 7 days) fully covering the month of `monthStart`. */
export function getMonthGrid(monthStart) {
  const gridStart = startOfWeek(monthStart);
  const weeks = [];
  let cursor = gridStart;
  for (let w = 0; w < 6; w++) {
    weeks.push(getWeekDays(cursor));
    cursor = addDays(cursor, 7);
  }
  return weeks;
}

export function formatWeekRangeLabel(weekStart) {
  const end = addDays(weekStart, 6);
  const sameMonth = weekStart.getUTCMonth() === end.getUTCMonth();
  const startLabel = `${weekStart.getUTCDate()}`;
  const endLabel = `${end.getUTCDate()} de ${MONTH_LABELS[end.getUTCMonth()]}`;
  return sameMonth
    ? `${startLabel} - ${endLabel} de ${weekStart.getUTCFullYear()}`
    : `${startLabel} de ${MONTH_LABELS[weekStart.getUTCMonth()]} - ${endLabel}`;
}

export function timeToMinutes(time) {
  if (!time) return null;
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}
