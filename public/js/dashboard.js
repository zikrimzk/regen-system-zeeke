document.addEventListener('DOMContentLoaded', async () => {
  const home = document.getElementById('resume-home');
  const pageStatus = document.getElementById('dashboard-page-status');
  const previewModal = document.getElementById('dashboard-preview-modal');
  const previewFrame = document.getElementById('dashboard-preview-frame');
  const previewStage = document.getElementById('dashboard-preview-stage');
  const previewShell = document.getElementById('dashboard-preview-shell');
  const aiTokenCard = document.getElementById('dashboard-ai-token-card');
  let activeResumeId = null;
  let previewDocumentHeight = 1123;
  let previewLoadRevision = 0;
  const previewProtection = window.PreviewProtection?.register({
    iframe: previewFrame,
    container: previewStage,
    isActive: () => !previewModal?.classList.contains('hidden'),
  });

  function icon(name) {
    const paths = {
      edit: '<path d="M12 20h9"/><path d="m16.5 3.5 4 4L8 20H4v-4L16.5 3.5z"/>',
      download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
      arrow: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
      check: '<path d="m5 12 4 4L19 6"/>',
      clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="3"/>',
      retry: '<path d="M20 6v5h-5"/><path d="M19 11a7 7 0 1 0 1 5"/>',
      sparkles: '<path d="m12 3 1.2 3.3L16.5 7.5l-3.3 1.2L12 12l-1.2-3.3-3.3-1.2 3.3-1.2z"/><path d="m18.5 13 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
    };
    return `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || ''}</svg>`;
  }

  function safe(value) {
    return window.ZeekeSafe.attr(value || '');
  }

  function formatDate(value, { withTime = false } = {}) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Recently';
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    });
  }

  function resumeUrl(id, section = '') {
    const query = section ? `&section=${encodeURIComponent(section)}` : '';
    return `/builder?id=${encodeURIComponent(id)}${query}`;
  }

  function reviewUrl(id) {
    return `/builder?id=${encodeURIComponent(id)}&section=references&review=1`;
  }

  function renderAiTokens(ai = {}) {
    if (!aiTokenCard) return;
    const quota = ai.quota || {};
    const parsedLimit = Number(quota.limit);
    const parsedRemaining = Number(quota.remaining);
    const hasQuota = Number.isFinite(parsedLimit)
      && parsedLimit > 0
      && Number.isFinite(parsedRemaining);
    const limit = hasQuota ? Math.max(1, Math.floor(parsedLimit)) : 15;
    const remaining = hasQuota ? Math.max(0, Math.min(limit, Math.floor(parsedRemaining))) : null;
    const used = hasQuota ? Math.max(0, limit - remaining) : null;
    const percent = hasQuota ? Math.round((remaining / limit) * 100) : 0;
    const resetAt = quota.resetAt ? formatDate(quota.resetAt, { withTime: true }) : '';
    const reset = resetAt
      ? `Resets ${resetAt}`
      : 'The 24-hour limit starts when you use your first token.';
    const tokenNote = hasQuota
      ? `ReGen AI Tokens are app usage credits, not raw API tokens. 1 token is used per AI action. ${reset}`
      : 'Try again later.';
    const unavailable = ai.enabled === false;
    const showMeter = !unavailable && hasQuota;
    const state = unavailable ? 'Unavailable' : !hasQuota ? 'Usage unavailable' : remaining === 0 ? 'Limit reached' : 'Available';
    aiTokenCard.classList.toggle('has-meter', showMeter);
    aiTokenCard.classList.toggle('is-unavailable', !showMeter);
    aiTokenCard.innerHTML = `
      <div class="dashboard-ai-token-icon" aria-hidden="true">${icon('sparkles')}</div>
      <div class="dashboard-ai-token-copy">
        <p>ReGen AI Tokens</p>
        <h2>${unavailable
          ? 'ReGen AI assistance unavailable'
          : hasQuota
            ? `<strong>${remaining}</strong> of ${limit} remaining`
            : 'Usage details unavailable'}</h2>
        <span>${safe(unavailable ? 'Resume editing remains available.' : tokenNote)}</span>
      </div>
      ${showMeter ? `<div class="dashboard-ai-token-meter">
        <div class="dashboard-ai-token-state"><span>${safe(state)}</span><strong>${used} used</strong></div>
        <div class="dashboard-ai-token-track" role="progressbar" aria-label="ReGen AI Tokens remaining" aria-valuenow="${remaining}" aria-valuemin="0" aria-valuemax="${limit}"><span style="width:${percent}%"></span></div>
      </div>` : ''}`;
  }

  async function createOrOpen(button) {
    if (button) button.disabled = true;
    const result = await Api.createResume();
    if (result.success && result.data?.id) {
      window.location.href = resumeUrl(result.data.id);
      return;
    }
    if (button) button.disabled = false;
    renderError(result.message || 'Unable to create your resume.');
  }

  function renderEmpty() {
    if (pageStatus) pageStatus.textContent = 'No resume';
    home.innerHTML = `
      <section class="empty-state">
        <div class="empty-state-icon">CV</div>
        <h2 class="empty-state-title">No resume created</h2>
        <p class="empty-state-desc">Create a resume to begin entering your details.</p>
        <button type="button" class="btn btn-primary" id="empty-create">${icon('edit')} Create resume</button>
      </section>`;
    document.getElementById('empty-create')?.addEventListener('click', (event) => {
      createOrOpen(event.currentTarget);
    });
  }

  function renderError(message) {
    if (pageStatus) pageStatus.textContent = 'Unable to load';
    home.innerHTML = `
      <section class="empty-state">
        <div class="empty-state-icon">!</div>
        <h2 class="empty-state-title">Resume unavailable</h2>
        <p class="empty-state-desc">${safe(message)}</p>
        <button type="button" class="btn btn-primary" id="retry-load">${icon('retry')} Try again</button>
      </section>`;
    document.getElementById('retry-load')?.addEventListener('click', loadData);
  }

  function sectionRow(section, id) {
    const state = section.complete ? 'complete' : 'incomplete';
    const optional = section.optional ? ' optional' : '';
    const note = section.complete ? 'Complete' : (section.optional ? 'Optional' : 'Required');
    return `
      <a class="section-status ${state}${optional}" href="${resumeUrl(id, section.id)}">
        <span class="section-state-icon">${section.complete ? icon('check') : ''}</span>
        <span class="section-status-label">${safe(section.label)}</span>
        <span class="section-status-note">${note}</span>
        ${icon('arrow')}
      </a>`;
  }

  function reviewLevel(score) {
    if (score >= 85) return 'excellent';
    if (score >= 70) return 'strong';
    if (score >= 55) return 'developing';
    return 'attention';
  }

  function renderReview(review, id) {
    const score = Math.max(0, Math.min(100, Number(review?.score) || 0));
    const recommendations = Array.isArray(review?.recommendations)
      ? review.recommendations.slice(0, 3)
      : [];
    const priorities = recommendations.length
      ? recommendations
      : ['Tailor the role title and skill keywords before each application.'];
    const current = Boolean(review?.isCurrent);
    const reviewedAt = review?.reviewedAt ? formatDate(review.reviewedAt, { withTime: true }) : '';
    return `
      <section class="dashboard-panel regen-review-panel">
        <div class="panel-heading">
          <div>
            <h3>ATS review</h3>
            <p>Score and recommendations</p>
          </div>
          <span class="panel-count">${current ? 'Up to date' : 'Needs refresh'}</span>
        </div>
        <div class="regen-review-body">
          <div class="review-summary">
            <div class="review-score is-${reviewLevel(score)}" role="img" aria-label="ATS readiness ${score} out of 100">
              <strong>${score}</strong><span>/100</span>
            </div>
            <div class="review-copy">
              <h3>${safe(review?.label || 'ATS review')}</h3>
              <span class="review-state ${current ? '' : 'is-updated'}">
                ${current ? (review?.aiEnhanced ? 'ReGen AI-assisted review' : 'Based on your saved resume') : 'Resume changed since this review'}
              </span>
            </div>
          </div>
          <p class="review-comment">${safe(review?.comment || review?.summary || '')}</p>
          <ol class="review-priorities">
            ${priorities.map((item, index) => `
              <li class="review-priority"><span>${index + 1}</span><p>${safe(item)}</p></li>
            `).join('')}
          </ol>
          <div class="review-footer">
            <small>${reviewedAt ? `Last full review ${safe(reviewedAt)}` : 'Full review is saved after the final builder step.'}</small>
            <a class="review-link" href="${reviewUrl(id)}">Open full review ${icon('arrow')}</a>
          </div>
        </div>
      </section>`;
  }

  function renderProfile(profile) {
    const personal = profile.personal || {};
    const next = profile.sections?.find(section => section.id === profile.nextSection);
    const completedCount = (profile.sections || []).filter(section => section.complete).length;
    const review = profile.atsReview || {};
    activeResumeId = profile.id;
    Api.setResumeId(profile.id);
    if (pageStatus) pageStatus.textContent = `Last saved ${formatDate(profile.updatedAt)}`;

    home.innerHTML = `
      <section class="resume-command-card">
        <div class="resume-command-main">
          <div class="resume-document-mark" aria-hidden="true">CV</div>
          <div class="resume-command-copy">
            <h2>${safe(personal.fullName || profile.title || 'Untitled resume')}</h2>
            <p>${safe(personal.jobTitle || 'Target role not added')}</p>
            <div class="resume-updated">${icon('clock')} Saved ${safe(formatDate(profile.updatedAt, { withTime: true }))}</div>
          </div>
        </div>
        <div class="resume-command-actions">
          <a class="btn btn-primary" href="${resumeUrl(profile.id, profile.nextSection)}">${icon('edit')} Continue editing</a>
          <button type="button" class="btn btn-secondary" id="open-resume-preview" aria-label="Preview resume">
            ${icon('eye')} <span class="action-label">Preview</span>
          </button>
          <button type="button" class="btn btn-secondary" id="download-resume" aria-label="Download PDF">
            ${icon('download')} <span class="action-label">Download</span>
          </button>
        </div>
        <div class="resume-status-strip">
          <div class="resume-status-item">
            <span>Progress</span>
            <strong>${profile.completion}%</strong>
            <div class="command-progress" role="progressbar" aria-valuenow="${profile.completion}" aria-valuemin="0" aria-valuemax="100">
              <span style="width:${profile.completion}%"></span>
            </div>
          </div>
          <div class="resume-status-item">
            <span>ATS score</span>
            <strong>${Math.max(0, Math.min(100, Number(review.score) || 0))} / 100</strong>
          </div>
          <div class="resume-status-item">
            <span>${profile.completion === 100 ? 'Status' : 'Next section'}</span>
            <strong>${profile.completion === 100 ? 'Core sections complete' : safe(next?.label || 'Resume details')}</strong>
          </div>
        </div>
      </section>

      <div class="dashboard-grid">
        <div class="dashboard-stack">
          ${renderReview(review, profile.id)}
        </div>

        <section class="dashboard-panel sections-panel">
          <div class="panel-heading">
            <div><h3>Resume sections</h3><p>Select a section to edit</p></div>
            <span class="panel-count">${completedCount} / ${(profile.sections || []).length}</span>
          </div>
          <div class="sections-ledger">
            ${(profile.sections || []).map(section => sectionRow(section, profile.id)).join('')}
          </div>
        </section>
      </div>`;

    document.getElementById('open-resume-preview')?.addEventListener('click', openPreview);
    document.getElementById('download-resume')?.addEventListener('click', async (event) => {
      const result = await Api.downloadPdf(event.currentTarget, 'resume.pdf', profile.id);
      if (!result.success) alert(result.message || 'PDF download failed.');
    });
  }

  function fitPreview() {
    if (!previewStage || !previewShell || previewModal?.classList.contains('hidden')) return;
    const scale = Math.max(0.3, Math.min((previewStage.clientWidth - 30) / 794, 1));
    previewShell.style.setProperty('--dashboard-preview-scale', scale.toFixed(3));
    previewShell.style.setProperty('--dashboard-document-height', `${previewDocumentHeight}px`);
  }

  function syncPreviewHeight() {
    if (!previewFrame) return;
    try {
      const doc = previewFrame.contentDocument || previewFrame.contentWindow?.document;
      const measured = Math.max(
        doc?.documentElement?.scrollHeight || 0,
        doc?.body?.scrollHeight || 0,
        1123
      );
      previewDocumentHeight = Math.ceil(measured / 1123) * 1123;
    } catch (error) {
      previewDocumentHeight = 1123;
    }
    fitPreview();
  }

  async function openPreview() {
    if (!activeResumeId || !previewModal || !previewFrame || !window.PreviewProtection) return;
    const revision = ++previewLoadRevision;
    previewModal.classList.remove('hidden');
    document.body.classList.add('dashboard-preview-open');
    previewStage?.setAttribute('aria-busy', 'true');
    previewProtection?.obscure('Loading protected preview...');
    requestAnimationFrame(fitPreview);
    document.getElementById('dashboard-preview-close')?.focus();

    const url = `/api/pdf/${encodeURIComponent(activeResumeId)}/preview?t=${Date.now()}`;
    const result = await window.PreviewProtection.loadUrl(previewFrame, url, {
      shouldCommit: () => revision === previewLoadRevision,
    });
    if (revision !== previewLoadRevision || result.stale) return;
    previewStage?.removeAttribute('aria-busy');
    if (!result.success) {
      closePreview();
      alert(result.message || 'Preview is temporarily unavailable.');
      return;
    }
    previewProtection?.activate();
  }

  function closePreview() {
    if (!previewModal || !previewFrame) return;
    previewLoadRevision += 1;
    previewModal.classList.add('hidden');
    document.body.classList.remove('dashboard-preview-open');
    previewStage?.removeAttribute('aria-busy');
    previewProtection?.deactivate();
    previewFrame.removeAttribute('srcdoc');
    previewFrame.src = 'about:blank';
  }

  async function loadData() {
    if (pageStatus) pageStatus.textContent = 'Loading resume status...';
    home.innerHTML = '<div class="dashboard-loading"><div class="spinner"></div><p>Loading resume...</p></div>';
    const [userResult, resumeResult] = await Promise.all([Api.getMe(), Api.listResumes()]);
    if (userResult.success) {
      ZeekeAccountMenu.init({
        userName: userResult.userName || 'User',
        initials: ZeekeAccountMenu.initialsFromUser(userResult.user),
        photoBase64: '',
      });
    }
    if (!resumeResult.success) return renderError(resumeResult.message || 'Failed to load your resume.');
    renderAiTokens(resumeResult.ai || {});
    if (!resumeResult.profile) return renderEmpty();
    renderProfile(resumeResult.profile);
  }

  document.getElementById('dashboard-preview-close')?.addEventListener('click', closePreview);
  previewModal?.addEventListener('click', (event) => {
    if (event.target === previewModal) closePreview();
  });
  previewFrame?.addEventListener('load', syncPreviewHeight);
  window.addEventListener('resize', fitPreview, { passive: true });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !previewModal?.classList.contains('hidden')) closePreview();
  });
  await loadData();
});
