const ReferencesSection = (() => {
  let entries = [];

  function countryOptions(selected = 'Malaysia') {
    return ZeekeLookups.COUNTRIES.filter(country => country !== 'Worldwide').map(country =>
      `<option value="${window.ZeekeSafe.attr(country)}" ${country === selected ? 'selected' : ''}>${window.ZeekeSafe.attr(country)}</option>`
    ).join('');
  }
  
  function render(stepNum) {
    return `
      <div class="step-header">
        <div class="step-header-info">
          <div class="step-count">Step ${stepNum}</div>
          <h2 class="step-title">References</h2>
          <p class="step-subtitle">Up to two references.</p>
        </div>
        <button type="button" class="skip-btn">Skip Step ${ReGenIcons.icon('arrowRight')}</button>
      </div>
      <div class="form-body form-section">
        <div id="ref-list" class="entry-cards"></div>
        <button type="button" class="add-entry-btn" id="btn-add-ref">${ReGenIcons.icon('add')} Add Reference</button>
      </div>
    `;
  }

  function renderForm(id, data = {}) {
    const esc = window.ZeekeSafe.attr;
    return `
      <div class="entry-card" id="ref-${id}">
        <div class="entry-card-header">
          <div class="entry-card-num">${entries.length + 1}</div>
          <div class="entry-card-title">Reference Entry</div>
          <button type="button" class="entry-delete-btn" onclick="ReferencesSection.removeEntry(${id})" aria-label="Remove reference" title="Remove reference">${ReGenIcons.icon('trash')}</button>
        </div>
        <div class="form-section">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Full Name <span class="req">*</span></label>
              <input type="text" class="form-input ref-name" value="${esc(data.name)}" placeholder="e.g. Dr. Jane Smith" maxlength="120" autocomplete="name" required>
            </div>
            <div class="form-group">
              <label class="form-label">Position & Company</label>
              <input type="text" class="form-input ref-pos" value="${esc(data.position)}" placeholder="e.g. Professor, University of Malaya" maxlength="180">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Email</label>
              <input type="email" class="form-input ref-email" value="${esc(data.email)}" placeholder="jane.smith@email.com" maxlength="200" autocomplete="email">
            </div>
            <div class="form-group">
              <label class="form-label">Phone Country</label>
              <select class="form-select ref-country">${countryOptions(data.phoneCountry || 'Malaysia')}</select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Phone Number</label>
              <input type="tel" class="form-input ref-phone" data-phone-country=".ref-country" value="${esc(data.phone)}" placeholder="e.g. 012-345 6789" maxlength="30" autocomplete="tel" inputmode="tel">
            </div>
            <div class="form-group"></div>
          </div>
        </div>
      </div>
    `;
  }

  function attachEvents(data) {
    entries = [];
    document.getElementById('ref-list').innerHTML = '';
    
    if (data && data.length) {
      data.forEach(d => addEntry(d));
    }

    document.getElementById('btn-add-ref').addEventListener('click', () => {
      if (entries.length >= 4) {
        App.showToast('Maximum 4 references allowed.', 'error');
        return;
      }
      addEntry();
    });
  }

  function addEntry(data = {}) {
    const id = Date.now() + Math.floor(Math.random()*1000);
    entries.push(id);
    document.getElementById('ref-list').insertAdjacentHTML('beforeend', renderForm(id, data));
    window.ZeekeForm?.bind(document.getElementById(`ref-${id}`));
    updateNumbers();
  }

  function removeEntry(id) {
    entries = entries.filter(e => e !== id);
    const el = document.getElementById(`ref-${id}`);
    if (el) el.remove();
    updateNumbers();
  }

  function updateNumbers() {
    const cards = document.querySelectorAll('#ref-list .entry-card');
    cards.forEach((card, idx) => {
      card.querySelector('.entry-card-num').textContent = idx + 1;
    });
  }

  function getData() {
    let isValid = true;
    const data = [];

    if (entries.length === 0) return { isValid: true, data: [] };

    entries.forEach(id => {
      const card = document.getElementById(`ref-${id}`);
      if (!card) return;

      const name = card.querySelector('.ref-name');
      const pos  = card.querySelector('.ref-pos');

      [name].forEach(el => {
        if (!el.value.trim()) { el.classList.add('is-error'); isValid = false; }
        else el.classList.remove('is-error');
      });
      pos.classList.remove('is-error');

      if (isValid) {
        data.push({
          name:     window.ZeekeSafe.value(name),
          position: window.ZeekeSafe.value(pos),
          email:    window.ZeekeSafe.value(card.querySelector('.ref-email')),
          phone:    window.ZeekeSafe.value(card.querySelector('.ref-phone')),
          phoneCountry: window.ZeekeSafe.value(card.querySelector('.ref-country'))
        });
      }
    });

    return { isValid, data: isValid ? data : null };
  }

  function getPreviewData() {
    return Array.from(document.querySelectorAll('#ref-list .entry-card')).map(card => ({
      name:     window.ZeekeSafe.value(card.querySelector('.ref-name')),
      position: window.ZeekeSafe.value(card.querySelector('.ref-pos')),
      email:    window.ZeekeSafe.value(card.querySelector('.ref-email')),
      phone:    window.ZeekeSafe.value(card.querySelector('.ref-phone')),
      phoneCountry: window.ZeekeSafe.value(card.querySelector('.ref-country')),
    })).filter(ref => ref.name || ref.position || ref.email || ref.phone);
  }

  return { render, attachEvents, getData, getPreviewData, removeEntry };
})();
