window.ReGenAdminCommerce=context=>{
  const {root,api,safe,dialog,submit,panel,table,field,stamp,fail}=context;
  let page=1,tab='overview',catalogue=null,sequence=0;
  let paymentFilters={q:'',status:'',days:'',mode:''};
  let analyticsFilters={days:'30',mode:''};
  const count=value=>Number(value||0).toLocaleString();
  const money=(amount,currency)=>new Intl.NumberFormat('en-MY',{style:'currency',currency}).format(amount/100);
  const can=()=>context.can('pricing.manage');
  const localDate=value=>{if(!value)return '';const d=new Date(value.replace(' ','T')+'Z');return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);};
  const utc=value=>value?new Date(value).toISOString():null;
  async function pricing(){
    const current=++sequence;
    const endpoint = tab === 'payments'
      ? '/api/admin/store/payments?'+new URLSearchParams({...paymentFilters,page})
      : tab === 'overview'
        ? '/api/admin/store/payment-analytics?'+new URLSearchParams(analyticsFilters)
        : '/api/admin/store?page='+page+(tab==='packages'?'':'&view=settings');
    const data=await api(endpoint);
    if(current!==sequence||!['pricing','store'].includes(context.active()))return;
    if(!data.success)return fail(data.message);
    if(tab!=='payments'&&tab!=='overview')catalogue=data;
    root.innerHTML=`<nav class="commerce-tabs" aria-label="Pricing sections">${[['overview','Overview'],['packages','Packages'],['payments','Payment history'],['features','Access & token rules'],['presentation','Store presentation']].map(([key,label])=>`<button class="btn ${key===tab?'btn-primary':'btn-secondary'}" data-commerce-tab="${key}" aria-pressed="${key===tab}">${label}</button>`).join('')}</nav><div id="commerce-panel"></div>`;
    root.querySelectorAll('[data-commerce-tab]').forEach(button=>button.onclick=()=>{tab=button.dataset.commerceTab;page=1;pricing();});
    const target=root.querySelector('#commerce-panel');
    if(tab==='overview'){
      renderAnalytics(target,data);
    }else if(tab==='payments'){
      renderPayments(target,data);
    }else if(tab==='packages'){
      target.innerHTML=panel('Packages','Edit benefits, prices, promotions and free claims for each package.',table(['Package','Includes','Price','Status',''],data.items.map(item=>`<tr><td><strong>${safe(item.name)}</strong><small class="cell-sub">${item.card_layout==='row'?'One-line offer':'Hero card'} · ${safe(ReGenCommerce.colors[item.coin_color]||'Emerald')}</small>${item.badge?`<small class="cell-sub">${safe(item.badge)}</small>`:''}</td><td>${Object.keys(item.features).length?count(Object.keys(item.features).length)+' features':''}${item.tokens+item.bonus_tokens?`<small class="cell-sub">${count(item.tokens+item.bonus_tokens)} saved tokens</small>`:''}<small class="cell-sub">${item.validity_days?item.validity_days+' days':'No expiry'}</small>${item.claim_enabled?`<small class="cell-sub">Free claim · ${count(item.claim_count)} / ${count(item.claim_limit)}</small>`:''}<small class="cell-sub">Landing: ${item.landing_visible?'Visible':'Hidden'}</small></td><td>${safe(money(item.display_price_minor,item.currency))}${item.discount_percent?`<small class="cell-sub">${item.discount_percent}% off</small>`:''}</td><td><span class="status-pill${item.active?'':' is-neutral'}">${item.active?'Published':'Draft'}</span></td><td><div class="commerce-row-actions"><button class="table-action" data-package="${item.id}">${can()?'Edit':'View'}</button>${can()?`<button class="table-action" data-grant="${item.id}">Grant to user</button>`:''}</div></td></tr>`).join(''),'No packages yet.'),can()?`<button class="btn btn-primary" data-new-package>Add package</button>`:'')+`<nav class="admin-pagination"><button class="btn btn-secondary" data-prev ${page<=1?'disabled':''}>Previous</button><span>Page ${page} of ${Math.max(1,Math.ceil(data.total/12))}</span><button class="btn btn-secondary" data-next ${page*12>=data.total?'disabled':''}>Next</button></nav>`;
      target.querySelector('[data-new-package]')?.addEventListener('click',()=>packageEditor());
      target.querySelectorAll('[data-package]').forEach(button=>button.onclick=()=>packageEditor(data.items.find(item=>item.id===Number(button.dataset.package))));
      target.querySelectorAll('[data-grant]').forEach(button=>button.onclick=()=>grant(data.items.find(item=>item.id===Number(button.dataset.grant))));
      target.querySelector('[data-prev]').onclick=()=>{page--;pricing();};target.querySelector('[data-next]').onclick=()=>{page++;pricing();};
    }else if(tab==='features'){
      const ruleLabels={free:'Unrestricted',package_only:'Package only',unlock:'Package or permanent unlock',per_use:'Package or tokens per use'};
      const groups=ReGenCommerce.featureGroups(data.prices).map(([name,features])=>`
        <section class="pricing-module">
          <h3>${safe(name)}</h3>
          <div class="pricing-module-rules">${features.map(item=>`
            <div class="pricing-rule"><div><strong>${safe(item.name)}</strong><span>${ruleLabels[item.mode]}${['unlock','per_use'].includes(item.mode)?' · '+count(item.cost)+' tokens':''}</span></div>
            ${item.key.startsWith('mochi_')?'<small>Managed in Packages</small>':`<button type="button" class="table-action" data-price="${safe(item.key)}">${can()?'Edit':'View'}</button>`}</div>`).join('')}</div>
        </section>`).join('');
      target.innerHTML=panel('Access & token rules','Choose how each module’s features can be used.',`<div class="pricing-modules">${groups}</div>`);
      target.querySelectorAll('[data-price]').forEach(button=>button.onclick=()=>priceEditor(data.prices[button.dataset.price]));
    }else{
      target.innerHTML=panel('Store presentation','Set Store visibility and the balance coin. Choose each offer’s layout and coin colour in its package settings.',`<form id="store-presentation"><div class="admin-form-grid">${field('Heading',`<input name="title" maxlength="100" value="${safe(data.policy.title)}" required>`,true)}${field('Short introduction (optional)',`<input name="description" maxlength="400" value="${safe(data.policy.description)}">`,true)}${field('Availability message (optional)',`<input name="notice" maxlength="300" value="${safe(data.policy.notice)}">`,true)}${field('Balance coin colour',`<select name="coinColor">${Object.entries(ReGenCommerce.colors).map(([value,label])=>`<option value="${value}"${(data.policy.coinColor||'emerald')===value?' selected':''}>${label}</option>`).join('')}</select>`,true)}<label class="control-check"><input type="checkbox" name="enabled"${data.policy.enabled?' checked':''}> Publish packages in the store</label><label class="control-check"><input type="checkbox" name="showOnLanding"${data.policy.showOnLanding?' checked':''}> Show packages on the landing page</label></div><div class="settings-save"><button class="btn btn-primary" type="submit">Save presentation</button></div></form>`);
      const form=target.querySelector('form');form.onsubmit=async event=>{event.preventDefault();if(await submit(form,'/api/admin/store/policy','PUT',{title:form.elements.title.value,description:form.elements.description.value,notice:form.elements.notice.value,enabled:form.elements.enabled.checked,showOnLanding:form.elements.showOnLanding.checked,coinColor:form.elements.coinColor.value,version:data.policy.version},'Presentation saved'))pricing();};
      if(!can())form.querySelectorAll('input,select,button').forEach(element=>element.disabled=true);
    }
    stamp();
  }

  const options = (values,current) => Object.entries(values).map(([value,label]) =>
    `<option value="${safe(value)}" ${current===value?'selected':''}>${safe(label)}</option>`).join('');
  const periods = {'7':'Last 7 days','30':'Last 30 days','90':'Last 90 days'};
  const environments = {live:'Live',sandbox:'Sandbox'};
  function renderPayments(target,data){
    const {paymentStatuses,paymentBadge,date}=ReGenCommerce;
    page=data.page;
    const maxPage=Math.max(1,Math.ceil(data.total/data.pageSize));
    const start=(page-1)*data.pageSize+1;
    const rows=data.items.map(item=>`<li>
      <div class="admin-payment-row">
        <div class="admin-payment-order"><strong>${safe(item.package)}</strong><time>${safe(date(item.createdAt))}</time>
          <code class="payment-reference">${safe(item.reference)}</code></div>
        <div class="admin-payment-account">${item.userId?'Account #'+Number(item.userId):'Account removed'}
          ${item.delivered?'<small>Package delivered</small>':''}</div>
        <div class="admin-payment-amount"><strong>${safe(money(item.amountMinor,item.currency))}</strong>
          ${item.refundedMinor?`<small>${safe(money(item.refundedMinor,item.currency))} refunded</small>`:''}</div>
        <div class="admin-payment-status">${paymentBadge(item.status)}<small>${safe(environments[item.mode])}</small></div>
      </div>
      <details class="admin-payment-details"><summary>Transaction details</summary>
        <dl>${item.paidAt?`<div><dt>Paid at</dt><dd>${safe(date(item.paidAt))}</dd></div>`:''}
          <div><dt>HitPay request</dt><dd>${safe(item.requestId||'Unavailable')}</dd></div>
          <div><dt>HitPay charge</dt><dd>${safe(item.chargeId||'Unavailable')}</dd></div>
        </dl>
      </details>
    </li>`).join('');
    target.innerHTML=panel('Payment history','Review payment status, package delivery and refunds.',
      `<form class="payment-filters admin-payment-filters" id="payment-search">
        <label>Search payments<input type="search" name="q" value="${safe(paymentFilters.q)}" maxlength="80" placeholder="Package name or order reference"></label>
        <label>Status<select name="status">${options({'':'All statuses',...paymentStatuses},paymentFilters.status)}</select></label>
        <label>Date range<select name="days">${options({'':'All time',...periods},paymentFilters.days)}</select></label>
        <label>Environment<select name="mode">${options({'':'All environments',...environments},paymentFilters.mode)}</select></label>
        <div class="payment-filter-actions"><button class="btn btn-primary" type="submit">Apply</button><button class="btn btn-secondary" type="button" data-clear-payments>Clear</button></div>
      </form>
      ${rows?`<div class="admin-payment-list"><div class="admin-payment-row admin-payment-columns" aria-hidden="true"><span>Order</span><span>Customer</span><span>Amount</span><span>Status</span></div><ol>${rows}</ol></div>
      <nav class="payment-pagination" aria-label="Payment pages"><span>${start}–${start+data.items.length-1} of ${data.total} orders</span>
      <div><button type="button" class="btn btn-secondary" data-prev ${page<=1?'disabled':''}>Previous</button><span>Page ${page} of ${maxPage}</span><button type="button" class="btn btn-secondary" data-next ${page>=maxPage?'disabled':''}>Next</button></div></nav>`
      :'<div class="token-empty"><h3>No payments found</h3><p>Try another search or adjust your filters.</p></div>'}`);
    target.querySelector('#payment-search').onsubmit=event=>{
      event.preventDefault();paymentFilters=Object.fromEntries(new FormData(event.currentTarget));page=1;pricing();
    };
    target.querySelector('[data-clear-payments]').onclick=()=>{
      paymentFilters={q:'',status:'',days:'',mode:''};page=1;pricing();
    };
    const prev=target.querySelector('[data-prev]'),next=target.querySelector('[data-next]');
    if(prev)prev.onclick=()=>{page--;pricing();};
    if(next)next.onclick=()=>{page++;pricing();};
  }

  function renderAnalytics(target,data){
    analyticsFilters.mode=data.mode;
    const totals=data.totals;
    const rate=totals.orders?Math.round(totals.paid*100/totals.orders):0;
    const cards=[
      ['Orders started',count(totals.orders)],
      ['Paid orders',count(totals.paid)],
      ['Unique buyers',count(totals.buyers)],
      ['Order completion',rate+'%'],
    ].map(([label,value])=>`<article class="pricing-kpi"><span>${label}</span><strong>${safe(value)}</strong></article>`).join('');
    const currencies=data.currencies.map(row=>`<article class="pricing-revenue"><h3>${safe(row.currency)}</h3>
      <dl><div><dt>Gross paid</dt><dd>${safe(money(row.gross,row.currency))}</dd></div>
      <div><dt>Refunds</dt><dd>${safe(money(row.refunds,row.currency))}</dd></div>
      <div><dt>Net after refunds</dt><dd>${safe(money(row.net,row.currency))}</dd></div></dl></article>`).join('');
    const peak=Math.max(1,...data.trend.map(day=>day.paid));
    const barWidth=600/data.trend.length;
    const bars=data.trend.map((day,index)=>{
      const height=Number(day.paid)/peak*112;
      return `<rect x="${index*barWidth+barWidth*.16}" y="${120-height}" width="${barWidth*.68}" height="${height}" rx="2">
        <title>${safe(day.day)} · ${count(day.paid)} paid</title></rect>`;
    }).join('');
    const dayLabel=day=>new Date(day+'T00:00:00Z').toLocaleDateString('en-MY',{day:'numeric',month:'short',timeZone:'UTC'});
    const rows=data.packages.map(item=>`<tr><td><strong>${safe(item.name)}</strong><small class="cell-sub">${safe(item.currency)}</small></td>
      <td>${count(item.paid)}</td><td>${safe(money(item.gross,item.currency))}</td>
      <td>${safe(money(item.refunds,item.currency))}</td><td>${safe(money(item.net,item.currency))}</td></tr>`).join('');
    target.innerHTML=panel('Package sales','Follow orders started in the selected period. Totals include refunds recorded to date.',
      `<form class="payment-filters pricing-period" id="pricing-period">
        <label>Date range<select name="days">${options(periods,analyticsFilters.days)}</select></label>
        <label>Environment<select name="mode">${options(environments,analyticsFilters.mode)}</select></label>
        <button class="btn btn-secondary" type="submit">Update</button>
      </form>
      <div class="pricing-kpis">${cards}</div>
      <div class="pricing-analytics-grid">
        <section class="pricing-trend"><h3>Paid orders by start date</h3>${totals.paid?`<svg class="pricing-trend-bars" viewBox="0 0 600 120" preserveAspectRatio="none" role="img" aria-label="${count(totals.paid)} paid orders, with a peak of ${count(peak)} in one day">
          <path d="M0 20h600M0 70h600M0 119h600"/>${bars}</svg>
          <div class="pricing-trend-labels"><span>${safe(dayLabel(data.trend[0].day))}</span><span>${safe(dayLabel(data.trend.at(-1).day))}</span></div>`
        :'<p>No paid orders in this period.</p>'}</section>
        <section class="pricing-money"><h3>Revenue by currency</h3>
          ${currencies||'<p>Revenue appears after the first confirmed payment.</p>'}
          ${totals.refunded?`<p>${count(totals.refunded)} ${totals.refunded===1?'order':'orders'} with refunds</p>`:''}</section>
      </div>
      <section class="pricing-package-results"><h3>Top packages</h3>${table(['Package','Paid orders','Gross paid','Refunds','Net after refunds'],rows,'No package sales in this period.')}</section>`);
    target.querySelector('#pricing-period').onsubmit=event=>{
      event.preventDefault();analyticsFilters=Object.fromEntries(new FormData(event.currentTarget));pricing();
    };
  }
  function packageEditor(item=null){
    const d=item||{name:'',description:'',tokens:0,bonus_tokens:0,price_minor:3000,currency:'MYR',badge:'',highlighted:false,active:false,sort_order:10,features:{},validity_days:30,promotion_motion:'none'};
    const modal=dialog(item?'Edit package':'Create package',`<div class="package-editor-layout"><div><div class="admin-form-grid">${field('Package name',`<input name="name" maxlength="80" value="${safe(d.name)}" placeholder="ReGen 30" required>`,true)}${field('Package type',`<select name="packageType"><option value="features">Feature package</option><option value="tokens">Token bundle</option><option value="mixed">Features + token bundle</option></select>`,true)}${field('Short description',`<input name="description" maxlength="300" value="${safe(d.description)}">`,true)}${field('Price',`<input name="price" type="number" min="0" max="1000000" step="0.01" value="${(d.price_minor/100).toFixed(2)}" required>`)}${field('Currency',`<select name="currency">${['MYR','USD','SGD'].map(c=>`<option ${d.currency===c?'selected':''}>${c}</option>`).join('')}</select>`)}${field('Store layout',`<select name="cardLayout"><option value="hero"${d.card_layout!=='row'?' selected':''}>Hero card</option><option value="row"${d.card_layout==='row'?' selected':''}>One-line offer</option></select>`)}${field('Package coin colour',`<select name="coinColor">${Object.entries(ReGenCommerce.colors).map(([value,label])=>`<option value="${value}"${(d.coin_color||'emerald')===value?' selected':''}>${label}</option>`).join('')}</select>`)}${field('Feature validity (days)',`<input name="validityDays" type="number" min="1" max="3650" value="${d.validity_days||''}" placeholder="No expiry">`)}${field('Display order',`<input name="sortOrder" type="number" min="0" max="100000" value="${d.sort_order}" required>`)}</div><fieldset class="package-feature-picker"><legend>Included features</legend><p class="commerce-help">Only checked benefits are issued. Limits stop access unless the feature rule explicitly allows token fallback.</p><button class="btn btn-secondary" type="button" data-resume-essentials>Add resume essentials</button>${ReGenCommerce.featureGroups(catalogue.prices).map(([name,features])=>`<div class="package-feature-group"><h4>${safe(name)}</h4>${features.map(price=>`<div class="package-feature-option"><label><input type="checkbox" name="feature_${price.key}" ${Object.hasOwn(d.features,price.key)?'checked':''}><span>${safe(price.name)}</span></label>${price.packageMetered?`<div class="package-usage-control"><label><span class="sr-only">${safe(price.name)} allowance</span><select name="allowance_${price.key}" aria-label="${safe(price.name)} allowance"><option value="limited"${d.features[price.key]!==null?' selected':''}>Limited</option><option value="unlimited"${d.features[price.key]===null?' selected':''}>Unlimited</option></select></label><label><span class="sr-only">${safe(price.name)} limit</span><input name="uses_${price.key}" type="number" min="1" max="10000" value="${d.features[price.key]||10}" aria-label="${safe(price.name)} included uses"><span>${price.key==='templates'?'designs':'uses'}</span></label></div>`:'<span class="package-access-tag">Access</span>'}</div>`).join('')}</div>`).join('')}</fieldset><fieldset class="package-template-tiers"><legend>Template collections</legend>${[['basic','Basic'],['premium','Premium']].map(([key,label])=>`<label><input type="checkbox" name="tier_${key}"${(d.template_tiers||['basic','premium']).includes(key)?' checked':''}> ${label}</label>`).join('')}<p class="commerce-help">The limit counts distinct designs unlocked. Switching between unlocked designs is free.</p></fieldset><details class="commerce-options" data-package-tokens${d.tokens||d.bonus_tokens?' open':''}><summary>Include saved tokens</summary><div class="admin-form-grid">${field('Tokens',`<input name="tokens" type="number" min="0" max="10000" value="${d.tokens}" required>`)}${field('Bonus tokens',`<input name="bonusTokens" type="number" min="0" max="10000" value="${d.bonus_tokens}" required>`)}</div><p class="commerce-help">Saved tokens do not expire. Feature validity applies to the included features.</p></details><details class="commerce-options"${d.badge||d.compare_price_minor||d.offer_headline?' open':''}><summary>Offer copy, discounts &amp; effects</summary><div class="admin-form-grid">${field('Hero headline',`<input name="offerHeadline" maxlength="100" value="${safe(d.offer_headline||'')}" placeholder="e.g. Prepare your complete application">`,true)}${field('View offer button',`<input name="offerCta" maxlength="40" value="${safe(d.offer_cta||'')}" placeholder="View package">`,true)}${field('Badge',`<input name="badge" maxlength="30" value="${safe(d.badge)}" placeholder="Launch offer">`)}${field('Original price (optional)',`<input name="comparePrice" type="number" min="0.01" max="1000000" step="0.01" value="${d.compare_price_minor?(d.compare_price_minor/100).toFixed(2):''}" placeholder="e.g. 45.00">`)}${field('Promotion starts',`<input name="promotionStartsAt" type="datetime-local" value="${localDate(d.promotion_starts_at)}">`)}${field('Promotion ends',`<input name="promotionEndsAt" type="datetime-local" value="${localDate(d.promotion_ends_at)}">`)}${field('Animation',`<select name="promotionMotion">${[['none','None'],['glow','Soft glow'],['shine','Slow shine']].map(([v,label])=>`<option value="${v}"${d.promotion_motion===v?' selected':''}>${label}</option>`).join('')}</select>`)}</div><p class="commerce-help">Dates use your local time. The original price returns when the offer ends. Motion respects reduced-motion preferences.</p></details><details class="commerce-options"${d.claim_enabled?' open':''}><summary>Free claim offer</summary><label class="control-check"><input type="checkbox" name="claimEnabled"${d.claim_enabled?' checked':''}> Allow one free claim per verified account</label><div class="admin-form-grid" data-claim-settings>${field('Claim period starts',`<input name="claimStartsAt" type="datetime-local" value="${localDate(d.claim_starts_at)}">`)}${field('Claim period ends',`<input name="claimEndsAt" type="datetime-local" value="${localDate(d.claim_ends_at)}">`)}${field('Total accounts that can claim',`<input name="claimLimit" type="number" min="1" max="1000000" value="${d.claim_limit||''}">`,true)}</div><p class="commerce-help">${Number(d.claim_count||0).toLocaleString()} claimed. One claim per account for this package, including later claim periods. Create a new package for a new giveaway.</p></details><div class="commerce-checks"><label><input type="checkbox" name="landingVisible"${d.landing_visible!==false?' checked':''}> Show this package on the landing page</label><label><input type="checkbox" name="highlighted"${d.highlighted?' checked':''}> Feature this package</label><label><input type="checkbox" name="active"${d.active?' checked':''}> Publish package</label></div></div><aside><h3>Store preview</h3><p class="commerce-help">${item?'Changes apply to new grants. Adjust existing users in User accounts → Packages.':''}</p><div class="package-readiness" role="status"></div><div class="package-live-preview"></div><p class="commerce-help">${catalogue.checkoutMode ? (catalogue.checkoutMode==='sandbox' ? 'HitPay sandbox is enabled.' : 'Live HitPay checkout is enabled.') : 'HitPay checkout is currently disabled.'}</p></aside></div>`,async(form,close)=>{
      const body=read(form);if(await submit(form,item?'/api/admin/store/packages/'+item.id:'/api/admin/store/packages',item?'PUT':'POST',{...body,...(item?{version:item.version}:{})},'Package saved')){close();pricing();}
    },'Save package');
    modal.classList.add('package-editor-dialog');const form=modal.querySelector('form');
    const visibilityTools=['ai_assist','ai_refine','ai_review','ai_cover_letter'];
    form.querySelector('.package-template-tiers').before(Object.assign(document.createElement('fieldset'),{
      className:'package-template-tiers package-tool-visibility',
      innerHTML:`<legend>Hide unavailable tools</legend><p class="commerce-help">Hide selected tools in the workspace when this customer has no access. Access from another package or a public rule still applies.</p>${visibilityTools.map(key=>`<label><input type="checkbox" name="hide_${key}" ${(d.hide_unavailable_tools||[]).includes(key)?'checked':''}> ${safe(catalogue.prices[key]?.name||key)}</label>`).join('')}`,
    }));
    form.elements.packageType.value=Object.keys(d.features).length?(d.tokens+d.bonus_tokens?'mixed':'features'):(d.tokens+d.bonus_tokens?'tokens':'features');
    function read(form){
      const e=form.elements,features={};
      for(const price of Object.values(catalogue.prices))if(e.packageType.value!=='tokens'&&e['feature_'+price.key].checked)features[price.key]=price.packageMetered&&e['allowance_'+price.key].value!=='unlimited'?Number(e['uses_'+price.key].value):null;
      return {name:e.name.value,offerHeadline:e.offerHeadline.value,offerCta:e.offerCta.value,description:e.description.value,priceMinor:Math.round(Number(e.price.value)*100),currency:e.currency.value,cardLayout:e.cardLayout.value,coinColor:e.coinColor.value,validityDays:e.validityDays.value?Number(e.validityDays.value):null,sortOrder:Number(e.sortOrder.value),features,hideUnavailableTools:visibilityTools.filter(key=>e['hide_'+key].checked),templateTiers:Object.hasOwn(features,'templates')?['basic','premium'].filter(key=>e['tier_'+key].checked):['basic','premium'],tokens:e.packageType.value==='features'?0:Number(e.tokens.value),bonusTokens:e.packageType.value==='features'?0:Number(e.bonusTokens.value),badge:e.badge.value,comparePriceMinor:e.comparePrice.value?Math.round(Number(e.comparePrice.value)*100):null,promotionStartsAt:utc(e.promotionStartsAt.value),promotionEndsAt:utc(e.promotionEndsAt.value),promotionMotion:e.promotionMotion.value,highlighted:e.highlighted.checked,active:e.active.checked,landingVisible:e.landingVisible.checked,claimEnabled:e.claimEnabled.checked,claimStartsAt:utc(e.claimStartsAt.value),claimEndsAt:utc(e.claimEndsAt.value),claimLimit:e.claimLimit.value?Number(e.claimLimit.value):null};
    }
    const preview=()=>{
      const type=form.elements.packageType.value;
      form.querySelector('.package-feature-picker').hidden=type==='tokens';
      form.querySelector('[data-package-tokens]').hidden=type==='features';
      for(const key of ['tokens','bonusTokens'])form.elements[key].disabled=type==='features'||!can();
      form.elements.validityDays.disabled=type==='tokens'||!can();
      for(const price of Object.values(catalogue.prices)){const input=form.elements['uses_'+price.key];if(input){const enabled=type!=='tokens'&&form.elements['feature_'+price.key].checked;const allowance=form.elements['allowance_'+price.key];allowance.disabled=!enabled||!can();input.disabled=!enabled||allowance.value==='unlimited'||!can();input.closest('label').hidden=allowance.value==='unlimited';input.required=enabled&&allowance.value!=='unlimited';}}
      form.querySelector('.package-template-tiers:not(.package-tool-visibility)').hidden=type==='tokens'||!form.elements.feature_templates.checked;
      form.querySelector('.package-tool-visibility').hidden=type==='tokens';
      const claims=form.elements.claimEnabled.checked;form.querySelector('[data-claim-settings]').hidden=!claims;for(const key of ['claimStartsAt','claimEndsAt','claimLimit']){form.elements[key].required=claims;form.elements[key].disabled=!claims||!can();}
      const b=read(form);const dependencies=new Set();const include=key=>{for(const required of catalogue.prices[key].requires||[])if(!Object.hasOwn(b.features,required)&&!dependencies.has(required)){dependencies.add(required);include(required);}};Object.keys(b.features).forEach(include);const missing=[...dependencies];modal.querySelector('.package-readiness').innerHTML=missing.length?'<p>Also needed to use these actions: '+missing.map(key=>safe(catalogue.prices[key].name)).join(', ')+'. Add it here or supply it through another active package.</p><button class="btn btn-secondary" type="button" data-add-supporting>Add supporting access</button>':'';modal.querySelector('[data-add-supporting]')?.addEventListener('click',()=>{missing.forEach(key=>{form.elements['feature_'+key].checked=true;if(key==='templates'){form.elements.allowance_templates.value='limited';form.elements.uses_templates.value='1';form.elements.tier_basic.checked=true;form.elements.tier_premium.checked=false;}});preview();});const now=Date.now(),active=(!b.promotionStartsAt||Date.parse(b.promotionStartsAt)<=now)&&(!b.promotionEndsAt||Date.parse(b.promotionEndsAt)>now);
      modal.querySelector('.package-live-preview').innerHTML=ReGenCommerce.card({...d,...b,name:b.name||'Your package',offer_headline:b.offerHeadline,offer_cta:b.offerCta,price_minor:b.priceMinor,display_price_minor:!active&&b.comparePriceMinor?b.comparePriceMinor:b.priceMinor,compare_price_minor:b.comparePriceMinor,bonus_tokens:b.bonusTokens,validity_days:b.validityDays,template_tiers:b.templateTiers,card_layout:b.cardLayout,coin_color:b.coinColor,claim:{enabled:b.claimEnabled,state:!b.claimEnabled?'disabled':!b.active||!b.claimStartsAt||!b.claimEndsAt?'unavailable':now<Date.parse(b.claimStartsAt)?'upcoming':now>=Date.parse(b.claimEndsAt)?'ended':(b.claimLimit||0)<=(d.claim_count||0)?'full':'available',limit:b.claimLimit||0,remaining:Math.max(0,(b.claimLimit||0)-(d.claim_count||0)),startsAt:b.claimStartsAt,endsAt:b.claimEndsAt?b.claimEndsAt.replace('T',' ').slice(0,19):null},promotion_active:active,promotion_motion:b.promotionMotion,promotion_ends_at:b.promotionEndsAt?b.promotionEndsAt.replace('T',' ').slice(0,19):null,discount_percent:active&&b.comparePriceMinor>b.priceMinor?Math.round(100*(1-b.priceMinor/b.comparePriceMinor)):0},catalogue.prices);
      modal.querySelectorAll('.package-live-preview button').forEach(button=>button.disabled=true);
    };
    form.querySelector('[data-resume-essentials]').onclick=()=>{for(const key of ['resume_create','resume_editor','document_preview','document_settings','templates','pdf_download']){const checkbox=form.elements['feature_'+key];if(!checkbox.checked){checkbox.checked=true;if(form.elements['uses_'+key]){form.elements['allowance_'+key].value='limited';form.elements['uses_'+key].value='1';}if(key==='templates'){form.elements.tier_basic.checked=true;form.elements.tier_premium.checked=false;}}}preview();};form.addEventListener('input',preview);form.addEventListener('change',preview);preview();
    if(!can())form.querySelectorAll('input,textarea,select,[type=submit]').forEach(element=>element.disabled=true);
  }
  function grant(item){
    const reference=crypto.randomUUID();
    const modal=dialog('Grant '+item.name,`<div class="admin-note">${item.validity_days?'Included features expire '+item.validity_days+' days after this grant.':'Included features have no expiry.'} This grants real usage benefits without taking payment.</div><div class="admin-form-grid">${field('Find account','<input name="accountSearch" type="search" placeholder="Search name or email" autocomplete="off">',true)}${field('User account','<select name="userId" required><option value="">Search for an account</option></select>',true)}${field('Reason','<input name="reason" maxlength="300" value="Package testing" required>',true)}</div>`,async(form,close)=>{if(await submit(form,'/api/admin/store/packages/'+item.id+'/grant','POST',{userId:Number(form.elements.userId.value),reason:form.elements.reason.value,reference,version:item.version},'Package granted')){close();pricing();}},'Grant package');
    const form=modal.querySelector('form');let timer,generation=0;
    form.elements.accountSearch.oninput=()=>{clearTimeout(timer);const search=form.elements.accountSearch.value.trim(),token=++generation;form.elements.userId.innerHTML='<option value="">'+(search.length<2?'Enter at least two characters':'Searching…')+'</option>';if(search.length<2)return;timer=setTimeout(async()=>{const result=await api('/api/admin/store/accounts?search='+encodeURIComponent(search));if(token!==generation||!modal.isConnected)return;form.elements.userId.innerHTML='<option value="">'+(result.success&&result.items.length?'Choose account':'No matching accounts')+'</option>'+(result.items||[]).map(user=>`<option value="${Number(user.id)}">${safe(user.first_name+' '+user.last_name+' · '+user.email)}</option>`).join('');},220);};
    modal.addEventListener('close',()=>clearTimeout(timer),{once:true});
  }
  function priceEditor(item){
    const modal=dialog(item.name,`<div class="admin-form-grid">${field('Access rule',`<select name="mode"><option value="package_only">Package only · strict limits</option>${item.perUseAllowed?'<option value="per_use">Package + tokens per successful action</option>':''}${!item.perUseAllowed||item.mode==='unlock'?'<option value="unlock">Package + permanent token unlock</option>':''}<option value="free">Everyone · unrestricted free access</option></select>`,true)}${field('Fallback token cost','<input name="cost" type="number" min="1" max="10000" required>',true)}</div><p class="commerce-help" data-access-help></p><label class="control-check" data-public-confirm hidden><input type="checkbox" name="publicConfirmed"> Allow every account to use this feature without a package or usage limit</label>`,async(form,close)=>{const mode=form.elements.mode.value;if(mode==='free'&&!form.elements.publicConfirmed.checked)return;if(await submit(form,'/api/admin/pricing/'+item.key,'PUT',{mode,cost:mode==='free'?0:mode==='package_only'?item.cost:Number(form.elements.cost.value),version:item.version},'Feature access rule updated')){close();pricing();}},'Save access rule');
    const form=modal.querySelector('form');form.elements.mode.value=item.mode;form.elements.cost.value=item.cost||1;
    const refresh=()=>{const mode=form.elements.mode.value;form.elements.publicConfirmed.required=mode==='free';form.elements.cost.disabled=['free','package_only'].includes(mode)||!can();modal.querySelector('[data-public-confirm]').hidden=mode!=='free';modal.querySelector('[data-access-help]').textContent=mode==='package_only'?'An active package must include this feature. When its allowance is used up, access stops. Base tokens, saved tokens and old individual unlocks cannot bypass this rule.':mode==='per_use'?'Included package uses are consumed first. Then each successful action uses the configured token price. AI uses base tokens before saved tokens.':mode==='unlock'?'Package access applies first. An individual permanent unlock remains usable outside a package, without package limits.':'This explicitly removes package restrictions for this feature. All accounts receive unlimited free access.';};form.elements.mode.onchange=refresh;refresh();
    if(!can())form.querySelectorAll('input,select,[type=submit]').forEach(element=>element.disabled=true);
  }
  return {pricing,store:pricing};
};
