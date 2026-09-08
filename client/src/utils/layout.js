/**
 * Lays out a day's timed events side by side when they overlap, like Google Calendar.
 * Takes [{ id, start, end }] (minutes since midnight) and returns a Map of
 * id -> { col, totalCols }, where `col` is the 0-based column the event sits in
 * and `totalCols` is how many columns its overlap cluster needs (both events use
 * that same total so their widths line up).
 */
export function layoutDayEvents(events) {
  const sorted = [...events].sort((a, b) => a.start - b.start || a.end - b.end);
  const layout = new Map();

  let cluster = [];
  let columnEnds = []; // columnEnds[i] = end time of the last event placed in column i
  let clusterMaxEnd = -Infinity;

  function finishCluster() {
    if (cluster.length === 0) return;
    const totalCols = columnEnds.length;
    for (const e of cluster) layout.set(e.id, { col: e.col, totalCols });
    cluster = [];
    columnEnds = [];
    clusterMaxEnd = -Infinity;
  }

  for (const ev of sorted) {
    if (ev.start >= clusterMaxEnd) finishCluster();

    let col = columnEnds.findIndex((end) => end <= ev.start);
    if (col === -1) {
      col = columnEnds.length;
      columnEnds.push(ev.end);
    } else {
      columnEnds[col] = ev.end;
    }

    cluster.push({ id: ev.id, col });
    clusterMaxEnd = Math.max(clusterMaxEnd, ev.end);
  }
  finishCluster();

  return layout;
}
