import { useEffect, useState } from 'react';

const TICK_MS = 30_000;

function minutesSinceMidnight() {
  const now = new Date(); // local getters on purpose - this is the viewer's wall clock
  return now.getHours() * 60 + now.getMinutes();
}

/** Red "current time" line, like Google Calendar's. Rendered by WeekView only inside
 * today's column; owns its own clock so the rest of the grid doesn't re-render. */
export default function NowIndicator({ rowHeight }) {
  const [minutes, setMinutes] = useState(minutesSinceMidnight);

  useEffect(() => {
    const id = setInterval(() => setMinutes(minutesSinceMidnight()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  return <div className="now-indicator" style={{ top: (minutes / 60) * rowHeight }} aria-hidden="true" />;
}
