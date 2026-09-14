import { useCallback, useEffect, useState } from 'react';
import CalendarScroller from './components/CalendarScroller.jsx';
import GoalsPanel from './components/GoalsPanel.jsx';
import TaskModal from './components/TaskModal.jsx';
import AuthModal from './components/AuthModal.jsx';
import DensityPicker from './components/DensityPicker.jsx';
import {
  getCategories,
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
  const [tab, setTab] = useState('week'); // 'week' | 'month' | 'goals'
  const [focusDate, setFocusDate] = useState(() => today());
  // The week currently at the top of the week-view scroll - the goals panel follows
  // this instead of focusDate, so scrolling ahead lets you add goals for future weeks.
  const [visibleWeekStart, setVisibleWeekStart] = useState(() => startOfWeek(today()));
  // Mobile-only "Dia / 3 dias / Semana" density for the week view (see DensityPicker);
  // persisted per-device so it sticks across reloads. Ignored at desktop widths (CSS
  // hides the picker there and the week view always renders 7 days regardless).
  const [dayCount, setDayCount] = useState(loadStoredDayCount);
  const [categories, setCategories] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [modalState, setModalState] = useState(null); // { task, defaultDate, forceGoal } | null
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

  // The API client clears the session and fires this if any request comes back 401
  // (e.g. an old/invalid token) - drop back to the auth modal when that happens.
  useEffect(() => {
    function handleUnauthorized() {
      setAuthUser(null);
      setCategories([]);
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
    bump();
  }

  function handleEditTask(task) {
    setModalState({ task });
  }

  function handleCreateAt(day, startTime, endTime) {
    setModalState({ defaultDate: day, defaultStartTime: startTime, defaultEndTime: endTime });
  }

  function handleAddTask() {
    if (tab === 'goals') {
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

  async function handleDelete(task, scope) {
    const isSingleOccurrence = scope === 'single' && task.recurrence?.enabled;
    const confirmMsg = isSingleOccurrence
      ? `Excluir "${task.title}" so nesse dia?`
      : `Excluir "${task.title}"?`;
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
      await completeTask(task._id, dateKey(task.date), !task.completed);
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
