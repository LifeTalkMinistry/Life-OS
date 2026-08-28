const DEFAULT_API_URL = 'https://api.clarapmc.com';
const LOGIN_PATH = '/api/clara/auth/login';
const ME_PATH = '/api/users/me';
const TOKEN_KEY = 'pause_backend_access_token_v1';
const USER_KEY = 'pause_backend_user_v1';

function getStorage() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage || null;
  } catch {
    return null;
  }
}

function apiUrl() {
  const configured = typeof window !== 'undefined'
    ? String(window.PAUSE_API_URL || '').trim()
    : '';
  return (configured || DEFAULT_API_URL).replace(/\/+$/, '');
}

function normalizeUser(payload = {}) {
  let user = payload;
  for (let depth = 0; depth < 4; depth += 1) {
    if (!user || typeof user !== 'object' || Array.isArray(user)) break;
    if (user.id !== undefined || user.user_id !== undefined || user.userId !== undefined) break;
    if (user.user && typeof user.user === 'object') user = user.user;
    else if (user.data && typeof user.data === 'object') user = user.data;
    else if (user.profile && typeof user.profile === 'object') user = user.profile;
    else break;
  }

  const id = user?.id ?? user?.user_id ?? user?.userId ?? null;
  if (id === null || id === undefined || String(id).trim() === '') return null;

  return {
    id,
    name: String(user.name || user.full_name || user.display_name || 'PAUSE User').trim() || 'PAUSE User',
    email: String(user.email || '').trim().toLowerCase(),
    role: String(user.role || user.user_role || 'user').trim().toLowerCase() || 'user',
    status: String(user.status || user.account_status || '').trim().toLowerCase() || 'inactive',
    plan: String(user.plan || user.subscription_plan || 'free').trim().toLowerCase() || 'free'
  };
}

function readJwtPayload(token) {
  try {
    const encoded = String(token || '').split('.')[1];
    if (!encoded) return null;
    const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function isTokenLive(token, now = Date.now()) {
  const payload = readJwtPayload(token);
  const expiresAt = Number(payload?.exp || 0) * 1000;
  return Boolean(token && Number.isFinite(expiresAt) && expiresAt > now + 5000);
}

function getStoredToken() {
  return getStorage()?.getItem(TOKEN_KEY) || null;
}

function getStoredUser() {
  try {
    return normalizeUser(JSON.parse(getStorage()?.getItem(USER_KEY) || 'null'));
  } catch {
    return null;
  }
}

function saveSession({ token, user }) {
  const normalizedUser = normalizeUser(user);
  if (!token || !normalizedUser) throw new Error('The account server returned an incomplete login response.');
  const storage = getStorage();
  storage?.setItem(TOKEN_KEY, token);
  storage?.setItem(USER_KEY, JSON.stringify(normalizedUser));
  return { token, user: normalizedUser };
}

export function clearPauseSession() {
  const storage = getStorage();
  storage?.removeItem(TOKEN_KEY);
  storage?.removeItem(USER_KEY);
}

async function parseResponse(response) {
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error = new Error(payload?.message || `Account request failed with status ${response.status}.`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

async function request(path, { method = 'GET', body, token } = {}) {
  let response;
  try {
    response = await fetch(`${apiUrl()}${path}`, {
      method,
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
  } catch (cause) {
    const error = new Error('PAUSE could not reach the account server.');
    error.code = 'NETWORK_ERROR';
    error.cause = cause;
    throw error;
  }
  return parseResponse(response);
}

export async function signInWithPauseBackend({ email, password }) {
  const payload = await request(LOGIN_PATH, {
    method: 'POST',
    body: {
      email: String(email || '').trim(),
      password: String(password || '')
    }
  });
  return saveSession(payload || {});
}

export async function restorePauseBackendSession() {
  const token = getStoredToken();
  const cachedUser = getStoredUser();

  if (!token || !cachedUser) {
    clearPauseSession();
    return null;
  }

  if (!isTokenLive(token)) {
    clearPauseSession();
    return null;
  }

  try {
    const payload = await request(ME_PATH, { token });
    const user = normalizeUser(payload);
    if (!user) throw new Error('The account server returned an incomplete user profile.');
    return saveSession({ token, user });
  } catch (error) {
    if (error?.status === 401 || error?.status === 403) {
      clearPauseSession();
      return null;
    }
    if (error?.code === 'NETWORK_ERROR') {
      return { token, user: cachedUser, offline: true };
    }
    throw error;
  }
}

export function signOutFromPauseBackend() {
  clearPauseSession();
}

export function friendlyAuthError(error) {
  const message = String(error?.message || '');
  const normalized = message.toLowerCase();

  if (error?.code === 'NETWORK_ERROR' || normalized.includes('account server')) {
    return 'PAUSE could not reach the account server. Check your connection and try again.';
  }
  if (error?.status === 401 || normalized.includes('invalid email or password')) {
    return 'Invalid email or password.';
  }
  if (error?.status === 429) {
    return 'Too many login attempts. Please wait a moment and try again.';
  }
  if (normalized.includes('origin is not allowed')) {
    return 'This PAUSE installation is not yet approved by the account server.';
  }
  return message || 'PAUSE could not complete the login.';
}

export { DEFAULT_API_URL, LOGIN_PATH, ME_PATH, TOKEN_KEY, USER_KEY };
