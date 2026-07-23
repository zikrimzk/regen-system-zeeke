document.addEventListener('DOMContentLoaded', async () => {
  const home = document.getElementById('resume-home');
  const openButton = document.getElementById('btn-create-resume');
  let dashboardZoom = 0.65;
  let dashboardDocumentHeight = 1123;
  let dashboardFitMode = true;
  let fallbackFullscreen = false;

  function icon(name) {
    const paths = {
      edit: '<path d="M12 20h9"/><path d="m16.5 3.5 4 4L8 20H4v-4L16.5 3.5z"/>',
      download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
      arrow: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
      check: '<path d="m5 12 4 4L19 6"/>',
      user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
      mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
      phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.8a2 2 0 0 1-.4 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
      pin: '<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0z"/><circle cx="12" cy="10" r="2"/>',
      clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      zoomOut: '<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/><path d="M7 10h6"/>',
      zoomIn: '<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/><path d="M10 7v6"/><path d="M7 10h6"/>',
      fit: '<path d="M4 5v14"/><path d="M20 5v14"/><path d="M8 12h8"/><path d="m10 9-3 3 3 3"/><path d="m14 9 3 3-3 3"/>',
      fullscreen: '<path d="M8 3H3v5"/><path d="M16 3h5v5"/><path d="M8 21H3v-5"/><path d="M16 21h5v-5"/>',
      fullscreenExit: '<path d="M3 8h5V3"/><path d="M21 8h-5V3"/><path d="M3 16h5v5"/><path d="M21 16h-5v5"/>',
      retry: '<path d="M20 6v5h-5"/><path d="M19 11a7 7 0 1 0 1 5"/>',
    };
    return `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || ''}</svg>`;
  }

  function safe(value) {
    return window.ZeekeSafe.attr(value || '');
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Recently';
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function resumeUrl(id, section = '') {
    const query = section ? `&section=${encodeURIComponent(section)}` : '';
    return `/builder?id=${encodeURIComponent(id)}${query}`;
  }

  function setOpenAction(id, section = '') {
    if (!openButton) return;
    openButton.disabled = false;
    openButton.innerHTML = `${icon('edit')}<span>Open Editor</span>`;
    openButton.onclick = () => { window.location.href = resumeUrl(id, section); };
  }

  async function createOrOpen() {
    if (openButton) openButton.disabled = true;
    const result = await Api.createResume();
    if (result.success && result.data?.id) window.location.href = resumeUrl(result.data.id);
    else {
      if (openButton) openButton.disabled = false;
      renderError(result.message || 'Unable to open your resume.');
    }
  }

  function renderEmpty() {
    home.innerHTML = `
      <section class="empty-state">
        <div class="empty-state-icon">CV</div>
        <h2 class="empty-state-title">Create your resume profile</h2>
        <p class="empty-state-desc">Create and maintain one resume for this account.</p>
        <button type="button" class="btn btn-primary" id="empty-create">${icon('edit')} Start Resume</button>
      </section>`;
    document.getElementById('empty-create')?.addEventListener('click', createOrOpen);
  }

  function renderError(message) {
    home.innerHTML = `
      <section class="empty-state">
        <div class="empty-state-icon">!</div>
        <h2 class="empty-state-title">Unable to load your resume</h2>
        <p class="empty-state-desc">${safe(message)}</p>
        <button type="button" class="btn btn-primary" id="retry-load">${icon('retry')} Try Again</button>
      </section>`;
    document.getElementById('retry-load')?.addEventListener('click', loadData);
  }

  function contactRow(iconName, value) {
    if (!value) return '';
    return `<div class="profile-contact">${icon(iconName)}<span>${safe(value)}</span></div>`;
  }

  function sectionRow(section, id) {
    const state = section.complete ? 'complete' : 'incomplete';
    const note = section.complete ? 'Added' : (section.optional ? 'Optional' : 'Needs attention');
    return `
      <a class="section-status ${state}" href="${resumeUrl(id, section.id)}">
        <span class="section-state-icon">${section.complete ? icon('check') : ''}</span>
        <span class="section-status-label">${safe(section.label)}</span>
        <span class="section-status-note">${note}</span>
        ${icon('arrow')}
      </a>`;
  }

  function renderProfile(profile, photoBase64) {
    const personal = profile.personal || {};
    const initials = (personal.fullName || 'Resume').split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase();
    const next = profile.sections?.find(section => section.id === profile.nextSection);
    setOpenAction(profile.id, profile.nextSection);

    home.innerHTML = `
      <section class="profile-overview">
        <div class="profile-identity">
          <div class="profile-photo" id="profile-photo">${safe(initials)}</div>
          <div class="profile-copy">
            <h2>${safe(personal.fullName || 'Your Name')}</h2>
            <p>${safe(personal.jobTitle || 'Add your job title')}</p>
            <div class="profile-updated">${icon('clock')} Last updated ${safe(formatDate(profile.updatedAt))}</div>
          </div>
        </div>
        <div class="profile-actions">
          <a class="btn btn-primary" href="${resumeUrl(profile.id, profile.nextSection)}">${icon('edit')} Open Editor</a>
          <button type="button" class="btn btn-secondary" id="profile-download">${icon('download')} Download PDF</button>
        </div>
      </section>

      <div class="resume-home-grid">
        <section class="resume-preview-panel" aria-label="Resume preview">
          <div class="panel-heading">
            <div>
              <h3>Resume Preview</h3>
              <p>Latest saved version</p>
            </div>
            <div class="dashboard-preview-actions">
              <div class="dashboard-zoom-controls" aria-label="Resume preview controls">
                <button type="button" class="btn btn-secondary btn-sm btn-icon" id="dashboard-zoom-out" aria-label="Zoom out" title="Zoom out">${icon('zoomOut')}</button>
                <button type="button" class="btn btn-secondary btn-sm btn-icon" id="dashboard-zoom-fit" aria-label="Fit preview width" title="Fit preview width">${icon('fit')}</button>
                <button type="button" class="btn btn-secondary btn-sm btn-icon" id="dashboard-zoom-in" aria-label="Zoom in" title="Zoom in">${icon('zoomIn')}</button>
                <button type="button" class="btn btn-secondary btn-sm btn-icon" id="dashboard-fullscreen" aria-label="Enter fullscreen preview" title="Enter fullscreen preview">${icon('fullscreen')}</button>
                <span class="dashboard-zoom-value" id="dashboard-zoom-value" aria-live="polite"></span>
              </div>
              <a href="${resumeUrl(profile.id)}" class="btn btn-ghost btn-sm btn-icon" aria-label="Open editor" title="Open editor">${icon('edit')}</a>
            </div>
          </div>
          <div class="dashboard-preview-stage" id="dashboard-preview-stage">
            <div class="dashboard-preview-shell" id="dashboard-preview-shell">
              <iframe id="dashboard-preview-frame" src="/api/pdf/${encodeURIComponent(profile.id)}/preview?t=${Date.now()}" title="Saved resume preview"></iframe>
            </div>
          </div>
        </section>

        <aside class="resume-profile-sidebar">
          <section class="progress-panel">
            <div class="progress-heading">
              <div>
                <h3>Profile Completion</h3>
                <p>${profile.completion === 100 ? 'Required sections complete' : `Next: ${safe(next?.label || 'resume details')}`}</p>
              </div>
              <strong>${profile.completion}%</strong>
            </div>
            <div class="profile-progress" role="progressbar" aria-valuenow="${profile.completion}" aria-valuemin="0" aria-valuemax="100">
              <span style="width:${profile.completion}%"></span>
            </div>
            ${profile.completion < 100 ? `<a class="continue-link" href="${resumeUrl(profile.id, profile.nextSection)}">Continue with ${safe(next?.label || 'resume')} ${icon('arrow')}</a>` : ''}
          </section>

          <section class="contact-panel">
            <div class="panel-heading compact"><h3>Contact Details</h3></div>
            <div class="profile-contacts">
              ${contactRow('mail', personal.email)}
              ${contactRow('phone', personal.phone)}
              ${contactRow('pin', personal.address)}
              ${!personal.email && !personal.phone && !personal.address ? '<p class="panel-empty">Add your contact details in Personal Information.</p>' : ''}
            </div>
          </section>

          <section class="sections-panel">
            <div class="panel-heading compact"><h3>Resume Sections</h3></div>
            <div class="section-status-list">
              ${(profile.sections || []).map(section => sectionRow(section, profile.id)).join('')}
            </div>
          </section>
        </aside>
      </div>`;

    const photo = document.getElementById('profile-photo');
    if (photoBase64 && photo) {
      photo.textContent = '';
      photo.style.backgroundImage = `url("${photoBase64}")`;
      photo.classList.add('has-image');
    }

    document.getElementById('profile-download')?.addEventListener('click', async (event) => {
      const result = await Api.downloadPdf(event.currentTarget, 'resume.pdf', profile.id);
      if (!result.success) alert(result.message || 'PDF download failed.');
    });
    document.getElementById('dashboard-zoom-out')?.addEventListener('click', () => {
      dashboardFitMode = false;
      setPreviewZoom(dashboardZoom - 0.1);
    });
    document.getElementById('dashboard-zoom-in')?.addEventListener('click', () => {
      dashboardFitMode = false;
      setPreviewZoom(dashboardZoom + 0.1);
    });
    document.getElementById('dashboard-zoom-fit')?.addEventListener('click', fitPreview);
    document.getElementById('dashboard-fullscreen')?.addEventListener('click', toggleFullscreen);
    document.getElementById('dashboard-preview-frame')?.addEventListener('load', syncPreviewHeight);
    fitPreview();
    window.addEventListener('resize', () => {
      if (dashboardFitMode) fitPreview();
    }, { passive: true });
  }

  function setPreviewZoom(value) {
    const shell = document.getElementById('dashboard-preview-shell');
    if (!shell) return;
    dashboardZoom = Math.min(1.3, Math.max(0.32, Number(value) || 0.65));
    shell.style.setProperty('--dashboard-preview-scale', dashboardZoom.toFixed(3));
    shell.style.width = `${794 * dashboardZoom}px`;
    shell.style.height = `${dashboardDocumentHeight * dashboardZoom}px`;
    const valueLabel = document.getElementById('dashboard-zoom-value');
    if (valueLabel) valueLabel.textContent = `${Math.round(dashboardZoom * 100)}%`;
    const zoomOut = document.getElementById('dashboard-zoom-out');
    const zoomIn = document.getElementById('dashboard-zoom-in');
    if (zoomOut) zoomOut.disabled = dashboardZoom <= 0.32;
    if (zoomIn) zoomIn.disabled = dashboardZoom >= 1.3;
  }

  function fitPreview() {
    const stage = document.getElementById('dashboard-preview-stage');
    if (!stage) return;
    dashboardFitMode = true;
    setPreviewZoom(Math.min((stage.clientWidth - 36) / 794, 1));
  }

  async function toggleFullscreen() {
    const panel = document.querySelector('.resume-preview-panel');
    if (!panel) return;

    if (document.fullscreenElement === panel) {
      try {
        await document.exitFullscreen();
      } catch (err) {
        // The fullscreenchange event keeps the control synchronized when supported.
      }
      return;
    }

    if (fallbackFullscreen) {
      fallbackFullscreen = false;
      syncFullscreenState();
      return;
    }

    if (typeof panel.requestFullscreen === 'function') {
      try {
        await panel.requestFullscreen();
        return;
      } catch (err) {
        // Browsers can reject native fullscreen; use the in-page fallback below.
      }
    }

    fallbackFullscreen = true;
    syncFullscreenState();
  }

  function syncFullscreenState() {
    const panel = document.querySelector('.resume-preview-panel');
    const button = document.getElementById('dashboard-fullscreen');
    if (!panel || !button) return;

    const active = document.fullscreenElement === panel || fallbackFullscreen;
    panel.classList.toggle('is-fullscreen', fallbackFullscreen);
    document.body.classList.toggle('dashboard-preview-fullscreen', active);
    button.innerHTML = icon(active ? 'fullscreenExit' : 'fullscreen');
    button.setAttribute('aria-label', active ? 'Exit fullscreen preview' : 'Enter fullscreen preview');
    button.title = active ? 'Exit fullscreen preview' : 'Enter fullscreen preview';
    requestAnimationFrame(fitPreview);
  }

  function syncPreviewHeight() {
    const frame = document.getElementById('dashboard-preview-frame');
    if (!frame) return;
    try {
      const doc = frame.contentDocument || frame.contentWindow?.document;
      const measured = Math.max(
        doc?.documentElement?.scrollHeight || 0,
        doc?.body?.scrollHeight || 0,
        1123
      );
      dashboardDocumentHeight = Math.ceil(measured / 1123) * 1123;
      frame.style.height = `${dashboardDocumentHeight}px`;
      setPreviewZoom(dashboardZoom);
    } catch (err) {
      dashboardDocumentHeight = 1123;
    }
  }

  async function loadData() {
    home.innerHTML = '<div class="dashboard-loading"><div class="spinner"></div><p>Loading your resume...</p></div>';
    const [userResult, resumeResult] = await Promise.all([Api.getMe(), Api.listResumes()]);
    if (userResult.success) {
      ZeekeAccountMenu.init({
        userName: userResult.userName || 'User',
        initials: ZeekeAccountMenu.initialsFromUser(userResult.user),
        photoBase64: resumeResult.profilePhotoBase64 || '',
      });
    }
    if (!resumeResult.success) return renderError(resumeResult.message || 'Failed to load your resume.');
    if (!resumeResult.profile) return renderEmpty();
    renderProfile(resumeResult.profile, resumeResult.profilePhotoBase64 || '');
  }

  document.addEventListener('fullscreenchange', syncFullscreenState);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && fallbackFullscreen) {
      fallbackFullscreen = false;
      syncFullscreenState();
    }
  });
  if (openButton) openButton.onclick = createOrOpen;
  await loadData();
});
