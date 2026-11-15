document.addEventListener('DOMContentLoaded', async () => {
  const root = document.getElementById('settings-content');
  const toastRegion = document.getElementById('account-toast-region');
  const confirmDialog = document.getElementById('account-confirm');
  const confirmForm = document.getElementById('account-confirm-form');
  let pendingConfirmation = null;
  let sessionData = null;
  let sessionRevision = 0;
  let profileDirty=false;

  const safe = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character]));
  const format = value => {
    const date = Api.parseDate(value);
    return date ? new Intl.DateTimeFormat('en-MY', {dateStyle:'medium',timeStyle:'short'}).format(date) : 'Not recorded';
  };
  const formatDate = value => {
    const date = Api.parseDate(value);
    return date ? new Intl.DateTimeFormat('en-MY', {dateStyle:'medium'}).format(date) : 'Not recorded';
  };

  function toast(title, message = '', type = 'success') {
    const element = document.createElement('article');
    element.className = `account-toast is-${type}`;
    element.innerHTML = `<span>${type === 'success' ? '✓' : '!'}</span><div><strong>${safe(title)}</strong>${message ? `<p>${safe(message)}</p>` : ''}</div><button type="button" aria-label="Dismiss">×</button>`;
    const remove = () => element.remove();
    element.querySelector('button').addEventListener('click', remove);
    toastRegion.appendChild(element);
    window.setTimeout(remove, 5000);
  }

  function setBusy(button, busy, label = 'Saving') {
    if (!button) return;
    if (busy) {
      button.dataset.label = button.textContent;
      button.textContent = label;
      button.disabled = true;
    } else {
      button.textContent = button.dataset.label || button.textContent;
      button.disabled = false;
    }
  }

  function openConfirmation({ title, message, submitLabel, onConfirm }) {
    pendingConfirmation = onConfirm;
    document.getElementById('account-confirm-title').textContent = title;
    document.getElementById('account-confirm-message').textContent = message;
    document.getElementById('account-confirm-submit').textContent = submitLabel;
    document.getElementById('account-confirm-submit').disabled = false;
    confirmDialog.showModal();
  }
  function closeConfirmation() {
    if (confirmDialog.open) confirmDialog.close();
    pendingConfirmation = null;
  }

  function feedback(id, message, error = false) {
    const element = document.getElementById(id);
    if (!element) return;
    element.textContent = message;
    element.classList.toggle('is-error', error);
  }

  const notificationSettings = document.createElement('section');
  notificationSettings.className = 'settings-card';
  notificationSettings.id = 'notification-settings';
  notificationSettings.innerHTML = '<div class="settings-card-head"><div><h2>Notifications</h2><p>Choose how ReGen sends account and support updates.</p></div></div><div data-preferences-content></div>';
  const notificationOptions = {
    in_app_enabled:'On-screen alerts', browser_enabled:'Browser alerts',
    account_email:'Account emails', support_email:'Support emails',
    announcement_email:'Offer and announcement emails', security_email:'Security emails'
  };
  async function loadNotificationSettings() {
    const host = notificationSettings.querySelector('[data-preferences-content]');
    const result = await Api.getNotificationPreferences();
    if (!result.success) {
      host.innerHTML = '<p role="status">Could not load preferences.</p><button type="button" class="btn btn-secondary">Try again</button>';
      host.querySelector('button').onclick = loadNotificationSettings;
      return;
    }
    host.innerHTML = `<form class="profile-notification-form"><div class="settings-grid">${Object.entries(notificationOptions).map(([key,label])=>`<label><input type="checkbox" name="${key}"${result.preferences[key]?' checked':''}> ${label}</label>`).join('')}</div><div class="settings-actions"><span class="settings-feedback" role="status"></span><button type="submit" class="btn btn-primary">Save preferences</button></div></form>`;
    const form = host.querySelector('form');
    const browser = form.elements.browser_enabled;
    const status = form.querySelector('[role=status]');
    browser.onchange = async () => {
      if (!browser.checked) return;
      if (!('Notification' in window)) {
        browser.checked = false;
        status.textContent = 'Browser alerts are unavailable on this device.';
        return;
      }
      browser.disabled = true;
      try { browser.checked = (await Notification.requestPermission()) === 'granted'; }
      catch { browser.checked = false; }
      finally { browser.disabled = false; }
      if (!browser.checked) status.textContent = 'Browser alerts were left off.';
    };
    form.onsubmit = async event => {
      event.preventDefault();
      if (browser.disabled) return;
      const save = form.querySelector('[type=submit]');
      setBusy(save,true);
      const values = Object.fromEntries(Object.keys(notificationOptions).map(key=>[key,form.elements[key].checked]));
      const updated = await Api.saveNotificationPreferences(values);
      setBusy(save,false);
      status.textContent = updated.success ? 'Preferences saved.' : updated.message;
      if (updated.success) window.dispatchEvent(new CustomEvent('regen:live-change',{detail:{topic:'notifications'}}));
    };
  }

  function render(data) {
    profileDirty=false;
    const profile = data.profile || {};
    const initials = `${String(profile.first_name || '').charAt(0)}${String(profile.last_name || '').charAt(0)}`.toUpperCase() || 'U';
    root.innerHTML = `
      <section class="account-summary-card">
        <span class="account-summary-avatar" data-account-avatar>${safe(initials)}</span>
        <div class="account-summary-copy"><p>Signed-in account</p><h2>${safe(profile.first_name)} ${safe(profile.last_name)}</h2><span>${safe(profile.email)}</span></div>
        <div class="account-summary-meta"><span class="settings-badge ${profile.email_verified_at ? '' : 'is-warning'}">${profile.email_verified_at ? 'Email verified' : 'Email not verified'}</span><small>Member since ${safe(formatDate(profile.created_at))}</small></div>
      </section>

      <section class="settings-card" id="details">
        <div class="settings-card-head"><div><p class="settings-card-index">01 · Profile</p><h2>Personal details</h2><p>Used for your account and resume defaults.</p></div></div>
        <form id="profile-form">
          <div class="settings-grid">
            <div class="settings-field"><label for="first-name">First name</label><input id="first-name" autocomplete="given-name" maxlength="100" value="${safe(profile.first_name)}" required></div>
            <div class="settings-field"><label for="last-name">Last name</label><input id="last-name" autocomplete="family-name" maxlength="100" value="${safe(profile.last_name)}" required></div>
            <div class="settings-field"><label for="email">Account email</label><input id="email" value="${safe(profile.email)}" disabled><small>Sign-in and verification messages use this address.</small></div>
            <div class="settings-field"><label for="phone">Phone</label><input id="phone" type="tel" inputmode="tel" maxlength="30" value="${safe(profile.phone)}" autocomplete="tel"></div>
            <div class="settings-field is-wide"><label for="address">Address</label><textarea id="address" autocomplete="street-address" maxlength="500">${safe(profile.address)}</textarea></div>
          </div>
          <div class="settings-actions"><span class="settings-feedback" id="profile-feedback"></span><button class="btn btn-primary" id="profile-save" type="submit">Save details</button></div>
        </form>
        ${data.features?.emailChange && profile.has_password && !profile.google_linked ? `<details class="email-change"><summary>Change account email</summary><p>Changing the email signs you out. The new address must be verified before the next sign-in.</p><form id="email-form"><div class="settings-grid"><div class="settings-field"><label for="new-email">New email</label><input id="new-email" type="email" maxlength="200" autocomplete="email" required></div><div class="settings-field"><label for="email-password">Current password</label><input id="email-password" type="password" maxlength="128" autocomplete="current-password" required></div></div><div class="settings-actions"><span class="settings-feedback" id="email-feedback"></span><button class="btn btn-secondary" id="email-save" type="submit">Change email</button></div></form></details>` : ''}
      </section>

      <section class="settings-card" id="sign-in">
        <div class="settings-card-head"><div><p class="settings-card-index">02 · Access</p><h2>Sign-in methods</h2><p>Secure, simple ways to sign in.</p></div></div>
        <div class="identity-list">
          <div class="identity-row"><span class="identity-mark" aria-hidden="true">G</span><div class="identity-copy"><strong>Google</strong><span>${profile.google_linked ? 'Connected to your account' : 'Connect your Google account'}</span></div>${profile.google_linked ? '<span class="settings-badge">Linked</span>' : `<div id="google-link-slot" class="identity-action"><span class="settings-muted">${data.google?.enabled ? 'Loading secure sign-in…' : 'Google sign-in is unavailable.'}</span></div>`}</div>
          <div class="identity-row"><span class="identity-mark">••</span><div class="identity-copy"><strong>Password</strong><span>${profile.has_password ? 'Ready when you need it' : 'Add another way to sign in'}</span></div><span class="settings-badge ${profile.has_password ? '' : 'is-warning'}">${profile.has_password ? 'Enabled' : 'Not set'}</span></div>
        </div>
        <details class="password-details"><summary>${profile.has_password ? 'Change password' : 'Add a password'}<span aria-hidden="true">+</span></summary><form id="password-form" class="password-settings-form">
          <p class="settings-card-index">${profile.has_password ? 'Change password' : 'Add password'}</p>
          <div class="settings-grid">
            ${profile.has_password ? '<div class="settings-field is-wide"><label for="current-password">Current password</label><input id="current-password" type="password" maxlength="128" autocomplete="current-password" required></div>' : ''}
            <div class="settings-field"><label for="new-password">New password</label><input id="new-password" type="password" minlength="10" maxlength="128" autocomplete="new-password" required><small>Use at least 10 characters.</small></div>
            <div class="settings-field"><label for="confirm-password">Confirm new password</label><input id="confirm-password" type="password" minlength="10" maxlength="128" autocomplete="new-password" required></div>
          </div>
          <div class="settings-actions"><span class="settings-feedback" id="password-feedback"></span><button class="btn btn-secondary" id="password-save" type="submit">${profile.has_password ? 'Update password' : 'Add password'}</button></div>
        </form>
      </section>

      <section class="settings-card" id="devices" aria-labelledby="device-history-title">
        <div class="settings-card-head"><div><h2 id="device-history-title" tabindex="-1">Signed-in devices</h2><p>Manage access. Keep familiar devices close.</p></div><span class="settings-badge" id="active-session-count"></span></div>
        <div id="session-records"></div>
        <div class="session-tools"><button type="button" class="session-clear" id="clear-session-history">Clear history</button><nav class="session-pagination" id="session-pagination" aria-label="Device history pages"></nav></div>
        <p class="session-feedback" id="session-feedback" role="status" aria-live="polite"></p>
      </section>
      <section class="settings-card install-settings" id="app"><img src="/img/app-icon-192.png" width="52" height="52" alt=""><div><h2>ReGen, within reach.</h2><p>Add your workspace to your home screen.</p><small>Editing and downloads need a connection.</small></div><button class="btn btn-secondary" type="button" data-install>Install ReGen</button></section>

      ${data.features?.selfDelete ? `<section class="settings-card danger-card" id="danger"><div class="settings-card-head"><div><p class="settings-card-index">04 · Permanent action</p><h2>Delete account</h2><p>Deletes the account and its stored data.</p></div></div><div class="danger-warning"><strong>Data removed</strong><span>Profile details, resume content, uploaded photo, linked identity, AI usage records and device sessions.</span></div><form id="delete-form"><div class="settings-grid"><div class="settings-field"><label for="delete-confirm">Type DELETE</label><input id="delete-confirm" autocomplete="off" required></div>${profile.has_password ? '<div class="settings-field"><label for="delete-password">Current password</label><input id="delete-password" type="password" autocomplete="current-password" required></div>' : ''}</div><div class="settings-actions"><span class="settings-feedback" id="delete-feedback"></span><button class="btn btn-danger" type="submit">Delete account</button></div></form></section>` : ''}`;
    root.querySelector("#app").before(notificationSettings);
    renderSessions(data);
    const install = root.querySelector('[data-install]');
    if (install && (matchMedia('(display-mode: standalone)').matches || navigator.standalone === true)) {
      install.textContent = 'Installed on this device';install.disabled = true;
    }
    bind(data);
  }

  function bind(data) {
    document.getElementById('profile-form')?.addEventListener('submit', async event => {
      event.preventDefault();
      const button = document.getElementById('profile-save');
      setBusy(button, true);
      const result = await Api.updateProfile({ firstName: document.getElementById('first-name').value, lastName: document.getElementById('last-name').value, phone: document.getElementById('phone').value, address: document.getElementById('address').value });
      setBusy(button, false);
      feedback('profile-feedback', result.success ? 'Saved' : result.message || 'Could not save.', !result.success);
      if (result.success) toast('Profile updated', 'Your account details were saved.');
    });

    document.getElementById('email-form')?.addEventListener('submit', async event => {
      event.preventDefault();
      const button = document.getElementById('email-save');
      setBusy(button, true, 'Sending');
      const result = await Api.changeEmail({ email: document.getElementById('new-email').value, password: document.getElementById('email-password').value });
      setBusy(button, false);
      feedback('email-feedback', result.message || (result.success ? 'Verification sent.' : 'Could not change email.'), !result.success);
      if (result.signedOut) window.location.replace('/verify-email?email_changed=1');
    });

    document.getElementById('password-form')?.addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const button = document.getElementById('password-save');
      setBusy(button, true, 'Updating');
      const result = await Api.changePassword({ currentPassword: document.getElementById('current-password')?.value || '', newPassword: document.getElementById('new-password').value, confirmPassword: document.getElementById('confirm-password').value });
      setBusy(button, false);
      feedback('password-feedback', result.success ? 'Updated' : result.message || 'Could not update.', !result.success);
      if (result.success) {
        form.reset();
        toast('Password updated', 'Use the new password at your next sign-in.');
      }
    });

    document.getElementById('devices').addEventListener('click', event => {
      const pager = event.target.closest('[data-session-page]');
      if (pager && !pager.disabled) { loadSessions(Number(pager.dataset.sessionPage)); return; }
      const button = event.target.closest('.session-revoke');
      if (!button) return;
      const current = button.dataset.current === '1';
      openConfirmation({
        title: current ? 'Sign out this device?' : 'Sign out this session?',
        message: current ? 'You will return to the sign-in page.' : 'This device will need to sign in again.',
        submitLabel: 'Sign out',
        onConfirm: async () => {
          const result = await Api.revokeSession(button.dataset.id);
          if (!result.success) throw new Error(result.message || 'Could not sign out this session.');
          if (result.signedOut) return window.location.replace('/login');
          await loadSessions(sessionData.pagination.page);
          toast('Session signed out');
        },
      });
    });
    document.getElementById('clear-session-history').addEventListener('click', () => openConfirmation({
      title: 'Clear device history?',
      message: 'Removes signed-out and expired entries from this list. Active devices stay signed in.',
      submitLabel: 'Clear history',
      onConfirm: async () => {
        const result = await Api.clearSessionHistory();
        if (!result.success) throw new Error(result.message || 'Could not clear history.');
        renderSessions(result);
        toast('History cleared');
      },
    }));

    document.getElementById('delete-form')?.addEventListener('submit', event => {
      event.preventDefault();
      if (document.getElementById('delete-confirm').value !== 'DELETE') {
        return feedback('delete-feedback', 'Type DELETE exactly to continue.', true);
      }
      openConfirmation({
        title: 'Delete this account?',
        message: 'This permanently removes the account and its associated data. This action cannot be reversed.',
        submitLabel: 'Delete account',
        onConfirm: async () => {
          const result = await Api.deleteAccount({ confirmation: document.getElementById('delete-confirm').value, password: document.getElementById('delete-password')?.value || '' });
          if (!result.success) throw new Error(result.message || 'The account could not be deleted.');
          window.location.replace('/login?deleted=1');
        },
      });
    });

    if (!data.profile.google_linked && data.google?.enabled) loadGoogle(data.google);
  }

  let googleResize = null;
  let googleAppearance = null;
  function loadGoogle(config) {
    const slot = document.getElementById('google-link-slot');
    if (!slot) return;
    const render = () => {
      if (!window.google?.accounts?.id || !slot.isConnected) return;
      const width = Math.max(200, Math.min(400, Math.floor(slot.getBoundingClientRect().width)));
      const theme = document.documentElement.dataset.theme === 'dark' ? 'outline_dark' : 'outline';
      const stamp = width + ':' + theme;
      if (slot.dataset.rendered === stamp) return;
      slot.dataset.rendered = stamp;
      slot.replaceChildren();
      google.accounts.id.renderButton(slot, {type:'standard',theme,size:'large',shape:'pill',text:'continue_with',width});
    };
    const initialize = () => {
      if (!window.google?.accounts?.id) { slot.textContent = 'Google sign-in is unavailable. Try reloading.'; return; }
      google.accounts.id.initialize({client_id:config.clientId,login_uri:config.loginUri,ux_mode:'redirect',auto_select:false});
      googleResize?.disconnect();
      if (googleAppearance) window.removeEventListener('regen:appearance',googleAppearance);
      render();
      googleResize = new ResizeObserver(render);googleResize.observe(slot);
      googleAppearance = render;window.addEventListener('regen:appearance',render);
    };
    if (window.google?.accounts?.id) { initialize(); return; }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';script.async = true;
    script.onload = initialize;
    script.onerror = () => { slot.textContent = 'Google sign-in is unavailable. Try reloading.'; };
    document.head.appendChild(script);
  }

  function renderSessions(data) {
    sessionData = data;
    const sessions = data.sessions || [];
    const pagination = data.pagination || {page:1,pages:1,total:sessions.length};
    document.getElementById('active-session-count').textContent = (data.activeSessionCount || 0) + ' active';
    document.getElementById('session-records').innerHTML = sessions.length ? '<div class="device-list">' + sessions.map(session => {
      const active = session.state === 'active';
      const state = session.current ? 'This device' : active ? 'Signed in' : session.state === 'expired' ? 'Expired' : 'Signed out';
      return '<article class="device-row"><span class="device-mark" aria-hidden="true">' + ReGenIcons.icon(/mobile|Android/.test(session.device_label) ? 'personal' : 'template') + '</span><div class="device-copy"><strong>' + safe(session.device_label) + '</strong><span>' + safe(session.browser_label) + '</span><time>' + safe(format(session.last_seen_at)) + '</time><span class="device-state' + (active ? ' is-active' : '') + '">' + state + '</span></div>' + (active ? '<button type="button" class="btn btn-secondary btn-small session-revoke" data-id="' + Number(session.id) + '" data-current="' + (session.current ? '1' : '0') + '">Sign out</button>' : '') + '</article>';
    }).join('') + '</div>' : '<p class="settings-muted">No device history.</p>';
    document.getElementById('clear-session-history').disabled = !data.historyCount;
    document.getElementById('session-pagination').innerHTML = '<button type="button" data-session-page="' + (pagination.page - 1) + '" aria-label="Previous device page" ' + (pagination.page <= 1 ? 'disabled' : '') + '>‹</button><span>Page ' + pagination.page + ' of ' + pagination.pages + '</span><button type="button" data-session-page="' + (pagination.page + 1) + '" aria-label="Next device page" ' + (pagination.page >= pagination.pages ? 'disabled' : '') + '>›</button>';
    document.getElementById('session-feedback').textContent = pagination.total + ' recorded ' + (pagination.total === 1 ? 'session' : 'sessions');
  }
  async function loadSessions(page) {
    const revision = ++sessionRevision;
    const records = document.getElementById('session-records');
    records.setAttribute('aria-busy','true');
    document.querySelectorAll('[data-session-page]').forEach(button => { button.disabled = true; });
    const result = await Api.getSessions(page);
    if (revision !== sessionRevision) return;
    records.setAttribute('aria-busy','false');
    if (!result.success) {
      renderSessions(sessionData);
      document.getElementById('session-feedback').textContent = result.message || 'Could not load device history. Try again.';
      return;
    }
    renderSessions(result);
  }

  confirmForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (typeof pendingConfirmation !== 'function') return closeConfirmation();
    const action = pendingConfirmation;
    const button = document.getElementById('account-confirm-submit');
    setBusy(button, true, 'Working');
    try {
      await action();
      closeConfirmation();
    } catch (error) {
      toast('Action not completed', error.message || 'Try again.', 'error');
    } finally {
      setBusy(button, false);
    }
  });
  document.getElementById('account-confirm-close').addEventListener('click', closeConfirmation);
  document.getElementById('account-confirm-cancel').addEventListener('click', closeConfirmation);
  confirmDialog.addEventListener('cancel', event => { event.preventDefault(); closeConfirmation(); });
  confirmDialog.addEventListener('click', event => { if (event.target === confirmDialog) closeConfirmation(); });

  const result = await Api.getProfile();
  if (!result.success) {
    root.innerHTML = `<section class="settings-card"><h2>Account unavailable</h2><p class="settings-muted">${safe(result.message || 'Try signing in again.')}</p></section>`;
    return;
  }
  render(result);
  loadNotificationSettings();
  if(location.hash==="#notification-settings")notificationSettings.scrollIntoView({block:"start"});
  ZeekeAccountMenu.setPhoto(result.avatarUrl || '');
  root.addEventListener('input',()=>{profileDirty=true;});root.addEventListener('change',()=>{profileDirty=true;});
  let profileRefresh;
  const liveProfile=event=>{if(event.detail?.topic&&!['profile'].includes(event.detail.topic))return;clearTimeout(profileRefresh);profileRefresh=setTimeout(async()=>{if(profileDirty||confirmDialog.open)return;const data=await Api.getProfile();if(data.success)render(data);},180);};
  window.addEventListener('regen:live-change',liveProfile);window.addEventListener('regen:reconcile',liveProfile);window.addEventListener('pagehide',()=>clearTimeout(profileRefresh));

});
