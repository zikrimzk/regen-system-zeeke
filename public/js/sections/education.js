const EducationSection = (() => {
  let entries = [];
  let nextId = 0;
  const resultType = value => !value.trim() ? '' : /^\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)?$/.test(value.trim()) ? 'cgpa' : 'grade';
  const esc = value => window.ZeekeSafe.attr(value);
  const options = values => values.map(value => `<option value="${esc(value)}"></option>`).join('');
  const formatLocation = (location, country) => {
    if (!location) return country;
    if (/^remote$/i.test(location)) return location;
    return location.split(',').some(part => part.trim().toLowerCase() === country.toLowerCase())
      ? location : [location, country].filter(Boolean).join(', ');
  };

  function render(stepNum) {
    return `
      <div class="step-header">
        <div class="step-header-info"><div class="step-count">Step ${stepNum}</div>
          <h2 class="step-title">Education</h2><p class="step-subtitle">Add your most recent qualification first.</p>
        </div>
        <button type="button" class="skip-btn">Skip ${ReGenIcons.icon('arrowRight')}</button>
      </div>
      <div class="form-body form-section repeatable-form">
        <datalist id="edu-countries">${options(ZeekeLookups.COUNTRIES.filter(country => country !== 'Worldwide'))}</datalist>
        <datalist id="edu-states">${options(ZeekeLookups.MALAYSIA_STATES)}</datalist>
        <div id="edu-list" class="entry-cards"></div>
        <button type="button" class="add-entry-btn" id="btn-add-edu">${ReGenIcons.icon('add')} Add education</button>
      </div>`;
  }

  function attachEvents(data) {
    entries = [];
    (data || []).forEach(entry => addEntry(entry));
    document.getElementById('btn-add-edu').addEventListener('click', () => addEntry({}, true));
  }

  function addEntry(data, focus = false) {
    const id = ++nextId;
    entries.push(id);
    const current = data.endDate === 'Present';
    const savedCountry = data.institutionCountry ?? data.country ?? '';
    const country = savedCountry === 'Worldwide' ? '' : savedCountry;
    const parts = (data.location || '').split(',').map(part => part.trim());
    if (parts.at(-1).toLowerCase() === country.toLowerCase()) parts.pop();
    const region = parts.join(', ');
    document.getElementById('edu-list').insertAdjacentHTML('beforeend', `
      <div class="entry-card" id="edu-${id}">
        <div class="entry-card-header">
          <div class="entry-card-num">${entries.length}</div><div class="entry-card-title">Qualification</div>
          <button type="button" class="entry-delete-btn" aria-label="Remove education" title="Remove education">${ReGenIcons.icon('trash')}</button>
        </div>
        <div class="form-section">
          <div class="form-group">
            <label class="form-label" for="edu-inst-${id}">School or university <span class="req">*</span></label>
            <div class="lookup-field edu-inst-select">
              <input id="edu-inst-${id}" class="form-input edu-inst" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="edu-matches-${id}" value="${esc(data.institution)}" placeholder="e.g. UTM or your school's name" maxlength="220" autocomplete="off" spellcheck="false" required>
              <div class="lookup-results edu-matches" id="edu-matches-${id}" role="listbox" aria-label="Matching campuses" hidden></div>
            </div>
            <p class="form-hint edu-status" role="status">Pick a Malaysian campus to fill its location, or type any school.</p>
          </div>
          <div class="form-group">
            <label class="form-label" for="edu-degree-${id}">Qualification <span class="req">*</span></label>
            <input id="edu-degree-${id}" class="form-input edu-degree" value="${esc(data.degree)}" placeholder="e.g. Diploma in Information Technology" maxlength="160" data-suggestions="qualifications" required>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="edu-loc-${id}">City or state <span class="field-optional">Optional</span></label>
              <input id="edu-loc-${id}" class="form-input edu-loc" value="${esc(region)}" placeholder="e.g. Johor" maxlength="150" ${country === 'Malaysia' ? 'list="edu-states"' : ''}>
            </div>
            <div class="form-group">
              <label class="form-label" for="edu-country-${id}">Country <span class="field-optional">Optional</span></label>
              <input id="edu-country-${id}" class="form-input edu-country" value="${esc(country)}" placeholder="e.g. Malaysia" maxlength="80" list="edu-countries">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="edu-start-${id}">Start date <span class="field-optional">Optional</span></label>
              <input id="edu-start-${id}" type="month" class="form-input edu-start" value="${esc(data.startDate)}">
            </div>
            <div class="form-group">
              <label class="form-label" for="edu-end-${id}">End date <span class="field-optional">Optional</span></label>
              <input id="edu-end-${id}" type="month" class="form-input edu-end" value="${current ? '' : esc(data.endDate)}" ${current ? 'disabled' : ''}>
              <div class="check-row"><input type="checkbox" class="edu-current" id="edu-current-${id}" ${current ? 'checked' : ''}><label for="edu-current-${id}">I’m still studying here</label></div>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="edu-cgpa-${id}">CGPA or grade <span class="field-optional">Optional</span></label>
            <input id="edu-cgpa-${id}" class="form-input edu-cgpa" data-academic-result="true" value="${esc(data.cgpa)}" placeholder="e.g. 3.89/4.00 or First Class" maxlength="80">
          </div>
        </div>
      </div>`);
    const card = document.getElementById(`edu-${id}`);
    bindEntry(card, id);
    window.ZeekeForm?.bind(card);
    if (focus) card.querySelector('.edu-inst').focus();
  }

  function bindEntry(card, id) {
    const inst = card.querySelector('.edu-inst');
    const menu = card.querySelector('.edu-matches');
    const location = card.querySelector('.edu-loc');
    const country = card.querySelector('.edu-country');
    const status = card.querySelector('.edu-status');
    let timer, request, results = [], active = -1, selected = inst.value;
    let autoLocation = '';

    function close() {
      clearTimeout(timer);
      request?.abort();
      request = undefined;
      menu.hidden = true;
      inst.setAttribute('aria-expanded', 'false');
      inst.removeAttribute('aria-activedescendant');
      active = -1;
    }

    function refreshRegions() {
      if (country.value.trim().toLowerCase() === 'malaysia') location.setAttribute('list', 'edu-states');
      else location.removeAttribute('list');
    }

    function select(index) {
      const item = results[index];
      if (!item) return;
      close();
      inst.value = selected = item.name;
      country.value = item.country;
      location.value = autoLocation = item.location;
      refreshRegions();
      status.textContent = `Location filled: ${item.location}, ${item.country}.`;
      inst.dispatchEvent(new Event('change', { bubbles: true }));
      inst.focus({ preventScroll: true });
    }

    function search() {
      close();
      const query = inst.value.trim();
      const scope = country.value.trim();
      if (query.length < 2 || query === selected) return;
      timer = setTimeout(async () => {
        const controller = request = new AbortController();
        const matches = await ZeekeLookups.searchInstitutions(query, scope, controller.signal) || [];
        if (request !== controller || !inst.isConnected || document.activeElement !== inst) return;
        results = matches;
        if (!results.length) {
          status.textContent = 'Keep the name you typed and enter the location if you know it.';
          return;
        }
        menu.innerHTML = results.map((item, i) => `<div id="edu-match-${id}-${i}" role="option" aria-selected="false" class="lookup-option" data-match="${i}"><span class="lookup-title">${esc(item.name)}</span><span class="lookup-meta">${esc(item.location)}, ${esc(item.country)}</span></div>`).join('');
        menu.hidden = false;
        inst.setAttribute('aria-expanded', 'true');
        status.textContent = `${results.length} matching ${results.length === 1 ? 'campus' : 'campuses'}.`;
      }, 180);
    }

    inst.addEventListener('input', () => {
      if (inst.value !== selected) {
        selected = '';
        if (autoLocation && location.value === autoLocation) location.value = '';
        autoLocation = '';
        status.textContent = 'Pick a Malaysian campus, or keep the name you type.';
      }
      search();
    });
    inst.addEventListener('focus', search);
    inst.addEventListener('blur', close);
    inst.addEventListener('keydown', event => {
      if (menu.hidden || event.isComposing) return;
      if (event.key === 'Escape') { event.preventDefault(); close(); return; }
      if (event.key === 'Enter' && active >= 0) { event.preventDefault(); select(active); return; }
      if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
      event.preventDefault();
      active = event.key === 'ArrowDown' ? (active + 1) % results.length : (active <= 0 ? results.length - 1 : active - 1);
      [...menu.children].forEach((option, i) => option.setAttribute('aria-selected', String(i === active)));
      inst.setAttribute('aria-activedescendant', menu.children[active].id);
      menu.children[active].scrollIntoView({ block: 'nearest' });
    });
    menu.addEventListener('mousedown', event => event.preventDefault());
    menu.addEventListener('click', event => {
      const option = event.target.closest('[data-match]');
      if (option) select(Number(option.dataset.match));
    });
    country.addEventListener('input', refreshRegions);
    location.addEventListener('input', () => { autoLocation = ''; });
    card.querySelector('.edu-current').addEventListener('change', event => {
      card.querySelector('.edu-end').disabled = event.target.checked;
    });
    card.querySelector('.entry-delete-btn').addEventListener('click', () => {
      close();
      entries = entries.filter(entry => entry !== id);
      card.remove();
      document.getElementById('btn-add-edu').focus({ preventScroll: true });
    });
  }

  function getPreviewData() {
    return FormCards.ordered(entries, 'edu-list').map(id => {
      const card = document.getElementById(`edu-${id}`);
      const value = selector => window.ZeekeSafe.value(card.querySelector(selector));
      const country = value('.edu-country'), cgpa = value('.edu-cgpa');
      return {
        degree: value('.edu-degree'), institution: value('.edu-inst'), institutionCountry: country,
        location: formatLocation(value('.edu-loc'), country), cgpa, academicResultType: resultType(cgpa),
        startDate: value('.edu-start'), endDate: card.querySelector('.edu-current').checked ? 'Present' : value('.edu-end')
      };
    }).filter(entry => entry.degree || entry.institution || entry.cgpa || entry.startDate || entry.endDate);
  }

  function getData() {
    const data = getPreviewData();
    return { isValid: data.every(entry => entry.degree && entry.institution), data };
  }

  return { render, attachEvents, getData, getPreviewData };
})();
