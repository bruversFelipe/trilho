import { useMemo } from 'react';
import {
  addDays,
  dateKey,
  formatWeekRangeLabel,
  getWeekDays,
  isToday,
  timeToMinutes,
  WEEKDAY_LABELS,
} from '../utils/date.js';
import { useTasksForRange } from '../hooks/useTasksForRange.js';
import { layoutDayEvents } from '../utils/layout.js';

const ROW_HEIGHT = 52; // px per hour
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const SNAP_MINUTES = 30;

function minutesToTime(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export default function WeekView({ weekStart, refreshKey, onEditTask, onToggleComplete, onCreateAt }) {
  const weekEnd = addDays(weekStart, 6);
  const { tasks } = useTasksForRange(weekStart, weekEnd, refreshKey);
  const days = useMemo(() => getWeekDays(weekStart), [weekStart]);

  const byDay = useMemo(() => {
    const map = {};
    for (const day of days) map[dateKey(day)] = { timed: [], allDay: [] };

    for (const task of tasks) {
      if (task.isGoal) continue;
      const key = dateKey(task.date);
      if (!map[key]) continue;
      if (task.allDay || !task.startTime) {
        map[key].allDay.push(task);
      } else {
        map[key].timed.push(task);
      }
    }
    return map;
  }, [tasks, days]);

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
    <section className="week-block">
      <h2 className="period-label">{formatWeekRangeLabel(weekStart)}</h2>

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
            const items = byDay[key]?.allDay || [];
            return (
              <div key={key} className="week-allday-cell">
                {items.map((task) => (
                  <button
                    key={task.occurrenceId}
                    className={`chip${task.completed ? ' is-done' : ''}`}
                    style={{ '--chip-color': task.categoryColor }}
                    onClick={() => onEditTask(task)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      onToggleComplete(task);
                    }}
                    title={task.title}
                  >
                    {task.title}
                  </button>
                ))}
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
                        <span className="task-block-title">{task.title}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
