import { useEffect, useState } from 'react';
import { getTasks } from '../api/api.js';
import { dateKey } from '../utils/date.js';

export function useTasksForRange(rangeStart, rangeEnd, refreshKey) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    getTasks(dateKey(rangeStart), dateKey(rangeEnd))
      .then((data) => {
        if (!cancelled) setTasks(data);
      })
      .catch((err) => {
        console.error('Failed to load tasks', err);
        if (!cancelled) setTasks([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey(rangeStart), dateKey(rangeEnd), refreshKey]);

  return { tasks, loading };
}
