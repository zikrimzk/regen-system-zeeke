/**
 * preview.js - on-demand A4 resume preview with zoom controls.
 */
const Preview = (() => {
  let iframe;
  let modal;
  let shell;
  let hasLoaded = false;
  let zoom = 1;
  let draftTimer = null;
  let lastDraftPayload = '';

  const MIN_ZOOM = 0.3;
  const MAX_ZOOM = 1.4;
  const ZOOM_STEP = 0.1;
  const PAGE_HEIGHT = 1123;
  let documentHeight = PAGE_HEIGHT;

  function init() {
    iframe = document.getElementById('preview-iframe-modal');
    modal = document.getElementById('preview-modal');
    shell = document.getElementById('preview-page-shell');

    const closeBtn = document.getElementById('close-preview-modal');
    const openBtns = [document.getElementById('preview-open-top')].filter(Boolean);

    openBtns.forEach((btn) => btn.addEventListener('click', open));
    iframe?.addEventListener('load', syncFrameHeight);
    closeBtn?.addEventListener('click', close);
    document.getElementById('preview-zoom-out')?.addEventListener('click', () => setZoom(zoom - ZOOM_STEP));
    document.getElementById('preview-zoom-in')?.addEventListener('click', () => setZoom(zoom + ZOOM_STEP));
    document.getElementById('preview-zoom-fit')?.addEventListener('click', fitToStage);

    modal?.addEventListener('click', (e) => {
      if (e.target === modal) close();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal?.classList.contains('hidden')) close();
    });

    window.addEventListener('resize', () => {
      if (!modal?.classList.contains('hidden')) fitToStage();
    });
  }

  function open() {
    modal?.classList.remove('hidden');
    document.body.classList.add('preview-open');
    refreshNow({ force: true });
    if (typeof Stepper !== 'undefined' && typeof Stepper.getDraftResume === 'function') {
      renderDraft(Stepper.getDraftResume());
    }
    requestAnimationFrame(fitToStage);
  }

  function close() {
    modal?.classList.add('hidden');
    document.body.classList.remove('preview-open');
  }

  function setZoom(value) {
    zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number(value) || 1));
    if (shell) {
      shell.style.setProperty('--preview-zoom', zoom.toFixed(2));
      shell.style.marginBottom = `${documentHeight * (zoom - 1)}px`;
    }
  }

  function fitToStage() {
    const stage = document.querySelector('.preview-stage');
    if (!stage || !shell) return;

    const stageWidth = stage.clientWidth - 32;
    const stageHeight = stage.clientHeight - 32;
    const pageWidth = 794;
    const pageHeight = 1123;
    const fit = Math.min(stageWidth / pageWidth, stageHeight / pageHeight, 1);
    setZoom(fit);
  }

  function refreshNow({ force = false } = {}) {
    if (!iframe) return;
    const url = Api.previewUrl();
    const nextUrl = `${url}?t=${Date.now()}`;
    if (force || !hasLoaded || !iframe.src.includes(url)) {
      iframe.removeAttribute('srcdoc');
      iframe.src = nextUrl;
      hasLoaded = true;
    } else if (!modal?.classList.contains('hidden')) {
      iframe.removeAttribute('srcdoc');
      iframe.src = nextUrl;
    }
  }

  function syncFrameHeight() {
    if (!iframe || !shell) return;
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      const measured = Math.max(
        doc?.documentElement?.scrollHeight || 0,
        doc?.body?.scrollHeight || 0,
        PAGE_HEIGHT
      );
      const pageAlignedHeight = Math.ceil(measured / PAGE_HEIGHT) * PAGE_HEIGHT;
      documentHeight = pageAlignedHeight;
      shell.style.setProperty('--preview-doc-height', `${pageAlignedHeight}px`);
      iframe.style.height = `${pageAlignedHeight}px`;
      shell.style.marginBottom = `${documentHeight * (zoom - 1)}px`;
    } catch (err) {
      documentHeight = PAGE_HEIGHT;
    }
  }

  function renderDraft(resumeData) {
    if (!iframe || modal?.classList.contains('hidden')) return;

    const payload = JSON.stringify(resumeData || {});
    if (payload === lastDraftPayload) return;
    lastDraftPayload = payload;

    clearTimeout(draftTimer);
    draftTimer = setTimeout(async () => {
      const res = await Api.previewDraft(resumeData);
      if (!res.success) return;
      iframe.removeAttribute('src');
      iframe.srcdoc = res.html;
      hasLoaded = true;
      requestAnimationFrame(() => {
        syncFrameHeight();
        fitToStage();
      });
    }, 220);
  }

  return { init, refreshNow, renderDraft, open, close };
})();
