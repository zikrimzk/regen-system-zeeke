/* One pricing source for labels, confirmations and account balances. */
window.ReGenTokens=(()=>{
  let queue=Promise.resolve(),prices={},aiCosts={},request=null,refreshTimer,observer,lastPriceSignature='',pollTimer,balanceRevision=0,accessDialog=null;
  let balance;
  const originalLabels=new WeakMap();
  const reviewedControls=new WeakSet(), pendingReviews=new WeakSet();
  const safe=value=>ReGenCommerce.safe(value);
  const priceLocked=price=>price?.mode==='package_only'&&!price.packageUnlocked&&!price.packageUses;
  const storeUrl=key=>key?'/store?feature='+encodeURIComponent(key)+'#package-offers':'/store';
  const upgradeCopy={
    cover_letters:['Add cover letters to your workspace','Write a tailored letter to send with your resume.'],
    cover_letter_create:['Create a tailored cover letter','Keep a separate letter for each role you apply for.'],
    ai_assist:['Get a head start with Assist me','Turn your experience and notes into a draft you can review and edit.'],
    ai_refine:['Polish your writing with Refine','Review suggested edits and choose what to keep.'],
    pdf_download:['Download your application','Get a PDF ready to upload or share.'],
    templates:['Find your next resume design','Explore packages with access to more templates.']
  };
  function actionState(price) {
    if (!price) return {kind:'',text:'',hint:''};
    if (priceLocked(price)) {
      const text=price.packageIncluded?'Limit reached':'Locked';
      return {kind:'locked',text:'',hint:text+'. View packages for this feature.'};
    }
    if (price.packageUnlocked) return {kind:'',text:'',hint:price.packageUnlimited?'Unlimited uses in your package.':''};
    if (price.packageUses>0) return {kind:'uses',text:price.packageUses+' left',hint:price.packageUses+' package '+(price.packageUses===1?'use':'uses')+' left.'};
    if (price.credits>0) return {kind:'uses',text:price.credits+' left',hint:price.credits+' prepaid '+(price.credits===1?'use':'uses')+' left.'};
    if (price.mode==='free'||price.unlocked) return {kind:'',text:'',hint:''};
    const label=price.cost+' Coin';
    return {kind:'tokens',text:String(price.cost),hint:label+(price.mode==='unlock'?' to unlock.':' per use.')};
  }
  function bind(element,key,base){
    if(!element)return;
    if(key)element.dataset.priceFeature=key;else delete element.dataset.priceFeature;
    element.dataset.priceBase=base;
    paint(element);
  }
  function paint(element){
    const price=prices[element.dataset.priceFeature];
    element.toggleAttribute('data-package-hidden',price?.hiddenByPackage===true);
    if(price?.hiddenByPackage) return;
    if(element.dataset.loading==='true'||element.closest('[aria-busy="true"]')||(element.disabled&&/^(Preparing|Saving|Loading|Writing|Downloading|Uploading|Creating|Generating|Applying)/i.test(element.textContent.trim())))return;
    const base=element.dataset.priceBase;if(!base)return;
    const state=actionState(prices[element.dataset.priceFeature]);
    let label=element.querySelector('.token-action-label');
    if(!label){
      label=element.querySelector('.button-label')||[...element.children].find(child=>child.tagName==='SPAN'&&!child.classList.contains('ui-icon'));
      if(!label){label=document.createElement('span');element.append(label);}
      [...element.childNodes].filter(node=>node.nodeType===Node.TEXT_NODE).forEach(node=>node.remove());
      label.classList.add('token-action-label');
    }
    if(label.textContent!==base)label.textContent=base;
    let badge=element.querySelector('.token-action-status');
    if(!state.kind||element.classList.contains('studio-icon')){badge?.remove();}
    else{
      if(!badge){
        badge=document.createElement('span');
        badge.className='token-action-status';
        badge.setAttribute('aria-hidden','true');
        element.append(badge);
      }
      const signature=state.kind + state.text;
      if(badge.dataset.state!==signature){
        badge.dataset.state=signature;
        badge.className='token-action-status is-'+state.kind;
        badge.innerHTML=state.kind==='locked'?ReGenIcons.icon('lock'):state.kind==='tokens'
          ? ReGenCommerce.coin('small') + safe(state.text)
          : safe(state.text);
      }
    }
    element.classList.toggle('is-package-locked',state.kind==='locked');
    if(state.hint){
      if(!originalLabels.has(element))originalLabels.set(element,[element.getAttribute('aria-label'),element.getAttribute('title')]);
      element.setAttribute('aria-label',base+'. '+state.hint);
      element.title=state.hint;
    }else if(originalLabels.has(element)){
      const [label,title]=originalLabels.get(element);
      for(const [name,value] of [['aria-label',label],['title',title]]){
        if(value===null)element.removeAttribute(name);
        else element.setAttribute(name,value);
      }
      originalLabels.delete(element);
    }
  }
  const controls=[
    ['#save-letter','cover_letter_create','Save letter'],['#generate-letter','ai_cover_letter','Generate draft'],
    ['#download-letter','pdf_download','Download'],['#preview-letter','document_preview','Preview'],
    ['#letter-design-settings','document_settings','Appearance'],['#resume-layout-settings','document_settings','Page setup'],
    ['#download-resume,#btn-download-pdf','pdf_download','Download'],
    ['#open-resume-preview,#preview-open-top','document_preview','Preview'],
    ['#photo-choose-btn','photo_upload','Upload photo'],
    ['#empty-create','resume_create','Create resume'],
    ['a.btn[href^="/builder"]:not(#letter-design-settings)','resume_editor','Continue editing'],
    ['.ai-section-request','ai_refine','Refine'],['.ai-regenerate','ai_refine','Regenerate'],
    ['.assist-open','ai_assist','Assist me'],['.assist-generate','ai_assist','Generate draft'],
    ['[data-unlock-feature]',null,'Unlock feature']
  ];
  const interfaceLabels = {
    'Preview':'common.preview', 'Download':'common.download', 'Page setup':'studio.pageSettings', 'Appearance':'common.appearance',
    'Continue editing':'dashboard.continue', 'Create resume':'public.build', 'Save letter':'letter.save', 'Generate draft':'letter.aiGenerate',
  };
  function sync(){
    for(const [selector,key] of [['.assist-launcher','ai_assist'],['.ai-refine-row,.ai-section-result','ai_refine'],['.ats-review-request','ai_review'],['#generate-letter','ai_cover_letter']]){
      document.querySelectorAll(selector).forEach(element=>element.toggleAttribute('data-package-hidden',prices[key]?.hiddenByPackage===true));
    }
    for(const [selector,key,base] of controls)document.querySelectorAll(selector).forEach(element=>{
      // Save is priced only when it creates a letter; later edits are free.
      if(element.id==='save-letter'&&Object.hasOwn(element.dataset,'priceBase')){paint(element);return;}
      if(key)bind(element,key, element.dataset.priceBase || (window.ReGenText?.get(interfaceLabels[base], base) ?? base));
    });
    document.querySelectorAll('[data-price-feature]').forEach(paint);
    document.querySelectorAll('a[href="/cover-letters"]').forEach(link=>{
      const locked=priceLocked(prices.cover_letters);
      const existing=link.querySelector('.nav-access-icon');
      if(!locked){
        if(existing){
          existing.remove();
          const label=link.getAttribute('aria-label');
          if(label)link.title=label;
          else link.removeAttribute('title');
        }
        return;
      }
      link.title='See packages with cover letters';
      if(existing)return;
      const icon=document.createElement('span');
      icon.className='nav-access-icon';
      icon.setAttribute('aria-hidden','true');
      icon.innerHTML=ReGenIcons.icon('lock');
      link.append(icon);
    });
  }
  async function refresh(){
    if(request)return request;
    request=(async()=>{
      const revision=balanceRevision;
      const result=await Api.getFeaturePrices();if(!result.success)return;
      prices=result.prices;
      if(revision===balanceRevision)updateBalance(result.balance);
      sync();const signature=JSON.stringify(prices);if(signature!==lastPriceSignature){lastPriceSignature=signature;window.dispatchEvent(new CustomEvent('regen:prices-updated',{detail:{prices,balance:result.balance}}));}
    })().finally(()=>{request=null;});return request;
  }
  function updateBalance(value){
    balanceRevision++;
    balance = value;
    document.querySelectorAll('[data-token-total]').forEach(element=>{element.textContent=ReGenCommerce.number(value.total);const link=element.closest('a');if(link){link.title=`${value.base} base + ${value.bonus} bonus & saved Coin`;link.setAttribute('aria-label',`${ReGenCommerce.number(value.total)} ${window.ReGenText?.get('commerce.available', 'Coin available') || 'Coin available'}`);}});
    window.dispatchEvent(new CustomEvent('regen:balance-updated',{detail:value}));
  }
  function setAiCosts(costs){Object.assign(aiCosts,costs);sync();}
  async function review(input){
    const result=await Api.getFeaturePrices();if(!result.success)return false;
    prices=result.prices;sync();
    const price=result.prices[input.price?.key||input.key];if(!price)return false;
    if(priceLocked(price)){await showAccess({price,message:price.packageIncluded?'Your package allowance is used up.':'Your active packages do not include this feature.'});return false;}
    if(price.mode==='free'||price.unlocked||(!input.ignorePackageBenefits&&(price.packageUnlocked||price.packageUses>0||price.credits>0)))return true;
    return new Promise(resolve=>{
      const dialog=document.createElement('dialog');dialog.className='token-dialog';dialog.setAttribute('aria-labelledby','token-dialog-title');
      const enough=result.wallet.available>=price.cost,reference=crypto.randomUUID();let sending=false;
      dialog.innerHTML=`<div class="token-dialog-content"><button class="token-close" type="button" aria-label="Close">×</button><p class="token-eyebrow">Confirm Coin use</p><h2 id="token-dialog-title">${safe(price.name)}</h2><p>${price.mode==='unlock'?'Unlock access for your account.':'One use. An unsuccessful action keeps your prepaid credit available.'}</p><div class="token-review-total"><span>${price.mode==='unlock'?'One-time unlock':'One use'}</span><strong>${price.cost.toLocaleString()} <small>Coin</small></strong></div><p class="token-review-balance">Saved Coin available <strong>${Number(result.wallet.available).toLocaleString()}</strong></p><p class="token-dialog-error" role="status">${enough?'':'You need '+(price.cost-result.wallet.available).toLocaleString()+' more saved Coin.'}</p><div class="token-dialog-actions"><button class="btn btn-primary" data-spend ${enough?'':'disabled'}>Use ${price.cost.toLocaleString()} Coin</button><button class="btn btn-secondary" data-cancel>Cancel</button></div><a class="text-link" href="/store">View packages &amp; balance ↗</a></div>`;
      const returnFocus=document.activeElement;
      const finish=accepted=>{dialog.close();dialog.remove();returnFocus?.isConnected&&returnFocus.focus();resolve(accepted);};
      dialog.querySelector('[data-cancel]').onclick=()=>finish(false);dialog.querySelector('.token-close').onclick=()=>{if(!sending)finish(false);};
      dialog.addEventListener('cancel',event=>{event.preventDefault();if(!sending)finish(false);});
      dialog.querySelector('[data-spend]').onclick=async()=>{
        if(sending)return;sending=true;dialog.querySelectorAll('button').forEach(button=>button.disabled=true);
        try{
          const me=await Api.getMe();if(!me.success)throw new Error('Sign in again to continue.');
          const purchase=await Api.purchaseFeatureAccess({feature:price.key,version:price.version,reference});
          if(!purchase.success)throw new Error(purchase.message||'Coin use could not complete.');
          window.dispatchEvent(new CustomEvent('regen:wallet-changed'));finish(true);
        }catch(error){dialog.querySelector('.token-dialog-error').textContent=error.message;sending=false;dialog.querySelectorAll('button').forEach(button=>button.disabled=false);}
      };
      document.body.append(dialog);dialog.showModal();
    });
  }
  function authorize(input){const operation=queue.then(()=>review(input));queue=operation.catch(()=>false);return operation;}
  function showAccess(data) {
    if (accessDialog) return accessDialog;
    accessDialog = new Promise(resolve => {
      const modal = document.createElement('dialog');
      modal.className = 'token-dialog';
      modal.setAttribute('aria-labelledby','package-options-title');
      const exhausted = data.code==='PACKAGE_LIMIT_REACHED'||data.price?.packageIncluded;
      const name = data.price?.name;
      const feature = name?.replace(/^[A-Z](?=[a-z])/,letter=>letter.toLowerCase());
      const copy = upgradeCopy[data.price?.key];
      const title = exhausted ? 'Need more '+(feature||'uses')+'?' : copy?.[0]||(feature?'Unlock '+feature:'Your access has changed');
      const message = exhausted
        ? 'You’ve used the allowance in your current packages. Find a package with more uses.'
        : copy?.[1]||(feature?'Find a package that includes this feature.':data.message);
      modal.innerHTML = `<div class="token-dialog-content"><span class="package-dialog-icon">${ReGenIcons.icon('lock')}</span><h2 id="package-options-title">${safe(title)}</h2><p>${safe(message)}</p><div class="token-dialog-actions"><a class="btn btn-primary" href="${storeUrl(data.price?.key)}">${feature?'See matching packages':'Explore packages'} ${ReGenIcons.icon('arrowRight')}</a><button class="btn btn-secondary" type="button">Back</button></div></div>`;
      const focus = document.activeElement;
      modal.addEventListener('close',()=>{modal.remove();focus?.isConnected&&focus.focus();accessDialog=null;resolve();},{once:true});
      modal.querySelector('button').onclick=()=>modal.close();
      document.body.append(modal);
      modal.showModal();
    });
    return accessDialog;
  }
  async function protectedFetch(url,options={}){
    for(let attempt=0;attempt<4;attempt++){
      const response=await fetch(url,options);if(response.status===403){const denied=await response.clone().json().catch(()=>({}));if(['PACKAGE_ACCESS_REQUIRED','PACKAGE_LIMIT_REACHED','ACCESS_CHANGED'].includes(denied.code)){setTimeout(refresh,100);await showAccess(denied);}return response;}if(response.status!==402||attempt===3){if(response.ok)setTimeout(refresh,100);return response;}
      const data=await response.clone().json().catch(()=>({}));if(data.code!=='TOKEN_ACCESS_REQUIRED'||!await authorize(data))return response;
    }
  }
  document.addEventListener('click',async event=>{
    const control=event.target.closest('[data-price-feature]');
    if(!control||control.disabled)return;
    const price=prices[control.dataset.priceFeature];
    const locked=priceLocked(price);
    const review=control.hasAttribute('data-review-uses')&&actionState(price).kind==='uses'
      && (!control.form||control.form.checkValidity());
    if(!locked&&(!review||reviewedControls.delete(control)))return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if(locked){showAccess({price});return;}
    if(pendingReviews.has(control))return;
    pendingReviews.add(control);
    try {
      const key=price.packageUses>0?'studio.packageUseReview':'studio.prepaidUseReview';
      const description=ReGenText.get(key).replace('{count}',price.packageUses||price.credits);
      if(await ReGenDialog.confirm({title:control.dataset.priceBase,message:description,confirmLabel:ReGenText.get('studio.confirmUse')})&&control.isConnected&&!control.disabled){
        reviewedControls.add(control);
        control.click();
        reviewedControls.delete(control);
      }
    } finally {
      pendingReviews.delete(control);
    }
  },true);
  document.addEventListener('DOMContentLoaded',()=>{
    const key=document.body.dataset.requiredFeature;
    if(key){const button=document.querySelector('[data-unlock-feature]');button.onclick=async()=>{button.disabled=true;try{if(await authorize({key}))location.reload();}finally{button.disabled=false;}};refresh().then(()=>{button.hidden=priceLocked(prices[key]);if(!button.hidden)bind(button,key,'Review access');});}
    let queued=false;observer=new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;sync();});});
    observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-busy','data-loading']});
    sync();refresh();
    pollTimer=setInterval(()=>{if(!document.hidden&&!window.ReGenLive?.connected)refresh();},90000);
  });
  const update=event=>{if(event.detail?.topic&&!['store','pricing','wallet','ai'].includes(event.detail.topic))return;clearTimeout(refreshTimer);refreshTimer=setTimeout(refresh,180);};
  ['regen:live-change','regen:reconcile','regen:wallet-changed','regen:bonus-updated','regen:priced-action-completed'].forEach(name=>window.addEventListener(name,update));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
  window.addEventListener('pagehide',()=>{observer?.disconnect();clearTimeout(refreshTimer);clearInterval(pollTimer);});
  window.addEventListener('pageshow',event=>{if(event.persisted){observer?.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-busy','data-loading']});clearInterval(pollTimer);pollTimer=setInterval(()=>{if(!document.hidden&&!window.ReGenLive?.connected)refresh();},90000);refresh();}});
  return {authorize,showAccess,getPrice:key=>prices[key],getBalance:()=>balance,fetch:protectedFetch,bind,refresh,setAiCosts,updateBalance};
})();
