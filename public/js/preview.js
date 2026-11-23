const Preview = (() => {
  let modal, focusBefore, proof, zoom = 1;
  let originalParent, writeMode, previewMode, mobile, inline=false;
  function init(){
    modal = document.getElementById('preview-modal');
    proof = LiveDocumentPreview.create(document.getElementById('preview-pdf-pages'), Api.documentDraft);
    originalParent=modal.parentElement;
    writeMode=document.getElementById('studio-write-mode');
    previewMode=document.getElementById('studio-preview-mode');
    mobile=matchMedia('(max-width: 760px)');
    document.getElementById('preview-open-top')?.addEventListener('click',()=>open());
    previewMode?.addEventListener('click',()=>open(true));
    writeMode?.addEventListener('click',()=>close(false));
    document.getElementById('close-preview-modal')?.addEventListener('click',()=>close());
    document.getElementById('preview-zoom-in')?.addEventListener('click',()=>setZoom(zoom+.1));
    document.getElementById('preview-zoom-out')?.addEventListener('click',()=>setZoom(zoom-.1));
    document.getElementById('preview-zoom-fit')?.addEventListener('click',()=>setZoom(1));
    modal?.addEventListener('click',event=>{if(event.target===modal)close();});
    document.addEventListener('keydown',event=>{
      if(modal?.classList.contains('hidden'))return;
      if(event.key==='Escape' && !document.querySelector('dialog[open]'))close();
      if(event.key==='Tab' && !inline){
        const controls=[...modal.querySelectorAll('button:not([disabled])')],first=controls[0],last=controls.at(-1);
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      }
    });
    mobile.addEventListener('change',()=>close(false));
    document.addEventListener('regen:studio-review',()=>close(false));
    window.addEventListener('regen:session-expired',()=>{ close(false); });
    window.addEventListener('regen:preview-availability',event=>{
      if(!event.detail.available){close(false);}
    });
  }
  function open(useInline=false){
    if(!modal.classList.contains('hidden'))return;
    focusBefore=document.activeElement;
    inline=useInline&&mobile.matches;
    if(inline){
      document.querySelector('.builder-left').append(modal);
      modal.classList.add('is-inline');
      modal.setAttribute('role','region');
      modal.removeAttribute('aria-modal');
      modal.setAttribute('aria-labelledby','draft-preview-title');
      document.body.dataset.studioMode='preview';
      writeMode.setAttribute('aria-pressed','false');
      previewMode.setAttribute('aria-pressed','true');
    }else document.body.classList.add('preview-open');
    modal.classList.remove('hidden');
    if(!inline)document.getElementById('close-preview-modal').focus();
    refreshNow();
  }
  function close(restoreFocus=true){
    if(!modal||modal.classList.contains('hidden'))return;
    proof.clear();
    modal.classList.add('hidden');
    document.body.classList.remove('preview-open');
    if(inline){
      originalParent.append(modal);
      modal.classList.remove('is-inline');
      modal.setAttribute('role','dialog');
      modal.setAttribute('aria-modal','true');
      modal.removeAttribute('aria-labelledby');
      delete document.body.dataset.studioMode;
      writeMode.setAttribute('aria-pressed','true');
      previewMode.setAttribute('aria-pressed','false');
    }
    inline=false;
    if(restoreFocus)focusBefore?.focus();
  }
  function setZoom(value) {
    zoom = Math.max(.5, Math.min(1.6, value));
    proof.zoom(zoom);
  }
  function refreshNow() {
    if (modal && !modal.classList.contains('hidden')) {
      proof.update(Stepper.getDraftResume(), {immediate:true, interactive:!LiveDocumentPreview.allowed()});
    }
  }
  function renderDraft(data) {
    if (modal && !modal.classList.contains('hidden') && LiveDocumentPreview.allowed()) proof.update(data);
  }
  return {init,open,close,refreshNow,renderDraft,isOpen:()=>!!modal && !modal.classList.contains('hidden')};
})();
