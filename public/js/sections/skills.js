const SkillsSection = (() => {
  let customSkillIds = [];
  const defaultCategories = [
    {
      key: 'technical',
      id: 'sk-tech',
      label: 'Technical Skills',
      desc: 'Programming languages, frameworks, methodologies.',
      icon: 'T',
      style: 'background:#E0F2FE;color:#0284C7',
      placeholder: 'e.g. JavaScript, React, Node.js, Agile',
    },
    {
      key: 'software',
      id: 'sk-soft',
      label: 'Software / Tools',
      desc: 'Applications, IDEs, design tools.',
      icon: 'S',
      style: 'background:#FEF3C7;color:#D97706',
      placeholder: 'e.g. VS Code, Figma, Adobe Photoshop, Git',
    },
    {
      key: 'interpersonal',
      id: 'sk-inter',
      label: 'Interpersonal / Soft Skills',
      desc: 'Leadership, communication, problem solving.',
      icon: 'I',
      style: 'background:#DCFCE7;color:#16A34A',
      placeholder: 'e.g. Team Leadership, Public Speaking, Critical Thinking',
    },
    {
      key: 'language',
      id: 'sk-lang',
      label: 'Languages',
      desc: 'Languages you speak or write.',
      icon: 'L',
      style: 'background:#EEF2FF;color:#4F46E5',
      placeholder: 'e.g. English (Fluent), Malay (Native), Mandarin (Basic)',
    },
  ];

  function renderCategory(cat) {
    return `
      <div class="skill-category">
        <div class="skill-cat-header">
          <div class="skill-cat-icon" style="${cat.style}">${cat.icon}</div>
          <div>
            <div class="skill-cat-label">${cat.label}</div>
            <div class="skill-cat-desc">${cat.desc}</div>
          </div>
        </div>
        <div class="skill-input-wrap">
          <input type="text" id="${cat.id}" class="form-input" data-comma-list="true" maxlength="500" placeholder="${cat.placeholder}">
        </div>
      </div>
    `;
  }

  function render(stepNum) {
    return `
      <div class="step-header">
        <div class="step-header-info">
          <div class="step-count">Step ${stepNum}</div>
          <h2 class="step-title">Skills & Proficiencies</h2>
          <p class="step-subtitle">Skills grouped by type.</p>
        </div>
        <button type="button" class="skip-btn">Skip Step ${ReGenIcons.icon('arrowRight')}</button>
      </div>
      <div class="form-body form-section">
        <div class="skills-form">
          <datalist id="skill-type-options">
            <option value="Design Skills"></option><option value="Industry Knowledge"></option>
            <option value="Laboratory Skills"></option><option value="Management Skills"></option>
            <option value="Research Skills"></option><option value="Certifications & Platforms"></option>
          </datalist>
          ${defaultCategories.map(renderCategory).join('')}
          <div id="custom-skills-list" class="skills-form"></div>
          <button type="button" class="add-entry-btn" id="btn-add-skill-type">${ReGenIcons.icon('add')} Add Skill Type</button>
        </div>
      </div>
    `;
  }

  function attachEvents(data) {
    customSkillIds = [];
    if (data) {
      document.getElementById('sk-tech').value  = data.technical || '';
      document.getElementById('sk-soft').value  = data.software || '';
      document.getElementById('sk-inter').value = data.interpersonal || '';
      document.getElementById('sk-lang').value  = data.language || '';
      (Array.isArray(data.custom) ? data.custom : []).forEach(item => addCustomSkill(item));
    }
    document.getElementById('btn-add-skill-type').addEventListener('click', () => addCustomSkill());
  }

  function addCustomSkill(data = {}) {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    customSkillIds.push(id);
    const esc = window.ZeekeSafe.attr;
    document.getElementById('custom-skills-list').insertAdjacentHTML('beforeend', `
      <div class="skill-category custom-skill-category" id="custom-skill-${id}">
        <div class="skill-cat-header custom-skill-header">
          <div class="skill-cat-icon" id="icon-${id}" style="background:#F1F5F9;color:#334155">${esc((data.label || 'A').slice(0, 1).toUpperCase())}</div>
          <div class="custom-skill-title-fields">
            <label class="form-label" for="sk-custom-label-${id}">Skill Type</label>
            <input type="text" id="sk-custom-label-${id}" class="form-input custom-skill-label" list="skill-type-options" value="${esc(data.label)}" placeholder="Select or type a skill type" maxlength="80">
          </div>
          <button type="button" class="entry-delete-btn" aria-label="Remove skill type" title="Remove skill type">${ReGenIcons.icon('trash')}</button>
        </div>
        <div class="skill-input-wrap">
          <input type="text" id="sk-custom-val-${id}" class="form-input custom-skill-value" data-comma-list="true"
            value="${esc(data.value)}" placeholder="e.g. Canva, layout design, brand guidelines" maxlength="500">
        </div>
      </div>
    `);

    const labelInput = document.getElementById(`sk-custom-label-${id}`);
    const valInput = document.getElementById(`sk-custom-val-${id}`);
    const icon = document.getElementById(`icon-${id}`);
    const card = document.getElementById(`custom-skill-${id}`);
    card.querySelector('.entry-delete-btn')?.addEventListener('click', () => removeCustomSkill(id));
    window.ZeekeForm?.bind(card);

    labelInput.addEventListener('input', (e) => {
      icon.textContent = (e.target.value || 'A').slice(0, 1).toUpperCase();
      if (typeof Stepper !== 'undefined' && typeof Preview !== 'undefined') Preview.renderDraft(Stepper.getDraftResume());
    });
    valInput.addEventListener('input', () => {
      if (typeof Stepper !== 'undefined' && typeof Preview !== 'undefined') Preview.renderDraft(Stepper.getDraftResume());
    });
  }

  function removeCustomSkill(id) {
    customSkillIds = customSkillIds.filter(item => item !== id);
    document.getElementById(`custom-skill-${id}`)?.remove();
    if (typeof Stepper !== 'undefined' && typeof Preview !== 'undefined') Preview.renderDraft(Stepper.getDraftResume());
  }

  function getData() {
    const tech  = window.ZeekeSafe.value(document.getElementById('sk-tech'));
    const soft  = window.ZeekeSafe.value(document.getElementById('sk-soft'));
    const inter = window.ZeekeSafe.value(document.getElementById('sk-inter'));
    const lang  = window.ZeekeSafe.value(document.getElementById('sk-lang'));

    let isValid = true;
    const custom = customSkillIds.map(id => {
      const row = document.getElementById(`custom-skill-${id}`);
      const labelInput = row?.querySelector('.custom-skill-label');
      const valueInput = row?.querySelector('.custom-skill-value');
      const item = { label: window.ZeekeSafe.value(labelInput), value: window.ZeekeSafe.value(valueInput) };
      if ((item.label && !item.value) || (!item.label && item.value)) {
        isValid = false;
        window.ZeekeForm?.setError(item.label ? valueInput : labelInput, item.label ? 'Add at least one skill.' : 'Choose or type a skill type.');
      }
      return item;
    }).filter(item => item.label || item.value);

    if (!isValid) return { isValid: false, data: null };

    if (!tech && !soft && !inter && !lang && custom.length === 0) {
      return { isValid: true, data: null };
    }

    return {
      isValid: true,
      data: {
        technical: tech,
        software: soft,
        interpersonal: inter,
        language: lang,
        custom
      }
    };
  }

  return { render, attachEvents, getData, removeCustomSkill };
})();
