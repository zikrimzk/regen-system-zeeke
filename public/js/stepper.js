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

  async function init(savedData) {
    _data = savedData || {};
    const requestedSection = new URLSearchParams(window.location.search).get('section');
    const requestedIndex = _steps.findIndex(step => step.id === requestedSection);
    if (requestedIndex >= 0) _currentIndex = requestedIndex;
    renderTrack();
    await showStep(_currentIndex);
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
        <div class="${css}" data-idx="${i}">
          <div class="step-bubble"><span class="step-num">${i + 1}</span></div>
          <div class="step-label">${s.label}</div>
        </div>
      `;
    }).join('');

    const pct = ((_currentIndex + 1) / _steps.length) * 100;
    if (fill) fill.style.width = `${pct}%`;
    if (lbl) lbl.textContent = `Step ${_currentIndex + 1} of ${_steps.length}`;

    // Click on done steps to navigate back
    track.querySelectorAll('.step-item.done').forEach(el => {
      el.addEventListener('click', async () => {
        if (!await saveCurrentStep()) return;
        _currentIndex = parseInt(el.dataset.idx);
        renderTrack();
        await showStep(_currentIndex);
      });
    });

    const trackEl = document.querySelector('.stepper-track');
    if (trackEl) {
      const activeEl = trackEl.querySelector('.active');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }

  function showSaveIndicator() {
    const el = document.getElementById('save-indicator');
    if (el) {
      el.style.opacity = '1';
      setTimeout(() => { el.style.opacity = '0'; }, 2000);
    }
  }

  async function persistStep(step, data, { showLoading = true, refreshPreview = true } = {}) {
    if (showLoading) App.showLoader();
    const res = await Api.saveSection(step.id, data);
    if (showLoading) App.hideLoader();

    if (!res.success) {
      App.showToast(res.message || 'Failed to save.', 'error');
      return false;
    }

    _data[step.id] = data;
    if (refreshPreview) Preview.refreshNow();
    showSaveIndicator();
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
    _liveSaveTimer = setTimeout(runLiveSave, 650);
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

    const skipBtn = content.querySelector('.skip-btn');
    if (skipBtn) skipBtn.addEventListener('click', skip);

    step.module.attachEvents(_data[step.id]);
    window.ZeekeForm?.bind(content);
    window.ZeekeSafe?.refreshTextareas(content);
    _lastLivePayload = '';
    content.addEventListener('input', scheduleLiveSave);
    content.addEventListener('change', scheduleLiveSave);
    updateDraftPreview();

    const btnBack = document.getElementById('btn-back');
    const btnNext = document.getElementById('btn-next');
    
    if (btnBack) btnBack.style.visibility = idx === 0 ? 'hidden' : 'visible';
    if (btnNext) {
      if (idx === _steps.length - 1) {
        btnNext.innerHTML = `Finish ${ReGenIcons.icon('check')}`;
      } else {
        btnNext.innerHTML = `Next Step ${ReGenIcons.icon('arrowRight')}`;
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
