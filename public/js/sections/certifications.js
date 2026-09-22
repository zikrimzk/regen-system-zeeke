const CertificationsSection = (() => {
  let list = [''];
  
  function render(stepNum) {
    return `
      <div class="step-header">
        <div class="step-header-info">
          <div class="step-count">Step ${stepNum}</div>
          <h2 class="step-title">Licenses & Certifications</h2>
          <p class="step-subtitle">Certifications and licences.</p>
        </div>
        <button type="button" class="skip-btn">Skip Step ${ReGenIcons.icon('arrowRight')}</button>
      </div>
      <div class="form-body form-section">
        <div class="list-editor" id="cert-list"></div>
        <button type="button" class="btn btn-secondary mt-sm" id="btn-add-cert" style="align-self:flex-start;">${ReGenIcons.icon('add')} Add Certification</button>
      </div>
    `;
  }

  function attachEvents(data) {
    list = data && data.length ? data : [];
    renderList();
    document.getElementById('btn-add-cert').addEventListener('click', () => {
      saveCurrentState();
      list.push('');
      renderList();
      const inputs = document.querySelectorAll('.cert-input');
      inputs[inputs.length - 1].focus();
    });
  }

  function renderList() {
    const container = document.getElementById('cert-list');
    const esc = window.ZeekeSafe.attr;
    container.innerHTML = list.map((val, i) => `
      <div class="list-item-row">
        <span class="list-item-num">-</span>
        <textarea class="list-item-input cert-input" rows="1" maxlength="320" placeholder="e.g. AWS Certified Solutions Architect - Amazon Web Services, 2026">${esc(val)}</textarea>
        <button type="button" class="list-item-remove" data-index="${i}" aria-label="Remove certification" title="Remove certification">${ReGenIcons.icon('trash')}</button>
      </div>
    `).join('');
    container.querySelectorAll('.list-item-remove').forEach((button) => {
      button.addEventListener('click', () => removeItem(Number(button.dataset.index)));
    });
  }

  function removeItem(idx) {
    saveCurrentState();
    list.splice(idx, 1);
    renderList();
  }

  function saveCurrentState() {
    list = Array.from(document.querySelectorAll('.cert-input')).map(i => window.ZeekeSafe.value(i));
  }

  function getData() {
    saveCurrentState();
    const data = list.map(v => v.trim()).filter(v => v);
    return { isValid: true, data: data.length ? data : null };
  }

  return { render, attachEvents, getData, removeItem };
})();
