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

export function LoginScreen({
  mode = 'login',
  onLogin,
  onRegister,
  onModeChange,
  loading = false,
  error = ''
} = {}) {
  const signingUp = mode === 'signup';
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
        <h1>${signingUp ? 'Create your PAUSE account.' : 'Welcome back.'}</h1>
        <p>${signingUp ? 'This account belongs only to PAUSE.' : 'Sign in to your PAUSE account.'}</p>
      </div>

      ${signingUp ? `
        <label class="pause-login-field">
          <span>Name</span>
          <input
            type="text"
            name="name"
            autocomplete="name"
            placeholder="Your name"
            required
          />
        </label>
      ` : ''}

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
            autocomplete="${signingUp ? 'new-password' : 'current-password'}"
            placeholder="${signingUp ? 'At least 8 characters' : 'Your password'}"
            required
          />
          <button type="button" class="pause-password-toggle" aria-label="Show password">Show</button>
        </div>
      </label>

      <p class="pause-login-error" role="alert" ${error ? '' : 'hidden'}>${escapeHtml(error)}</p>

      <button type="submit" class="pause-login-submit" ${loading ? 'disabled' : ''}>
        ${loading ? (signingUp ? 'Creating account…' : 'Signing in…') : (signingUp ? 'Create account' : 'Log in')}
      </button>

      <button type="button" class="pause-auth-switch">
        ${signingUp ? 'Already have a PAUSE account? Log in' : 'New to PAUSE? Create account'}
      </button>

      <p class="pause-login-family-note">Your PAUSE account stays separate.</p>
    </form>
  `;

  view.querySelector('.pause-login-orb')?.appendChild(OrbArtwork());

  const form = view.querySelector('.pause-login-form');
  const nameInput = form?.elements?.name;
  const emailInput = form?.elements?.email;
  const passwordInput = form?.elements?.password;
  const toggle = view.querySelector('.pause-password-toggle');
  const submitButton = view.querySelector('.pause-login-submit');
  const modeButton = view.querySelector('.pause-auth-switch');
  const errorNode = view.querySelector('.pause-login-error');
  let submitting = Boolean(loading);

  toggle?.addEventListener('click', () => {
    if (!passwordInput) return;
    const showing = passwordInput.type === 'text';
    passwordInput.type = showing ? 'password' : 'text';
    toggle.textContent = showing ? 'Show' : 'Hide';
    toggle.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
    passwordInput.focus();
  });

  modeButton?.addEventListener('click', () => {
    if (submitting) return;
    onModeChange?.(signingUp ? 'login' : 'signup');
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitting) return;

    const name = String(nameInput?.value || '').trim();
    const email = String(emailInput?.value || '').trim();
    const password = String(passwordInput?.value || '');

    if ((signingUp && !name) || !email || !password) {
      if (errorNode) {
        errorNode.hidden = false;
        errorNode.textContent = signingUp
          ? 'Enter your name, email, and password.'
          : 'Enter your email and password.';
      }
      return;
    }

    submitting = true;
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = signingUp ? 'Creating account…' : 'Signing in…';
    }
    if (nameInput) nameInput.disabled = true;
    if (emailInput) emailInput.disabled = true;
    if (passwordInput) passwordInput.disabled = true;
    if (toggle) toggle.disabled = true;
    if (modeButton) modeButton.disabled = true;
    if (errorNode) errorNode.hidden = true;

    if (signingUp) await onRegister?.({ name, email, password });
    else await onLogin?.({ email, password });
  });

  queueMicrotask(() => (signingUp ? nameInput : emailInput)?.focus());
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
