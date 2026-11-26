document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('letter-form');
  const message = document.getElementById('letter-message');
  const list = document.getElementById('letter-list');
  const suggestionBox = document.getElementById('letter-suggestion');
  const saveState = document.getElementById('letter-save-state');
  const generate = document.getElementById('generate-letter');
  const previewDialog = document.getElementById('letter-preview');
  const previewPanel = document.getElementById('letter-working-preview');
  const libraryToggle = document.getElementById('letter-library-toggle');
  const library = document.getElementById('letter-library');
  const libraryDialog = document.getElementById('letter-library-dialog');
  const fullTitles = document.getElementById('letter-full-titles');
  const searchToggle = document.getElementById('letter-search-toggle');
  const searchField = document.getElementById('letter-search-field');
  const search = document.getElementById('letter-search');
  const draftStyle = document.getElementById('letter-draft-style');
  const focusToggle = document.querySelector('[data-studio-focus]');
  const closeLibrary = library.querySelector('[data-close-library]');
  const workspace = document.getElementById('letter-workspace');
  const quickTools = document.getElementById('letter-workbench-tools');
  const libraryBreakpoint = matchMedia('(min-width: 981px)');
  function setLibrary(open) {
    const desktop = libraryBreakpoint.matches;
    if (desktop && library.parentElement!==workspace) workspace.prepend(library);
    else if (!desktop && library.parentElement!==libraryDialog) libraryDialog.append(library);
    closeLibrary.hidden = desktop;
    if (desktop || !open) {
      if (libraryDialog.open) libraryDialog.close();
    } else if (!libraryDialog.open) {
      libraryDialog.showModal();
      closeLibrary.focus();
    }
    libraryToggle.setAttribute('aria-expanded', String(libraryDialog.open));
  }
  setLibrary(false);
  libraryToggle.addEventListener('click', () => setLibrary(true));
  closeLibrary.onclick = () => setLibrary(false);
  libraryDialog.addEventListener('close', () => {
    libraryToggle.setAttribute('aria-expanded', 'false');
    if (!libraryBreakpoint.matches) libraryToggle.focus({preventScroll:true});
  });
  libraryBreakpoint.addEventListener('change', () => setLibrary(false));
  fullTitles.addEventListener('click', () => {
    const expanded = list.classList.toggle('show-full-titles');
    fullTitles.setAttribute('aria-pressed', String(expanded));
  });
  function setSearch(open) {
    searchField.hidden = !open;
    searchToggle.setAttribute('aria-expanded', String(open));
    if (open) search.focus();
    else {
      search.value = '';
      search.dispatchEvent(new Event('input'));
      searchToggle.focus();
    }
  }
  searchToggle.onclick = () => setSearch(searchField.hidden);
  search.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setSearch(false);
    }
  });
  const proofToggle = document.getElementById('letter-proof-toggle');
  const proof = LiveDocumentPreview.create(document.getElementById('letter-working-paper'), Api.letterDraftPdf);
  const fullProof = LiveDocumentPreview.create(document.getElementById('letter-pdf-pages'), Api.letterDraftPdf);
  const reading = document.getElementById('letter-writing-mode');
  const previewButton = document.getElementById('preview-letter');
  const workbench = document.getElementById('main-content');
  const accessNote = document.getElementById('letter-preview-access');
  const targetMeta = document.getElementById('letter-target-meta');
  const retryLoad = document.getElementById('letter-retry-load');
  retryLoad.onclick = () => location.reload();
  let previewReady = false;
  let fullZoom = 1;
  let editorScroll = 0;
  const wide = matchMedia('(min-width: 1200px)');
  const fields = ['company', 'role', 'recipient', 'company_details', 'job_description', 'body', 'recipient_address', 'letter_date'];
  let activeId = null;
  let dirty = false;
  let busy = false;
  let suggestion = '';
  let savedFingerprint = '';
  let revision = 0;
  let saveTimer, saveRequest;
  let resume, template, signedIn = true, proofOpen = wide.matches;
  let letters = [];
  let listPage=1,listSearch='';
  let listSize=matchMedia('(max-width:760px)').matches?4:6;
  let aiAvailable = false;
  let quotaRemaining = null;
  let generationCost = 1;
  const safe = value => ZeekeSafe.attr(value);
  const value = name => form.elements.namedItem(name).value.trim();
  const data = () => Object.fromEntries(fields.map(name => [name, value(name)]));
  const fingerprint = letter => JSON.stringify(fields.map(name => String(letter[name] ?? '')));
  const label = (key, fallback) => ReGenText.get(key, fallback);
  function updateLocation(id, newDraft = false) {
    const url = new URL(location.href);
    url.searchParams.delete('new');
    url.searchParams.delete('id');
    if (id) url.searchParams.set('id', id);
    else if (newDraft) url.searchParams.set('new', '1');
    history.replaceState(null, '', url);
  }
  function draftPdf() {
    const {job_description, company_details, ...letter} = data();
    return {letter, appearance: resume?.appearance};
  }
  function updateProof(immediate = false) {
    if (!previewReady) return;
    const allowed = signedIn && LiveDocumentPreview.allowed();
    const focused = document.body.classList.contains('studio-focus-mode');
    const inline = !focused && !wide.matches && proofOpen && allowed;
    const wasReading = document.body.classList.contains('letter-proof-mode');
    const wasHidden = previewPanel.hidden;
    if (inline && !wasReading) editorScroll = workbench.scrollTop;
    previewPanel.hidden = focused || !proofOpen || (!wide.matches && !allowed);
    document.body.classList.toggle('letter-proof-mode', inline);
    if (inline !== wasReading) workbench.scrollTop = inline ? 0 : editorScroll;
    if (wasHidden && !previewPanel.hidden) document.dispatchEvent(new Event('regen:document-reading'));
    reading.setAttribute('aria-pressed', String(!inline));
    proofToggle.setAttribute('aria-pressed', String(wide.matches ? !previewPanel.hidden : inline));
    proofToggle.setAttribute('aria-expanded', String(!previewPanel.hidden));
    accessNote.hidden = allowed;
    if (!allowed || previewPanel.hidden) proof.clear();
    else if (!previewDialog.open) proof.update(draftPdf(), {immediate});
    if (allowed && previewDialog.open) fullProof.update(draftPdf(), {immediate});
  }
  proofToggle.addEventListener('click', () => {
    if (focusToggle.getAttribute('aria-pressed') === 'true') {
      proofOpen = true;
      focusToggle.click();
      if (wide.matches || LiveDocumentPreview.allowed()) return;
    }
    if (!wide.matches && !LiveDocumentPreview.allowed()) {
      previewButton.click();
      return;
    }
    proofOpen = !proofOpen;
    if (!wide.matches && proofOpen) setLibrary(false);
    updateProof(true);
  });
  document.addEventListener('regen:studio-focus', event => {
    if (event.detail.active && !wide.matches) proofOpen = false;
    updateProof(true);
  });
  reading.addEventListener('click', () => {
    proofOpen = false;
    updateProof();
  });
  wide.addEventListener('change', event => { proofOpen = event.matches; updateProof(true); });
  function updateDraftLabel() {
    document.getElementById('letter-editor-title').textContent = value('role') || value('company') || label('letter.new');
    targetMeta.textContent = value('company');
    targetMeta.hidden = !targetMeta.textContent;
  }
  function updateWordCount() {
    const count = value('body').match(/\S+/gu)?.length || 0;
    const guide = document.getElementById('letter-word-count');
    const display = label('letter.wordCount').replace('{count}', new Intl.NumberFormat(ReGenText.locale).format(count));
    if (guide.textContent !== display) guide.textContent = display;
  }
  function status(text,error=false){if(error&&libraryDialog.open)setLibrary(false);message.textContent=text;message.classList.toggle('is-error',error);message.setAttribute('role',error?'alert':'status');if(error)message.scrollIntoView({block:'nearest',behavior:'smooth'});}
  function updateAi() {
    previewButton.disabled = busy || !signedIn;
    document.getElementById('download-letter').disabled = busy || !activeId;
    document.getElementById('save-letter').disabled=busy;
    if (generate.dataset.loading === 'true') return;
    const price = window.ReGenTokens?.getPrice('ai_cover_letter');
    const included = price?.packageUnlocked || Number(price?.packageUses) > 0;
    generate.disabled = busy || !signedIn || !activeId || !aiAvailable || (!included && quotaRemaining !== null && quotaRemaining < generationCost) || !value('company') || !value('role');
    draftStyle.disabled = generate.disabled;
    generate.title = !activeId ? label('letter.aiSaveFirst') : !value('company') || !value('role') ? label('letter.aiTargetFirst') : '';
  }
  function setBusy(state) {
    busy = state;form.setAttribute('aria-busy',String(state));
    form.querySelectorAll('button,input,textarea,select').forEach(control => { control.disabled = state; });
    document.getElementById('new-letter').disabled = state;
    list.querySelectorAll('button').forEach(button => { button.disabled = state; });
    updateAi();
    updateWordCount();
  }
  function updateQuota(quota) {
    if (quota) { quotaRemaining = Number(quota.remaining); generationCost = Number(quota.costs?.cover_letter ?? generationCost); }
    const note = document.getElementById('letter-ai-quota');
    const price=window.ReGenTokens?.getPrice('ai_cover_letter');
    const restricted = price?.mode==='package_only' && !price.packageUnlocked && !price.packageUses;
    if (restricted) note.textContent = label(price.packageIncluded?'letter.aiAllowanceUsed':'letter.aiPackageRequired');
    else if (!aiAvailable) note.textContent = label('letter.aiUnavailable');
    else note.textContent = Number.isFinite(quotaRemaining) ? `${quotaRemaining.toLocaleString(ReGenText.locale)} ${label('commerce.available')}` : '';
    window.ReGenTokens?.setAiCosts({cover_letter:generationCost});
    updateAi();
  }
  function renderList() {
    const filtered=letters.filter(letter=>(letter.company+' '+letter.role).toLocaleLowerCase().includes(listSearch));
    const pages=Math.max(1,Math.ceil(filtered.length/listSize));listPage=Math.min(listPage,pages);
    document.getElementById('letter-count').textContent=letters.length || '';
    const dateFormat = new Intl.DateTimeFormat(ReGenText.locale,{month:'short',day:'numeric',timeZone:'Asia/Kuala_Lumpur'});
    const visible = filtered.slice((listPage-1)*listSize,listPage*listSize);
    fullTitles.hidden = !filtered.some(letter => letter.role.length > 20 || letter.company.length > 20);
    list.innerHTML=visible.length?visible.map(letter=>{
      const selected=Number(letter.id)===Number(activeId);
      const date=Api.parseDate(letter.updated_at);
      return `<button type="button" data-id="${Number(letter.id)}" aria-current="${selected}">
        <span class="letter-list-information"><strong>${safe(letter.role)}</strong><span class="letter-list-meta">
          <small>${safe(letter.company)}</small>${date ? '<time datetime="' + date.toISOString() + '">' + safe(dateFormat.format(date)) + '</time>' : ''}</span></span>
        ${selected ? '<span class="letter-list-marker">' + ReGenIcons.icon('check') + '</span>' : ''}
      </button>`;
    }).join(''):`<p class="letter-list-empty">${safe(label(letters.length?'letter.libraryNoMatches':'letter.libraryEmpty'))}</p>`;
    list.querySelectorAll('button').forEach(button=>button.onclick=()=>openLetter(Number(button.dataset.id)));
    const nav=document.getElementById('letter-pagination');nav.hidden=pages<=1;
    nav.innerHTML=`<button type="button" class="studio-icon" data-prev aria-label="${safe(label('letter.previousPage'))}" ${listPage<=1?'disabled':''}>${ReGenIcons.icon('arrowLeft')}</button><span>${listPage} / ${pages}</span><button type="button" class="studio-icon" data-next aria-label="${safe(label('letter.nextPage'))}" ${listPage>=pages?'disabled':''}>${ReGenIcons.icon('arrowRight')}</button>`;
    nav.onclick = event => {
      const button = event.target.closest('button');
      if (!button) return;
      const forward = button.hasAttribute('data-next');
      listPage += forward ? 1 : -1;
      renderList();
      (nav.querySelector(forward ? '[data-next]:enabled' : '[data-prev]:enabled') || nav.querySelector('button:enabled'))?.focus();
    };
  }
  search.oninput=event=>{listSearch=event.target.value.trim().toLocaleLowerCase();listPage=1;renderList();};
  matchMedia('(max-width:760px)').addEventListener('change',event=>{listSize=event.matches?4:6;listPage=1;renderList();});
  function loadLetter(letter = {}) {
    revision++;
    proof.clear();
    activeId = letter.id || null;
    savedFingerprint = fingerprint(letter);
    document.getElementById('letter-target').open = !activeId;
    fields.forEach(name => { form.elements.namedItem(name).value = letter[name] || ''; });
    if(!value('letter_date')){const now=new Date();form.elements.letter_date.value=new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10);}
    document.getElementById('letter-context').open=false;document.getElementById('letter-job-context').open=false;
    dirty = false;
    suggestion = '';
    suggestionBox.hidden = true;
    updateDraftLabel();
    document.getElementById('delete-letter').hidden = !activeId;
    saveState.textContent = label(activeId ? 'letter.savedState' : 'letter.newState');
    renderList();
    window.ReGenTokens?.bind(document.getElementById('save-letter'),activeId?null:'cover_letter_create',label('letter.save'));
    updateAi();
    updateWordCount();
    previewReady = true;
    updateProof(true);
    document.dispatchEvent(new Event('regen:letter-loaded'));
  }
  async function refreshList() {
    const result = await Api.listCoverLetters();
    if (!result.success) throw new Error(result.message || 'Unable to load cover letters.');
    letters = result.data || [];
    template = result.template || template;
    renderList();
  }
  async function save() {
    clearTimeout(saveTimer);
    if (saveRequest) {
      if (!await saveRequest) return false;
      if (!dirty) return true;
    }
    if (activeId && !dirty) return true;
    if (!value('company') || !value('role') || !value('letter_date')) {
      status('Enter the company name and role before saving your cover letter.', true);
      return false;
    }
    if (!form.reportValidity()) return false;
    if (!navigator.onLine || !signedIn) {
      saveState.textContent = label(signedIn ? 'letter.offlineState' : 'letter.sessionState');
      return false;
    }
    const submitted = revision;
    const creating = !activeId;
    saveState.textContent = label('studio.saving', 'Saving…');
    saveRequest = (async () => {
      const result = await Api.saveCoverLetter(activeId, data());
      if (!result.success) {
        status(result.message || 'Unable to save your letter.', true);
        saveState.textContent = label('studio.saveFailed');
        return false;
      }
      activeId = result.data.id;
      savedFingerprint = fingerprint(result.data);
      if (creating) document.getElementById('letter-target').open = false;
      window.ReGenTokens?.bind(document.getElementById('save-letter'),null,label('letter.save'));
      dirty = submitted !== revision;
      document.getElementById('delete-letter').hidden = false;
      saveState.textContent = label(dirty ? 'letter.unsavedState' : 'letter.savedState');
      if (!dirty) updateDraftLabel();
      updateLocation(activeId);
      letters = [result.data, ...letters.filter(letter => Number(letter.id) !== Number(activeId))];
      renderList();
      document.dispatchEvent(new CustomEvent('regen:editor-moment',{detail:{kind:'letter-saved',section:'letter'}}));
      if (dirty) scheduleSave();
      return true;
    })();
    try { return await saveRequest; } finally { saveRequest = null; }
  }
  function scheduleSave() {
    clearTimeout(saveTimer);
    if (!activeId || busy || !dirty || !signedIn || !navigator.onLine || !form.checkValidity()) return;
    saveTimer = setTimeout(() => { if (!busy && !saveRequest) void save(); }, 780);
  }
  async function preserveDraft() {
    if (!dirty) return true;
    // SAVE BEFORE SWITCHING SO A COMPLETED DRAFT IS NEVER SILENTLY DISCARDED.
    if (!value('company') || !value('role')) { status('Enter a company and role, then save your draft before switching letters.', true); form.reportValidity(); return false; }
    return save();
  }
  async function openLetter(id) {
    if (busy || Number(id) === Number(activeId)) return;
    setBusy(true);
    try {
      if (!await preserveDraft()) return;
      const result = await Api.getCoverLetter(id);
      if (!result.success) throw new Error(result.message);
      loadLetter(result.data);
      updateLocation(id);
      status('');
      if (!libraryBreakpoint.matches) {
        setLibrary(false);
        libraryToggle.focus({preventScroll:true});
        document.getElementById('main-content').scrollTop = 0;
      }
    } catch (error) { status(error.message, true); } finally { setBusy(false); }
  }
  form.addEventListener('input', event => {
    if (draftStyle.contains(event.target)) return;
    dirty = true;
    revision++;
    updateDraftLabel();
    const pending = label(!signedIn ? 'letter.sessionState' : navigator.onLine ? 'letter.unsavedState' : 'letter.offlineState');
    if (saveState.textContent !== pending) saveState.textContent = pending;
    suggestionBox.hidden = true;
    updateAi();
    updateWordCount();
    updateProof();
    scheduleSave();
  });
  form.addEventListener('invalid', event => {
    const group = event.target.closest('details');
    if (group) group.open = true;
  }, true);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try { if (await save()) status(''); } catch (error) { status(error.message, true); } finally { setBusy(false); }
  });
  document.getElementById('new-letter').onclick = async () => {
    if (busy) return;
    setBusy(true);
    try { if (!await preserveDraft()) return; loadLetter(); updateLocation(null, true); status('');
      proofOpen = wide.matches;
      updateProof();
      if (!libraryBreakpoint.matches) setLibrary(false); }
    catch (error) { status(error.message, true); } finally {
      setBusy(false);
      requestAnimationFrame(() => form.elements.namedItem('company').focus());
    }
  };
  generate.onclick = async () => {
    if (busy || !form.reportValidity()) return;
    setBusy(true);
    const original = generate.innerHTML;
    generate.dataset.loading='true';
    generate.textContent = label('letter.aiWriting');
    try {
      if (!await save()) return;
      const expectedRevision = revision;
      const draftLength = draftStyle.querySelector('input:checked').value;
      const result = await Api.suggestCoverLetter(activeId, { ...data(), draftStyle:draftLength, expectedCost: generationCost });
      updateQuota(result.quota);
      if (!result.success) throw new Error(result.message || 'Unable to generate a suggestion.');
      if (expectedRevision !== revision) return;
      suggestion = result.suggestion;
      document.getElementById('letter-suggestion-text').textContent = suggestion;
      suggestionBox.hidden = false;
      suggestionBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
      status('Draft ready to review.');
    } catch (error) { status(error.message, true); } finally { generate.innerHTML = original; generate.dataset.loading='false'; setBusy(false); window.ReGenTokens?.refresh(); }
  };
  document.getElementById('apply-letter-suggestion').onclick = async () => {
    if (value('body') && !await ReGenDialog.confirm({title:'Use this suggestion?',message:'Your current letter body will be replaced with this draft. You can edit it before saving.',confirmLabel:'Use draft'})) return;
    form.elements.namedItem('body').value = suggestion;
    form.dispatchEvent(new Event('input', {bubbles:true}));
    status('');
    form.elements.namedItem('body').focus();
  };
  document.getElementById('discard-letter-suggestion').onclick = () => {
    suggestionBox.hidden = true;
    status('');
    generate.focus({preventScroll:true});
  };
  document.getElementById('delete-letter').onclick = async () => {
    if (!activeId || busy || !await ReGenDialog.confirm({title:'Delete this cover letter?',message:'This removes the saved letter. It cannot be undone.',confirmLabel:'Delete letter',danger:true})) return;
    setBusy(true);
    try { const result = await Api.deleteCoverLetter(activeId); if (!result.success) throw new Error(result.message); await refreshList(); loadLetter(); updateLocation(null, true); status('Cover letter deleted.'); }
    catch (error) { status(error.message, true); } finally { setBusy(false); }
  };
  previewButton.onclick = () => {
    if (busy || !signedIn || previewDialog.open) return;
    if (!value('letter_date')) { form.reportValidity(); return; }
    previewDialog.showModal();
    setZoom(1);
    previewDialog.querySelector('.letter-preview-stage').scrollTo(0, 0);
    fullProof.update(draftPdf(), {immediate:true, interactive:!LiveDocumentPreview.allowed()});
  };
  document.getElementById('close-letter-preview').onclick = () => previewDialog.close();
  const setZoom = value => {
    fullZoom = Math.max(.5, Math.min(1.6, value));
    fullProof.zoom(fullZoom);
  };
  document.getElementById('letter-zoom-out').onclick = () => setZoom(fullZoom - .15);
  document.getElementById('letter-zoom-fit').onclick = () => setZoom(1);
  document.getElementById('letter-zoom-in').onclick = () => setZoom(fullZoom + .15);
  previewDialog.addEventListener('close', () => {
    fullProof.clear();
    updateProof(true);
    if (previewButton.getClientRects().length) previewButton.focus({preventScroll:true});
  });

  document.getElementById('download-letter').onclick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (!value('body')) { status('Write your letter or apply a ReGen suggestion before downloading.', true); return; }
      if (!await save()) return;
      const response = await (window.ReGenTokens?.fetch||fetch)(`/api/cover-letters/${activeId}/pdf`, { credentials: 'same-origin' });
      if (!response.ok) {
        if (response.status === 401) window.dispatchEvent(new CustomEvent('regen:session-expired'));
        const details = await response.json().catch(() => ({}));
        throw new Error(details.message || 'Unable to download this letter. Please try again.');
      }
      if (!response.headers.get('content-type')?.includes('application/pdf')) throw new Error('The server did not return a PDF. Please try again.');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a'); link.href = url; link.download = (response.headers.get('content-disposition')||'').match(/filename="([^"]+)"/i)?.[1]||'Cover_Letter.pdf'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { status(error.message, true); } finally { setBusy(false); }
  };
  function applyAiStatus(ai) {
    aiAvailable = ai.success && ai.enabled === true;
    updateQuota(ai.quota);
  }
  try {
    status(label('letter.loading'));
    const params = new URLSearchParams(location.search);
    const requested = params.get('id') || (params.get('new') === '1' ? 'new' : '');
    const aiStatus = Api.getAIStatus(true);
    const result = await Api.getLetterStudio(requested);
    if (!result.success) throw new Error(result.message);
    if (!result.studio) {
      status('');
      const empty = document.getElementById('letter-start');
      empty.querySelector('.letter-start-icon').innerHTML = ReGenIcons.icon('template');
      empty.hidden = false;
      return;
    }
    Api.setResumeId(result.studio.resumeId);
    resume = result.studio.settings;
    template = result.template;
    letters = result.data || [];
    const appearance = document.getElementById('letter-design-settings');
    DocumentSettings.init({
      button:appearance, read:() => resume, letterDraft:data, template:() => template,
      apply:settings => { Object.assign(resume, settings); updateProof(true); status(''); },
    });
    document.getElementById('letter-workspace').hidden = false;
    quickTools.hidden = false;
    libraryToggle.hidden = false;
    focusToggle.hidden = false;
    document.getElementById('new-letter').hidden = false;
    loadLetter(result.studio.letter || {});
    void aiStatus.then(applyAiStatus);
    const missingDraft = /^\d+$/.test(requested) && !result.studio.letter;
    status(missingDraft ? label('letter.libraryNoMatches') : '', missingDraft);
  } catch (error) { status(error.message || label('letter.loadError'), true); retryLoad.hidden = false; }
  let liveRefresh;
  window.addEventListener('offline', () => { if (dirty) saveState.textContent = label('letter.offlineState'); });
  window.addEventListener('online', () => { scheduleSave(); updateProof(true); });
  window.addEventListener('regen:session-expired', () => {
    signedIn = false;
    clearTimeout(saveTimer);
    if (previewDialog.open) previewDialog.close();
    updateProof();
    if (dirty) saveState.textContent = label('letter.sessionState');
  });
  window.addEventListener('regen:session-restored', () => { signedIn = true; updateProof(true); scheduleSave(); });
  window.addEventListener('beforeunload', event => {
    if (dirty) { event.preventDefault(); event.returnValue = ''; }
  });
  window.addEventListener('regen:before-update', event => { if (dirty) event.preventDefault(); });
  window.addEventListener('regen:prices-updated', () => updateProof(true));
  window.addEventListener('regen:preview-availability', event => {
    if (!event.detail.available && previewDialog.open) previewDialog.close();
    updateProof(true);
  });
  window.addEventListener('regen:prices-updated',()=>updateQuota());
  const updateLetters = event => {
    const topic = event.detail?.topic;
    if (topic === 'ai' || topic === 'features') {
      void Api.getAIStatus(true).then(applyAiStatus);
      return;
    }
    if (topic && !['documents','profile'].includes(topic)) return;
    clearTimeout(liveRefresh);
    liveRefresh = setTimeout(async () => {
      if (busy || saveRequest) return;
      try {
        await refreshList();
        if (activeId && !dirty && !busy) {
          const currentRevision = revision;
          const currentId = activeId;
          const current = await Api.getCoverLetter(currentId);
          if (current.success && currentId === activeId && revision === currentRevision && !dirty && !busy
            && fingerprint(current.data) !== savedFingerprint) loadLetter(current.data);
        }
      } catch (error) { status(error.message, true); }
    }, 150);
  };
  window.addEventListener('regen:live-change',updateLetters);window.addEventListener('regen:reconcile',updateLetters);window.addEventListener('pagehide',()=>clearTimeout(liveRefresh));

});
