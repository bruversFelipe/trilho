import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  applyPendingMoves,
  autoScrollDelta,
  buildMovePatch,
  describeDrop,
  describeTarget,
  dragStartMin,
  MOVE_CANCELLED,
  pickDayIndex,
  stepKeyboardTarget,
  taskSpan,
} from '../utils/drag.js';

const MOUSE_SLOP_PX = 4; // a mouse press only becomes a drag past this, so a click still opens the modal
// Touch/pen: hold still this long to pick a task up; moving more than TOUCH_SLOP_PX
// before that means the finger is scrolling, so the gesture is dropped.
const LONG_PRESS_MS = 450;
const TOUCH_SLOP_PX = 8;
const LANDING_MS = 150;

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/** Animates `el`'s transform to none, then drops the inline transition. Cleared on a
 * timer rather than transitionend: no transition runs at all when the transform was
 * already none (released before the first frame), and a leftover inline transition
 * would make the next drag of that block lag behind the pointer. */
function slideHome(el) {
  if (prefersReducedMotion() || !el.style.transform) {
    el.style.transition = '';
    el.style.transform = '';
    return;
  }
  el.style.transition = `transform ${LANDING_MS}ms ease-out`;
  el.style.transform = '';
  setTimeout(() => (el.style.transition = ''), LANDING_MS + 50);
}

/**
 * Drag-and-drop for one WeekView: moving a task to another visible day and/or time.
 * - The dragged element follows the pointer via an inline CSS transform written
 *   every animation frame, outside React; React state (`dragState`) only changes
 *   when the snapped drop target changes, so the grid isn't re-rendered per pixel.
 * - Drops are optimistic: `displayTasks` shows the task at its new place right away
 *   and keeps it there until the refetch that follows the save lands (or puts it
 *   back if the save fails).
 * - Keyboard: with an item's button focused, arrows move a preview (up/down 15 min,
 *   left/right one visible day), Enter saves, Esc or leaving the button cancels.
 *   Each step and the result go to `announcement` (an aria-live region in WeekView).
 * `rootRef` = the WeekView section, `gridRef` = .week-grid, `headerRef` = its
 * sticky header (the visible top edge for auto-scroll).
 */
export function useTaskDrag({ days, rowHeight, tasks, rootRef, gridRef, headerRef, onMoveTask }) {
  const [pending, setPending] = useState(() => new Map()); // occurrenceId -> { patch, settled }
  const [dragState, setDragState] = useState(null);
  const [announcement, setAnnouncement] = useState('');
  const hintId = useId();
  const keyboardRef = useRef(null); // { task, kind, originDayIndex, target } while moving with arrows
  const pendingFocusRef = useRef(null); // occurrenceId whose button should get focus once it renders
  const gestureRef = useRef(null); // live pointer gesture, mutated every frame
  const suppressClickRef = useRef(false);
  const lastPointerTypeRef = useRef(null);
  const touchDragActiveRef = useRef(false); // read by the permanent touchmove blocker below
  const flipRef = useRef(null); // { occurrenceId, fromRect }: animate the landing after the next render
  const pendingRef = useRef(pending);
  const latestRef = useRef(null); // latest props, read by the window listeners

  useLayoutEffect(() => {
    latestRef.current = { days, rowHeight, onMoveTask };
    pendingRef.current = pending;
  });

  // A refetch landed: the server data now reflects every move that already saved.
  useEffect(() => {
    setPending((prev) => {
      if (![...prev.values()].some((entry) => entry.settled)) return prev;
      const next = new Map();
      for (const [id, entry] of prev) if (!entry.settled) next.set(id, entry);
      return next;
    });
  }, [tasks]);

  const displayTasks = useMemo(() => {
    const patches = new Map();
    for (const [id, entry] of pending) patches.set(id, entry.patch);
    return applyPendingMoves(tasks, patches);
  }, [tasks, pending]);

  // Landing animation (FLIP): the block may have re-rendered at its new top/left, or
  // been remounted in another day's column. Start it from where it was dropped.
  useLayoutEffect(() => {
    const flip = flipRef.current;
    if (!flip || !rootRef.current) return;
    const el = rootRef.current.querySelector(`[data-occurrence-id="${CSS.escape(flip.occurrenceId)}"]`);
    if (!el) return;
    flipRef.current = null;

    el.style.transition = 'none';
    el.style.transform = '';
    const to = el.getBoundingClientRect();
    const dx = flip.fromRect.left - to.left;
    const dy = flip.fromRect.top - to.top;
    if (prefersReducedMotion() || (dx === 0 && dy === 0)) {
      el.style.transition = '';
      return;
    }
    el.style.transform = `translate(${dx}px, ${dy}px)`;
    el.getBoundingClientRect(); // flush, so the transition starts from the dropped position
    slideHome(el);
  });

  // Keyboard moves keep focus on the task: it may have been remounted in another
  // column, and after the refetch it comes back under a new occurrenceId.
  useLayoutEffect(() => {
    const id = pendingFocusRef.current;
    if (!id || !rootRef.current) return;
    const el = rootRef.current.querySelector(`[data-drag-focus="${CSS.escape(id)}"]`);
    if (!el) return;
    if (document.activeElement !== el) el.focus();
    pendingFocusRef.current = null;
  });

  function flipFrom(occurrenceId) {
    const el = rootRef.current?.querySelector(`[data-occurrence-id="${CSS.escape(occurrenceId)}"]`);
    if (el) flipRef.current = { occurrenceId, fromRect: el.getBoundingClientRect() };
  }

  function commitMove(task, patch) {
    const id = task.occurrenceId;
    setPending((prev) => new Map(prev).set(id, { patch, settled: false }));

    return Promise.resolve(latestRef.current.onMoveTask(task, patch))
      .then((saved) => {
        setPending((prev) => {
          const entry = prev.get(id);
          if (!entry) return prev;
          return new Map(prev).set(id, { ...entry, settled: true });
        });
        return saved;
      })
      .catch(() => {
        setPending((prev) => {
          const next = new Map(prev);
          next.delete(id);
          return next;
        });
        return null;
      });
  }

  function readColumns(kind) {
    const selector = kind === 'timed' ? '[data-day-col]' : '[data-strip-cell]';
    return [...rootRef.current.querySelectorAll(selector)].map((el) => el.getBoundingClientRect());
  }

  function pointerMinutes(clientY) {
    const gridTop = gridRef.current.getBoundingClientRect().top;
    return ((clientY - gridTop) / latestRef.current.rowHeight) * 60;
  }

  function computeTarget(g) {
    const dayIndex = pickDayIndex(g.lastX, g.columns);
    const startMin = g.kind === 'timed' ? dragStartMin(pointerMinutes(g.lastY) - g.grabOffsetMin, g.span) : null;
    return { dayIndex, startMin };
  }

  function autoScroll(g) {
    if (g.kind !== 'timed' || !g.scroller || !headerRef.current) return;
    const scrollerRect = g.scroller.getBoundingClientRect();
    const top = Math.max(headerRef.current.getBoundingClientRect().bottom, scrollerRect.top);
    const bottom = scrollerRect.bottom;
    let delta = autoScrollDelta(g.lastY, top, bottom);
    // Only toward where the pointer is heading: grabbing a block that already sits in
    // an edge zone (e.g. the first hour under the header) must not start scrolling.
    if (delta < 0 && g.lastY >= g.startY) delta = 0;
    if (delta > 0 && g.lastY <= g.startY) delta = 0;
    // Only within this week's grid - dragging never crosses into another week.
    const grid = gridRef.current.getBoundingClientRect();
    if (delta < 0 && grid.top >= top) delta = 0;
    if (delta > 0 && grid.bottom <= bottom) delta = 0;
    if (delta !== 0) g.scroller.scrollTop += delta;
  }

  function tick() {
    const g = gestureRef.current;
    if (!g || !g.active) return;
    autoScroll(g);

    // The element lives inside the scrolled content, so scrolling moves it too:
    // add the scroll offset back so it stays under the pointer.
    const scrollDy = (g.scroller?.scrollTop ?? 0) - g.startScrollTop;
    g.el.style.transform = `translate(${g.lastX - g.startX}px, ${g.lastY - g.startY + scrollDy}px)`;

    const target = computeTarget(g);
    if (target.dayIndex !== g.target.dayIndex || target.startMin !== g.target.startMin) {
      g.target = target;
      setDragState((s) => (s ? { ...s, ...target } : s));
    }
    g.frame = requestAnimationFrame(tick);
  }

  function activate(g) {
    g.active = true;
    g.el.style.transition = '';
    if (keyboardRef.current) {
      // A pointer drag replaces an unfinished arrow-key move (otherwise a later Enter
      // would still commit that stale keyboard target).
      keyboardRef.current = null;
    }
    if (g.pointerType !== 'mouse') {
      touchDragActiveRef.current = true;
      navigator.vibrate?.(10);
    }
    g.columns = readColumns(g.kind);
    g.target = { dayIndex: g.dayIndex, startMin: g.kind === 'timed' ? g.span.start : null };
    suppressClickRef.current = true;
    window.getSelection?.()?.removeAllRanges();
    document.body.classList.add('is-task-dragging');
    setDragState({ task: g.task, kind: g.kind, source: 'pointer', originDayIndex: g.dayIndex, ...g.target });
    g.frame = requestAnimationFrame(tick);
  }

  function handlePointerMove(e) {
    const g = gestureRef.current;
    if (!g || e.pointerId !== g.pointerId) return;
    if (g.pointerType === 'mouse' && e.buttons === 0) {
      finish(false); // the button was released somewhere we never got a pointerup (e.g. alt-tab)
      return;
    }
    g.lastX = e.clientX;
    g.lastY = e.clientY;
    if (g.active) return;
    const moved = Math.hypot(g.lastX - g.startX, g.lastY - g.startY);
    if (g.pointerType === 'mouse') {
      if (moved > MOUSE_SLOP_PX) activate(g);
    } else if (moved > TOUCH_SLOP_PX) {
      finish(false); // the finger is scrolling, not holding - let the page scroll
    }
  }

  function finish(commit, fromPointerEnd = true) {
    const g = gestureRef.current;
    if (!g) return;
    gestureRef.current = null;
    g.detach();
    if (!g.active) return; // just a click - let it through
    touchDragActiveRef.current = false;

    document.body.classList.remove('is-task-dragging');
    setDragState(null);
    // The click that follows pointerup must not open the modal. Cancelled with Esc,
    // the button is still held, so wait for that pointerup before letting clicks through.
    const releaseClicks = () => setTimeout(() => (suppressClickRef.current = false), 0);
    if (fromPointerEnd) releaseClicks();
    else window.addEventListener('pointerup', releaseClicks, { once: true, capture: true });

    const { days: currentDays } = latestRef.current;
    const patch = commit
      ? buildMovePatch(g.task, { date: currentDays[g.target.dayIndex], startMin: g.target.startMin })
      : null;
    if (!patch) {
      slideHome(g.el);
      return;
    }
    // Keep the transform until the re-render; the FLIP effect takes it from there.
    flipRef.current = { occurrenceId: g.task.occurrenceId, fromRect: g.el.getBoundingClientRect() };
    setAnnouncement(describeDrop(g.task, currentDays[g.target.dayIndex], g.target.startMin));
    commitMove(g.task, patch);
  }

  function handlePointerUp(e) {
    if (gestureRef.current && e.pointerId === gestureRef.current.pointerId) finish(true);
  }

  function handlePointerCancel(e) {
    if (gestureRef.current && e.pointerId === gestureRef.current.pointerId) finish(false);
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape' && gestureRef.current?.active) {
      e.preventDefault();
      e.stopPropagation();
      finish(false, false);
    }
  }

  // Unmounted mid-drag: drop the window listeners/frame loop, nothing else.
  useEffect(
    () => () => {
      const g = gestureRef.current;
      if (!g) return;
      gestureRef.current = null;
      g.detach();
      touchDragActiveRef.current = false;
      if (g.active) document.body.classList.remove('is-task-dragging');
    },
    []
  );

  // Once a long press picked a task up, the finger moving must drag it, not scroll the
  // calendar. Registered once, non-passive, for the component's lifetime: adding it only
  // when the drag starts isn't reliable on iOS, which decides how to treat the touch
  // based on the listeners present when it began.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;
    function blockScroll(e) {
      if (touchDragActiveRef.current) e.preventDefault();
    }
    el.addEventListener('touchmove', blockScroll, { passive: false });
    return () => el.removeEventListener('touchmove', blockScroll);
  }, [rootRef]);

  function handlePointerDown(e, task, kind, dayIndex) {
    lastPointerTypeRef.current = e.pointerType;
    if (!latestRef.current.onMoveTask || gestureRef.current) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.target.closest('[data-drag-ignore]')) return;
    // Its last move hasn't been reflected by a refetch yet - its date/id are still the
    // optimistic ones, so a second move now would be built from stale data.
    if (pendingRef.current.has(task.occurrenceId)) return;

    const scroller = rootRef.current?.closest('.calendar-scroller') ?? null;
    const span = taskSpan(task);
    gestureRef.current = {
      task,
      kind,
      dayIndex,
      span,
      el: e.currentTarget,
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      scroller,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      startScrollTop: scroller?.scrollTop ?? 0,
      grabOffsetMin: kind === 'timed' ? pointerMinutes(e.clientY) - span.start : 0,
      active: false,
      frame: null,
      target: null,
      columns: null,
    };
    // Bound to this render's handlers, so removal always matches what was added.
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);
    window.addEventListener('keydown', handleKeyDown, true);
    const gesture = gestureRef.current;
    if (e.pointerType !== 'mouse') {
      gesture.pressTimer = setTimeout(() => {
        if (gestureRef.current === gesture && !gesture.active) activate(gesture);
      }, LONG_PRESS_MS);
    }
    gesture.detach = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
      window.removeEventListener('keydown', handleKeyDown, true);
      if (gesture.frame != null) cancelAnimationFrame(gesture.frame);
      clearTimeout(gesture.pressTimer);
    };
  }

  function handleClickCapture(e, task) {
    if (suppressClickRef.current) {
      e.preventDefault();
      e.stopPropagation();
      suppressClickRef.current = false;
      return;
    }
    // Until the refetch lands, this item is an optimistic copy that still carries the
    // series' _id/recurrence and its old identity: completing it or opening the modal
    // now would act on the wrong occurrence (e.g. tick the series' own copy of that
    // day). Covers the check button, the body and Enter on it - all are clicks here.
    if (pendingRef.current.has(task.occurrenceId)) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  function cancelKeyboardMove() {
    if (!keyboardRef.current) return;
    keyboardRef.current = null;
    setDragState(null);
    setAnnouncement(MOVE_CANCELLED);
  }

  function commitKeyboardMove() {
    const kb = keyboardRef.current;
    keyboardRef.current = null;
    setDragState(null);
    const { days: currentDays } = latestRef.current;
    const date = currentDays[kb.target.dayIndex];
    const patch = buildMovePatch(kb.task, { date, startMin: kb.target.startMin });
    if (!patch) {
      setAnnouncement(MOVE_CANCELLED);
      return;
    }
    const oldId = kb.task.occurrenceId;
    flipFrom(oldId);
    pendingFocusRef.current = oldId;
    setAnnouncement(describeDrop(kb.task, date, kb.target.startMin));
    commitMove(kb.task, patch).then((saved) => {
      // After the refetch it renders as `${_id}_${date}` (new _id if it was a detached
      // recurring occurrence) - follow it there, unless focus already moved on.
      if (saved && document.activeElement?.dataset?.dragFocus === oldId) {
        pendingFocusRef.current = `${saved._id}_${patch.date}`;
      }
    });
  }

  function handleItemKeyDown(e, task, kind, dayIndex) {
    if (!latestRef.current.onMoveTask || e.altKey || e.ctrlKey || e.metaKey) return;
    const kb = keyboardRef.current?.task.occurrenceId === task.occurrenceId ? keyboardRef.current : null;

    if (kb && e.key === 'Enter') {
      e.preventDefault(); // don't also "click" the button (that opens the modal)
      commitKeyboardMove();
      return;
    }
    if (kb && e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      cancelKeyboardMove();
      return;
    }
    if (gestureRef.current) return; // a pointer drag is in progress
    if (!kb && pendingRef.current.has(task.occurrenceId)) return; // same rule as pointer drags

    const span = taskSpan(task);
    const current = kb ? kb.target : { dayIndex, startMin: kind === 'timed' ? span.start : null };
    const next = stepKeyboardTarget(current, e.key, {
      kind,
      duration: span.duration,
      dayCount: latestRef.current.days.length,
    });
    if (!next) return; // not an arrow we handle - leave the key alone (e.g. up/down scroll in the strip)
    e.preventDefault();
    keyboardRef.current = { task, kind, originDayIndex: dayIndex, target: next };
    setDragState({ task, kind, source: 'keyboard', originDayIndex: dayIndex, ...next });
    setAnnouncement(describeTarget(task, latestRef.current.days[next.dayIndex], next.startMin));
  }

  /** Props for an item's focusable button (.task-block-body / .chip-body / .todo-body). */
  function getHandleProps(task, kind, dayIndex) {
    return {
      'data-drag-focus': task.occurrenceId,
      'aria-describedby': hintId,
      onKeyDown: (e) => handleItemKeyDown(e, task, kind, dayIndex),
      onBlur: () => {
        if (keyboardRef.current?.task.occurrenceId === task.occurrenceId) cancelKeyboardMove();
      },
    };
  }

  /** Props for an item's outer element (.task-block / .chip / .todo-item). */
  function getBlockProps(task, kind, dayIndex, { onContextMenu } = {}) {
    return {
      'data-occurrence-id': task.occurrenceId,
      onPointerDown: (e) => handlePointerDown(e, task, kind, dayIndex),
      onClickCapture: (e) => handleClickCapture(e, task),
      // On touch screens a long press fires contextmenu (Android) - that press is a
      // drag now, so it must not also toggle completion. Mouse right-click still does.
      onContextMenu: (e) => {
        if (
          (lastPointerTypeRef.current && lastPointerTypeRef.current !== 'mouse') ||
          pendingRef.current.has(task.occurrenceId) // same reason as handleClickCapture
        ) {
          e.preventDefault();
          return;
        }
        onContextMenu?.(e);
      },
    };
  }

  return { displayTasks, dragState, announcement, hintId, getBlockProps, getHandleProps };
}
