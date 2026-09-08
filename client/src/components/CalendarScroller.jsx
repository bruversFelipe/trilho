import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { addDays, addMonths, dateKey, startOfMonth, startOfWeek } from '../utils/date.js';
import WeekView from './WeekView.jsx';
import MonthView from './MonthView.jsx';

const STEP = { week: (d, n) => addDays(d, 7 * n), month: (d, n) => addMonths(d, n) };
const ANCHOR = { week: startOfWeek, month: startOfMonth };
const DEFAULT_WEEK_SCROLL_HOUR = 6; // land on 6am, not midnight - most people's day starts around there

/** Scrolls `container` so `periodEl` (or, in week mode, its 6am row) sits just
 * below that period's sticky header (day-bar + all-day row), instead of
 * jumping to midnight. */
function scrollToPeriod(container, periodEl, mode) {
  const anchor = mode === 'week' ? periodEl.querySelector(`[data-hour="${DEFAULT_WEEK_SCROLL_HOUR}"]`) : null;
  const target = anchor || periodEl;
  const stickyHeader = periodEl.querySelector('.week-sticky-header');
  const headerOffset = stickyHeader ? stickyHeader.getBoundingClientRect().height : 0;

  const containerRect = container.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  container.scrollTop += targetRect.top - containerRect.top - headerOffset;
}

export default function CalendarScroller({
  mode,
  focusDate,
  jumpToken,
  refreshKey,
  onEditTask,
  onToggleComplete,
  onSelectDay,
  onVisiblePeriodChange,
  onCreateAt,
}) {
  const step = STEP[mode];
  const anchor = ANCHOR[mode];

  const [periods, setPeriods] = useState(() => {
    const base = anchor(focusDate);
    return [step(base, -1), base, step(base, 1), step(base, 2)];
  });

  const containerRef = useRef(null);
  const topSentinelRef = useRef(null);
  const bottomSentinelRef = useRef(null);
  const periodRefs = useRef({});
  const prependAdjustRef = useRef(null);
  const centerKeyRef = useRef(dateKey(anchor(focusDate)));
  const pendingCenterRef = useRef(true); // scroll to the current period once, on mount
  const lastFocusKeyRef = useRef(dateKey(focusDate));
  const lastJumpTokenRef = useRef(jumpToken);

  // Recenter when the caller jumps to a different date (e.g. picking a day in Month view)
  // or explicitly asks to jump back to the current period (e.g. the "Hoje" button), even
  // if the date itself didn't change since we might just be scrolled away from it.
  useEffect(() => {
    const key = dateKey(focusDate);
    const dateChanged = key !== lastFocusKeyRef.current;
    const jumped = jumpToken !== lastJumpTokenRef.current;
    if (!dateChanged && !jumped) return;

    lastFocusKeyRef.current = key;
    lastJumpTokenRef.current = jumpToken;
    const base = anchor(focusDate);
    centerKeyRef.current = dateKey(base);
    pendingCenterRef.current = true;
    setPeriods([step(base, -1), base, step(base, 1), step(base, 2)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey(focusDate), jumpToken, mode]);

  useLayoutEffect(() => {
    if (pendingCenterRef.current && containerRef.current) {
      const target = periodRefs.current[centerKeyRef.current];
      if (target) {
        scrollToPeriod(containerRef.current, target, mode);
        pendingCenterRef.current = false;
        return;
      }
    }

    if (prependAdjustRef.current != null && containerRef.current) {
      containerRef.current.scrollTop += containerRef.current.scrollHeight - prependAdjustRef.current;
      prependAdjustRef.current = null;
    }
  }, [periods]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;

          if (entry.target === bottomSentinelRef.current) {
            setPeriods((prev) => [...prev, step(prev[prev.length - 1], 1)]);
          } else if (entry.target === topSentinelRef.current) {
            setPeriods((prev) => {
              if (prependAdjustRef.current == null) {
                prependAdjustRef.current = container.scrollHeight;
              }
              return [step(prev[0], -1), ...prev];
            });
          }
        }
      },
      { root: container, rootMargin: '200px 0px' }
    );

    if (topSentinelRef.current) observer.observe(topSentinelRef.current);
    if (bottomSentinelRef.current) observer.observe(bottomSentinelRef.current);

    return () => observer.disconnect();
  }, [step]);

  const periodsRef = useRef(periods);
  useEffect(() => {
    periodsRef.current = periods;
  }, [periods]);

  const lastReportedKeyRef = useRef(null);

  // Tells the caller which period is currently at the top of the viewport as the
  // user free-scrolls, so e.g. the goals sidebar can follow along to a future week.
  useEffect(() => {
    if (!onVisiblePeriodChange) return undefined;
    const container = containerRef.current;
    if (!container) return undefined;

    let frame = null;
    function computeActive() {
      frame = null;
      const probeY = container.getBoundingClientRect().top + 4;

      for (const period of periodsRef.current) {
        const el = periodRefs.current[dateKey(period)];
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (rect.top <= probeY && rect.bottom > probeY) {
          const key = dateKey(period);
          if (lastReportedKeyRef.current !== key) {
            lastReportedKeyRef.current = key;
            onVisiblePeriodChange(period);
          }
          break;
        }
      }
    }

    function handleScroll() {
      if (frame == null) frame = requestAnimationFrame(computeActive);
    }

    container.addEventListener('scroll', handleScroll, { passive: true });
    computeActive();

    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (frame != null) cancelAnimationFrame(frame);
    };
  }, [onVisiblePeriodChange]);

  const View = mode === 'week' ? WeekView : MonthView;
  const propName = mode === 'week' ? 'weekStart' : 'monthStart';

  return (
    <div className="calendar-scroller" ref={containerRef}>
      <div ref={topSentinelRef} className="scroll-sentinel" />
      {periods.map((periodStart) => {
        const key = dateKey(periodStart);
        return (
          <div key={key} ref={(el) => (periodRefs.current[key] = el)}>
            <View
              {...{ [propName]: periodStart }}
              refreshKey={refreshKey}
              onEditTask={onEditTask}
              onToggleComplete={onToggleComplete}
              onSelectDay={onSelectDay}
              onCreateAt={onCreateAt}
            />
          </div>
        );
      })}
      <div ref={bottomSentinelRef} className="scroll-sentinel" />
    </div>
  );
}
