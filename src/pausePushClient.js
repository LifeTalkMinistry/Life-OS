import { DEFAULT_API_URL, restorePauseBackendSession } from './auth/backendClient.js';

const PUBLIC_KEY_PATH = '/api/pause/push/public-key';
const SUBSCRIPTIONS_PATH = '/api/pause/push/subscriptions';

function pausePushApiUrl() {
  const configured = typeof window !== 'undefined'
    ? String(window.PAUSE_API_URL || '').trim()
    : '';
  return (configured || DEFAULT_API_URL).replace(/\/+$/, '');
}

function pausePushSupported() {
  return Boolean(
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    typeof Notification !== 'undefined'
  );
}

function pausePushTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Manila';
  } catch {
    return 'Asia/Manila';
  }
}

function pauseBase64UrlToBytes(value) {
  const padding = '='.repeat((4 - (String(value).length % 4)) % 4);
  const base64 = String(value).replace(/-/g, '+').replace(/_/g, '/') + padding;
  const raw = atob(base64);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

async function pausePushSession() {
  const session = await restorePauseBackendSession();
  if (!session?.token || session.offline) {
    throw new Error('PAUSE notification setup needs an online PAUSE account session.');
  }
  return session;
}

async function pausePushRequest(path, { method = 'GET', body } = {}) {
  const session = await pausePushSession();
  const response = await fetch(`${pausePushApiUrl()}${path}`, {
    method,
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${session.token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {}

  if (!response.ok) {
    const error = new Error(payload?.message || `PAUSE notification request failed with status ${response.status}.`);
    error.status = response.status;
    error.code = payload?.code || null;
    throw error;
  }
  return payload;
}

async function pauseServiceWorkerRegistration() {
  if (!pausePushSupported()) return null;
  let registration = await navigator.serviceWorker.getRegistration('./');
  if (!registration) {
    registration = await navigator.serviceWorker.register('./sw.js', {
      scope: './',
      updateViaCache: 'none'
    });
  }
  await navigator.serviceWorker.ready;
  return registration;
}

function pauseSerializeSubscription(subscription) {
  if (!subscription) return null;
  const json = subscription.toJSON ? subscription.toJSON() : subscription;
  return {
    endpoint: json.endpoint,
    expirationTime: json.expirationTime ?? null,
    keys: {
      p256dh: json.keys?.p256dh || '',
      auth: json.keys?.auth || ''
    }
  };
}

async function pauseRegisterSubscriptionWithServer(subscription) {
  const serialized = pauseSerializeSubscription(subscription);
  if (!serialized?.endpoint) throw new Error('PAUSE could not read this device push subscription.');
  return pausePushRequest(SUBSCRIPTIONS_PATH, {
    method: 'POST',
    body: {
      subscription: serialized,
      deviceLabel: 'PAUSE PWA',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      timezone: pausePushTimezone()
    }
  });
}

export async function getPausePushState() {
  if (!pausePushSupported()) {
    return { status: 'unavailable', label: 'Unavailable', canEnable: false, canDisable: false };
  }

  if (Notification.permission === 'denied') {
    return { status: 'blocked', label: 'Blocked', canEnable: false, canDisable: false };
  }

  const registration = await pauseServiceWorkerRegistration().catch(() => null);
  const subscription = await registration?.pushManager?.getSubscription?.().catch(() => null);

  if (Notification.permission === 'granted' && subscription) {
    return { status: 'on', label: 'On', canEnable: false, canDisable: true };
  }

  return {
    status: 'off',
    label: Notification.permission === 'granted' ? 'Off' : 'Not allowed yet',
    canEnable: true,
    canDisable: false
  };
}

export async function enablePausePushNotifications() {
  if (!pausePushSupported()) throw new Error('Device notifications are not supported here.');

  if (Notification.permission !== 'granted') {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return getPausePushState();
    }
  }

  const registration = await pauseServiceWorkerRegistration();
  let subscription = await registration.pushManager.getSubscription();
  let createdHere = false;

  if (!subscription) {
    const keyPayload = await pausePushRequest(PUBLIC_KEY_PATH);
    const publicKey = String(keyPayload?.publicKey || '').trim();
    if (!publicKey) throw new Error('PAUSE notification server did not provide a push key.');
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: pauseBase64UrlToBytes(publicKey)
    });
    createdHere = true;
  }

  try {
    await pauseRegisterSubscriptionWithServer(subscription);
  } catch (error) {
    if (createdHere) await subscription.unsubscribe().catch(() => false);
    throw error;
  }
  return getPausePushState();
}

export async function disablePausePushNotifications() {
  if (!pausePushSupported()) return getPausePushState();
  const registration = await pauseServiceWorkerRegistration().catch(() => null);
  const subscription = await registration?.pushManager?.getSubscription?.().catch(() => null);
  if (!subscription) return getPausePushState();

  const endpoint = subscription.endpoint;
  try {
    await pausePushRequest(SUBSCRIPTIONS_PATH, {
      method: 'DELETE',
      body: { endpoint }
    });
  } catch {
    // Local unsubscribe still prevents delivery to this device. The server will
    // deactivate a stale endpoint if a future delivery reports it gone.
  }
  await subscription.unsubscribe().catch(() => false);
  return getPausePushState();
}

export async function syncExistingPausePushSubscription() {
  if (!pausePushSupported() || Notification.permission !== 'granted') return false;
  try {
    const registration = await pauseServiceWorkerRegistration();
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return false;
    await pauseRegisterSubscriptionWithServer(subscription);
    return true;
  } catch {
    return false;
  }
}
