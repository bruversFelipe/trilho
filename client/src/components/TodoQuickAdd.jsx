import { useState } from 'react';

/** "+ todo" at the bottom of a day's all-day strip in WeekView. Turns into an inline
 * input; Enter saves and keeps it open (so several notes can be jotted in a row),
 * Esc or leaving it empty closes it, leaving it with text saves first. */
export default function TodoQuickAdd({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');

  function close() {
    setOpen(false);
    setValue('');
  }

  function submit() {
    const title = value.trim();
    if (!title) return;
    setValue('');
    onAdd(title);
  }

  if (!open) {
    return (
      <button type="button" className="todo-add" onClick={() => setOpen(true)}>
        + todo
      </button>
    );
  }

  return (
    <input
      className="todo-add-input"
      type="text"
      placeholder="anotar algo..."
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          submit();
        } else if (e.key === 'Escape') {
          close();
        }
      }}
      onBlur={() => {
        submit();
        close();
      }}
      autoFocus
    />
  );
}
