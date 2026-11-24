import { useState } from 'react';
import { addDays, dateKey, formatShortDate, today, WEEKDAY_LABELS } from '../utils/date.js';

const DEFAULT_COLOR = '#6366f1';

function buildInitialState(task, defaultDate, forceGoal, defaultStartTime, defaultEndTime, defaultBacklog) {
  if (task) {
    return {
      title: task.title || '',
      description: task.description || '',
      date: task.date ? dateKey(task.date) : '', // '' = backlog item (no date yet)
      startTime: task.startTime || '09:00',
      endTime: task.endTime || '10:00',
      withTime: !!task.startTime,
      allDay: !!task.allDay,
      isGoal: !!task.isGoal,
      isTodo: !!task.isTodo,
      category: task.category || '',
      newCategoryMode: false,
      newCategoryName: '',
      newCategoryColor: DEFAULT_COLOR,
      recurrenceEnabled: !!task.recurrence?.enabled,
      daysOfWeek: task.recurrence?.daysOfWeek || [],
      recurrenceEndDate: task.recurrence?.endDate ? dateKey(task.recurrence.endDate) : '',
      goalId: task.goalId ? String(task.goalId) : '',
    };
  }

  return {
    title: '',
    description: '',
    date: defaultBacklog ? '' : dateKey(defaultDate || today()),
    startTime: defaultStartTime || '09:00',
    endTime: defaultEndTime || '10:00',
    withTime: false,
    allDay: false,
    isGoal: !!forceGoal,
    isTodo: false, // todos are only created through the quick-add input, never from here
    category: '',
    newCategoryMode: false,
    newCategoryName: '',
    newCategoryColor: DEFAULT_COLOR,
    recurrenceEnabled: false,
    daysOfWeek: [],
    recurrenceEndDate: '',
    goalId: '',
  };
}

export default function TaskModal({
  task,
  defaultDate,
  defaultStartTime,
  defaultEndTime,
  forceGoal,
  defaultBacklog,
  goalOptions = [],
  categories,
  onClose,
  onSave,
  onDelete,
}) {
  const [form, setForm] = useState(() =>
    buildInitialState(task, defaultDate, forceGoal, defaultStartTime, defaultEndTime, defaultBacklog)
  );
  const isEditing = !!task;
  const isRecurringInstance = isEditing && !!task.recurrence?.enabled;
  // Editing one occurrence of a series: default to "just this day" - that's the
  // whole point of picking a single block on the calendar to edit.
  const [editScope, setEditScope] = useState('single');
  const editingSingleOccurrence = isRecurringInstance && editScope === 'single';

  // A backlog item ("pendencia") has no date yet; scheduling it is what the
  // Agendar block is for. It only turns an existing item into a ToDo/task - a new
  // one ("Nova pendencia") is always saved without a date.
  const backlogMode = task ? task.date == null : !!defaultBacklog;
  // A year goal only edits its text and category: the server pins its date.
  const yearGoalMode = !!task?.isGoal && task.goalPeriod === 'year';
  const standardMode = !backlogMode && !yearGoalMode;
  // Year goals can't be linked to goals, and neither can week goals or series.
  const showGoalSelect = !yearGoalMode && !form.isGoal && !form.recurrenceEnabled;
  const canMoveToBacklog = !!task?.scheduledFromBacklog && !isRecurringInstance && !backlogMode;

  const todayKey = dateKey(today());
  const tomorrowKey = dateKey(addDays(today(), 1));
  const goalYears = [...new Set(goalOptions.map((g) => new Date(g.date).getUTCFullYear()))].sort();
  const goalIsListed = goalOptions.some((g) => String(g._id) === form.goalId);

  function update(patch) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  function toggleDay(day) {
    setForm((prev) => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter((d) => d !== day)
        : [...prev.daysOfWeek, day].sort(),
    }));
  }

  function buildPayload() {
    const categoryName = form.newCategoryMode ? form.newCategoryName.trim() : form.category;
    const selected = categories.find((c) => c.name === form.category);
    const categoryColor = form.newCategoryMode ? form.newCategoryColor : selected?.color || DEFAULT_COLOR;
    const base = {
      title: form.title.trim(),
      description: form.description.trim(),
      category: categoryName,
      categoryColor,
    };

    if (yearGoalMode) return base;

    if (backlogMode) {
      // No date: stays in the backlog. Date without time: a ToDo on that day.
      // Date with time: a regular timed task.
      const timed = !!form.date && form.withTime;
      return {
        ...base,
        goalId: form.goalId || null,
        date: form.date || null,
        isTodo: !!form.date && !form.withTime,
        isGoal: false,
        allDay: false,
        startTime: timed ? form.startTime : null,
        endTime: timed ? form.endTime : null,
        recurrence: { enabled: false, daysOfWeek: [], endDate: null },
      };
    }

    const noTime = form.allDay || form.isGoal || form.isTodo;
    const payload = {
      ...base,
      date: form.date,
      allDay: noTime,
      startTime: noTime ? null : form.startTime,
      endTime: noTime ? null : form.endTime,
      isGoal: form.isGoal,
      isTodo: form.isTodo,
      goalId: showGoalSelect ? form.goalId || null : null,
      recurrence: {
        enabled: form.isGoal ? false : form.recurrenceEnabled,
        daysOfWeek: form.daysOfWeek,
        endDate: form.recurrenceEndDate || null,
      },
    };

    if (editingSingleOccurrence) {
      payload.scope = 'single';
      payload.occurrenceDate = dateKey(task.date);
    }

    return payload;
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    onSave(buildPayload(), task);
  }

  function handleMoveToBacklog() {
    if (!form.title.trim()) return;
    onSave({ ...buildPayload(), date: null }, task);
  }

  let heading;
  if (yearGoalMode) heading = 'Editar meta do ano';
  else if (backlogMode) heading = isEditing ? 'Editar pendencia' : 'Nova pendencia';
  else if (form.isTodo) heading = 'Editar ToDo';
  else heading = `${isEditing ? 'Editar' : 'Nova'} ${form.isGoal ? 'meta' : 'tarefa'}`;

  const timeFields = (
    <div className="field-row">
      <label className="field">
        <span>Inicio</span>
        <input type="time" value={form.startTime} onChange={(e) => update({ startTime: e.target.value })} />
      </label>
      <label className="field">
        <span>Fim</span>
        <input type="time" value={form.endTime} onChange={(e) => update({ endTime: e.target.value })} />
      </label>
    </div>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{heading}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>

        <form className="task-form" onSubmit={handleSubmit}>
          {isRecurringInstance && (
            <div className="edit-scope-picker">
              <span className="edit-scope-label">Essa tarefa se repete. Alterar:</span>
              <div className="edit-scope-options">
                <button
                  type="button"
                  className={`edit-scope-option${editScope === 'single' ? ' is-active' : ''}`}
                  onClick={() => setEditScope('single')}
                >
                  Somente este dia ({formatShortDate(task.date)})
                </button>
                <button
                  type="button"
                  className={`edit-scope-option${editScope === 'series' ? ' is-active' : ''}`}
                  onClick={() => setEditScope('series')}
                >
                  Toda a serie
                </button>
              </div>
            </div>
          )}

          <label className="field">
            <span>Titulo</span>
            <input
              type="text"
              value={form.title}
              onChange={(e) => update({ title: e.target.value })}
              autoFocus
              required
            />
          </label>

          <label className="field">
            <span>Descricao</span>
            <textarea
              value={form.description}
              onChange={(e) => update({ description: e.target.value })}
              rows={2}
            />
          </label>

          {standardMode && !form.isTodo && (
            <label className="field toggle-field">
              <span>E uma meta da semana (sem horario)</span>
              <input
                type="checkbox"
                checked={form.isGoal}
                onChange={(e) => update({ isGoal: e.target.checked })}
              />
            </label>
          )}

          <label className="field">
            <span>Categoria</span>
            {!form.newCategoryMode ? (
              <select
                value={form.category}
                onChange={(e) => {
                  if (e.target.value === '__new__') {
                    update({ newCategoryMode: true, category: '' });
                  } else {
                    update({ category: e.target.value });
                  }
                }}
              >
                <option value="">Sem categoria</option>
                {categories.map((c) => (
                  <option key={c._id} value={c.name}>
                    {c.name}
                  </option>
                ))}
                <option value="__new__">+ Criar nova categoria</option>
              </select>
            ) : (
              <div className="new-category-row">
                <input
                  type="text"
                  placeholder="Nome da categoria"
                  value={form.newCategoryName}
                  onChange={(e) => update({ newCategoryName: e.target.value })}
                />
                <input
                  type="color"
                  value={form.newCategoryColor}
                  onChange={(e) => update({ newCategoryColor: e.target.value })}
                />
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => update({ newCategoryMode: false, newCategoryName: '' })}
                >
                  cancelar
                </button>
              </div>
            )}
          </label>

          {showGoalSelect && (
            <label className="field">
              <span>Meta do ano</span>
              <select value={form.goalId} onChange={(e) => update({ goalId: e.target.value })}>
                <option value="">Sem meta</option>
                {goalYears.map((year) => (
                  <optgroup key={year} label={String(year)}>
                    {goalOptions
                      .filter((g) => new Date(g.date).getUTCFullYear() === year)
                      .map((g) => (
                        <option key={g._id} value={String(g._id)}>
                          {g.title}
                        </option>
                      ))}
                  </optgroup>
                ))}
                {/* Linked to a goal outside the years listed: keep it instead of dropping it on save */}
                {form.goalId && !goalIsListed && <option value={form.goalId}>Meta de outro ano</option>}
              </select>
            </label>
          )}

          {yearGoalMode && (
            <div className="field">
              <span>
                Tarefas ligadas ({task.linkedDone ?? 0}/{task.linkedTotal ?? 0})
              </span>
              {task.linkedTasks?.length ? (
                <ul className="linked-tasks">
                  {task.linkedTasks.map((t) => (
                    <li key={t._id} className={t.completed ? 'is-done' : ''}>
                      <span aria-hidden="true">{t.completed ? '✓' : '○'}</span>
                      <span>{t.title}</span>
                      <span>{t.date ? formatShortDate(t.date) : 'sem data'}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <span>Nenhuma tarefa ligada ainda.</span>
              )}
            </div>
          )}

          {backlogMode && isEditing && (
            <>
              <div className="field">
                <span>Agendar</span>
                <div className="edit-scope-options">
                  {[
                    ['', 'Sem data'],
                    [todayKey, 'Hoje'],
                    [tomorrowKey, 'Amanha'],
                  ].map(([value, label]) => (
                    <button
                      type="button"
                      key={label}
                      className={`edit-scope-option${form.date === value ? ' is-active' : ''}`}
                      onClick={() => update({ date: value })}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <input
                  type="date"
                  aria-label="Data"
                  value={form.date}
                  onChange={(e) => update({ date: e.target.value })}
                />
              </div>

              {form.date && (
                <label className="field toggle-field">
                  <span>Com horario</span>
                  <input
                    type="checkbox"
                    checked={form.withTime}
                    onChange={(e) => update({ withTime: e.target.checked })}
                  />
                </label>
              )}
              {form.date && form.withTime && timeFields}
            </>
          )}

          {standardMode && (
            <label className="field">
              <span>Data</span>
              <input
                type="date"
                value={form.date}
                onChange={(e) => update({ date: e.target.value })}
                required
              />
            </label>
          )}

          {canMoveToBacklog && (
            <button type="button" className="link-btn move-to-backlog" onClick={handleMoveToBacklog}>
              Voltar pras pendencias
            </button>
          )}

          {standardMode && !form.isGoal && !form.isTodo && (
            <>
              <label className="field toggle-field">
                <span>Dia inteiro / sem horario fixo</span>
                <input
                  type="checkbox"
                  checked={form.allDay}
                  onChange={(e) => update({ allDay: e.target.checked })}
                />
              </label>

              {!form.allDay && timeFields}

              {!editingSingleOccurrence && (
                <>
                  <label className="field toggle-field">
                    <span>Repetir em dias da semana</span>
                    <input
                      type="checkbox"
                      checked={form.recurrenceEnabled}
                      onChange={(e) => update({ recurrenceEnabled: e.target.checked })}
                    />
                  </label>

                  {form.recurrenceEnabled && (
                    <>
                      <div className="weekday-picker">
                        {WEEKDAY_LABELS.map((label, idx) => (
                          <button
                            type="button"
                            key={label}
                            className={`weekday-chip${form.daysOfWeek.includes(idx) ? ' is-active' : ''}`}
                            onClick={() => toggleDay(idx)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <label className="field">
                        <span>Repetir ate (opcional)</span>
                        <input
                          type="date"
                          value={form.recurrenceEndDate}
                          onChange={(e) => update({ recurrenceEndDate: e.target.value })}
                        />
                      </label>
                    </>
                  )}
                </>
              )}
            </>
          )}

          <div className="modal-actions">
            {isEditing && (
              <button
                type="button"
                className="danger-btn"
                onClick={() => onDelete(task, editingSingleOccurrence ? 'single' : 'series')}
              >
                {editingSingleOccurrence ? 'Excluir este dia' : 'Excluir'}
              </button>
            )}
            <button type="submit" className="primary-btn">
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
