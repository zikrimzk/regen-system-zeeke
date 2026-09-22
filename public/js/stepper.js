/**
 * stepper.js — Manages steps and navigation
 */
const Stepper = (() => {
  const _steps = [
    { id: 'personal',        label: 'Personal',       module: PersonalSection },
    { id: 'summary',         label: 'Summary',        module: SummarySection },
    { id: 'education',       label: 'Education',      module: EducationSection },
    { id: 'experience',      label: 'Experience',     module: ExperienceSection },
    { id: 'projects',        label: 'Projects',       module: ProjectsSection },
    { id: 'extracurricular', label: 'Extra',          module: ExtracurricularSection },
    { id: 'skills',          label: 'Skills',         module: SkillsSection },
    { id: 'achievements',    label: 'Achievement',    module: AchievementsSection },
    { id: 'certifications',  label: 'Certification',  module: CertificationsSection },
    { id: 'references',      label: 'References',     module: ReferencesSection },
  ];

  let _currentIndex = 0;
  let _data = {};
  let _liveSaveTimer = null;
  let _liveSaveInFlight = false;
  let _lastLivePayload = '';
  let _saveIndicatorTimer = null;

  async function init(savedData) {
    _data = savedData || {};
    const requestedSection = new URLSearchParams(window.location.search).get('section');
    const requestedIndex = _steps.findIndex(step => step.id === requestedSection);
    if (requestedIndex >= 0) _currentIndex = requestedIndex;
    bindSectionPicker();
    renderTrack();
    await showStep(_currentIndex);
  }

  function bindSectionPicker() {
    const toggle = document.getElementById('stepper-sections-toggle');
    const track = document.getElementById('stepper-track');
    if (!toggle || !track || toggle.dataset.bound === 'true') return;
    toggle.dataset.bound = 'true';
    toggle.addEventListener('click', () => {
      const open = !track.classList.contains('is-open');
      track.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', (event) => {
      if (!track.classList.contains('is-open')) return;
      if (track.contains(event.target) || toggle.contains(event.target)) return;
      closeSectionPicker();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeSectionPicker();
    });
  }

  function closeSectionPicker() {
    document.getElementById('stepper-track')?.classList.remove('is-open');
    document.getElementById('stepper-sections-toggle')?.setAttribute('aria-expanded', 'false');
  }

  function renderTrack() {
    const track = document.getElementById('stepper-track');
    const fill  = document.getElementById('progress-fill');
    const lbl   = document.getElementById('progress-label');
    
    if (!track) return;

    track.innerHTML = _steps.map((s, i) => {
      let css = 'step-item';
      if (i === _currentIndex) css += ' active';
      else if (i < _currentIndex) css += ' done';
      
      return `
        <button type="button" class="${css}" data-idx="${i}" role="tab"
          aria-selected="${i === _currentIndex}" aria-controls="step-content"
          ${i === _currentIndex ? 'aria-current="step"' : ''}>
          <span class="step-bubble"><span class="step-num">${i < _currentIndex ? ReGenIcons.icon('check') : i + 1}</span></span>
          <span class="step-label">${s.label}</span>
        </button>`;
    }).join('');

    const pct = ((_currentIndex + 1) / _steps.length) * 100;
    if (fill) fill.style.width = `${pct}%`;
    if (lbl) lbl.textContent = `${String(_currentIndex + 1).padStart(2, '0')} / ${_steps.length} · ${_steps[_currentIndex].label}`;

    track.querySelectorAll('.step-item:not(.active)').forEach(el => {
      el.addEventListener('click', async () => {
        if (!await saveCurrentStep()) return;
        _currentIndex = parseInt(el.dataset.idx);
        closeSectionPicker();
        renderTrack();
        await showStep(_currentIndex);
      });
    });

    const trackEl = document.querySelector('.stepper-track');
    const activeEl = trackEl?.querySelector('.active');
    if (trackEl && activeEl && trackEl.scrollWidth > trackEl.clientWidth) {
      const left = activeEl.offsetLeft - ((trackEl.clientWidth - activeEl.offsetWidth) / 2);
      trackEl.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
    }
  }

  function showSaveIndicator(state = 'saved') {
    const el = document.getElementById('save-indicator');
    if (el) {
      clearTimeout(_saveIndicatorTimer);
      el.className = `save-indicator is-${state}`;
      const label = el.querySelector('.save-label');
      if (label) label.textContent = state === 'saving' ? 'Saving changes…' : 'All changes saved';
      el.style.opacity = '1';
      if (state === 'saved') {
        _saveIndicatorTimer = setTimeout(() => { el.style.opacity = '0.72'; }, 1800);
      }
    }
  }

  async function persistStep(step, data, { showLoading = true, refreshPreview = true } = {}) {
    if (showLoading) App.showLoader();
    else showSaveIndicator('saving');
    const res = await Api.saveSection(step.id, data);
    if (showLoading) App.hideLoader();

    if (!res.success) {
      App.showToast(res.message || 'Failed to save.', 'error');
      return false;
    }

    _data[step.id] = data;
    if (refreshPreview) Preview.refreshNow();
    showSaveIndicator('saved');
    return true;
  }

  async function saveCurrentStep() {
    clearTimeout(_liveSaveTimer);
    const step = _steps[_currentIndex];
    const content = document.getElementById('step-content');
    if (content) sanitizeFields(content);
    if (content && window.ZeekeForm && !ZeekeForm.validateScope(content)) {
      App.showToast('Please check the highlighted fields.', 'error');
      return false;
    }
    const { isValid, data } = step.module.getData();
    if (!isValid) return false;

    return persistStep(step, data);
  }

  function snapshotValidationState(scope) {
    const inputs = Array.from(scope.querySelectorAll('.is-error'));
    const errors = Array.from(scope.querySelectorAll('.form-error.visible, .auth-field-error.visible'));
    return { inputs, errors };
  }

  function restoreSilentValidation(scope, before) {
    scope.querySelectorAll('.is-error').forEach(el => {
      if (!before.inputs.includes(el)) el.classList.remove('is-error');
    });
    scope.querySelectorAll('.form-error.visible, .auth-field-error.visible').forEach(el => {
      if (!before.errors.includes(el)) el.classList.remove('visible');
    });
  }

  function sanitizeFields(scope) {
    scope.querySelectorAll('input, textarea').forEach(el => window.ZeekeSafe?.setCleanValue(el));
  }

  function scheduleLiveSave() {
    updateDraftPreview();
    clearTimeout(_liveSaveTimer);
    _liveSaveTimer = setTimeout(runLiveSave, 1000);
  }

  function getCurrentPreviewData(content, step) {
    if (typeof step.module.getPreviewData === 'function') {
      return step.module.getPreviewData();
    }

    const before = snapshotValidationState(content);
    const { isValid, data } = step.module.getData();
    restoreSilentValidation(content, before);
    return isValid ? data : _data[step.id];
  }

  function updateDraftPreview() {
    const content = document.getElementById('step-content');
    const step = _steps[_currentIndex];
    if (!content || !step) return;

    const draftData = getCurrentPreviewData(content, step);
    _data = { ..._data, [step.id]: draftData };
    Preview.renderDraft(_data);
  }

  function getDraftResume() {
    updateDraftPreview();
    return { ..._data };
  }

  async function runLiveSave() {
    if (_liveSaveInFlight) {
      scheduleLiveSave();
      return;
    }

    const content = document.getElementById('step-content');
    const step = _steps[_currentIndex];
    if (!content || !step) return;

    const before = snapshotValidationState(content);
    if (window.ZeekeForm && !ZeekeForm.validateScope(content, { silent: true, focus: false })) return;
    const { isValid, data } = step.module.getData();
    if (!isValid) {
      restoreSilentValidation(content, before);
      return;
    }

    const payload = JSON.stringify({ section: step.id, data });
    if (payload === _lastLivePayload) return;

    _liveSaveInFlight = true;
    _lastLivePayload = payload;
    const ok = await persistStep(step, data, { showLoading: false });
    _liveSaveInFlight = false;
    if (!ok) _lastLivePayload = '';
  }

  async function next() {
    if (!await saveCurrentStep()) return;

    if (_currentIndex < _steps.length - 1) {
      _currentIndex++;
      renderTrack();
      await showStep(_currentIndex);
    } else {
      App.showFinalScreen();
    }
  }

  async function back() {
    if (_currentIndex > 0) {
      _currentIndex--;
      renderTrack();
      await showStep(_currentIndex);
    }
  }

  async function showStep(idx) {
    const step = _steps[idx];
    const content = document.getElementById('step-content');
    if (!content) return;

    const html = step.module.render(idx + 1);
    content.innerHTML = html;
    content.scrollTo({ top: 0, behavior: 'auto' });

    const skipBtn = content.querySelector('.skip-btn');
    if (skipBtn) {
      const textNode = Array.from(skipBtn.childNodes).find(node => node.nodeType === Node.TEXT_NODE);
      if (textNode) textNode.textContent = 'Skip ';
      skipBtn.addEventListener('click', skip);
    }

    step.module.attachEvents(_data[step.id]);
    window.ZeekeForm?.bind(content);
    window.ZeekeSafe?.refreshTextareas(content);
    window.ReGenAI?.bind(content, step.id);
    _lastLivePayload = '';
    content.addEventListener('input', scheduleLiveSave);
    content.addEventListener('change', scheduleLiveSave);
    updateDraftPreview();

    const btnBack = document.getElementById('btn-back');
    const btnNext = document.getElementById('btn-next');
    const navBar = document.querySelector('.nav-bar');
    
    navBar?.classList.toggle('is-first-step', idx === 0);
    if (btnBack) btnBack.hidden = idx === 0;
    if (btnNext) {
      if (idx === _steps.length - 1) {
        btnNext.innerHTML = `Finish ${ReGenIcons.icon('check')}`;
      } else {
        btnNext.innerHTML = `Next ${ReGenIcons.icon('arrowRight')}`;
      }
    }
  }

  async function skip() {
    clearTimeout(_liveSaveTimer);
    const step = _steps[_currentIndex];
    App.showLoader();
    const result = await Api.saveSection(step.id, null);
    App.hideLoader();
    if (!result.success) {
      App.showToast(result.message || 'Unable to skip this section.', 'error');
      return;
    }

    _data[step.id] = null;
    Preview.refreshNow();
    if (_currentIndex < _steps.length - 1) {
      _currentIndex++;
      renderTrack();
      await showStep(_currentIndex);
    } else {
      App.showFinalScreen();
    }
  }

  return { init, next, back, getDraftResume };
})();
