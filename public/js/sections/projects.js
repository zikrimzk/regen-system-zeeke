const ProjectsSection = (() => {
  let entries = [];

  function projectTypeOptions(selected = '') {
    const values = ['', 'Academic Project', 'Final Year Project', 'Personal Project', 'Professional Project', 'Research Project', 'Open Source', 'Hackathon', 'Volunteer Project'];
    if (selected && !values.includes(selected)) values.push(selected);
    return values.map(value => `<option value="${window.ZeekeSafe.attr(value)}" ${value === selected ? 'selected' : ''}>${value || 'Select project type'}</option>`).join('');
  }
  
  function render(stepNum) {
    return `
      <div class="step-header">
        <div class="step-header-info">
          <div class="step-count">Step ${stepNum}</div>
          <h2 class="step-title">Academic & Personal Projects</h2>
          <p class="step-subtitle">Selected project work.</p>
        </div>
        <button type="button" class="skip-btn">Skip Step ${ReGenIcons.icon('arrowRight')}</button>
      </div>
      <div class="form-body form-section">
        <div id="proj-list" class="entry-cards"></div>
        <button type="button" class="add-entry-btn" id="btn-add-proj">${ReGenIcons.icon('add')} Add Project</button>
      </div>
    `;
  }

  function renderForm(id, data = {}) {
    const bullets = data.bullets || [''];
    const esc = window.ZeekeSafe.attr;
    return `
      <div class="entry-card" id="proj-${id}">
        <div class="entry-card-header">
          <div class="entry-card-num">${entries.length + 1}</div>
          <div class="entry-card-title">Project Entry</div>
          <button type="button" class="entry-delete-btn" onclick="ProjectsSection.removeEntry(${id})" aria-label="Remove project" title="Remove project">${ReGenIcons.icon('trash')}</button>
        </div>
        <div class="form-section">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Project Title <span class="req">*</span></label>
              <input type="text" class="form-input proj-title" value="${esc(data.title)}" placeholder="e.g. Resume Builder Web Application" maxlength="160" required>
            </div>
            <div class="form-group">
              <label class="form-label">Type / Category</label>
              <select class="form-select proj-type">${projectTypeOptions(data.type || '')}</select>
            </div>
          </div>
          <div class="form-group form-group-full">
            <label class="form-label">Short Description</label>
            <input type="text" class="form-input proj-desc" value="${esc(data.description)}" placeholder="e.g. Developed a full-stack web application for resume creation." maxlength="260">
          </div>
          <div class="form-group form-group-full">
            <label class="form-label">Key Details & Technologies</label>
            <div class="list-editor" id="proj-bullets-${id}">
              ${bullets.map(b => `
                <div class="list-item-row">
                  <span class="list-item-num">-</span>
                  <textarea class="list-item-input proj-bullet-input" rows="2" maxlength="320" placeholder="e.g. Used React, Node.js, and MongoDB">${esc(b)}</textarea>
                  <button type="button" class="list-item-remove" onclick="this.parentElement.remove()" aria-label="Remove project detail" title="Remove project detail">${ReGenIcons.icon('trash')}</button>
                </div>
              `).join('')}
            </div>
            <button type="button" class="btn btn-secondary btn-sm mt-sm" onclick="ProjectsSection.addBullet(${id})">${ReGenIcons.icon('add')} Add Bullet</button>
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
    const id = Date.now() + Math.floor(Math.random()*1000);
    entries.push(id);
    document.getElementById('proj-list').insertAdjacentHTML('beforeend', renderForm(id, data));
    window.ZeekeForm?.bind(document.getElementById(`proj-${id}`));
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

  function addBullet(id) {
    const container = document.getElementById(`proj-bullets-${id}`);
    if (!container) return;
    container.insertAdjacentHTML('beforeend', `
      <div class="list-item-row">
        <span class="list-item-num">-</span>
        <textarea class="list-item-input proj-bullet-input" rows="2" maxlength="320" placeholder="Project detail or technology used..."></textarea>
        <button type="button" class="list-item-remove" onclick="this.parentElement.remove()" aria-label="Remove project detail" title="Remove project detail">${ReGenIcons.icon('trash')}</button>
      </div>
    `);
    const inputs = container.querySelectorAll('.proj-bullet-input');
    inputs[inputs.length - 1].focus();
  }

  function getData() {
    let isValid = true;
    const data = [];

    if (entries.length === 0) return { isValid: true, data: [] };

    entries.forEach(id => {
      const card = document.getElementById(`proj-${id}`);
      if (!card) return;

      const title = card.querySelector('.proj-title');
      if (!title.value.trim()) { title.classList.add('is-error'); isValid = false; }
      else title.classList.remove('is-error');

      const bullets = Array.from(card.querySelectorAll('.proj-bullet-input'))
        .map(i => window.ZeekeSafe.value(i))
        .filter(b => b);

      if (isValid) {
        data.push({
          title:       window.ZeekeSafe.value(title),
          type:        window.ZeekeSafe.value(card.querySelector('.proj-type')),
          description: window.ZeekeSafe.value(card.querySelector('.proj-desc')),
          bullets:     bullets
        });
      }
    });

    return { isValid, data: isValid ? data : null };
  }

  return { render, attachEvents, getData, removeEntry, addBullet };
})();
