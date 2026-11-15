/* Presentation of the existing section editor and saved document preview. */
const Studio = (() => {
  const t = (key, fallback) => ReGenText.get('studio.' + key, fallback);

  function init(title, templateId) {
    document.getElementById('studio-document-title').textContent = title || t('title', 'Resume Studio');
    const pane = document.getElementById('studio-preview');
    const status = document.getElementById('studio-preview-status');
    const pages = document.getElementById('studio-pdf-pages');
    const sample = document.getElementById('studio-preview-sample');
    const refresh = document.getElementById('studio-preview-refresh');
    const save = document.getElementById('studio-save');
    const bar = document.querySelector('.studio-command-bar');
    const layout = document.querySelector('.builder-layout');
    const toggle = document.createElement('button');
    const wide = matchMedia('(min-width: 1200px)');
    let viewed = false;
    let outdated = false;
    let pending = false;
    const showSample = id => {
      templateId = id;
      if (!wide.matches || !/^[a-z]+$/.test(id)) return;
      const image = sample.querySelector('img');
      image.src = '/img/templates/' + id + '-320.webp';
      image.hidden = false;
    };

    function updateStatus() {
      const locked = window.ReGenTokens?.getPrice('document_preview')?.hiddenByPackage;
      const message = locked ? t('previewRestricted', 'This preview follows your account’s document access.')
        : !viewed ? t('previewExample', 'Template example. Load your saved document when you need it.') : Stepper.hasUnsavedChanges()
        ? t('draftAhead', 'Preview shows the last saved version.')
        : outdated ? t('previewStale', 'Saved version changed. Refresh to see it here.')
          : t('previewHelp', 'See the last saved version here. Open Preview to check your current draft.');
      if (status.textContent !== message) status.textContent = message;
    }

    async function loadSavedPreview() {
      if (!wide.matches || pane.hidden || refresh.disabled) return;
      const price = window.ReGenTokens?.getPrice('document_preview');
      if (price?.hiddenByPackage) return;
      viewed = true;
      outdated = false;
      refresh.disabled = true;
      try {
        sample.hidden = true;
        pages.hidden = false;
        await PdfPages.render(pages, Api.documentUrl());
      } finally {
        refresh.disabled = false;
        updateStatus();
      }
    }

    function clearPreview() {
      viewed = false;
      outdated = false;
      PdfPages.clear(pages);
      pages.hidden = true;
      sample.hidden = false;
      updateStatus();
    }

    toggle.type = 'button';
    toggle.className = 'btn btn-secondary studio-panel-toggle';
    toggle.setAttribute('aria-controls', 'studio-preview');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.textContent = t('hidePreview', 'Hide preview panel');
    bar.querySelector('.studio-commands').prepend(toggle);
    toggle.onclick = () => {
      const hidden = !pane.hidden;
      pane.hidden = hidden;
      layout.classList.toggle('studio-panel-hidden', hidden);
      toggle.setAttribute('aria-expanded', String(!hidden));
      toggle.textContent = hidden ? t('showPreview', 'Show preview panel') : t('hidePreview', 'Hide preview panel');
      if (hidden) clearPreview();
    };
    wide.addEventListener('change', event => { if (event.matches) showSample(templateId); else clearPreview(); });
    refresh.addEventListener('click', loadSavedPreview);
    document.getElementById('studio-review').addEventListener('click', async () => {
      if (pending) return;
      pending = true;
      try { await Stepper.review(); } finally { pending = false; }
    });
    save.addEventListener('click', () => Stepper.saveCurrentStep());
    document.addEventListener('regen:studio-save-state', event => {
      save.disabled = ['saving', 'saved'].includes(event.detail.state);
      updateStatus();
    });
    window.addEventListener('regen:prices-updated', updateStatus);
    window.addEventListener('regen:session-expired', clearPreview);
    document.addEventListener('regen:studio-saved-content', () => { outdated = viewed; updateStatus(); });
    document.addEventListener('regen:template-changed', event => {
      showSample(event.detail.id);
      outdated = viewed;
      updateStatus();
    });
    document.addEventListener('regen:writing-settings-changed', () => { outdated = viewed; updateStatus(); });
    document.addEventListener('regen:studio-review', clearPreview);
    showSample(templateId);
    updateStatus();
  }

  return {init};
})();
