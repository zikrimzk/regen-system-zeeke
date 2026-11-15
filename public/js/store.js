document.addEventListener('DOMContentLoaded',async()=>{
  const host=document.getElementById('token-store-content');if(!host)return;
  const {safe,number,date,balance,card}=ReGenCommerce;
  const status=document.getElementById('store-status');
  const requestedFeature=new URLSearchParams(location.search).get('feature')||'';
  let focusedSection=false;
  const activity=document.body.dataset.tokenView==='activity';
  const sessionReady=Api.getMe();
  let page=1,pending=false,again=false,current=null,timer,boundaryTimer,successNotice='',heroPage=1,rowPage=1,grantPage=1;

  function scheduleOffers(items){
    clearTimeout(boundaryTimer);
    const now=Date.now();
    const future=items.flatMap(item=>[item.promotion_starts_at,item.promotion_ends_at,item.claim?.startsAt,item.claim?.endsAt])
      .filter(Boolean).map(value=>Date.parse(value.replace(' ','T')+'Z')).filter(time=>time>now);
    if(future.length)boundaryTimer=setTimeout(()=>{if(!document.hidden)load();},Math.min(2147483647,Math.min(...future)-now+100));
  }
  async function load(){
    if(pending){again=true;return;}pending=true;
    try{
      const response=await (activity?Api.getTokenActivity(page):Api.getTokenStore(page,1,heroPage,rowPage,grantPage,requestedFeature));
      if(!response.success)throw new Error(response.message||'This page could not load.');
      current=response;status.textContent=successNotice;status.classList.toggle('is-success',Boolean(successNotice));
      window.ReGenTokens?.updateBalance(response.balance);
      if(activity){
        host.innerHTML=balance(response.balance,{activity:false})+`<section class="token-section"><div class="token-section-head"><h2>Token activity</h2></div>${response.ledger.length?`<ol class="token-history">${response.ledger.map(item=>`<li><div><h3>${safe(item.reason.replace(/AI: (assist|refine|cover_letter|review)/,(_,key)=>response.prices[{assist:"ai_assist",refine:"ai_refine",cover_letter:"ai_cover_letter",review:"ai_review"}[key]].name).replace(/: ([a-z_]+)$/,(_,key)=>": "+(response.prices[key]?.name||key)))}</h3><time>${safe(date(item.created_at))}</time></div><div class="token-history-change${Number(item.amount)>0?' is-positive':''}">${Number(item.amount)>0?'+':''}${number(item.amount)}${item.bucket==='package'?' use':''}<small>${item.bucket==='saved'?'Saved balance '+number(item.balance_after):item.bucket==='base'?'Base tokens':'Package use'}</small></div></li>`).join('')}</ol>`:'<div class="token-empty"><h3>No activity on this page</h3><p>Your rewards, token spending and package usage appear here.</p></div>'}${(response.total>response.pageSize||response.creditTotal>10)?`<nav class="token-pagination"><button class="btn btn-secondary" data-page="-1" ${page<=1?'disabled':''}>Previous</button><span>Page ${page} of ${Math.max(Math.ceil(response.total/response.pageSize),Math.ceil(response.creditTotal/10))}</span><button class="btn btn-secondary" data-page="1" ${page>=Math.max(Math.ceil(response.total/response.pageSize),Math.ceil(response.creditTotal/10))?'disabled':''}>Next</button></nav>`:''}</section>${response.credits.length?`<section class="token-section"><h2>Unused prepaid actions</h2><div class="token-used-credits">${response.credits.map(credit=>`<article class="token-credit"><p>${safe(response.prices[credit.feature_key]?.name||credit.feature_key)}<small>${number(credit.paid_tokens)} tokens · ${credit.state==='held'?'In progress':'Ready'}</small></p><button class="btn btn-secondary" type="button" data-refund="${credit.id}" ${credit.state==='held'?'disabled':''}>Return credit</button></article>`).join('')}</div></section>`:''}`;
      }else{
        document.querySelector('.store-page-heading h1').textContent=response.policy.title;
        document.querySelector('.store-page-heading>p:last-child').textContent=response.policy.description;
        const section=(layout,title)=>{const group=response.sections[layout];if(!group.total)return '';return `<section class="token-section" id="${layout==='hero'?'token-packages':'token-quick-offers'}"><div class="token-section-head"><h2>${title}</h2></div><div class="${layout==='hero'?'token-package-grid':'token-offer-list'}">${group.items.map(item=>card(item,response.prices)).join('')}</div>${group.total>group.pageSize?`<nav class="token-pagination" aria-label="${title} pages"><button class="btn btn-secondary" type="button" data-layout-page="${layout}" data-direction="-1"${group.page<=1?' disabled':''}>Previous</button><span>Page ${group.page} of ${Math.ceil(group.total/group.pageSize)}</span><button class="btn btn-secondary" type="button" data-layout-page="${layout}" data-direction="1"${group.page*group.pageSize>=group.total?' disabled':''}>Next</button></nav>`:''}</section>`;};
        host.innerHTML=balance(response.balance)+`${response.grants.length?`<section class="token-section token-your-packages"><div class="token-section-head"><h2>Your packages</h2></div><div class="token-owned-grid">${response.grants.map(grant=>`<article class="token-owned"><div><h3>${safe(grant.package_name)}</h3><span>${grant.expires_at?'Expires '+safe(date(grant.expires_at)):'No expiry'}</span></div><ul>${(grant.credited_tokens||!grant.features.length)?`<li><span>Saved tokens credited</span><strong>${number(grant.credited_tokens)}</strong></li>`:''}${grant.features.map(feature=>`<li><span>${safe(feature.key==='templates'?(feature.tiers||['basic','premium']).map(tier=>tier==='basic'?'Basic':'Premium').join(' + ')+' template unlocks':feature.name)}</span><strong>${feature.remaining===null?(feature.unlimited?'Unlimited':'Included'):number(feature.remaining)+' / '+number(feature.included)+' left'}</strong></li>`).join('')}</ul></article>`).join('')}</div>${response.grantTotal>10?`<nav class="token-pagination" aria-label="Your package pages"><button class="btn btn-secondary" data-owned-page="-1"${grantPage<=1?' disabled':''}>Previous</button><span>Page ${grantPage} of ${Math.ceil(response.grantTotal/10)}</span><button class="btn btn-secondary" data-owned-page="1"${grantPage*10>=response.grantTotal?' disabled':''}>Next</button></nav>`:''}</section>`:''}${response.policy.notice?`<p class="token-offers-notice">${safe(response.policy.notice)}</p>`:''}<div id="package-offers" class="package-offers-anchor">${response.feature?`<div class="package-filter"><h2>Packages with ${safe(response.prices[response.feature].name.replace(/^([A-Z])(?![A-Z])/,letter=>letter.toLowerCase()))}</h2><a class="btn btn-secondary" href="/store#package-offers">See all packages</a></div>`:''}${section('hero','Featured packages')}${section('row','Quick offers')}${!response.sections.hero.total&&!response.sections.row.total?`<section class="token-section"><div class="token-empty"><h3>${response.feature?'No matching offers right now':response.policy.enabled?'New packages are on the way':'Packages are paused'}</h3><a class="btn btn-secondary" href="/dashboard">Back to your resume</a></div></section>`:''}</div>`;
        const owned=host.querySelector('.token-your-packages');
        if(owned) owned.id='your-packages';
        if(!focusedSection&&['#package-offers','#your-packages'].includes(location.hash)){
          const sectionTarget=host.querySelector(location.hash);
          if(sectionTarget){focusedSection=true;sectionTarget.scrollIntoView();}
        }
        scheduleOffers([...response.sections.hero.items,...response.sections.row.items]);
      }
    }catch(error){status.classList.remove('is-success');status.textContent=error.message;if(!current)host.innerHTML='<div class="token-empty"><h2>Unable to load</h2><button type="button" class="btn btn-secondary" data-retry>Try again</button></div>';}
    finally{pending=false;if(again){again=false;load();}}
  }
  host.addEventListener('click',async event=>{
    if(event.target.closest('[data-retry]'))return load();
    const layoutPage=event.target.closest('[data-layout-page]');if(layoutPage){if(layoutPage.dataset.layoutPage==='hero')heroPage=Math.max(1,heroPage+Number(layoutPage.dataset.direction));else rowPage=Math.max(1,rowPage+Number(layoutPage.dataset.direction));return load();}
    const ownedPage=event.target.closest('[data-owned-page]');if(ownedPage){grantPage=Math.max(1,grantPage+Number(ownedPage.dataset.ownedPage));return load();}
    const pager=event.target.closest('[data-page]');if(pager){page=Math.max(1,page+Number(pager.dataset.page));return load();}
    const details=event.target.closest('[data-view-package]');
    if(details){
      const item=[...current.sections.hero.items,...current.sections.row.items].find(pkg=>pkg.id===Number(details.dataset.viewPackage));
      if(!item)return;
      const dialog=document.createElement('dialog');
      dialog.className='token-dialog package-offer-dialog';
      dialog.setAttribute('aria-label',item.name);
      dialog.innerHTML=`<div class="token-dialog-content"><button type="button" class="token-close" aria-label="Close">${ReGenIcons.icon('close')}</button>${card({...item,card_layout:'hero'},current.prices,false,{detail:true,checkoutAvailable:current.checkoutAvailable})}<p class="payment-message" role="status"></p><a href="/payments" class="text-link">Payment history</a></div>`;
      const pay = dialog.querySelector('[data-start-checkout]');
      const message = dialog.querySelector('.payment-message');
      if (pay) pay.onclick = async () => {
        pay.disabled = true;
        pay.textContent = 'Opening HitPay…';
        message.textContent = '';
        const session = await sessionReady;
        const result = session.success ? await Api.startCheckout({
          packageId:Number(item.id),version:Number(item.version),
          amountMinor:Number(item.display_price_minor),requestKey:crypto.randomUUID(),
        }) : {message:'Sign in again to continue.'};
        if (result.success) {
          location.assign(result.order.checkoutUrl || '/payments?order='+encodeURIComponent(result.order.reference));
          return;
        }
        message.textContent = result.message || 'Checkout could not start. Try again.';
        pay.textContent = 'Continue to HitPay';
        pay.disabled = result.status === 409;
        if (result.status === 409) load();
      };
      dialog.querySelector('.token-close').onclick=()=>dialog.close();
      dialog.addEventListener('close',()=>{dialog.remove();details.isConnected&&details.focus();},{once:true});
      document.body.append(dialog);
      dialog.showModal();
      return;
    }
    const claim=event.target.closest('[data-claim-package]');if(claim){claim.disabled=true;claim.textContent='Claiming…';try{await sessionReady;const result=await Api.claimPackage(Number(claim.dataset.claimPackage),Number(claim.dataset.packageVersion));if(!result.success)throw new Error(result.message||'Unable to claim this package.');successNotice=result.duplicate?'You already claimed this package.':'Package claimed. Your benefits are ready.';window.dispatchEvent(new CustomEvent('regen:wallet-changed'));await load();}catch(error){successNotice='';await load();status.classList.remove('is-success');status.textContent=error.message;}return;}
    const refund=event.target.closest('[data-refund]');if(refund){refund.disabled=true;await sessionReady;const result=await Api.refundFeatureCredit(Number(refund.dataset.refund));if(result.success){window.dispatchEvent(new CustomEvent('regen:wallet-changed'));load();}else{status.textContent=result.message;refund.disabled=false;}}
  });
  const update=event=>{if(event.detail?.topic&&!['wallet','store','ai','pricing'].includes(event.detail.topic))return;clearTimeout(timer);timer=setTimeout(load,180);};
  window.addEventListener('regen:live-change',update);window.addEventListener('regen:reconcile',update);window.addEventListener('regen:wallet-changed',update);window.addEventListener('regen:promotion-ended',()=>load());
  window.addEventListener('pagehide',()=>{clearTimeout(timer);clearTimeout(boundaryTimer);});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});
  load();
});
