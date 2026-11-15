document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('letter-form');
  const message = document.getElementById('letter-message');
  const list = document.getElementById('letter-list');
  const suggestionBox = document.getElementById('letter-suggestion');
  const saveState = document.getElementById('letter-save-state');
  const generate = document.getElementById('generate-letter');
  const previewDialog = document.getElementById('letter-preview');
  const fields = ['company', 'role', 'recipient', 'company_details', 'job_description', 'body', 'recipient_address', 'letter_date'];
  let activeId = null;
  let dirty = false;
  let busy = false;
  let suggestion = '';
  let revision = 0;
  let letters = [];
  let listPage=1,listSearch='';
  let listSize=matchMedia('(max-width:760px)').matches?4:6;
  let aiAvailable = false;
  let quotaRemaining = null;
  let generationCost = 1;
  const safe = value => ZeekeSafe.attr(value);
  const value = name => form.elements.namedItem(name).value.trim();
  const data = () => Object.fromEntries(fields.map(name => [name, value(name)]));
  function updateWordCount() {
    const count = value('body').match(/\S+/gu)?.length || 0;
    const guide = document.getElementById('letter-word-count');
    guide.textContent = `${count} words${count>450?' · Check length in Preview':''}`;
  }
  function status(text,error=false){message.textContent=text;message.classList.toggle('is-error',error);message.setAttribute('role',error?'alert':'status');if(error)message.scrollIntoView({block:'nearest',behavior:'smooth'});}
  function updateAi() {
    if (generate.dataset.loading === 'true') return;
    document.getElementById('preview-letter').disabled=busy||!activeId;
    document.getElementById('download-letter').disabled=busy||!activeId;
    generate.disabled = busy || !activeId || !aiAvailable || (quotaRemaining !== null && quotaRemaining < generationCost) || !value('company') || !value('role');
    generate.title = !activeId ? 'Save your letter first.' : !value('company') || !value('role') ? 'Enter the company and role first.' : '';
  }
  function setBusy(state) {
    busy = state;form.setAttribute('aria-busy',String(state));
    form.querySelectorAll('button,input,textarea').forEach(control => { control.disabled = state; });
    document.getElementById('new-letter').disabled = state;
    list.querySelectorAll('button').forEach(button => { button.disabled = state; });
    updateAi();
    updateWordCount();
    document.dispatchEvent(new Event('regen:letter-loaded'));
  }
  function updateQuota(quota) {
    if (quota) { quotaRemaining = Number(quota.remaining); generationCost = Number(quota.costs?.cover_letter ?? generationCost); }
    const description=document.getElementById('letter-ai-description');description.textContent='Use your resume and job details.';
    const note = document.getElementById('letter-ai-quota');
    const price=window.ReGenTokens?.getPrice('ai_cover_letter');
    note.textContent = price?.mode==='package_only'&&!price.packageUnlocked&&!price.packageUses?(price.packageIncluded?'Your AI draft allowance is used up.':'AI drafts are not included in your packages.'):!aiAvailable ? 'AI is unavailable. You can write your letter below.' : Number.isFinite(quotaRemaining) ? `${quotaRemaining.toLocaleString()} tokens available` : '';
    window.ReGenTokens?.setAiCosts({cover_letter:generationCost});
    updateAi();
  }
  function renderList() {
    const filtered=letters.filter(letter=>(letter.company+' '+letter.role).toLocaleLowerCase().includes(listSearch));
    const pages=Math.max(1,Math.ceil(filtered.length/listSize));listPage=Math.min(listPage,pages);
    document.getElementById('letter-count').textContent=letters.length;
    list.innerHTML=filtered.length?filtered.slice((listPage-1)*listSize,listPage*listSize).map(letter=>`<button type="button" data-id="${Number(letter.id)}" aria-current="${Number(letter.id)===Number(activeId)}"><strong>${safe(letter.company)}</strong><span>${safe(letter.role)}</span><i class="letter-list-indicator" aria-hidden="true">↗</i></button>`).join(''):`<p class="letter-list-empty">${letters.length?'No letters match your search.':'Your saved letters will appear here. Start a letter for your next application.'}</p>`;
    list.querySelectorAll('button').forEach(button=>button.onclick=()=>openLetter(Number(button.dataset.id)));
    const nav=document.getElementById('letter-pagination');nav.hidden=pages<=1;
    nav.innerHTML=`<button type="button" class="btn btn-secondary" data-prev ${listPage<=1?'disabled':''}>Previous</button><span>${listPage} / ${pages}</span><button type="button" class="btn btn-secondary" data-next ${listPage>=pages?'disabled':''}>Next</button>`;
    nav.querySelector('[data-prev]').onclick=()=>{listPage--;renderList();};nav.querySelector('[data-next]').onclick=()=>{listPage++;renderList();};
  }
  document.getElementById('letter-search').oninput=event=>{listSearch=event.target.value.trim().toLocaleLowerCase();listPage=1;renderList();};
  matchMedia('(max-width:760px)').addEventListener('change',event=>{listSize=event.matches?4:6;listPage=1;renderList();});
  function loadLetter(letter = {}) {
    revision++;
    activeId = letter.id || null;
    fields.forEach(name => { form.elements.namedItem(name).value = letter[name] || ''; });
    if(!value('letter_date')){const now=new Date();form.elements.letter_date.value=new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10);}
    document.getElementById('letter-context').open=false;document.getElementById('letter-job-context').open=false;
    dirty = false;
    suggestion = '';
    suggestionBox.hidden = true;
    document.getElementById('letter-editor-title').textContent = activeId ? 'Edit letter' : 'New letter';
    document.getElementById('delete-letter').hidden = !activeId;
    saveState.textContent = activeId ? 'All changes saved' : 'Save your draft to preview it';
    renderList();
    window.ReGenTokens?.bind(document.getElementById('save-letter'),activeId?null:'cover_letter_create','Save letter');
    updateAi();
    updateWordCount();
  }
  async function refreshList() {
    const result = await Api.listCoverLetters();
    if (!result.success) throw new Error(result.message || 'Unable to load cover letters.');
    letters = result.data || [];
    document.getElementById('letter-template-note').textContent = 'Matches your resume’s typeface and contact details';
    renderList();
  }
  async function save() {
    if (activeId && !dirty) return true;
    if (!value('company') || !value('role')) {
      status('Enter the company name and role before saving your cover letter.', true);
      return false;
    }
    if (!form.reportValidity()) return false;
    saveState.textContent = 'Saving…';
    const result = await Api.saveCoverLetter(activeId, data());
    if (!result.success) { status(result.message || 'Unable to save your letter.', true); saveState.textContent = 'Changes not saved'; return false; }
    activeId = result.data.id;
    window.ReGenTokens?.bind(document.getElementById('save-letter'),null,'Save letter');
    dirty = false;
    document.getElementById('delete-letter').hidden = false;
    saveState.textContent = 'All changes saved';
    history.replaceState(null, '', `/cover-letters?id=${encodeURIComponent(activeId)}`);
    letters = [result.data, ...letters.filter(letter => Number(letter.id) !== Number(activeId))];
    renderList();
    document.dispatchEvent(new CustomEvent('regen:editor-moment',{detail:{kind:'letter-saved',section:'letter'}}));
    return true;
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
      history.replaceState(null, '', `/cover-letters?id=${encodeURIComponent(id)}`);
      status('');
      if(matchMedia('(max-width:760px)').matches)document.querySelector('.letter-editor').scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});
    } catch (error) { status(error.message, true); } finally { setBusy(false); }
  }
  form.addEventListener('input', () => { dirty = true; revision++; saveState.textContent = 'Unsaved changes'; suggestionBox.hidden = true; updateAi(); updateWordCount(); });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try { if (await save()) status('Your cover letter is saved.'); } catch (error) { status(error.message, true); } finally { setBusy(false); }
  });
  document.getElementById('new-letter').onclick = async () => {
    if (busy) return;
    setBusy(true);
    try { if (!await preserveDraft()) return; loadLetter(); history.replaceState(null, '', '/cover-letters'); status(''); form.elements.namedItem('company').focus(); }
    catch (error) { status(error.message, true); } finally { setBusy(false); form.elements.namedItem('company').focus(); }
  };
  generate.onclick = async () => {
    if (busy || !form.reportValidity()) return;
    setBusy(true);
    const original = generate.innerHTML;
    generate.dataset.loading='true';
    generate.textContent = 'Writing draft…';
    try {
      if (!await save()) return;
      const expectedRevision = revision;
      const result = await Api.suggestCoverLetter(activeId, { ...data(), expectedCost: generationCost });
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
    dirty = true;
    revision++;
    updateWordCount();
    saveState.textContent = 'Unsaved changes';
    suggestionBox.hidden = true;
    form.elements.namedItem('body').focus();
  };
  document.getElementById('discard-letter-suggestion').onclick = () => { suggestionBox.hidden = true; };
  document.getElementById('delete-letter').onclick = async () => {
    if (!activeId || busy || !await ReGenDialog.confirm({title:'Delete this cover letter?',message:'This removes the saved letter. It cannot be undone.',confirmLabel:'Delete letter',danger:true})) return;
    setBusy(true);
    try { const result = await Api.deleteCoverLetter(activeId); if (!result.success) throw new Error(result.message); await refreshList(); loadLetter(); history.replaceState(null, '', '/cover-letters'); status('Cover letter deleted.'); }
    catch (error) { status(error.message, true); } finally { setBusy(false); }
  };
  document.getElementById('preview-letter').onclick = async () => {
    if (busy) return;
    setBusy(true);
    try { if (!await save()) return; previewDialog.showModal(); await PdfPages.render(document.getElementById('letter-pdf-pages'), `/api/cover-letters/${activeId}/document`, {documentType:'cover-letter'}); }
    catch (error) { status(error.message, true); } finally { setBusy(false); }
  };
  document.getElementById('close-letter-preview').onclick = () => previewDialog.close();
  previewDialog.addEventListener('close', () => PdfPages.clear(document.getElementById('letter-pdf-pages')));

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
  window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
  window.addEventListener('regen:before-update', event => {if (dirty) event.preventDefault();});
  document.getElementById('new-letter').innerHTML = `${ReGenIcons.icon('add')} New letter`;
  generate.innerHTML = `${ReGenIcons.icon('sparkles')} Generate draft`;
  document.getElementById('letter-ai-heading').insertAdjacentHTML('afterbegin', ReGenIcons.icon('sparkles'));
  for (const [id, icon] of [['save-letter', 'check'], ['preview-letter', 'eye'], ['download-letter', 'download'], ['delete-letter', 'trash']]) document.getElementById(id).insertAdjacentHTML('afterbegin', ReGenIcons.icon(icon));
  const savedLetters=document.getElementById('saved-letters');
  savedLetters.open=!matchMedia('(max-width:760px)').matches;
  matchMedia('(max-width:760px)').addEventListener('change',event=>{savedLetters.open=!event.matches;});
  try {
    const me = await Api.getMe();
    if (!me.success) { location.href = '/login'; return; }
    status('Loading your cover letters…');
    const dashboard = await Api.listResumes();
    if (!dashboard.success) throw new Error(dashboard.message);
    if (!dashboard.profile) {
      status('');
      const empty = document.getElementById('letter-start');
      empty.querySelector('.letter-start-icon').innerHTML = ReGenIcons.icon('template');
      empty.hidden = false;
      return;
    }
    document.getElementById('letter-design-settings').href = `/builder?id=${encodeURIComponent(dashboard.profile.id)}&settings=1`;
    document.getElementById('letter-design-settings').insertAdjacentHTML('afterbegin', ReGenIcons.icon('template'));
    const [, ai] = await Promise.all([refreshList(), Api.getAIStatus()]);
    aiAvailable = ai.success && ai.enabled === true;
    updateQuota(ai.quota);
    document.getElementById('letter-workspace').hidden = false;
    const requested = new URLSearchParams(location.search).get('id');
    if (requested && /^\d+$/.test(requested)) {
      const result = await Api.getCoverLetter(requested);
      if (!result.success) throw new Error(result.message);
      loadLetter(result.data);
    } else loadLetter();
    status('');
  } catch (error) { status(error.message || 'Unable to load cover letters.', true); }
  let liveRefresh;
  window.addEventListener('regen:prices-updated',async()=>{const ai=await Api.getAIStatus();aiAvailable=ai.success&&ai.enabled===true;updateQuota(ai.quota);});
  const updateLetters=event=>{if(event.detail?.topic&&!['documents','profile','ai','feedback'].includes(event.detail.topic))return;clearTimeout(liveRefresh);liveRefresh=setTimeout(async()=>{if(busy)return;try{await refreshList();const ai=await Api.getAIStatus();aiAvailable=ai.success&&ai.enabled===true;updateQuota(ai.quota);if(activeId&&!dirty){const current=await Api.getCoverLetter(activeId);if(current.success)loadLetter(current.data);}}catch(error){status(error.message,true);}},150);};
  window.addEventListener('regen:live-change',updateLetters);window.addEventListener('regen:reconcile',updateLetters);window.addEventListener('pagehide',()=>clearTimeout(liveRefresh));

});
