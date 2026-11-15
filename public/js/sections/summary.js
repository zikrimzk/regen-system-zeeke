const SummarySection = (() => {
  function render(stepNum,writing={}) {
    const label=writing.profileType==='objective'?'Objective':'Summary';
    return `
      <div class="step-header">
        <div class="step-header-info">
          <div class="step-count">Step ${stepNum}</div>
          <h2 class="step-title" data-profile-title>${label}</h2>
          <p class="step-subtitle">A few lines about what you bring.</p>
        </div>
        <button type="button" class="skip-btn">Skip ${ReGenIcons.icon('arrowRight')}</button>
      </div>
      <div class="form-body form-section">
        <div class="form-group form-group-full">
          <label class="form-label" for="s-summary"><span data-profile-title>${label}</span></label>
          <textarea id="s-summary" class="form-textarea summary-textarea" rows="4" data-max-height="240" placeholder="Graduate software engineer with experience building..." maxlength="1200" data-counter="1200"></textarea>
          <div class="form-hint">In two or three sentences, say what you do and give one example of what you bring to the role.</div>
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
    return { isValid: true, data: getPreviewData() };
  }

  function getPreviewData() {
    return window.ZeekeSafe.value(document.getElementById('s-summary'));
  }

  document.addEventListener('regen:writing-settings-changed',event=>document.querySelectorAll('[data-profile-title]').forEach(el=>{el.textContent=event.detail.profileType==='objective'?'Objective':'Summary';}));

  return { render, attachEvents, getData, getPreviewData };
})();
