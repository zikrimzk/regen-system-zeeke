(() => {
  let activeDialog = null;
  let returnFocus = null;
  let scheduled = false;
  const visible = element => element && element.getClientRects().length > 0;
  const controls = dialog => Array.from(dialog.querySelectorAll(
    'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]'
  )).filter(visible);

  function syncDialog() {
    scheduled = false;
    const selector='dialog[open], [role="dialog"][aria-modal="true"]';
    const dialogs=Array.from(document.querySelectorAll(selector)).filter(visible);
    // Native showModal() moves focus to the top layer, which may differ from DOM order.
    const focused=document.activeElement?.closest(selector);
    const dialog=(dialogs.includes(focused)?focused:dialogs.at(-1))||null;
    if (dialog === activeDialog) return;
    if (dialog) {
      returnFocus = document.activeElement;
      activeDialog = dialog;
      if (!dialog.contains(document.activeElement)) controls(dialog)[0]?.focus();
    } else {
      activeDialog = null;
      if (visible(returnFocus)) returnFocus.focus();
      returnFocus = null;
    }
  }

  document.addEventListener('keydown', event => {
    if (event.key !== 'Tab' || !activeDialog) return;
    const items = controls(activeDialog);
    if (!items.length) { event.preventDefault(); return; }
    const first = items[0];
    const last = items.at(-1);
    if (event.shiftKey && (document.activeElement === first || !activeDialog.contains(document.activeElement))) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !activeDialog.contains(document.activeElement))) {
      event.preventDefault(); first.focus();
    }
  });

  const dialogObserver = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(syncDialog);
  });
  const observeDialogs=()=>{if(document.body)dialogObserver.observe(document.body,{subtree:true,attributes:true,attributeFilter:['class','hidden','open'],childList:true});};
  if(document.body)observeDialogs();else document.addEventListener('DOMContentLoaded',observeDialogs,{once:true});
})();

// SHARED MOBILE DESTINATIONS KEEP THE WORKSPACE HEADER COMPACT.
document.addEventListener('DOMContentLoaded', () => {
  if (!document.body.classList.contains('user-workspace') || document.body.matches('.auth-page,.studio-workbench')) return;
  if(document.querySelector('.mobile-product-nav')){document.body.classList.add('has-mobile-nav');return;}
  const nav = document.createElement('nav');
  nav.className = 'mobile-product-nav';
  nav.setAttribute('aria-label','Workspace navigation');
  const links = [['/dashboard','Resume','template'],['/cover-letters','Letters','letter'],['/profile','Account','personal']];
  nav.innerHTML = links.map(([url,label,icon]) => `<a href="${url}" ${location.pathname === url || (url === '/dashboard' && location.pathname === '/templates') ? 'aria-current="page"' : ''}>${ReGenIcons.icon(icon)}<span>${label}</span></a>`).join('');
  document.body.append(nav);
  document.body.classList.add('has-mobile-nav');
});
// Shared confirmations for document actions. Text is inserted without HTML interpolation.
window.ReGenDialog = (() => {
  let active = null;
  let sequence = 0;
  function confirm({title,message,confirmLabel='Confirm',danger=false}) {
    if(active)return Promise.resolve(false);
    return new Promise(resolve=>{
      const previous=document.activeElement;
      const dialog=document.createElement('dialog');active=dialog;
      const id='workspace-confirm-'+(++sequence);
      dialog.className='workspace-confirm-dialog';dialog.setAttribute('aria-labelledby',id);
      dialog.innerHTML='<div class="workspace-confirm-copy"><h2></h2><p data-message></p></div><footer><button type="button" class="btn btn-secondary" data-cancel></button><button type="button" class="btn btn-primary" data-confirm></button></footer>';
      const heading=dialog.querySelector('h2');heading.id=id;heading.textContent=title;
      dialog.querySelector('[data-message]').textContent=message;
      const accept=dialog.querySelector('[data-confirm]');accept.textContent=confirmLabel;accept.classList.toggle('is-danger',danger);
      const cancel=dialog.querySelector('[data-cancel]');
      cancel.textContent=window.ReGenText?.get('common.cancel','Cancel')||'Cancel';
      accept.onclick=()=>dialog.close('confirmed');cancel.onclick=()=>dialog.close();
      dialog.addEventListener('close',()=>{const accepted=dialog.returnValue==='confirmed';dialog.remove();active=null;if(previous?.isConnected)previous.focus();resolve(accepted);},{once:true});
      document.body.append(dialog);dialog.showModal();cancel.focus();
    });
  }
  return {confirm};
})();
