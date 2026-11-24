import { useState } from 'react';
import { useBacklog } from '../hooks/useBacklog.js';
import { formatShortDate, today, WEEKDAY_LABELS } from '../utils/date.js';
import TodoQuickAdd from './TodoQuickAdd.jsx';
import NotesIcon from './NotesIcon.jsx';

const ALL = '';
const NO_CATEGORY = '__none__';

function formatDayLabel(date) {
  return `${WEEKDAY_LABELS[new Date(date).getUTCDay()]} ${formatShortDate(date)}`;
}

/** "Pendencias" tab: year goals with computed progress, what was scheduled from
 * the backlog and left behind, and the backlog itself (tasks with no date).
 * Fetches its own backlog; year goals come from App (they also feed the modal). */
export default function BacklogView({
  refreshKey,
  goals,
  categories,
  onEditTask,
  onToggleComplete,
  onAddPending,
  onAddYearGoal,
  onMoveToBacklog,
}) {
  const { pending, overdue, loading } = useBacklog(refreshKey);
  const currentYear = today().getUTCFullYear();
  const [year, setYear] = useState(currentYear);
  const [filter, setFilter] = useState(ALL);

  const yearGoals = goals.filter((g) => new Date(g.date).getUTCFullYear() === year);
  const goalTitle = (goalId) => goalId && goals.find((g) => String(g._id) === String(goalId))?.title;

  // Keep "Sem categoria" while it's the active filter, even if its last item just left.
  const showNoCategory = filter === NO_CATEGORY || pending.some((t) => !t.categoryId);
  const visible = pending.filter((t) => {
    if (filter === ALL) return true;
    if (filter === NO_CATEGORY) return !t.categoryId;
    return String(t.categoryId) === filter;
  });
  // Quick add lands in the filtered category, so the new item doesn't vanish from view.
  const filterCategory = categories.find((c) => String(c._id) === filter) || null;

  return (
    <section className="goals-panel backlog-view">
      <div className="goals-panel-header">
        <h2 className="period-label">Metas de {year}</h2>
        <div className="backlog-year-picker">
          {[currentYear, currentYear + 1].map((y) => (
            <button
              key={y}
              type="button"
              className={`density-option${y === year ? ' is-active' : ''}`}
              onClick={() => setYear(y)}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      {yearGoals.length === 0 && <p className="empty-hint">Nenhuma meta para {year}.</p>}
      <ul className="goals-list">
        {yearGoals.map((goal) => {
          const pct = goal.linkedTotal ? Math.round((goal.linkedDone / goal.linkedTotal) * 100) : 0;
          return (
            <li key={goal._id} className="goal-item">
              <div className="goal-text">
                <span className="goal-title-row">
                  <span className="goal-title">{goal.title}</span>
                  {goal.description && <NotesIcon className="notes-icon" />}
                </span>
                {goal.category && (
                  <span className="goal-category" style={{ '--chip-color': goal.categoryColor }}>
                    {goal.category}
                  </span>
                )}
                <span className="goal-progress" style={{ '--chip-color': goal.category ? goal.categoryColor : undefined }}>
                  <span aria-hidden="true">
                    <span style={{ width: `${pct}%` }} />
                  </span>
                  <span className="goal-progress-label">
                    {goal.linkedDone}/{goal.linkedTotal}
                  </span>
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      <TodoQuickAdd
        label="+ Meta do ano"
        placeholder={`meta para ${year}...`}
        buttonClassName="add-goal-btn"
        inputClassName="backlog-add-input"
        onAdd={(title) => onAddYearGoal(year, title)}
      />

      {overdue.length > 0 && (
        <>
          <h2 className="period-label">Ficou pra tras</h2>
          <ul className="goals-list">
            {overdue.map((task) => (
              <li key={task._id} className="goal-item">
                <button
                  className="goal-check"
                  style={{ '--chip-color': task.categoryColor }}
                  onClick={() => onToggleComplete(task)}
                  aria-label="Marcar como concluida"
                />
                <div className="goal-text">
                  <button type="button" className="goal-title-row" onClick={() => onEditTask(task)}>
                    <span className="goal-title">{task.title}</span>
                    {task.description && <NotesIcon className="notes-icon" />}
                  </button>
                  <span className="goal-title-row">
                    <span className="backlog-date">{formatDayLabel(task.date)}</span>
                    {task.category && (
                      <span className="goal-category" style={{ '--chip-color': task.categoryColor }}>
                        {task.category}
                      </span>
                    )}
                  </span>
                  <span className="backlog-actions">
                    <button type="button" className="link-btn" onClick={() => onEditTask(task)}>
                      Reagendar
                    </button>
                    <button type="button" className="link-btn" onClick={() => onMoveToBacklog(task)}>
                      Voltar pras pendencias
                    </button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <h2 className="period-label">Pendencias</h2>
      <div className="backlog-filter">
        <button
          type="button"
          className={`density-option${filter === ALL ? ' is-active' : ''}`}
          onClick={() => setFilter(ALL)}
        >
          Todas
        </button>
        {categories.map((c) => (
          <button
            key={c._id}
            type="button"
            className={`density-option${filter === String(c._id) ? ' is-active' : ''}`}
            onClick={() => setFilter(String(c._id))}
          >
            {c.name}
          </button>
        ))}
        {showNoCategory && (
          <button
            type="button"
            className={`density-option${filter === NO_CATEGORY ? ' is-active' : ''}`}
            onClick={() => setFilter(NO_CATEGORY)}
          >
            Sem categoria
          </button>
        )}
      </div>

      {loading && pending.length === 0 && <p className="empty-hint">Carregando...</p>}
      {!loading && visible.length === 0 && <p className="empty-hint">Nada pendente.</p>}
      <ul className="goals-list">
        {visible.map((task) => {
          const linkedGoal = goalTitle(task.goalId);
          return (
            <li key={task._id} className="goal-item">
              <button
                className="goal-check"
                style={{ '--chip-color': task.categoryColor }}
                onClick={() => onToggleComplete(task)}
                aria-label="Marcar como concluida"
              />
              <div className="goal-text">
                <span className="goal-title-row">
                  <span className="goal-title">{task.title}</span>
                  {task.description && <NotesIcon className="notes-icon" />}
                </span>
                {(task.category || linkedGoal) && (
                  <span className="goal-title-row">
                    {task.category && (
                      <span className="goal-category" style={{ '--chip-color': task.categoryColor }}>
                        {task.category}
                      </span>
                    )}
                    {linkedGoal && (
                      <span className="goal-category" style={{ '--chip-color': 'var(--text-dim)' }}>
                        {linkedGoal}
                      </span>
                    )}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <TodoQuickAdd
        label="+ Pendencia"
        placeholder={filterCategory ? `nova pendencia em ${filterCategory.name}...` : 'nova pendencia...'}
        buttonClassName="add-goal-btn"
        inputClassName="backlog-add-input"
        onAdd={(title) => onAddPending(title, filterCategory)}
      />
    </section>
  );
}
