window.ReGenAdminTemplates = context => {
  const {root,api,safe,stamp,fail,dialog,field,note,metric,openConfirmation,toast} = context;
  let request = 0;
  let search = '';
  let visibility = 'all';

  async function templates() {
    const generation = ++request;
    const result = await api('/api/admin/templates');
    if (generation !== request || context.active() !== 'templates') return;
    if (!result.success) return fail(result.message);
    const items = result.items;
    const visible = items.filter(item => item.visible).length;
    root.innerHTML = `<div class="metric-grid">${metric('Available designs',visible+' / '+items.length,'Visible in user template collections')}${metric('Users using a design',items.reduce((sum,item)=>sum+item.currentUsers,0).toLocaleString(),'One current resume per user')}${metric('Popular badges',items.filter(item=>item.visible&&item.popular).length,'Visible designs with your editorial badge')}</div>
      <section class="admin-panel"><div class="panel-title"><div><h2>A considered collection</h2><p>Curate the designs users can choose. Preview first, then review changes before publishing.</p></div></div>
      <div class="template-admin-toolbar">${field('Find a design',`<input id="template-admin-search" type="search" placeholder="Name, collection or style" value="${safe(search)}">`)}${field('Visibility',`<select id="template-admin-visibility"><option value="all">All designs</option><option value="visible">Visible to users</option><option value="hidden">Hidden from selection</option></select>`)}<span class="admin-result-count" id="template-admin-count"></span></div>
      <div class="template-admin-list" id="template-admin-list"></div></section>
      ${note('Usage shows current user selections and distinct users recorded since template tracking began, including the selections present at upgrade. Popular is an editorial badge you control. Template access is currently free; billing can build on this catalogue later.')}`;
    const host=root.querySelector('#template-admin-list');
    const render=()=>{
      const filtered=items.filter(item=>(visibility==='all'||item.visible===(visibility==='visible'))&&`${item.name} ${item.description} ${item.tier==='basic'?'standard':'premium'}`.toLowerCase().includes(search.toLowerCase()));
      root.querySelector('#template-admin-count').textContent=filtered.length+' designs';
      host.nextElementSibling?.classList.contains('local-pagination')&&host.nextElementSibling.remove();delete host.dataset.paginated;
      host.innerHTML=filtered.length?filtered.map(item=>`<article class="template-admin-row"><div class="template-admin-thumb"><img src="/img/templates/${safe(item.id)}-320.webp" alt="${safe(item.name)} resume preview" width="640" height="905" loading="lazy" decoding="async"></div><div class="template-admin-info"><div class="template-admin-tags"><span class="status-pill${item.visible?'':' is-off'}">${item.visible?'Visible':'Hidden'}</span>${item.popular?'<span class="template-popular-badge">Popular</span>':''}<span>${item.tier==='basic'?'Standard':'Premium'}</span></div><h3>${safe(item.name)}</h3><p>${safe(item.description)}</p><small>${safe(item.font)} · ${item.photo?'Photo layout':'Text-only layout'} · Display order ${item.sortOrder}</small></div><div class="template-admin-usage"><strong>${item.currentUsers.toLocaleString()}</strong><span>current users</span><small>${item.savedResumes.toLocaleString()} saved resumes</small>${context.can('templates.resumes')?`<button type="button" class="template-usage-link" data-template-usage="${safe(item.id)}">View usage ↗</button>`:''}</div><div class="template-admin-actions"><button type="button" class="btn btn-secondary" data-template-preview="${safe(item.id)}">Preview</button><button type="button" class="btn ${context.can('templates.manage')?'btn-primary':'btn-secondary'}" data-template-settings="${safe(item.id)}">${context.can('templates.manage')?'Configure':'View settings'}</button></div></article>`).join(''):'<div class="control-empty"><h3>No designs match</h3><p>Try a different name or visibility filter.</p></div>';
      window.ReGenAdminCharts.paginate(host,'.template-admin-row',8);
    };
    root.querySelector('#template-admin-visibility').value=visibility;
    root.querySelector('#template-admin-search').oninput=event=>{search=event.target.value;render();};
    root.querySelector('#template-admin-visibility').onchange=event=>{visibility=event.target.value;render();};
    host.onclick=event=>{
      const usage=event.target.closest('[data-template-usage]');if(usage){openUsage(usage.dataset.templateUsage);return;}
      const preview=event.target.closest('[data-template-preview]');
      const settings=event.target.closest('[data-template-settings]');
      const item=items.find(item=>item.id===(preview?.dataset.templatePreview||settings?.dataset.templateSettings));
      if (!item) return;
      if (preview) {
        const modal=dialog(item.name+' preview',`<iframe class="admin-template-preview" src="/api/admin/templates/${safe(item.id)}/preview" title="${safe(item.name)} sample resume" sandbox="allow-same-origin"></iframe>`,async(form,close)=>close(),'Close preview');
        modal.classList.add('control-dialog-preview');return;
      }
      const modal=dialog('Configure '+item.name,note('Hiding a design removes it from new selections. Users who already use it can continue editing and downloading their saved documents.')+`<div class="admin-form-grid"><label class="permission-option"><input name="visible" type="checkbox"${item.visible?' checked':''}><span><strong>Visible to users</strong><small>Show this design in the landing page and template picker.</small></span></label><label class="permission-option"><input name="popular" type="checkbox"${item.popular?' checked':''}><span><strong>Popular badge</strong><small>Display your editorial recommendation alongside the design.</small></span></label>${field('Display order',`<input name="sortOrder" type="number" min="0" max="1000" value="${item.sortOrder}" required><small>Lower numbers appear first. Equal numbers use the design name.</small>`,true)}</div>`,async(form,close)=>{
        const body={visible:form.elements.visible.checked,popular:form.elements.popular.checked,sortOrder:Number(form.elements.sortOrder.value),version:item.version};
        openConfirmation({title:'Publish '+item.name+' settings?',message:`${item.name} will be ${body.visible?'visible to users':'hidden from new selections'}, with ${body.popular?'a Popular badge':'no Popular badge'}, at display order ${body.sortOrder}. Saved documents remain usable.`,submitLabel:'Publish settings',type:'standard',onConfirm:async()=>{
          const saved=await api('/api/admin/templates/'+item.id,{method:'PATCH',body:JSON.stringify(body)});
          if(!saved.success)throw new Error(saved.message);
          close();toast('Template settings published','The catalogue will reflect this change when users next load it.');templates();
        }});
      },'Review changes');
      if(!context.can('templates.manage')){modal.querySelector('[type="submit"]').hidden=true;modal.querySelectorAll('input').forEach(input=>input.disabled=true);}
    };
    render();stamp();
  }
  async function openUsage(id) {
    const modal=dialog('Saved resumes · '+id,'<p>Loading saved resumes…</p>',async(form,close)=>close(),'Close');modal.classList.add('template-usage-dialog');
    const body=modal.querySelector('.control-dialog-body');let page=1,query='',version=0;
    async function load(){
      const serial=++version;const data=await api('/api/admin/templates/'+id+'/resumes?page='+page+'&q='+encodeURIComponent(query));
      if(serial!==version||!modal.open)return;if(!data.success){body.innerHTML='<p>'+safe(data.message)+'</p>';return;}
      page=data.page;
      body.innerHTML=note('These are actual saved resume records using this design. Gallery previews are excluded. Opening a private resume records an audit event.')+`<div class="admin-toolbar" data-search><input class="admin-search" type="search" name="q" aria-label="Find saved resumes" placeholder="User, email or resume title" value="${safe(query)}"><button class="btn btn-secondary" type="button">Search</button></div><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>User</th><th>Saved resume</th><th>Updated</th><th></th></tr></thead><tbody>${data.items.map(row=>`<tr><td><strong>${safe(row.first_name+' '+row.last_name)}</strong><small>${safe(row.email)}</small></td><td>${safe(row.title)}<small>Record #${Number(row.id)}</small></td><td>${safe(context.formatDate(row.updated_at))}</td><td><button type="button" class="table-action" data-view-resume="${Number(row.id)}">View resume</button></td></tr>`).join('')||'<tr><td colspan="4">No saved resumes match this design and search.</td></tr>'}</tbody></table></div><nav class="admin-pagination"><button type="button" class="btn btn-secondary" data-prev ${page<=1?'disabled':''}>Previous</button><span>Page ${page} of ${data.pages} · ${data.total} records</span><button type="button" class="btn btn-secondary" data-next ${page>=data.pages?'disabled':''}>Next</button></nav>`;
      body.querySelector('[data-search] button').onclick=()=>{query=body.querySelector('[name=q]').value;page=1;load();};body.querySelector('[name=q]').onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();body.querySelector('[data-search] button').click();}};
      body.querySelector('[data-prev]').onclick=()=>{page--;load();};body.querySelector('[data-next]').onclick=()=>{page++;load();};
      body.querySelectorAll('[data-view-resume]').forEach(button=>button.onclick=()=>{
        const row=data.items.find(r=>Number(r.id)===Number(button.dataset.viewResume));
        const view=dialog(row.title+' · read only',`<div class="private-resume-caption"><strong>${safe(row.first_name+' '+row.last_name)}</strong><span>Saved record #${Number(row.id)} · ${safe(id)} design</span><p>Private content · read-only access is recorded in the activity log.</p></div><div class="private-resume-tools"><div><button type="button" class="btn btn-secondary" data-zoom-out aria-label="Zoom out">−</button><span data-zoom-label>100%</span><button type="button" class="btn btn-secondary" data-zoom-in aria-label="Zoom in">+</button></div><a class="btn btn-secondary" target="_blank" rel="noopener" href="/api/admin/templates/${id}/resumes/${Number(row.id)}/pdf">Open PDF ↗</a></div><div class="private-pdf-frame"><div class="pdf-pages private-pdf-pages" aria-label="${safe(row.title)} saved resume"></div></div>`,async(form,close)=>close(),'Close viewer');view.classList.add('private-resume-dialog');const pages=view.querySelector('.private-pdf-pages');let zoom=1;const adjust=amount=>{zoom=Math.max(.5,Math.min(2,zoom+amount));view.querySelector('[data-zoom-label]').textContent=Math.round(zoom*100)+'%';PdfPages.zoom(pages,zoom);};view.querySelector('[data-zoom-out]').onclick=()=>adjust(-.25);view.querySelector('[data-zoom-in]').onclick=()=>adjust(.25);view.addEventListener('close',()=>PdfPages.clear(pages),{once:true});PdfPages.render(pages,'/api/admin/templates/'+id+'/resumes/'+Number(row.id)+'/pdf');
      });
    }
    await load();
  }
  return {templates};
};
