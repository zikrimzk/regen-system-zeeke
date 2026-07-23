const AchievementsSection = (() => {
  let list = [''];
  
  function render(stepNum) {
    return `
      <div class="step-header">
        <div class="step-header-info">
          <div class="step-count">Step ${stepNum}</div>
          <h2 class="step-title">Achievements & Awards</h2>
          <p class="step-subtitle">Awards, scholarships and recognition.</p>
        </div>
        <button type="button" class="skip-btn">Skip Step ${ReGenIcons.icon('arrowRight')}</button>
      </div>
      <div class="form-body form-section">
        <div class="list-editor" id="ach-list"></div>
        <button type="button" class="btn btn-secondary mt-sm" id="btn-add-ach" style="align-self:flex-start;">${ReGenIcons.icon('add')} Add Achievement</button>
      </div>
    `;
  }

  function attachEvents(data) {
    list = data && data.length ? data : [];
    renderList();
    document.getElementById('btn-add-ach').addEventListener('click', () => {
      saveCurrentState();
      list.push('');
      renderList();
      const inputs = document.querySelectorAll('.ach-input');
      inputs[inputs.length - 1].focus();
    });
  }

  function renderList() {
    const container = document.getElementById('ach-list');
    const esc = window.ZeekeSafe.attr;
    container.innerHTML = list.map((val, i) => `
      <div class="list-item-row">
        <span class="list-item-num">-</span>
        <textarea class="list-item-input ach-input" rows="2" maxlength="320" placeholder="e.g. 1st Runner Up - National Hackathon 2023">${esc(val)}</textarea>
        <button type="button" class="list-item-remove" onclick="AchievementsSection.removeItem(${i})" aria-label="Remove achievement" title="Remove achievement">${ReGenIcons.icon('trash')}</button>
      </div>
    `).join('');
  }

  function removeItem(idx) {
    saveCurrentState();
    list.splice(idx, 1);
    renderList();
  }

  function saveCurrentState() {
    list = Array.from(document.querySelectorAll('.ach-input')).map(i => window.ZeekeSafe.value(i));
  }

  function getData() {
    saveCurrentState();
    const data = list.map(v => v.trim()).filter(v => v);
    return { isValid: true, data: data.length ? data : null };
  }

  return { render, attachEvents, getData, removeItem };
})();
