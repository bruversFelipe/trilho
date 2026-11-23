// Pure math behind dragging a task to a new day/time in the week view (see
// hooks/useTaskDrag.js for the pointer/keyboard state machine that uses these).
// Dates follow the app-wide rule: calendar days are UTC-midnight tokens.
import { dateKey, minutesToTime, timeToMinutes } from './date.js';

export const DRAG_SNAP_MINUTES = 15;
export const LAST_MINUTE = 23 * 60 + 59; // a task may end at 23:59 at the latest
export const MOVE_CANCELLED = 'Movimento cancelado';

// Spoken (aria-live) names, with accents on purpose so screen readers pronounce them.
const SPOKEN_WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

/** 'timed' = a block in the hour grid; 'strip' = all-day chip or ToDo in the top
 * strip (same split as WeekView's byDay). Strip items only ever change day. */
export function dragKind(task) {
  return task.startTime && !task.allDay && !task.isTodo ? 'timed' : 'strip';
}

/** Start and duration in minutes. A task without endTime has duration 0 here (it
 * moves by its start only and stays end-less), even though it's drawn as 1h. */
export function taskSpan(task) {
  const start = timeToMinutes(task.startTime) ?? 0;
  const hasEnd = !!task.endTime;
  const duration = hasEnd ? Math.max(0, timeToMinutes(task.endTime) - start) : 0;
  return { start, duration, hasEnd };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/** Rounds to the nearest 15 min, then keeps start >= 00:00 and end <= 23:59. */
export function snapAndClampStart(rawStart, duration) {
  const snapped = Math.round(rawStart / DRAG_SNAP_MINUTES) * DRAG_SNAP_MINUTES;
  return clamp(snapped, 0, LAST_MINUTE - duration);
}

/** Index of the column under clientX; outside the columns it sticks to the nearest end. */
export function pickDayIndex(clientX, columns) {
  const index = columns.findIndex((col) => clientX >= col.left && clientX < col.right);
  if (index !== -1) return index;
  return clientX < columns[0].left ? 0 : columns.length - 1;
}

/** Keyboard move: arrows up/down = -/+15 min (timed only), left/right = -/+1 visible
 * day. Returns null for keys it doesn't handle, so the caller leaves them alone. */
export function stepKeyboardTarget(target, key, { kind, duration, dayCount }) {
  switch (key) {
    case 'ArrowUp':
    case 'ArrowDown': {
      if (kind !== 'timed') return null;
      const delta = key === 'ArrowUp' ? -DRAG_SNAP_MINUTES : DRAG_SNAP_MINUTES;
      return { dayIndex: target.dayIndex, startMin: snapAndClampStart(target.startMin + delta, duration) };
    }
    case 'ArrowLeft':
    case 'ArrowRight': {
      const delta = key === 'ArrowLeft' ? -1 : 1;
      return { dayIndex: clamp(target.dayIndex + delta, 0, dayCount - 1), startMin: target.startMin };
    }
    default:
      return null;
  }
}

/** The PUT /tasks/:id fields for moving `task` to `target`, or null if it wouldn't change. */
export function buildMovePatch(task, { date, startMin }) {
  const newDate = dateKey(date);
  const sameDay = newDate === dateKey(task.date);

  if (dragKind(task) === 'strip') {
    return sameDay ? null : { date: newDate };
  }

  const { start, duration, hasEnd } = taskSpan(task);
  if (sameDay && startMin === start) return null;
  return {
    date: newDate,
    startTime: minutesToTime(startMin),
    endTime: hasEnd ? minutesToTime(startMin + duration) : null,
  };
}

/** Optimistic view: tasks with a pending move drawn at their new day/time until the
 * refetch lands. `pending` is Map<occurrenceId, patch>. */
export function applyPendingMoves(tasks, pending) {
  if (pending.size === 0) return tasks;
  return tasks.map((task) => {
    const patch = pending.get(task.occurrenceId);
    if (!patch) return task;
    const moved = { ...task, date: new Date(patch.date) };
    if (patch.startTime !== undefined) moved.startTime = patch.startTime;
    if (patch.endTime !== undefined) moved.endTime = patch.endTime;
    return moved;
  });
}

function spokenSlot(date, startMin) {
  const day = SPOKEN_WEEKDAYS[date.getUTCDay()];
  return startMin == null ? day : `${day}, ${minutesToTime(startMin)}`;
}

/** "Academia, quarta, 10:15" - announced at each keyboard step. */
export function describeTarget(task, date, startMin) {
  return `${task.title}, ${spokenSlot(date, startMin)}`;
}

/** "Movida para quarta, 10:15" ("Movido" for a ToDo) - announced on drop. */
export function describeDrop(task, date, startMin) {
  return `${task.isTodo ? 'Movido' : 'Movida'} para ${spokenSlot(date, startMin)}`;
}

/** Auto-scroll speed (px per frame) while dragging near the scroller's edges:
 * negative near/above the top, positive near/below the bottom, 0 in between. */
export function autoScrollDelta(pointerY, topEdge, bottomEdge, zone = 48, maxSpeed = 16) {
  if (pointerY < topEdge + zone) {
    return -maxSpeed * Math.min(1, (topEdge + zone - pointerY) / zone);
  }
  if (pointerY > bottomEdge - zone) {
    return maxSpeed * Math.min(1, (pointerY - (bottomEdge - zone)) / zone);
  }
  return 0;
}
