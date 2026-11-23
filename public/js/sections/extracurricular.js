const ExtracurricularSection = (() => {
  let entries = [];
  let nextId = 0;
  
  function render(stepNum) {
    return `
      <div class="step-header">
        <div class="step-header-info">
          <div class="step-count">Step ${stepNum}</div>
          <h2 class="step-title">Activities</h2>
          <p class="step-subtitle">Add volunteering, clubs or leadership roles.</p>
        </div>
        <button type="button" class="skip-btn">Skip ${ReGenIcons.icon('arrowRight')}</button>
      </div>
      <div class="form-body form-section repeatable-form">
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
          <div class="entry-card-title">Activity</div>
          <button type="button" class="entry-delete-btn" aria-label="Remove activity" title="Remove activity">${ReGenIcons.icon('trash')}</button>
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
            <label class="sr-only" for="extra-points-${id}">One point per line</label><textarea id="extra-points-${id}" class="points-editor extra-bullet-input" data-preserve-spaces="true" rows="6" maxlength="16000" placeholder="Write or paste one point per line">${esc(ReGenPoints.format(bullets))}</textarea><p class="points-hint">Each line becomes a bullet in your resume. Press Enter to add another point.</p>
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
    const id = ++nextId;
    entries.push(id);
    document.getElementById('extra-list').insertAdjacentHTML('beforeend', renderForm(id, data));
    const card = document.getElementById(`extra-${id}`);
    card.querySelector('.entry-delete-btn')?.addEventListener('click', () => removeEntry(id));
    ReGenPoints.bind(card);
    window.ZeekeForm?.bind(card);
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

  function getData(validate = true) {
    let isValid = true;
    const data = [];

    if (entries.length === 0) return { isValid: true, data: [] };

    FormCards.ordered(entries, 'extra-list').forEach(id => {
      const card = document.getElementById(`extra-${id}`);
      if (!card) return;

      const org = card.querySelector('.extra-org');
      if (validate && !org.value.trim()) { org.classList.add('is-error'); isValid = false; }
      else if (validate) org.classList.remove('is-error');

      const bullets = ReGenPoints.lines(card.querySelector('.extra-bullet-input').value);

      if (isValid || !validate) {
        data.push({
          organization: window.ZeekeSafe.value(org),
          role:         window.ZeekeSafe.value(card.querySelector('.extra-role')),
          bullets:      bullets
        });
      }
    });

    return { isValid, data: isValid || !validate ? data : null };
  }

  return { render, attachEvents, getData, getWorkingData: () => getData(false).data, removeEntry };
})();
