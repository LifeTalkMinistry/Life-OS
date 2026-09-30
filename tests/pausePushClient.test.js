import test from 'node:test';
import assert from 'node:assert/strict';

const TOKEN_KEY = 'pause_backend_access_token_v1';
const USER_KEY = 'pause_backend_user_v1';

function createStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    }
  };
}

function createToken() {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode({
    app: 'pause',
    aud: 'pause-client',
    exp: Math.floor(Date.now() / 1000) + 3600
  })}.test`;
}

function response(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload;
    }
  };
}

test('PAUSE push state follows the local + backend status matrix', async () => {
  const storage = createStorage();
  const eventTarget = new EventTarget();
  const user = {
    id: 7,
    name: 'PAUSE Test',
    email: 'pause-test@example.com',
    role: 'user',
    status: 'active',
    plan: 'free',
    app: 'pause'
  };
  storage.setItem(TOKEN_KEY, createToken());
  storage.setItem(USER_KEY, JSON.stringify(user));

  const windowMock = {
    localStorage: storage,
    PAUSE_API_URL: 'https://pause.test',
    PushManager: function PushManager() {},
    addEventListener: (...args) => eventTarget.addEventListener(...args),
    dispatchEvent: (...args) => eventTarget.dispatchEvent(...args)
  };
  Object.defineProperty(globalThis, 'window', { value: windowMock, configurable: true, writable: true });

  let permission = 'default';
  Object.defineProperty(globalThis, 'Notification', {
    value: {
      get permission() {
        return permission;
      },
      async requestPermission() {
        return permission;
      }
    },
    configurable: true,
    writable: true
  });

  let localSubscription = null;
  const subscription = {
    endpoint: 'https://push.example.test/subscription-id',
    toJSON() {
      return {
        endpoint: this.endpoint,
        expirationTime: null,
        keys: { p256dh: 'test-p256dh', auth: 'test-auth' }
      };
    },
    async unsubscribe() {
      localSubscription = null;
      return true;
    }
  };
  const registration = {
    pushManager: {
      async getSubscription() {
        return localSubscription;
      }
    }
  };
  const navigatorMock = {
    userAgent: 'PAUSE node test',
    serviceWorker: {
      async getRegistration() {
        return registration;
      },
      async register() {
        return registration;
      },
      ready: Promise.resolve(registration)
    }
  };
  Object.defineProperty(globalThis, 'navigator', { value: navigatorMock, configurable: true, writable: true });

  let backendConfigured = false;
  let syncShouldSucceed = true;
  let subscriptionPosts = 0;
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    writable: true,
    value: async (url, options = {}) => {
      const pathname = new URL(String(url)).pathname;
      if (pathname === '/api/pause/me') return response(200, user);
      if (pathname === '/api/pause/push/status') return response(200, { configured: backendConfigured });
      if (pathname === '/api/pause/push/subscriptions' && options.method === 'POST') {
        subscriptionPosts += 1;
        if (!syncShouldSucceed) return response(500, { message: 'sync failed' });
        backendConfigured = true;
        return response(201, { configured: true });
      }
      return response(404, { message: 'not found' });
    }
  });

  const { getPausePushState } = await import('../src/pausePushClient.js');

  permission = 'default';
  localSubscription = null;
  assert.deepEqual(await getPausePushState(), {
    status: 'off',
    label: 'Not allowed yet',
    canEnable: true,
    canDisable: false
  });

  permission = 'denied';
  localSubscription = null;
  assert.deepEqual(await getPausePushState(), {
    status: 'blocked',
    label: 'Blocked',
    canEnable: false,
    canDisable: false
  });

  permission = 'granted';
  localSubscription = null;
  assert.deepEqual(await getPausePushState(), {
    status: 'off',
    label: 'Off',
    canEnable: true,
    canDisable: false
  });

  permission = 'granted';
  localSubscription = subscription;
  backendConfigured = false;
  syncShouldSucceed = true;
  subscriptionPosts = 0;
  const recovered = await getPausePushState();
  assert.equal(recovered.status, 'on');
  assert.equal(recovered.label, 'On');
  assert.equal(backendConfigured, true);
  assert.ok(subscriptionPosts >= 1);

  permission = 'granted';
  localSubscription = subscription;
  backendConfigured = false;
  syncShouldSucceed = false;
  const reconnect = await getPausePushState();
  assert.equal(reconnect.status, 'off');
  assert.equal(reconnect.label, 'Reconnect');

  permission = 'granted';
  localSubscription = subscription;
  backendConfigured = true;
  syncShouldSucceed = true;
  const connected = await getPausePushState();
  assert.equal(connected.status, 'on');
  assert.equal(connected.label, 'On');
});
