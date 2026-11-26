document.addEventListener('DOMContentLoaded', async () => {
  const home = document.getElementById('resume-home');
  const preview = document.getElementById('dashboard-preview-modal');
  const pdfPages = document.getElementById('dashboard-pdf-pages');
  const metrics = document.getElementById('dashboard-metrics');
  const writing = document.getElementById('dashboard-ai-token-card');
  const nextAction = document.getElementById('overview-next-action');
  const t = (key, fallback) => ReGenText.get(key, fallback);
  const safe = ReGenCommerce.safe;
  const number = ReGenCommerce.number;
  const icon = ReGenIcons.icon;
  let activeResume;
  let revision = 0;
  let signature, balance, dashboardState, coverAccess;
  let renderedMetrics;
  let identityRevision = 0;

  function resumeUrl(id, section) {
    return '/builder?id=' + encodeURIComponent(id) + (section ? '&section=' + encodeURIComponent(section) : '');
  }

  function formatDate(value) {
    const date = Api.parseDate(value);
    return date ? new Intl.DateTimeFormat(ReGenText.locale, {
      timeZone: 'Asia/Kuala_Lumpur', dateStyle: 'medium', timeStyle: 'short',
    }).format(date) : t('dashboard.recent');
  }

  function action(path, label, name, primary = false) {
    const pricingLabel = path.startsWith('/builder') ? ` data-price-base="${safe(label)}"` : '';
    return `<a class="btn ${primary ? 'btn-primary' : 'btn-secondary'}" href="${path}"${pricingLabel}>${icon(name)}${safe(label)}</a>`;
  }

  function metric(mark, label, value, detail = '') {
    return `<div class="overview-metric"><div class="overview-metric-title">${mark}<h2>${safe(label)}</h2></div>
      <strong>${safe(value)}</strong>${detail ? `<p>${safe(detail)}</p>` : ''}</div>`;
  }

  function renderMetrics(dashboard, balance) {
    const snapshot = JSON.stringify([dashboard === undefined, dashboard?.coverLetterCount, balance === undefined, balance?.total, balance?.coinColor]);
    if (renderedMetrics === snapshot) return;
    renderedMetrics = snapshot;
    const count = dashboard ? number(dashboard.coverLetterCount) : null;
    const documentMetrics = metric(icon('letter'), t('overview.letterCount'), count ?? '—',
      dashboard ? '' : t('overview.dataUnavailable'));
    const placeholder = '<div class="overview-metric overview-placeholder" aria-hidden="true"><span></span><strong></strong></div>';
    metrics.innerHTML = (dashboard === undefined ? placeholder : documentMetrics)
      + (balance === undefined ? placeholder : metric(ReGenCommerce.coin('small', balance?.coinColor), t('commerce.wallet'),
        balance ? number(balance.total) : '—', balance ? '' : t('overview.balanceUnavailable')));
    metrics.setAttribute('aria-busy', String(dashboard === undefined || balance === undefined));
    if (balance) document.querySelector('.overview-store-coin').innerHTML = ReGenCommerce.coin('large', balance.coinColor);
  }

  function renderWriting(ai) {
    const quota = ai?.quota;
    const available = ai?.enabled === true && Number.isFinite(quota?.remaining);
    writing.hidden = false;
    writing.innerHTML = `<h2>${icon('sparkles')}${safe(t('dashboard.aiTitle'))}</h2>
      <p>${safe(available
        ? t('overview.aiRemaining').replace('{count}', number(quota.remaining))
        : t('dashboard.aiUnavailable'))}</p>`;
  }

  function renderError(result) {
    activeResume = null;
    nextAction.hidden = true;
    nextAction.setAttribute('aria-busy', 'false');
    const expired = result.status === 401;
    home.innerHTML = `<div class="overview-panel overview-empty"><h2>${safe(t(expired ? 'dashboard.authExpired' : 'dashboard.unavailable'))}</h2>
      ${expired ? action('/login', t('common.signIn'), 'arrowRight', true) :
        `<p>${safe(t('dashboard.loadError'))}</p><button class="btn btn-primary" id="retry-load" type="button">${safe(t('common.retry'))}</button>`}</div>`;
    home.querySelector('#retry-load')?.addEventListener('click', () => loadData(true));
  }

  function bindResumeActions(profile) {
    home.querySelector('#open-resume-preview').addEventListener('click', async () => {
      if (!activeResume || preview.open) return;
      preview.showModal();
      await PdfPages.render(pdfPages, '/api/pdf/' + encodeURIComponent(activeResume) + '/document');
    });
    home.querySelector('#download-resume').addEventListener('click', async event => {
      const error = home.querySelector('.overview-error');
      error.hidden = true;
      const result = await Api.downloadPdf(event.currentTarget, 'resume.pdf', profile.id);
      if (!result.success && !result.handled) {
        error.textContent = result.message || t('dashboard.unavailable');
        error.hidden = false;
      }
    });
  }

  function recentDocument(title, detail, path, name) {
    return `<a class="overview-recent-item" href="${path}"><span class="overview-file-icon">${icon(name)}</span>
      <div><strong>${safe(title)}</strong><small>${safe(detail)}</small></div>${icon('arrowRight')}</a>`;
  }

  function renderChecklist(profile) {
    const sections = (profile.sections || []).filter(section => !section.optional);
    if (!sections.length) return '';
    return `<ul class="overview-milestones" aria-label="${safe(t('overview.sectionList'))}">
      ${sections.map(section => `<li><a data-state="${section.complete ? 'done' : 'pending'}" href="${resumeUrl(profile.id, section.id)}">
        ${icon(section.complete ? 'check' : 'circle')}<span>${safe(t('section.' + section.id, section.label))}</span>
        <small>${safe(t(section.complete ? 'overview.complete' : 'overview.incomplete'))}</small></a></li>`).join('')}
      </ul>`;
  }

  function renderBoard(profile, latest) {
    const resume = profile && `<div class="overview-resume-row">${recentDocument(profile.title || t('dashboard.untitled'),
      t('studio.title') + ' · ' + formatDate(profile.updatedAt), resumeUrl(profile.id, profile.nextSection), 'template')}
      <div class="overview-document-actions">
        <button class="btn btn-secondary" type="button" id="open-resume-preview" data-price-base="${safe(t('common.preview'))}">${icon('eye')}<span>${safe(t('common.preview'))}</span></button>
        <button class="btn btn-secondary" type="button" id="download-resume" data-price-base="${safe(t('common.download'))}">${icon('download')}<span>${safe(t('common.download'))}</span></button>
      </div><p class="overview-error" role="alert" hidden></p></div>`;
    const letter = latest && recentDocument([latest.role, latest.company].filter(Boolean).join(' · '),
      t('nav.shortLetters') + ' · ' + formatDate(latest.updated_at), '/cover-letters?id=' + encodeURIComponent(latest.id), 'letter');
    const recent = [
      resume && [profile.updatedAt, resume],
      letter && [latest.updated_at, letter],
    ].filter(Boolean).sort(([left], [right]) => Api.parseDate(right) - Api.parseDate(left));
    const next = profile?.sections?.find(section => section.id === profile.nextSection && !section.complete);
    const nextLabel = next && t('section.' + next.id, next.label);
    const title = next ? t('overview.continueSection').replace('{section}', nextLabel)
      : t(profile ? 'overview.readyToReview' : 'overview.startResume');
    const destination = !profile ? '/templates' : next ? resumeUrl(profile.id, next.id)
      : resumeUrl(profile.id, 'references') + '&review=1';
    const actionLabel = !profile ? t('dashboard.choose') : t(next ? 'dashboard.continue' : 'dashboard.reviewOpen');
    const filled = (profile?.sections || []).filter(section => !section.optional && section.complete).length;
    const total = (profile?.sections || []).filter(section => !section.optional).length;
    nextAction.hidden = false;
    nextAction.setAttribute('aria-busy', 'false');
    const coverage = t('overview.sectionCoverage').replace('{done}', number(filled)).replace('{total}', number(total));
    nextAction.innerHTML = `<div class="overview-next-content">${profile && total ? `<p class="overview-progress-caption">${safe(t('overview.resumeProgress'))}</p>` : ''}<h2>${safe(title)}</h2>${!profile ? `<p class="overview-first-resume">${safe(t('overview.firstResumeGuide'))}</p>` : ''}
      <div class="overview-next-links">${action(destination, actionLabel, next || !profile ? 'edit' : 'check', true)}
      </div></div>${profile && total ? `<div class="overview-progress-dial" style="--coverage:${filled/total*100}%">
      <span aria-hidden="true">${number(filled)}<small>/${number(total)}</small></span>
      <progress class="sr-only" id="overview-resume-progress" aria-label="${safe(coverage)}" value="${filled}" max="${total}"></progress></div>${renderChecklist(profile)}`
      : `<div class="overview-next-art" aria-hidden="true"><div class="overview-next-paper">${icon('template')}<i></i><i></i><i></i></div></div>`}`;
    home.innerHTML = `<section class="overview-recent"><header><h2>${safe(t('overview.recentDocuments'))}</h2></header>
      ${recent.length ? recent.map(([, row]) => row).join('') : `<div class="overview-empty">
        <p>${safe(t('dashboard.emptyText'))}</p></div>`}</section>`;
    if (profile) bindResumeActions(profile);
  }

  function loadData(showLoading = false, refreshIdentity = true) {
    const loading = ++revision;
    if (showLoading) {
      signature = undefined;
      home.setAttribute('aria-busy', 'true');
      home.innerHTML = `<p class="overview-loading" role="status">${safe(t('dashboard.loading'))}</p>`;
      dashboardState = undefined;
      renderMetrics(dashboardState, balance);
    }
    if (refreshIdentity) {
      const identityRequest = ++identityRevision;
      Api.getMe().then(user => {
        if (identityRequest !== identityRevision || !user.success) return;
        ZeekeAccountMenu.init({userName: user.userName || t('nav.account'), initials: ZeekeAccountMenu.initialsFromUser(user.user)});
        if (user.userName) document.querySelector('.dash-page-title').textContent = t('dashboard.welcomeName').replace('{name}', user.userName);
      });
    }
    return Api.getOverview().then(dashboard => {
      if (loading !== revision) return;
      dashboardState = dashboard.success ? dashboard : null;
      renderMetrics(dashboardState, balance);
      renderWriting(dashboard.ai);
      home.setAttribute('aria-busy', 'false');
      if (!dashboard.success) {
        signature = undefined;
        renderError(dashboard);
        return;
      }
      const {profile, latestLetter} = dashboard;
      activeResume = profile?.id;
      const nextSignature = JSON.stringify([profile, latestLetter]);
      if (nextSignature === signature) return;
      signature = nextSignature;
      document.getElementById('dashboard-open-resume').href = profile ? resumeUrl(profile.id, profile.nextSection) : '/builder';
      document.getElementById('dashboard-design-link').href = profile
        ? resumeUrl(profile.id, profile.nextSection) + '&designs=1' : '/templates';
      renderBoard(profile, latestLetter);
    });
  }

  document.getElementById('dashboard-preview-close').addEventListener('click', () => preview.close());
  preview.addEventListener('click', event => { if (event.target === preview) preview.close(); });
  preview.addEventListener('close', () => {
    PdfPages.clear(pdfPages);
    document.getElementById('open-resume-preview')?.focus();
  });

  let liveReload, identityPending = false;
  const updateDashboard = event => {
    if (event.detail?.topic && !['documents', 'profile', 'ai', 'features', 'store'].includes(event.detail.topic)) return;
    clearTimeout(liveReload);
    if (!event.detail?.topic || event.detail.topic === 'profile') identityPending = true;
    liveReload = setTimeout(() => {
      const refreshIdentity = identityPending;
      identityPending = false;
      loadData(false, refreshIdentity);
    }, 180);
  };
  window.addEventListener('regen:balance-updated', event => {
    balance = event.detail;
    renderMetrics(dashboardState, balance);
  });
  window.addEventListener('regen:live-change', updateDashboard);
  window.addEventListener('regen:prices-updated', event => {
    const price = event.detail?.prices?.cover_letters;
    const canRead = !!price && (price.mode === 'free' || price.unlocked || price.packageUnlocked);
    if (coverAccess !== undefined && canRead !== coverAccess) updateDashboard(event);
    coverAccess = canRead;
  });
  window.addEventListener('regen:reconcile', updateDashboard);
  window.addEventListener('pagehide', () => clearTimeout(liveReload));
  balance = window.ReGenTokens.getBalance();
  void window.ReGenTokens.refresh().then(() => {
    balance = window.ReGenTokens.getBalance() ?? null;
    renderMetrics(dashboardState, balance);
  });
  loadData();
});
