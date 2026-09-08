import Task from '../models/Task.js';
import Category from '../models/Category.js';
import { expandTasks } from '../utils/recurrence.js';
import { parseDateOnly, timeToMinutes, toDateOnlyString } from '../utils/date.js';

const UNCATEGORIZED_COLOR = '#a8a29e';

async function fetchOccurrences(userId, rangeStart, rangeEnd) {
  // Non-recurring tasks strictly in range, OR any recurring task that could
  // possibly still be active by rangeEnd (started before rangeEnd, no earlier endDate).
  const tasks = await Task.find({
    userId,
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
  if (!body.date) return res.status(400).json({ error: 'date is required' });

  const category = await resolveCategory(req.userId, body);

  const task = await Task.create({
    userId: req.userId,
    title: body.title,
    description: body.description || '',
    date: new Date(body.date),
    startTime: body.startTime || null,
    endTime: body.endTime || null,
    allDay: !!body.allDay,
    isGoal: !!body.isGoal,
    category: category?.name || '',
    categoryColor: category?.color || '#6366f1',
    categoryId: category?._id || null,
    recurrence: {
      enabled: !!body.recurrence?.enabled,
      daysOfWeek: body.recurrence?.daysOfWeek || [],
      endDate: body.recurrence?.endDate ? new Date(body.recurrence.endDate) : null,
    },
  });

  res.status(201).json(task);
}

export async function updateTask(req, res) {
  const { id } = req.params;
  const body = req.body;

  const task = await Task.findOne({ _id: id, userId: req.userId });
  if (!task) return res.status(404).json({ error: 'Task not found' });

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
    'completed',
  ];
  for (const key of assignable) {
    if (body[key] !== undefined) task[key] = body[key];
  }

  if (body.date !== undefined) task.date = new Date(body.date);

  if (body.recurrence !== undefined) {
    task.recurrence = {
      enabled: !!body.recurrence.enabled,
      daysOfWeek: body.recurrence.daysOfWeek || [],
      endDate: body.recurrence.endDate ? new Date(body.recurrence.endDate) : null,
    };
  }

  await task.save();
  res.json(task);
}

export async function deleteTask(req, res) {
  const { id } = req.params;
  const deleted = await Task.findOneAndDelete({ _id: id, userId: req.userId });
  if (!deleted) return res.status(404).json({ error: 'Task not found' });
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
