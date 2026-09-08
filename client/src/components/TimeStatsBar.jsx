import { useEffect, useState } from 'react';
import { getStats } from '../api/api.js';
import { addDays, dateKey } from '../utils/date.js';

function formatMinutes(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, '0')}`;
}

export default function TimeStatsBar({ weekStart, refreshKey }) {
  const [stats, setStats] = useState(null);
  const [open, setOpen] = useState(false);
  const weekKey = dateKey(weekStart);

  useEffect(() => {
    let cancelled = false;
    getStats(weekKey, dateKey(addDays(weekStart, 6)))
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch(() => {
        if (!cancelled) setStats(null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekKey, refreshKey]);

  const hasData = stats && stats.totalMinutes > 0;

  return (
    <div
      className="stats-bar-wrap"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={() => setOpen((o) => !o)}
    >
      <div className="stats-bar-header">
        <span className="stats-bar-title">Tempo agendado na semana</span>
        {hasData && <span className="stats-bar-total">{formatMinutes(stats.totalMinutes)}</span>}
      </div>

      {hasData ? (
        <div className="stats-bar">
          {stats.categories.map((c) => (
            <div
              key={c.name}
              className="stats-bar-segment"
              style={{ width: `${(c.minutes / stats.totalMinutes) * 100}%`, background: c.color }}
            />
          ))}
        </div>
      ) : (
        <div className="stats-bar stats-bar-empty" />
      )}

      {open && hasData && (
        <div className="stats-popup">
          {stats.categories.map((c) => (
            <div key={c.name} className="stats-popup-row">
              <span className="stats-popup-dot" style={{ background: c.color }} />
              <span className="stats-popup-name">{c.name}</span>
              <span className="stats-popup-hours">{formatMinutes(c.minutes)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
