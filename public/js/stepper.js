/* EDITOR STATE, SAVING AND SECTION NAVIGATION */
const Stepper = (() => {
  const steps = [
    {id:'personal',label:'Personal',module:PersonalSection},
    {id:'summary',label:'Profile',module:SummarySection},
    {id:'education',label:'Education',module:EducationSection},
    {id:'experience',label:'Experience',module:ExperienceSection},
    {id:'projects',label:'Projects',module:ProjectsSection},
    {id:'extracurricular',label:'Activities',module:ExtracurricularSection},
    {id:'skills',label:'Skills',module:SkillsSection},
    {id:'achievements',label:'Achievements',module:AchievementsSection},
    {id:'certifications',label:'Certifications',module:CertificationsSection},
    {id:'additional',label:'More sections',module:AdditionalSection},
    {id:'references',label:'References',module:ReferencesSection},
  ];
  const t = (key, fallback) => window.ReGenText?.get('studio.' + key, fallback) ?? fallback;
  const sectionLabel = step => window.ReGenText?.get('section.' + step.id, step.label) ?? step.label;
  let current = 0;
  let data = {};
  let dirty = false;
  let timer;
  let previewFrame;
  let pending = Promise.resolve();
  let navigating = false;
  let revision = 0;
  let saveState = 'saved';
  const saved = new Map();
  const serialise = value => JSON.stringify(value, (_, item) => item && !Array.isArray(item) && typeof item === 'object'
    ? Object.fromEntries(Object.entries(item).sort(([a],[b]) => a.localeCompare(b))) : item);
  const content = () => document.getElementById('step-content');
  const sheet = () => document.getElementById('editor-sections');

  async function init(savedData) {
    data = savedData || {};
    Object.entries(data).forEach(([key,value]) => saved.set(key, serialise(value)));
    const requested = steps.findIndex(step => step.id === new URLSearchParams(location.search).get('section'));
    if (requested >= 0) current = requested;
    FormCards.observe(content());
    DocumentSettings.init({
      button: document.getElementById('resume-layout-settings'),
      read: getDraftResume,
      apply: settings => {
        setPreferences(settings);
        document.dispatchEvent(new CustomEvent('regen:writing-settings-changed', {detail:settings.writing}));
        App.showToast('Document settings saved.', 'success');
      },
    });
    content().addEventListener('input', changed);
    content().addEventListener('change', changed);
    content().addEventListener('click', event => {
      if (event.target.closest('.repeatable-form .add-entry-btn')) {
        const card = content().querySelector('.entry-cards > .entry-card:last-child');
        if (card && !card.contains(document.activeElement)) {
          card.querySelector('.form-section :is(input, select, textarea):not([type="hidden"]):not([hidden]):not(:disabled)')?.focus();
        }
      }
      if (event.target.closest('.entry-delete-btn') && document.activeElement === document.body) {
        content().querySelector('.repeatable-form .add-entry-btn')?.focus({ preventScroll:true });
      }
      if (event.target.closest('.entry-delete-btn')) changed();
    });
    document.getElementById('studio-sections-open')?.addEventListener('click', () => { Preview.close(false); sheet().showModal(); });
    document.getElementById('editor-sections-close')?.addEventListener('click', () => sheet().close());
    document.querySelectorAll('[data-editor-action]').forEach(button => button.addEventListener('click', () => {
      sheet().close();
      document.getElementById(button.dataset.editorAction)?.click();
    }));
    document.getElementById('save-retry')?.addEventListener('click', () => saveCurrentStep({validate:false}));
    window.addEventListener('regen:session-restored', () => { if (dirty) liveSave(); });
    window.addEventListener('online', () => { if (dirty) liveSave(); });
    window.addEventListener('offline', () => { if (dirty) showSaveIndicator('error'); });
    window.addEventListener('regen:before-update', event => {if (dirty) event.preventDefault();});
    window.addEventListener('beforeunload', event => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    });
    renderTrack();
    await showStep();
    if (new URLSearchParams(location.search).get('settings') === '1') document.getElementById('resume-layout-settings')?.click();
  }

  function renderTrack() {
    const markup = steps.map((step,index) => `<button type="button" class="step-item${index === current ? ' active' : ''}" data-idx="${index}" ${index === current ? 'aria-current="step"' : ''}><span class="step-bubble"><span class="step-num">${ReGenIcons.icon(({personal:'personal',summary:'template',education:'education',experience:'experience',projects:'skills',extracurricular:'personal',skills:'skills',achievements:'award',certifications:'award',additional:'add',references:'personal'})[step.id])}</span></span><span class="step-label">${sectionLabel(step)}</span></button>`).join('');
    const track = document.getElementById('stepper-track');
    track.setAttribute('role','navigation');
    track.setAttribute('aria-label', t('structure','Resume sections'));
    track.innerHTML = markup;
    const list = document.getElementById('mobile-section-list');
    list.innerHTML = steps.map((step,index) => `<button type="button" data-idx="${index}" ${index === current ? 'aria-current="step"' : ''}><span>${String(index + 1).padStart(2,'0')}</span>${sectionLabel(step)}</button>`).join('');
    [track,list].forEach(parent => parent.querySelectorAll('[data-idx]').forEach(button => button.addEventListener('click', () => navigate(Number(button.dataset.idx), false))));
    document.getElementById('progress-fill').style.width = `${(current + 1) / steps.length * 100}%`;
    document.getElementById('progress-label').textContent = `${String(current + 1).padStart(2,'0')} / ${steps.length} · ${sectionLabel(steps[current])}`;
    document.getElementById('mobile-section-title').textContent = sectionLabel(steps[current]);
    document.getElementById('mobile-section-count').textContent = `${current + 1} / ${steps.length}`;
  }

  function showSaveIndicator(state, failure = {}) {
    const previous = saveState;
    saveState = state;
    const element = document.getElementById('save-indicator');
    if (!element) return;
    const labels = {saved:t('saved','All changes saved'),saving:t('saving','Saving changes…'),pending:t('pending','Changes not saved yet')};
    let label = labels[state];
    const recovered = failure.code === 'DOCUMENT_RECOVERED';
    if (state === 'error') {
      if (!navigator.onLine) label = t('offline','Offline. Keep this page open.');
      else if (recovered) label = 'This resume was restored. Copy your edits before reopening it.';
      else if (failure.status === 401) label = t('session','Sign in again to save. Keep this page open.');
      else if (failure.status === 429) label = 'Too many save requests. Wait a moment and retry.';
      else if (failure.status >= 500) label = 'The server could not save your edits. Keep this page open.';
      else if (!failure.status && failure.message) label = failure.message;
      else label = t('saveFailed','Save failed. Your edits are still here.');
      if (navigator.onLine && !recovered) {
        if (/^[a-f0-9]{16}$/.test(failure.requestId ?? '')) label += ` Ref ${failure.requestId}`;
        else if (failure.status) label += ` (HTTP ${failure.status})`;
      }
    }
    element.className = `save-indicator is-${state}`;
    const labelElement = element.querySelector('.save-label');
    if (labelElement.textContent !== label) labelElement.textContent = label;
    document.getElementById('save-retry').hidden = state !== 'error' || recovered;
    if (previous !== state) document.dispatchEvent(new CustomEvent('regen:studio-save-state', {detail:{state}}));
  }

  function readDraft() {
    const step = steps[current];
    if (typeof step.module.getPreviewData === 'function') return step.module.getPreviewData();
    const errors = [...content().querySelectorAll('.is-error,.form-error.visible')];
    const result = step.module.getData();
    content().querySelectorAll('.is-error,.form-error.visible').forEach(element => {
      if (!errors.includes(element)) element.classList.remove('is-error','visible');
    });
    return result.isValid ? result.data : data[step.id];
  }

  function updateDraftPreview() {
    if (!content() || document.querySelector('.builder-left.is-final')) return;
    const step = steps[current];
    if (Preview.isOpen()) Preview.renderDraft({...data, [step.id]:readDraft()});
    const working = typeof step.module.getWorkingData === 'function'
      ? step.module.getWorkingData() : readDraft();
    document.dispatchEvent(new CustomEvent('regen:studio-draft', {detail:{...data,[step.id]:working}}));
  }

  function changed(event) {
    if (event?.target?.closest('.candidate-guidance,.contribution-builder')) return;
    if (event?.type === 'change' && !dirty && saved.get(steps[current].id) === serialise(readDraft())) return;
    dirty = true;
    revision++;
    showSaveIndicator(navigator.onLine ? 'pending' : 'error');
    if (!previewFrame) previewFrame = requestAnimationFrame(() => {
      previewFrame = null;
      updateDraftPreview();
    });
    clearTimeout(timer);
    // VALIDATION AND PREVIEW COLLECTION RUN AFTER TYPING, NOT ON EVERY KEYSTROKE.
    timer = setTimeout(liveSave, 900);
  }

  async function persist(step,value) {
    const payload = serialise(value);
    if (saved.get(step.id) === payload) { dirty = false; showSaveIndicator('saved'); return true; }
    const requestRevision = revision;
    showSaveIndicator('saving');
    const operation = pending.then(() => Api.saveSection(step.id,value));
    pending = operation.catch(() => ({success:false}));
    let result;
    try { result = await operation; } catch { result = {success:false}; }
    if (!result.success) { showSaveIndicator('error',result); return false; }
    saved.set(step.id,payload);
    document.dispatchEvent(new Event('regen:studio-saved-content'));
    if (requestRevision === revision) {
      data[step.id] = value;
      dirty = false;
      showSaveIndicator('saved');
    } else {
      showSaveIndicator('pending');
    }
    return true;
  }

  async function saveCurrentStep({validate = true} = {}) {
    clearTimeout(timer);
    await pending;
    const step = steps[current];
    let value;
    if (validate) {
      if (window.ZeekeForm && !ZeekeForm.validateScope(content())) return false;
      const result = step.module.getData();
      if (!result.isValid) { ZeekeForm.validateScope(content()); return false; }
      value = result.data;
    } else {
      if (!dirty) return true;
      const draft = readDraft();
      if (draft === undefined) { showSaveIndicator('pending'); return false; }
      value = draft;
      // INCOMPLETE REPEATABLE ENTRIES STAY VISIBLE UNTIL THEY CAN BE SAVED.
      if (typeof step.module.getPreviewData !== 'function') {
        const result = step.module.getData();
        if (!result.isValid) { showSaveIndicator('pending'); return false; }
        value = result.data;
      }
    }
    return persist(step,value);
  }

  async function liveSave() {
    clearTimeout(timer);
    if (!dirty || navigating || !navigator.onLine) return;
    const step = steps[current];
    if (typeof step.module.getPreviewData !== 'function' && window.ZeekeForm && !ZeekeForm.validateScope(content(),{silent:true,focus:false})) return;
    const beforeSave = revision;
    await saveCurrentStep({validate:false});
    if (dirty && revision !== beforeSave && saveState === 'pending') timer = setTimeout(liveSave,900);
  }

  async function navigate(index,validate = true) {
    if (navigating || index === current) { sheet()?.close(); return; }
    navigating = true;
    const leaving = steps[current];
    const forward = validate && index > current;
    const empty = forward && !content().querySelector('.skill-chip') && ![...content().querySelectorAll(
      'textarea,input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]),select',
    )].some(field=>!field.disabled&&!field.closest('[hidden],.candidate-guidance,.contribution-builder')
      && field.value.trim() && (field.tagName!=='SELECT'||field.selectedIndex>0));
    const react = kind => document.dispatchEvent(new CustomEvent('regen:editor-moment',{detail:{kind,section:leaving.id}}));
    document.querySelectorAll('#btn-next,#btn-back').forEach(button => { button.disabled = true; });
    try {
      sheet()?.close();
      if (!await saveCurrentStep({validate})) {
        if (forward && (empty || content().querySelector('.is-error,[aria-invalid="true"]')) && saveState!=='error') react('blocked');
        if (!validate && dirty && saveState === 'pending' && !ZeekeForm.validateScope(content())) {
          App.showToast('Finish the highlighted fields or remove the unfinished entry.', 'error');
        }
        return;
      }
      if (dirty) return; // Another edit arrived while the last save was in progress.
      sheet()?.close();
      if (index >= steps.length) {
        App.showFinalScreen();
        if (forward) react('review');
        return;
      }
      current = Math.max(0,index);
      renderTrack();
      await showStep(true);
      if (forward) react(empty?'skipped':'completed');
    } finally {
      navigating = false;
      document.querySelectorAll('#btn-next,#btn-back').forEach(button => { button.disabled = false; });
      if (dirty && saveState === 'pending') timer = setTimeout(liveSave, 900);
    }
  }

  async function showStep(focus = false) {
    const step = steps[current];
    content().innerHTML = step.module.render(current + 1,data.writing||{});
    content().scrollTop = 0;
    step.module.attachEvents(data[step.id]);
    FormCards.prepare(content());
    dirty = false;
    showSaveIndicator('saved');
    const skip = content().querySelector('.skip-btn');
    skip?.addEventListener('click', () => navigate(current + 1,false));
    document.dispatchEvent(new CustomEvent('regen:section-ready',{detail:{section:step.id}}));
    updateDraftPreview();
    window.ZeekeForm?.bind(content());
    window.ZeekeSafe?.refreshTextareas(content());
    window.ReGenAI?.bind(content(),step.id);
    const heading = content().querySelector('h2');
    if (focus && heading) { heading.tabIndex = -1; heading.focus({preventScroll:true}); }
    document.getElementById('btn-back').hidden = current === 0;
    document.querySelector('.nav-bar').classList.toggle('is-first-step',current === 0);
    const next = document.getElementById('btn-next');
    const isLast = current === steps.length - 1;
    next.title = t(isLast ? 'reviewExport' : 'next');
    next.innerHTML = ReGenIcons.icon(isLast ? 'check' : 'arrowRight');
    next.setAttribute('aria-label', next.title);
    const url = new URL(location.href);url.searchParams.set('section',step.id);url.searchParams.delete('review');history.replaceState(null,'',url);
  }

  function getDraftResume() {
    if (!document.querySelector('.builder-left.is-final')) data[steps[current].id] = readDraft();
    return {...data};
  }
  function review() { return navigate(steps.length); }
  function setTemplate(id) {data.templateId = id;document.dispatchEvent(new CustomEvent('regen:template-changed',{detail:{id}}));Preview.refreshNow();}
  function setPreferences(values) {Object.assign(data,values);Preview.refreshNow();}
  async function resumeEditing() {renderTrack();await showStep();}
  return {init,next:() => navigate(current + 1),back:() => navigate(current - 1,false),getDraftResume,review,setTemplate,setPreferences,resumeEditing,saveCurrentStep,hasUnsavedChanges:() => dirty};
})();
