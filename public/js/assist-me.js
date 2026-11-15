window.ReGenAssist = (() => {
  const supported = new Set(['summary', 'experience', 'projects', 'extracurricular', 'skills', 'achievements', 'certifications', 'additional']);
  const drafts = new Map();
  const fieldValue = (node, selector) => node.querySelector(selector)?.value?.trim() || '';
  function targets(root, section) {
    const result = [];
    const add = (element, label, format, metadata = {}, key = section) => {
      if (element) result.push({ element, label, format, metadata, key });
    };
    if (section === 'summary') add(root.querySelector('#s-summary'), 'Summary or objective', 'paragraph');
    if (section === 'experience') root.querySelectorAll('#exp-list .entry-card').forEach((card, i) => {
      const role = fieldValue(card, '.exp-title'), company = fieldValue(card, '.exp-company');
      add(card.querySelector('.exp-bullet-input'), `${i + 1}. ${role || 'Work experience'}${company ? ` · ${company}` : ''}`, 'bullets', { role, company });
    });
    if (section === 'projects') root.querySelectorAll('#proj-list .entry-card').forEach((card, i) => {
      const title = fieldValue(card, '.proj-title'), name = `${i + 1}. ${title || 'Project'}`;
      add(card.querySelector('.proj-bullet-input'), `${name} · Contributions`, 'bullets', { title });
    });
    if (section === 'extracurricular') root.querySelectorAll('#extra-list .entry-card').forEach((card, i) => {
      const role = fieldValue(card, '.extra-role'), company = fieldValue(card, '.extra-org');
      add(card.querySelector('.extra-bullet-input'), `${i + 1}. ${company || role || 'Activity'}`, 'bullets', { role, company });
    });
    if (section === 'skills') {
      [['#sk-tech', 'Technical skills'], ['#sk-soft', 'Software and tools'], ['#sk-inter', 'Interpersonal skills'], ['#sk-lang', 'Languages']].forEach(([selector, category]) => add(root.querySelector(selector), category, 'skills', { category }));
      root.querySelectorAll('.custom-skill-category').forEach(card => {
        const category = fieldValue(card, '.custom-skill-label');
        if (category) add(card.querySelector('.custom-skill-value'), category, 'skills', { category });
      });
    }
    if (section === 'achievements') add(root.querySelector('.ach-input'), 'Achievements', 'items');
    if (section === 'certifications') add(root.querySelector('.cert-input'), 'Certifications', 'items');
    if (section === 'additional') root.querySelectorAll('#additional-list .entry-card').forEach((card, i) => {
      const kind = fieldValue(card, '.additional-kind'), title = fieldValue(card, '.additional-title');
      add(card.querySelector('.additional-items'), `${i + 1}. ${title || kind}`, 'items', { kind, title }, `additional_${kind}`);
    });
    return result;
  }

  const completed = new Map();
  const inFlight = new Set();
  function bind(card, root, section) {
    if (!supported.has(section)) return;
    const launcher = document.createElement('div');
    launcher.className = 'assist-launcher';
    launcher.innerHTML = `<div class="assist-launcher-copy"><strong>Draft from your experience</strong><p>Turn your answers into a draft you can review.</p><span class="assist-launcher-note" hidden></span></div><button type="button" class="btn btn-primary assist-open" aria-haspopup="dialog">${ReGenIcons.icon('writing')} <span>Assist me</span></button>`;
    card.querySelector('.ai-refine-row').before(launcher);
    const opener = launcher.querySelector('.assist-open');
    const dialog = document.createElement('dialog');
    dialog.className = 'assist-dialog';
    dialog.dataset.validationScope = 'assist';
    dialog.setAttribute('aria-labelledby', `assist-title-${section}`);
    dialog.setAttribute('aria-describedby', `assist-intro-${section}`);
    dialog.innerHTML = `<header class="assist-dialog-head"><div><span class="assist-eyebrow">${ReGenIcons.icon('writing')} Assist me</span><h2 class="assist-dialog-title" id="assist-title-${section}" tabindex="-1">Draft this section</h2></div><button type="button" class="btn btn-ghost btn-icon assist-close" aria-label="Close Assist me">${ReGenIcons.icon('close')}</button></header>
      <form class="assist-form" novalidate>
        <div class="assist-dialog-scroll">
          <p class="assist-intro" id="assist-intro-${section}">Write short notes in any language. Your draft will be in English.</p>
          <div class="assist-inputs">
            <div class="assist-target-group"><label class="form-label" for="assist-target-${section}">Which part would you like help with?</label><select class="form-select assist-target" id="assist-target-${section}"></select></div>
            <p class="assist-context"></p><p class="assist-empty" hidden>Add an entry in this section first, then open Assist me again.</p>
            <div class="assist-questions"></div>
            <details class="assist-more"><summary>Add more detail <span>(optional)</span></summary><div class="assist-more-questions"></div></details>
            <label class="assist-placement form-label">When you use the draft<select class="form-select"><option value="append">Add it to my current text</option><option value="replace">Replace my current text</option></select></label>
          </div>
          <p class="assist-status" role="status" aria-live="polite"></p>
          <section class="assist-result" hidden aria-label="Review your draft"><div class="assist-result-title">${ReGenIcons.icon('check')}<h3>Your draft is ready</h3></div><div class="assist-draft"></div><p class="assist-review-note">Check that the details are right before adding this to your resume.</p></section>
        </div>
        <footer class="assist-dialog-footer"><p class="assist-price"></p><div class="assist-actions"><button type="button" class="btn btn-ghost assist-dismiss">Back to editor</button><button type="button" class="btn btn-secondary assist-back" hidden>Edit answers</button><button type="submit" class="btn btn-primary assist-generate" disabled>${ReGenIcons.icon('writing')}<span>Generate draft</span></button><button type="button" class="btn btn-primary assist-apply" hidden>Use this draft ${ReGenIcons.icon('arrowRight')}</button></div></footer>
      </form>`;
    document.body.append(dialog);
    let options = [], status = null, busy = false, pending = null, questionKey = '', disposed = false, reviewing = false;
    const form = dialog.querySelector('form'), selector = dialog.querySelector('.assist-target');
    const questions = dialog.querySelector('.assist-questions'), more = dialog.querySelector('.assist-more-questions');
    const generate = dialog.querySelector('.assist-generate'), message = dialog.querySelector('.assist-status');
    const placement = dialog.querySelector('.assist-placement select');
    const getCost = () => Number(status?.quota?.costs?.assist ?? status?.costs?.assist ?? 1);
    function tell(text, error = false) { message.textContent = text; message.classList.toggle('is-error', error); }
    function showReview(show) {
      reviewing = show;
      dialog.querySelector('.assist-inputs').hidden = show;
      dialog.querySelector('.assist-result').hidden = !show;
      generate.hidden = show;
      dialog.querySelector('.assist-apply').hidden = !show;
      dialog.querySelector('.assist-back').hidden = !show;
      dialog.querySelector('.assist-dismiss').hidden = show;
      dialog.querySelector('.assist-dialog-scroll').scrollTop = 0;
      update();
    }
    function update(next) {
      if (next) status = next;
      const cost = getCost(), remaining = Number(status?.quota?.remaining ?? 0);
      generate.disabled = busy || !status?.enabled || !options.length || remaining < cost;
      generate.dataset.loading=String(busy);
      if(busy)generate.querySelector('span').textContent='Writing draft…';
      else window.ReGenTokens?.bind(generate,'ai_assist','Generate draft');
      window.ReGenTokens?.setAiCosts({assist:cost});
      const price = dialog.querySelector('.assist-price');
      price.textContent = reviewing ? '' : status?.loaded && cost>0 ? `${remaining.toLocaleString()} tokens available` : '';
      if (!busy && !reviewing && status?.loaded && !status.enabled) tell('AI is unavailable right now. You can keep writing your resume yourself.');
      else if (!busy && !reviewing && status?.enabled && remaining < cost) tell(`You have ${remaining} tokens. This draft needs ${cost}. You can still write your resume yourself.`);
      const unavailable = status?.loaded && !status.enabled && !busy && !pending;
      if (opener.disabled !== Boolean(unavailable)) opener.disabled = Boolean(unavailable);
      const note = launcher.querySelector('.assist-launcher-note');
      note.textContent = unavailable ? (window.ReGenText?.get('dashboard.aiUnavailable') || 'Writing assistance is unavailable.')
        : busy ? 'Writing your draft… You can open it here.' : pending ? 'Your draft is ready to review' : '';
      note.hidden = !(unavailable || busy || pending);
    }
    function remember() {
      if (questionKey) drafts.set(questionKey, Object.fromEntries([...dialog.querySelectorAll('.assist-question')].map(input => [input.name, input.value])));
    }
    function renderDraft() {
      const target = pending.target, preview = dialog.querySelector('.assist-draft');
      preview.replaceChildren();
      const list = document.createElement(['bullets', 'items'].includes(target.format) ? 'ul' : 'div');
      pending.lines.forEach(line => { const item = document.createElement(list.tagName === 'UL' ? 'li' : 'p'); item.textContent = line; list.append(item); });
      preview.append(list);
      tell(''); showReview(true);
    }
    function showQuestions() {
      remember(); questions.replaceChildren(); more.replaceChildren();
      const target = options[Number(selector.value)];
      questionKey = target ? `${Api.getResumeId()}:${section}:${target.label}` : '';
      const definition = status?.assistance?.[target?.key];
      if (definition) definition.questions.forEach((question, i) => {
        const group = document.createElement('div'); group.className = 'form-group';
        const label = document.createElement('label'); label.className = 'form-label'; label.htmlFor = `assist-${section}-${i}`;
        label.textContent = question.label;
        const input = document.createElement('textarea'); input.className = 'form-textarea assist-question'; input.id = label.htmlFor; input.name = question.id; input.rows = 3; input.maxLength = 2000; input.required = question.required;
        input.value = drafts.get(questionKey)?.[question.id] || '';
        if (!drafts.has(questionKey) && i === 0 && target.metadata.role) input.value = [target.metadata.role, target.metadata.company].filter(Boolean).join(' at ');
        if (!drafts.has(questionKey) && i === 0 && section === 'projects') input.value = target.metadata.title || '';
        const hint = document.createElement('p'); hint.className = 'assist-example'; hint.id = `${input.id}-hint`; hint.textContent = question.example || 'A few words in your own language are fine.';
        input.setAttribute('aria-describedby', hint.id);
        input.addEventListener('input', () => { input.setCustomValidity(''); input.removeAttribute('aria-invalid'); window.ZeekeForm?.resizeTextarea(input); remember(); });
        group.append(label, input, hint); (i < 2 ? questions : more).append(group);
      });
      dialog.querySelector('.assist-more').hidden = !definition;
      dialog.querySelector('.assist-more').open = [...more.querySelectorAll('textarea')].some(input => input.value.trim());
      dialog.querySelector('.assist-target-group').hidden = options.length < 2;
      dialog.querySelector('.assist-context').textContent = target ? `Writing for: ${target.label}` : '';
      dialog.querySelector('.assist-placement').hidden = !target || target.format === 'paragraph';
      dialog.querySelector('.assist-empty').hidden = !!target;
      const saved = completed.get(questionKey);
      pending = saved && target ? { ...saved, target } : null;
      if (pending) renderDraft(); else showReview(false);
      busy = inFlight.has(questionKey);
      card.setAttribute('aria-busy', String(busy));
      dialog.setAttribute('aria-busy', String(busy));
      dialog.querySelectorAll('.assist-inputs textarea,.assist-inputs select').forEach(input => { input.disabled = busy; });
      if (busy) tell('Writing from your notes… Your draft will appear here when it is ready.');
      update();
    }
    function refreshTargets() {
      const selected = options[Number(selector.value)]?.element, next = targets(root, section);
      const unchanged = next.length === options.length && next.every((option, i) => option.element === options[i].element && option.label === options[i].label && option.key === options[i].key);
      if (unchanged && questions.children.length) return;
      remember(); options = next; selector.replaceChildren();
      options.forEach((option, i) => { const item = document.createElement('option'); item.value = String(i); item.textContent = option.label; selector.append(item); });
      const current = options.findIndex(option => option.element === selected);
      if (current >= 0) selector.value = String(current);
      showQuestions();
    }
    function close() { remember(); dialog.close(); if (card.isConnected) opener.focus({ preventScroll: true }); }
    opener.addEventListener('click', async () => {
      if (dialog.open) return;
      dialog.showModal(); dialog.querySelector('h2').focus({ preventScroll: true });
      status = await ReGenAI.loadStatus();
      if (disposed) return;
      refreshTargets(); update();
    });
    dialog.querySelectorAll('.assist-close,.assist-dismiss').forEach(button => button.addEventListener('click', close));
    dialog.addEventListener('cancel', () => remember());
    dialog.addEventListener('close', () => { remember(); if (card.isConnected) opener.focus({ preventScroll: true }); });
    selector.addEventListener('change', () => { tell(''); showQuestions(); });
    const onStatus = event => { update(event.detail); };
    window.addEventListener('regen:ai-status', onStatus);
    const onResult = event => {
      if (disposed || event.detail.key !== questionKey) return;
      busy = false; card.setAttribute('aria-busy', 'false'); dialog.setAttribute('aria-busy', 'false');
      dialog.querySelectorAll('.assist-inputs textarea,.assist-inputs select').forEach(input => { input.disabled = false; });
      const saved = completed.get(questionKey), target = options[Number(selector.value)];
      if (saved && target) { pending = { ...saved, target }; renderDraft(); }
      else { tell(event.detail.message || 'We couldn’t create a draft. Your answers are still here to try again.', true); update(); }
    };
    window.addEventListener('regen:assist-result', onResult);
    document.addEventListener('regen:section-ready', () => {
      remember(); disposed = true; window.removeEventListener('regen:ai-status', onStatus); window.removeEventListener('regen:assist-result', onResult); dialog.close(); dialog.remove();
    }, { once: true });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (busy || card.getAttribute('aria-busy') === 'true') return;
      refreshTargets();
      const target = options[Number(selector.value)];
      if (!target || !target.element.isConnected) return tell('Add or choose an entry first.', true);
      const inputs = [...dialog.querySelectorAll('.assist-question')];
      const invalid = inputs.find(input => input.required && input.value.trim().length < 3);
      if (invalid) { invalid.setCustomValidity('Add a few words here so we know what to write about.'); invalid.setAttribute('aria-invalid', 'true'); invalid.reportValidity(); return; }
      const answers = Object.fromEntries(inputs.map(input => [input.name, input.value.trim()]));
      if (Object.values(answers).join(' ').length < 30) { tell('Tell us a little more in your first two answers. Short sentences are fine.', true); return; }
      const before = target.element.value, mode = target.format === 'paragraph' ? 'replace' : placement.value;
      const requestKey = questionKey;
      busy = true; inFlight.add(requestKey); completed.delete(requestKey); pending = null; card.setAttribute('aria-busy', 'true'); dialog.setAttribute('aria-busy', 'true');
      dialog.querySelectorAll('.assist-inputs textarea,.assist-inputs select').forEach(input => { input.disabled = true; });
      card.querySelectorAll('.ai-section-request,.ai-regenerate').forEach(input => { input.disabled = true; });
      tell('Writing from your notes… You can close this window and come back to your draft.'); update();
      let response;
      try { response = await Api.assistResumeSection({ section: target.key, answers, target: { ...target.metadata, format: target.format }, expectedCost: getCost() }); }
      catch { response = { success: false, message: 'We couldn’t complete the request. Check your connection and token balance before trying again.' }; }
      busy = false; card.setAttribute('aria-busy', 'false'); dialog.setAttribute('aria-busy', 'false');
      dialog.querySelectorAll('.assist-inputs textarea,.assist-inputs select').forEach(input => { input.disabled = false; });
      inFlight.delete(requestKey);
      if (response.success && Array.isArray(response.draft?.lines)) completed.set(requestKey, { before, mode, lines: response.draft.lines });
      window.dispatchEvent(new CustomEvent('regen:assist-result', { detail: { key: requestKey, message: response.message || '' } }));
      if (response.quota) ReGenAI.setQuota(response.quota); else ReGenAI.loadStatus({ force: true });
    });
    dialog.querySelector('.assist-back').addEventListener('click', () => { tell(''); showReview(false); questions.querySelector('textarea')?.focus(); });
    dialog.querySelector('.assist-apply').addEventListener('click', () => {
      if (!pending) return;
      const { target, before, mode, lines } = pending;
      if (!target.element.isConnected || target.element.value !== before) return tell('Your text changed after this draft was generated. You can copy wording from this draft, or edit your answers and generate a new one.', true);
      const drafted = target.format === 'skills' ? lines.join(', ') : target.format === 'bullets' ? ReGenPoints.format(lines) : lines.join('\n');
      const next = mode === 'append' && before.trim() ? before.trimEnd() + (target.format === 'skills' ? ', ' : '\n') + drafted : drafted;
      if (target.element.maxLength > 0 && next.length > target.element.maxLength) return tell('This would exceed the field’s text limit. Edit your answers and choose Replace my current text, or shorten the current text first.', true);
      target.element.value = next;
      target.element.dispatchEvent(new Event('input', { bubbles: true })); target.element.dispatchEvent(new Event('change', { bubbles: true }));
      completed.delete(questionKey); pending = null; close(); showReview(false);
      App.showToast('Draft added. Review it before continuing.', 'success');
      (target.element.closest('.skill-input-wrap')?.querySelector('.skill-entry') || target.element).focus();
    });
    update();
  }
  return { bind, supported };
})();
