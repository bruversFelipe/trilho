import { useMemo, useState } from 'react';
import {
  addDays,
  dateKey,
  formatDaysRangeLabel,
  getDays,
  isToday,
  minutesToTime,
  timeToMinutes,
  WEEKDAY_LABELS,
} from '../utils/date.js';
import { useTasksForRange } from '../hooks/useTasksForRange.js';
import { layoutDayEvents } from '../utils/layout.js';
import NotesIcon from './NotesIcon.jsx';
import NowIndicator from './NowIndicator.jsx';
import TodoQuickAdd from './TodoQuickAdd.jsx';

const ROW_HEIGHT = 52; // px per hour
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const SNAP_MINUTES = 30;
// Max all-day chips + todos shown per column before "+N mais", so one busy day
// doesn't stretch the whole strip (every column shares the row height).
const STRIP_LIMIT = 3;

export default function WeekView({
  weekStart,
  dayCount = 7,
  refreshKey,
  onEditTask,
  onToggleComplete,
  onCreateAt,
  onAddTodo,
}) {
  const weekEnd = addDays(weekStart, dayCount - 1);
  const { tasks } = useTasksForRange(weekStart, weekEnd, refreshKey);
  const days = useMemo(() => getDays(weekStart, dayCount), [weekStart, dayCount]);
  const [expandedDays, setExpandedDays] = useState({}); // dateKey -> true when "+N mais" was opened

  const byDay = useMemo(() => {
    const map = {};
    for (const day of days) map[dateKey(day)] = { timed: [], allDay: [], todos: [] };

    for (const task of tasks) {
      if (task.isGoal) continue;
      const key = dateKey(task.date);
      if (!map[key]) continue;
      if (task.isTodo) {
        map[key].todos.push(task);
      } else if (task.allDay || !task.startTime) {
        map[key].allDay.push(task);
      } else {
        map[key].timed.push(task);
      }
    }
    for (const key of Object.keys(map)) {
      map[key].todos.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    }
    return map;
  }, [tasks, days]);

  function setDayExpanded(key, expanded) {
    setExpandedDays((prev) => ({ ...prev, [key]: expanded }));
  }

  function handleAddTodo(day, title) {
    // Keep what was just typed visible even if the column is past STRIP_LIMIT.
    setDayExpanded(dateKey(day), true);
    onAddTodo(day, title);
  }

  function handleSlotClick(e, day, hour) {
    if (!onCreateAt) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const withinHour = ((e.clientY - rect.top) / ROW_HEIGHT) * 60; // 0-60, position inside this one hour
    const snappedWithinHour = Math.min(30, Math.round(withinHour / SNAP_MINUTES) * SNAP_MINUTES);
    const start = hour * 60 + snappedWithinHour;
    const end = Math.min(24 * 60 - 1, start + 60);

    onCreateAt(day, minutesToTime(start), minutesToTime(end));
  }

  return (
    <section className="week-block" style={{ '--day-count': dayCount }}>
      <h2 className="period-label">{formatDaysRangeLabel(weekStart, dayCount)}</h2>

      <div className="week-sticky-header">
        <div className="week-daybar">
          <div className="time-gutter-spacer" />
          {days.map((day) => (
            <div key={dateKey(day)} className={`week-daybar-cell${isToday(day) ? ' is-today' : ''}`}>
              <span className="weekday-name">{WEEKDAY_LABELS[day.getUTCDay()]}</span>
              <span className="weekday-num">{day.getUTCDate()}</span>
            </div>
          ))}
        </div>

        <div className="week-allday">
          <div className="time-gutter-spacer" />
          {days.map((day) => {
            const key = dateKey(day);
            const chips = byDay[key]?.allDay || [];
            const todos = byDay[key]?.todos || [];
            const total = chips.length + todos.length;
            const expanded = !!expandedDays[key];
            // The limit is shared: all-day chips first, todos fill whatever room is left.
            const visibleChips = expanded ? chips : chips.slice(0, STRIP_LIMIT);
            const visibleTodos = expanded ? todos : todos.slice(0, Math.max(0, STRIP_LIMIT - chips.length));
            const hiddenCount = total - visibleChips.length - visibleTodos.length;

            return (
              <div key={key} className="week-allday-cell">
                {visibleChips.map((task) => (
                  <div
                    key={task.occurrenceId}
                    className={`chip${task.completed ? ' is-done' : ''}`}
                    style={{ '--chip-color': task.categoryColor }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      onToggleComplete(task);
                    }}
                  >
                    <button
                      type="button"
                      className="chip-check"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleComplete(task);
                      }}
                      aria-label={task.completed ? 'Marcar como nao concluida' : 'Marcar como concluida'}
                    >
                      {task.completed ? '✓' : ''}
                    </button>
                    <button
                      type="button"
                      className="chip-body"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditTask(task);
                      }}
                      title={task.title}
                    >
                      <span className="chip-title">{task.title}</span>
                      {task.description && <NotesIcon className="notes-icon" />}
                    </button>
                  </div>
                ))}

                {visibleTodos.map((task) => (
                  <div
                    key={task.occurrenceId}
                    className={`todo-item${task.completed ? ' is-done' : ''}`}
                    // No category = neutral gray, not the model's default indigo
                    style={task.category ? { '--todo-color': task.categoryColor } : undefined}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      onToggleComplete(task);
                    }}
                  >
                    <button
                      type="button"
                      className="todo-check"
                      onClick={() => onToggleComplete(task)}
                      aria-label={task.completed ? 'Marcar como nao concluido' : 'Marcar como concluido'}
                    >
                      {task.completed ? '✓' : ''}
                    </button>
                    <button type="button" className="todo-body" onClick={() => onEditTask(task)} title={task.title}>
                      <span className="todo-title">{task.title}</span>
                      {task.description && <NotesIcon className="notes-icon" />}
                    </button>
                  </div>
                ))}

                {hiddenCount > 0 && (
                  <button type="button" className="strip-more" onClick={() => setDayExpanded(key, true)}>
                    +{hiddenCount} mais
                  </button>
                )}
                {expanded && total > STRIP_LIMIT && (
                  <button type="button" className="strip-more" onClick={() => setDayExpanded(key, false)}>
                    mostrar menos
                  </button>
                )}

                {onAddTodo && <TodoQuickAdd onAdd={(title) => handleAddTodo(day, title)} />}
              </div>
            );
          })}
        </div>
      </div>

      <div className="week-grid-scroll">
        <div className="week-grid" style={{ height: HOURS.length * ROW_HEIGHT }}>
          <div className="time-gutter">
            {HOURS.map((h) => (
              <div key={h} className="hour-label" data-hour={h} style={{ height: ROW_HEIGHT }}>
                {String(h).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {days.map((day) => {
            const key = dateKey(day);
            const items = byDay[key]?.timed || [];
            const layout = layoutDayEvents(
              items.map((task) => {
                const start = timeToMinutes(task.startTime) ?? 0;
                return {
                  id: task.occurrenceId,
                  start,
                  end: task.endTime ? timeToMinutes(task.endTime) : start + 60,
                };
              })
            );

            return (
              <div key={key} className="day-column">
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className={`hour-line${onCreateAt ? ' is-clickable' : ''}`}
                    style={{ height: ROW_HEIGHT }}
                    onClick={(e) => handleSlotClick(e, day, h)}
                  />
                ))}

                {items.map((task) => {
                  const start = timeToMinutes(task.startTime) ?? 0;
                  const end = task.endTime ? timeToMinutes(task.endTime) : start + 60;
                  const top = (start / 60) * ROW_HEIGHT;
                  const height = Math.max(((end - start) / 60) * ROW_HEIGHT, 24);
                  const { col, totalCols } = layout.get(task.occurrenceId) || { col: 0, totalCols: 1 };
                  const widthPct = 100 / totalCols;

                  return (
                    <div
                      key={task.occurrenceId}
                      className={`task-block${task.completed ? ' is-done' : ''}`}
                      style={{
                        top,
                        height,
                        left: `calc(${col * widthPct}% + 2px)`,
                        width: `calc(${widthPct}% - 4px)`,
                        '--chip-color': task.categoryColor,
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        onToggleComplete(task);
                      }}
                    >
                      <button
                        type="button"
                        className="task-check"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleComplete(task);
                        }}
                        aria-label={task.completed ? 'Marcar como nao concluida' : 'Marcar como concluida'}
                      >
                        {task.completed ? '✓' : ''}
                      </button>
                      <button
                        type="button"
                        className="task-block-body"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditTask(task);
                        }}
                        title={`${task.startTime} ${task.title}`}
                      >
                        <span className="task-block-time">{task.startTime}</span>
                        <span className="task-block-title-row">
                          <span className="task-block-title">{task.title}</span>
                          {task.description && <NotesIcon className="notes-icon" />}
                        </span>
                      </button>
                    </div>
                  );
                })}

                {isToday(day) && <NowIndicator rowHeight={ROW_HEIGHT} />}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
