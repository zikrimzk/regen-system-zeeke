window.ReGenAdminModules = context => {
  const {root, api, safe, status, formatDate, toast, stamp, fail, openConfirmation} = context;
  let generation = 0;
  let ticketPage = 1;
  let ticketStatus = 'awaiting_staff';
  let ticketSearch = '';
  let currentTicket = null;
  let currentMessagePage=1;
  const ticketDrafts=new Map();
  const threadHtml=messages=>messages.map(m=>`<article class="ticket-message ${Number(m.internal_note)?'is-internal':m.author_type==='admin'?'is-staff':''}"><header><strong>${Number(m.internal_note)?'Internal note':m.author_type==='admin'?'Support team':'User'}</strong><time>${safe(formatDate(m.created_at))}</time></header><p>${safe(m.body)}</p>${window.ReGenAttachments?.render(m.attachments)||''}</article>`).join('');
  const number = value => Number(value || 0).toLocaleString();
  const bytes = value => value == null ? 'Unavailable' : new Intl.NumberFormat('en', {maximumFractionDigits:1}).format(Number(value)/1024/1024) + ' MB';
  const field = (label, input, wide = false) => `<label class="admin-field${wide?' is-wide':''}">${label}${input}</label>`;
  const note = text => `<div class="admin-note">${text}</div>`;
  const empty = (title, text) => `<div class="control-empty"><span aria-hidden="true">◇</span><h3>${title}</h3><p>${text}</p></div>`;
  const panel = (title, description, body, actions = '') => `<section class="admin-panel"><div class="panel-title"><div><h2>${title}</h2><p>${description}</p></div>${actions}</div>${body}</section>`;
  const metric = (label, value, caption) => `<article class="metric-card"><p>${label}</p><strong>${safe(value)}</strong><span>${caption}</span></article>`;
  const table = (headers, rows, message = 'No records yet.') => `<div class="admin-table-wrap"><table class="admin-table"><thead><tr>${headers.map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows || `<tr><td colspan="${headers.length}">${message}</td></tr>`}</tbody></table></div>`;
  const checked = bool => bool ? ' checked' : '';
  const options = (items, selected) => items.map(item => `<option value="${safe(item)}"${item===selected?' selected':''}>${safe(item.replaceAll('_',' '))}</option>`).join('');
  async function load(view, url) {
    const token=++generation;
    const response=await api(url);
    if (token!==generation || context.active()!==view) return null;
    if (!response.success) { fail(response.message); return null; }
    stamp(); return response;
  }
  async function submit(form, url, method, body, success, after) {
    const button=form.querySelector('[type="submit"]');
    if (button?.disabled) return;
    const original=button?.textContent;
    if(button){button.disabled=true;button.textContent='Saving…';}
    const response=await api(url,{method,body:JSON.stringify(body)});
    if(button){button.disabled=false;button.textContent=original;}
    if(!response.success){toast('Could not save',response.message||'Try again.','error',7000);return false;}
    toast(success,response.message||'Changes saved.');
    if(after)await after(response); return true;
  }
  function dialog(title, body, onSubmit, submitLabel = 'Save changes') {
    const element=document.createElement('dialog'); element.className='control-dialog';
    element.innerHTML=`<form method="post"><header><div><p class="admin-eyebrow">Administration</p><h2>${safe(title)}</h2></div><button class="dialog-close" type="button" aria-label="Close dialog">×</button></header><div class="control-dialog-body">${body}</div><footer><button type="button" class="btn btn-secondary" data-cancel>Cancel</button><button class="btn btn-primary" type="submit">${safe(submitLabel)}</button></footer></form>`;
    element.setAttribute('aria-label',title); document.body.append(element);
    const form=element.querySelector('form');
    const close=()=>element.close();
    element.querySelector('.dialog-close').onclick=close; element.querySelector('[data-cancel]').onclick=close;
    element.addEventListener('close',()=>element.remove(),{once:true});
    form.addEventListener('submit',async event=>{event.preventDefault();if(!form.reportValidity())return;await onSubmit(form,close);});
    element.showModal(); return element;
  }

  async function analytics() {
    const data=await load('analytics','/api/admin/analytics'); if(!data)return;
    const dayMap=new Map(data.days.map(day=>[day.day,day]));
    const registrationMap=new Map(data.registrations.map(day=>[day.day,Number(day.count)]));
    const days=Array.from({length:30},(_,index)=>{const date=new Date();date.setUTCDate(date.getUTCDate()-29+index);const key=date.toISOString().slice(0,10);return {day:key,page_views:0,visitors:0,...dayMap.get(key)};});
    const max=Math.max(1,...days.map(d=>Number(d.page_views)));
    const registrations=data.registrations.reduce((sum,d)=>sum+Number(d.count),0);
    root.innerHTML=`<div class="metric-grid">${metric('Landing page views',number(data.totals.views),'Last 30 UTC calendar days')}${metric('Daily visitor estimates',number(data.totals.dailyVisitors),'Sum of each day’s distinct network and browser estimates')}${metric('Registrations',number(registrations),'New accounts in the same period')}</div>`+
      panel('Landing traffic','Daily views and estimated visitors. Focus a point to inspect its value.',window.ReGenAdminCharts.line(days,[{key:'page_views',name:'Page views'},{key:'visitors',name:'Visitor estimates'}],'Landing traffic over 30 days'))+
      note('Counts begin when this update is installed. Known bots and HEAD requests are excluded. Visitor estimates use a daily rotating keyed hash; no tracking cookie or raw network address is stored. Repeat visits across different days count again. Offline cached landing views are not counted.')+
      panel('Daily breakdown','All dates are UTC.',table(['Date','Page views','Visitor estimates','Registrations'],[...days].reverse().map(d=>`<tr><td>${safe(d.day)}</td><td>${number(d.page_views)}</td><td>${number(d.visitors)}</td><td>${number(registrationMap.get(d.day))}</td></tr>`).join('')));
  }

  async function features() {
    const data = await load('features', '/api/admin/features');
    if (!data) return;
    const list = Object.values(data.features);
    const group = key => key.startsWith('ai_') ? 'ai' : ['registration','google_login','profile_edit','profile_email','profile_password','session_controls','self_delete','support'].includes(key) ? 'account' : 'documents';
    const state = feature => !feature.visible ? 'Hidden' : feature.policyBlocked ? 'Global policy' : !feature.enabled ? 'Paused' : !feature.available ? 'In downtime' : feature.downtimeStart && new Date(feature.downtimeStart.replace(' ','T')+'Z')>new Date() ? 'Scheduled' : 'Available';
    root.innerHTML = panel('Product availability', 'Each control applies to the interface and direct server requests. Existing global policies still apply.', `<div class="feature-filter-bar"><label class="admin-field">Find a feature<input id="feature-search" type="search" placeholder="Search by name"></label><label class="admin-field">Area<select id="feature-group"><option value="">All areas</option><option value="documents">Documents</option><option value="account">Accounts and support</option><option value="ai">AI tools</option></select></label><span class="admin-result-count">${list.filter(feature=>feature.available).length} available · ${list.length} controls</span></div>`)
      + `<div class="feature-catalogue">${list.map(feature=>`<article class="admin-panel feature-summary" data-feature="${safe(feature.key)}" data-group="${group(feature.key)}"><header><span class="feature-category">${group(feature.key)==='ai'?'AI assistance':group(feature.key)==='account'?'Account experience':'Document workspace'}</span>${status(state(feature).toLowerCase())}</header><h2>${safe(feature.name)}</h2><p>${feature.downtimeStart?'Downtime starts '+safe(formatDate(feature.downtimeStart))+(feature.downtimeEnd?' and ends '+safe(formatDate(feature.downtimeEnd)):'. No end is scheduled.'):'No downtime scheduled.'}</p><footer><span>${feature.visible?'Visible to users':'Hidden from users'}</span><button class="btn btn-secondary" data-edit-feature="${feature.key}">${context.can('features.manage')?'Configure':'View configuration'}</button></footer></article>`).join('')}</div>`;
    let featurePage=1;const featureNav=document.createElement('nav');featureNav.className='admin-pagination';root.querySelector('.feature-catalogue').after(featureNav);
    const filter = (reset=true) => {if(reset)featurePage=1;const search=root.querySelector('#feature-search').value.toLowerCase();const selected=root.querySelector('#feature-group').value;const cards=[...root.querySelectorAll('[data-feature]')];const matches=cards.filter(card=>card.textContent.toLowerCase().includes(search)&&(!selected||selected===card.dataset.group));cards.forEach(card=>card.hidden=true);matches.slice((featurePage-1)*8,featurePage*8).forEach(card=>card.hidden=false);featureNav.innerHTML=`<button class="btn btn-secondary" data-prev ${featurePage<=1?'disabled':''}>Previous</button><span>Page ${featurePage} of ${Math.max(1,Math.ceil(matches.length/8))} · ${matches.length} controls</span><button class="btn btn-secondary" data-next ${featurePage*8>=matches.length?'disabled':''}>Next</button>`;featureNav.querySelector('[data-prev]').onclick=()=>{featurePage--;filter(false);};featureNav.querySelector('[data-next]').onclick=()=>{featurePage++;filter(false);};};filter();
    root.querySelector('#feature-search').oninput=filter;root.querySelector('#feature-group').onchange=filter;
    root.querySelectorAll('[data-edit-feature]').forEach(button=>button.onclick=()=>{
      const feature=data.features[button.dataset.editFeature];
      const local=value=>value?new Date(value.replace(' ','T')+'Z').toLocaleString('sv-SE').slice(0,16).replace(' ','T'):'';
      const modal=dialog(feature.name, note('Times use '+safe(Intl.DateTimeFormat().resolvedOptions().timeZone)+'. A hidden feature cannot be accessed directly. Leave both dates empty to remove a downtime schedule.')+`<div class="admin-form-grid"><label class="control-check"><input name="enabled" type="checkbox"${checked(feature.enabled)}> Enabled for users</label><label class="control-check"><input name="visible" type="checkbox"${checked(feature.visible)}> Visible in navigation</label>${field('Downtime starts',`<input name="start" type="datetime-local" value="${local(feature.downtimeStart)}">`)}${field('Downtime ends',`<input name="end" type="datetime-local" value="${local(feature.downtimeEnd)}">`)}${field('Message for users',`<textarea name="message" maxlength="300" rows="3" placeholder="Explain when this feature will return.">${safe(feature.message)}</textarea>`,true)}</div>`,async(form,close)=>{
        const start=form.elements.start.value,end=form.elements.end.value;
        if(end&&(!start||new Date(end)<=new Date(start)))return toast('Check the downtime dates','The end must follow the start.','error');
        const body={enabled:form.elements.enabled.checked,visible:form.elements.visible.checked,downtimeStart:start?new Date(start).toISOString():null,downtimeEnd:end?new Date(end).toISOString():null,message:form.elements.message.value,version:Number(feature.version)};
        openConfirmation({title:'Apply availability changes?',message:`${feature.name} will be ${body.enabled?'enabled':'paused'} and ${body.visible?'visible':'hidden'}.${start?' Downtime begins '+new Date(start).toLocaleString()+'.':''}`,submitLabel:'Apply changes',type:!body.enabled||!body.visible?'danger':'standard',onConfirm:async()=>{const result=await api('/api/admin/features/'+feature.key,{method:'PUT',body:JSON.stringify(body)});if(!result.success)throw new Error(result.message);close();toast('Feature availability updated');features();}});
      },'Review changes');
      if(!context.can('features.manage')){modal.querySelector('[type="submit"]').hidden=true;modal.querySelectorAll('input,textarea').forEach(input=>input.disabled=true);}
    });
  }

  async function notifications() {
    const data=await load('notifications','/api/admin/notifications'); if(!data)return;
    const counts=Object.fromEntries(data.queue.map(row=>[row.status,Number(row.count)]));
    root.innerHTML=`<div class="metric-grid">${metric('Queued emails',number(counts.pending),'Processed by the scheduled notification worker')}${metric('Accepted by mail server',number(counts.accepted),'Acceptance does not confirm inbox delivery')}${metric('Delivery needs attention',number((counts.failed||0)+(counts.uncertain||0)),'Failed or interrupted deliveries')}</div>`+
      note(data.worker?'Worker last completed: '+safe(formatDate(data.worker.updated_at))+'.':'The notification worker has not completed a run yet. Configure the hosting cron job before delivery.')+
      panel('Compose a notification','Send an in-app message to the selected audience, with optional email.',`<form method="post" id="broadcast-form"><div class="admin-form-grid">${field('Title','<input name="title" maxlength="180" required>',true)}${field('Message','<textarea name="body" rows="5" maxlength="10000" required></textarea>',true)}${field('Audience',`<select name="audience">${options(['active','verified','all'],'active')}</select>`)}<label class="control-check"><input name="sendEmail" type="checkbox" checked> Also send by email</label>${field('Type SEND NOTIFICATION to confirm','<input name="confirmation" autocomplete="off" pattern="SEND NOTIFICATION" required>',true)}</div><div class="settings-save"><button class="btn btn-primary" type="submit">Review and send</button></div></form>`)+
      panel('Email rules','In-app messages remain available. All alert emails require user consent. Account verification and requested reset messages use separate delivery flows.',`<form method="post" id="notification-policy"><div class="permission-grid">${['account','support','announcement'].map(key=>`<label class="permission-option"><input name="${key}" type="checkbox"${checked(data.policy[key])}><span><strong>${key==='account'?'Account updates':key==='support'?'Support ticket updates':'Announcements'}</strong><small>Respect each user’s email preferences</small></span></label>`).join('')}</div><div class="settings-save"><button class="btn btn-secondary" type="submit">Save email rules</button></div></form>`)+
      panel('Broadcast history','Recipient counts reflect completed queue expansion.',table(['Message','Audience','Channels','State','Recipients','Created'],data.campaigns.map(c=>`<tr><td>${safe(c.title)}</td><td>${safe(c.audience)}</td><td>${Number(c.send_email)?'In-app + optional email':'In-app'}</td><td>${status(c.status)}</td><td>${number(c.recipient_count)}</td><td>${safe(formatDate(c.created_at))}</td></tr>`).join('')))+
      panel('Email exceptions','Failed messages can be retried. Interrupted SMTP attempts require investigation before resending to avoid duplicates.',table(['ID','Recipient','State','Attempts','Action'],(data.failures||[]).map(row=>`<tr><td>#${row.id}</td><td>${safe(row.email)}</td><td>${status(row.status)}</td><td>${number(row.attempts)}</td><td>${row.status==='failed'?`<button class="table-action" data-retry="${row.id}">Retry delivery</button>`:'Check mail server logs'}</td></tr>`).join('')));
    root.querySelector('#broadcast-form').onsubmit=event=>{
      event.preventDefault();const form=event.currentTarget;if(!form.reportValidity())return;
      const values=Object.fromEntries(new FormData(form));values.sendEmail=form.elements.sendEmail.checked;
      openConfirmation({title:'Send this notification?',message:`“${values.title}” will be queued for ${values.audience} users using ${values.sendEmail?'in-app notifications and email':'in-app notifications'}. Email preferences and global email rules apply.`,submitLabel:'Queue notification',type:'standard',onConfirm:async()=>{const result=await api('/api/admin/notifications/campaigns',{method:'POST',body:JSON.stringify(values)});if(!result.success)throw new Error(result.message);toast('Notification queued','The worker will process recipients in batches.');if(context.active()==='notifications')notifications();}});
    };
    root.querySelector('#notification-policy').onsubmit=event=>{event.preventDefault();const form=event.currentTarget;submit(form,'/api/admin/notifications/policy','PUT',Object.fromEntries(['account','support','announcement'].map(key=>[key,form.elements[key].checked])),'Email rules updated');};
    root.querySelectorAll('[data-retry]').forEach(button=>button.onclick=()=>openConfirmation({title:'Retry this email?',message:'The worker will make another delivery attempt.',submitLabel:'Queue retry',type:'standard',onConfirm:async()=>{const result=await api('/api/admin/notifications/retry',{method:'POST',body:JSON.stringify({id:Number(button.dataset.retry)})});if(!result.success)throw new Error(result.message);notifications();}}));
  }

  async function support() {
    const data=await load('support',`/api/admin/tickets?page=${ticketPage}&status=${encodeURIComponent(ticketStatus)}&search=${encodeURIComponent(ticketSearch)}`);if(!data)return;
    currentTicket=null;
    root.innerHTML=panel('Support queue','Review requests, coordinate ownership and reply to users.',`<form method="post" class="admin-toolbar" id="ticket-filters"><input class="admin-search" name="search" aria-label="Search tickets" placeholder="Subject, email or ticket number" value="${safe(ticketSearch)}"><select name="status" aria-label="Ticket status"><option value="">All statuses</option><option value="awaiting_staff"${ticketStatus==='awaiting_staff'?' selected':''}>Awaiting staff</option>${options(['open','in_progress','waiting_user','resolved','closed'],ticketStatus)}</select><button class="btn btn-secondary" type="submit">Filter tickets</button><span class="admin-result-count">${number(data.total)} tickets</span></form>`+table(['Ticket','User','Priority','Status','Updated',''],data.items.map(t=>`<tr><td><strong>#${t.id} ${safe(t.subject)}</strong><small>${safe(t.category.replaceAll('_',' '))}</small></td><td>${safe(t.first_name)} ${safe(t.last_name)}<small>${safe(t.email)}</small></td><td>${status(t.priority)}</td><td>${status(t.status)}</td><td>${safe(formatDate(t.updated_at))}</td><td><button class="table-action" data-ticket="${t.id}">Open ticket</button></td></tr>`).join(''))+`<div class="admin-pagination"><button class="btn btn-secondary" id="tickets-prev" ${ticketPage<=1?'disabled':''}>Previous</button><span>Page ${ticketPage} of ${Math.max(1,Math.ceil(data.total/25))}</span><button class="btn btn-secondary" id="tickets-next" ${ticketPage*25>=data.total?'disabled':''}>Next</button></div>`);
    if(context.can('support.manage')){const button=document.createElement('button');button.type='button';button.className='btn btn-secondary';button.textContent='Support settings';button.onclick=insights.supportSettings;root.querySelector('.panel-title').append(button);}
    root.querySelector('#ticket-filters').onsubmit=event=>{event.preventDefault();ticketSearch=event.currentTarget.elements.search.value;ticketStatus=event.currentTarget.elements.status.value;ticketPage=1;support();};
    root.querySelector('#tickets-prev').onclick=()=>{ticketPage--;support();};root.querySelector('#tickets-next').onclick=()=>{ticketPage++;support();};
    root.querySelectorAll('[data-ticket]').forEach(button=>button.onclick=()=>ticketDetail(Number(button.dataset.ticket)));
  }
  async function ticketDetail(id,messagePage=1,live=false) {
    const existing=root.querySelector('#ticket-update');
    const same=currentTicket?.id==id;
    const focused=existing?.contains(document.activeElement)&&document.activeElement?.name==='body';
    const scroll=window.scrollY;

    const data=await load('support','/api/admin/tickets/'+id+'?messagePage='+messagePage);if(!data)return;
    if(same&&existing?.elements.body)ticketDrafts.set(id,{body:existing.elements.body.value,internalNote:existing.elements.internalNote.checked});
    if(live&&existing?.dataset.metadataDirty==='true'&&data.ticket.status!=='closed'){
      root.querySelector('.ticket-thread').innerHTML=threadHtml(data.messages);
      let update=root.querySelector('[data-ticket-changed]');
      if(!update){update=document.createElement('div');update.dataset.ticketChanged='true';update.className='live-update-note';existing.before(update);}
      update.innerHTML=`<p>Conversation updated. Current status: ${safe(data.ticket.status.replaceAll('_',' '))}. Review the latest request details before saving your changes.</p><button type="button" class="btn btn-secondary">Review current details</button>`;
      existing.querySelector('[type="submit"]').disabled=true;
      update.querySelector('button').onclick=()=>{existing.dataset.metadataDirty='false';ticketDetail(id,messagePage,true);};return;
    }
    currentTicket=data.ticket;currentMessagePage=messagePage;
    const ticket=data.ticket;
    root.innerHTML=`<div class="control-detail-head"><button class="btn btn-secondary" id="back-tickets">← Support queue</button><span class="admin-result-count">Ticket #${ticket.id} · Opened ${safe(formatDate(ticket.created_at))}</span></div><div class="ticket-layout">`+
      panel(safe(ticket.subject),safe(ticket.first_name+' '+ticket.last_name+' · '+ticket.email),`<div class="ticket-thread">${threadHtml(data.messages)}</div>`)+
      (ticket.status==='closed'?panel('Request closed','This conversation is read-only. Reopen it before replying, adding notes or changing ticket details.','<button type="button" class="btn btn-secondary" id="ticket-reopen">Reopen request</button>'):panel('Manage ticket','Internal notes are visible only to support administrators.',`<form method="post" id="ticket-update"><div class="admin-form-grid">${field('Status',`<select name="status">${options(['open','in_progress','waiting_user','resolved','closed'],ticket.status)}</select>`,true)}${field('Priority',`<select name="priority">${options(['low','normal','high','urgent'],ticket.priority)}</select>`,true)}${field('Assigned to',`<select name="assignedAdminId"><option value="">Unassigned</option>${data.assignees.map(a=>`<option value="${a.id}"${Number(a.id)===Number(ticket.assigned_admin_id)?' selected':''}>${safe(a.first_name+' '+a.last_name)}</option>`).join('')}</select>`,true)}${field('Reply or note','<textarea name="body" rows="7" maxlength="10000" placeholder="Write an update"></textarea>',true)}<label class="control-check"><input name="internalNote" type="checkbox"> Internal note only</label></div><div class="settings-save"><button class="btn btn-primary" type="submit">Save ticket update</button></div></form>`))+`</div>`;
    root.insertAdjacentHTML('beforeend',insights.supportContext(data));
    root.querySelector('[data-account-audit]')?.addEventListener('click',()=>insights.accountAudit(data.ticket.user_id));
    insights.mountReplies();
    const reply=root.querySelector('#ticket-update');
    if(reply){const draft=ticketDrafts.get(id);if(draft){reply.elements.body.value=draft.body;reply.elements.internalNote.checked=draft.internalNote;}reply.addEventListener('change',event=>{if(event.target.matches('select'))reply.dataset.metadataDirty='true';});if(live&&focused){reply.elements.body.focus({preventScroll:true});window.scrollTo({top:scroll,behavior:'instant'});}}

    root.querySelector('#ticket-reopen')?.addEventListener('click',()=>openConfirmation({title:'Reopen request #'+id+'?',message:'The user and support team will be able to reply again.',submitLabel:'Reopen request',type:'standard',onConfirm:async()=>{const result=await api('/api/admin/tickets/'+id+'/reopen',{method:'POST',body:JSON.stringify({version:Number(ticket.version)})});if(!result.success)throw new Error(result.message);ticketDetail(id);}}));
    const paging=data.messagePagination;if(paging?.pages>1){const nav=document.createElement('nav');nav.className='admin-pagination';nav.innerHTML=`<button class="btn btn-secondary" data-older ${paging.page>=paging.pages?'disabled':''}>Older messages</button><span>Page ${paging.page} of ${paging.pages}</span><button class="btn btn-secondary" data-newer ${paging.page<=1?'disabled':''}>Newer messages</button>`;root.querySelector('.ticket-thread').after(nav);nav.querySelector('[data-older]').onclick=()=>ticketDetail(id,paging.page+1);nav.querySelector('[data-newer]').onclick=()=>ticketDetail(id,paging.page-1);}
    root.querySelector('#back-tickets').onclick=support;
    if(root.querySelector('#ticket-update'))root.querySelector('#ticket-update').onsubmit=event=>{event.preventDefault();const form=event.currentTarget;const body=Object.fromEntries(new FormData(form));body.internalNote=form.elements.internalNote.checked;body.assignedAdminId=body.assignedAdminId?Number(body.assignedAdminId):null;body.version=Number(currentTicket.version);submit(form,'/api/admin/tickets/'+id,'PATCH',body,'Ticket updated',()=>{ticketDrafts.delete(id);root.querySelector('#ticket-update')?.reset();ticketDetail(id);});};
  }

  async function security() {
    const data=await load('security','/api/admin/security');if(!data)return;
    root.innerHTML=`<div class="metric-grid">${metric('Recorded security events',number(data.counts.reduce((n,r)=>n+Number(r.count),0)),'Last 24 hours')}${metric('Temporary network blocks',number(data.blocks.length),'Currently active')}${metric('Monitoring scope','Application','Authentication, request guards and permissions')}</div>`+
      note('This monitor reports events detected by ReGen. Infrastructure firewall events, operating-system threats, antivirus state and DDoS telemetry require your hosting provider’s monitoring. A network identity can represent several people on a shared connection.')+
      panel('Active restrictions','Temporary network blocks expire automatically.',table(['Network','Reason','Expires',''],data.blocks.map(b=>`<tr><td>${safe(b.label)}</td><td>${safe(b.reason)}</td><td>${safe(formatDate(b.expires_at))}</td><td><button class="table-action" data-unblock="${b.identity_hash}">Remove block</button></td></tr>`).join('')))+
      panel('Security events','Recent sign-in failures, rejected requests and denied administrator actions.',table(['Time','Event','Actor','Network identity',''],data.events.map(e=>`<tr><td>${safe(formatDate(e.created_at))}</td><td>${safe(e.event_type)}</td><td>${safe(e.actor_type)} ${e.actor_id?'#'+Number(e.actor_id):''}</td><td><code>${safe(e.ip_hash.slice(0,12))}</code><small>${safe(e.user_agent)}</small></td><td><button class="table-action" data-block="${e.ip_hash}">Restrict network</button></td></tr>`).join('')));
    insights.mountIncidents(data.incidents || []);
    root.querySelectorAll('[data-unblock]').forEach(button=>button.onclick=()=>openConfirmation({title:'Remove this restriction?',message:'Requests from this network will be permitted again.',submitLabel:'Remove restriction',type:'standard',onConfirm:async()=>{const result=await api('/api/admin/security/blocks/'+button.dataset.unblock,{method:'DELETE',body:'{}'});if(!result.success)throw new Error(result.message);security();}}));
    root.querySelectorAll('[data-block]').forEach(button=>button.onclick=()=>dialog('Restrict a network',note('This may affect multiple people using the same network. Your current network cannot be blocked.')+`<div class="admin-form-grid">${field('Reason','<input name="reason" maxlength="300" required>',true)}${field('Duration (hours)','<input name="hours" type="number" min="1" max="168" value="1" required>',true)}</div>`,async(form,close)=>{if(await submit(form,'/api/admin/security/blocks','POST',{identityHash:button.dataset.block,reason:form.elements.reason.value,hours:Number(form.elements.hours.value)},'Network restricted')){close();security();}},'Apply restriction'));
  }

  async function health() {
    const data=await load('health','/api/admin/operations/health');if(!data)return;const h=data.health;
    root.innerHTML=`<div class="control-health-banner"><span class="health-light"></span><div><strong>Application responding</strong><p>Live checks completed ${safe(formatDate(h.checkedAt))}</p></div><button class="btn btn-secondary" id="health-refresh">Refresh status</button></div><div class="metric-grid">${metric('Database latency',h.database.latencyMs+' ms','Measured from this application request')}${metric('Available disk space',bytes(h.storage.freeBytes),'Filesystem containing application storage')}${metric('Open support requests',number(h.counts.openTickets),'Open, in progress or waiting for the user')}</div>`+
      `<div class="admin-panel-grid">${panel('Runtime','Observed application process values.',`<dl class="control-facts"><div><dt>PHP runtime</dt><dd>${safe(h.runtime.php)}</dd></div><div><dt>Request memory</dt><dd>${bytes(h.runtime.memoryBytes)}</dd></div><div><dt>Peak request memory</dt><dd>${bytes(h.runtime.peakMemoryBytes)}</dd></div><div><dt>PHP memory limit</dt><dd>${safe(h.runtime.memoryLimit)}</dd></div><div><dt>Host load average</dt><dd>${h.runtime.loadAverage?h.runtime.loadAverage.map(v=>Number(v).toFixed(2)).join(' / '):'Not exposed by this host'}</dd></div></dl>`)}${panel('Data and delivery','Current service totals.',`<dl class="control-facts"><div><dt>Database size</dt><dd>${bytes(h.database.bytes)}</dd></div><div><dt>Storage writable</dt><dd>${h.storage.writable?'Yes':'No'}</dd></div><div><dt>Emails awaiting processing</dt><dd>${number(h.counts.pendingMail)}</dd></div><div><dt>Email exceptions</dt><dd>${number(h.counts.failedMail)}</dd></div><div><dt>Recovery points</dt><dd>${number(h.counts.recoveryPoints)}</dd></div><div><dt>Mail worker last run</dt><dd>${h.mail?safe(formatDate(h.mail.updated_at)):'No completed run'}</dd></div></dl>`)}</div>`+note('This status screen reports live application checks. CPU utilisation, historical uptime, hardware health and host-level incidents are available through the hosting provider.');
    if (h.schema && h.payments) {
      const missing = h.schema.missing.concat(h.payments.missing);
      root.insertAdjacentHTML('beforeend', panel('Schema and payments', 'Read-only checks of this installation.',
        `<dl class="control-facts"><div><dt>Application schema</dt><dd>${h.schema.ready ? 'Ready' : 'Needs attention'}</dd></div><div><dt>Payment schema</dt><dd>${h.payments.schemaReady ? 'Ready' : 'Needs attention'}</dd></div><div><dt>HitPay configuration</dt><dd>${h.payments.configured ? safe(h.payments.mode) : 'Unavailable'}</dd></div><div><dt>Provider and callback</dt><dd>Awaiting environment verification</dd></div></dl>` +
        (missing.length ? `<details><summary>Missing schema requirements</summary><ul>${missing.map(item => `<li>${safe(item)}</li>`).join('')}</ul></details>` : '')));
    }
    root.querySelector('#health-refresh').onclick=health;
  }

  async function recovery() {
    const data=await load('recovery','/api/admin/recovery');if(!data)return;
    root.innerHTML=note('Recovery points contain saved resumes and cover letters. A safety copy is made before restoration. Account deletion removes its recovery points. These points share the application database; configure separate hosting backups for disaster recovery.')+
      panel('History policy','Capture limits apply to new recovery points. The scheduled worker removes expired points; expired points cannot be restored.',`<form method="post" id="recovery-policy"><div class="admin-form-grid"><label class="control-check"><input name="autoEnabled" type="checkbox"${checked(data.policy.autoEnabled)}> Automatic document history</label>${field('Points per account (2–50)',`<input name="maxPoints" type="number" min="2" max="50" value="${Number(data.policy.maxPoints)}" required>`)}${field('Capture interval (minutes)',`<input name="intervalMinutes" type="number" min="5" max="1440" value="${Number(data.policy.intervalMinutes)}" required>`)}${field('Retention (days)',`<input name="retentionDays" type="number" min="1" max="365" value="${Number(data.policy.retentionDays)}" required>`)}</div><div class="settings-save"><button class="btn btn-secondary" type="submit">Save history policy</button></div></form>`)+
      panel('Create a recovery point','Use the user account ID shown in account management.',`<form method="post" id="recovery-create"><div class="admin-form-grid">${field('User ID','<input name="userId" type="number" min="1" required>')}${field('Label','<input name="label" maxlength="180" value="Before maintenance" required>')}</div><div class="settings-save"><button class="btn btn-primary" type="submit">Create recovery point</button></div></form>`)+
      panel('Document history','Review the contents before restoring. Newer cover letters are retained.',table(['Recovery point','Account','Created','Size','Last restored',''],data.items.map(s=>`<tr><td><strong>#${s.id} ${safe(s.label)}</strong></td><td>${safe(s.email)}<small>User #${s.user_id}</small></td><td>${safe(formatDate(s.created_at))}</td><td>${bytes(s.bytes)}</td><td>${s.restored_at?safe(formatDate(s.restored_at)):'Never'}</td><td><button class="table-action" data-inspect="${s.id}">Review restore</button></td></tr>`).join('')));
    root.querySelector('#recovery-create').onsubmit=event=>{event.preventDefault();const form=event.currentTarget;submit(form,'/api/admin/recovery','POST',{userId:Number(form.elements.userId.value),label:form.elements.label.value},'Recovery point created',recovery);};
    root.querySelector('#recovery-policy').onsubmit=event=>{event.preventDefault();const form=event.currentTarget;submit(form,'/api/admin/recovery/policy','PUT',{autoEnabled:form.elements.autoEnabled.checked,maxPoints:Number(form.elements.maxPoints.value),intervalMinutes:Number(form.elements.intervalMinutes.value),retentionDays:Number(form.elements.retentionDays.value)},'Recovery policy saved');};
    root.querySelectorAll('[data-inspect]').forEach(button=>button.onclick=async()=>{
      const result=await api('/api/admin/recovery/'+button.dataset.inspect);if(!result.success)return toast('Cannot inspect',result.message,'error');const s=result.item;
      const summary = note(`User #${Number(s.userId)} · ${safe(formatDate(s.createdAt))}<br>Resumes: ${safe(s.resumeTitles.join(', ') || 'None')}<br>Cover letters: ${Number(s.letterCount)}`);
      if (!context.can('recovery.manage')) {
        dialog('Recovery point #' + Number(s.id), summary, (_form, close) => close(), 'Done');
        return;
      }
      const phrase = 'RESTORE ' + Number(s.id);
      const confirmation = field('Type ' + phrase, `<input name="confirmation" pattern="${phrase}" autocomplete="off" required>`, true);
      const password = field('Administrator password', '<input type="password" name="password" autocomplete="current-password" maxlength="128" required>', true);
      dialog('Restore recovery point #' + Number(s.id), summary +
        note('Current documents will be backed up before restoration.') + `<div class="admin-form-grid">${confirmation}${password}</div>`,
        async (form, close) => {
          if (await submit(form, `/api/admin/recovery/${Number(s.id)}/restore`, 'POST', Object.fromEntries(new FormData(form)), 'Documents restored')) {
            close();
            if (context.active() === 'recovery') recovery();
          }
        }, 'Restore documents');
    });
  }

  async function enhanceUser(user) {
    const host=document.getElementById('drawer-body');
    const section=document.createElement('section');section.className='drawer-section';section.innerHTML='<h3>Account insight</h3><p>Loading current quota and devices…</p>';host.append(section);
    const data=await api('/api/admin/users/'+user.id);
    if(!section.isConnected)return;
    if(!data.success){section.innerHTML='<p>'+safe(data.message)+'</p>';return;}
    section.dataset.userPanel='account';
    section.innerHTML=`<h3>Account operations</h3><div class="drawer-operation-grid"><button type="button" class="drawer-operation" data-user-reset><strong>Send password reset</strong><span>Email a single-use link to the verified account.</span></button>${!user.email_verified_at?'<button type="button" class="drawer-operation" data-user-verify><strong>Resend verification</strong><span>Send a fresh email verification link.</span></button>':''}</div>${context.can('recovery.manage')?'<button type="button" class="btn btn-secondary control-user-snapshot" data-user-snapshot>Create document recovery point</button>':''}${context.admin()?.role==='super_admin'?'<button type="button" class="btn btn-danger control-user-snapshot" data-user-delete>Permanently delete account</button>':''}`;
    const quota=document.createElement('section');quota.className='drawer-section';quota.dataset.userPanel='ai';quota.innerHTML=`<h3>Current AI allowance</h3><p>${number(data.quota.used)} base tokens used · ${number(data.quota.remaining)} total tokens remaining</p><p>${data.quota.renewable===false?'This account uses a fixed base allowance.':'Base tokens renew according to the system policy.'}</p>`;host.append(quota);
    if(!context.can('users.manage'))section.querySelectorAll('[data-user-reset],[data-user-verify]').forEach(button=>button.disabled=true);
    for(const [selector,operation,title] of [['[data-user-reset]','password-reset','Send password reset?'],['[data-user-verify]','verification','Resend email verification?']])section.querySelector(selector)?.addEventListener('click',()=>openConfirmation({title,message:'An email will be sent to '+user.email+'.',submitLabel:'Send email',type:'standard',onConfirm:async()=>{const result=await api('/api/admin/users/'+user.id+'/'+operation,{method:'POST',body:'{}'});if(!result.success)throw new Error(result.message);toast('Email accepted',result.message);}}));
    section.querySelector('[data-user-snapshot]')?.addEventListener('click',()=>openConfirmation({title:'Create recovery point?',message:'A copy of the saved documents for '+user.email+' will be added to recovery history.',submitLabel:'Create point',type:'standard',onConfirm:async()=>{const result=await api('/api/admin/recovery',{method:'POST',body:JSON.stringify({userId:Number(user.id),label:'Manual account snapshot'})});if(!result.success)throw new Error(result.message);toast('Recovery point created');}}));
    section.querySelector('[data-user-delete]')?.addEventListener('click',()=>dialog('Permanently delete user #'+user.id,note('This removes the account, its documents, tickets, notifications and recovery points. This action cannot be undone. Disable the account instead if you may need to restore access.')+`<div class="admin-form-grid">${field('Type DELETE USER '+user.id,`<input name="confirmation" pattern="DELETE USER ${user.id}" autocomplete="off" required>`,true)}${field('Your administrator password','<input name="password" type="password" autocomplete="current-password" maxlength="128" required>',true)}</div>`,async(form,close)=>{if(await submit(form,'/api/admin/users/'+user.id+'/delete','POST',Object.fromEntries(new FormData(form)),'Account deleted')){close();document.getElementById('admin-drawer').close();context.show('users');}},'Delete permanently'));
    if (context.can('users.export')) {
      const exportButton = document.createElement('button');
      exportButton.type = 'button';
      exportButton.className = 'btn btn-secondary control-user-snapshot';
      exportButton.textContent = 'Download account data';
      exportButton.onclick = () => dialog('Download account data',
        note('The export includes this account’s saved resumes and cover letters.') +
        field('Administrator password', '<input type="password" name="password" autocomplete="current-password" maxlength="128" required>', true),
        async (form, close) => {
          await submit(form, `/api/admin/users/${Number(user.id)}/export`, 'POST', Object.fromEntries(new FormData(form)), 'Account data ready', response => {
            const {success, exportedAt, profile, resumes, coverLetters} = response;
            const file = new Blob([JSON.stringify({success, exportedAt, profile, resumes, coverLetters})], {type:'application/json'});
            const url = URL.createObjectURL(file);
            const link = document.createElement('a');
            link.href = url;
            link.download = `regen-user-${Number(user.id)}.json`;
            document.body.append(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            close();
          });
        }, 'Download');
      section.append(exportButton);
    }
  }
  async function organizeUser(user){
    const host=document.getElementById('drawer-body');if(!host||document.getElementById('admin-drawer').dataset.id!==String(user.id))return;
    const summary=host.querySelector('.drawer-summary');const tabs=document.createElement('div');tabs.className='user-detail-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Account sections');summary.after(tabs);
    const panels={};for(const [key,label] of [['account','Account'],['packages','Packages'],['ai','AI & bonus'],['devices','Devices'],['activity','Activity']]){if(key==='activity'&&!context.can('audit.view'))continue;const panel=document.createElement('div');panel.id='user-panel-'+key;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby','user-tab-'+key);panel.dataset.userTab=key;panels[key]=panel;host.append(panel);const button=document.createElement('button');button.type='button';button.id='user-tab-'+key;button.setAttribute('role','tab');button.setAttribute('aria-controls',panel.id);button.textContent=label;tabs.append(button);button.onclick=()=>select(key);}
    for(const node of [...host.children]){if(node===summary||node===tabs||node.dataset.userTab)continue;(panels[node.dataset.userPanel||'account']||panels.account).append(node);}
    window.ReGenAdminUserPackages({...context,api,safe,dialog,submit,field})(panels.packages,user);
    const limit=document.getElementById('edit-limit')?.closest('label');if(limit){const grid=document.createElement('div');grid.className='admin-form-grid';grid.append(limit);panels.ai.prepend(grid);}
    const reset=document.getElementById('reset-quota');if(reset){reset.classList.add('control-user-snapshot');panels.ai.append(reset);}
    const revoke=document.getElementById('revoke-user-sessions');if(revoke){revoke.classList.add('control-user-snapshot');panels.devices.append(revoke);}
    for(const element of panels.account.querySelectorAll('.drawer-operation-grid'))if(!element.children.length)element.parentElement.remove();
    const deviceList=document.createElement('section');deviceList.className='drawer-section';panels.devices.prepend(deviceList);
    const devices=async(page=1)=>{deviceList.innerHTML='<p>Loading recorded devices…</p>';const data=await api('/api/admin/users/'+user.id+'/sessions?page='+page);if(!deviceList.isConnected)return;if(!data.success){deviceList.innerHTML='<p>'+safe(data.message)+'</p>';return;}deviceList.innerHTML='<h3>Sign-in devices</h3><p>Browser and device labels are inferred from sign-in requests.</p>'+`<div class="control-device-list">${data.items.map(item=>`<div><strong>${safe(item.device_label+' · '+item.browser_label)}</strong><small>${safe(formatDate(item.last_seen_at))} · ${item.revoked_at?'Signed out':'Not revoked'}</small></div>`).join('')||'<p>No recorded devices.</p>'}</div><nav class="admin-pagination"><button type="button" class="btn btn-secondary" data-prev ${page<=1?'disabled':''}>Previous</button><span>Page ${page} of ${Math.max(1,Math.ceil(data.total/10))}</span><button type="button" class="btn btn-secondary" data-next ${page*10>=data.total?'disabled':''}>Next</button></nav>`;deviceList.querySelector('[data-prev]').onclick=()=>devices(page-1);deviceList.querySelector('[data-next]').onclick=()=>devices(page+1);};devices();
    if(panels.activity){
      const activity=async(page=1)=>{
        if(!context.can('audit.view')){panels.activity.innerHTML='<section class="drawer-section"><h3>Account activity</h3><p>Activity log read access is required to inspect account events.</p></section>';return;}
        const data=await api('/api/admin/audit/search?actor=user&actorId='+user.id+'&page='+page);if(!panels.activity.isConnected)return;
        if(!data.success){panels.activity.textContent=data.message;return;}
        panels.activity.innerHTML='<section class="drawer-section"><h3>Recent account activity</h3><p>Recent actions by this user in the last 30 days. Open searchable history for request details and filters.</p><div class="drawer-activity-list">'+data.items.slice(0,10).map(item=>`<article><strong>${safe(item.event_type.replaceAll('_',' ').replaceAll('.',' · '))}</strong>${item.target_id?`<p class="drawer-activity-target">${safe(item.target_type||'Target')}: ${safe(item.target_id)}</p>`:''}<p>${safe(item.client?.browser||'Browser not recorded')} · ${safe(item.client?.os||item.client?.device||'Device not recorded')}</p><time>${safe(formatDate(item.created_at))}</time></article>`).join('')+(data.items.length?'':'<p>No events in this period.</p>')+'</div><button type="button" class="btn btn-secondary" data-audit-user>Open searchable history</button></section>';
        panels.activity.querySelector('[data-audit-user]').onclick=()=>{document.getElementById('admin-drawer').close();insights.accountAudit(user.id);};
      };activity();
    }

    function select(key){for(const [id,panel]of Object.entries(panels)){panel.hidden=id!==key;const button=tabs.querySelector('[aria-controls="'+panel.id+'"]');button.setAttribute('aria-selected',String(id===key));button.tabIndex=id===key?0:-1;}document.getElementById('drawer-save').hidden=!['account','ai'].includes(key)||!context.can('users.manage');}
    tabs.onkeydown=event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const buttons=[...tabs.children];const index=buttons.indexOf(document.activeElement);const target=buttons[event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowRight'?1:buttons.length-1))%buttons.length];target.click();target.focus();};select('account');
  }
  const insights=window.ReGenAdminInsights({...context,dialog,submit,panel,table,field,note,metric});
  const templateViews=window.ReGenAdminTemplates({...context,dialog,submit,panel,table,field,note,metric});
  const campaignViews=window.ReGenAdminCampaigns({...context,dialog,submit,panel,table,field,note,metric});
  return {refreshSupport:()=>currentTicket?ticketDetail(Number(currentTicket.id),currentMessagePage,true):support(),views:{...window.ReGenAdminCommerce({...context,dialog,submit,panel,table,field,note}),...campaignViews,analytics,features,notifications,support,security,health,recovery,...insights.views,...templateViews,...window.ReGenAdminMaintenance({...context,field,note})},permissions:insights.permissions,emailSettings:insights.emailSettings,enhanceUser:async user=>{await enhanceUser(user);await insights.enhanceUser(user);await organizeUser(user);}};
};
