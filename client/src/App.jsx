import { useCallback, useEffect, useState } from 'react';
import CalendarScroller from './components/CalendarScroller.jsx';
import GoalsPanel from './components/GoalsPanel.jsx';
import TaskModal from './components/TaskModal.jsx';
import AuthModal from './components/AuthModal.jsx';
import DensityPicker from './components/DensityPicker.jsx';
import BacklogView from './components/BacklogView.jsx';
import {
  getCategories,
  getGoals,
  createTask,
  updateTask,
  deleteTask,
  completeTask,
  getStoredUsername,
  getStoredName,
  isAuthenticated,
  clearSession,
} from './api/api.js';
import { dateKey, startOfWeek, today } from './utils/date.js';
import './App.css';

const DAY_COUNT_KEY = 'trilho:calendarDensity'; // mobile week density: 1 / 3 / 7 days at a time

function loadStoredDayCount() {
  const stored = Number(localStorage.getItem(DAY_COUNT_KEY));
  return [1, 3, 7].includes(stored) ? stored : 7;
}

function App() {
  const [tab, setTab] = useState('week'); // 'week' | 'month' | 'goals' | 'backlog'
  const [focusDate, setFocusDate] = useState(() => today());
  // The week currently at the top of the week-view scroll - the goals panel follows
  // this instead of focusDate, so scrolling ahead lets you add goals for future weeks.
  const [visibleWeekStart, setVisibleWeekStart] = useState(() => startOfWeek(today()));
  // Mobile-only "Dia / 3 dias / Semana" density for the week view (see DensityPicker);
  // persisted per-device so it sticks across reloads. Ignored at desktop widths (CSS
  // hides the picker there and the week view always renders 7 days regardless).
  const [dayCount, setDayCount] = useState(loadStoredDayCount);
  const [categories, setCategories] = useState([]);
  // Year goals of the current and the next year, with computed progress - feed the
  // Pendencias tab and the goal select in the task modal.
  const [yearGoals, setYearGoals] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [modalState, setModalState] = useState(null); // { task, defaultDate, forceGoal, backlog } | null
  const [jumpToken, setJumpToken] = useState(0);
  const [authUser, setAuthUser] = useState(() =>
    isAuthenticated() ? { username: getStoredUsername(), name: getStoredName() } : null
  );

  const loadCategories = useCallback(() => {
    if (!isAuthenticated()) return;
    getCategories().then(setCategories).catch(console.error);
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    if (!authUser) return;
    let cancelled = false;
    const year = today().getUTCFullYear();
    Promise.all([getGoals(year), getGoals(year + 1)])
      .then(([current, next]) => {
        if (!cancelled) setYearGoals([...current, ...next]);
      })
      .catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [refreshKey, authUser]);

  // The API client clears the session and fires this if any request comes back 401
  // (e.g. an old/invalid token) - drop back to the auth modal when that happens.
  useEffect(() => {
    function handleUnauthorized() {
      setAuthUser(null);
      setCategories([]);
      setYearGoals([]);
    }
    window.addEventListener('trilho:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('trilho:unauthorized', handleUnauthorized);
  }, []);

  function bump() {
    setRefreshKey((k) => k + 1);
  }

  function handleAuthenticated(user) {
    setAuthUser(user);
    loadCategories();
    bump();
  }

  function handleLogout() {
    clearSession();
    setAuthUser(null);
    setCategories([]);
    setYearGoals([]);
    bump();
  }

  function handleEditTask(task) {
    setModalState({ task });
  }

  function handleCreateAt(day, startTime, endTime) {
    setModalState({ defaultDate: day, defaultStartTime: startTime, defaultEndTime: endTime });
  }

  function handleAddTask() {
    if (tab === 'backlog') {
      setModalState({ backlog: true }); // "Nova pendencia": no date
    } else if (tab === 'goals') {
      setModalState({ defaultDate: visibleWeekStart, forceGoal: true });
    } else {
      setModalState({ defaultDate: focusDate, forceGoal: false });
    }
  }

  async function handleSave(payload, existingTask) {
    try {
      if (existingTask) {
        await updateTask(existingTask._id, payload);
      } else {
        await createTask(payload);
      }
      loadCategories();
      bump();
      setModalState(null);
    } catch (err) {
      console.error(err);
      alert(err.message || 'Erro ao salvar');
    }
  }

  // Quick-add from the "+ todo" input in the week view - no modal, just the title.
  async function handleAddTodo(day, title) {
    try {
      await createTask({ title, date: dateKey(day), isTodo: true });
      bump();
    } catch (err) {
      console.error(err);
      alert(err.message || 'Erro ao salvar');
    }
  }

  // Quick-add in the Pendencias tab: a task with no date. `category` is the one
  // the list is filtered by (or null), so the new item stays in view.
  async function handleAddPending(title, category) {
    try {
      await createTask({
        title,
        date: null,
        category: category?.name || '',
        categoryId: category?._id || null,
        categoryColor: category?.color,
      });
      bump();
    } catch (err) {
      console.error(err);
      alert(err.message || 'Erro ao salvar');
    }
  }

  // "+ Meta do ano": the server pins it to Jan 1 UTC of that year.
  async function handleAddYearGoal(year, title) {
    try {
      await createTask({ title, isGoal: true, goalPeriod: 'year', date: `${year}-01-01` });
      bump();
    } catch (err) {
      console.error(err);
      alert(err.message || 'Erro ao salvar');
    }
  }

  // "Voltar pras pendencias": date null puts it back in the backlog.
  async function handleMoveToBacklog(task) {
    try {
      await updateTask(task._id, { date: null });
      bump();
    } catch (err) {
      console.error(err);
      alert(err.message || 'Erro ao salvar');
    }
  }

  // Drag-and-drop in the week view. `patch` is { date, startTime?, endTime? } from
  // buildMovePatch. A recurring occurrence moves alone (scope 'single'): the server
  // builds the detached task from the body, so it needs every field, not just the patch.
  // Resolves with the saved task (WeekView uses its _id to keep keyboard focus on it);
  // rejects on failure so WeekView can put the block back where it was.
  async function handleMoveTask(task, patch) {
    const payload = task.recurrence?.enabled
      ? {
          title: task.title,
          description: task.description,
          date: patch.date,
          allDay: task.allDay,
          startTime: patch.startTime !== undefined ? patch.startTime : task.startTime,
          endTime: patch.endTime !== undefined ? patch.endTime : task.endTime,
          isGoal: task.isGoal,
          isTodo: task.isTodo,
          category: task.category,
          categoryId: task.categoryId,
          categoryColor: task.categoryColor,
          completed: task.completed,
          scope: 'single',
          occurrenceDate: dateKey(task.date),
        }
      : patch;

    try {
      const saved = await updateTask(task._id, payload);
      bump();
      return saved;
    } catch (err) {
      console.error(err);
      alert(err.message || 'Erro ao mover');
      throw err;
    }
  }

  async function handleDelete(task, scope) {
    const isSingleOccurrence = scope === 'single' && task.recurrence?.enabled;
    const isYearGoal = task.isGoal && task.goalPeriod === 'year';
    let confirmMsg = `Excluir "${task.title}"?`;
    if (isSingleOccurrence) confirmMsg = `Excluir "${task.title}" so nesse dia?`;
    else if (isYearGoal) confirmMsg = `Excluir a meta "${task.title}"? As tarefas ligadas continuam, so perdem o vinculo.`;
    if (!confirm(confirmMsg)) return;

    try {
      if (isSingleOccurrence) {
        await deleteTask(task._id, { scope: 'single', occurrenceDate: dateKey(task.date) });
      } else {
        await deleteTask(task._id);
      }
      bump();
      setModalState(null);
    } catch (err) {
      console.error(err);
      alert(err.message || 'Erro ao excluir');
    }
  }

  async function handleToggleComplete(task) {
    try {
      // Backlog items have no date (the server only needs it for recurring tasks)
      await completeTask(task._id, task.date ? dateKey(task.date) : null, !task.completed);
      bump();
    } catch (err) {
      console.error(err);
    }
  }

  function handleSelectDay(day) {
    setFocusDate(day);
    setVisibleWeekStart(startOfWeek(day));
    setTab('week');
  }

  function handleSetDayCount(n) {
    setDayCount(n);
    localStorage.setItem(DAY_COUNT_KEY, String(n));
  }

  function handleGoToday() {
    setFocusDate(today());
    setVisibleWeekStart(startOfWeek(today()));
    setJumpToken((t) => t + 1); // force a scroll-to-current even if the date didn't change
  }

  return (
    <>
      <div className={`app-shell${authUser ? '' : ' is-locked'}`} aria-hidden={authUser ? undefined : true}>
        <header className="app-header">
          <div className="brand">
            <img src="/logo-mono.svg" alt="" className="brand-mark" />
            <span className="brand-name" aria-label="Trilho">T R I L H O</span>
          </div>
          <div className="tabs">
            <button className={tab === 'week' ? 'is-active' : ''} onClick={() => setTab('week')}>
              Semana
            </button>
            <button className={tab === 'month' ? 'is-active' : ''} onClick={() => setTab('month')}>
              Mes
            </button>
            <button
              className={`tab-goals${tab === 'goals' ? ' is-active' : ''}`}
              onClick={() => setTab('goals')}
            >
              Metas
            </button>
            <button className={tab === 'backlog' ? 'is-active' : ''} onClick={() => setTab('backlog')}>
              Pendencias
            </button>
          </div>
          <div className="header-actions">
            <button className="today-btn" onClick={handleGoToday}>
              Hoje
            </button>
            {authUser && (
              <button className="logout-btn" onClick={handleLogout} title={authUser.name || authUser.username}>
                Sair
              </button>
            )}
          </div>
        </header>

        <main className="app-main">
          <div className="calendar-pane">
            {tab === 'week' && <DensityPicker value={dayCount} onChange={handleSetDayCount} />}
            {tab === 'week' && (
              <CalendarScroller
                mode="week"
                focusDate={focusDate}
                dayCount={dayCount}
                jumpToken={jumpToken}
                refreshKey={refreshKey}
                onEditTask={handleEditTask}
                onToggleComplete={handleToggleComplete}
                onVisiblePeriodChange={(period) => setVisibleWeekStart(startOfWeek(period))}
                onCreateAt={handleCreateAt}
                onAddTodo={handleAddTodo}
                onMoveTask={handleMoveTask}
              />
            )}
            {tab === 'month' && (
              <CalendarScroller
                mode="month"
                focusDate={focusDate}
                jumpToken={jumpToken}
                refreshKey={refreshKey}
                onEditTask={handleEditTask}
                onToggleComplete={handleToggleComplete}
                onSelectDay={handleSelectDay}
              />
            )}
            {tab === 'backlog' && (
              <BacklogView
                refreshKey={refreshKey}
                goals={yearGoals}
                categories={categories}
                onEditTask={handleEditTask}
                onToggleComplete={handleToggleComplete}
                onAddPending={handleAddPending}
                onAddYearGoal={handleAddYearGoal}
                onMoveToBacklog={handleMoveToBacklog}
              />
            )}
            {tab === 'goals' && (
              <GoalsPanel
                className="goals-mobile-tab"
                weekStart={visibleWeekStart}
                refreshKey={refreshKey}
                userName={authUser?.name}
                onEditTask={handleEditTask}
                onToggleComplete={handleToggleComplete}
                onAddGoal={() => setModalState({ defaultDate: visibleWeekStart, forceGoal: true })}
              />
            )}

            <button className="fab" onClick={handleAddTask} aria-label="Adicionar">
              +
            </button>
          </div>

          <aside className="goals-sidebar">
            <GoalsPanel
              weekStart={visibleWeekStart}
              refreshKey={refreshKey}
              userName={authUser?.name}
              onEditTask={handleEditTask}
              onToggleComplete={handleToggleComplete}
              onAddGoal={() => setModalState({ defaultDate: visibleWeekStart, forceGoal: true })}
            />
          </aside>
        </main>

        {modalState && (
          <TaskModal
            task={modalState.task}
            defaultDate={modalState.defaultDate}
            defaultStartTime={modalState.defaultStartTime}
            defaultEndTime={modalState.defaultEndTime}
            forceGoal={modalState.forceGoal}
            defaultBacklog={modalState.backlog}
            goalOptions={yearGoals}
            categories={categories}
            onClose={() => setModalState(null)}
            onSave={handleSave}
            onDelete={handleDelete}
          />
        )}
      </div>

      {!authUser && <AuthModal onAuthenticated={handleAuthenticated} />}
    </>
  );
}

export default App;
