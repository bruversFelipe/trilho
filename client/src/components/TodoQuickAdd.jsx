import { useState } from 'react';

/** "+ todo" at the bottom of a day's all-day strip in WeekView. Turns into an inline
 * input; Enter saves and keeps it open (so several notes can be jotted in a row),
 * Esc or leaving it empty closes it, leaving it with text saves first.
 * Also reused by the Pendencias tab ("+ Pendencia", "+ Meta do ano") with its own
 * label and classes - the defaults are the week view's. */
export default function TodoQuickAdd({
  onAdd,
  label = '+ todo',
  placeholder = 'anotar algo...',
  buttonClassName = 'todo-add',
  inputClassName = 'todo-add-input',
}) {
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
      <button type="button" className={buttonClassName} onClick={() => setOpen(true)}>
        {label}
      </button>
    );
  }

  return (
    <input
      className={inputClassName}
      type="text"
      placeholder={placeholder}
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
