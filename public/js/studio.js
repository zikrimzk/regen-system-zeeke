/* Resume commands and the live PDF canvas. */
const Studio = (() => {
  const t = key => ReGenText.get('studio.' + key);

  function init(title, templateId) {
    const titleElement = document.getElementById('studio-document-title');
    titleElement.textContent = title || ReGenText.get('dashboard.untitled');
    bindRename(titleElement);
    const pane = document.getElementById('studio-preview');
    const pages = document.getElementById('studio-pdf-pages');
    const status = document.getElementById('studio-preview-status');
    const sample = document.getElementById('studio-preview-sample');
    const proof = LiveDocumentPreview.create(pages, Api.documentDraft);
    const showPdf = document.getElementById('studio-preview-refresh');
    const save = document.getElementById('studio-save');
    const layout = document.querySelector('.builder-layout');
    const toggle = document.createElement('button');
    const wide = matchMedia('(min-width: 1200px)');
    let pending = false, signedIn = true;
    const structure = document.getElementById('studio-structure-toggle');
    let compactSections = false;
    try { compactSections = localStorage.getItem('regen-resume-sections-collapsed') === '1'; } catch {}
    function updateStructure() {
      layout.classList.toggle('structure-compact', compactSections);
      structure.setAttribute('aria-expanded', String(!compactSections));
    }
    structure.addEventListener('click', () => {
      compactSections = !compactSections;
      updateStructure();
      try { localStorage.setItem('regen-resume-sections-collapsed', compactSections ? '1' : '0'); } catch {}
    });
    updateStructure();

    function updatePreview(immediate = false, draft = Stepper.getDraftResume()) {
      if (!wide.matches || pane.hidden || document.body.classList.contains('studio-focus-mode')
        || layout.querySelector('.builder-left.is-final')) return;
      const available = signedIn && LiveDocumentPreview.allowed();
      status.hidden = available;
      status.textContent = available ? '' : t('previewRestricted');
      sample.hidden = available || !signedIn;
      pages.hidden = !available;
      if (!available) {
        proof.clear();
        if (!sample.hidden && /^[a-z]+$/.test(templateId)) {
          const image = sample.querySelector('img');
          image.src = '/img/templates/' + templateId + '-320.webp';
          image.hidden = false;
        }
      } else {
        proof.update(draft, {immediate});
      }
    }

    toggle.type = 'button';
    toggle.className = 'studio-icon studio-panel-toggle';
    toggle.setAttribute('aria-controls', 'studio-preview');
    toggle.innerHTML = ReGenIcons.icon('previewPane');
    document.querySelector('.studio-commands').prepend(toggle);
    function setPanel(hidden) {
      pane.hidden = hidden;
      layout.classList.toggle('studio-panel-hidden', hidden);
      toggle.setAttribute('aria-expanded', String(!hidden));
      toggle.title = t(hidden ? 'showPreview' : 'hidePreview');
      toggle.setAttribute('aria-label', toggle.title);
      if (hidden) proof.clear();
      else updatePreview(true);
    }
    let folded = false;
    try { folded = localStorage.getItem('regen-resume-preview-collapsed') === '1'; } catch {}
    setPanel(folded);
    toggle.onclick = () => {
      setPanel(!pane.hidden);
      try { localStorage.setItem('regen-resume-preview-collapsed', pane.hidden ? '1' : '0'); } catch {}
    };
    wide.addEventListener('change', event => { if (event.matches) updatePreview(true); else proof.clear(); });
    showPdf.addEventListener('click', () => Preview.open());
    document.getElementById('studio-review').addEventListener('click', async () => {
      if (pending) return;
      pending = true;
      try { await Stepper.review(); } finally { pending = false; }
    });
    save.addEventListener('click', () => Stepper.saveCurrentStep());
    document.addEventListener('regen:studio-save-state', event => {
      save.disabled = ['saving', 'saved'].includes(event.detail.state);
    });
    for (const event of ['regen:prices-updated', 'regen:preview-availability', 'online']) {
      window.addEventListener(event, () => updatePreview(true));
    }
    window.addEventListener('regen:session-expired', () => { signedIn = false; proof.clear(); updatePreview(); });
    window.addEventListener('regen:session-restored', () => { signedIn = true; updatePreview(true); });
    document.addEventListener('regen:studio-draft', event => updatePreview(false, event.detail));
    document.addEventListener('regen:template-changed', event => {
      templateId = event.detail.id;
      updatePreview(true);
    });
    document.addEventListener('regen:writing-settings-changed', () => updatePreview(true));
    document.addEventListener('regen:studio-review', () => proof.clear());
    document.addEventListener('regen:studio-focus', event => {
      if (event.detail.active) proof.clear();
      else updatePreview(true);
    });
    updatePreview(true);
  }

  function bindRename(title) {
    const button = document.getElementById('resume-rename');
    const dialog = document.getElementById('resume-rename-dialog');
    const form = dialog.querySelector('form');
    const input = form.elements.title;
    const submit = form.querySelector('[type="submit"]');
    const message = form.querySelector('[role="alert"]');
    const allowance = form.querySelector('.studio-rename-allowance');
    function showAllowance() {
      const price = window.ReGenTokens?.getPrice('resume_rename');
      button.toggleAttribute('data-package-hidden', price?.hiddenByPackage === true);
      let description = '';
      if (price && !price.packageUnlocked) {
        if (price.packageUses > 0) description = t('renamePackageUses').replace('{count}', price.packageUses);
        else if (price.mode === 'package_only') description = t(price.packageIncluded ? 'renameLimit' : 'renameAccess');
        else if (price.credits > 0) description = t('renamePrepaidUses').replace('{count}', price.credits);
        else if (price.cost > 0 && !price.unlocked) description = t('renamePrice').replace('{count}', price.cost);
      }
      allowance.textContent = description;
      allowance.hidden = !description;
    }
    window.addEventListener('regen:prices-updated', showAllowance);
    showAllowance();
    button.addEventListener('click', () => {
      input.value = title.textContent;
      message.textContent = '';
      showAllowance();
      dialog.showModal();
      input.select();
    });
    dialog.querySelector('[data-close]').onclick = () => dialog.close();
    dialog.addEventListener('cancel', event => { if (submit.disabled) event.preventDefault(); });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const next = input.value.trim();
      if (!next) { message.textContent = t('titleRequired'); return; }
      if (next === title.textContent) { dialog.close(); return; }
      submit.disabled = true;
      dialog.querySelector('[data-close]').disabled = true;
      try {
        const result = await Api.renameResume(Api.getResumeId(), next);
        if (!result.success) {
          if (!result.handled) message.textContent = result.message || t('renameFailed');
          return;
        }
        title.textContent = result.title || next;
        dialog.close();
        window.ReGenTokens?.refresh();
      } finally {
        submit.disabled = false;
        dialog.querySelector('[data-close]').disabled = false;
      }
    });
    dialog.addEventListener('close', () => button.focus({preventScroll:true}));
  }

  return {init};
})();
