const ExperienceSection = (() => {
  let entries = [];

  function countryOptions(selected = 'Malaysia') {
    return ZeekeLookups.COUNTRIES.filter(country => country !== 'Worldwide').map(country =>
      `<option value="${window.ZeekeSafe.attr(country)}" ${country === selected ? 'selected' : ''}>${window.ZeekeSafe.attr(country)}</option>`
    ).join('');
  }

  function locationOptions(country = 'Malaysia', selected = '') {
    return ZeekeLookups.regionOptions(country, selected).map(option =>
      `<option value="${window.ZeekeSafe.attr(option.value)}" ${option.selected ? 'selected' : ''}>${window.ZeekeSafe.attr(option.label)}</option>`
    ).join('');
  }

  function employmentTypeOptions(selected = '') {
    const values = ['', 'Full-time', 'Part-time', 'Internship', 'Contract', 'Temporary', 'Freelance', 'Apprenticeship', 'Volunteer'];
    return values.map(value => `<option value="${value}" ${value === selected ? 'selected' : ''}>${value || 'Select employment type'}</option>`).join('');
  }
  
  function render(stepNum) {
    return `
      <div class="step-header">
        <div class="step-header-info">
          <div class="step-count">Step ${stepNum}</div>
          <h2 class="step-title">Work Experience</h2>
          <p class="step-subtitle">Employment history and responsibilities.</p>
        </div>
        <button type="button" class="skip-btn">Skip Step ${ReGenIcons.icon('arrowRight')}</button>
      </div>
      <div class="form-body form-section">
        <div id="exp-list" class="entry-cards"></div>
        <button type="button" class="add-entry-btn" id="btn-add-exp">${ReGenIcons.icon('add')} Add Experience</button>
      </div>
    `;
  }

  function renderForm(id, data = {}) {
    const isCurrent = data.endDate === 'Present';
    const bullets = data.bullets || [''];
    const esc = window.ZeekeSafe.attr;
    
    return `
      <div class="entry-card" id="exp-${id}">
        <div class="entry-card-header">
          <div class="entry-card-num">${entries.length + 1}</div>
          <div class="entry-card-title">Experience Entry</div>
          <button type="button" class="entry-delete-btn" aria-label="Remove experience" title="Remove experience">${ReGenIcons.icon('trash')}</button>
        </div>
        <div class="form-section">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Job Title <span class="req">*</span></label>
              <input type="text" class="form-input exp-title" value="${esc(data.jobTitle)}" placeholder="e.g. Software Developer Intern" maxlength="140" autocomplete="organization-title" data-suggestions="job-titles" required>
            </div>
            <div class="form-group">
              <label class="form-label">Company <span class="req">*</span></label>
              <input type="text" class="form-input exp-company" value="${esc(data.company)}" placeholder="e.g. Petronas Digital Sdn Bhd" maxlength="180" autocomplete="organization" required>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Employment Type</label>
              <select class="form-select exp-type">${employmentTypeOptions(data.employmentType || '')}</select>
            </div>
            <div class="form-group">
              <label class="form-label">Country</label>
              <select class="form-select exp-country">${countryOptions(data.locationCountry || 'Malaysia')}</select>
            </div>
          </div>
          <div class="form-group form-group-full">
            <label class="form-label">State / Location</label>
            <select class="form-select exp-loc">${locationOptions(data.locationCountry || 'Malaysia', data.location || '')}</select>
            <div class="form-hint">Location choices follow the selected country.</div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Start Date <span class="req">*</span></label>
              <input type="month" class="form-input exp-start" value="${esc(data.startDate)}" required>
            </div>
            <div class="form-group">
              <label class="form-label">End Date <span class="req">*</span></label>
              <input type="month" class="form-input exp-end" value="${isCurrent ? '' : esc(data.endDate)}" ${isCurrent ? 'disabled' : ''} required>
              <div class="check-row">
                <input type="checkbox" class="exp-current" id="exp-curr-${id}" ${isCurrent ? 'checked' : ''}>
                <label for="exp-curr-${id}">I currently work here</label>
              </div>
            </div>
          </div>
          <div class="form-group form-group-full">
            <label class="form-label">Responsibilities & Achievements</label>
            <div class="list-editor" id="exp-bullets-${id}">
              ${bullets.map(b => `
                <div class="list-item-row">
                  <span class="list-item-num">-</span>
                  <textarea class="list-item-input exp-bullet-input" rows="1" maxlength="320" placeholder="e.g. Led a team of 5 engineers to deliver...">${esc(b)}</textarea>
                  <button type="button" class="list-item-remove" aria-label="Remove responsibility" title="Remove responsibility">${ReGenIcons.icon('trash')}</button>
                </div>
              `).join('')}
            </div>
            <button type="button" class="btn btn-secondary btn-sm mt-sm add-bullet-btn">${ReGenIcons.icon('add')} Add Bullet</button>
          </div>
        </div>
      </div>
    `;
  }

  function attachEvents(data) {
    entries = [];
    document.getElementById('exp-list').innerHTML = '';
    
    if (data && data.length) {
      data.forEach(d => addEntry(d));
    }

    document.getElementById('btn-add-exp').addEventListener('click', () => addEntry());
  }

  function addEntry(data = {}) {
    const id = Date.now() + Math.floor(Math.random()*1000);
    entries.push(id);
    document.getElementById('exp-list').insertAdjacentHTML('beforeend', renderForm(id, data));
    const card = document.getElementById(`exp-${id}`);
    const country = card.querySelector('.exp-country');
    const location = card.querySelector('.exp-loc');
    card.querySelector('.entry-delete-btn')?.addEventListener('click', () => removeEntry(id));
    card.querySelector('.exp-current')?.addEventListener('change', (event) => {
      toggleCurrent(event.currentTarget, `exp-${id}`);
    });
    card.querySelector('.add-bullet-btn')?.addEventListener('click', () => addBullet(id));
    bindBulletRemoveButtons(card);
    country.addEventListener('change', () => {
      location.innerHTML = locationOptions(country.value, '');
      location.dispatchEvent(new Event('change', { bubbles: true }));
    });
    window.ZeekeForm?.bind(card);
    updateNumbers();
  }

  function removeEntry(id) {
    entries = entries.filter(e => e !== id);
    const el = document.getElementById(`exp-${id}`);
    if (el) el.remove();
    updateNumbers();
  }

  function updateNumbers() {
    const cards = document.querySelectorAll('#exp-list .entry-card');
    cards.forEach((card, idx) => {
      card.querySelector('.entry-card-num').textContent = idx + 1;
    });
  }

  function addBullet(id) {
    const container = document.getElementById(`exp-bullets-${id}`);
    if (!container) return;
    container.insertAdjacentHTML('beforeend', `
      <div class="list-item-row">
        <span class="list-item-num">-</span>
        <textarea class="list-item-input exp-bullet-input" rows="1" maxlength="320" placeholder="Add a responsibility..."></textarea>
        <button type="button" class="list-item-remove" aria-label="Remove responsibility" title="Remove responsibility">${ReGenIcons.icon('trash')}</button>
      </div>
    `);
    const row = container.lastElementChild;
    window.ZeekeForm?.bind(row);
    const input = row?.querySelector('.exp-bullet-input');
    bindBulletRemoveButtons(container);
    input?.focus();
  }

  function bindBulletRemoveButtons(scope) {
    scope.querySelectorAll('.list-item-remove:not([data-bound])').forEach((button) => {
      button.dataset.bound = 'true';
      button.addEventListener('click', () => button.closest('.list-item-row')?.remove());
    });
  }

  function toggleCurrent(checkbox, parentId) {
    const endInput = document.querySelector(`#${parentId} .exp-end`);
    endInput.disabled = checkbox.checked;
    if (checkbox.checked) endInput.value = '';
  }

  function getData() {
    let isValid = true;
    const data = [];

    if (entries.length === 0) return { isValid: true, data: [] };

    entries.forEach(id => {
      const card = document.getElementById(`exp-${id}`);
      if (!card) return;

      const title   = card.querySelector('.exp-title');
      const company = card.querySelector('.exp-company');
      const start   = card.querySelector('.exp-start');
      const end     = card.querySelector('.exp-end');
      const isCurr  = card.querySelector('.exp-current').checked;

      [title, company, start].forEach(el => {
        if (!el.value.trim()) { el.classList.add('is-error'); isValid = false; }
        else el.classList.remove('is-error');
      });

      if (!isCurr && !end.value.trim()) { end.classList.add('is-error'); isValid = false; }
      else end.classList.remove('is-error');

      const bullets = Array.from(card.querySelectorAll('.exp-bullet-input'))
        .map(i => window.ZeekeSafe.value(i))
        .filter(b => b);

      if (isValid) {
        data.push({
          jobTitle:  window.ZeekeSafe.value(title),
          company:   window.ZeekeSafe.value(company),
          employmentType: window.ZeekeSafe.value(card.querySelector('.exp-type')),
          locationCountry: window.ZeekeSafe.value(card.querySelector('.exp-country')),
          location:  ZeekeLookups.formatLocation(
            window.ZeekeSafe.value(card.querySelector('.exp-country')),
            window.ZeekeSafe.value(card.querySelector('.exp-loc'))
          ),
          startDate: start.value,
          endDate:   isCurr ? 'Present' : end.value,
          bullets:   bullets
        });
      }
    });

    return { isValid, data: isValid ? data : null };
  }

  return { render, attachEvents, getData, removeEntry, addBullet, toggleCurrent };
})();
