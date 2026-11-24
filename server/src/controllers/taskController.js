import mongoose from 'mongoose';
import Task from '../models/Task.js';
import Category from '../models/Category.js';
import { expandTasks } from '../utils/recurrence.js';
import { parseDateOnly, timeToMinutes, toDateOnlyString } from '../utils/date.js';

const UNCATEGORIZED_COLOR = '#a8a29e';
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

async function fetchOccurrences(userId, rangeStart, rangeEnd) {
  // Non-recurring tasks strictly in range, OR any recurring task that could
  // possibly still be active by rangeEnd (started before rangeEnd, no earlier endDate).
  // Year goals are left out: they live on Jan 1 but belong to the whole year,
  // so they'd otherwise show up in the GoalsPanel of the week containing Jan 1.
  // Backlog items (date: null) never match the date ranges below.
  const tasks = await Task.find({
    userId,
    goalPeriod: { $ne: 'year' },
    $or: [
      { 'recurrence.enabled': { $ne: true }, date: { $gte: rangeStart, $lte: rangeEnd } },
      {
        'recurrence.enabled': true,
        date: { $lte: rangeEnd },
        $or: [{ 'recurrence.endDate': null }, { 'recurrence.endDate': { $gte: rangeStart } }],
      },
    ],
  });

  return expandTasks(tasks, rangeStart, rangeEnd);
}

// Turns recurrence off but keeps excludedDates (past detached occurrences).
function disableRecurrence(task) {
  task.recurrence = {
    enabled: false,
    daysOfWeek: [],
    endDate: null,
    excludedDates: task.recurrence?.excludedDates || [],
  };
}

// A backlog item ("pendencia") has no day yet, so it can't have a time, repeat,
// be a ToDo or be a goal. Works on both a plain object (before create) and a
// Mongoose document (before save), like normalizeTodo.
function normalizeBacklog(task) {
  if (task.date) return task;
  task.date = null;
  task.allDay = true;
  task.startTime = null;
  task.endTime = null;
  task.isGoal = false;
  task.isTodo = false;
  task.goalPeriod = 'week';
  task.scheduledFromBacklog = false;
  disableRecurrence(task);
  return task;
}

// A ToDo is always a one-off, time-less note on a day - enforce that here so no
// client payload can turn one into a timed, recurring or goal task. Works on both
// a plain object (before create) and a Mongoose document (before save).
function normalizeTodo(task) {
  if (!task.isTodo) return task;
  task.allDay = true;
  task.startTime = null;
  task.endTime = null;
  task.isGoal = false;
  disableRecurrence(task);
  return task;
}

// A year goal lives on Jan 1 UTC of its year, all day, never repeats.
// Anything that isn't a goal is a 'week' period (the default) so the field
// can't leak into regular tasks.
function normalizeGoal(task) {
  if (!task.isGoal) task.goalPeriod = 'week';
  if (task.goalPeriod !== 'year') return task;
  task.date = new Date(Date.UTC(new Date(task.date).getUTCFullYear(), 0, 1));
  task.allDay = true;
  task.startTime = null;
  task.endTime = null;
  task.isTodo = false;
  disableRecurrence(task);
  return task;
}

// Every path that creates/saves a Task goes through here. Goals and recurring
// tasks can't be linked to a year goal nor sit in "Ficou pra tras".
function normalizeTask(task) {
  normalizeBacklog(task);
  normalizeTodo(task);
  normalizeGoal(task);
  if (task.isGoal || task.recurrence?.enabled) {
    task.scheduledFromBacklog = false;
    task.goalId = null;
  }
  return task;
}

async function resolveCategory(userId, { category, categoryColor, categoryId }) {
  if (categoryId) {
    const existing = await Category.findOne({ _id: categoryId, userId });
    if (existing) return existing;
  }

  if (category) {
    const trimmed = category.trim();
    let found = await Category.findOne({ userId, name: trimmed });
    if (!found) {
      found = await Category.create({ userId, name: trimmed, color: categoryColor || '#6366f1' });
    }
    return found;
  }

  return null;
}

// A goalId is only valid if it's one of this user's year goals. Malformed ids
// are rejected here (null) instead of reaching a query and failing with a 500.
async function findYearGoal(userId, goalId) {
  if (!mongoose.isObjectIdOrHexString(goalId)) return null;
  return Task.findOne({ _id: goalId, userId, isGoal: true, goalPeriod: 'year' });
}

// pending = no date yet, oldest first. overdue ("Ficou pra tras") = came from
// the backlog, got a day before today and wasn't done, oldest day first.
// ToDos created straight on a day are never overdue (see CLAUDE.md).
function splitBacklog(tasks, today) {
  const todayMs = new Date(today).getTime();
  const byCreated = (a, b) => new Date(a.createdAt) - new Date(b.createdAt);
  const pending = tasks.filter((t) => !t.date && !t.completed).sort(byCreated);
  const overdue = tasks
    .filter((t) => t.scheduledFromBacklog && !t.completed && t.date && new Date(t.date).getTime() < todayMs)
    .sort((a, b) => new Date(a.date) - new Date(b.date) || byCreated(a, b));
  return { pending, overdue };
}

// "today" comes from the client: which day it is depends on the user's local
// clock, never on the server's (see the date model in CLAUDE.md).
export async function getBacklog(req, res) {
  const { today } = req.query;
  if (typeof today !== 'string' || !DATE_ONLY.test(today) || Number.isNaN(parseDateOnly(today).getTime())) {
    return res.status(400).json({ error: 'today query param is required (YYYY-MM-DD)' });
  }

  const candidates = await Task.find({
    userId: req.userId,
    completed: false,
    $or: [{ date: null }, { scheduledFromBacklog: true }],
  });

  res.json(splitBacklog(candidates, parseDateOnly(today)));
}

export async function listTasks(req, res) {
  const { start, end } = req.query;
  if (!start || !end) {
    return res.status(400).json({ error: 'start and end query params are required (YYYY-MM-DD)' });
  }

  const occurrences = await fetchOccurrences(req.userId, parseDateOnly(start), parseDateOnly(end));
  res.json(occurrences);
}

// Time-usage breakdown by category for a period (used by the "estatisticas da
// semana" bar) - only counts occurrences with an actual start/end time; goals
// and all-day tasks don't have a duration to attribute.
export async function getStats(req, res) {
  const { start, end } = req.query;
  if (!start || !end) {
    return res.status(400).json({ error: 'start and end query params are required (YYYY-MM-DD)' });
  }

  const occurrences = await fetchOccurrences(req.userId, parseDateOnly(start), parseDateOnly(end));

  const buckets = new Map(); // category name -> { name, color, minutes }
  let totalMinutes = 0;

  for (const occ of occurrences) {
    if (occ.isGoal || occ.allDay || !occ.startTime || !occ.endTime) continue;

    const startMin = timeToMinutes(occ.startTime);
    const endMin = timeToMinutes(occ.endTime);
    const duration = endMin - startMin;
    if (!(duration > 0)) continue;

    const name = occ.category || 'Sem categoria';
    const color = occ.category ? occ.categoryColor : UNCATEGORIZED_COLOR;

    if (!buckets.has(name)) buckets.set(name, { name, color, minutes: 0 });
    buckets.get(name).minutes += duration;
    totalMinutes += duration;
  }

  const categories = [...buckets.values()].sort((a, b) => b.minutes - a.minutes);
  res.json({ totalMinutes, categories });
}

export async function createTask(req, res) {
  const body = req.body;
  if (!body.title) return res.status(400).json({ error: 'title is required' });
  if (body.goalId && !(await findYearGoal(req.userId, body.goalId))) {
    return res.status(400).json({ error: 'goalId invalido' });
  }

  const category = await resolveCategory(req.userId, body);

  const task = await Task.create(
    normalizeTask({
      userId: req.userId,
      title: body.title,
      description: body.description || '',
      date: body.date ? new Date(body.date) : null, // no date = backlog item
      goalPeriod: body.goalPeriod === 'year' ? 'year' : 'week',
      goalId: body.goalId || null,
      startTime: body.startTime || null,
      endTime: body.endTime || null,
      allDay: !!body.allDay,
      isGoal: !!body.isGoal,
      isTodo: !!body.isTodo,
      category: category?.name || '',
      categoryColor: category?.color || '#6366f1',
      categoryId: category?._id || null,
      recurrence: {
        enabled: !!body.recurrence?.enabled,
        daysOfWeek: body.recurrence?.daysOfWeek || [],
        endDate: body.recurrence?.endDate ? new Date(body.recurrence.endDate) : null,
      },
    })
  );

  res.status(201).json(task);
}

export async function updateTask(req, res) {
  const { id } = req.params;
  const body = req.body;

  const task = await Task.findOne({ _id: id, userId: req.userId });
  if (!task) return res.status(404).json({ error: 'Task not found' });

  // Editing just one occurrence of a recurring series: detach that date into
  // its own standalone task, and make the series skip it from now on.
  if (task.recurrence?.enabled && body.scope === 'single') {
    return detachOccurrence(req, res, task, body);
  }

  if (body.goalId && !(await findYearGoal(req.userId, body.goalId))) {
    return res.status(400).json({ error: 'goalId invalido' });
  }

  if (body.category !== undefined || body.categoryId !== undefined) {
    const category = await resolveCategory(req.userId, body);
    if (category) {
      task.category = category.name;
      task.categoryColor = category.color;
      task.categoryId = category._id;
    }
  }

  const assignable = [
    'title',
    'description',
    'startTime',
    'endTime',
    'allDay',
    'isGoal',
    'isTodo',
    'completed',
  ];
  for (const key of assignable) {
    if (body[key] !== undefined) task[key] = body[key];
  }

  if (body.goalId !== undefined) task.goalId = body.goalId || null;

  if (body.date !== undefined) {
    const wasBacklog = !task.date;
    // null/'' sends it back to the backlog - never new Date(null), which is 1970-01-01
    task.date = body.date ? new Date(body.date) : null;
    if (wasBacklog && task.date) task.scheduledFromBacklog = true;
  }

  if (body.recurrence !== undefined) {
    task.recurrence = {
      enabled: !!body.recurrence.enabled,
      daysOfWeek: body.recurrence.daysOfWeek || [],
      endDate: body.recurrence.endDate ? new Date(body.recurrence.endDate) : null,
      excludedDates: task.recurrence.excludedDates, // preserve - a full recurrence edit shouldn't un-detach past exceptions
    };
  }

  normalizeTask(task);
  await task.save();
  res.json(task);
}

async function detachOccurrence(req, res, seriesTask, body) {
  if (!body.occurrenceDate) {
    return res.status(400).json({ error: 'occurrenceDate is required when scope is single' });
  }

  const category = await resolveCategory(req.userId, body);

  const detached = await Task.create(
    normalizeTask({
      userId: req.userId,
      title: body.title,
      description: body.description || '',
      date: body.date ? new Date(body.date) : null,
      startTime: body.startTime || null,
      endTime: body.endTime || null,
      allDay: !!body.allDay,
      isGoal: !!body.isGoal,
      isTodo: !!body.isTodo,
      // Keep a done occurrence done when it's detached (e.g. dragged to another day)
      completed: !!body.completed,
      category: category?.name || '',
      categoryColor: category?.color || '#6366f1',
      categoryId: category?._id || null,
      recurrence: { enabled: false, daysOfWeek: [], endDate: null, excludedDates: [] },
    })
  );

  excludeDateFromSeries(seriesTask, body.occurrenceDate);
  await seriesTask.save();

  res.status(201).json(detached);
}

function excludeDateFromSeries(seriesTask, occurrenceDate) {
  const key = toDateOnlyString(occurrenceDate);
  const already = seriesTask.recurrence.excludedDates.some((d) => toDateOnlyString(d) === key);
  if (!already) {
    seriesTask.recurrence.excludedDates.push(parseDateOnly(key));
  }
}

export async function deleteTask(req, res) {
  const { id } = req.params;
  const { scope, occurrenceDate } = req.query;

  if (scope === 'single' && occurrenceDate) {
    const task = await Task.findOne({ _id: id, userId: req.userId });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    if (task.recurrence?.enabled) {
      excludeDateFromSeries(task, occurrenceDate);
      await task.save();
      return res.status(204).send();
    }
  }

  const task = await Task.findOne({ _id: id, userId: req.userId });
  if (!task) return res.status(404).json({ error: 'Task not found' });

  // Deleting a year goal keeps its linked tasks - they only lose the link.
  if (task.isGoal && task.goalPeriod === 'year') {
    await Task.updateMany({ userId: req.userId, goalId: task._id }, { $set: { goalId: null } });
  }

  await Task.deleteOne({ _id: task._id, userId: req.userId });
  res.status(204).send();
}

export async function completeTask(req, res) {
  const { id } = req.params;
  const { date, completed } = req.body;

  const task = await Task.findOne({ _id: id, userId: req.userId });
  if (!task) return res.status(404).json({ error: 'Task not found' });

  if (task.recurrence?.enabled) {
    if (!date) return res.status(400).json({ error: 'date is required for recurring tasks' });
    const dateStr = toDateOnlyString(date);
    const already = task.completedDates.some((d) => toDateOnlyString(d) === dateStr);
    const shouldComplete = completed !== undefined ? completed : !already;

    if (shouldComplete && !already) {
      task.completedDates.push(new Date(dateStr));
    } else if (!shouldComplete && already) {
      task.completedDates = task.completedDates.filter((d) => toDateOnlyString(d) !== dateStr);
    }
  } else {
    task.completed = completed !== undefined ? completed : !task.completed;
  }

  await task.save();
  res.json(task);
}
