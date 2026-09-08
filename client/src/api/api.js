const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const TOKEN_KEY = 'trilho_token';
const USERNAME_KEY = 'trilho_username';
const NAME_KEY = 'trilho_name';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUsername() {
  return localStorage.getItem(USERNAME_KEY);
}

export function getStoredName() {
  return localStorage.getItem(NAME_KEY);
}

export function isAuthenticated() {
  return !!getToken();
}

export function saveSession({ token, user }) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USERNAME_KEY, user.username);
  localStorage.setItem(NAME_KEY, user.name || '');
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USERNAME_KEY);
  localStorage.removeItem(NAME_KEY);
}

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });

  if (res.status === 401) {
    clearSession();
    window.dispatchEvent(new Event('trilho:unauthorized'));
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

export function checkSlug(name) {
  return request(`/auth/slug-availability?name=${encodeURIComponent(name)}`);
}

export function register(name, password) {
  return request('/auth/register', { method: 'POST', body: JSON.stringify({ name, password }) });
}

export function login(username, password) {
  return request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
}

export function getTasks(start, end) {
  if (!getToken()) return Promise.resolve([]);
  return request(`/tasks?start=${start}&end=${end}`);
}

export function getStats(start, end) {
  if (!getToken()) return Promise.resolve({ totalMinutes: 0, categories: [] });
  return request(`/tasks/stats?start=${start}&end=${end}`);
}

export function createTask(task) {
  return request('/tasks', { method: 'POST', body: JSON.stringify(task) });
}

export function updateTask(id, task) {
  return request(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(task) });
}

export function deleteTask(id) {
  return request(`/tasks/${id}`, { method: 'DELETE' });
}

export function completeTask(id, date, completed) {
  return request(`/tasks/${id}/complete`, {
    method: 'PATCH',
    body: JSON.stringify({ date, completed }),
  });
}

export function getCategories() {
  if (!getToken()) return Promise.resolve([]);
  return request('/categories');
}
