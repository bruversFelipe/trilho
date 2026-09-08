import { useMemo } from 'react';
import {
  dateKey,
  getMonthGrid,
  isToday,
  MONTH_LABELS,
  WEEKDAY_LABELS,
} from '../utils/date.js';
import { useTasksForRange } from '../hooks/useTasksForRange.js';

export default function MonthView({ monthStart, refreshKey, onSelectDay }) {
  const weeks = useMemo(() => getMonthGrid(monthStart), [monthStart]);
  const rangeStart = weeks[0][0];
  const rangeEnd = weeks[weeks.length - 1][6];
  const { tasks } = useTasksForRange(rangeStart, rangeEnd, refreshKey);

  const byDay = useMemo(() => {
    const map = {};
    for (const task of tasks) {
      if (task.isGoal) continue;
      const key = dateKey(task.date);
      if (!map[key]) map[key] = [];
      map[key].push(task);
    }
    return map;
  }, [tasks]);

  return (
    <section className="month-block">
      <h2 className="period-label">
        {MONTH_LABELS[monthStart.getUTCMonth()]} de {monthStart.getUTCFullYear()}
      </h2>

      <div className="month-weekday-header">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="month-weekday-cell">
            {label}
          </div>
        ))}
      </div>

      <div className="month-grid">
        {weeks.flat().map((day) => {
          const key = dateKey(day);
          const items = byDay[key] || [];
          const inMonth = day.getUTCMonth() === monthStart.getUTCMonth();

          return (
            <button
              key={key}
              className={`month-cell${isToday(day) ? ' is-today' : ''}${!inMonth ? ' is-outside' : ''}`}
              onClick={() => onSelectDay(day)}
            >
              <span className="month-cell-num">{day.getUTCDate()}</span>
              <span className="month-cell-dots">
                {items.slice(0, 4).map((task) => (
                  <span
                    key={task.occurrenceId}
                    className="dot"
                    style={{ background: task.categoryColor }}
                    title={task.title}
                  />
                ))}
                {items.length > 4 && <span className="dot-more">+{items.length - 4}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
