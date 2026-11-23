document.addEventListener('DOMContentLoaded', async () => {
  const home = document.getElementById('resume-home');
  const preview = document.getElementById('dashboard-preview-modal');
  const pdfPages = document.getElementById('dashboard-pdf-pages');
  const metrics = document.getElementById('dashboard-metrics');
  const writing = document.getElementById('dashboard-ai-token-card');
  const t = (key, fallback) => ReGenText.get(key, fallback);
  const safe = ReGenCommerce.safe;
  const number = ReGenCommerce.number;
  const icon = ReGenIcons.icon;
  let activeResume;
  let revision = 0;
  let signature;

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

  function metric(mark, label, value, detail, progress = null) {
    return `<div class="overview-metric"><div class="overview-metric-title">${mark}<h2>${safe(label)}</h2></div>
      <strong>${safe(value)}</strong><p>${safe(detail)}</p>
      ${progress === null ? '' : `<progress max="100" value="${Number(progress)}" aria-label="${safe(label)}"></progress>`}</div>`;
  }

  function renderMetrics(dashboard, balance) {
    const profile = dashboard?.profile;
    const count = dashboard ? number(dashboard.coverLetterCount) : null;
    const progress = profile ? number(profile.completion) + '%' : dashboard ? '0%' : '—';
    metrics.innerHTML = metric(icon('template'), t('overview.resumeProgress'), progress,
      profile ? t('overview.resumeProgressHelp') : t(dashboard ? 'overview.resumeNone' : 'overview.dataUnavailable'), profile?.completion ?? null)
      + metric(icon('letter'), t('overview.letterCount'), count ?? '—',
        t(!dashboard ? 'overview.dataUnavailable' : Number(count) === 0 ? 'dashboard.letterEmpty' : 'overview.letterCountHelp'))
      + metric(ReGenCommerce.coin('small', balance?.coinColor), t('commerce.wallet'),
        balance ? number(balance.total) : '—', t(balance ? 'commerce.available' : 'overview.balanceUnavailable'));
    metrics.setAttribute('aria-busy', 'false');
    document.querySelector('.overview-store-coin').innerHTML = ReGenCommerce.coin('large', balance?.coinColor);
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
    const done = sections.filter(section => section.complete).length;
    const summary = t('overview.sectionCoverage').replace('{done}', number(done)).replace('{total}', number(sections.length));
    return `<div class="overview-checklist">
      <div class="overview-section-meter" aria-hidden="true">${sections.map(section => `<span${section.complete ? ' data-complete' : ''}></span>`).join('')}</div>
      <p>${safe(summary)}</p><ul aria-label="${safe(t('overview.sectionList'))}">
      ${sections.map(section => `<li><a href="${resumeUrl(profile.id, section.id)}">${icon(section.complete ? 'check' : 'circle')}
        ${safe(t('section.' + section.id, section.label))}<span class="sr-only">${safe(t(section.complete ? 'overview.complete' : 'overview.incomplete'))}</span></a></li>`).join('')}
      </ul></div>`;
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
    home.innerHTML = `<section class="overview-recent"><header><h2>${safe(t('overview.recentDocuments'))}</h2></header>
      ${recent.length ? recent.map(([, row]) => row).join('') : `<div class="overview-empty">
        <p>${safe(t('dashboard.emptyText'))}</p>${action('/templates', t('dashboard.choose'), 'add', true)}</div>`}</section>
      ${profile ? `<section class="overview-next"><h2>${safe(t('overview.resumeProgress'))}</h2>${renderChecklist(profile)}
        ${next ? `<p>${safe(t('overview.nextSection').replace('{section}', nextLabel))}</p>
          ${action(resumeUrl(profile.id, next.id), t('dashboard.continue'), 'edit', true)}`
          : `<p>${safe(t('dashboard.reviewHelp'))}</p>
          ${action(resumeUrl(profile.id, 'references') + '&review=1', t('dashboard.reviewOpen'), 'check', true)}`}</section>` : ''}`;
    if (profile) bindResumeActions(profile);
  }

  async function loadData(showLoading = false) {
    const loading = ++revision;
    if (showLoading) {
      signature = undefined;
      home.setAttribute('aria-busy', 'true');
      home.innerHTML = `<p class="overview-loading" role="status">${safe(t('dashboard.loading'))}</p>`;
      metrics.setAttribute('aria-busy', 'true');
      metrics.innerHTML = `<p class="overview-loading" role="status">${safe(t('overview.loadingSummary'))}</p>`;
    }
    const [user, dashboard, store] = await Promise.all([Api.getMe(), Api.listResumes(), Api.getFeaturePrices()]);
    if (loading !== revision) return;
    if (user.success) {
      ZeekeAccountMenu.init({userName: user.userName || t('nav.account'), initials: ZeekeAccountMenu.initialsFromUser(user.user)});
    }
    document.querySelector('.dash-page-title').textContent = user.userName
      ? t('dashboard.welcomeName').replace('{name}', user.userName) : t('nav.overview');
    renderMetrics(dashboard.success ? dashboard : null, store?.success ? store.balance : null);
    renderWriting(dashboard.ai);
    if (!dashboard.success) {
      home.setAttribute('aria-busy', 'false');
      signature = undefined;
      renderError(dashboard);
      return;
    }
    const profile = dashboard.profile;
    activeResume = profile?.id;
    const access = store?.prices?.cover_letters;
    const letters = dashboard.coverLetterCount && access && !access.hiddenByPackage
      && (access.mode !== 'package_only' || access.packageUnlocked || access.packageUses)
      ? await Api.listCoverLetters() : null;
    if (loading !== revision) return;
    const latest = letters?.success ? letters.data?.[0] : null;
    home.setAttribute('aria-busy', 'false');
    const nextSignature = JSON.stringify([profile, latest]);
    if (nextSignature === signature) return;
    signature = nextSignature;
    document.getElementById('dashboard-open-resume').href = profile ? resumeUrl(profile.id, profile.nextSection) : '/builder';
    document.getElementById('dashboard-design-link').href = profile
      ? resumeUrl(profile.id, profile.nextSection) + '&designs=1' : '/templates';
    renderBoard(profile, latest);
  }

  document.getElementById('dashboard-preview-close').addEventListener('click', () => preview.close());
  preview.addEventListener('click', event => { if (event.target === preview) preview.close(); });
  preview.addEventListener('close', () => {
    PdfPages.clear(pdfPages);
    document.getElementById('open-resume-preview')?.focus();
  });

  let liveReload;
  const updateDashboard = event => {
    if (event.detail?.topic && !['documents', 'profile', 'ai', 'feedback', 'wallet', 'store', 'pricing'].includes(event.detail.topic)) return;
    clearTimeout(liveReload);
    liveReload = setTimeout(loadData, 180);
  };
  window.addEventListener('regen:bonus-updated', updateDashboard);
  window.addEventListener('regen:wallet-changed', updateDashboard);
  window.addEventListener('regen:live-change', updateDashboard);
  window.addEventListener('regen:prices-updated', updateDashboard);
  window.addEventListener('regen:reconcile', updateDashboard);
  window.addEventListener('pagehide', () => clearTimeout(liveReload));
  await loadData(true);
});
