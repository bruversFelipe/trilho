import Task from '../models/Task.js';

// Each goal with its progress, computed from the tasks linked to it - never
// stored, never updated by hand.
function withProgress(goals, linkedTasks) {
  return goals.map((goal) => {
    const plain = typeof goal.toObject === 'function' ? goal.toObject() : { ...goal };
    const mine = linkedTasks.filter((t) => String(t.goalId) === String(plain._id));
    return {
      ...plain,
      linkedTotal: mine.length,
      linkedDone: mine.filter((t) => t.completed).length,
      linkedTasks: mine.map(({ _id, title, completed, date }) => ({ _id, title, completed, date })),
    };
  });
}

export async function listGoals(req, res) {
  const year = Number(req.query.year);
  if (!Number.isInteger(year) || year < 1970 || year > 9999) {
    return res.status(400).json({ error: 'year query param is required (YYYY)' });
  }

  const goals = await Task.find({
    userId: req.userId,
    isGoal: true,
    goalPeriod: 'year',
    date: { $gte: new Date(Date.UTC(year, 0, 1)), $lt: new Date(Date.UTC(year + 1, 0, 1)) },
  }).sort({ createdAt: 1 });

  const linkedTasks = goals.length
    ? await Task.find({ userId: req.userId, goalId: { $in: goals.map((g) => g._id) } })
        .select('goalId title completed date')
        .sort({ createdAt: 1 })
    : [];

  res.json(withProgress(goals, linkedTasks));
}
