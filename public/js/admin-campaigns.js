window.ReGenAdminCampaigns = context => {
  const {root,api,safe,formatDate,toast,stamp,fail,dialog,submit,panel,table,field,note}=context;
  let page=1, sequence=0;
  const colors={emerald:'Emerald',blue:'Blue',amber:'Amber',violet:'Violet',neutral:'Neutral'};
  const local=value=>value?new Date(value.replace(' ','T')+'Z').toLocaleString('sv-SE').slice(0,16).replace(' ','T'):'';
  const iso=value=>value?new Date(value).toISOString().replace('.000Z','Z'):null;
  const labels={draft:'Draft',scheduled:'Scheduled',live:'Live',paused:'Paused',ended:'Ended',archived:'Archived'};
  const badge=item=>`<span class="campaign-status-label" data-state="${safe(item.visibility?.state||item.status)}">${safe(labels[item.visibility?.state||item.status]||item.status)}</span>`;

  async function campaigns(){
    const token=++sequence;
    const data=await api('/api/admin/campaigns?page='+page);
    if(token!==sequence||context.active()!=='campaigns')return;
    if(!data.success)return fail(data.message);
    page=data.page;
    const rows=data.items.map(item=>`<tr><td><strong>${safe(item.title)}</strong><small>${Number(item.delivered_count)} inbox messages · ${Number(item.claim_count)} claims</small></td><td>${item.audience==='verified'?'Verified accounts':'All accounts'}<small>${item.starts_at?safe(formatDate(item.starts_at)):'Starts when published'}${item.ends_at?' → '+safe(formatDate(item.ends_at)):''}</small></td><td>${Number(item.reward_enabled)?`${Number(item.reward_amount)} tokens / claim`:'Message only'}<small>${Number(item.reward_enabled)?`${Number(item.reward_limit)} ${Number(item.reward_limit)===1?'claim':'claims'} per account`:''}</small></td><td>${badge(item)}</td><td><button class="table-action" data-campaign="${item.id}">${context.can('campaigns.manage')?'Manage':'View'}</button></td></tr>`).join('');
    root.innerHTML=panel('Campaigns & announcements','A live campaign appears on the dashboard and in Notifications. Scheduled campaigns become visible when their start time arrives.',
      table(['Announcement','Audience & schedule','Reward','Visibility',''],rows)+
      `<nav class="admin-pagination"><button class="btn btn-secondary" data-prev ${page<=1?'disabled':''}>Previous</button><span>Page ${page} of ${Math.max(1,Math.ceil(data.total/10))}</span><button class="btn btn-secondary" data-next ${page*10>=data.total?'disabled':''}>Next</button></nav>`,
      context.can('campaigns.manage')?'<button class="btn btn-primary" data-create-campaign>Create announcement</button>':'');
    root.querySelector('[data-create-campaign]')?.addEventListener('click',()=>edit());
    root.querySelectorAll('[data-campaign]').forEach(button=>button.onclick=()=>edit(data.items.find(item=>Number(item.id)===Number(button.dataset.campaign)),data.serverNow));
    root.querySelector('[data-prev]').onclick=()=>{page--;campaigns();};
    root.querySelector('[data-next]').onclick=()=>{page++;campaigns();};
    stamp();
  }

  function edit(item=null,serverNow=null){
    const c=item||{title:'',body:'',color:'emerald',audience:'all',status:'draft',reward_amount:5,reward_limit:1,total_claim_limit:0,reward_enabled:0};
    const timezone=Intl.DateTimeFormat().resolvedOptions().timeZone;
    const current=serverNow?new Date(serverNow).toLocaleString('en-MY',{dateStyle:'medium',timeStyle:'short'}):new Date().toLocaleString();
    const visibility=item?`<div class="campaign-visibility">${badge(item)}<p>${safe(item.visibility.reason)}</p><div class="campaign-delivery-stats">${[['Inbox messages',item.delivered_count],['Dismissed banners',item.dismissed_count],['People rewarded',item.recipients_rewarded]].map(([label,value])=>`<div><strong>${Number(value||0)}</strong><span>${label}</span></div>`).join('')}</div><p class="campaign-form-help">${Number(item.eligible_count)} currently eligible accounts · Checked at: ${safe(current)}</p></div>`:note('Create a draft, review the preview and publish when you are ready.');
    const body=visibility+
      `<div class="admin-form-grid">${field('Announcement title',`<input name="title" maxlength="180" minlength="3" value="${safe(c.title)}" required>`,true)}${field('Message',`<textarea name="body" rows="4" minlength="5" maxlength="5000" required>${safe(c.body)}</textarea>`,true)}${field('Accent color',`<select name="color">${Object.entries(colors).map(([value,label])=>`<option value="${value}"${c.color===value?' selected':''}>${label}</option>`).join('')}</select>`)}${field('Audience',`<select name="audience"><option value="all">All accounts</option><option value="verified"${c.audience==='verified'?' selected':''}>Verified accounts</option></select>`)}</div>`+
      `<section class="campaign-form-section"><h3>Publication & timing</h3><p>Times use ${safe(timezone)}. A future start keeps the banner and inbox message hidden until that time.</p><div class="admin-form-grid">${item?field('Publication',`<select name="status">${(c.published_at?['active','paused','archived']:['draft','active','paused','archived']).map(value=>`<option value="${value}"${c.status===value?' selected':''}>${value==='active'?'Published':labels[value]}</option>`).join('')}</select>`):''}${field('Start',`<select name="startMode"><option value="immediate">When published</option><option value="scheduled"${c.starts_at?' selected':''}>At a scheduled time</option></select>`)}<div class="is-wide" data-start-date>${field('Start date and time',`<input name="startsAt" type="datetime-local" value="${local(c.starts_at)}">`,true)}</div>${field('End date and time (optional)',`<input name="endsAt" type="datetime-local" value="${local(c.ends_at)}"><small>Leave blank to keep the notice available.</small>`,true)}</div></section>`+
      `<section class="campaign-form-section"><h3>Optional token rewards</h3><p>Send a message on its own or let eligible users claim bonus tokens.</p><div class="admin-form-grid"><label class="permission-option is-wide"><input name="rewardEnabled" type="checkbox"${Number(c.reward_enabled)?' checked':''}><span><strong>Include a claim button</strong><small>Bonus tokens remain in the account until used.</small></span></label><div class="admin-form-grid is-wide" data-reward-fields>${field('Tokens per claim',`<input name="rewardAmount" type="number" min="1" max="1000" value="${Number(c.reward_amount)}" required>`)}${field('Claims per account',`<input name="rewardLimit" type="number" min="1" max="100" value="${Number(c.reward_limit)}" required><small>1 means a one-time reward.</small>`)}${field('Total claim cap',`<input name="totalClaimLimit" type="number" min="0" max="1000000" value="${Number(c.total_claim_limit)}" required><small>0 means no campaign-wide cap. This counts claims, not tokens.</small>`,true)}</div></div><p class="campaign-form-help">Updated reward values apply to later claims. Previously granted balances remain available.</p></section>`+
      `<div class="campaign-preview" data-preview></div><label class="control-check campaign-publish-check" data-publish-review hidden><input name="confirmPublish" type="checkbox"> I reviewed the audience, timing and reward limits before publishing.</label>`;
    const modal=dialog(item?'Manage announcement':'Create announcement',body,async(form,close)=>{
      const data=Object.fromEntries(new FormData(form));
      data.rewardEnabled=form.elements.rewardEnabled.checked;
      for(const key of ['rewardAmount','rewardLimit','totalClaimLimit'])data[key]=Number(form.elements[key].value);
      data.startsAt=form.elements.startMode.value==='scheduled'?iso(form.elements.startsAt.value):null;
      data.endsAt=iso(form.elements.endsAt.value);data.status=item?data.status:'draft';
      if(item)data.version=Number(item.version);
      if(data.status==='active'&&!form.elements.confirmPublish.checked)return toast('Review publication','Confirm the details before publishing.','warning');
      if(await submit(form,'/api/admin/campaigns'+(item?'/'+item.id:''),item?'PUT':'POST',data,item?'Announcement saved':'Draft created')){close();campaigns();}
    },item?'Save announcement':'Save draft');
    modal.classList.add('campaign-management-dialog');
    const form=modal.querySelector('form');
    function preview(){
      const reward=form.elements.rewardEnabled.checked;
      form.querySelector('[data-reward-fields]').hidden=!reward;
      form.querySelectorAll('[data-reward-fields] input').forEach(input=>input.disabled=!reward);
      const scheduled=form.elements.startMode.value==='scheduled';
      form.querySelector('[data-start-date]').hidden=!scheduled;
      form.elements.startsAt.disabled=!scheduled;form.elements.startsAt.required=scheduled;
      const publish=form.elements.status?.value==='active';
      form.querySelector('[data-publish-review]').hidden=!publish;form.elements.confirmPublish.required=publish;
      form.querySelector('[data-preview]').innerHTML=`<div class="campaign-banner campaign-${form.elements.color.value}"><div class="campaign-copy"><span class="campaign-kicker">Dashboard preview</span><h2>${safe(form.elements.title.value||'Your announcement title')}</h2><p>${safe(form.elements.body.value||'Your message will appear here.')}</p>${reward?`<p class="campaign-reward">${Number(form.elements.rewardAmount.value)} tokens per claim · Up to ${Number(form.elements.rewardLimit.value)} ${Number(form.elements.rewardLimit.value)===1?'claim':'claims'} per account</p>`:''}</div></div><p class="campaign-form-help">${scheduled&&form.elements.startsAt.value?'Starts '+safe(new Date(form.elements.startsAt.value).toLocaleString())+'.':'Available when published.'} Users may dismiss the banner; the message stays in Notifications.</p>`;
    }
    form.addEventListener('input',preview);preview();
    if(!context.can('campaigns.manage')){modal.querySelector('[type=submit]').hidden=true;form.querySelectorAll('input,select,textarea').forEach(input=>input.disabled=true);modal.querySelector('[data-cancel]').textContent='Close';}
  }
  return {campaigns};
};
