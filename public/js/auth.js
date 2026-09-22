/**
 * auth.js — Handles login and registration forms
 */

document.addEventListener('DOMContentLoaded', () => {
  const loginForm    = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const verificationPage = document.getElementById('email-verification');
  const verificationResendForm = document.getElementById('verification-resend-form');
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

  function recaptchaError(message = 'Security verification is temporarily unavailable.') {
    const error = new Error(message);
    error.code = 'RECAPTCHA_UNAVAILABLE';
    return error;
  }

  function loadRecaptchaLibrary(siteKey) {
    if (window.grecaptcha?.ready) return Promise.resolve();

    return new Promise((resolve, reject) => {
      let script = document.querySelector('script[data-recaptcha-v3]');
      const timeout = window.setTimeout(() => {
        reject(recaptchaError());
      }, 12000);

      const finish = (callback) => {
        window.clearTimeout(timeout);
        callback();
      };
      const onLoad = () => finish(resolve);
      const onError = () => finish(() => reject(recaptchaError()));

      if (!script) {
        script = document.createElement('script');
        script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
        script.async = true;
        script.defer = true;
        script.referrerPolicy = 'strict-origin-when-cross-origin';
        script.dataset.recaptchaV3 = 'true';
      }

      script.addEventListener('load', onLoad, { once: true });
      script.addEventListener('error', onError, { once: true });
      if (!script.isConnected) document.head.appendChild(script);
    });
  }

  function waitForRecaptchaReady() {
    if (!window.grecaptcha?.ready) throw recaptchaError();

    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(recaptchaError()), 12000);
      try {
        window.grecaptcha.ready(() => {
          window.clearTimeout(timeout);
          resolve();
        });
      } catch (error) {
        window.clearTimeout(timeout);
        reject(recaptchaError());
      }
    });
  }

  function currentRecaptchaStatus() {
    return document.getElementById(
      registerForm
        ? 'register-recaptcha-status'
        : (loginForm ? 'login-recaptcha-status' : 'verification-recaptcha-status')
    );
  }

  async function initializeRecaptcha() {
    const status = currentRecaptchaStatus();
    const config = await Api.getRecaptchaConfig();
    if (!config.success) throw recaptchaError();
    if (config.enabled !== true) return { enabled: false, siteKey: '' };

    const siteKey = String(config.siteKey || '').trim();
    if (!/^[A-Za-z0-9_-]{20,200}$/.test(siteKey)) throw recaptchaError();

    if (status) status.hidden = false;
    try {
      await loadRecaptchaLibrary(siteKey);
      await waitForRecaptchaReady();
      return { enabled: true, siteKey };
    } catch (error) {
      if (status) {
        status.hidden = false;
        status.classList.add('is-error');
        const message = status.querySelector('span');
        if (message) message.textContent = 'Security verification could not load. Refresh this page before continuing.';
      }
      throw recaptchaError();
    }
  }

  let recaptchaConfigPromise = null;

  function ensureRecaptchaConfig() {
    if (!recaptchaConfigPromise) {
      recaptchaConfigPromise = initializeRecaptcha();
      recaptchaConfigPromise.catch(() => {});
    }
    return recaptchaConfigPromise;
  }

  // Login and registration always require the check, so prepare it early. The
  // verification page loads it only if the user actually requests a resend.
  if (registerForm || loginForm) ensureRecaptchaConfig();

  async function getRecaptcha(action) {
    if (!['register', 'login', 'resend_verification'].includes(action)) {
      throw recaptchaError();
    }
    let config;
    try {
      config = await ensureRecaptchaConfig();
    } catch (error) {
      throw recaptchaError();
    }
    if (!config.enabled) return {};
    if (!window.grecaptcha?.execute) throw recaptchaError();

    let token = '';
    try {
      token = await Promise.race([
        window.grecaptcha.execute(config.siteKey, { action }),
        new Promise((resolve, reject) => {
          window.setTimeout(() => reject(recaptchaError()), 12000);
        }),
      ]);
    } catch (error) {
      throw recaptchaError();
    }
    token = String(token || '').trim();
    if (!token) throw recaptchaError();

    return { recaptchaToken: token, recaptchaAction: action };
  }

  function rememberVerificationEmail(email) {
    const normalized = String(email || '').trim().toLowerCase();
    if (!normalized) return;
    try {
      window.sessionStorage.setItem('regenVerificationEmail', normalized);
    } catch (error) {
      // The flow still works when private browsing disables session storage.
    }
  }

  function recalledVerificationEmail() {
    try {
      return String(window.sessionStorage.getItem('regenVerificationEmail') || '').trim();
    } catch (error) {
      return '';
    }
  }

  function clearRememberedVerificationEmail() {
    try {
      window.sessionStorage.removeItem('regenVerificationEmail');
    } catch (error) {
      // No cleanup is needed when session storage is unavailable.
    }
  }

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
      if (val.length >= 10) score++;
      if (val.length >= 14) score++;
      if (val.match(/[A-Z]/)) score++;
      if (val.match(/[0-9]/)) score++;
      if (val.match(/[^A-Za-z0-9]/)) score++;

      let color = 'var(--danger)';
      let text = 'Weak';
      let pct = '25%';

      if (val.length === 0) { pct = '0%'; text = 'Use at least 10 characters'; color = 'var(--border)'; }
      else if (val.length < 10) { pct = '18%'; text = 'Too short'; color = 'var(--danger)'; }
      else if (score <= 2) { pct = '45%'; text = 'Fair'; color = 'var(--warn)'; }
      else if (score <= 4) { pct = '75%'; text = 'Good'; color = 'var(--accent)'; }
      else { pct = '100%'; text = 'Strong'; color = 'var(--success)'; }

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
    const loginEmail = document.getElementById('email');
    const authParams = new URLSearchParams(window.location.search);
    const googleErrors = {
      unavailable: 'Google sign-in is temporarily unavailable. Continue with email.',
      request: 'The Google sign-in request expired. Please try again.',
      invalid: 'Google could not verify that sign-in. Please try again.',
      server: 'Google sign-in could not be completed. Please try again.',
    };
    const googleError = googleErrors[authParams.get('google_error')];
    if (authParams.get('email_verified') === '1') {
      loginNotice.textContent = 'Email verified. You can now sign in.';
      loginNotice.classList.add('visible', 'notice');
      const rememberedEmail = recalledVerificationEmail();
      if (rememberedEmail) loginEmail.value = rememberedEmail;
    } else if (authParams.get('verification_error') === 'invalid') {
      loginNotice.replaceChildren(
        document.createTextNode('This verification link is invalid or has expired. '),
        Object.assign(document.createElement('a'), {
          href: '/verify-email?state=invalid',
          textContent: 'Request a new link',
        })
      );
      loginNotice.classList.add('visible');
    } else if (authParams.get('google_link') === '1') {
      loginNotice.textContent = 'This email already has a ReGen account. Log in once with your password to connect Google securely.';
      loginNotice.classList.add('visible', 'notice');
    } else if (authParams.get('expired') === '1') {
      loginNotice.textContent = 'Your secure session expired. Log in again to continue.';
      loginNotice.classList.add('visible', 'notice');
    } else if (googleError) {
      loginNotice.textContent = googleError;
      loginNotice.classList.add('visible');
    } else if (authParams.get('registered') === '1') {
      loginNotice.textContent = 'Account created. Verify your email before signing in.';
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
        email:    window.ZeekeSafe.cleanText(loginEmail.value),
        password: document.getElementById('password').value,
      };

      try {
        Object.assign(data, await getRecaptcha('login'));
        const res = await Api.login(data);
        if (res.success) {
          clearRememberedVerificationEmail();
          window.location.href = '/dashboard';
        } else if (
          ['EMAIL_NOT_VERIFIED', 'EMAIL_VERIFICATION_REQUIRED'].includes(res.code)
          || res.verificationRequired === true
        ) {
          rememberVerificationEmail(res.email || data.email);
          window.location.assign('/verify-email?state=pending');
        } else {
          errBox.textContent = res.message || 'Login failed.';
          errBox.classList.add('visible');
          btn.disabled = false;
          btn.textContent = 'Sign in';
        }
      } catch (err) {
        errBox.textContent = err?.code === 'RECAPTCHA_UNAVAILABLE'
          ? 'Security verification could not be completed. Refresh the page and try again.'
          : 'Network error. Please try again.';
        errBox.classList.add('visible');
        btn.disabled = false;
        btn.textContent = 'Sign in';
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

      if (pwd.length < 10 || pwd.length > 128) {
        errBox.textContent = 'Use a password between 10 and 128 characters.';
        errBox.classList.add('visible');
        return;
      }
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
        Object.assign(data, await getRecaptcha('register'));
        const res = await Api.register(data);
        if (res.success) {
          if (res.verificationRequired === true || res.authenticated === false) {
            rememberVerificationEmail(res.email || data.email);
            navigating = true;
            window.location.assign('/verify-email?state=pending');
            return;
          }
          const session = await Api.getMe();
          navigating = true;
          window.location.assign(session?.success ? '/dashboard' : '/login');
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
        errBox.textContent = err?.code === 'RECAPTCHA_UNAVAILABLE'
          ? 'Security verification could not be completed. Refresh the page and try again.'
          : 'Registration could not be completed. Please try again.';
        errBox.classList.add('visible');
      } finally {
        if (!navigating) {
          btn.disabled = false;
          btn.textContent = 'Create account';
        }
      }
    });
  }

  // Email verification is deliberately user-confirmed. Link scanners can open
  // the page safely, but the one-time token is only submitted after a click.
  if (verificationPage) {
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    let verificationToken = String(hashParams.get('token') || params.get('token') || '').trim();
    const requestedState = String(params.get('state') || '').trim();

    if (verificationToken) {
      window.history.replaceState(null, document.title, window.location.pathname);
    }

    const eyebrow = document.getElementById('verification-eyebrow');
    const title = document.getElementById('verification-title');
    const description = document.getElementById('verification-description');
    const emailHint = document.getElementById('verification-email');
    const mark = document.getElementById('verification-mark');
    const confirmPanel = document.getElementById('verification-confirm');
    const verifyButton = document.getElementById('verify-email-btn');
    const resendForm = document.getElementById('verification-resend-form');
    const emailInput = document.getElementById('verification-email-input');
    const resendButton = document.getElementById('resend-verification-btn');
    const status = document.getElementById('verification-status');
    const loginLink = document.getElementById('verification-login-link');
    const recalledEmail = recalledVerificationEmail();

    if (recalledEmail) emailInput.value = recalledEmail;

    function showStatus(message, kind = '') {
      status.textContent = message;
      status.className = `auth-inline-status${kind ? ` is-${kind}` : ''}`;
      status.hidden = !message;
    }

    function focusTitle() {
      window.requestAnimationFrame(() => title.focus({ preventScroll: true }));
    }

    function showEmailHint(email) {
      if (!email) {
        emailHint.hidden = true;
        emailHint.textContent = '';
        return;
      }
      emailHint.textContent = email;
      emailHint.hidden = false;
    }

    function showPending() {
      eyebrow.textContent = 'Verification email sent';
      title.textContent = 'Check your email';
      description.textContent = 'Open the verification link in your inbox to finish creating your account.';
      mark.textContent = '@';
      mark.className = 'auth-status-mark';
      confirmPanel.hidden = true;
      resendForm.hidden = false;
      loginLink.textContent = 'Back to sign in';
      loginLink.href = '/login';
      showEmailHint(recalledEmail);
      focusTitle();
    }

    function showConfirmation() {
      eyebrow.textContent = 'Confirm verification';
      title.textContent = 'Verify your email';
      description.textContent = 'Confirm this request to activate your ReGen account.';
      mark.textContent = '@';
      mark.className = 'auth-status-mark';
      confirmPanel.hidden = false;
      resendForm.hidden = true;
      showEmailHint('');
      focusTitle();
    }

    function showVerified() {
      eyebrow.textContent = 'Verification complete';
      title.textContent = 'Email verified';
      description.textContent = 'Your account is ready. You can now sign in.';
      mark.textContent = '\u2713';
      mark.className = 'auth-status-mark is-success';
      confirmPanel.hidden = true;
      resendForm.hidden = true;
      loginLink.textContent = 'Continue to sign in';
      loginLink.href = '/login?email_verified=1';
      showEmailHint('');
      showStatus('Your email address has been verified.', 'success');
      focusTitle();
    }

    function showInvalid() {
      eyebrow.textContent = 'Verification unavailable';
      title.textContent = 'Request a new link';
      description.textContent = 'This verification link is invalid, expired, or has already been used.';
      mark.textContent = '!';
      mark.className = 'auth-status-mark is-error';
      confirmPanel.hidden = true;
      resendForm.hidden = false;
      loginLink.textContent = 'Back to sign in';
      loginLink.href = '/login';
      showEmailHint('');
      focusTitle();
    }

    if (verificationToken) showConfirmation();
    else if (requestedState === 'invalid') showInvalid();
    else showPending();

    verifyButton?.addEventListener('click', async () => {
      if (!/^[A-Za-z0-9_-]{32,1024}$/.test(verificationToken)) {
        verificationToken = '';
        showInvalid();
        return;
      }

      verifyButton.disabled = true;
      verifyButton.textContent = 'Verifying...';
      showStatus('Verifying your email...', 'loading');

      const result = await Api.verifyEmail(verificationToken);
      if (result.success) {
        verificationToken = '';
        showVerified();
        return;
      }

      if (result.status === 429) {
        showStatus('Please wait before trying this verification link again.', 'error');
        verifyButton.disabled = false;
        verifyButton.textContent = 'Verify email';
        return;
      }

      if ([400, 403, 404, 409, 410, 422].includes(result.status)) {
        verificationToken = '';
        showStatus('');
        showInvalid();
        return;
      }

      showStatus(result.message || 'Verification could not be completed. Please try again.', 'error');
      verifyButton.disabled = false;
      verifyButton.textContent = 'Verify email';
    });

    resendForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      showStatus('');
      const email = String(emailInput.value || '').trim().toLowerCase();
      emailInput.value = email;
      if (!emailInput.checkValidity()) {
        emailInput.reportValidity();
        return;
      }

      resendButton.disabled = true;
      resendButton.textContent = 'Sending...';
      try {
        const payload = { email, ...await getRecaptcha('resend_verification') };
        const result = await Api.resendEmailVerification(payload);
        if (!result.success) {
          if (result.status === 429) {
            showStatus('Please wait before requesting another verification email.', 'error');
          } else {
            showStatus(result.message || 'A new link could not be sent. Please try again.', 'error');
          }
          resendButton.disabled = false;
          resendButton.textContent = 'Resend verification email';
          return;
        }

        rememberVerificationEmail(email);
        showStatus('If this account needs verification, a new link is on its way. Check your inbox.', 'success');
        resendButton.textContent = 'Verification email sent';
        window.setTimeout(() => {
          resendButton.disabled = false;
          resendButton.textContent = 'Resend verification email';
        }, 30000);
      } catch (error) {
        showStatus(error?.code === 'RECAPTCHA_UNAVAILABLE'
          ? 'Security verification could not be completed. Refresh the page and try again.'
          : 'A new link could not be sent. Please try again.', 'error');
        resendButton.disabled = false;
        resendButton.textContent = 'Resend verification email';
      }
    });
  }
});
