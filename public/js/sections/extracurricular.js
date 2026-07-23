const ExtracurricularSection = (() => {
  let entries = [];
  
  function render(stepNum) {
    return `
      <div class="step-header">
        <div class="step-header-info">
          <div class="step-count">Step ${stepNum}</div>
          <h2 class="step-title">Extracurricular Activities</h2>
          <p class="step-subtitle">Clubs, volunteering and societies.</p>
        </div>
        <button type="button" class="skip-btn">Skip Step ${ReGenIcons.icon('arrowRight')}</button>
      </div>
      <div class="form-body form-section">
        <div id="extra-list" class="entry-cards"></div>
        <button type="button" class="add-entry-btn" id="btn-add-extra">${ReGenIcons.icon('add')} Add Activity</button>
      </div>
    `;
  }

  function renderForm(id, data = {}) {
    const bullets = data.bullets || [''];
    const esc = window.ZeekeSafe.attr;
    return `
      <div class="entry-card" id="extra-${id}">
        <div class="entry-card-header">
          <div class="entry-card-num">${entries.length + 1}</div>
          <div class="entry-card-title">Activity Entry</div>
          <button type="button" class="entry-delete-btn" onclick="ExtracurricularSection.removeEntry(${id})" aria-label="Remove activity" title="Remove activity">${ReGenIcons.icon('trash')}</button>
        </div>
        <div class="form-section">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Organization / Event <span class="req">*</span></label>
              <input type="text" class="form-input extra-org" value="${esc(data.organization)}" placeholder="e.g. Computer Science Society" maxlength="180" autocomplete="organization" required>
            </div>
            <div class="form-group">
              <label class="form-label">Role / Position</label>
              <input type="text" class="form-input extra-role" value="${esc(data.role)}" placeholder="e.g. Event Coordinator" maxlength="140" data-suggestions="activity-roles">
            </div>
          </div>
          <div class="form-group form-group-full">
            <label class="form-label">Key Responsibilities / Impacts</label>
            <div class="list-editor" id="extra-bullets-${id}">
              ${bullets.map(b => `
                <div class="list-item-row">
                  <span class="list-item-num">-</span>
                  <textarea class="list-item-input extra-bullet-input" rows="2" maxlength="320" placeholder="e.g. Organized a hackathon for 200 participants">${esc(b)}</textarea>
                  <button type="button" class="list-item-remove" onclick="this.parentElement.remove()" aria-label="Remove activity detail" title="Remove activity detail">${ReGenIcons.icon('trash')}</button>
                </div>
              `).join('')}
            </div>
            <button type="button" class="btn btn-secondary btn-sm mt-sm" onclick="ExtracurricularSection.addBullet(${id})">${ReGenIcons.icon('add')} Add Bullet</button>
          </div>
        </div>
      </div>
    `;
  }

  function attachEvents(data) {
    entries = [];
    document.getElementById('extra-list').innerHTML = '';
    
    if (data && data.length) {
      data.forEach(d => addEntry(d));
    }

    document.getElementById('btn-add-extra').addEventListener('click', () => addEntry());
  }

  function addEntry(data = {}) {
    const id = Date.now() + Math.floor(Math.random()*1000);
    entries.push(id);
    document.getElementById('extra-list').insertAdjacentHTML('beforeend', renderForm(id, data));
    window.ZeekeForm?.bind(document.getElementById(`extra-${id}`));
    updateNumbers();
  }

  function removeEntry(id) {
    entries = entries.filter(e => e !== id);
    const el = document.getElementById(`extra-${id}`);
    if (el) el.remove();
    updateNumbers();
  }

  function updateNumbers() {
    const cards = document.querySelectorAll('#extra-list .entry-card');
    cards.forEach((card, idx) => {
      card.querySelector('.entry-card-num').textContent = idx + 1;
    });
  }

  function addBullet(id) {
    const container = document.getElementById(`extra-bullets-${id}`);
    if (!container) return;
    container.insertAdjacentHTML('beforeend', `
      <div class="list-item-row">
        <span class="list-item-num">-</span>
        <textarea class="list-item-input extra-bullet-input" rows="2" maxlength="320" placeholder="Responsibility or impact..."></textarea>
        <button type="button" class="list-item-remove" onclick="this.parentElement.remove()" aria-label="Remove activity detail" title="Remove activity detail">${ReGenIcons.icon('trash')}</button>
      </div>
    `);
    const inputs = container.querySelectorAll('.extra-bullet-input');
    inputs[inputs.length - 1].focus();
  }

  function getData() {
    let isValid = true;
    const data = [];

    if (entries.length === 0) return { isValid: true, data: [] };

    entries.forEach(id => {
      const card = document.getElementById(`extra-${id}`);
      if (!card) return;

      const org = card.querySelector('.extra-org');
      if (!org.value.trim()) { org.classList.add('is-error'); isValid = false; }
      else org.classList.remove('is-error');

      const bullets = Array.from(card.querySelectorAll('.extra-bullet-input'))
        .map(i => window.ZeekeSafe.value(i))
        .filter(b => b);

      if (isValid) {
        data.push({
          organization: window.ZeekeSafe.value(org),
          role:         window.ZeekeSafe.value(card.querySelector('.extra-role')),
          bullets:      bullets
        });
      }
    });

    return { isValid, data: isValid ? data : null };
  }

  return { render, attachEvents, getData, removeEntry, addBullet };
})();
