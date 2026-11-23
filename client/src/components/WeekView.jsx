import { useMemo, useRef, useState } from 'react';
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
import { useTaskDrag } from '../hooks/useTaskDrag.js';
import { dragKind } from '../utils/drag.js';
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

/** Where a timed task is drawn in its day column (a task with no end is drawn as 1h). */
function blockGeometry(task) {
  const start = timeToMinutes(task.startTime) ?? 0;
  const end = task.endTime ? timeToMinutes(task.endTime) : start + 60;
  return {
    start,
    end,
    top: (start / 60) * ROW_HEIGHT,
    height: Math.max(((end - start) / 60) * ROW_HEIGHT, 24),
  };
}

export default function WeekView({
  weekStart,
  dayCount = 7,
  refreshKey,
  onEditTask,
  onToggleComplete,
  onCreateAt,
  onAddTodo,
  onMoveTask,
}) {
  const weekEnd = addDays(weekStart, dayCount - 1);
  const { tasks } = useTasksForRange(weekStart, weekEnd, refreshKey);
  const days = useMemo(() => getDays(weekStart, dayCount), [weekStart, dayCount]);
  const [expandedDays, setExpandedDays] = useState({}); // dateKey -> true when "+N mais" was opened
  const rootRef = useRef(null);
  const headerRef = useRef(null);
  const gridRef = useRef(null);

  // An all-day chip/ToDo dropped on a column already past STRIP_LIMIT would land
  // hidden behind "+N mais" - open that column so you see where it went.
  function handleMoveTask(task, patch) {
    if (dragKind(task) === 'strip') setDayExpanded(patch.date, true);
    return onMoveTask(task, patch);
  }

  const { displayTasks, dragState, getBlockProps } = useTaskDrag({
    days,
    rowHeight: ROW_HEIGHT,
    tasks,
    rootRef,
    gridRef,
    headerRef,
    onMoveTask: onMoveTask ? handleMoveTask : undefined,
  });
  const pointerDragId = dragState?.source === 'pointer' ? dragState.task.occurrenceId : null;

  const byDay = useMemo(() => {
    const map = {};
    for (const day of days) map[dateKey(day)] = { timed: [], allDay: [], todos: [] };

    for (const task of displayTasks) {
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
  }, [displayTasks, days]);

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
    <section className="week-block" style={{ '--day-count': dayCount }} ref={rootRef}>
      <h2 className="period-label">{formatDaysRangeLabel(weekStart, dayCount)}</h2>

      <div className="week-sticky-header" ref={headerRef}>
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
          {days.map((day, dayIndex) => {
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
              <div
                key={key}
                className={`week-allday-cell${
                  dragState?.kind === 'strip' && dragState.dayIndex === dayIndex ? ' is-drop-target' : ''
                }`}
                data-strip-cell={dayIndex}
              >
                {visibleChips.map((task) => (
                  <div
                    key={task.occurrenceId}
                    className={`chip${task.completed ? ' is-done' : ''}${
                      pointerDragId === task.occurrenceId ? ' is-dragging' : ''
                    }`}
                    style={{ '--chip-color': task.categoryColor }}
                    {...getBlockProps(task, 'strip', dayIndex, {
                      onContextMenu: (e) => {
                        e.preventDefault();
                        onToggleComplete(task);
                      },
                    })}
                  >
                    <button
                      type="button"
                      data-drag-ignore
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
                    className={`todo-item${task.completed ? ' is-done' : ''}${
                      pointerDragId === task.occurrenceId ? ' is-dragging' : ''
                    }`}
                    // No category = neutral gray, not the model's default indigo
                    style={task.category ? { '--todo-color': task.categoryColor } : undefined}
                    {...getBlockProps(task, 'strip', dayIndex, {
                      onContextMenu: (e) => {
                        e.preventDefault();
                        onToggleComplete(task);
                      },
                    })}
                  >
                    <button
                      type="button"
                      data-drag-ignore
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
        <div className="week-grid" style={{ height: HOURS.length * ROW_HEIGHT }} ref={gridRef}>
          <div className="time-gutter">
            {HOURS.map((h) => (
              <div key={h} className="hour-label" data-hour={h} style={{ height: ROW_HEIGHT }}>
                {String(h).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {days.map((day, dayIndex) => {
            const key = dateKey(day);
            const items = byDay[key]?.timed || [];
            const layout = layoutDayEvents(
              items.map((task) => {
                const { start, end } = blockGeometry(task);
                return { id: task.occurrenceId, start, end };
              })
            );
            const isTimedDrag = dragState?.kind === 'timed';
            const previewHere = isTimedDrag && dragState.dayIndex === dayIndex;
            const originHere =
              isTimedDrag && dragState.source === 'pointer' && dragState.originDayIndex === dayIndex;

            return (
              <div key={key} className="day-column" data-day-col={dayIndex}>
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className={`hour-line${onCreateAt ? ' is-clickable' : ''}`}
                    style={{ height: ROW_HEIGHT }}
                    onClick={(e) => handleSlotClick(e, day, h)}
                  />
                ))}

                {originHere &&
                  (() => {
                    // Faded stand-in where the dragged block came from.
                    const { top, height } = blockGeometry(dragState.task);
                    const { col, totalCols } = layout.get(dragState.task.occurrenceId) || { col: 0, totalCols: 1 };
                    const widthPct = 100 / totalCols;
                    return (
                      <div
                        className="drag-origin"
                        aria-hidden="true"
                        style={{
                          top,
                          height,
                          left: `calc(${col * widthPct}% + 2px)`,
                          width: `calc(${widthPct}% - 4px)`,
                          '--chip-color': dragState.task.categoryColor,
                        }}
                      />
                    );
                  })()}

                {previewHere && (
                  <div
                    className="drop-preview"
                    aria-hidden="true"
                    style={{
                      top: (dragState.startMin / 60) * ROW_HEIGHT,
                      height: blockGeometry(dragState.task).height,
                      '--chip-color': dragState.task.categoryColor,
                    }}
                  />
                )}

                {items.map((task) => {
                  const { top, height } = blockGeometry(task);
                  const { col, totalCols } = layout.get(task.occurrenceId) || { col: 0, totalCols: 1 };
                  const widthPct = 100 / totalCols;

                  return (
                    <div
                      key={task.occurrenceId}
                      className={`task-block${task.completed ? ' is-done' : ''}${
                        pointerDragId === task.occurrenceId ? ' is-dragging' : ''
                      }`}
                      style={{
                        top,
                        height,
                        left: `calc(${col * widthPct}% + 2px)`,
                        width: `calc(${widthPct}% - 4px)`,
                        '--chip-color': task.categoryColor,
                      }}
                      {...getBlockProps(task, 'timed', dayIndex, {
                        onContextMenu: (e) => {
                          e.preventDefault();
                          onToggleComplete(task);
                        },
                      })}
                    >
                      <button
                        type="button"
                        data-drag-ignore
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
                        <span className="task-block-time">
                          {/* While dragged, show the time it will land on, not the old one */}
                          {pointerDragId === task.occurrenceId ? minutesToTime(dragState.startMin) : task.startTime}
                        </span>
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
