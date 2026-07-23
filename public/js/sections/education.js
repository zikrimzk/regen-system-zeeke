const EducationSection = (() => {
  let entries = [];
  const institutionMatches = new Map();

  function countryOptions(selected = 'Malaysia') {
    return ZeekeLookups.COUNTRIES.map(country =>
      `<option value="${window.ZeekeSafe.attr(country)}" ${country === selected ? 'selected' : ''}>${window.ZeekeSafe.attr(country)}</option>`
    ).join('');
  }

  function locationOptions(country = 'Malaysia', selected = '') {
    return ZeekeLookups.regionOptions(country, selected).map(option =>
      `<option value="${window.ZeekeSafe.attr(option.value)}" ${option.selected ? 'selected' : ''}>${window.ZeekeSafe.attr(option.label)}</option>`
    ).join('');
  }

  function inferAcademicResultType(value) {
    const cleaned = String(value || '').trim();
    if (!cleaned) return '';
    // If purely numbers and decimals (with optional spaces/slashes for something like 4.0 / 4.0), it's CGPA
    if (/^[0-9]+(?:\.[0-9]+)?(?:\s*\/\s*[0-9]+(?:\.[0-9]+)?)?$/.test(cleaned)) return 'cgpa';
    // Anything else with letters or symbols is considered Grade
    return 'grade';
  }

  function academicHint(value) {
    const type = inferAcademicResultType(value);
    if (type === 'cgpa') return 'Will show as CGPA in the resume.';
    if (type === 'grade') return 'Will show as Grade in the resume.';
    return 'Numbers are shown as CGPA; letter results are shown as Grade.';
  }
  
  function render(stepNum) {
    return `
      <div class="step-header">
        <div class="step-header-info">
          <div class="step-count">Step ${stepNum}</div>
          <h2 class="step-title">Education Background</h2>
          <p class="step-subtitle">Qualifications and institutions.</p>
        </div>
        <button type="button" class="skip-btn">Skip Step ${ReGenIcons.icon('arrowRight')}</button>
      </div>
      <div class="form-body form-section">
        <div id="edu-list" class="entry-cards"></div>
        <button type="button" class="add-entry-btn" id="btn-add-edu">${ReGenIcons.icon('add')} Add Education</button>
      </div>
    `;
  }

  function renderForm(id, data = {}) {
    const isCurrent = data.endDate === 'Present';
    const esc = window.ZeekeSafe.attr;
    return `
      <div class="entry-card" id="edu-${id}">
        <div class="entry-card-header">
          <div class="entry-card-num">${entries.length + 1}</div>
          <div class="entry-card-title">Education Entry</div>
          <button type="button" class="entry-delete-btn" onclick="EducationSection.removeEntry(${id})" aria-label="Remove education" title="Remove education">${ReGenIcons.icon('trash')}</button>
        </div>
        <div class="form-section">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Degree / Qualification <span class="req">*</span></label>
              <input type="text" class="form-input edu-degree" value="${esc(data.degree)}" placeholder="e.g. Diploma in Information Technology" maxlength="160" autocomplete="organization-title" data-suggestions="qualifications" required>
            </div>
            <div class="form-group">
              <label class="form-label">Institution Country / Scope</label>
              <select class="form-select edu-country">${countryOptions(data.institutionCountry || data.country || 'Malaysia')}</select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Institution <span class="req">*</span></label>
              <div class="lookup-field edu-inst-select">
                <input type="text" class="form-input edu-inst" data-preserve-spaces="true" value="${esc(data.institution)}" placeholder="e.g. Universiti Teknologi PETRONAS" maxlength="220" autocomplete="organization" spellcheck="false" required>
              </div>
              <div class="lookup-results hidden" id="edu-inst-menu-${id}"></div>
              <div class="form-hint edu-inst-hint">Type freely. Matching institutions appear below when available.</div>
            </div>
            <div class="form-group">
              <label class="form-label">State / Location</label>
              <select class="form-select edu-loc">${locationOptions(data.institutionCountry || data.country || 'Malaysia', data.location || '')}</select>
              <div class="form-hint">Location choices follow the institution country.</div>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">CGPA / Grade</label>
              <input type="text" class="form-input edu-cgpa" data-academic-result="true" value="${esc(data.cgpa)}" placeholder="e.g. 3.89 or 5A+ 2A 3B" maxlength="80">
              <div class="form-hint edu-cgpa-hint">${academicHint(data.cgpa)}</div>
            </div>
            <div class="form-group">
              <label class="form-label">Start Date <span class="req">*</span></label>
              <input type="month" class="form-input edu-start" value="${esc(data.startDate)}" required>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">End Date <span class="req">*</span></label>
              <input type="month" class="form-input edu-end" value="${isCurrent ? '' : esc(data.endDate)}" ${isCurrent ? 'disabled' : ''} required>
              <div class="check-row">
                <input type="checkbox" class="edu-current" id="edu-curr-${id}" ${isCurrent ? 'checked' : ''} onchange="EducationSection.toggleCurrent(this, 'edu-${id}')">
                <label for="edu-curr-${id}">Currently studying here</label>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function attachEvents(data) {
    entries = [];
    document.getElementById('edu-list').innerHTML = '';
    
    if (data && data.length) {
      data.forEach(d => addEntry(d));
      enforceSingleCurrent();
    }

    document.getElementById('btn-add-edu').addEventListener('click', () => addEntry());
  }

  function addEntry(data = {}) {
    const id = Date.now() + Math.floor(Math.random()*1000);
    entries.push(id);
    document.getElementById('edu-list').insertAdjacentHTML('beforeend', renderForm(id, data));
    bindEntryEvents(id);
    window.ZeekeForm?.bind(document.getElementById(`edu-${id}`));
    updateNumbers();
  }

  function removeEntry(id) {
    entries = entries.filter(e => e !== id);
    const el = document.getElementById(`edu-${id}`);
    if (el) el.remove();
    updateNumbers();
  }

  function updateNumbers() {
    const cards = document.querySelectorAll('#edu-list .entry-card');
    cards.forEach((card, idx) => {
      card.querySelector('.entry-card-num').textContent = idx + 1;
    });
  }

  function toggleCurrent(checkbox, parentId) {
    if (checkbox.checked) {
      document.querySelectorAll('#edu-list .edu-current').forEach(other => {
        if (other !== checkbox) {
          other.checked = false;
          const otherEnd = other.closest('.entry-card')?.querySelector('.edu-end');
          if (otherEnd) {
            otherEnd.disabled = false;
          }
        }
      });
      const endInput = document.querySelector(`#${parentId} .edu-end`);
      if (endInput) {
        endInput.disabled = true;
        endInput.value = '';
      }
    } else {
      const endInput = document.querySelector(`#${parentId} .edu-end`);
      if (endInput) {
        endInput.disabled = false;
      }
    }
  }

  function enforceSingleCurrent() {
    let found = false;
    document.querySelectorAll('#edu-list .edu-current').forEach(checkbox => {
      const endInput = checkbox.closest('.entry-card')?.querySelector('.edu-end');
      if (checkbox.checked && !found) {
        found = true;
        if (endInput) {
          endInput.disabled = true;
          endInput.value = '';
        }
      } else {
        checkbox.checked = false;
        if (endInput) endInput.disabled = false;
      }
    });
  }

  function bindEntryEvents(id) {
    const card = document.getElementById(`edu-${id}`);
    if (!card) return;
    const inst = card.querySelector('.edu-inst');
    const country = card.querySelector('.edu-country');
    const cgpa = card.querySelector('.edu-cgpa');
    const debouncedSearch = ZeekeLookups.debounce(() => updateInstitutionSuggestions(card), 420);

    inst.addEventListener('input', () => {
      inst.dataset.selectedLookup = '';
      const hint = card.querySelector('.edu-inst-hint');
      if (hint) hint.textContent = 'Free text will be saved exactly as typed.';
      debouncedSearch();
    });

    inst.addEventListener('focus', () => {
      if (inst.value.trim().length >= 2) debouncedSearch();
    });

    // Hide suggestions when clicking outside
    document.addEventListener('click', (e) => {
      if (!card.querySelector('.edu-inst-select').contains(e.target) && !card.querySelector('.lookup-results').contains(e.target)) {
        hideInstitutionMenu(card);
      }
    });

    country.addEventListener('change', () => {
      institutionMatches.delete(card.id);
      hideInstitutionMenu(card);
      card.querySelector('.edu-loc').innerHTML = locationOptions(country.value, '');
      card.querySelector('.edu-loc').dispatchEvent(new Event('change', { bubbles: true }));
      if (inst.value.trim().length >= 2) debouncedSearch();
    });

    cgpa.addEventListener('input', () => {
      updateAcademicHint(card);
      if (typeof Stepper !== 'undefined' && typeof Preview !== 'undefined') {
        Preview.renderDraft(Stepper.getDraftResume());
      }
    });
    updateAcademicHint(card);
  }

  async function updateInstitutionSuggestions(card) {
    const inst = card.querySelector('.edu-inst');
    const hint = card.querySelector('.edu-inst-hint');
    const query = inst.value.trim();
    if (query.length < 2) {
      hideInstitutionMenu(card);
      if (hint) hint.textContent = 'Type at least 2 characters before searching, or just keep your typed institution.';
      return;
    }

    if (hint) hint.textContent = 'Searching...';
    const country = card.querySelector('.edu-country').value || 'Malaysia';
    card.dataset.lookupQuery = `${country}:${query}`;
    const results = await ZeekeLookups.searchInstitutions(query, country);
    if (card.dataset.lookupQuery !== `${country}:${query}`) return;
    institutionMatches.set(card.id, results);
    renderInstitutionMenu(card, results);
    if (hint) hint.textContent = results.length
      ? 'Pick a result to auto-fill location, or ignore it and keep your typed institution.'
      : 'No matches found. Your typed institution will be saved as is.';
  }

  function renderInstitutionMenu(card, results) {
    const menu = card.querySelector('.lookup-results');
    const inst = card.querySelector('.edu-inst');
    if (!menu || !inst) return;

    if (!results.length) {
      menu.innerHTML = `
        <div class="lookup-empty">No API match. The resume will use "${window.ZeekeSafe.attr(inst.value.trim())}".</div>
      `;
      menu.classList.remove('hidden');
      return;
    }

    menu.innerHTML = results.map((item, idx) => {
      const meta = [item.location, item.type, item.source].filter(Boolean).join(' - ');
      return `
        <button type="button" class="lookup-option" data-index="${idx}">
          <span class="lookup-title">${window.ZeekeSafe.attr(item.name)}</span>
          ${meta ? `<span class="lookup-meta">${window.ZeekeSafe.attr(meta)}</span>` : ''}
        </button>
      `;
    }).join('');

    menu.querySelectorAll('.lookup-option').forEach((btn) => {
      btn.addEventListener('click', () => {
        const item = results[Number(btn.dataset.index)];
        selectInstitution(card, item);
      });
    });

    menu.classList.remove('hidden');
  }

  function hideInstitutionMenu(card) {
    const menu = card.querySelector('.lookup-results');
    menu?.classList.add('hidden');
  }

  function selectInstitution(card, match) {
    if (!match) return;
    const inst = card.querySelector('.edu-inst');
    const loc = card.querySelector('.edu-loc');
    inst.value = match.name || inst.value;
    inst.dataset.selectedLookup = match.source || 'lookup';
    const mappedLocation = cleanMappedLocation(match);
    if (mappedLocation) {
      loc.innerHTML = locationOptions(card.querySelector('.edu-country').value, mappedLocation);
      loc.dataset.autofilled = 'true';
      loc.dispatchEvent(new Event('change', { bubbles: true }));
    }
    inst.dispatchEvent(new Event('change', { bubbles: true }));
    hideInstitutionMenu(card);
  }

  function cleanMappedLocation(match) {
    const name = String(match?.name || '').trim().toLowerCase();
    const parts = String(match?.location || match?.country || '')
      .split(',')
      .map(part => part.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .filter(part => !['university', 'educational institution', 'wikidata', 'hipolabs'].includes(part.toLowerCase()))
      .filter(part => part.toLowerCase() !== name);
    return Array.from(new Set(parts.map(part => part.toLowerCase())))
      .map(key => parts.find(part => part.toLowerCase() === key))
      .filter(Boolean)
      .join(', ');
  }

  function updateAcademicHint(card) {
    const input = card.querySelector('.edu-cgpa');
    const hint = card.querySelector('.edu-cgpa-hint');
    if (hint) hint.textContent = academicHint(input.value);
  }

  function getData() {
    let isValid = true;
    const data = [];

    if (entries.length === 0) return { isValid: true, data: [] };

    entries.forEach(id => {
      const card = document.getElementById(`edu-${id}`);
      if (!card) return;

      const degree = card.querySelector('.edu-degree');
      const inst   = card.querySelector('.edu-inst');
      const start  = card.querySelector('.edu-start');
      const end    = card.querySelector('.edu-end');
      const isCurr = card.querySelector('.edu-current').checked;

      [degree, inst, start].forEach(el => {
        if (!el.value.trim()) { el.classList.add('is-error'); isValid = false; }
        else el.classList.remove('is-error');
      });

      if (!isCurr && !end.value.trim()) { end.classList.add('is-error'); isValid = false; }
      else end.classList.remove('is-error');

      if (isValid) {
        data.push({
          degree:      window.ZeekeSafe.value(degree),
          institution: window.ZeekeSafe.value(inst),
          institutionCountry: window.ZeekeSafe.value(card.querySelector('.edu-country')),
          location:    ZeekeLookups.formatLocation(
            window.ZeekeSafe.value(card.querySelector('.edu-country')),
            window.ZeekeSafe.value(card.querySelector('.edu-loc'))
          ),
          cgpa:        window.ZeekeSafe.value(card.querySelector('.edu-cgpa')),
          academicResultType: inferAcademicResultType(card.querySelector('.edu-cgpa').value),
          startDate:   start.value,
          endDate:     isCurr ? 'Present' : end.value
        });
      }
    });

    return { isValid, data: isValid ? data : null };
  }

  function getPreviewData() {
    return entries.map(id => {
      const card = document.getElementById(`edu-${id}`);
      if (!card) return null;
      const cgpa = card.querySelector('.edu-cgpa')?.value || '';
      return {
        degree: card.querySelector('.edu-degree')?.value || '',
        institution: card.querySelector('.edu-inst')?.value || '',
        institutionCountry: card.querySelector('.edu-country')?.value || '',
        location: ZeekeLookups.formatLocation(
          card.querySelector('.edu-country')?.value || '',
          card.querySelector('.edu-loc')?.value || ''
        ),
        cgpa,
        academicResultType: inferAcademicResultType(cgpa),
        startDate: card.querySelector('.edu-start')?.value || '',
        endDate: card.querySelector('.edu-current')?.checked ? 'Present' : (card.querySelector('.edu-end')?.value || '')
      };
    }).filter(Boolean);
  }

  return { render, attachEvents, getData, getPreviewData, removeEntry, toggleCurrent };
})();
