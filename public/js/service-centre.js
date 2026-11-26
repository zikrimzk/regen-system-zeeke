document.addEventListener('DOMContentLoaded', async () => {
  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const date=value=>{const parsed=new Date(/^\d{4}-\d{2}-\d{2} /.test(value)?value.replace(' ','T')+'Z':value);return Number.isNaN(parsed.getTime())?'Unknown date':parsed.toLocaleString('en-MY',{dateStyle:'medium',timeStyle:'short'});};
  const page=document.body.dataset.servicePage;
  const t=key=>ReGenText.get('notifications.'+key);
  const feedback=document.getElementById('service-feedback');
  const content=document.getElementById('service-content');
  const readAll=document.getElementById('read-all-notifications');
  const clearAll=document.getElementById('clear-all-notifications');
  let inboxUpdating=false;
  let csrf='';let requestNumber=0;let currentPage=1;
  const message=(text,error=false)=>{if(feedback){feedback.className='service-message'+(error?' is-error':'');feedback.textContent=text;feedback.scrollIntoView({block:'nearest',behavior:'smooth'});}else{const toast=document.createElement('div');toast.className='service-feature-message';toast.setAttribute('role','status');toast.textContent=text;document.body.append(toast);setTimeout(()=>toast.remove(),6000);}};
  let openTicketId=null,openTicketPage=1;const replyDrafts=new Map(),replyFiles=new Map();
  let attachmentLimits={maxFiles:4,maxFileBytes:5242880,maxTotalBytes:20971520},supportConfigReady=Promise.resolve();
  const empty=(title,text)=>`<section class="service-panel service-empty"><h2>${safe(title)}</h2><p>${safe(text)}</p></section>`;
  async function request(url,method='GET',body) {
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),20000);
    try {
      const response=await fetch(url,{method,credentials:'same-origin',signal:controller.signal,headers:{...(body&&!(body instanceof FormData)?{'Content-Type':'application/json'}:{}),...(method!=='GET'?{'X-CSRF-Token':csrf}:{})},...(body?{body:body instanceof FormData?body:JSON.stringify(body)}:{})});
      const data=await response.json();if(data.code==='MAINTENANCE_MODE'&&document.body.classList.contains('user-workspace'))location.replace('/maintenance?returnTo='+encodeURIComponent(location.pathname+location.search));if(data.csrfToken)csrf=data.csrfToken;
      if (response.status === 401 && page && page !== 'reset') window.dispatchEvent(new Event('regen:session-expired'));
      return {...data,httpStatus:response.status,success:response.ok && data.success!==false};
    }catch{return {success:false,message:'We could not reach the server. Please try again.'};}finally{clearTimeout(timer);}
  }
  const featureSelectors={
    registration:'a[href="/register"],#register-form [type="submit"]',google_login:'#google-auth',
    cover_letters:'a[href="/cover-letters"]',templates:'a[href="/templates"],#change-resume-template',
    ai_assist:'.assist-launcher,.assist-open',ai_refine:'.ai-refine-row,.ai-regenerate',ai_review:'.ats-review-request',
    ai_cover_letter:'#generate-letter',pdf_download:'#download-letter,#btn-download-pdf,#download-resume',document_preview:'#preview-letter,#preview-open-top,#open-resume-preview,#studio-preview-refresh,#studio-preview-mode',
    photo_upload:'#photo-choose-btn,#photo-upload',support:'a[href="/support"]',profile_edit:'#profile-save',profile_email:'.email-change',self_delete:'#danger',
    profile_password:'.password-details',session_controls:'.session-revoke,#clear-session-history',document_settings:'#resume-layout-settings,#letter-design-settings',resume_rename:'#resume-rename',
    feedback:'.feedback-launcher',
  };
  let features={};let featureSyncQueued=false;
  const syncFeatures=()=>{
    featureSyncQueued=false;
    for(const [key,selector] of Object.entries(featureSelectors)) {
      const feature=features[key];if(!feature)continue;
      document.querySelectorAll(selector).forEach(element=>{
        if(!feature.visible)element.dataset.serviceHidden='true';
        else delete element.dataset.serviceHidden;
        if(!feature.available) {element.dataset.serviceUnavailable=key;element.setAttribute('aria-disabled','true');element.title=feature.message||feature.name+' is temporarily unavailable.';}
        else if(element.dataset.serviceUnavailable){delete element.dataset.serviceUnavailable;element.removeAttribute('aria-disabled');element.removeAttribute('title');}
      });
    }
  };
  document.addEventListener('click',event=>{
    const element=event.target.closest('[data-service-unavailable]');if(!element)return;
    event.preventDefault();event.stopImmediatePropagation();const f=features[element.dataset.serviceUnavailable];message(f?.message||f?.name+' is temporarily unavailable.');
  },true);
  const refreshFeatures=async()=>{
    const response=await request('/api/capabilities');
    if (!response.success) return;
    const previousPreview=features.document_preview?.available;
    features=response.features;
    syncFeatures();
    if (previousPreview!==features.document_preview?.available) {
      window.dispatchEvent(new CustomEvent('regen:preview-availability',{detail:{available:features.document_preview?.available===true}}));
    }
  };
  const workspacePage=!!page||(document.body.classList.contains('user-workspace')&&!document.body.classList.contains('auth-page'));
  const accountRequest=page!=='reset'&&workspacePage?Api.getMe():null;
  await refreshFeatures();
  if(!document.body?.isConnected)return;
  const featureTargets=Object.values(featureSelectors).join(',');
  const featureObserver=new MutationObserver(records=>{
    if (featureSyncQueued || !records.some(record=>Array.from(record.addedNodes).some(node=>
      node instanceof Element && (node.matches(featureTargets) || node.querySelector(featureTargets))))) return;
    featureSyncQueued=true;
    queueMicrotask(syncFeatures);
  });
  let featureTimer=null;
  const startFeatureUpdates=()=>{featureObserver.observe(document.body,{childList:true,subtree:true});if(featureTimer===null)featureTimer=window.setInterval(()=>{if(!document.hidden&&!window.ReGenLive?.connected)refreshFeatures();},60000);};
  startFeatureUpdates();
  window.addEventListener('pagehide',()=>{clearInterval(featureTimer);featureTimer=null;featureObserver.disconnect();});
  window.addEventListener('pageshow',event=>{if(event.persisted){startFeatureUpdates();refreshFeatures();}});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshFeatures();});

  if(page==='reset') {
    const token=new URLSearchParams(location.hash.slice(1)).get('token')||'';history.replaceState(null,'',location.pathname);
    const form=document.getElementById('reset-password-form');
    if(!/^[A-Za-z0-9_-]{43}$/.test(token)){form.hidden=true;message('This password reset link is invalid. Ask support for a new link.',true);return;}
    form.onsubmit=async event=>{event.preventDefault();if(!form.reportValidity())return;const button=form.querySelector('[type="submit"]');if(button.disabled)return;button.disabled=true;const result=await request('/api/auth/password-reset','POST',{token,password:form.elements.password.value,confirmPassword:form.elements.confirmPassword.value});button.disabled=false;message(result.message,!result.success);if(result.success){form.reset();form.hidden=true;}};
    return;
  }
  const isWorkspace=workspacePage;
  if(!isWorkspace)return;
  const me=await accountRequest;if(me.csrfToken)csrf=me.csrfToken;if(!me.success){if(page)message(me.message||'Sign in to continue.',true);return;}
  window.ReGenFeedback?.start(request);
  window.addEventListener('regen:campaign-error',event=>message(event.detail?.message||'This announcement could not load.',true));
  window.addEventListener('regen:campaigns-updated',()=>{notificationChanged();if(page==='notifications')notifications();});
  window.ReGenCampaigns?.start(request);
  window.ZeekeAccountMenu?.init({userName:me.userName||'Your account',initials:window.ZeekeAccountMenu.initialsFromUser(me.user)});
  syncFeatures();
  const notificationBell=document.querySelector('.workspace-notification-bell');
  let lastNotificationId=null;
  let alertRequest=null;
  let notificationChannel=null;
  let alertTimer=null;
  let alertsNeedRefresh=false;
  function updateNotificationBell(data) {
    if(!notificationBell)return;
    const count=Math.max(0,Number(data.counts?.unread)||0);
    const badge=notificationBell.querySelector('[data-notification-count]');
    if(badge){badge.hidden=count===0;badge.textContent=count>99?'99+':String(count);}
    const label=count?`Notifications, ${count} unread`:'Notifications';
    notificationBell.setAttribute('aria-label',label);notificationBell.title=label;
  }
  async function checkAlerts() {
    if(alertRequest)return alertRequest;
    alertRequest=(async()=>{
      const data=await request('/api/notifications/count');
      if(!data.success){if(data.httpStatus===401)updateNotificationBell({counts:{unread:0},preferences:{}});return;}
      updateNotificationBell(data);
      const newest=Number(data.latest?.id||0);
      if(lastNotificationId!==null&&newest>lastNotificationId){
        if(page==='notifications')notifications();
        if(data.preferences.in_app_enabled&&window.ReGenLive?.isLeader!==false)window.dispatchEvent(new CustomEvent('regen:user-notification',{detail:data.latest}));
        if(window.ReGenLive?.isLeader!==false&&data.preferences.browser_enabled&&'Notification'in window&&Notification.permission==='granted')new Notification('ReGen update',{body:data.latest.title,tag:'regen-user-'+newest});
      }
      lastNotificationId=newest;
    })().finally(()=>{alertRequest=null;if(alertsNeedRefresh){alertsNeedRefresh=false;checkAlerts();}});
    return alertRequest;
  }
  function notificationChanged() {
    if(alertRequest)alertsNeedRefresh=true;else checkAlerts();notificationChannel?.postMessage({type:'changed'});
  }
  function startNotificationUpdates() {
    if(alertTimer!==null)return;
    if('BroadcastChannel'in window){
      try{notificationChannel=new BroadcastChannel('regen-notifications');notificationChannel.onmessage=event=>{if(event.data?.type==='changed'&&!document.hidden){if(alertRequest)alertsNeedRefresh=true;else checkAlerts();}};}catch{}
    }
    alertTimer=setInterval(()=>{if(!document.hidden&&!window.ReGenLive?.connected)checkAlerts();},30000);checkAlerts();
  }
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkAlerts();});
  window.addEventListener('focus',()=>{if(!document.hidden)checkAlerts();});
  window.addEventListener('pagehide',()=>{clearInterval(alertTimer);alertTimer=null;notificationChannel?.close();notificationChannel=null;});
  window.addEventListener('pageshow',event=>{if(event.persisted)startNotificationUpdates();});
  startNotificationUpdates();
  if(['support','notifications'].includes(page)){
    const labels={live:'Live updates',polling:'Automatic updates',paused:'Updates paused while this tab is hidden',offline:'You are offline',delayed:'Updates delayed · retrying automatically'};
    const indicator=document.createElement('p');indicator.className='service-live-state';indicator.textContent=labels[window.ReGenLive?.state]||'Connecting updates';indicator.dataset.state=window.ReGenLive?.state||'connecting';indicator.setAttribute('role','status');document.querySelector('.service-page-head>div')?.append(indicator);
    window.addEventListener('regen:live-status',event=>{indicator.dataset.state=event.detail.state;indicator.textContent=labels[event.detail.state]||'Connecting updates';});
  }

  let liveTimer;const liveTopics=new Set();let reconcileLive=false;
  const liveUpdate=event=>{
    if(event.detail?.topic)liveTopics.add(event.detail.topic);else reconcileLive=true;
    clearTimeout(liveTimer);liveTimer=setTimeout(()=>{
      const topics=reconcileLive?[]:[...liveTopics];liveTopics.clear();reconcileLive=false;const changed=names=>!topics.length||topics.some(topic=>names.includes(topic));
      if(changed(['notifications','support'])) {checkAlerts();if(page==='notifications')notifications();}
      if(changed(['features']))refreshFeatures();
      if(changed(['profile','ai','feedback','wallet']))window.ReGenAI?.force?.();
      if(page==='support'&&changed(['support'])){
        if(content.querySelector('#support-create'))return;
        if(content.querySelector('#support-reply [type="submit"]:disabled'))return;
        if(openTicketId)ticket(openTicketId,openTicketPage,true);else tickets();
      }
    },120);
  };
  window.addEventListener('regen:live-change',liveUpdate);window.addEventListener('regen:reconcile',liveUpdate);
  window.addEventListener('pagehide',()=>clearTimeout(liveTimer));
  if(!page)return;

  async function paginate(total,load) {
    const pages=Math.max(1,Math.ceil(Number(total)/25));
    content.insertAdjacentHTML('beforeend',`<nav class="service-pagination" aria-label="Result pages"><button class="btn btn-secondary" id="service-prev" ${currentPage<=1?'disabled':''}>Previous</button><span>Page ${currentPage} of ${pages}</span><button class="btn btn-secondary" id="service-next" ${currentPage>=pages?'disabled':''}>Next</button></nav>`);
    content.querySelector('#service-prev').onclick=()=>{currentPage--;load();};content.querySelector('#service-next').onclick=()=>{currentPage++;load();};
  }
  function errorPanel(text,retry){content.innerHTML=empty('Could not load this page',text)+`<div class="service-actions"><button class="btn btn-primary" id="service-retry">Try again</button></div>`;content.querySelector('#service-retry').onclick=retry;}
  async function tickets() {
    openTicketId=null;
    const serial=++requestNumber;const response=await request('/api/support/tickets?page='+currentPage);if(serial!==requestNumber)return;
    if(!response.success){errorPanel(response.message,tickets);return;}
    content.innerHTML=response.items.length?`<div class="service-list">${response.items.map(t=>`<button class="service-ticket" data-ticket="${t.id}"><span><strong>#${t.id} ${safe(t.subject)}</strong><small>${safe(t.category.replaceAll('_',' '))} · Updated ${safe(date(t.updated_at))}</small></span><span class="service-pill">${safe(t.status.replaceAll('_',' '))}</span></button>`).join('')}</div>`:empty('No requests yet','Your support requests and replies will appear here. Use New support request if you need a hand.');
    content.querySelectorAll('[data-ticket]').forEach(button=>button.onclick=()=>ticket(Number(button.dataset.ticket)));
    if(Number(response.total)>25)paginate(response.total,tickets);
    history.replaceState(null,'','/support');
  }
  async function newTicket(topic) {
    const serial=++requestNumber;
    await supportConfigReady;
    if(serial!==requestNumber)return;
    content.innerHTML=`<section class="service-panel"><h2>How can we help?</h2><p>Include the steps you took and what happened. Browser, device and screen details are included to help us investigate. Please leave out passwords, identity documents and payment details.</p><form class="service-form" id="support-create" style="margin-top:24px"><label>Subject<input name="subject" minlength="5" maxlength="180" required placeholder="A short summary of the problem"></label><label>Topic<select name="category"><option value="technical">Technical problem</option><option value="account">Account access</option><option value="ai">AI assistance</option><option value="resume">Resume</option><option value="cover_letter">Cover letter</option><option value="billing">Billing</option><option value="other">Something else</option></select></label><label>Details<textarea name="body" rows="7" minlength="10" maxlength="10000" required placeholder="Describe the issue and any error message you saw"></textarea></label><div class="service-actions"><button class="btn btn-primary" type="submit">Submit request</button><button class="btn btn-secondary" type="button" id="cancel-ticket">Cancel</button></div></form></section>`;
    content.querySelector('#cancel-ticket').onclick=tickets;
    if (['technical','account','ai','resume','cover_letter','billing','other'].includes(topic)) {
      content.querySelector('[name="category"]').value=topic;
    }
    ReGenAttachments.picker(content.querySelector('#support-create'),attachmentLimits);
    content.querySelector('#support-create').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget;if(!form.reportValidity())return;const button=form.querySelector('[type="submit"]');if(button.disabled)return;button.disabled=true;const clientContext={page:location.pathname,displayMode:matchMedia('(display-mode: standalone)').matches||navigator.standalone?'standalone':'browser',width:innerWidth,height:innerHeight,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone};const result=await request('/api/support/tickets','POST',ReGenAttachments.payload(form,{clientContext}));button.disabled=false;if(!result.success){message(result.message,true);return;}message('Request #'+result.id+' received. You can follow its progress here. A confirmation email has been queued if support emails are enabled.');ticket(result.id);};
    content.querySelector('[name="subject"]').focus();
  }
  async function ticket(id, messagePage=1,live=false) {
    const same=openTicketId===id;const existing=content.querySelector('#support-reply');const focused=existing?.contains(document.activeElement);const scroll=window.scrollY;
    const serial=++requestNumber;const response=await request('/api/support/tickets/'+id+'?messagePage='+messagePage);if(serial!==requestNumber)return;
    if(!response.success){errorPanel(response.message,()=>ticket(id));return;}
    if(same&&existing?.elements.body){replyDrafts.set(id,existing.elements.body.value);replyFiles.set(id,ReGenAttachments.files(existing));}openTicketId=id;openTicketPage=messagePage;
    const t=response.ticket;
    content.innerHTML=`<div class="service-actions" style="margin:0 0 20px"><button class="btn btn-secondary" id="back-to-tickets">← All requests</button></div><section class="service-panel"><p class="service-eyebrow">Request #${t.id}</p><h2 style="margin-top:12px">${safe(t.subject)}</h2><div class="service-ticket-meta"><span class="service-pill">${safe(t.status.replaceAll('_',' '))}</span><span>Opened ${safe(date(t.created_at))}</span></div><div class="service-thread">${response.messages.map(m=>`<article class="service-reply${m.author_type==='admin'?' is-staff':''}"><header><strong>${m.author_type==='admin'?'ReGen support':'You'}</strong><time>${safe(date(m.created_at))}</time></header><p>${safe(m.body)}</p>${ReGenAttachments.render(m.attachments)}</article>`).join('')}</div></section>${t.status==='closed'?'<section class="service-panel service-closed"><h2>This request is closed</h2><p>The conversation is read-only. Contact support with a new request if you need more help. Our team can reopen this request when needed.</p></section>':`<section class="service-panel"><h2>Add a reply</h2><p>Replying reopens a resolved request so our support team can follow up.</p><form class="service-form" id="support-reply" style="margin-top:20px"><label>Your message<textarea name="body" rows="5" maxlength="10000" required></textarea></label><div class="service-actions"><button class="btn btn-primary" type="submit">Send reply</button></div></form></section>`}`;
    const reply=content.querySelector('#support-reply');if(reply&&replyDrafts.has(id)){reply.elements.body.value=replyDrafts.get(id);if(live&&focused){reply.elements.body.focus({preventScroll:true});window.scrollTo({top:scroll,behavior:'instant'});}}
    if(reply){await supportConfigReady;attachmentLimits=response.attachmentLimits||attachmentLimits;ReGenAttachments.picker(reply,attachmentLimits,replyFiles.get(id)||[],true);}
    content.querySelector('#back-to-tickets').onclick=tickets;
    if(content.querySelector('#support-reply'))content.querySelector('#support-reply').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget;if(!form.reportValidity())return;const button=form.querySelector('[type="submit"]');if(button.disabled)return;button.disabled=true;const result=await request('/api/support/tickets/'+id,ReGenAttachments.files(form).length?'POST':'PATCH',ReGenAttachments.files(form).length?ReGenAttachments.payload(form,{version:Number(t.version)}):{body:form.elements.body.value,version:Number(t.version)});button.disabled=false;if(!result.success){message(result.message,true);return;}message('Your reply was sent.');replyDrafts.delete(id);replyFiles.delete(id);ReGenAttachments.clear(form);form.reset();ticket(id);};
    const paging=response.messagePagination;
    if(paging?.pages>1){const nav=document.createElement('nav');nav.className='service-pagination';nav.setAttribute('aria-label','Conversation pages');nav.innerHTML=`<button class="btn btn-secondary" data-older ${paging.page>=paging.pages?'disabled':''}>Older messages</button><span>Page ${paging.page} of ${paging.pages}</span><button class="btn btn-secondary" data-newer ${paging.page<=1?'disabled':''}>Newer messages</button>`;content.querySelector('.service-thread').after(nav);nav.querySelector('[data-older]').onclick=()=>ticket(id,paging.page+1);nav.querySelector('[data-newer]').onclick=()=>ticket(id,paging.page-1);}
    history.replaceState(null,'','/support?ticket='+id);
  }
  function notificationAction(item) {
    if(item.category==='announcement'&&item.link==='/notifications')return '';
    const link=item.link==='/notifications'?(item.category==='support'?'/support':'/profile'):item.link;
    const label=link.includes('campaign=')?'Announcement details':item.category==='support'?'Open request':'Review account';
    return `<a href="${safe(link)}" data-notification-open="${item.id}">${label} <span aria-hidden="true">↗</span></a>`;
  }
  async function notifications() {
    const serial=++requestNumber;const response=await request('/api/notifications?page='+currentPage);if(serial!==requestNumber)return;
    if(!response.success){errorPanel(response.message,notifications);return;}updateNotificationBell(response);
    readAll.disabled=inboxUpdating||!Number(response.counts.unread);
    clearAll.disabled=inboxUpdating||!Number(response.counts.total);
    if(currentPage>1&&!response.items.length){
      currentPage=Math.max(1,Math.ceil(Number(response.counts.total)/25));
      return notifications();
    }
    const icons={security:'lock',support:'letter',account:'personal',announcement:'award'};
    const items=response.items.map(item=>`
      <article class="service-notification${item.read_at?'':' is-unread'}">
        <div class="notification-symbol" aria-hidden="true">${ReGenIcons.icon(icons[item.category]||'letter')}</div>
        <div class="notification-copy">
          <header><span>${safe(item.category)}</span><time>${safe(date(item.created_at))}</time></header>
          <h2>${safe(item.title)}</h2><p>${safe(item.body)}</p>${notificationAction(item)}
        </div>
        <div class="notification-actions">
          ${item.read_at?'':`<button class="notification-read" data-read="${item.id}" type="button" aria-label="Mark ${safe(item.title)} as read" title="Mark as read">${ReGenIcons.icon('check')}</button>`}
          <button class="notification-read notification-remove" data-remove="${item.id}" type="button" aria-label="Remove ${safe(item.title)}" title="Remove notification">${ReGenIcons.icon('trash')}</button>
        </div>
      </article>`);
    content.innerHTML=`<div class="service-list">${items.join('')||empty(t('emptyTitle'),t('empty'))}</div>`;
    const read=async id=>{const result=await request('/api/notifications/read','POST',{id});if(!result.success){message(result.message,true);return;}notificationChanged();notifications();};
    content.querySelectorAll('[data-read]').forEach(button=>button.onclick=()=>read(Number(button.dataset.read)));
    content.querySelectorAll('[data-notification-open]').forEach(link=>link.onclick=()=>{request('/api/notifications/read','POST',{id:Number(link.dataset.notificationOpen)}).then(result=>{if(result.success)notificationChanged();});});
    content.querySelectorAll('[data-remove]').forEach(button=>button.onclick=async()=>{
      button.disabled=true;
      const result=await request('/api/notifications/'+Number(button.dataset.remove),'DELETE');
      if(!result.success){button.disabled=false;message(result.message,true);return;}
      notificationChanged();
      message('Notification removed.');
      await notifications();
      (content.querySelector('[data-remove]')||document.getElementById('read-all-notifications'))?.focus({preventScroll:true});
    });
    if(Number(response.counts.total)>25)paginate(response.counts.total,notifications);
  }
  if (page==='support') {
    document.getElementById('new-support-ticket').onclick=()=>newTicket();
    const params=new URLSearchParams(location.search), id=Number(params.get('ticket'));
    supportConfigReady=request('/api/support/configuration').then(result=>{
      if (!result.success) return;
      attachmentLimits=result.attachments||attachmentLimits;
      const description=document.querySelector('.service-page-head p:not(.service-eyebrow)');
      if(description) description.textContent=result.message;
    });
    if (id>0) ticket(id);
    else if (params.get('new')==='1') newTicket(params.get('topic'));
    else tickets();
  }
  if(page==='notifications'){
    async function updateInbox(url, method, body) {
      inboxUpdating=true;
      readAll.disabled=clearAll.disabled=true;
      const result=await request(url,method,body);
      inboxUpdating=false;
      if(result.success){
        if(method==='DELETE'){
          currentPage=1;
          message(t('cleared'));
        }
        notificationChanged();
      } else {
        message(result.message||t('clearFailed'),true);
      }
      await notifications();
      if(result.success && method==='DELETE' && clearAll.disabled) {
        document.getElementById('main-content').focus({preventScroll:true});
      }
    }
    readAll.onclick=()=>updateInbox('/api/notifications/read','POST',{});
    clearAll.onclick=async()=>{
      if(!await ReGenDialog.confirm({title:t('clearTitle'),message:t('clearDescription'),confirmLabel:t('clear'),danger:true}))return;
      if(!inboxUpdating) await updateInbox('/api/notifications','DELETE');
    };
    notifications();
  }


});
