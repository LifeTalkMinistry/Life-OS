import { OrbArtwork } from '../components/OrbArtwork.js';

export function AuthCheckingScreen() {
  const view = document.createElement('section');
  view.className = 'screen pause-auth-screen pause-auth-checking';
  view.innerHTML = `
    <div class="pause-auth-brand">
      <div class="pause-auth-wordmark" aria-label="PAUSE">P A U S E</div>
      <p>Know When to Stop.</p>
    </div>
    <div class="pause-auth-orb" aria-hidden="true"></div>
    <p class="pause-auth-status">Checking your account…</p>
  `;
  view.querySelector('.pause-auth-orb')?.appendChild(OrbArtwork());
  return view;
}

export function LoginScreen({ onSubmit, loading = false, error = '' } = {}) {
  const view = document.createElement('section');
  view.className = 'screen pause-auth-screen pause-login-screen';
  view.innerHTML = `
    <div class="pause-auth-brand">
      <div class="pause-auth-wordmark" aria-label="PAUSE">P A U S E</div>
      <p>Know When to Stop.</p>
    </div>

    <div class="pause-login-orb" aria-hidden="true"></div>

    <form class="pause-login-form" novalidate>
      <div class="pause-login-heading">
        <h1>Welcome back.</h1>
        <p>Sign in with your existing account.</p>
      </div>

      <label class="pause-login-field">
        <span>Email</span>
        <input
          type="email"
          name="email"
          autocomplete="email"
          inputmode="email"
          autocapitalize="none"
          spellcheck="false"
          placeholder="you@example.com"
          required
        />
      </label>

      <label class="pause-login-field">
        <span>Password</span>
        <div class="pause-password-shell">
          <input
            type="password"
            name="password"
            autocomplete="current-password"
            placeholder="Your password"
            required
          />
          <button type="button" class="pause-password-toggle" aria-label="Show password">Show</button>
        </div>
      </label>

      <p class="pause-login-error" role="alert" ${error ? '' : 'hidden'}>${escapeHtml(error)}</p>

      <button type="submit" class="pause-login-submit" ${loading ? 'disabled' : ''}>
        ${loading ? 'Signing in…' : 'Log in'}
      </button>

      <p class="pause-login-family-note">One account. Your apps.</p>
    </form>
  `;

  view.querySelector('.pause-login-orb')?.appendChild(OrbArtwork());

  const form = view.querySelector('.pause-login-form');
  const emailInput = form?.elements?.email;
  const passwordInput = form?.elements?.password;
  const toggle = view.querySelector('.pause-password-toggle');
  const errorNode = view.querySelector('.pause-login-error');

  toggle?.addEventListener('click', () => {
    if (!passwordInput) return;
    const showing = passwordInput.type === 'text';
    passwordInput.type = showing ? 'password' : 'text';
    toggle.textContent = showing ? 'Show' : 'Hide';
    toggle.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
    passwordInput.focus();
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (loading) return;

    const email = String(emailInput?.value || '').trim();
    const password = String(passwordInput?.value || '');

    if (!email || !password) {
      if (errorNode) {
        errorNode.hidden = false;
        errorNode.textContent = 'Enter your email and password.';
      }
      return;
    }

    await onSubmit?.({ email, password });
  });

  queueMicrotask(() => emailInput?.focus());
  return view;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
