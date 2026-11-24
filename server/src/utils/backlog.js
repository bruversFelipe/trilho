// pending = no date yet, oldest first. overdue ("Ficou pra tras") = came from
// the backlog, got a day before today and wasn't done, oldest day first.
// ToDos created straight on a day are never overdue (see CLAUDE.md).
// `today` is a UTC-midnight token built from the client's local date.
export function splitBacklog(tasks, today) {
  const todayMs = new Date(today).getTime();
  const byCreated = (a, b) => new Date(a.createdAt) - new Date(b.createdAt);
  const pending = tasks.filter((t) => !t.date && !t.completed).sort(byCreated);
  const overdue = tasks
    .filter((t) => t.scheduledFromBacklog && !t.completed && t.date && new Date(t.date).getTime() < todayMs)
    .sort((a, b) => new Date(a.date) - new Date(b.date) || byCreated(a, b));
  return { pending, overdue };
}
