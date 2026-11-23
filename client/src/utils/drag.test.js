import { test } from 'node:test';
import assert from 'node:assert/strict';
import { minutesToTime } from './date.js';
import {
  applyPendingMoves,
  autoScrollDelta,
  buildMovePatch,
  describeDrop,
  describeTarget,
  dragKind,
  dragStartMin,
  pickDayIndex,
  snapAndClampStart,
  stepKeyboardTarget,
  taskSpan,
} from './drag.js';

const WED = new Date(Date.UTC(2026, 10, 25)); // quarta
const MON = new Date(Date.UTC(2026, 10, 23)); // segunda
const timed = { occurrenceId: 'a_2026-11-23', title: 'Academia', date: MON, startTime: '10:00', endTime: '11:00' };
const noEnd = { ...timed, endTime: null };
const todo = { occurrenceId: 't_2026-11-23', title: 'Ligar', date: MON, isTodo: true, allDay: true, startTime: null };
const cols = [
  { left: 40, right: 100 },
  { left: 100, right: 160 },
  { left: 160, right: 220 },
];

test('minutesToTime formats minutes since midnight as HH:MM', () => {
  assert.equal(minutesToTime(615), '10:15');
  assert.equal(minutesToTime(0), '00:00');
});

test('dragKind and taskSpan', () => {
  assert.equal(dragKind(timed), 'timed');
  assert.equal(dragKind(todo), 'strip');
  assert.equal(dragKind({ ...timed, allDay: true }), 'strip');
  assert.deepEqual(taskSpan(timed), { start: 600, duration: 60, hasEnd: true });
  assert.deepEqual(taskSpan(noEnd), { start: 600, duration: 0, hasEnd: false });
  assert.deepEqual(taskSpan({ ...timed, endTime: '09:00' }), { start: 600, duration: 0, hasEnd: true });
});

test('snapAndClampStart snaps to 15 min and keeps the task inside the day', () => {
  assert.equal(snapAndClampStart(602, 60), 600);
  assert.equal(snapAndClampStart(608, 60), 615);
  assert.equal(snapAndClampStart(-20, 60), 0);
  assert.equal(snapAndClampStart(1430, 60), 1379);
  assert.equal(snapAndClampStart(1430, 0), 1425);
  assert.equal(snapAndClampStart(1438, 0), 1439);
});

test('pickDayIndex picks the column under the pointer, clamped to the visible ones', () => {
  assert.equal(pickDayIndex(120, cols), 1);
  assert.equal(pickDayIndex(10, cols), 0);
  assert.equal(pickDayIndex(999, cols), 2);
  assert.equal(pickDayIndex(999, [cols[0]]), 0); // "Dia" density
});

test('pickDayIndex assigns the gap between strip cells to a neighbour, not the last day', () => {
  const gapped = [
    { left: 44, right: 100 },
    { left: 102, right: 158 },
    { left: 160, right: 216 },
  ];
  assert.equal(pickDayIndex(101, gapped), 1);
  assert.equal(pickDayIndex(159, gapped), 2);
  assert.equal(pickDayIndex(50, gapped), 0);
});

test('dragStartMin keeps an off-grid start when the pointer is back near it', () => {
  const span = { start: 607, duration: 60, hasEnd: true }; // 10:07
  assert.equal(dragStartMin(607, span), 607);
  assert.equal(dragStartMin(611, span), 607);
  assert.equal(dragStartMin(601, span), 607);
  assert.equal(dragStartMin(620, span), 615);
  assert.equal(dragStartMin(592, span), 585);
  assert.equal(buildMovePatch({ ...timed, startTime: '10:07', endTime: '11:07' }, { date: MON, startMin: 607 }), null);
});

test('buildMovePatch shifts the end of an overnight task instead of dropping it', () => {
  const overnight = { ...timed, startTime: '23:00', endTime: '00:30' };
  assert.deepEqual(buildMovePatch(overnight, { date: MON, startMin: 22 * 60 }), {
    date: '2026-11-23',
    startTime: '22:00',
    endTime: '23:30',
  });
  assert.deepEqual(buildMovePatch(overnight, { date: MON, startMin: 23 * 60 + 30 }), {
    date: '2026-11-23',
    startTime: '23:30',
    endTime: '01:00',
  });
});

test('stepKeyboardTarget moves 15 min / 1 day and ignores other keys', () => {
  const opts = { kind: 'timed', duration: 60, dayCount: 7 };
  assert.deepEqual(stepKeyboardTarget({ dayIndex: 1, startMin: 600 }, 'ArrowDown', opts), { dayIndex: 1, startMin: 615 });
  assert.deepEqual(stepKeyboardTarget({ dayIndex: 1, startMin: 600 }, 'ArrowUp', opts), { dayIndex: 1, startMin: 585 });
  assert.deepEqual(stepKeyboardTarget({ dayIndex: 0, startMin: 600 }, 'ArrowLeft', opts), { dayIndex: 0, startMin: 600 });
  assert.deepEqual(stepKeyboardTarget({ dayIndex: 6, startMin: 600 }, 'ArrowRight', opts), { dayIndex: 6, startMin: 600 });
  assert.deepEqual(stepKeyboardTarget({ dayIndex: 2, startMin: 0 }, 'ArrowUp', opts), { dayIndex: 2, startMin: 0 });
  assert.equal(stepKeyboardTarget({ dayIndex: 1, startMin: null }, 'ArrowDown', { ...opts, kind: 'strip' }), null);
  assert.equal(stepKeyboardTarget({ dayIndex: 1, startMin: 600 }, 'Enter', opts), null);
});

test('buildMovePatch returns only what changed, or null for a no-op', () => {
  assert.deepEqual(buildMovePatch(timed, { date: WED, startMin: 615 }), {
    date: '2026-11-25',
    startTime: '10:15',
    endTime: '11:15',
  });
  assert.deepEqual(buildMovePatch(noEnd, { date: MON, startMin: 660 }), {
    date: '2026-11-23',
    startTime: '11:00',
    endTime: null,
  });
  assert.deepEqual(buildMovePatch(todo, { date: WED, startMin: null }), { date: '2026-11-25' });
  assert.equal(buildMovePatch(timed, { date: MON, startMin: 600 }), null);
  assert.equal(buildMovePatch(todo, { date: MON, startMin: null }), null);
});

test('applyPendingMoves overrides moved occurrences without mutating the originals', () => {
  const other = { occurrenceId: 'b_2026-11-23', title: 'Outra', date: MON };
  const pending = new Map([[timed.occurrenceId, { date: '2026-11-25', startTime: '10:15', endTime: '11:15' }]]);
  const out = applyPendingMoves([timed, other], pending);
  assert.equal(out[0].startTime, '10:15');
  assert.equal(out[0].date.toISOString(), '2026-11-25T00:00:00.000Z');
  assert.equal(out[1], other);
  assert.equal(timed.startTime, '10:00');
});

test('describeTarget and describeDrop speak the target in pt-BR', () => {
  assert.equal(describeTarget(timed, WED, 615), 'Academia, quarta, 10:15');
  assert.equal(describeTarget(todo, WED, null), 'Ligar, quarta');
  assert.equal(describeDrop(timed, WED, 615), 'Movida para quarta, 10:15');
  assert.equal(describeDrop(todo, WED, null), 'Movido para quarta');
});

test('autoScrollDelta ramps up linearly inside the edge zones', () => {
  assert.equal(autoScrollDelta(300, 100, 600), 0);
  assert.equal(autoScrollDelta(100, 100, 600), -16);
  assert.equal(autoScrollDelta(124, 100, 600), -8);
  assert.equal(autoScrollDelta(50, 100, 600), -16);
  assert.equal(autoScrollDelta(600, 100, 600), 16);
  assert.equal(autoScrollDelta(576, 100, 600), 8);
});
