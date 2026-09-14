const OPTIONS = [
  { value: 1, label: 'Dia' },
  { value: 3, label: '3 dias' },
  { value: 7, label: 'Semana' },
];

/** Mobile-only segmented control (hidden at desktop widths via CSS - see
 * .density-picker in App.css) letting the week view show 1, 3 or 7 days at a
 * time. Lives above the calendar in the "Semana" tab; App.jsx owns the actual
 * `dayCount` state and persists it to localStorage. */
export default function DensityPicker({ value, onChange }) {
  return (
    <div className="density-picker">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`density-option${value === opt.value ? ' is-active' : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
