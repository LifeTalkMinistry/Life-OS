import { DEFAULT_API_URL } from '../auth/backendClient.js';

const PAUSE_SYNC_PATH = '/api/pause/sync';

function pauseSyncApiUrl() {
  const configured = typeof window !== 'undefined'
    ? String(window.PAUSE_API_URL || '').trim()
    : '';
  return (configured || DEFAULT_API_URL).replace(/\/+$/, '');
}

async function parseSyncResponse(response) {
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error = new Error(payload?.message || `PAUSE sync failed with status ${response.status}.`);
    error.status = response.status;
    error.code = payload?.code || null;
    throw error;
  }
  return payload;
}

async function syncRequest(method, token, body) {
  let response;
  try {
    response = await fetch(`${pauseSyncApiUrl()}${PAUSE_SYNC_PATH}`, {
      method,
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
  } catch (cause) {
    const error = new Error('PAUSE could not reach sync right now.');
    error.code = 'NETWORK_ERROR';
    error.cause = cause;
    throw error;
  }
  return parseSyncResponse(response);
}

export async function pullPauseCloudState(token) {
  return syncRequest('GET', token);
}

export async function pushPauseCloudState(token, { state, scorePreference }) {
  return syncRequest('PUT', token, { state, scorePreference });
}

export { PAUSE_SYNC_PATH };
