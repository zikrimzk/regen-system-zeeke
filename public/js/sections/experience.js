const ExperienceSection = (() => {
  let entries = [];
  let nextId = 0;

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
          <h2 class="step-title">Experience</h2>
          <p class="step-subtitle">Your work, and the difference you made.</p>
        </div>
        <button type="button" class="skip-btn">Skip ${ReGenIcons.icon('arrowRight')}</button>
      </div>
      <div class="form-body form-section repeatable-form">
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
            <label class="form-label" for="exp-points-${id}">Contributions</label>
            <textarea id="exp-points-${id}" class="points-editor exp-bullet-input" data-preserve-spaces="true" rows="4" maxlength="16000" placeholder="e.g. Automated weekly reports and saved the team two hours">${esc(ReGenPoints.format(bullets))}</textarea><p class="points-hint">One contribution per line.</p>
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
    const id = ++nextId;
    entries.push(id);
    document.getElementById('exp-list').insertAdjacentHTML('beforeend', renderForm(id, data));
    const card = document.getElementById(`exp-${id}`);
    const country = card.querySelector('.exp-country');
    const location = card.querySelector('.exp-loc');
    card.querySelector('.entry-delete-btn')?.addEventListener('click', () => removeEntry(id));
    card.querySelector('.exp-current')?.addEventListener('change', (event) => {
      toggleCurrent(event.currentTarget, `exp-${id}`);
    });
    ReGenPoints.bind(card);
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

  function toggleCurrent(checkbox, parentId) {
    const endInput = document.querySelector(`#${parentId} .exp-end`);
    endInput.disabled = checkbox.checked;
    if (checkbox.checked) endInput.value = '';
  }

  function getData(validate = true) {
    let isValid = true;
    const data = [];

    if (entries.length === 0) return { isValid: true, data: [] };

    FormCards.ordered(entries, 'exp-list').forEach(id => {
      const card = document.getElementById(`exp-${id}`);
      if (!card) return;

      const title   = card.querySelector('.exp-title');
      const company = card.querySelector('.exp-company');
      const start   = card.querySelector('.exp-start');
      const end     = card.querySelector('.exp-end');
      const isCurr  = card.querySelector('.exp-current').checked;

      [title, company, start].forEach(el => {
        if (!validate) return;
        if (!el.value.trim()) { el.classList.add('is-error'); isValid = false; }
        else el.classList.remove('is-error');
      });

      if (validate && !isCurr && !end.value.trim()) { end.classList.add('is-error'); isValid = false; }
      else if (validate) end.classList.remove('is-error');

      const bullets = ReGenPoints.lines(card.querySelector('.exp-bullet-input').value);

      if (isValid || !validate) {
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

    return { isValid, data: isValid || !validate ? data : null };
  }

  return { render, attachEvents, getData, getWorkingData: () => getData(false).data, removeEntry, toggleCurrent };
})();
