/* Campaign notices are in-app records. Claim retries reuse the same reference. */
window.ReGenCampaigns = (() => {
  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let request,host,dialog,timer=null,pending=null,signature=null,started=false,pageActive=true,updateDelay=30000;
  const claimsInProgress=new Set();
  const references=new Map();
  const date=value=>new Date(value.replace(' ','T')+'Z').toLocaleString('en-MY',{dateStyle:'medium',timeStyle:'short'});
  function reward(campaign) {
    if(!campaign.rewardEnabled)return '';
    if(campaign.active&&campaign.claimsReceived>0&&campaign.claimsRemaining===0)return '<span class="campaign-state">Reward received · '+campaign.claimsReceived+' '+(campaign.claimsReceived===1?'claim':'claims')+'</span>'; 
    return `<p class="campaign-reward">${campaign.rewardAmount} bonus tokens per claim · ${campaign.claimsRemaining} ${campaign.claimsRemaining===1?'claim':'claims'} available to you${campaign.endsAt?' · Ends '+safe(date(campaign.endsAt)):''}</p>${campaign.canClaim?'<button class="btn btn-primary" type="button" data-campaign-claim>Claim '+campaign.rewardAmount+' tokens</button>':'<span class="campaign-state">'+(campaign.active?(campaign.claimsReceived>0&&campaign.claimsRemaining===0?'Your available rewards have been claimed.':'No reward is currently available for this account.'):'This reward is no longer available.')+'</span>'}`;
  }
  function bindClaim(container,campaign,updated) {
    container.querySelector('[data-campaign-claim]')?.addEventListener('click',async event=>{
      const button=event.currentTarget;if(button.disabled)return;claimsInProgress.add(campaign.id);button.disabled=true;button.textContent='Claiming…';
      if(!references.has(campaign.id))references.set(campaign.id,crypto.randomUUID());
      const result=await request('/api/campaigns/'+campaign.id+'/claim','POST',{requestKey:references.get(campaign.id)});
      const status=container.querySelector('[data-campaign-status]');
      if(!result.success){claimsInProgress.delete(campaign.id);status.textContent=result.message;button.disabled=false;button.textContent='Try claim again';return;}
      claimsInProgress.delete(campaign.id);references.delete(campaign.id);signature=null;updated(result.campaign);
      container.querySelector('[data-campaign-status]').textContent=`${result.rewardGranted} bonus tokens received. Your bonus balance is ${result.bonus.balance}.`;
      window.dispatchEvent(new CustomEvent('regen:bonus-updated'));window.ReGenAI?.force?.();
    });
  }
  function card(campaign) {
    const element=document.createElement('article');element.dataset.campaignId=campaign.id;element.className='campaign-banner campaign-'+campaign.color;
    const render=value=>{
      campaign=value;element.innerHTML=`<div class="campaign-copy"><span class="campaign-kicker">From ReGen</span><h2>${safe(campaign.title)}</h2><p>${safe(campaign.body)}</p><div class="campaign-actions">${reward(campaign)}<button class="campaign-details" type="button" data-campaign-details>View details ↗</button></div><p class="campaign-status" data-campaign-status role="status"></p></div><button class="campaign-dismiss" type="button" aria-label="Dismiss ${safe(campaign.title)}" title="Dismiss announcement"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button>`;
      bindClaim(element,campaign,render);element.querySelector('[data-campaign-details]').onclick=()=>open(campaign.id);
      element.querySelector('.campaign-dismiss').onclick=async event=>{const button=event.currentTarget;button.disabled=true;const result=await request('/api/campaigns/'+campaign.id+'/dismiss','POST',{});if(result.success){element.remove();signature=null;window.dispatchEvent(new Event('regen:campaigns-updated'));}else{element.querySelector('[data-campaign-status]').textContent=result.message;button.disabled=false;}};
    };render(campaign);return element;
  }
  async function open(id) {
    const result=await request('/api/campaigns/'+id);if(!result.success){window.dispatchEvent(new CustomEvent('regen:campaign-error',{detail:{message:result.message}}));return;}
    dialog?.close();dialog=document.createElement('dialog');dialog.className='campaign-dialog';dialog.setAttribute('aria-label','Announcement details');document.body.append(dialog);
    const render=campaign=>{
      dialog.innerHTML=`<div class="campaign-detail campaign-${campaign.color}"><header><span class="campaign-kicker">ReGen announcement</span><button class="campaign-dismiss" type="button" aria-label="Close announcement"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header><h2>${safe(campaign.title)}</h2><p class="campaign-body">${safe(campaign.body)}</p><div class="campaign-actions">${reward(campaign)}</div><p class="campaign-status" data-campaign-status role="status"></p>${campaign.rewardEnabled?'<p class="campaign-footnote">Bonus tokens remain until used. Each claim is recorded in your account history.</p>':''}</div>`;
      dialog.querySelector('.campaign-dismiss').onclick=()=>dialog.close();bindClaim(dialog,campaign,render);
    };render(result.campaign);dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();
  }
  const utc=value=>new Date(/^\d{4}-\d{2}-\d{2} /.test(value)?value.replace(' ','T')+'Z':value).getTime();
  function schedule(){clearTimeout(timer);timer=null;if(pageActive&&!document.hidden)timer=setTimeout(refresh,updateDelay);}
  async function refresh() {
    if(pending)return pending;
    if(document.hidden){schedule();return;}
    pending=(async()=>{
      const result=await request('/api/campaigns');
      if(!result.success||!Array.isArray(result.items)){updateDelay=60000;return;}
      updateDelay=30000;
      if(result.nextChangeAt&&result.serverNow){const until=utc(result.nextChangeAt)-utc(result.serverNow);if(until>0)updateDelay=Math.max(1000,Math.min(30000,until+250));}
      const next=JSON.stringify([result.items,result.hasMore]);
      if(signature===next||claimsInProgress.size)return;
      const changed=signature!==null;signature=next;
      if(host?.isConnected){
        const focused=document.activeElement;const cardId=focused?.closest('[data-campaign-id]')?.dataset.campaignId;const action=focused?.hasAttribute('data-campaign-claim')?'data-campaign-claim':focused?.hasAttribute('data-campaign-details')?'data-campaign-details':null;
        host.replaceChildren(...result.items.map(card));
        if(result.hasMore){const link=document.createElement('a');link.href='/notifications';link.className='campaign-details';link.textContent='All announcements in Notifications →';host.append(link);}
        if(cardId&&action)host.querySelector('[data-campaign-id="'+cardId+'"] ['+action+']')?.focus({preventScroll:true});
      }
      if(changed)window.dispatchEvent(new Event('regen:campaigns-updated'));
    })().finally(()=>{pending=null;schedule();});
    return pending;
  }
  function startUpdates(){if(!document.hidden)refresh();}
  return {start:transport=>{
    request=transport;if(started)return;started=true;
    if(location.pathname==='/dashboard'){
      host=document.querySelector('[data-campaign-feed]');
      if(!host){host=document.createElement('section');host.className='campaign-feed';host.setAttribute('aria-label','Announcements');document.querySelector('.dash-page-header')?.after(host);}
    }
    window.addEventListener('regen:live-change',event=>{if(['campaigns','features'].includes(event.detail.topic))refresh();});
    window.addEventListener('regen:reconcile',refresh);
    startUpdates();
    document.addEventListener('visibilitychange',()=>{if(document.hidden){clearTimeout(timer);timer=null;}else startUpdates();});
    window.addEventListener('focus',startUpdates);
    window.addEventListener('pagehide',()=>{pageActive=false;clearTimeout(timer);timer=null;});
    window.addEventListener('pageshow',event=>{pageActive=true;if(event.persisted)startUpdates();});
    const id=Number(new URLSearchParams(location.search).get('campaign'));if(location.pathname==='/notifications'&&id>0)open(id);
    document.addEventListener('click',event=>{const link=event.target.closest('a[href^="/notifications?campaign="]');if(!link||event.ctrlKey||event.metaKey)return;event.preventDefault();const id=Number(new URL(link.href).searchParams.get('campaign'));open(id);});
  }};
})();
