import { addDays, formatWeekRangeLabel } from '../utils/date.js';
import { firstName, getGreeting } from '../utils/greeting.js';
import { useTasksForRange } from '../hooks/useTasksForRange.js';
import TimeStatsBar from './TimeStatsBar.jsx';
import NotesIcon from './NotesIcon.jsx';

export default function GoalsPanel({
  className,
  weekStart,
  refreshKey,
  userName,
  onEditTask,
  onToggleComplete,
  onAddGoal,
}) {
  const weekEnd = addDays(weekStart, 6);
  const { tasks, loading } = useTasksForRange(weekStart, weekEnd, refreshKey);

  const goals = tasks.filter((t) => t.isGoal);
  const name = firstName(userName);

  return (
    <section className={`goals-panel${className ? ` ${className}` : ''}`}>
      {name && (
        <p className="goals-greeting">
          {getGreeting()}, {name}
        </p>
      )}

      <div className="goals-panel-header">
        <h2 className="period-label">Metas da semana</h2>
        <span className="goals-range">{formatWeekRangeLabel(weekStart)}</span>
      </div>

      {loading && goals.length === 0 && <p className="empty-hint">Carregando...</p>}
      {!loading && goals.length === 0 && <p className="empty-hint">Nenhuma meta ainda.</p>}

      <ul className="goals-list">
        {goals.map((goal) => (
          <li key={goal.occurrenceId} className={`goal-item${goal.completed ? ' is-done' : ''}`}>
            <button
              className="goal-check"
              style={{ '--chip-color': goal.categoryColor }}
              onClick={() => onToggleComplete(goal)}
              aria-label="Marcar meta como concluida"
            >
              {goal.completed ? '✓' : ''}
            </button>
            <button className="goal-text" onClick={() => onEditTask(goal)}>
              <span className="goal-title-row">
                <span className="goal-title">{goal.title}</span>
                {goal.description && <NotesIcon className="notes-icon" />}
              </span>
              {goal.category && (
                <span className="goal-category" style={{ '--chip-color': goal.categoryColor }}>
                  {goal.category}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>

      <button className="add-goal-btn" onClick={onAddGoal}>
        + Nova meta
      </button>

      <TimeStatsBar weekStart={weekStart} refreshKey={refreshKey} />
    </section>
  );
}
