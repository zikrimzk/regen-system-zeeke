document.addEventListener('DOMContentLoaded', async () => {
  const home = document.getElementById('resume-home');
  const preview = document.getElementById('dashboard-preview-modal');
  const pdfPages = document.getElementById('dashboard-pdf-pages');
  const aiTokens = document.getElementById('dashboard-ai-token-card');
  const nextTask = document.getElementById('dashboard-next-task');
  const documents = document.getElementById('dashboard-documents');
  const resumeLink = document.getElementById('dashboard-resume-link');
  const candidate = document.getElementById('workspace-candidate');
  const library = document.body.dataset.workspaceView === 'library';
  const t = (key, fallback) => ReGenText.get(key, fallback);
  const safe = value => ZeekeSafe.attr(value ?? '');
  const icon = name => ReGenIcons.icon(name);
  const button = (label, path, className) => '<a class="btn ' + className + '" href="' + path + '">' + safe(label) + '</a>';
  let activeResume = null;
  let loadingRevision = 0;
  let renderedSummary;

  function resumeUrl(id, section) {
    return '/builder?id=' + encodeURIComponent(id) + (section ? '&section=' + encodeURIComponent(section) : '');
  }

  function formatDate(value) {
    const date = Api.parseDate(value);
    return date ? new Intl.DateTimeFormat(ReGenText.locale, {
      timeZone: 'Asia/Kuala_Lumpur', dateStyle: 'medium', timeStyle: 'short',
    }).format(date) : t('dashboard.recent');
  }

  function renderAiTokens(ai = {}) {
    if (library) return;
    const quota = ai.quota || {};
    const total = Math.max(0, Number(quota.remaining) || 0);
    aiTokens.innerHTML = '<section class="overview-availability"><h2>' + safe(t('dashboard.aiTitle', 'Writing assistance'))
      + '</h2><p>' + safe(ai.enabled === false ? t('dashboard.aiUnavailable') : !total ? t('dashboard.aiEmpty')
        : new Intl.NumberFormat(ReGenText.locale).format(total) + ' ' + t('commerce.available'))
      + '</p><a class="text-link" href="/token-activity">' + safe(t('nav.tokens')) + '</a></section>';

  }

  function renderEmpty() {
    activeResume = null;
    home.innerHTML = '<section class="overview-panel overview-empty"><h2>' + safe(t('dashboard.empty'))
      + '</h2><p>' + safe(t('dashboard.emptyText')) + '</p>'
      + '<a id="empty-create" class="btn btn-primary" href="/templates">' + safe(t('dashboard.choose')) + '</a>' + '</section>';
  }

  function renderError(result) {
    activeResume = null;
    if (result.status === 401) {
      home.innerHTML = '<section class="overview-panel overview-empty"><h2>' + safe(t('dashboard.authExpired'))
        + '</h2>' + button(t('common.signIn'), '/login', 'btn-primary') + '</section>';
      return;
    }
    home.innerHTML = '<section class="overview-panel overview-empty"><h2>' + safe(t('dashboard.unavailable'))
      + '</h2><p>' + safe(result.message || t('dashboard.loadError')) + '</p><button class="btn btn-primary" id="retry-load" type="button">'
      + safe(t('common.retry')) + '</button></section>';
    home.querySelector('#retry-load').addEventListener('click', () => loadData(true));
  }

  function renderSections(profile, completion) {
    const rows = (profile.sections || []).map(section => {
      const state = section.complete ? 'complete' : section.optional ? 'optional' : 'required';
      return '<li><a href="' + resumeUrl(profile.id, section.id) + '"><span>'
        + safe(t('section.' + section.id, section.label)) + '</span><span class="overview-section-state" data-state="' + state + '">'
        + safe(t('dashboard.' + state)) + '</span>' + icon('arrowRight') + '</a></li>';
    }).join('');
    return rows ? '<details class="overview-sections"><summary>' + safe(t('dashboard.sectionsAll')) + '</summary>'
      + '<p>' + safe(t('dashboard.completion')) + ' · ' + completion + '%</p><ul class="overview-section-list">' + rows + '</ul></details>' : '';
  }

  function renderReview(profile) {
    const url = resumeUrl(profile.id, 'references') + '&review=1';
    return '<section class="overview-writing"><h2>' + safe(t('dashboard.review')) + '</h2><p>' + safe(t('dashboard.reviewHelp'))
      + '</p><a class="text-link" href="' + url + '">' + safe(t('dashboard.reviewOpen')) + '</a></section>';
  }

  function renderProfile(profile) {
    activeResume = profile.id;
    Api.setResumeId(profile.id);
    const completion = Math.max(0, Math.min(100, Number(profile.completion) || 0));
    const label = profile.title || t('dashboard.untitled');
    const template = profile.template || {};
    const printable = /^[a-z]+$/.test(template.id);
    const next = (profile.sections || []).find(section => section.id === profile.nextSection && !section.complete);
    const nextLabel = next ? t('section.' + next.id, next.label) : '';
    const destination = resumeUrl(profile.id, profile.nextSection);
    resumeLink.href = destination;
    resumeLink.textContent = label;
    resumeLink.hidden = false;
    nextTask.hidden = library;
    nextTask.innerHTML = next ? '<h2>' + safe(t('dashboard.fieldNext')) + '</h2><p>' + safe(nextLabel)
      + '</p><a class="text-link" href="' + destination + '">' + safe(t('dashboard.continue')) + '</a>' : renderReview(profile);
    home.innerHTML = '<section class="overview-document overview-resume"><div class="overview-resume-copy">'
      + '<p class="overview-document-state">' + safe(t(next ? 'dashboard.resumeStatus' : 'dashboard.resumeReady')) + '</p>'
      + '<h2>' + safe(label) + '</h2><p class="overview-saved">' + safe(template.name || t('nav.resumes')) + ' · '
      + safe(t('dashboard.saved')) + ' ' + safe(formatDate(profile.updatedAt)) + '</p>'
      + '<div class="overview-actions">' + button(t('dashboard.continue'), destination, 'btn-primary')
      + '<button type="button" class="btn btn-secondary" id="open-resume-preview">' + safe(t('common.preview')) + '</button>'
      + '<button type="button" class="btn btn-secondary" id="download-resume">' + safe(t('common.download')) + '</button></div>'
      + '<p class="overview-error" role="alert" hidden></p></div>'
      + (printable ? '<figure class="overview-template"><img src="/img/templates/' + template.id + '-320.webp" width="320" height="453" alt="">'
        + '<figcaption>' + safe(t('dashboard.designExample')) + '</figcaption></figure>' : '') + '</section>'
      + (library ? '' : renderSections(profile, completion) + (next ? renderReview(profile) : ''));

    home.querySelector('#open-resume-preview').addEventListener('click', openPreview);
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

  async function openPreview() {
    if (!activeResume || preview.open) return;
    preview.showModal();
    await PdfPages.render(pdfPages, '/api/pdf/' + encodeURIComponent(activeResume) + '/document');
  }

  async function loadData(showLoading = false) {
    const revision = ++loadingRevision;
    if (showLoading) {
      renderedSummary = undefined;
      home.setAttribute('aria-busy', 'true');
      home.innerHTML = '<section class="overview-panel overview-skeleton"><p role="status">' + safe(t('dashboard.loading'))
        + '</p><div aria-hidden="true"><span></span><span></span><span></span></div></section>';
    }
    const [user, resume] = await Promise.all([Api.getMe(), Api.listResumes()]);
    if (revision !== loadingRevision) return;
    home.setAttribute('aria-busy', 'false');
    if (user.success) {
      ZeekeAccountMenu.init({userName: user.userName || t('nav.account'), initials: ZeekeAccountMenu.initialsFromUser(user.user)});
    }
    if (!resume.success) {
      renderedSummary = undefined;
      aiTokens.replaceChildren();
      documents.hidden = true;
      nextTask.hidden = true;
      candidate.hidden = true;
      renderError(resume);
      return;
    }
    if (!library && user.success && user.userName) {
      candidate.textContent = user.userName + ' · ';
      candidate.hidden = false;
    }
    documents.hidden = false;
    const letterCount = Math.max(0, Number(resume.coverLetterCount) || 0);
    document.getElementById('cover-letter-count').textContent = letterCount || '';
    document.getElementById('dashboard-letter-note').textContent = t(letterCount ? 'dashboard.letterSaved' : 'dashboard.letterEmpty');
    renderAiTokens(resume.ai);
    document.getElementById('dashboard-design-link').href = resume.profile
      ? resumeUrl(resume.profile.id, resume.profile.nextSection) + '&designs=1' : '/templates';
    const summary = JSON.stringify(resume.profile ?? null);
    if (summary === renderedSummary) return;
    renderedSummary = summary;
    const focused = home.contains(document.activeElement) ? document.activeElement.id : '';
    if (resume.profile) renderProfile(resume.profile);
    else {
      nextTask.hidden = true;
      resumeLink.hidden = true;
      renderEmpty();
    }
    if (focused) document.getElementById(focused)?.focus({preventScroll:true});
  }

  document.getElementById('dashboard-preview-close').addEventListener('click', () => preview.close());
  preview.addEventListener('click', event => { if (event.target === preview) preview.close(); });
  preview.addEventListener('close', () => {
    PdfPages.clear(pdfPages);
    document.getElementById('open-resume-preview')?.focus();
  });

  let liveReload;
  const updateDashboard = event => {
    if (event.detail?.topic && !['documents', 'profile', 'ai', 'feedback'].includes(event.detail.topic)) return;
    clearTimeout(liveReload);
    liveReload = setTimeout(loadData, 180);
  };
  window.addEventListener('regen:bonus-updated', async () => {
    const result = await Api.getAIStatus();
    if (result.success) renderAiTokens(result);
  });
  window.addEventListener('regen:live-change', updateDashboard);
  window.addEventListener('regen:reconcile', updateDashboard);
  window.addEventListener('pagehide', () => clearTimeout(liveReload));
  await loadData(true);
});
