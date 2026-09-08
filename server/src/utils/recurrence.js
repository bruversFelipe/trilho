import { eachDayInRange, isSameDay, startOfWeek, toDateOnlyString } from './date.js';

/**
 * Expands a list of Task documents into concrete occurrences within [rangeStart, rangeEnd].
 * Non-recurring tasks pass through if their date falls in range.
 * Recurring tasks generate one virtual occurrence per matching weekday, without
 * creating new documents - completion state is looked up from completedDates.
 */
export function expandTasks(tasks, rangeStart, rangeEnd) {
  const days = eachDayInRange(rangeStart, rangeEnd);
  const occurrences = [];

  for (const task of tasks) {
    if (!task.recurrence?.enabled) {
      const inRange = days.some((day) => isSameDay(day, task.date));
      if (inRange) {
        occurrences.push(toOccurrence(task, task.date));
      }
      continue;
    }

    // Anchor to the start of the week the task was created in, not the exact day -
    // otherwise picking e.g. Thursday as the reference date for a Mon/Wed/Fri series
    // would hide that same week's Monday and Wednesday occurrences.
    const seriesStart = startOfWeek(task.date);
    const seriesEnd = task.recurrence.endDate ? new Date(task.recurrence.endDate) : null;
    if (seriesEnd) seriesEnd.setUTCHours(23, 59, 59, 999);

    for (const day of days) {
      if (day < seriesStart) continue;
      if (seriesEnd && day > seriesEnd) continue;
      if (!task.recurrence.daysOfWeek.includes(day.getUTCDay())) continue;

      occurrences.push(toOccurrence(task, day));
    }
  }

  return occurrences;
}

function toOccurrence(task, occurrenceDate) {
  const dateStr = toDateOnlyString(occurrenceDate);
  const plain = typeof task.toObject === 'function' ? task.toObject() : task;
  const isCompleted =
    plain.completedDates?.some((d) => toDateOnlyString(d) === dateStr) ?? false;

  return {
    ...plain,
    _id: plain._id,
    occurrenceId: `${plain._id}_${dateStr}`,
    date: occurrenceDate,
    completed: plain.recurrence?.enabled ? isCompleted : plain.completed,
  };
}
