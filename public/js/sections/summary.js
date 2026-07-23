const SummarySection = (() => {
  function render(stepNum) {
    return `
      <div class="step-header">
        <div class="step-header-info">
          <div class="step-count">Step ${stepNum}</div>
          <h2 class="step-title">Professional Summary</h2>
          <p class="step-subtitle">Brief overview of experience and strengths.</p>
        </div>
        <button type="button" class="skip-btn">Skip Step ${ReGenIcons.icon('arrowRight')}</button>
      </div>
      <div class="form-body form-section">
        <div class="form-group form-group-full">
          <label class="form-label" for="s-summary">Summary <span class="req">*</span></label>
          <textarea id="s-summary" class="form-textarea" style="min-height:160px;" placeholder="Graduate software engineer with experience building..." maxlength="1200" data-counter="1200" data-minlength="50" required></textarea>
          <div class="form-hint">Use 2-4 concise sentences covering your experience, strongest skills, and career focus.</div>
          <div class="form-error">Summary is required if not skipping.</div>
        </div>
      </div>
    `;
  }

  function attachEvents(data) {
    if (data) {
      document.getElementById('s-summary').value = data;
    }
  }

  function getData() {
    const el = document.getElementById('s-summary');
    const val = window.ZeekeSafe.value(el);
    const err = el.parentElement.querySelector('.form-error');

    if (!val) {
      el.classList.add('is-error');
      if (err) err.classList.add('visible');
      return { isValid: false, data: null };
    }

    el.classList.remove('is-error');
    if (err) err.classList.remove('visible');
    return { isValid: true, data: val };
  }

  function getPreviewData() {
    return window.ZeekeSafe.value(document.getElementById('s-summary'));
  }

  return { render, attachEvents, getData, getPreviewData };
})();
