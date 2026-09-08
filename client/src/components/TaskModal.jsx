import { useState } from 'react';
import { dateKey, today, WEEKDAY_LABELS } from '../utils/date.js';

const DEFAULT_COLOR = '#6366f1';

function buildInitialState(task, defaultDate, forceGoal, defaultStartTime, defaultEndTime) {
  if (task) {
    return {
      title: task.title || '',
      description: task.description || '',
      date: dateKey(task.date),
      startTime: task.startTime || '09:00',
      endTime: task.endTime || '10:00',
      allDay: !!task.allDay,
      isGoal: !!task.isGoal,
      category: task.category || '',
      newCategoryMode: false,
      newCategoryName: '',
      newCategoryColor: DEFAULT_COLOR,
      recurrenceEnabled: !!task.recurrence?.enabled,
      daysOfWeek: task.recurrence?.daysOfWeek || [],
      recurrenceEndDate: task.recurrence?.endDate ? dateKey(task.recurrence.endDate) : '',
    };
  }

  return {
    title: '',
    description: '',
    date: dateKey(defaultDate || today()),
    startTime: defaultStartTime || '09:00',
    endTime: defaultEndTime || '10:00',
    allDay: false,
    isGoal: !!forceGoal,
    category: '',
    newCategoryMode: false,
    newCategoryName: '',
    newCategoryColor: DEFAULT_COLOR,
    recurrenceEnabled: false,
    daysOfWeek: [],
    recurrenceEndDate: '',
  };
}

export default function TaskModal({
  task,
  defaultDate,
  defaultStartTime,
  defaultEndTime,
  forceGoal,
  categories,
  onClose,
  onSave,
  onDelete,
}) {
  const [form, setForm] = useState(() =>
    buildInitialState(task, defaultDate, forceGoal, defaultStartTime, defaultEndTime)
  );
  const isEditing = !!task;

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

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) return;

    const categoryName = form.newCategoryMode ? form.newCategoryName.trim() : form.category;
    const selected = categories.find((c) => c.name === form.category);
    const categoryColor = form.newCategoryMode ? form.newCategoryColor : selected?.color || DEFAULT_COLOR;

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      date: form.date,
      allDay: form.allDay || form.isGoal,
      startTime: form.allDay || form.isGoal ? null : form.startTime,
      endTime: form.allDay || form.isGoal ? null : form.endTime,
      isGoal: form.isGoal,
      category: categoryName,
      categoryColor,
      recurrence: {
        enabled: form.isGoal ? false : form.recurrenceEnabled,
        daysOfWeek: form.daysOfWeek,
        endDate: form.recurrenceEndDate || null,
      },
    };

    onSave(payload, task);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEditing ? 'Editar' : 'Nova'} {form.isGoal ? 'meta' : 'tarefa'}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>

        <form className="task-form" onSubmit={handleSubmit}>
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

          <label className="field toggle-field">
            <span>E uma meta da semana (sem horario)</span>
            <input
              type="checkbox"
              checked={form.isGoal}
              onChange={(e) => update({ isGoal: e.target.checked })}
            />
          </label>

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

          <label className="field">
            <span>Data</span>
            <input
              type="date"
              value={form.date}
              onChange={(e) => update({ date: e.target.value })}
              required
            />
          </label>

          {!form.isGoal && (
            <>
              <label className="field toggle-field">
                <span>Dia inteiro / sem horario fixo</span>
                <input
                  type="checkbox"
                  checked={form.allDay}
                  onChange={(e) => update({ allDay: e.target.checked })}
                />
              </label>

              {!form.allDay && (
                <div className="field-row">
                  <label className="field">
                    <span>Inicio</span>
                    <input
                      type="time"
                      value={form.startTime}
                      onChange={(e) => update({ startTime: e.target.value })}
                    />
                  </label>
                  <label className="field">
                    <span>Fim</span>
                    <input
                      type="time"
                      value={form.endTime}
                      onChange={(e) => update({ endTime: e.target.value })}
                    />
                  </label>
                </div>
              )}

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

          <div className="modal-actions">
            {isEditing && (
              <button type="button" className="danger-btn" onClick={() => onDelete(task)}>
                Excluir
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
