window.ReGenAI = (() => {
  const SUPPORTED = new Set([
    'summary',
    'experience',
    'projects',
    'extracurricular',
    'skills',
    'achievements',
    'certifications',
  ]);
  const LABELS = {
    summary: 'professional summary',
    experience: 'work experience',
    projects: 'projects',
    extracurricular: 'activities',
    skills: 'skills',
    achievements: 'achievements',
    certifications: 'certifications',
  };
  let availability = { loaded: false, enabled: false, quota: null };
  let statusPromise = null;
  let statusRequestedAt = 0;
  let refreshTimer = null;
  const QUOTA_SYNC_KEY = 'regen:ai-quota-sync';

  function clean(value, multiline = false) {
    return window.ZeekeSafe?.cleanText(value, { multiline }) || String(value || '').trim();
  }

  function value(selector, scope = document) {
    return scope.querySelector(selector)?.value || '';
  }

  function bulletData(scope, selector) {
    return Array.from(scope.querySelectorAll(selector)).map((field, index) => ({
      index,
      text: clean(field.value, true),
    }));
  }

  function buildSectionData(root, section) {
    if (section === 'summary') {
      return { summary: clean(value('#s-summary', root), true) };
    }
    if (section === 'experience') {
      return {
        entries: Array.from(root.querySelectorAll('#exp-list .entry-card')).map((card, index) => ({
          index,
          role: clean(value('.exp-title', card)),
          company: clean(value('.exp-company', card)),
          employmentType: clean(value('.exp-type', card)),
          bullets: bulletData(card, '.exp-bullet-input'),
        })),
      };
    }
    if (section === 'projects') {
      return {
        entries: Array.from(root.querySelectorAll('#proj-list .entry-card')).map((card, index) => ({
          index,
          title: clean(value('.proj-title', card)),
          type: clean(value('.proj-type', card)),
          description: clean(value('.proj-desc', card), true),
          bullets: bulletData(card, '.proj-bullet-input'),
        })),
      };
    }
    if (section === 'extracurricular') {
      return {
        entries: Array.from(root.querySelectorAll('#extra-list .entry-card')).map((card, index) => ({
          index,
          organization: clean(value('.extra-org', card)),
          role: clean(value('.extra-role', card)),
          bullets: bulletData(card, '.extra-bullet-input'),
        })),
      };
    }
    if (section === 'skills') {
      return {
        technical: clean(value('#sk-tech', root)),
        software: clean(value('#sk-soft', root)),
        interpersonal: clean(value('#sk-inter', root)),
        language: clean(value('#sk-lang', root)),
        custom: Array.from(root.querySelectorAll('.custom-skill-category')).map((card, index) => ({
          index,
          label: clean(value('.custom-skill-label', card)),
          value: clean(value('.custom-skill-value', card)),
        })),
      };
    }
    const selector = section === 'achievements' ? '.ach-input' : '.cert-input';
    return {
      items: Array.from(root.querySelectorAll(selector)).map((field, index) => ({
        index,
        text: clean(field.value, true),
      })),
    };
  }

  function formatReset(resetAt) {
    if (!resetAt) return 'The 24-hour token limit starts with your first use';
    const date = new Date(resetAt);
    if (Number.isNaN(date.getTime())) return 'Reset time unavailable';
    return `Resets ${date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    })}`;
  }

  function requestLabel(quota) {
    if (!quota) return 'ReGen AI usage details unavailable';
    const limit = Math.max(1, Math.floor(Number(quota.limit) || 15));
    const remaining = Math.max(0, Math.min(limit, Math.floor(Number(quota.remaining) || 0)));
    return `${remaining} of ${limit} ReGen AI Tokens remaining`;
  }

  function exhaustedMessage(quota) {
    const limit = Math.max(1, Number(quota?.limit) || 15);
    const reset = quota?.resetAt
      ? formatReset(quota.resetAt).replace(/^Resets /, '')
      : 'when the next 24-hour window begins';
    return `You have reached the ${limit} ReGen AI Token limit. Tokens reset ${reset}.`;
  }

  async function loadStatus({ force = false } = {}) {
    if (force && statusPromise && Date.now() - statusRequestedAt < 5000) return statusPromise;
    if (force) statusPromise = null;
    if (statusPromise) return statusPromise;
    statusRequestedAt = Date.now();
    statusPromise = Api.getAIStatus()
      .then((result) => {
        availability = {
          loaded: true,
          enabled: result.success === true && result.enabled === true,
          quota: result.quota || null,
        };
        if (result.success !== true) statusPromise = null;
        document.querySelectorAll('.ai-section-assist').forEach(updateCard);
        return availability;
      })
      .catch(() => {
        availability = { loaded: true, enabled: false, quota: null };
        statusPromise = null;
        document.querySelectorAll('.ai-section-assist').forEach(updateCard);
        return availability;
      });
    return statusPromise;
  }

  function setQuota(quota, { broadcast = true } = {}) {
    if (!quota) return;
    availability.quota = quota;
    document.querySelectorAll('.ai-section-assist').forEach(updateCard);
    if (broadcast) {
      try {
        localStorage.setItem(QUOTA_SYNC_KEY, JSON.stringify({ quota, at: Date.now() }));
      } catch (error) {
        // Status remains correct in this tab when storage is unavailable.
      }
    }
  }

  function scheduleStatusRefresh() {
    if (document.hidden) return;
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => loadStatus({ force: true }), 250);
  }

  function updateCard(card) {
    const button = card.querySelector('.ai-section-request');
    const token = card.querySelector('.ai-token-badge');
    const refill = card.querySelector('.ai-token-refill');
    const regenerate = card.querySelector('.ai-regenerate');
    const hasQuota = availability.quota !== null
      && Number.isFinite(Number(availability.quota?.remaining));
    if (token) {
      token.textContent = !availability.loaded
        ? 'Checking ReGen AI availability...'
        : !availability.enabled
          ? 'ReGen AI assistance unavailable'
          : requestLabel(availability.quota);
    }
    if (refill) {
      refill.textContent = !availability.loaded
        ? ''
        : !availability.enabled
          ? 'Try again later'
          : hasQuota
            ? formatReset(availability.quota.resetAt)
            : 'Usage details are temporarily unavailable';
    }
    const exhausted = hasQuota && Number(availability.quota.remaining) <= 0;
    const disabled = !availability.loaded || !availability.enabled || exhausted;
    if (button && button.dataset.loading !== 'true') button.disabled = disabled;
    if (regenerate && regenerate.dataset.loading !== 'true') regenerate.disabled = disabled;
    if (button) {
      button.title = !availability.loaded
        ? 'Checking ReGen AI availability...'
        : !availability.enabled
          ? 'ReGen AI assistance is temporarily unavailable'
          : exhausted
            ? exhaustedMessage(availability.quota)
            : 'Uses one ReGen AI Token.';
    }
  }

  function setStatus(card, message = '', type = '') {
    const status = card.querySelector('.ai-section-status');
    if (!status) return;
    status.textContent = message;
    status.className = `ai-section-status${type ? ` is-${type}` : ''}`;
  }

  function setLoading(card, loading) {
    const button = card.querySelector('.ai-section-request');
    if (!button) return;
    card.querySelectorAll('.ai-section-request, .ai-regenerate').forEach((control) => {
      control.dataset.loading = String(loading);
      control.disabled = loading;
    });
    button.innerHTML = loading
      ? '<span class="ai-spinner" aria-hidden="true"></span><span>Creating suggestions...</span>'
      : `${ReGenIcons.icon('sparkles')} <span>Improve this section</span>`;
    card.setAttribute('aria-busy', String(loading));
    if (!loading) updateCard(card);
  }

  function setResultExpanded(card, expanded) {
    card.querySelector('.ai-section-result')?.classList.toggle('hidden', !expanded);
    card.querySelector('.ai-section-request')?.setAttribute('aria-expanded', String(expanded));
  }

  function setField(field, next) {
    if (!field || typeof next !== 'string' || !next.trim()) return;
    field.value = next;
    window.ZeekeSafe?.setCleanValue(field);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function change(label, field, after) {
    const before = clean(field?.value, field?.tagName === 'TEXTAREA');
    const next = clean(after, field?.tagName === 'TEXTAREA');
    if (!field || !next || before === next) return null;
    return { label, before, after: next, apply: () => setField(field, next) };
  }

  function collectChanges(root, section, suggestion) {
    const changes = [];
    if (section === 'summary') {
      const item = change('Professional summary', root.querySelector('#s-summary'), suggestion.summary);
      return item ? [item] : [];
    }

    if (['experience', 'projects', 'extracurricular'].includes(section)) {
      const cards = section === 'experience'
        ? root.querySelectorAll('#exp-list .entry-card')
        : section === 'projects'
          ? root.querySelectorAll('#proj-list .entry-card')
          : root.querySelectorAll('#extra-list .entry-card');
      const bulletSelector = section === 'experience'
        ? '.exp-bullet-input'
        : section === 'projects'
          ? '.proj-bullet-input'
          : '.extra-bullet-input';
      const sectionLabel = section === 'experience' ? 'Experience' : section === 'projects' ? 'Project' : 'Activity';
      (suggestion.entries || []).forEach((entry) => {
        const card = cards[Number(entry.index)];
        if (!card) return;
        if (section === 'projects' && entry.description) {
          const item = change(
            `${sectionLabel} ${Number(entry.index) + 1} · Description`,
            card.querySelector('.proj-desc'),
            entry.description
          );
          if (item) changes.push(item);
        }
        const bullets = card.querySelectorAll(bulletSelector);
        (entry.bullets || []).forEach((bullet) => {
          const item = change(
            `${sectionLabel} ${Number(entry.index) + 1} · Bullet ${Number(bullet.index) + 1}`,
            bullets[Number(bullet.index)],
            bullet.text
          );
          if (item) changes.push(item);
        });
      });
      return changes;
    }

    if (section === 'skills') {
      const skills = suggestion.skills || {};
      [
        ['Technical skills', '#sk-tech', skills.technical],
        ['Software / tools', '#sk-soft', skills.software],
        ['Interpersonal skills', '#sk-inter', skills.interpersonal],
        ['Languages', '#sk-lang', skills.language],
      ].forEach(([label, selector, next]) => {
        const item = change(label, root.querySelector(selector), next);
        if (item) changes.push(item);
      });
      const customCards = root.querySelectorAll('.custom-skill-category');
      (skills.custom || []).forEach((item) => {
        const card = customCards[Number(item.index)];
        const next = change(
          item.label || `Custom skill group ${Number(item.index) + 1}`,
          card?.querySelector('.custom-skill-value'),
          item.value
        );
        if (next) changes.push(next);
      });
      return changes;
    }

    const fields = root.querySelectorAll(section === 'achievements' ? '.ach-input' : '.cert-input');
    const label = section === 'achievements' ? 'Achievement' : 'Certification';
    (suggestion.items || []).forEach((item) => {
      const next = change(`${label} ${Number(item.index) + 1}`, fields[Number(item.index)], item.text);
      if (next) changes.push(next);
    });
    return changes;
  }

  function renderSuggestion(card, root, section, suggestion) {
    const panel = card.querySelector('.ai-section-result');
    const list = card.querySelector('.ai-change-list');
    if (!panel || !list) return;
    const changes = collectChanges(root, section, suggestion);
    list.replaceChildren();
    if (!changes.length) {
      setResultExpanded(card, false);
      setStatus(card, 'Your current wording already matches this suggestion. Add a specific fact or try again.');
      return;
    }

    changes.forEach((item) => {
      const row = document.createElement('article');
      row.className = 'ai-change-item';
      const title = document.createElement('div');
      title.className = 'ai-change-label';
      title.textContent = item.label;
      const comparison = document.createElement('div');
      comparison.className = 'ai-change-comparison';
      const before = document.createElement('div');
      before.className = 'ai-change-before';
      before.innerHTML = '<span>Current</span><p></p>';
      before.querySelector('p').textContent = item.before || 'Not added yet';
      const after = document.createElement('div');
      after.className = 'ai-change-after';
      after.innerHTML = '<span>Suggested</span><p></p>';
      after.querySelector('p').textContent = item.after;
      comparison.append(before, after);
      row.append(title, comparison);
      list.appendChild(row);
    });

    setResultExpanded(card, true);
    setStatus(card, `${changes.length} suggested change${changes.length === 1 ? '' : 's'} ready for review.`, 'success');
    const apply = card.querySelector('.ai-apply-all');
    if (apply) {
      apply.onclick = () => {
        changes.forEach(item => item.apply());
        setResultExpanded(card, false);
        setStatus(card, 'Suggestions applied. Review the section and adjust any wording before continuing.', 'success');
        App.showToast('Suggestions applied.', 'success');
        card.querySelector('.ai-section-request')?.focus();
      };
    }
  }

  async function requestSuggestion(card, root, section) {
    if (card.getAttribute('aria-busy') === 'true') return;
    const button = card.querySelector('.ai-section-request');
    if (button?.disabled && button.dataset.loading !== 'true') {
      if (availability.quota?.exhausted) setStatus(card, exhaustedMessage(availability.quota), 'error');
      return;
    }
    setLoading(card, true);
    setStatus(card, 'Reviewing this section...');
    setResultExpanded(card, false);
    const result = await Api.suggestResumeSection({
      section,
      data: buildSectionData(root, section),
      previousSuggestion: card._regenSuggestion || null,
    });
    setLoading(card, false);
    if (result.quota) setQuota(result.quota);
    if (!result.success || !result.suggestion) {
      const quotaExhausted = result.quota
        && (result.quota.exhausted === true || Number(result.quota.remaining) <= 0);
      const message = result.status === 429 && quotaExhausted
        ? exhaustedMessage(result.quota)
        : result.message || 'ReGen AI could not create a suggestion. Please try again.';
      setStatus(card, message, 'error');
      return;
    }
    card._regenSuggestion = result.suggestion;
    renderSuggestion(card, root, section, result.suggestion);
  }

  function createCard(root, section) {
    const card = document.createElement('section');
    card.className = 'ai-section-assist';
    card.dataset.aiSection = section;
    card.setAttribute('aria-busy', 'false');
    const resultId = `ai-section-result-${section}`;
    const resultTitleId = `ai-section-result-title-${section}`;
    card.innerHTML = `
      <div class="ai-section-toolbar">
        <div class="ai-section-heading">
          <span class="ai-section-icon">${ReGenIcons.icon('sparkles')}</span>
          <h3>Improve ${LABELS[section]}</h3>
        </div>
        <div class="ai-section-controls">
          <div class="ai-token-summary">
            <strong class="ai-token-badge">Checking ReGen AI availability...</strong>
            <span class="ai-token-refill"></span>
          </div>
          <button type="button" class="btn btn-secondary ai-section-request" aria-controls="${resultId}" aria-expanded="false" disabled>
            ${ReGenIcons.icon('sparkles')} <span>Improve this section</span>
          </button>
        </div>
      </div>
      <p class="ai-section-status" role="status"></p>
      <div class="ai-section-result hidden" id="${resultId}" role="region" aria-labelledby="${resultTitleId}">
        <div class="ai-result-head">
          <h4 id="${resultTitleId}">Review suggestions</h4>
        </div>
        <div class="ai-change-list"></div>
        <div class="ai-result-actions">
          <button type="button" class="btn btn-primary ai-apply-all">Use Suggestions</button>
          <button type="button" class="btn btn-secondary ai-regenerate">${ReGenIcons.icon('retry')} Regenerate</button>
          <button type="button" class="btn btn-ghost ai-dismiss">Keep current</button>
        </div>
        <p class="ai-result-note">Review ReGen AI-generated wording before using it.</p>
      </div>`;
    card.querySelector('.ai-section-request')?.addEventListener('click', () => requestSuggestion(card, root, section));
    card.querySelector('.ai-regenerate')?.addEventListener('click', () => requestSuggestion(card, root, section));
    card.querySelector('.ai-dismiss')?.addEventListener('click', () => {
      setResultExpanded(card, false);
      setStatus(card, 'Current wording kept.');
      card.querySelector('.ai-section-request')?.focus();
    });
    updateCard(card);
    return card;
  }

  function bind(root = document, section = '') {
    if (!SUPPORTED.has(section) || root.querySelector('.ai-section-assist')) return;
    const body = root.querySelector('.form-body');
    if (!body) return;
    body.prepend(createCard(root, section));
    loadStatus();
  }

  window.addEventListener('storage', (event) => {
    if (event.key !== QUOTA_SYNC_KEY || !event.newValue) return;
    try {
      const payload = JSON.parse(event.newValue);
      if (payload?.quota) setQuota(payload.quota, { broadcast: false });
    } catch (error) {
      scheduleStatusRefresh();
    }
  });
  window.addEventListener('focus', scheduleStatusRefresh);
  document.addEventListener('visibilitychange', scheduleStatusRefresh);

  return { bind, loadStatus, setQuota };
})();
