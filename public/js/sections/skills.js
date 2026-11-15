const SkillsSection = (() => {
  const groups = [
    { key: 'technical', id: 'sk-tech', label: 'Technical skills', examples: ['Data analysis', 'Project planning', 'SQL', 'JavaScript'] },
    { key: 'software', id: 'sk-soft', label: 'Software and tools', examples: ['Microsoft Excel', 'Power BI', 'Figma', 'Git'] },
    { key: 'interpersonal', id: 'sk-inter', label: 'Interpersonal skills', examples: ['Team leadership', 'Public speaking', 'Customer service', 'Facilitation'] },
    { key: 'language', id: 'sk-lang', label: 'Languages', examples: [] }
  ];
  const esc = value => window.ZeekeSafe.attr(value);
  const MAX_GROUPS = 20;
  const MAX_LENGTH = 5000;
  let sequence = 0;

  function split(value) {
    const items = [], seen = new Set();
    for (const raw of String(value || '').split(/[,;\r\n]+/)) {
      const item = raw.trim();
      const key = item.toLowerCase();
      if (key && !seen.has(key)) { seen.add(key); items.push(item); }
    }
    return items;
  }

  function editor(id, placeholder, examples = [], custom = false) {
    return `
      <div class="skill-input-wrap">
        <div class="skill-chips" aria-label="Added skills"></div>
        <div class="skill-add-row">
          <label class="sr-only" for="${id}-entry">Add a skill</label>
          <input id="${id}-entry" class="form-input skill-entry" data-preserve-spaces="true" placeholder="${esc(placeholder)}" maxlength="${MAX_LENGTH}" enterkeyhint="done" aria-describedby="${id}-status">
          <button type="button" class="btn btn-secondary skill-add">Add</button>
        </div>
        <input type="hidden" id="${id}" class="skill-value${custom ? ' custom-skill-value' : ''}">
        ${examples.length ? `<div class="skill-examples" aria-label="Example skills">${examples.map(item => `<button type="button" class="skill-example" data-skill="${esc(item)}">+ ${esc(item)}</button>`).join('')}</div>` : ''}
        <p class="form-hint skill-status" role="status" id="${id}-status" hidden></p>
      </div>`;
  }

  function render(stepNum) {
    return `
      <div class="step-header">
        <div class="step-header-info"><div class="step-count">Step ${stepNum}</div>
          <h2 class="step-title">Skills</h2><p class="step-subtitle">Add skills that fit the job. Type one or paste a list.</p>
        </div>
        <button type="button" class="skip-btn">Skip ${ReGenIcons.icon('arrowRight')}</button>
      </div>
      <div class="form-body form-section">
        <div class="skills-form">
          ${groups.map(({ id, label, examples, key }) => `
            <details class="skill-category skill-group" data-group="${key}" ${key === 'technical' ? 'open' : ''}>
              <summary class="skill-group-summary"><span>${label}</span><span class="skill-count"></span>${ReGenIcons.icon('arrowDown')}</summary>
              ${editor(id, key === 'language' ? 'e.g. English (Fluent)' : `e.g. ${examples[0]}`, examples)}
            </details>`).join('')}
          <div id="custom-skills-list" class="skills-form"></div>
          <button type="button" class="add-entry-btn" id="btn-add-skill-type">${ReGenIcons.icon('add')} Add a custom group</button>
        </div>
      </div>`;
  }

  function bindEditor(group, initial) {
    const input = group.querySelector('.skill-entry');
    const value = group.querySelector('.skill-value');
    const chips = group.querySelector('.skill-chips');
    const count = group.querySelector('.skill-count');
    const status = group.querySelector('.skill-status');
    let items = split(initial);
    const report = (message, announceOnly = false) => {
      status.classList.toggle('sr-only', announceOnly);
      status.textContent = message;
      status.hidden = !message;
    };
    const updateValue = () => {
      const all = split([...items, input.value].join(', ')).join(', ');
      input.setCustomValidity(all.length > MAX_LENGTH ? 'This group is full. Remove a skill or add another group.' : '');
      value.value = all.length <= MAX_LENGTH ? all : items.join(', ');
      return all.length <= MAX_LENGTH;
    };
    function redraw() {
      chips.innerHTML = items.map((item, index) => `<span class="skill-chip"><span>${esc(item)}</span><button type="button" data-remove-skill="${index}" aria-label="Remove ${esc(item)}">${ReGenIcons.icon('close')}</button></span>`).join('');
      if (count) count.textContent = items.length ? String(items.length) : '';
      group.querySelectorAll('.skill-example').forEach(button => {
        button.hidden = items.some(item => item.toLowerCase() === button.dataset.skill.toLowerCase());
      });
      updateValue();
    }

    function add(text, clear = false) {
      const next = split([...items, text].join(', '));
      if (next.join(', ').length > MAX_LENGTH) {
        report('This group is full. Remove a skill or add another group.');
        return;
      }
      const added = next.length - items.length;
      items = next;
      if (clear) input.value = '';
      redraw();
      report(added ? `${added} ${added === 1 ? 'skill' : 'skills'} added.` : text.trim() ? 'Already added.' : '', added > 0);
      value.dispatchEvent(new Event('change', { bubbles: true }));
    }

    input.addEventListener('input', () => {
      report(updateValue() ? '' : 'This group is full. Remove a skill or add another group.');
    });
    input.addEventListener('keydown', event => {
      if (event.isComposing || !['Enter', ',', ';'].includes(event.key)) return;
      event.preventDefault();
      add(input.value, true);
    });
    input.addEventListener('paste', event => {
      const text = event.clipboardData?.getData('text');
      if (!text || !/[,;\r\n]/.test(text)) return;
      event.preventDefault();
      const combined = [input.value.slice(0, input.selectionStart), text, input.value.slice(input.selectionEnd)].join('');
      if (split([...items, combined].join(', ')).join(', ').length <= MAX_LENGTH) add(combined, true);
      else report('This list is too long. Paste a smaller list or add another group.');
    });
    input.addEventListener('blur', () => { if (input.value.trim()) add(input.value, true); });
    group.querySelector('.skill-add').addEventListener('click', () => {
      if (input.value.trim()) add(input.value, true);
      input.focus();
    });
    group.querySelectorAll('.skill-example').forEach(button => button.addEventListener('click', () => {
      // The selected example is hidden after adding it; keep a stable focus target.
      group.querySelector('summary').focus();
      add(button.dataset.skill);
    }));
    chips.addEventListener('click', event => {
      const button = event.target.closest('[data-remove-skill]');
      if (!button) return;
      const index = Number(button.dataset.removeSkill);
      const [removed] = items.splice(index, 1);
      redraw();
      report(`${removed} removed.`, true);
      (chips.querySelector(`[data-remove-skill="${index}"]`) || input).focus({ preventScroll: true });
      value.dispatchEvent(new Event('change', { bubbles: true }));
    });
    // Assist me and Refine apply edits through the same canonical value.
    value.addEventListener('input', () => {
      items = split(value.value);
      input.value = '';
      if (group.matches('details')) group.open = true;
      redraw();
    });
    redraw();
  }

  function attachEvents(data) {
    const first = groups.find(({ key }) => data?.[key]) || groups[0];
    groups.forEach(({ id, key }) => {
      const group = document.getElementById(id).closest('.skill-group');
      bindEditor(group, data?.[key]);
      group.open = key === first.key;
    });
    (Array.isArray(data?.custom) ? data.custom : []).forEach(item => addCustom(item));
    document.getElementById('btn-add-skill-type').addEventListener('click', () => addCustom({}, true));
    syncCustomButton();
  }

  function syncCustomButton() {
    document.getElementById('btn-add-skill-type').disabled = document.querySelectorAll('.custom-skill-category').length >= MAX_GROUPS;
  }

  function addCustom(data, focus = false) {
    if (document.querySelectorAll('.custom-skill-category').length >= MAX_GROUPS) return;
    const id = `custom-skill-${++sequence}`;
    document.getElementById('custom-skills-list').insertAdjacentHTML('beforeend', `
      <div class="skill-category custom-skill-category" id="${id}">
        <div class="custom-skill-heading">
          <div class="form-group"><label class="form-label" for="${id}-label">Group name</label>
            <input id="${id}-label" class="form-input custom-skill-label" value="${esc(data.label)}" placeholder="e.g. Research skills" maxlength="80">
          </div>
          <button type="button" class="entry-delete-btn" aria-label="Remove skill group">${ReGenIcons.icon('trash')}</button>
        </div>
        ${editor(`${id}-value`, 'Type a skill', [], true)}
      </div>`);
    const card = document.getElementById(id);
    bindEditor(card, data.value);
    window.ZeekeForm?.bind(card);
    card.querySelector('.entry-delete-btn').addEventListener('click', () => {
      card.remove();
      syncCustomButton();
      document.getElementById('btn-add-skill-type').focus({ preventScroll: true });
    });
    syncCustomButton();
    if (focus) card.querySelector('.custom-skill-label').focus();
  }

  function getPreviewData() {
    const values = Object.fromEntries(groups.map(({ id, key }) => [key, document.getElementById(id).value]));
    const custom = [...document.querySelectorAll('.custom-skill-category')].map(card => ({
      label: window.ZeekeSafe.value(card.querySelector('.custom-skill-label')),
      value: card.querySelector('.custom-skill-value').value
    })).filter(item => item.label || item.value);
    return Object.values(values).some(Boolean) || custom.length ? { ...values, custom } : null;
  }

  function getData() {
    return { isValid: !document.querySelector('.skill-entry:invalid'), data: getPreviewData() };
  }

  return { render, attachEvents, getData };
})();
