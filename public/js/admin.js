document.addEventListener('DOMContentLoaded', async () => {
  let csrf = '';
  try { csrf = sessionStorage.getItem('regen_admin_csrf') || ''; } catch {}
  let currentAdmin = null;
  let users = [];
  let activeView = 'overview';
  let pendingInitialView = null;
  let userPage = 1;
  let userSearch = '';
  let confirmAction = null;
  let allowedModules = [];
  let capabilities = [];
  let latestAlertId = null;
  let viewGeneration = 0;
  const pendingReads = new Map();

  const root = document.getElementById('admin-view');
  const drawer = document.getElementById('admin-drawer');
  const drawerForm = document.getElementById('admin-drawer-form');
  const confirmDialog = document.getElementById('admin-confirm');
  const confirmForm = document.getElementById('admin-confirm-form');
  const toastRegion = document.getElementById('admin-toast-region');
  const sidebar = document.getElementById('admin-sidebar');
  const mobileScrim = document.getElementById('admin-mobile-scrim');

  const safe = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character]));
  const formatDate = value => value
    ? new Intl.DateTimeFormat('en-MY', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(/^\d{4}-\d{2}-\d{2} /.test(value) ? value.replace(' ', 'T') + 'Z' : value))
    : 'Not recorded';
  const iconPaths = {
    pricing:'<path d="m20 13-7 7L3 10V3h7l10 10Z"/><circle cx="7.5" cy="7.5" r="1"/>',
    store:'<circle cx="12" cy="12" r="9"/><path d="M9 17V7h5a3 3 0 0 1 0 6H9m4 0 4 4"/>',
    feedback:'<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z"/>',
    profile:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
    templates:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    campaigns:'<path d="M3 10v4h4l12 5V5L7 10ZM7 14l2 7h4l-3-6M22 9v6"/>',
    overview: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    ai: '<path d="M12 3l1.2 3.3 3.3 1.2-3.3 1.2L12 12l-1.2-3.3-3.3-1.2 3.3-1.2z"/><path d="M18.5 13l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/><path d="M6 13l1.1 2.9L10 17l-2.9 1.1L6 21l-1.1-2.9L2 17l2.9-1.1z"/>',
    system: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.1A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.1A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.14.37.36.7.65.96.29.26.66.4 1.05.4h.1v4h-.1a1.7 1.7 0 0 0-1.7.64z"/>',
    email: '<path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="m22 6-10 7L2 6"/>',
    admins: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>',
    operations: '<path d="M4 4v6h6"/><path d="M20 20v-6h-6"/><path d="M20 9a8 8 0 0 0-14.9-3M4 15a8 8 0 0 0 14.9 3"/>',
    audit: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8M8 9h2"/>',
    analytics: '<path d="M3 3v18h18M7 16v-4M12 16V8M17 16V5"/>',
    support: '<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z"/>',
    features: '<path d="M4 7h16M4 17h16"/><circle cx="8" cy="7" r="3"/><circle cx="16" cy="17" r="3"/>',
    notifications: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2m3 0-1 15H6L5 6m5 5v5m4-5v5"/>',
    security: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM12 8v5M12 16h.01"/>',
    health: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
    recovery: '<path d="M3 4v6h6M3 10a9 9 0 1 1 1 8M12 7v5l3 2"/>',
    logout: '<path d="M10 17l5-5-5-5M15 12H3M21 3v18"/>',
  };
  const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${iconPaths[name] || iconPaths.system}</svg>`;

  document.querySelectorAll('[data-icon]').forEach(element => { element.innerHTML = icon(element.dataset.icon); });

  function api(url, options = {}) {
    const method=String(options.method || 'GET').toUpperCase();
    if(method!=='GET'||options.headers||options.body){pendingReads.clear();return request(url,options);}
    const key=viewGeneration+':'+url;
    if(pendingReads.has(key))return pendingReads.get(key);
    const promise=request(url,options).finally(()=>{if(pendingReads.get(key)===promise)pendingReads.delete(key);});
    pendingReads.set(key,promise);return promise;
  }

  async function request(url, options = {}) {
    const requestGeneration = viewGeneration;
    const method = String(options.method || 'GET').toUpperCase();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    const connection = document.getElementById('admin-connection');
    try {
      const response = await fetch(url, {
        ...options,
        credentials: 'same-origin',
        signal: controller.signal,
        headers: {
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
          ...(!['GET', 'HEAD'].includes(method) ? { 'X-CSRF-Token': csrf } : {}),
          ...(options.headers || {}),
        },
      });
      if (connection) connection.textContent = response.ok ? 'Connected' : 'Needs attention';
      let data = {};
      try { data = await response.json(); } catch { data = {}; }
      if (data.csrfToken) {
        csrf = data.csrfToken;
        try { sessionStorage.setItem('regen_admin_csrf', csrf); } catch {}
      }
      if (response.status === 401) {
        window.location.replace('/admin/login');
        return { success: false, message: 'Your session has ended.' };
      }
      return { ...data, viewGeneration: requestGeneration, httpStatus: response.status };
    } catch {
      if (connection) connection.textContent = 'Disconnected';
      return { success: false, message: 'The server could not be reached. Check your connection and try again.' };
    } finally {
      clearTimeout(timer);
    }
  }

  function toast(title, message = '', type = 'success', duration = 5000) {
    const element = document.createElement('article');
    element.className = `admin-toast is-${type}`;
    element.innerHTML = `<span class="toast-mark">${type === 'success' ? '✓' : type === 'error' ? '!' : 'i'}</span><div class="toast-copy"><strong>${safe(title)}</strong>${message ? `<p>${safe(message)}</p>` : ''}</div><button type="button" class="toast-close" aria-label="Dismiss">×</button>`;
    const remove = () => element.remove();
    element.querySelector('.toast-close').addEventListener('click', remove);
    toastRegion.appendChild(element);
    if (duration > 0) window.setTimeout(remove, duration);
  }

  function setBusy(button, busy, label = 'Working') {
    if (!button) return;
    if (busy) {
      button.dataset.originalText = button.textContent;
      button.textContent = label;
      button.disabled = true;
    } else {
      button.textContent = button.dataset.originalText || button.textContent;
      button.disabled = false;
    }
  }

  const headings = {
    pricing:['Pricing','Packages & promotions','Manage packages, individual prices and store presentation.'],
    store:['Pricing','Packages & promotions','Manage packages, individual prices and store presentation.'],
    uploads:['Support attachments','System settings','Set private attachment limits for support requests and replies.'],
    maintenance:['Maintenance','Application access','Schedule downtime and keep users informed.'],
    campaigns:['Campaigns', 'Communication & rewards', 'Create announcements and manage optional token rewards.'],
    profile:['My profile','Your administrator account','Manage your identity, password and notification preferences.'],
    templates: ['Resume templates', 'Collection management', 'Curate visibility, recommendations and the designs your users use.'],
    reports: ['Reports', 'Service quality', 'Understand user satisfaction, support performance and product trends.'],
    feedback: ['User Feedback', 'User experience', 'Listen to real experiences and keep improvement work visible.'],
    alerts: ['Notifications', 'Your inbox', 'Review updates for your responsibilities and choose your notification channels.'],
    analytics: ['Traffic analytics', 'Audience and acquisition', 'Measure landing-page traffic and account growth.'],
    features: ['Feature availability', 'Product operations', 'Control visibility, access and scheduled downtime for each feature.'],
    notifications: ['Broadcast', 'User communication', 'Manage email rules, delivery queues and audience broadcasts.'],
    support: ['Support', 'User care', 'Resolve requests with clear ownership and a complete conversation history.'],
    security: ['Security monitor', 'Application protection', 'Review detected activity and apply temporary network restrictions.'],
    health: ['Server status', 'Service health', 'Inspect live database, storage and application measurements.'],
    recovery: ['Data recovery', 'Document history', 'Create recovery points and restore saved documents.'],
    password: ['My password', 'Personal security', 'Keep your administrator account secure.'],
    overview: ['Overview', 'Current system totals', 'Account, session and AI usage information.'],
    users: ['User accounts', 'Account administration', 'Search accounts, review access state and apply user-specific controls.'],
    ai: ['AI usage', 'Usage policy', 'Set system availability, token allowance and renewal frequency.'],
    system: ['System settings', 'Application policy', 'Manage public access, account features and session limits.'],
    mochi: ['Mochi', 'Companion controls', 'Manage how Mochi plays, coaches and appears across ReGen.'],
    email: ['Test Email', 'Delivery configuration', 'Review SMTP readiness and recent delivery results.'],
    admins: ['Administrators', 'Privileged access', 'Create administrators, review roles and disable access.'],
    operations: ['Session controls', 'Security operations', 'Revoke active user sessions using audited operations.'],
    audit: ['Activity log', 'Security records', 'Review recorded administrator and user operations.'],
  };
  function setHeading(view) {
    const [defaultTitle, , description] = headings[view] || headings.overview;
    const title = adminLinks.get(view)?.label || (view === 'alerts' ? ReGenText.get('nav.notifications') : defaultTitle);
    document.getElementById('view-title').textContent = title;
    document.getElementById('view-description').textContent = ReGenText.locale === 'en-MY' ? description : '';
    document.getElementById('admin-breadcrumb-current').textContent = title;
  }
  function stamp() {
    document.getElementById('last-refresh').textContent = `Updated ${new Date().toLocaleTimeString(ReGenText.locale, {timeZone: 'Asia/Kuala_Lumpur', hour: '2-digit', minute: '2-digit'})}`;
  }
  function status(value) {
    const normalized = String(value || 'unknown').toLowerCase();
    const positive = ['active', 'verified', 'accepted', 'ready'].includes(normalized);
    const negative = ['disabled', 'suspended', 'unverified', 'failed'].includes(normalized);
    return `<span class="status-pill ${positive ? '' : negative ? 'is-off' : 'is-neutral'}">${safe(normalized)}</span>`;
  }
  function initials(first, last) {
    return `${String(first || '').charAt(0)}${String(last || '').charAt(0)}`.toUpperCase() || 'U';
  }
  function loading() {
    root.innerHTML = '<div class="admin-loading"><span></span><p>Loading data</p></div>';
  }
  function fail(message, reload = false) {
    root.innerHTML = `<section class="admin-panel"><div class="panel-title"><div><h2>Data unavailable</h2><p>${safe(message || 'Refresh the page and try again.')}</p></div><button type="button" class="btn btn-secondary btn-small" id="retry-view">${reload?'Reload administration':'Retry'}</button></div></section>`;
    document.getElementById('retry-view')?.addEventListener('click', () => reload ? window.location.reload() : show(activeView));
  }

  function openMobileNav() {
    sidebar.inert = false;
    sidebar.removeAttribute('aria-hidden');
    sidebar.classList.add('is-open');
    document.body.classList.add('admin-nav-open');
    document.querySelector('.admin-workspace').inert = true;
    mobileScrim.hidden = false;
    document.getElementById('admin-menu-toggle').setAttribute('aria-expanded', 'true');
    document.getElementById('admin-mobile-close').focus();
  }
  function closeMobileNav() {
    const returnFocus = sidebar.contains(document.activeElement);
    document.querySelector('.admin-workspace').inert = false;
    sidebar.classList.remove('is-open');
    document.body.classList.remove('admin-nav-open');
    sidebar.inert = window.matchMedia('(max-width:900px)').matches;
    if (sidebar.inert) sidebar.setAttribute('aria-hidden','true');
    else sidebar.removeAttribute('aria-hidden');
    mobileScrim.hidden = true;
    document.getElementById('admin-menu-toggle').setAttribute('aria-expanded', 'false');
    if(returnFocus && sidebar.inert)document.getElementById('admin-menu-toggle').focus();
  }

  function openDrawer({ mode, id = '', eyebrow, title, body, saveLabel = 'Save changes', danger = false }) {
    document.getElementById('drawer-save').hidden=false;
    drawer.dataset.mode = mode;
    drawer.dataset.id = id;
    document.getElementById('drawer-eyebrow').textContent = eyebrow;
    document.getElementById('drawer-title').textContent = title;
    document.getElementById('drawer-body').classList.remove('loading-user');
    document.getElementById('drawer-body').innerHTML = body;
    const save = document.getElementById('drawer-save');
    save.textContent = saveLabel;
    save.classList.toggle('btn-danger', danger);
    save.classList.toggle('btn-primary', !danger);
    drawer.showModal();
    window.setTimeout(() => {if(!document.getElementById('drawer-body').classList.contains('loading-user'))drawer.querySelector('input:not([disabled]),select,textarea')?.focus();},40);
  }
  function closeDrawer() {
    if (drawer.open) drawer.close();
    drawer.dataset.mode = '';
    drawer.dataset.id = '';
    drawerForm.reset();
  }

  function openConfirmation({ title, message, submitLabel = 'Confirm', type = 'danger', phrase = '', onConfirm }) {
    confirmAction = onConfirm;
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    document.getElementById('confirm-submit').textContent = submitLabel;
    document.getElementById('confirm-submit').disabled = false;
    document.getElementById('confirm-submit').className = type === 'danger' ? 'btn btn-danger' : 'btn btn-primary';
    document.getElementById('confirm-symbol').textContent = type === 'danger' ? '!' : '?';
    document.getElementById('confirm-extra').innerHTML = phrase
      ? `<label class="admin-field">Type <strong>${safe(phrase)}</strong> to continue<input id="confirm-phrase" autocomplete="off" required data-phrase="${safe(phrase)}"></label>`
      : '';
    confirmDialog.showModal();
    window.setTimeout(() => document.getElementById('confirm-phrase')?.focus(), 40);
  }
  function closeConfirmation() {
    if (confirmDialog.open) confirmDialog.close();
    confirmAction = null;
    confirmForm.reset();
  }

  async function overview() {
    const response = await api('/api/admin/dashboard');
    if (response.viewGeneration !== viewGeneration || activeView !== "overview") return;
    if (!response.success) return fail(response.message);
    const metrics = response.metrics || {};
    const points = metrics.registrations || [];
    const maximum = Math.max(1, ...points.map(point => Number(point.registrations) || 0));
    const cards = [
      ['users','Registered users',metrics.totalUsers,'All user accounts'],
      ['operations','Active sessions',metrics.activeSessions,'Seen in the last 15 minutes'],
      ['support','Open support requests',metrics.openTickets,'Awaiting resolution'],
      ['analytics','Landing views today',metrics.landingViewsToday,'Since midnight UTC'],
    ];
    root.innerHTML = `<section class="metric-grid overview-metrics">${cards.map(card => `<article class="metric-card"><p>${card[1]}</p><span class="metric-icon">${icon(card[0])}</span><strong>${Number(card[2] || 0).toLocaleString()}</strong><span>${card[3]}</span></article>`).join('')}</section>
      <section class="admin-panel-grid">
        <article class="admin-panel"><div class="panel-title"><div><h2>Registrations</h2><p>Accounts created during the last 14 days.</p></div></div>${window.ReGenAdminCharts.line(Array.from({length:14},(_,i)=>{const day=new Date(Date.now()-(13-i)*86400000).toISOString().slice(0,10);return {day,registrations:Number(points.find(p=>p.day===day)?.registrations||0)};}),[{key:'registrations',name:'New accounts'}],'Daily account registrations')}</article>
        <article class="admin-panel"><div class="panel-title"><div><h2>Account health</h2><p>Current access state across registered accounts.</p></div></div>${window.ReGenAdminCharts.ring([{label:'Active',value:metrics.activeUsers||0},{label:'Restricted',value:Math.max(0,(metrics.totalUsers||0)-(metrics.activeUsers||0))}],'Account access distribution')}<div class="quick-actions"><button type="button" class="quick-action" data-open-view="users">Manage accounts<span>→</span></button></div></article>
      </section>`;
    root.insertAdjacentHTML('beforeend',`<section class="admin-panel"><div class="panel-title"><div><h2>Operating snapshot</h2><p>Current account and delivery totals.</p></div></div><dl class="operating-snapshot">${[['Verified accounts',metrics.verifiedUsers],['New in 24 hours',metrics.newToday],['AI allowance credits used',metrics.aiTokensUsed],['Queued email',metrics.pendingEmails]].map(([label,value])=>`<div><dt>${label}</dt><dd>${Number(value||0).toLocaleString()}</dd></div>`).join('')}</dl></section>`);
    root.querySelectorAll('[data-open-view]').forEach(button => {button.hidden=!allowedModules.includes(button.dataset.openView);button.addEventListener('click', () => show(button.dataset.openView));});
    stamp();
  }

  async function userList(search = userSearch, page = userPage) {
    userSearch = String(search || '').trim();
    userPage = Math.max(1, Number(page) || 1);
    const response = await api(`/api/admin/users?search=${encodeURIComponent(userSearch)}&page=${userPage}`);
    if (response.viewGeneration !== viewGeneration || activeView !== "users") return;
    if (!response.success) return fail(response.message);
    users = response.items || [];
    const total = Number(response.total || 0);
    const pages = Math.max(1, Math.ceil(total / 25));
    if (userPage > pages) return userList(userSearch, pages);
    root.innerHTML = `<section class="admin-panel"><div class="panel-title"><div><h2>Registered accounts</h2><p>Status, email verification, linked sign-in and AI allowance.</p></div><div class="panel-title-actions"><button type="button" class="btn btn-primary btn-small" id="new-user">Add user</button></div></div>
      <form method="post" class="admin-toolbar" id="user-search-form"><div class="admin-search-wrap"><input class="admin-search" id="user-search" type="search" placeholder="Search by name or email" value="${safe(userSearch)}"></div><button class="btn btn-secondary btn-small" type="submit">Search</button><button class="btn btn-secondary btn-small" type="button" id="user-search-clear" ${userSearch ? '' : 'hidden'}>Clear</button><span class="admin-result-count">${total.toLocaleString()} account${total === 1 ? '' : 's'}</span></form>
      <div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>User</th><th>Verification</th><th>Access</th><th>Google</th><th>AI usage</th><th>Created</th><th></th></tr></thead><tbody>${users.length ? users.map(user => `<tr><td><strong>${safe(user.first_name)} ${safe(user.last_name)}</strong><small>${safe(user.email)}</small></td><td>${user.email_verified_at ? status('verified') : status('unverified')}</td><td>${status(user.account_status)}</td><td>${Number(user.google_linked) ? status('linked') : '<span class="status-pill is-neutral">not linked</span>'}</td><td>${Number(user.ai_used || 0)} / ${user.ai_token_limit !== null ? Number(user.ai_token_limit) : 'default'}</td><td>${safe(formatDate(user.created_at))}</td><td><button type="button" class="table-action edit-user" data-id="${user.id}">Manage</button></td></tr>`).join('') : '<tr><td colspan="7">No accounts match this search.</td></tr>'}</tbody></table></div>
      <div class="admin-pagination"><button type="button" class="btn btn-secondary btn-small" id="users-prev" ${userPage <= 1 ? 'disabled' : ''}>Previous</button><span>Page ${userPage} of ${pages}</span><button type="button" class="btn btn-secondary btn-small" id="users-next" ${userPage >= pages ? 'disabled' : ''}>Next</button></div></section>`;
    document.getElementById('user-search-form').addEventListener('submit', event => { event.preventDefault(); userList(document.getElementById('user-search').value, 1); });
    document.getElementById('user-search-clear')?.addEventListener('click', () => userList('', 1));
    document.getElementById('users-prev').addEventListener('click', () => userList(userSearch, userPage - 1));
    document.getElementById('users-next').addEventListener('click', () => userList(userSearch, userPage + 1));
    document.getElementById('new-user').addEventListener('click', newUser);
    document.querySelectorAll('.edit-user').forEach(button => button.addEventListener('click', () => editUser(Number(button.dataset.id))));
    stamp();
  }

  function editUser(id) {
    const user = users.find(item => Number(item.id) === id);
    if (!user) return;
    const body = `<div class="drawer-summary"><span class="drawer-summary-avatar">${safe(initials(user.first_name, user.last_name))}</span><div><strong>${safe(user.first_name)} ${safe(user.last_name)}</strong><span>${safe(user.email)}</span></div>${status(user.account_status)}</div>
      <p class="admin-section-label">Account details</p><div class="admin-form-grid"><label class="admin-field">First name<input id="edit-first" maxlength="100" value="${safe(user.first_name)}" required></label><label class="admin-field">Last name<input id="edit-last" maxlength="100" value="${safe(user.last_name)}" required></label><label class="admin-field is-wide">Email<input value="${safe(user.email)}" disabled><small>Email changes require user verification and are managed from the user profile.</small></label><label class="admin-field">Phone<input id="edit-phone" maxlength="30" value="${safe(user.phone)}"></label><label class="admin-field">Account access<select id="edit-status"><option value="active">Active</option><option value="suspended">Suspended</option><option value="disabled">Disabled</option></select></label><label class="admin-field is-wide">AI allowance override<input id="edit-limit" type="number" min="0" max="1000" value="${safe(user.ai_token_limit)}" placeholder="Use system default"><small>Leave blank for the system allowance. Set 0 to block AI for this account.</small></label></div>
      <section class="drawer-section"><h3>Account operations</h3><p>These actions take effect immediately and are recorded in the activity log.</p><div class="drawer-operation-grid"><button type="button" class="drawer-operation" id="reset-quota"><strong>Reset AI usage</strong><span>Clear the current token window for this user.</span></button><button type="button" class="drawer-operation" id="revoke-user-sessions"><strong>Sign out all devices</strong><span>Revoke every active session for this user.</span></button></div></section>`;
    openDrawer({ mode: 'user', id, eyebrow: 'User account', title: 'Manage account', body, saveLabel: 'Save account' });
    document.getElementById('drawer-body').classList.add('loading-user');
    document.getElementById('edit-status').value = user.account_status;
    document.getElementById('reset-quota').addEventListener('click', () => openConfirmation({
      title: 'Reset AI usage?', message: `The current AI usage window for ${user.first_name} ${user.last_name} will be cleared.`, submitLabel: 'Reset usage', type: 'standard',
      onConfirm: async () => {
        const response = await api(`/api/admin/users/${id}/reset-quota`, { method: 'POST', body: '{}' });
        if (!response.success) throw new Error(response.message || 'AI usage could not be reset.');
        toast('AI usage reset', 'The user can use their full allowance again.');
      },
    }));
    document.getElementById('revoke-user-sessions').addEventListener('click', () => openConfirmation({
      title: 'Sign out all devices?', message: `${user.first_name} ${user.last_name} will need to sign in again on every device.`, submitLabel: 'Sign out devices',
      onConfirm: async () => {
        const response = await api(`/api/admin/users/${id}/revoke-sessions`, { method: 'POST', body: '{}' });
        if (!response.success) throw new Error(response.message || 'Sessions could not be revoked.');
        toast('Sessions revoked', `${Number(response.sessionsRevoked || 0)} active session(s) were signed out.`);
      },
    }));
    if(!capabilities.includes('users.manage')){document.querySelectorAll('#drawer-body input,#drawer-body select,#drawer-body [id=reset-quota],#drawer-body [id=revoke-user-sessions]').forEach(element=>element.disabled=true);document.getElementById('drawer-save').hidden=true;}else document.getElementById('drawer-save').hidden=false;
    modules.enhanceUser(user).finally(()=>{const host=document.getElementById('drawer-body');if(drawer.dataset.id!==String(id))return;host.classList.remove('loading-user');if(drawer.open)host.querySelector('[role=tab][aria-selected=true]')?.focus();});
  }

  function newUser() {
    openDrawer({
      mode: 'user-create', eyebrow: 'New user account', title: 'Add user', saveLabel: 'Create and send verification',
      body: `<div class="admin-note">The account starts as unverified. A verification email is sent immediately, and the user must verify the address before signing in.</div><div class="drawer-section"><p class="admin-section-label">User details</p><div class="admin-form-grid"><label class="admin-field">First name<input id="create-user-first" maxlength="100" autocomplete="off" required></label><label class="admin-field">Last name<input id="create-user-last" maxlength="100" autocomplete="off" required></label><label class="admin-field is-wide">Email<input id="create-user-email" type="email" maxlength="200" autocomplete="off" required></label><label class="admin-field">Phone<input id="create-user-phone" maxlength="30" autocomplete="off"></label><label class="admin-field">Temporary password<input id="create-user-password" type="password" minlength="10" maxlength="128" autocomplete="new-password" required><small>Share this separately through a secure channel.</small></label><label class="admin-field is-wide">Confirm temporary password<input id="create-user-confirm" type="password" minlength="10" maxlength="128" autocomplete="new-password" required></label></div></div>`,
    });
  }

  async function aiControls() {
    const response = await api('/api/admin/settings/ai');
    if (response.viewGeneration !== viewGeneration || activeView !== "ai") return;
    if (!response.success) return fail(response.message);
    const settings = response.settings || {};
    root.innerHTML = `<section class="admin-panel"><form method="post" id="ai-settings-form"><div class="panel-title"><div><h2>System allowance</h2><p>Base tokens are used for AI after package benefits, before saved tokens. Individual action prices are configured in Pricing.</p></div>${settings.aiEnabled ? status('active') : status('disabled')}</div>
      <div class="settings-block"><label class="switch-row"><span><strong>AI features</strong><small>Controls AI suggestions and generated ATS comments for all users.</small></span><input id="ai-enabled" type="checkbox" ${settings.aiEnabled ? 'checked' : ''}></label></div>
      <div class="settings-block"><label class="switch-row"><span><strong>Renew AI allowances automatically</strong><small>When off, the base allowance stays used until an administrator resets it. Saved tokens do not expire.</small></span><input id="ai-renewable" type="checkbox" ${settings.aiRenewable!==false?'checked':''}></label></div><div class="settings-block"><p class="admin-section-label">AI allowance policy</p><div class="admin-form-grid"><label class="admin-field">Default base tokens per user<input id="ai-limit" type="number" min="1" max="1000" value="${Number(settings.aiDefaultLimit || 10)}" required><small>Each successful operation uses its configured price. Failed requests are free.</small></label><label class="admin-field">Renewal interval (hours)<input id="ai-hours" type="number" min="1" max="720" value="${Number(settings.aiRenewalHours || 24)}" required><small>Starts from the first AI operation in a new window.</small></label></div></div>
      <div class="settings-save"><button class="btn btn-primary" id="ai-save" type="submit">Save AI policy</button></div></form></section>`;
    const renewal=()=>{document.getElementById('ai-hours').disabled=!document.getElementById('ai-renewable').checked;};document.getElementById('ai-renewable').onchange=renewal;renewal();
    root.insertAdjacentHTML('beforeend','<section class="admin-panel"><div class="panel-title"><div><h2>OpenAI provider usage</h2><p>Your application tokens are separate from the provider’s billed API usage.</p></div></div><p class="muted">The documented OpenAI organization API reports usage and costs. It does not provide a documented prepaid credit balance endpoint. Check your provider balance in Billing; a separate organization admin credential would be needed for an automated cost report.</p><div class="settings-save"><a class="btn btn-secondary" href="https://platform.openai.com/settings/organization/billing/overview" target="_blank" rel="noopener noreferrer">Open provider billing ↗</a><a class="btn btn-secondary" href="https://platform.openai.com/usage" target="_blank" rel="noopener noreferrer">View provider usage ↗</a></div></section>');
    document.getElementById('ai-settings-form').addEventListener('submit', async event => {
      event.preventDefault();
      const button = document.getElementById('ai-save');
      setBusy(button, true, 'Saving');
      const result = await api('/api/admin/settings/ai', { method: 'PUT', body: JSON.stringify({ aiEnabled: document.getElementById('ai-enabled').checked, aiRenewable:document.getElementById('ai-renewable').checked, aiDefaultLimit: Number(document.getElementById('ai-limit').value), aiRenewalHours: Number(document.getElementById('ai-hours').value), aiCosts: settings.aiCosts || {assist:1,refine:1,cover_letter:1,review:1} }) });
      setBusy(button, false);
      if (!result.success) return toast('AI policy not saved', result.message || 'Check the values and try again.', 'error');
      toast('AI policy saved', 'The updated allowance applies immediately.');
      aiControls();
    });
    stamp();
  }

  async function systemControls() {
    const response = await api('/api/admin/settings/system');
    if (response.viewGeneration !== viewGeneration || activeView !== "system") return;
    if (!response.success) return fail(response.message);
    const settings = response.settings || {};
    const switches = [
      ['registration-enabled', 'Password registration', 'Allow new accounts to be created with email and password.', settings.registrationEnabled],
      ['google-enabled', 'Google sign-in', 'Allow Google sign-in and identity linking.', settings.googleLoginEnabled],
      ['email-change-enabled', 'Email changes', 'Allow password accounts to change and reverify their email.', settings.profileEmailChangeEnabled],
      ['self-delete-enabled', 'Account deletion', 'Allow users to permanently delete their own account.', settings.userSelfDeleteEnabled],
    ];
    root.innerHTML = `<section class="admin-panel"><form method="post" id="system-settings-form"><div class="settings-block"><div class="panel-title"><div><h2>Application identity</h2><p>Displayed name and support contact used by the account experience.</p></div></div><div class="admin-form-grid"><label class="admin-field">Application name<input id="system-name" maxlength="60" value="${safe(settings.appName)}" required></label><label class="admin-field">Support email<input id="support-email" type="email" maxlength="200" value="${safe(settings.supportEmail)}" placeholder="support@your-domain.com"></label></div></div>
      <div class="settings-block"><p class="admin-section-label">Feature access</p><div class="control-switches">${switches.map(item => `<label class="switch-row"><span><strong>${item[1]}</strong><small>${item[2]}</small></span><input id="${item[0]}" type="checkbox" ${item[3] ? 'checked' : ''}></label>`).join('')}</div></div>
      <div class="settings-block"><p class="admin-section-label">Security policy</p><div class="admin-form-grid"><label class="admin-field">Maximum active devices<input id="max-sessions" type="number" min="1" max="20" value="${Number(settings.maxActiveSessions || 5)}" required><small>Older sessions are revoked when this limit is exceeded.</small></label><label class="admin-field">Audit retention (days)<input id="audit-days" type="number" min="30" max="730" value="${Number(settings.auditRetentionDays || 180)}" required><small>Expired entries are removed in bounded batches.</small></label></div></div>
      <div class="settings-save"><button class="btn btn-primary" id="system-save" type="submit">Save system settings</button></div></form></section>`;
    root.insertAdjacentHTML('beforeend', `<section class="admin-panel access-readiness"><div class="access-readiness-icon">${icon('admins')}</div><div class="access-readiness-copy"><div class="panel-title"><div><p class="admin-eyebrow">Release readiness</p><h2>Temporary administrator access</h2></div>${status(settings.bootstrapAdminEnabled?'enabled':'disabled')}</div><p>The starter account is intended for initial setup. Use a personal account for traceable day-to-day administration.</p><ol><li>Create a personal super administrator.</li><li>Sign in and complete its password setup.</li><li>Disable shared access to end its existing sessions.</li></ol><button type="button" class="btn btn-secondary" id="bootstrap-access" ${Number(currentAdmin.is_bootstrap)||(!settings.bootstrapAdminEnabled&&currentAdmin.role!=='super_admin')?'disabled':''}>${settings.bootstrapAdminEnabled?'Disable temporary access':'Enable temporary access'}</button>${Number(currentAdmin.is_bootstrap)?'<small>Sign in with a personal super administrator to use this control.</small>':''}</div></section>`);
    document.getElementById('bootstrap-access').addEventListener('click',()=>openConfirmation({
      title:settings.bootstrapAdminEnabled?'Disable temporary access?':'Enable temporary access?',
      message:settings.bootstrapAdminEnabled?'The shared starter account and all its sessions will be disabled. Your personal administrator account will stay signed in.':'The shared starter account will be able to sign in with its setup credentials. Disable it again when setup is complete.',
      submitLabel:settings.bootstrapAdminEnabled?'Disable shared access':'Enable shared access',
      onConfirm:async()=>{const result=await api('/api/admin/settings/bootstrap-access',{method:'PUT',body:JSON.stringify({enabled:!settings.bootstrapAdminEnabled})});if(!result.success)throw new Error(result.message);toast('Temporary access updated',result.enabled?'The shared starter account is enabled.':'The shared starter account and its sessions are disabled.');systemControls();},
    }));
    document.getElementById('system-settings-form').addEventListener('submit', async event => {
      event.preventDefault();
      const button = document.getElementById('system-save');
      setBusy(button, true, 'Saving');
      const payload = {
        appName: document.getElementById('system-name').value, supportEmail: document.getElementById('support-email').value,
        registrationEnabled: document.getElementById('registration-enabled').checked, googleLoginEnabled: document.getElementById('google-enabled').checked,
        profileEmailChangeEnabled: document.getElementById('email-change-enabled').checked, userSelfDeleteEnabled: document.getElementById('self-delete-enabled').checked,
        maxActiveSessions: Number(document.getElementById('max-sessions').value), auditRetentionDays: Number(document.getElementById('audit-days').value),
      };
      const result = await api('/api/admin/settings/system', { method: 'PUT', body: JSON.stringify(payload) });
      setBusy(button, false);
      if (!result.success) return toast('System settings not saved', result.message || 'Check the values and try again.', 'error');
      toast('System settings saved', 'The change is recorded in the activity log.');
    });
    stamp();
  }

  async function mochiControls() {
    const endpoint = '/api/admin/settings/mochi';
    const response = await api(endpoint);
    if (response.viewGeneration !== viewGeneration || activeView !== 'mochi') return;
    if (!response.success) return fail(response.message);
    const {mochi} = response;
    const switches = [
      ['enabled','Mochi available','Show Mochi and allow eligible accounts to use coaching.'],
      ['preview','Landing page preview','Let visitors play with Mochi before signing in.'],
      ['autoplay','Spontaneous play','Let Mochi play with yarn, climb and explore on his own.'],
      ['naps','Spontaneous naps','Let Mochi take breaks after playing.'],
      ['editorReactions','Editor reactions','React to skipped sections, saved writing and completed drafts.'],
      ['sound','Allow sound','Visitors still choose whether to turn sound on.'],
      ['liveFeedback','Allow live field feedback','Users must still turn it on before any text is sent.'],
    ];
    const switchRows=keys=>switches.filter(([key])=>keys.includes(key)).map(([key,label,hint])=>`<label class="switch-row"><span><strong>${label}</strong><small>${hint}</small></span><input type="checkbox" name="${key}" ${mochi[key]!==false?'checked':''}></label>`).join('');
    root.innerHTML = `<form id="mochi-settings-form" class="admin-mochi">
      <section class="admin-panel mochi-admin-overview">
        <img src="/img/mochi-coach.webp" width="72" height="72" alt="">
        <div><h2>Global settings</h2><p>Control where Mochi appears, how he plays, and what he can spend.</p></div>
        <span id="mochi-global-state"></span>
      </section>
      <div class="mochi-admin-grid">
        <section class="admin-panel mochi-admin-card"><h3>Availability</h3><p>Schedule when Mochi is around. Times are in Malaysia time.</p>
          <div class="control-switches">${switchRows(['enabled','preview'])}</div>
          <div class="admin-form-grid">
            <label class="admin-field">Available from<input name="start" type="time" value="${safe(mochi.start)}"></label>
            <label class="admin-field">Available until<input name="end" type="time" value="${safe(mochi.end)}"></label>
          </div><p class="mochi-admin-note">Leave both times blank to keep Mochi available all day.</p>
        </section>
        <section class="admin-panel mochi-admin-card"><h3>Play &amp; reactions</h3><p>Choose how active Mochi feels on the site.</p>
          <div class="control-switches">${switchRows(['autoplay','naps','editorReactions','sound'])}</div>
          <div class="admin-form-grid">
            <label class="admin-field">Play pace<select name="pace"><option value="calm">Calm</option><option value="balanced">Balanced</option><option value="playful">Playful</option></select></label>
            <label class="admin-field">Health (%)<input name="health" type="number" min="0" max="100" value="${Number(mochi.health)}" required><small>Below 35, Mochi takes longer breaks.</small></label>
          </div>
        </section>
        <section class="admin-panel mochi-admin-card mochi-admin-budget"><div><h3>AI spending</h3><p>Only writing requests and optional field feedback use AI. Play and ReGen support are local.</p></div>
          <div class="mochi-admin-usage"><p id="mochi-app-usage"></p><meter id="mochi-app-meter" aria-label="Daily app AI budget used" min="0" max="1" value="0"></meter><small>Resets at midnight Malaysia time. These are request counts.</small></div>
          <div class="admin-form-grid">
            <label class="admin-field">Daily requests across all accounts<input name="dailyBudget" type="number" min="0" max="100000" value="${Number(mochi.dailyBudget??500)}" required><small>Zero pauses all Mochi AI.</small></label>
            <label class="admin-field">Daily requests per account<input name="dailyTokens" type="number" min="0" max="1000" value="${Number(mochi.dailyTokens)}" required><small>Set exceptions in Account limits below.</small></label>
            <label class="admin-field">Field feedback interval (seconds)<input name="feedbackSeconds" type="number" min="45" max="600" value="${Number(mochi.feedbackSeconds??90)}" required></label>
          </div><div class="control-switches">${switchRows(['liveFeedback'])}</div>
        </section>
      </div><div class="settings-save mochi-admin-save"><button class="btn btn-primary" type="submit">Save global settings</button></div></form>
      <section class="admin-panel mochi-admin-card"><div class="panel-title"><div><h2>Account limits</h2><p>Find a customer to see how much Mochi AI they’ve used today and change their access.</p></div></div>
      <form id="mochi-account-lookup" class="mochi-account-search"><label class="admin-field">Find an account<input name="query" type="search" placeholder="Name, email or account ID" maxlength="120" required></label><button class="btn btn-secondary" type="submit">Find account</button></form>
      <div id="mochi-account-results" aria-live="polite"></div><div id="mochi-account-controls"></div></section>`;
    const global = document.getElementById('mochi-settings-form');
    global.elements.pace.value=mochi.pace??'balanced';
    const showGlobal=data=>{
      const state=global.querySelector('#mochi-global-state');
      state.innerHTML=status(data.available?'active':'disabled');
      const used=Number(data.usedToday??0), limit=Number(data.mochi?.dailyBudget??global.elements.dailyBudget.value);
      global.querySelector('#mochi-app-usage').textContent=limit===0?'AI paused':`${used.toLocaleString()} / ${limit.toLocaleString()} requests today`;
      const meter=global.querySelector('#mochi-app-meter');
      meter.max=Math.max(1,limit);meter.value=Math.min(used,meter.max);
    };
    showGlobal(response);
    global.onsubmit = async event => {
      event.preventDefault();
      const fields=global.elements, button=global.querySelector('[type=submit]');
      const values=Object.fromEntries(switches.map(([key])=>[key,fields[key].checked]));
      setBusy(button,true,'Saving');
      const result=await api(endpoint,{method:'PUT',body:JSON.stringify({...values,health:Number(fields.health.value),
        dailyTokens:Number(fields.dailyTokens.value),dailyBudget:Number(fields.dailyBudget.value),feedbackSeconds:Number(fields.feedbackSeconds.value),
        pace:fields.pace.value,start:fields.start.value,end:fields.end.value})});
      setBusy(button,false);
      if (!result.success) return toast('Mochi settings not saved',result.message,'error');
      if (global.isConnected) showGlobal(result);
      toast('Mochi settings saved');
    };
    const lookup=document.getElementById('mochi-account-lookup'), accountHost=document.getElementById('mochi-account-controls');
    const results=document.getElementById('mochi-account-results');
    let lookupVersion=0;
    lookup.onsubmit=async event=>{
      event.preventDefault();
      const query=lookup.elements.query.value.trim(), version=++lookupVersion;
      accountHost.replaceChildren();results.replaceChildren();
      if (/^[1-9][0-9]{0,9}$/.test(query)) {loadAccount(Number(query));return;}
      if (query.length<2) {results.textContent='Enter at least two characters.';return;}
      results.textContent='Searching accounts…';
      const found=await api('/api/admin/users?search='+encodeURIComponent(query)+'&page=1');
      if (version!==lookupVersion||activeView!=='mochi') return;
      if (!found.success) {results.textContent=found.status===403?'Enter an account ID, or ask an administrator with User accounts access to look it up.':found.message||'Could not search accounts.';return;}
      const matches=(found.items||[]).slice(0,8);
      if (!matches.length) {results.textContent='No matching accounts. Try another name or email.';return;}
      const list=document.createElement('div');list.className='mochi-account-matches';
      matches.forEach(user=>{
        const button=document.createElement('button');button.type='button';button.className='mochi-account-result';
        const name=(user.first_name+' '+user.last_name).trim();
        const title=document.createElement('strong'), detail=document.createElement('small');
        title.textContent=name;detail.textContent=user.email;button.append(title,detail);
        button.addEventListener('click',()=>loadAccount(Number(user.id),name+' · '+user.email));list.append(button);
      });
      results.replaceChildren(list);
    };
    async function loadAccount(id,identity='') {
      if (!Number.isSafeInteger(id)||id<1) return;
      const version=++lookupVersion, path=endpoint+'/user/'+id;
      results.replaceChildren();
      accountHost.textContent='Loading account…';
      const result=await api(path);
      if (version!==lookupVersion||activeView!=='mochi') return;
      if (!result.success) {accountHost.textContent=result.message||'Account could not be loaded.';return;}
      const {account}=result;
      accountHost.innerHTML=`<form id="mochi-account-form"><h3>${safe(identity||'Account #'+id)}</h3><p data-mochi-account-usage role="status"></p><div class="admin-form-grid">
        <label class="admin-field">Access for account #${id}<select name="mode">
          <option value="inherit">Follow the customer’s package</option><option value="play-only">Play and ReGen support only</option><option value="off">Hide Mochi entirely</option>
        </select><small>Changing this does not change the customer’s package.</small></label><label class="admin-field">Daily AI requests for this account<input name="dailyTokens" type="number" min="0" max="1000" placeholder="Use the default account limit" value="${account.dailyTokens??''}"><small>Leave blank to use the default, or enter 0 to pause AI for this customer.</small></label>
        </div><div class="settings-save"><button type="submit" class="btn btn-primary">Save account limits</button></div></form>`;
      const form=accountHost.querySelector('form'), usage=form.querySelector('[data-mochi-account-usage]');
      const showUsage=data=>{usage.textContent=`${Number(data.usedToday)} of ${Number(data.limit)} AI requests used today (Malaysia time)`;};
      form.elements.mode.value=account.mode;
      showUsage(result);
      form.onsubmit=async event=>{
        event.preventDefault();
        const button=form.querySelector('[type=submit]'), daily=form.elements.dailyTokens.value;
        setBusy(button,true,'Saving');
        const saved=await api(path,{method:'PUT',body:JSON.stringify({mode:form.elements.mode.value,dailyTokens:daily===''?null:Number(daily)})});
        setBusy(button,false);
        if (!saved.success) return toast('Account limits not saved',saved.message,'error');
        showUsage(saved);toast('Mochi account limits saved');
      };
    }
    stamp();
  }

  async function emailControls() {
    const response = await api('/api/admin/email');
    if (response.viewGeneration !== viewGeneration || activeView !== "email") return;
    if (!response.success) return fail(response.message);
    const settings = response.status || {};
    const rows = response.recent || [];
    root.innerHTML = `<section class="metric-grid email-metrics"><article class="metric-card"><p>Overall status</p><span class="metric-icon">${icon('email')}</span><strong class="metric-word ${settings.configured ? 'is-good' : 'is-bad'}">${settings.configured ? 'Ready' : 'Action required'}</strong><span>${settings.configured ? 'Delivery can be tested.' : 'SMTP configuration is incomplete.'}</span></article><article class="metric-card"><p>Transport</p><span class="metric-icon">${icon('system')}</span><strong class="metric-word">${safe(settings.transport || 'smtp').toUpperCase()}</strong><span>${settings.smtpConfigured ? 'Credentials are present.' : 'Host or credentials are missing.'}</span></article><article class="metric-card"><p>Sender</p><span class="metric-icon">${icon('users')}</span><strong class="metric-word">${safe(settings.fromEmailMasked || 'Not configured')}</strong><span>${settings.appUrlConfigured ? 'Application URL is valid.' : 'Application URL is invalid.'}</span></article></section>
      <section class="admin-panel"><div class="panel-title"><div><h2>Delivery test</h2><p>Sends one message using the configured transport. The recipient is masked in delivery records.</p></div></div><form method="post" class="admin-toolbar" id="email-test-form"><div class="admin-search-wrap"><input class="admin-search" id="email-test-address" type="email" placeholder="test@your-domain.com" required></div><button class="btn btn-primary btn-small" id="email-test-button" type="submit">Send test email</button></form></section>
      <section class="admin-panel"><div class="panel-title"><div><h2>Recent delivery results</h2><p>“Accepted” means the SMTP server accepted the message; inbox placement is separate.</p></div></div><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Time</th><th>Purpose</th><th>Recipient</th><th>Transport</th><th>Result</th><th>Request ID</th></tr></thead><tbody>${rows.length ? rows.map(item => `<tr><td>${safe(formatDate(item.created_at))}</td><td>${safe(item.purpose)}</td><td>${safe(item.recipient_mask)}</td><td>${safe(item.transport).toUpperCase()}</td><td>${status(item.status)}</td><td><small>${safe(item.request_id || 'Not available')}</small></td></tr>`).join('') : '<tr><td colspan="6">No delivery attempts have been recorded.</td></tr>'}</tbody></table></div></section>`;
    if(settings.smtpConfigurationHint){
      const hint=document.createElement('p');
      hint.className='admin-note';
      hint.textContent=settings.smtpConfigurationHint;
      root.querySelector('#email-test-form').before(hint);
    }
    if(capabilities.includes('email.manage')){const button=document.createElement('button');button.type='button';button.className='btn btn-secondary';button.textContent='Configure email';button.addEventListener('click',modules.emailSettings);root.querySelector('.panel-title').append(button);}
    document.getElementById('email-test-form').addEventListener('submit', async event => {
      event.preventDefault();
      const button = document.getElementById('email-test-button');
      setBusy(button, true, 'Sending');
      const result = await api('/api/admin/email/test', { method: 'POST', body: JSON.stringify({ email: document.getElementById('email-test-address').value }) });
      setBusy(button, false);
      if (!result.success) return toast('Email test failed', result.message || 'Review the SMTP configuration.', 'error', 7000);
      toast('Test accepted', 'Check the destination inbox and spam folder.');
      emailControls();
    });
    stamp();
  }

  async function operations() {
    root.innerHTML = `<section class="admin-panel"><div class="panel-title"><div><h2>User sessions</h2><p>Use this only when all users must authenticate again, such as after a security incident.</p></div></div><div class="operation-row"><div><strong>Revoke every user session</strong><p>Signs out all tracked user devices. Administrator sessions remain active.</p></div><button type="button" class="btn btn-danger" id="revoke-all">Revoke all sessions</button></div></section>
      <section class="admin-panel"><div class="panel-title"><div><h2>Execution controls</h2><p>Controls applied to privileged operations.</p></div></div><div class="guarantee-grid"><article><strong>Authorisation</strong><span>Global session revocation requires a super administrator.</span></article><article><strong>Confirmation</strong><span>An exact confirmation phrase is required before execution.</span></article><article><strong>Record</strong><span>The actor, target and affected session count are written to the activity log.</span></article></div></section>`;
    document.getElementById('revoke-all').addEventListener('click', () => openConfirmation({
      title: 'Revoke all user sessions?', message: 'Every user will be signed out and must authenticate again. Administrator sessions are not affected.', submitLabel: 'Revoke sessions', phrase: 'SIGN OUT ALL USERS',
      onConfirm: async () => {
        const response = await api('/api/admin/operations/revoke-all-sessions', { method: 'POST', body: JSON.stringify({ confirmation: 'SIGN OUT ALL USERS' }) });
    if (response.viewGeneration !== viewGeneration || activeView !== "operations") return;
        if (!response.success) throw new Error(response.message || 'Sessions could not be revoked.');
        toast('All user sessions revoked', `${Number(response.sessionsRevoked || 0)} session(s) were signed out.`, 'warning', 7000);
      },
    }));
    stamp();
  }

  async function adminList() {
    const response = await api('/api/admin/admins');
    if (response.viewGeneration !== viewGeneration || activeView !== "admins") return;
    if (!response.success) return fail(response.message);
    const admins = response.admins || [];
    root.innerHTML = `<section class="admin-panel"><div class="panel-title"><div><h2>Administrator accounts</h2><p>Only super administrators can create or disable administrator access.</p></div><div class="panel-title-actions"><button type="button" class="btn btn-primary btn-small" id="new-admin">Add administrator</button></div></div><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Administrator</th><th>Role</th><th>Access</th><th>Last sign-in</th><th>Created</th><th></th></tr></thead><tbody>${admins.map(admin => `<tr><td><strong>${safe(admin.first_name)} ${safe(admin.last_name)}</strong><small>${safe(admin.email)}</small></td><td>${safe(String(admin.role).replace('_', ' '))}</td><td>${status(admin.status)}</td><td>${safe(formatDate(admin.last_login_at))}</td><td>${safe(formatDate(admin.created_at))}</td><td>${admin.role === 'admin' ? `<button type="button" class="table-action edit-permissions" data-id="${admin.id}" data-name="${safe(admin.first_name)} ${safe(admin.last_name)}">Module access</button>` : ''}${Number(admin.id) !== Number(currentAdmin.id) ? `<button type="button" class="table-action toggle-admin" data-id="${admin.id}" data-name="${safe(admin.first_name)} ${safe(admin.last_name)}" data-status="${admin.status === 'active' ? 'disabled' : 'active'}">${admin.status === 'active' ? 'Disable' : 'Enable'}</button>` : '<span class="admin-result-count">Current account</span>'}</td></tr>`).join('')}</tbody></table></div></section>`;
    document.getElementById('new-admin').addEventListener('click', newAdmin);
    root.querySelectorAll('.edit-permissions').forEach(button => button.addEventListener('click', () => modules.permissions(Number(button.dataset.id), button.dataset.name))); 
    document.querySelectorAll('.toggle-admin').forEach(button => button.addEventListener('click', () => {
      const enabling = button.dataset.status === 'active';
      openConfirmation({
        title: `${enabling ? 'Enable' : 'Disable'} administrator?`,
        message: `${button.dataset.name} will ${enabling ? 'regain' : 'lose'} access to the administration portal.`,
        submitLabel: enabling ? 'Enable access' : 'Disable access', type: enabling ? 'standard' : 'danger',
        onConfirm: async () => {
          const result = await api(`/api/admin/admins/${button.dataset.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: button.dataset.status }) });
          if (!result.success) throw new Error(result.message || 'Administrator access could not be changed.');
          toast(`Administrator ${enabling ? 'enabled' : 'disabled'}`, `${button.dataset.name}'s access was updated.`);
          adminList();
        },
      });
    }));
    stamp();
  }

  function newAdmin() {
    openDrawer({
      mode: 'admin', eyebrow: 'Privileged access', title: 'Add administrator', saveLabel: 'Create administrator',
      body: `<div class="admin-note">The administrator must replace the temporary password at first sign-in. Delegated administrators start with no module permissions; assign access after creating the account.</div><div class="drawer-section"><p class="admin-section-label">Identity and access</p><div class="admin-form-grid"><label class="admin-field">First name<input id="new-first" maxlength="100" autocomplete="off" required></label><label class="admin-field">Last name<input id="new-last" maxlength="100" autocomplete="off" required></label><label class="admin-field is-wide">Email<input id="new-email" type="email" maxlength="200" autocomplete="off" required></label><label class="admin-field">Temporary password<input id="new-password" type="password" minlength="10" maxlength="128" autocomplete="new-password" required><small>Use at least 10 characters and share it through a secure channel.</small></label><label class="admin-field">Role<select id="new-role"><option value="admin">Administrator</option><option value="super_admin">Super administrator</option></select><small>Super administrators can manage other administrators and revoke all user sessions.</small></label></div></div>`,
    });
  }

  async function audit() {
    const response = await api('/api/admin/audit?limit=150');
    if (response.viewGeneration !== viewGeneration || activeView !== "audit") return;
    if (!response.success) return fail(response.message);
    const logs = response.logs || [];
    root.innerHTML = `<section class="admin-panel"><div class="panel-title"><div><h2>Recorded operations</h2><p>Newest entries first. Values are escaped before display.</p></div><span class="admin-result-count">${logs.length} entries shown</span></div><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Time</th><th>Actor</th><th>Event</th><th>Target</th><th>Recorded details</th></tr></thead><tbody>${logs.length ? logs.map(log => `<tr><td>${safe(formatDate(log.created_at))}</td><td>${safe(log.actor_type)}${log.actor_id ? ` #${Number(log.actor_id)}` : ''}</td><td class="audit-event">${safe(log.event_type)}</td><td>${safe(log.target_type || '-')} ${safe(log.target_id || '')}</td><td><small class="audit-meta">${safe(typeof log.metadata === 'string' ? log.metadata : JSON.stringify(log.metadata || {}))}</small></td></tr>`).join('') : '<tr><td colspan="5">No activity has been recorded.</td></tr>'}</tbody></table></div></section>`;
    stamp();
  }

  function passwordSetup(required = true, append = false) {
    headings.password = required ? ['Password setup', 'Required security step', 'Replace the temporary password before using administration features.'] : ['My password', 'Personal security', 'Use a unique password to protect your administrator account.'];
    if(!append)setHeading('password');
    document.querySelectorAll('#admin-nav button').forEach(button => { button.disabled = required; });
    const passwordMarkup = `<section class="admin-panel"><div class="panel-title"><div><h2>Update your password</h2><p>Use a unique password with at least 10 characters.</p></div></div><form method="post" id="forced-password-form"><div class="admin-form-grid"><label class="admin-field is-wide">Current password<input id="forced-current" type="password" autocomplete="current-password" maxlength="128" required></label><label class="admin-field">New password<input id="forced-new" type="password" minlength="10" maxlength="128" autocomplete="new-password" required></label><label class="admin-field">Confirm new password<input id="forced-confirm" type="password" minlength="10" maxlength="128" autocomplete="new-password" required></label></div><div class="settings-save"><button class="btn btn-primary" id="forced-save" type="submit">Update password</button></div></form></section>`;
    if(append)root.insertAdjacentHTML('beforeend',passwordMarkup);else root.innerHTML=passwordMarkup;
    document.getElementById('forced-password-form').addEventListener('submit', async event => {
      event.preventDefault();
      const button = document.getElementById('forced-save');
      setBusy(button, true, 'Updating');
      const result = await api('/api/admin/password', { method: 'PUT', body: JSON.stringify({ currentPassword: document.getElementById('forced-current').value, newPassword: document.getElementById('forced-new').value, confirmPassword: document.getElementById('forced-confirm').value }) });
      setBusy(button, false);
      if (!result.success) return toast('Password not updated', result.message || 'Check the values and try again.', 'error');
      currentAdmin.must_change_password = 0;
      startAlertUpdates();
      window.ReGenLive?.stop();window.ReGenLive?.start();
      document.querySelectorAll('#admin-nav button').forEach(navButton => { navButton.disabled = false; });
      document.getElementById('admin-banner').innerHTML = '';
      toast('Password updated', 'Use your new password at the next sign-in.');
      show(required?(allowedModules[0]||'pending'):'profile');
    });
  }

  const navigation = JSON.parse(document.getElementById('regen-admin-navigation').textContent);
  const adminLinks = new Map();
  for (const [id, item] of Object.entries(navigation)) {
    adminLinks.set(id, {label: item.label, module: item.modules[0]});
    for (const [member, details] of Object.entries(item.members)) {
      adminLinks.set(member, {...details, group: id});
    }
  }
  const ownViews = ['profile', 'alerts'];
  const groupFor = view => adminLinks.get(view)?.group;
  const hasView = view => ownViews.includes(view)
    || (view === 'admins' ? currentAdmin?.role === 'super_admin' : allowedModules.includes(adminLinks.get(view)?.module));
  const allowedMembers = group => Object.keys(navigation[group]?.members ?? {}).filter(hasView);
  function syncModuleNavigation() {
    document.querySelectorAll('#admin-nav [data-view]').forEach(button => {
      const view = button.dataset.view;
      const grouped = Object.keys(navigation[view].members).length > 0;
      button.hidden = grouped ? !allowedMembers(view).length : !hasView(view);
    });
    document.querySelectorAll('.admin-nav-group').forEach(group => {
      group.hidden = !group.querySelector('button:not([hidden])');
    });
  }
  function renderSubnav(view) {
    const group = groupFor(view);
    const nav = document.getElementById('admin-subnav');
    nav.hidden = !group;
    nav.replaceChildren();
    if (!group) return;
    for (const member of allowedMembers(group)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.moduleView = member;
      button.textContent = adminLinks.get(member).label;
      if (member === view) button.setAttribute('aria-current', 'page');
      button.onclick = () => show(member, true);
      nav.append(button);
    }
  }
  const locationView = () => new URL(location.href).searchParams.get('view');
  async function show(view, remember = false) {
    if (!currentAdmin) { pendingInitialView = view; return; }
    if (Number(currentAdmin.must_change_password)) return;
    if (view === 'password') view = 'profile';
    if (view && Object.keys(navigation[view]?.members ?? {}).length) {
      view = allowedMembers(view)[0];
    }
    if (!hasView(view)) view = allowedModules.find(hasView) || 'pending';
    if (remember && view !== locationView()) {
      const url = new URL(location.href);
      url.searchParams.set('view', view);
      history.pushState(null, '', url);
    }
    viewGeneration++;
    window.scrollTo({top:0,behavior:'instant'});
    activeView = view;
    if (view === 'pending') headings.pending = ['Access pending', 'Administrator account', 'Your module permissions have not been assigned yet.'];
    setHeading(view);
    document.querySelectorAll('#admin-nav button').forEach(button => {
      const selected = button.dataset.view === (groupFor(view)||view);
      button.classList.toggle('is-active', selected);
      if (selected) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    renderSubnav(view);
    closeMobileNav();
    loading();
    const generation = viewGeneration;
    try {
    if (view === 'pending') { setHeading('pending'); root.innerHTML = '<section class="admin-panel control-empty"><h2>Your account is ready</h2><p>A super administrator needs to assign your module access. You can change your password or sign out using the navigation.</p></section>'; return; }
    if(view==='profile'){await modules.views.profile();if(generation===viewGeneration){if(Number(currentAdmin.is_bootstrap))root.insertAdjacentHTML('beforeend','<section class="admin-panel"><h2>Use a personal password</h2><p class="muted">The shared starter account keeps its setup credentials. Create a personal administrator account, complete password setup, then disable temporary access in System settings.</p></section>');else passwordSetup(false,true);}return;}
    const builtIn={overview,users:userList,ai:aiControls,system:systemControls,mochi:mochiControls,email:emailControls,admins:adminList,operations,audit};
    const render=modules.views[view]||builtIn[view];
    if(typeof render!=='function')return fail('This administration module could not load. Reload to retrieve the current application files.',true);
    await render();
    if(generation===viewGeneration)window.ReGenAdminCharts.paginateTables(root);
    } catch(error) {
      console.error('Administration view could not render:',view,error);
      if(generation===viewGeneration)fail('This page could not be displayed. Try again, or reload administration if the problem continues.');
    }
  }

  drawerForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!drawerForm.checkValidity()) return drawerForm.reportValidity();
    const button = document.getElementById('drawer-save');
    const mode = drawer.dataset.mode;
    setBusy(button, true, ['admin', 'user-create'].includes(mode) ? 'Creating' : 'Saving');
    let result;
    if (mode === 'user') {
      result = await api(`/api/admin/users/${drawer.dataset.id}`, { method: 'PATCH', body: JSON.stringify({ firstName: document.getElementById('edit-first').value, lastName: document.getElementById('edit-last').value, phone: document.getElementById('edit-phone').value, status: document.getElementById('edit-status').value, aiTokenLimit: document.getElementById('edit-limit').value === '' ? null : Number(document.getElementById('edit-limit').value), version: users.find(user=>Number(user.id)===Number(drawer.dataset.id))?.version }) });
    } else if (mode === 'user-create') {
      const password = document.getElementById('create-user-password').value;
      if (password !== document.getElementById('create-user-confirm').value) {
        setBusy(button, false);
        return toast('Passwords do not match', 'Enter the same temporary password in both fields.', 'error');
      }
      result = await api('/api/admin/users', { method: 'POST', body: JSON.stringify({ firstName: document.getElementById('create-user-first').value, lastName: document.getElementById('create-user-last').value, email: document.getElementById('create-user-email').value, phone: document.getElementById('create-user-phone').value, password }) });
    } else {
      result = await api('/api/admin/admins', { method: 'POST', body: JSON.stringify({ firstName: document.getElementById('new-first').value, lastName: document.getElementById('new-last').value, email: document.getElementById('new-email').value, password: document.getElementById('new-password').value, role: document.getElementById('new-role').value }) });
    }
    setBusy(button, false);
    if (!result.success) return toast(mode === 'admin' ? 'Administrator not created' : mode === 'user-create' ? 'User not created' : 'Account not saved', result.message || 'Check the form and try again.', 'error', 7000);
    closeDrawer();
    toast(mode === 'admin' ? 'Administrator created' : mode === 'user-create' ? 'User created' : 'Account updated', mode === 'admin' ? 'First sign-in will require a password change.' : mode === 'user-create' ? result.message : 'The new account settings apply immediately.', result.deliveryAccepted === false ? 'warning' : 'success', 7000);
    show(mode === 'admin' ? 'admins' : 'users');
  });

  confirmForm.addEventListener('submit', async event => {
    event.preventDefault();
    const phraseInput = document.getElementById('confirm-phrase');
    if (phraseInput && phraseInput.value !== phraseInput.dataset.phrase) {
      return toast('Confirmation phrase does not match', 'Enter the phrase exactly as shown.', 'error');
    }
    if (typeof confirmAction !== 'function') return closeConfirmation();
    const action = confirmAction;
    const button = document.getElementById('confirm-submit');
    setBusy(button, true, 'Working');
    try {
      await action();
      closeConfirmation();
    } catch (error) {
      setBusy(button, false);
      toast('Action not completed', error.message || 'Try again.', 'error', 7000);
    }
  });

  document.getElementById('drawer-close').addEventListener('click', closeDrawer);
  document.getElementById('drawer-cancel').addEventListener('click', closeDrawer);
  document.getElementById('confirm-close').addEventListener('click', closeConfirmation);
  document.getElementById('confirm-cancel').addEventListener('click', closeConfirmation);
  drawer.addEventListener('cancel', event => { event.preventDefault(); closeDrawer(); });
  confirmDialog.addEventListener('cancel', event => { event.preventDefault(); closeConfirmation(); });
  drawer.addEventListener('click', event => { if (event.target === drawer) closeDrawer(); });
  confirmDialog.addEventListener('click', event => { if (event.target === confirmDialog) closeConfirmation(); });
  document.querySelectorAll('#admin-nav [data-view]').forEach(button=>{button.setAttribute('aria-label',button.querySelector('span:nth-child(2)')?.textContent||'Open module');});
  document.getElementById('admin-nav-collapse')?.addEventListener('click',event=>{const collapsed=document.body.classList.toggle('admin-nav-collapsed');event.currentTarget.setAttribute('aria-expanded',String(!collapsed));event.currentTarget.setAttribute('aria-label',collapsed?'Expand navigation':'Collapse navigation');});
  document.getElementById('admin-menu-toggle').addEventListener('click', openMobileNav);
  document.getElementById('admin-mobile-close').addEventListener('click', closeMobileNav);
  mobileScrim.addEventListener('click', closeMobileNav);
  const mobileLayout = window.matchMedia('(max-width:900px)');
  const syncNavigation = () => { if (!sidebar.classList.contains('is-open')) { sidebar.inert=mobileLayout.matches; if(sidebar.inert)sidebar.setAttribute('aria-hidden','true');else sidebar.removeAttribute('aria-hidden'); } };
  mobileLayout.addEventListener('change', syncNavigation);
  syncNavigation();
  document.addEventListener('keydown', event => {
    if(!sidebar.classList.contains('is-open') || !mobileLayout.matches)return;
    if(event.key==='Escape'){closeMobileNav();document.getElementById('admin-menu-toggle').focus();return;}
    if(event.key!=='Tab')return;
    const controls=Array.from(sidebar.querySelectorAll('a,button:not([disabled])')).filter(element=>!element.hidden&&element.getClientRects().length);
    const first=controls[0],last=controls.at(-1);
    if(event.shiftKey&&(document.activeElement===first||!sidebar.contains(document.activeElement))){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&(document.activeElement===last||!sidebar.contains(document.activeElement))){event.preventDefault();first?.focus();}
  });
  document.getElementById('admin-nav').addEventListener('click', event => {
    const button = event.target.closest('[data-view]');
    if (button && !button.disabled) show(button.dataset.view, true);
  });
  document.getElementById('admin-logout').addEventListener('click', () => openConfirmation({
    title:'Sign out of administration?',message:'Your administrator session will end. Save any open configuration before signing out.',submitLabel:'Sign out',type:'standard',
    onConfirm:async()=>{
      const result=await api('/api/admin/auth/logout',{method:'POST',body:'{}'});
      if(!result.success)throw new Error(result.message||'Sign-out could not complete. Please try again.');
      try { sessionStorage.removeItem('regen_admin_csrf'); } catch {}
      window.location.replace('/admin/login');
    },
  }));

  let alertPoll=null,alertChannel=null,alertRead=null;
  async function refreshAlerts() {
    if(!currentAdmin||Number(currentAdmin.must_change_password)||document.hidden)return;
    if(alertRead)return alertRead;
    alertRead=(async()=>{
      const response=await api('/api/admin/alerts');if(!response.success)return;
      for(const badge of document.querySelectorAll('#admin-alert-count,#admin-sidebar-alert-count')){badge.hidden=!response.unread;badge.textContent=response.unread>99?'99+':String(response.unread);}
      document.getElementById('admin-alerts-button')?.setAttribute('aria-label',`Notifications, ${response.unread} unread`);
      const latest=response.items[0]?.id||0;
      if(latestAlertId!==null&&Number(latest)>Number(latestAlertId)){
        const item=response.items[0];
        if(response.preferences.in_app_enabled&&window.ReGenLive?.isLeader!==false)toast(item.title,item.body,'warning',8000);
        if(window.ReGenLive?.isLeader!==false&&response.preferences.browser_enabled&&'Notification'in window&&Notification.permission==='granted')new Notification('ReGen administration',{body:item.title,tag:'regen-admin-'+item.id});
        if(activeView==='alerts')modules.views.alerts();
      }
      latestAlertId=latest;
    })().finally(()=>{alertRead=null;});return alertRead;
  }
  function alertChanged(){refreshAlerts();alertChannel?.postMessage({type:'changed'});}
  function startAlertUpdates(){
    if(alertPoll!==null)return;
    if('BroadcastChannel'in window)try{alertChannel=new BroadcastChannel('regen-admin-notifications');alertChannel.onmessage=event=>{if(event.data?.type==='changed')refreshAlerts();};}catch{}
    alertPoll=setInterval(()=>{if(!window.ReGenLive?.connected)refreshAlerts();},30000);refreshAlerts();
  }
  window.addEventListener('focus',refreshAlerts);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshAlerts();});
  window.addEventListener('pagehide',()=>{clearInterval(alertPoll);alertPoll=null;alertChannel?.close();alertChannel=null;});
  window.addEventListener('pageshow',event=>{if(event.persisted)startAlertUpdates();});
  root.addEventListener('click',event=>{
    if(activeView!=='recovery'||capabilities.includes('recovery.manage'))return;
    const button=event.target.closest('[data-inspect]');if(button){event.preventDefault();event.stopImmediatePropagation();toast('Read-only access','You can review history. Document restoration requires change access.','warning');}
  },true);
  const accessSelectors={users:'#new-user',ai:'#ai-settings-form',system:'#system-settings-form,#bootstrap-access',mochi:'#mochi-settings-form,#mochi-account-form',email:'#email-test-form',notifications:'#broadcast-form,#notification-policy,[data-retry]',support:'#ticket-update,#ticket-reopen',security:'[data-block],[data-unblock]',recovery:'#recovery-create,#recovery-policy',campaigns:'[data-create-campaign]'};
  const syncReadOnly=()=>{
    const module=activeView==='health'?'operations':['mochi','maintenance','uploads'].includes(activeView)?'system':activeView;
    const readOnly=allowedModules.includes(module)&&!capabilities.includes(module+'.manage')&&!['overview','reports','analytics','audit'].includes(module);
    const banner=document.getElementById('admin-read-only');
    if(banner)banner.hidden=!readOnly;
    const selectors=accessSelectors[activeView];
    if(!readOnly||!selectors)return;
    root.querySelectorAll(selectors).forEach(element=>{if(element.matches('button,input,select,textarea'))element.disabled=true;else element.querySelectorAll('button,input,select,textarea').forEach(control=>control.disabled=true);});
  };
  function reflowTables() {
    for (const table of root.querySelectorAll('.admin-table')) {
      const headers = table.tHead?.rows.length === 1 ? [...table.tHead.rows[0].cells] : [];
      if (headers.length < 2 || headers.length > 7 || headers.some(cell => cell.colSpan !== 1)) continue;
      table.dataset.reflow = '';
      table.setAttribute('role', 'table');
      table.tHead.setAttribute('role', 'rowgroup');
      table.tHead.rows[0].setAttribute('role', 'row');
      headers.forEach(cell => { cell.scope = 'col'; cell.setAttribute('role', 'columnheader'); });
      for (const body of table.tBodies) {
        body.setAttribute('role', 'rowgroup');
        for (const row of body.rows) {
          row.setAttribute('role', 'row');
          if (row.cells.length !== headers.length) continue;
          [...row.cells].forEach((cell, index) => {
            if (cell.firstElementChild?.classList.contains('cell-label')) return;
            cell.setAttribute('role', 'cell');
            const label = document.createElement('span');
            label.className = 'cell-label';
            label.setAttribute('aria-hidden', 'true');
            label.textContent = headers[index].textContent.trim() || ReGenText.get('admin.actions');
            const content = document.createElement('div');
            content.className = 'cell-content';
            content.append(...cell.childNodes);
            cell.append(label, content);
          });
        }
      }
    }
  }
  new MutationObserver(() => {
    syncReadOnly();
    window.ReGenAdminCharts?.paginateTables(root);
    reflowTables();
  }).observe(root,{childList:true,subtree:true});

  let modules={views:{}};
  try {
    modules = window.ReGenAdminModules({root,api,safe,status,formatDate,toast,stamp,fail,icon,openConfirmation,show,active:()=>activeView,permissions:()=>allowedModules,can:capability=>capabilities.includes(capability),refreshAlerts:alertChanged,admin:()=>currentAdmin});
  } catch(error) {
    console.error('Administration modules could not initialize:',error);
  }
  document.getElementById('admin-alerts-button')?.addEventListener('click',()=>show('alerts', true));
  window.addEventListener('popstate', () => show(locationView()));
  let lastActivityPing=0;
  const recordActivity=event=>{if(!event.isTrusted||!currentAdmin||Number(currentAdmin.must_change_password)||document.hidden||Date.now()-lastActivityPing<45000)return;lastActivityPing=Date.now();api('/api/admin/session/active',{method:'POST',body:'{}'});};
  document.addEventListener('pointerdown',recordActivity,{passive:true});document.addEventListener('keydown',recordActivity);
  let liveRefreshTimer=null;
  async function refreshWorkQueues(){
    if(!currentAdmin)return;
    const response=await api('/api/admin/work-queues');if(!response.success)return;
    for(const [view,count]of Object.entries(response.counts)){
      const button=document.querySelector('#admin-nav [data-view="'+view+'"]');if(!button)continue;
      let badge=button.querySelector('.admin-work-count');if(!badge){badge=document.createElement('span');badge.className='admin-work-count';button.append(badge);}
      badge.id='work-count-'+view;button.setAttribute('aria-describedby',badge.id);
      badge.hidden=!count;badge.textContent=count>99?'99+':String(count);badge.setAttribute('aria-label',count+(view==='support'?' tickets awaiting staff':' feedback responses awaiting review'));
      button.title=view==='support'?'Tickets that are open or in progress; waiting for users is excluded.':'Feedback with review status New.';
    }
  }
  async function updateAccess(){
    const data=await api('/api/admin/me');if(!data.success)return;
    currentAdmin=data.admin;allowedModules=data.permissions||[];capabilities=data.capabilities||[];
    syncModuleNavigation();
    if (!hasView(activeView) && activeView !== 'pending') show(locationView());
    if(!capabilities.includes('templates.resumes'))document.querySelectorAll('.private-resume-dialog,.template-usage-dialog').forEach(dialog=>dialog.close());
    if(!allowedModules.includes('users')&&drawer.open)closeDrawer();
    syncReadOnly();
  }
  async function applyLiveChange(event){
    if(!currentAdmin||Number(currentAdmin.must_change_password))return;
    const topics=event?.detail?.topics||[];const changed=names=>!topics.length||topics.some(topic=>names.includes(topic));
    if(changed(['support','feedback']))refreshWorkQueues();
    if(changed(['alerts']))refreshAlerts();
    if(changed(['profile','admins']))await updateAccess();
    const related={overview:['overview'],reports:['reports'],analytics:['analytics'],users:['users'],templates:['templates'],campaigns:['campaigns'],ai:['ai','system'],system:['system'],features:['features','system'],maintenance:['system'],email:['email'],notifications:['email'],support:['support'],feedback:['feedback'],security:['security'],health:['operations'],operations:['operations'],recovery:['recovery'],audit:['audit'],admins:['admins'],alerts:['alerts'],store:['pricing'],pricing:['pricing','store'],uploads:['system']};
    if(!changed(related[activeView]||[]))return;
    if(activeView==='support')return modules.refreshSupport();
    if(root.querySelector('form[data-live-dirty="true"]')){
      if(root.querySelector('.live-update-note'))return;
      const notice=document.createElement('div');notice.className='live-update-note';notice.innerHTML='<p>New data is available. Your unsaved changes are still here.</p><button class="btn btn-secondary" type="button">Review latest data</button>';
      notice.querySelector('button').onclick=()=>openConfirmation({title:'Review the latest data?',message:'Unsaved changes on this page will be replaced by the current server values.',submitLabel:'Review latest',type:'standard',onConfirm:async()=>show(activeView)});root.prepend(notice);return;
    }
    const builtIn={overview,users:userList,ai:aiControls,system:systemControls,email:emailControls,admins:adminList,operations,audit};
    await(modules.views[activeView]||builtIn[activeView])?.();
    window.ReGenAdminCharts.paginateTables(root);
  }
  root.addEventListener('input',event=>{const form=event.target.closest('form');if(form)form.dataset.liveDirty='true';});
  root.addEventListener('change',event=>{const form=event.target.closest('form');if(form)form.dataset.liveDirty='true';});
  const pendingLiveTopics=new Set();let reconcileLive=false;
  const queueLiveChange=event=>{if(event.detail?.topic)pendingLiveTopics.add(event.detail.topic);else reconcileLive=true;clearTimeout(liveRefreshTimer);liveRefreshTimer=setTimeout(()=>{const topics=reconcileLive?[]:[...pendingLiveTopics];pendingLiveTopics.clear();reconcileLive=false;applyLiveChange({detail:{topics}}).catch(()=>{});},120);};
  window.addEventListener('regen:live-change',queueLiveChange);window.addEventListener('regen:reconcile',queueLiveChange);
  window.addEventListener('regen:live-status',event=>{const badge=document.getElementById('admin-live-state');if(badge){badge.dataset.state=event.detail.state;badge.textContent=({live:'Live updates',polling:'Automatic updates',paused:'Paused',offline:'Offline',delayed:'Updates delayed'})[event.detail.state]||'Connecting updates';}});
  window.addEventListener('pagehide',()=>clearTimeout(liveRefreshTimer));
  const me = await api('/api/admin/me');
  if (!me.success) return;
  currentAdmin = me.admin;
  allowedModules = me.permissions || [];
  capabilities = me.capabilities || [];
  syncModuleNavigation();
  document.getElementById('admin-name').textContent = `${currentAdmin.first_name} ${currentAdmin.last_name}`;
  document.getElementById('admin-role').textContent = ReGenText.get(currentAdmin.role === 'super_admin' ? 'admin.super' : 'admin.delegated');
  document.getElementById('admin-avatar').textContent = initials(currentAdmin.first_name, currentAdmin.last_name);
  if (Number(currentAdmin.is_bootstrap)) document.getElementById('admin-banner').innerHTML = '<div class="admin-banner">You are using temporary shared access. Create a personal super admin, then disable shared access in System settings before release.</div>';
  if (Number(currentAdmin.must_change_password)) {
    document.getElementById('admin-banner').innerHTML = '<div class="admin-banner">Replace the temporary bootstrap password to continue.</div>';
    passwordSetup();
  } else {
    await show(pendingInitialView || locationView());pendingInitialView=null;
    startAlertUpdates();refreshWorkQueues();
  }
  window.setInterval(() => {
      if (activeView === 'overview' && !window.ReGenLive?.connected && !Number(currentAdmin.must_change_password) && !document.hidden) overview();
  }, 30000);
});
