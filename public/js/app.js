/**
 * app.js - ReGen builder bootstrap
 */
const App = (() => {

  // ── Toast notifications ───────────────────────────────────────
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.setAttribute('role', 'status');
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3100);
  }

  // ── Page loader ───────────────────────────────────────────────
  function showLoader(text = 'Saving...') {
    const loader = document.getElementById('page-loader');
    const p = loader?.querySelector('p');
    if (p) p.textContent = text;
    loader?.classList.add('active');
  }

  function hideLoader() {
    document.getElementById('page-loader')?.classList.remove('active');
  }

  // ── Final Screen ──────────────────────────────────────────────
  function showFinalScreen() {
    const content = document.getElementById('step-content');
    const navBar  = document.querySelector('.nav-bar');
    const stepperWrap = document.getElementById('stepper-wrap');

    if (stepperWrap) stepperWrap.classList.add('hidden');
    if (navBar)  navBar.classList.add('hidden');

    if (content) {
      const previewSrc = `${Api.previewUrl()}?t=${Date.now()}`;
      content.innerHTML = `
        <div class="final-screen" role="main">
          <div class="final-layout">
            <div class="final-panel">
              <div class="final-icon">
                <svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
              </div>
              <div>
                <h2 class="final-title">Resume Ready</h2>
                <p class="text-muted mt-sm">
                  Review the final A4 layout before downloading your PDF.
                </p>
              </div>
              <div class="final-actions mt-md">
                <button type="button" class="btn btn-primary btn-lg w-full" id="btn-download-pdf">
                  <svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>
                  Download PDF
                </button>
                <div style="display:flex;gap:var(--sp-sm);margin-top:var(--sp-md);">
                  <button type="button" class="btn btn-ghost flex-1" id="btn-back-to-edit">
                    <svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18 9 12l6-6"/></svg>
                    Back to Edit
                  </button>
                  <a href="/dashboard" class="btn btn-ghost flex-1">
                    <svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h7v7H4z"/><path d="M13 4h7v7h-7z"/><path d="M4 13h7v7H4z"/><path d="M13 13h7v7h-7z"/></svg>
                    Dashboard
                  </a>
                </div>
              </div>
            </div>
            <div class="final-preview-card">
              <div class="final-preview-header">Final Resume Preview</div>
              <div class="final-preview-stage">
                <div class="final-preview-page-shell" id="final-preview-page-shell">
                  <iframe class="final-preview-frame" src="${previewSrc}" title="Final Resume Preview"></iframe>
                </div>
              </div>
            </div>
          </div>
        </div>`;

      document.getElementById('btn-download-pdf')?.addEventListener('click', async (e) => {
        const res = await Api.downloadPdf(e.currentTarget);
        if (!res.success) App.showToast(res.message || 'PDF download failed.', 'error');
      });

      document.getElementById('btn-back-to-edit')?.addEventListener('click', async () => {
        if (stepperWrap) stepperWrap.classList.remove('hidden');
        if (navBar) navBar.classList.remove('hidden');
        await Stepper.back();
      });

      document.querySelector('.final-preview-frame')?.addEventListener('load', syncFinalPreviewHeight);
      requestAnimationFrame(() => {
        syncFinalPreviewHeight();
        fitFinalPreview();
      });
      setTimeout(syncFinalPreviewHeight, 350);
    }

    Preview.refreshNow();
  }

  function syncFinalPreviewHeight() {
    const iframe = document.querySelector('.final-preview-frame');
    const shell = document.getElementById('final-preview-page-shell');
    if (!iframe || !shell) return;

    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      const pageHeight = 1123;
      const measured = Math.max(
        doc?.documentElement?.scrollHeight || 0,
        doc?.body?.scrollHeight || 0,
        pageHeight
      );
      const pageAlignedHeight = Math.ceil(measured / pageHeight) * pageHeight;
      shell.style.setProperty('--final-preview-doc-height', `${pageAlignedHeight}px`);
      iframe.style.height = `${pageAlignedHeight}px`;
    } catch (err) {
      // Keep the default one-page preview height if the iframe cannot be measured.
    }
    fitFinalPreview();
  }

  function fitFinalPreview() {
    const stage = document.querySelector('.final-preview-stage');
    const shell = document.getElementById('final-preview-page-shell');
    if (!stage || !shell) return;

    const fit = Math.min((stage.clientWidth - 32) / 794, 1);
    const zoom = Math.max(0.3, fit);
    const docHeight = parseFloat(getComputedStyle(shell).getPropertyValue('--final-preview-doc-height')) || 1123;
    shell.style.setProperty('--final-preview-zoom', zoom.toFixed(2));
    shell.style.marginBottom = `${docHeight * (zoom - 1)}px`;
  }

  // ── Bootstrap ─────────────────────────────────────────────────
  async function init() {
    const params = new URLSearchParams(window.location.search);
    let id = params.get('id');
    
    if (!id) {
      showLoader('Opening your resume...');
      const resume = await Api.createResume();
      hideLoader();
      if (resume.success && resume.data?.id) {
        window.location.replace(`/builder?id=${encodeURIComponent(resume.data.id)}`);
      } else {
        App.showToast(resume.message || 'Unable to open resume.', 'error');
        window.location.href = '/dashboard';
      }
      return;
    }

    Api.setResumeId(id);
    Preview.init();
    window.addEventListener('resize', fitFinalPreview, { passive: true });

    const userResPromise = Api.getMe();

    // Fetch existing data
    showLoader('Loading resume...');
    const res = await Api.getResume();
    hideLoader();

    if (!res.success) {
      alert('Resume not found or access denied.');
      window.location.href = '/dashboard';
      return;
    }

    const resumeData = res.data || {};
    const userRes = await userResPromise;
    if (userRes.success) {
      ZeekeAccountMenu.init({
        userName: userRes.userName || 'User',
        initials: ZeekeAccountMenu.initialsFromUser(userRes.user),
        photoBase64: resumeData.personal?.photoBase64 || '',
      });
    }
    await Stepper.init(resumeData);

    // Back / Next nav
    document.getElementById('btn-back')?.addEventListener('click', () => Stepper.back());
    document.getElementById('btn-next')?.addEventListener('click', () => Stepper.next());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { showFinalScreen, showToast, showLoader, hideLoader };
})();
