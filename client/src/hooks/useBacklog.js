import { useEffect, useState } from 'react';
import { getBacklog } from '../api/api.js';
import { dateKey, today } from '../utils/date.js';

const EMPTY = { pending: [], overdue: [] };

/** Backlog items (no date) and the ones scheduled from it that were left behind
 * ("Ficou pra tras"). Same fetch/cancel pattern as useTasksForRange. */
export function useBacklog(refreshKey) {
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    getBacklog(dateKey(today()))
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        console.error('Failed to load backlog', err);
        if (!cancelled) setData(EMPTY);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return { pending: data.pending, overdue: data.overdue, loading };
}
