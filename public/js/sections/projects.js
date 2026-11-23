const ProjectsSection = (() => {
  let entries = [];
  let nextId = 0;

  function projectTypeOptions(selected = '') {
    const values = ['', 'Academic Project', 'Final Year Project', 'Personal Project', 'Professional Project', 'Research Project', 'Open Source', 'Hackathon', 'Volunteer Project'];
    if (selected && !values.includes(selected)) values.push(selected);
    return values.map(value => `<option value="${window.ZeekeSafe.attr(value)}" ${value === selected ? 'selected' : ''}>${window.ZeekeSafe.attr(value || 'No project type')}</option>`).join('');
  }
  
  function render(stepNum) {
    return `
      <div class="step-header">
        <div class="step-header-info">
          <div class="step-count">Step ${stepNum}</div>
          <h2 class="step-title">Projects</h2>
          <p class="step-subtitle">Show what you built and what you contributed.</p>
        </div>
        <button type="button" class="skip-btn">Skip ${ReGenIcons.icon('arrowRight')}</button>
      </div>
      <div class="form-body form-section repeatable-form">
        <div id="proj-list" class="entry-cards"></div>
        <button type="button" class="add-entry-btn" id="btn-add-proj">${ReGenIcons.icon('add')} Add Project</button>
      </div>
    `;
  }

  function renderForm(id, data = {}) {
    const bullets = [...new Set([...(data.bullets || []), ...ReGenPoints.lines(data.description || '')])];
    const esc = window.ZeekeSafe.attr;
    return `
      <div class="entry-card" id="proj-${id}">
        <div class="entry-card-header">
          <div class="entry-card-num">${entries.length + 1}</div>
          <div class="entry-card-title">Project Entry</div>
          <button type="button" class="entry-delete-btn" aria-label="Remove project" title="Remove project">${ReGenIcons.icon('trash')}</button>
        </div>
        <div class="form-section">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Project Title <span class="req">*</span></label>
              <input type="text" class="form-input proj-title" value="${esc(data.title)}" placeholder="e.g. Resume Builder Web Application" maxlength="160" required>
            </div>
            <div class="form-group">
              <label class="form-label">Project type <span class="field-optional">Optional</span></label>
              <select class="form-select proj-type">${projectTypeOptions(data.type || '')}</select>
            </div>
          </div>
          <div class="form-group form-group-full">
            <label class="form-label" for="proj-points-${id}">Contributions <span class="field-optional">Optional</span></label>
            <textarea id="proj-points-${id}" class="points-editor proj-bullet-input" data-preserve-spaces="true" rows="4" maxlength="16000" placeholder="e.g. Built a booking form in React and tested it with five users">${esc(ReGenPoints.format(bullets))}</textarea><p class="points-hint">One contribution per line.</p>
          </div>
        </div>
      </div>
    `;
  }

  function attachEvents(data) {
    entries = [];
    document.getElementById('proj-list').innerHTML = '';
    
    if (data && data.length) {
      data.forEach(d => addEntry(d));
    }

    document.getElementById('btn-add-proj').addEventListener('click', () => addEntry());
  }

  function addEntry(data = {}) {
    const id = ++nextId;
    entries.push(id);
    document.getElementById('proj-list').insertAdjacentHTML('beforeend', renderForm(id, data));
    const card = document.getElementById(`proj-${id}`);
    card.querySelector('.entry-delete-btn')?.addEventListener('click', () => removeEntry(id));
    ReGenPoints.bind(card);
    window.ZeekeForm?.bind(card);
    updateNumbers();
  }

  function removeEntry(id) {
    entries = entries.filter(e => e !== id);
    const el = document.getElementById(`proj-${id}`);
    if (el) el.remove();
    updateNumbers();
  }

  function updateNumbers() {
    const cards = document.querySelectorAll('#proj-list .entry-card');
    cards.forEach((card, idx) => {
      card.querySelector('.entry-card-num').textContent = idx + 1;
    });
  }

  function getData(validate = true) {
    let isValid = true;
    const data = [];

    if (entries.length === 0) return { isValid: true, data: [] };

    FormCards.ordered(entries, 'proj-list').forEach(id => {
      const card = document.getElementById(`proj-${id}`);
      if (!card) return;

      const title = card.querySelector('.proj-title');
      if (validate && !title.value.trim()) { title.classList.add('is-error'); isValid = false; }
      else if (validate) title.classList.remove('is-error');

      const bullets = ReGenPoints.lines(card.querySelector('.proj-bullet-input').value);

      if (isValid || !validate) {
        data.push({
          title:       window.ZeekeSafe.value(title),
          type:        window.ZeekeSafe.value(card.querySelector('.proj-type')),
          bullets:     bullets
        });
      }
    });

    return { isValid, data: isValid || !validate ? data : null };
  }

  return { render, attachEvents, getData, getWorkingData: () => getData(false).data, removeEntry };
})();
