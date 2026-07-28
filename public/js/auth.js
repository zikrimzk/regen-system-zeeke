/**
 * auth.js — Handles login and registration forms
 */

document.addEventListener('DOMContentLoaded', () => {
  const loginForm    = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  let countryInput = null;
  let stateInput = null;
  let postcodeInput = null;
  let postcodeError = null;
  let validateRegistrationPostcode = () => true;

  function showGoogleStatus(block, shell, message, loading = false) {
    const status = document.createElement('div');
    status.className = loading ? 'google-button-status is-loading' : 'google-button-status';
    status.setAttribute('role', loading ? 'status' : 'note');

    const indicator = document.createElement('span');
    indicator.className = 'google-status-indicator';
    indicator.setAttribute('aria-hidden', 'true');

    const text = document.createElement('span');
    text.textContent = message;

    status.append(indicator, text);
    shell.replaceChildren(status);
    block.classList.toggle('is-loading', loading);
    block.classList.toggle('is-unavailable', !loading);
  }

  function loadGoogleIdentityLibrary() {
    if (window.google?.accounts?.id) return Promise.resolve();

    return new Promise((resolve, reject) => {
      let script = document.querySelector('script[data-google-identity]');
      if (!script) {
        script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.dataset.googleIdentity = 'true';
        document.head.appendChild(script);
      }

      script.addEventListener('load', resolve, { once: true });
      script.addEventListener('error', reject, { once: true });
    });
  }

  async function initializeGoogleAuth() {
    const block = document.getElementById('google-auth');
    const shell = document.getElementById('google-button-shell');
    if (!block || !shell) return;

    try {
      const response = await fetch('/api/auth/google/config', {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
      const config = await response.json();
      if (
        !response.ok
        || !config.enabled
        || !config.clientId
        || !config.loginUri
      ) {
        return;
      }

      block.hidden = false;
      showGoogleStatus(block, shell, 'Loading secure Google sign-in…', true);
      await loadGoogleIdentityLibrary();

      if (!window.google?.accounts?.id) {
        throw new Error('Google Identity Services did not initialize.');
      }

      shell.replaceChildren();
      block.classList.remove('is-loading', 'is-unavailable');
      window.google.accounts.id.initialize({
        client_id: config.clientId,
        login_uri: config.loginUri,
        ux_mode: 'redirect',
        auto_select: false,
      });
      window.google.accounts.id.renderButton(shell, {
        type: 'standard',
        size: 'large',
        theme: 'outline',
        text: 'continue_with',
        shape: 'rectangular',
        logo_alignment: 'left',
        width: Math.max(220, Math.min(400, Math.floor(shell.getBoundingClientRect().width))),
        state: block.dataset.page === 'register' ? 'register' : 'login',
      });

      window.setTimeout(() => {
        const renderedControl = shell.firstElementChild;
        const renderedRect = renderedControl?.getBoundingClientRect();
        if (!renderedRect || renderedRect.width < 200 || renderedRect.height < 36) {
          showGoogleStatus(
            block,
            shell,
            'Google sign-in is unavailable for this web address. Continue with email below.'
          );
        }
      }, 1500);
    } catch (error) {
      block.hidden = false;
      showGoogleStatus(
        block,
        shell,
        'Google sign-in could not load. Continue with email below.'
      );
    }
  }

  initializeGoogleAuth();

  function setPasswordToggle(button, visible) {
    button.innerHTML = ReGenIcons.icon(visible ? 'eyeOff' : 'eye');
    button.setAttribute('aria-label', visible ? 'Hide password' : 'Show password');
    button.title = visible ? 'Hide password' : 'Show password';
  }

  // ── Password toggles ──────────────────────────────────────────
  document.querySelectorAll('.auth-password-toggle').forEach(btn => {
    setPasswordToggle(btn, false);
    btn.addEventListener('click', () => {
      const input = btn.previousElementSibling;
      if (input.type === 'password') {
        input.type = 'text';
        setPasswordToggle(btn, true);
      } else {
        input.type = 'password';
        setPasswordToggle(btn, false);
      }
    });
  });

  // ── Registration validation & strength ────────────────────────
  if (registerForm) {
    const pwdInput = document.getElementById('password');
    const confirmInput = document.getElementById('confirmPassword');
    const fill = document.getElementById('pwd-fill');
    const label = document.getElementById('pwd-label');
    const matchError = document.getElementById('match-error');
    countryInput = document.getElementById('registerCountry');
    stateInput = document.getElementById('registerState');
    postcodeInput = document.getElementById('registerPostcode');
    postcodeError = document.getElementById('register-postcode-error');

    countryInput.innerHTML = ZeekeLookups.COUNTRIES
      .filter(country => country !== 'Worldwide')
      .map(country => `<option value="${ZeekeSafe.attr(country)}" ${country === 'Malaysia' ? 'selected' : ''}>${ZeekeSafe.attr(country)}</option>`)
      .join('');
    stateInput.innerHTML = [''].concat(ZeekeLookups.MALAYSIA_STATES)
      .map(state => `<option value="${ZeekeSafe.attr(state)}">${state ? ZeekeSafe.attr(state) : 'Select state'}</option>`)
      .join('');

    function updateRegistrationLocation() {
      const isMalaysia = countryInput.value === 'Malaysia';
      document.getElementById('register-state-group')?.classList.toggle('hidden', !isMalaysia);
      document.getElementById('register-postcode-group')?.classList.toggle('hidden', !isMalaysia);
      stateInput.required = isMalaysia;
      postcodeInput.required = isMalaysia;
      if (!isMalaysia) {
        stateInput.value = '';
        postcodeInput.value = '';
        postcodeInput.classList.remove('is-error');
        postcodeError?.classList.remove('visible');
      }
    }

    validateRegistrationPostcode = function validatePostcode() {
      if (countryInput.value !== 'Malaysia') return true;
      const result = ZeekeLookups.validateMalaysiaPostcode(postcodeInput.value, stateInput.value);
      postcodeInput.value = result.postcode;
      const ok = result.ok && !!stateInput.value && !!postcodeInput.value;
      postcodeInput.classList.toggle('is-error', !ok);
      postcodeError?.classList.toggle('visible', !ok);
      return ok;
    };

    countryInput.addEventListener('change', updateRegistrationLocation);
    stateInput.addEventListener('change', validateRegistrationPostcode);
    postcodeInput.addEventListener('input', () => {
      postcodeInput.value = postcodeInput.value.replace(/\D/g, '').slice(0, 5);
      if (postcodeInput.value.length === 5) validateRegistrationPostcode();
    });
    updateRegistrationLocation();

    pwdInput?.addEventListener('input', () => {
      const val = pwdInput.value;
      let score = 0;
      if (val.length >= 8) score++;
      if (val.match(/[A-Z]/)) score++;
      if (val.match(/[0-9]/)) score++;
      if (val.match(/[^A-Za-z0-9]/)) score++;

      let color = 'var(--danger)';
      let text = 'Weak';
      let pct = '25%';

      if (val.length === 0) { pct = '0%'; text = 'Min 8 characters'; color = 'var(--border)'; }
      else if (score === 1) { pct = '25%'; text = 'Weak'; color = 'var(--danger)'; }
      else if (score === 2) { pct = '50%'; text = 'Fair'; color = 'var(--warn)'; }
      else if (score === 3) { pct = '75%'; text = 'Good'; color = 'var(--primary)'; }
      else if (score >= 4)  { pct = '100%'; text = 'Strong'; color = 'var(--success)'; }

      if (fill) { fill.style.width = pct; fill.style.backgroundColor = color; }
      if (label) { label.textContent = text; label.style.color = val.length ? color : 'var(--text-3)'; }
      checkMatch();
    });

    confirmInput?.addEventListener('input', checkMatch);

    function checkMatch() {
      if (confirmInput.value && pwdInput.value !== confirmInput.value) {
        matchError.classList.add('visible');
        confirmInput.classList.add('is-error');
      } else {
        matchError.classList.remove('visible');
        confirmInput.classList.remove('is-error');
      }
    }
  }

  // ── Login Submit ──────────────────────────────────────────────
  if (loginForm) {
    const loginNotice = document.getElementById('login-error');
    const authParams = new URLSearchParams(window.location.search);
    const googleErrors = {
      unavailable: 'Google sign-in is temporarily unavailable. Continue with email.',
      request: 'The Google sign-in request expired. Please try again.',
      invalid: 'Google could not verify that sign-in. Please try again.',
      server: 'Google sign-in could not be completed. Please try again.',
    };
    const googleError = googleErrors[authParams.get('google_error')];
    if (authParams.get('google_link') === '1') {
      loginNotice.textContent = 'This email already has a ReGen account. Log in once with your password to connect Google securely.';
      loginNotice.classList.add('visible', 'notice');
    } else if (googleError) {
      loginNotice.textContent = googleError;
      loginNotice.classList.add('visible');
    } else if (authParams.get('registered') === '1') {
      loginNotice.textContent = 'Account created. Log in to continue.';
      loginNotice.classList.add('visible', 'notice');
    }

    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errBox = document.getElementById('login-error');
      errBox.classList.remove('visible', 'notice');

      const btn = document.getElementById('login-btn');
      btn.disabled = true;
      btn.textContent = 'Logging in...';

      const data = {
        email:    window.ZeekeSafe.cleanText(document.getElementById('email').value),
        password: document.getElementById('password').value,
      };

      try {
        const res = await Api.login(data);
        if (res.success) {
          window.location.href = '/dashboard';
        } else {
          errBox.textContent = res.message || 'Login failed.';
          errBox.classList.add('visible');
          btn.disabled = false;
          btn.textContent = 'Log In';
        }
      } catch (err) {
        errBox.textContent = 'Network error. Please try again.';
        errBox.classList.add('visible');
        btn.disabled = false;
        btn.textContent = 'Log In';
      }
    });
  }

  // ── Register Submit ───────────────────────────────────────────
  if (registerForm) {
    const registerNotice = document.getElementById('register-error');
    const authParams = new URLSearchParams(window.location.search);
    const googleErrors = {
      unavailable: 'Google registration is temporarily unavailable. Continue with email.',
      request: 'The Google registration request expired. Please try again.',
      invalid: 'Google could not verify that account. Please try again.',
      server: 'Google registration could not be completed. Please try again.',
    };
    const googleError = googleErrors[authParams.get('google_error')];
    if (googleError) {
      registerNotice.textContent = googleError;
      registerNotice.classList.add('visible');
    }

    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errBox = document.getElementById('register-error');
      errBox.classList.remove('visible');

      const btn = document.getElementById('register-btn');
      
      const pwd = document.getElementById('password').value;
      const cpwd = document.getElementById('confirmPassword').value;

      if (pwd !== cpwd) {
        errBox.textContent = 'Passwords do not match.';
        errBox.classList.add('visible');
        return;
      }
      if (!validateRegistrationPostcode()) {
        errBox.textContent = 'Check the state and postcode.';
        errBox.classList.add('visible');
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Creating Account...';

      const data = {
        firstName:       window.ZeekeSafe.cleanText(document.getElementById('firstName').value),
        lastName:        window.ZeekeSafe.cleanText(document.getElementById('lastName').value),
        email:           window.ZeekeSafe.cleanText(document.getElementById('email').value),
        phone:           window.ZeekeSafe.cleanText(document.getElementById('phone').value),
        address:         window.ZeekeSafe.cleanText(
          countryInput.value === 'Malaysia'
            ? [postcodeInput.value, stateInput.value, countryInput.value].filter(Boolean).join(', ')
            : countryInput.value
        ),
        password:        pwd,
        confirmPassword: cpwd,
      };

      let navigating = false;
      try {
        const res = await Api.register(data);
        if (res.success) {
          const session = res.authenticated === false ? null : await Api.getMe();
          navigating = true;
          window.location.assign(session?.success ? '/dashboard' : '/login?registered=1');
          return;
        }

        if (res.errors && res.errors.length) {
          errBox.replaceChildren(...res.errors.flatMap((message, index) => {
            const nodes = [];
            if (index > 0) nodes.push(document.createElement('br'));
            nodes.push(document.createTextNode(message));
            return nodes;
          }));
        } else {
          errBox.textContent = res.message || 'Registration failed.';
        }
        errBox.classList.add('visible');
      } catch (err) {
        errBox.textContent = 'Registration could not be completed. Please try again.';
        errBox.classList.add('visible');
      } finally {
        if (!navigating) {
          btn.disabled = false;
          btn.textContent = 'Create Account';
        }
      }
    });
  }
});
