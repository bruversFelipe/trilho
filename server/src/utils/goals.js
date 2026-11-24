// Each goal with its progress, computed from the tasks linked to it - never
// stored, never updated by hand. Accepts Mongoose documents or plain objects.
export function withProgress(goals, linkedTasks) {
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
