window.ReGenCommerce=(()=>{
  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const locale = () => window.ReGenText?.locale || 'en-MY';
  const storeText = (key, fallback) => window.ReGenText?.get('store.' + key, fallback) ?? fallback;
  const text = (key, fallback, fields = {}) => (window.ReGenText?.get('commerce.' + key, fallback) ?? fallback)
    .replace(/\{([a-z]+)\}/g, (match, field) => fields[field] ?? match);
  const number=value=>Number(value||0).toLocaleString(locale());
  const date=value=>value?new Date(value.replace(' ','T')+(value.endsWith('Z')?'':'Z')).toLocaleString(locale(),{timeZone:'Asia/Kuala_Lumpur',dateStyle:'medium',timeStyle:'short'}):'';
  const money=(amount,currency)=>new Intl.NumberFormat(locale(),{style:'currency',currency}).format(amount/100);
  const paymentStatuses={
    paid:'Paid',pending:'Awaiting payment',creating:'Opening checkout',failed:'Payment failed',
    refunded:'Refunded',partially_refunded:'Partially refunded',unavailable:'Checkout unavailable',link_expired:'Checkout link expired',
  };
  const paymentBadge=status=>`<span class="payment-badge" data-state="${safe(status)}">${safe(paymentStatuses[status]||'Unknown')}</span>`;
  const colors={emerald:'Emerald',gold:'Gold',sapphire:'Sapphire',amethyst:'Amethyst',rose:'Rose',slate:'Slate'};let serial=0;
  const color=value=>Object.hasOwn(colors,value)?value:'emerald';
  const coin=(size='small',tint='emerald')=>`<span class="regen-coin coin-${['small','medium','large'].includes(size)?size:'small'} coin-${color(tint)}" aria-hidden="true"><svg viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="27"/><circle cx="32" cy="32" r="23"/><path class="coin-mark" d="M23 44V20m0 15 17-15M30 30l12 14"/><path d="M32 2v4m0 52v4M2 32h4m52 0h4M11 11l3 3m36 36 3 3m0-42-3 3M14 50l-3 3"/></svg></span>`;
  function balance(value, {activity = false, compact = false} = {}) {
    const renewal = value.renewable
      ? value.resetAt ? text('renews', 'Renews {date}', {date:date(value.resetAt)})
        : text('renewPeriod', 'Renews every {hours} hours', {hours:number(value.renewalHours)})
      : text('noRenewal', 'No automatic renewal');
    const heading = text('wallet', 'Coin balance');
    const breakdown = `<dl class="token-balance-parts">
        <div><dt>${safe(text('base', 'Base Coin'))}<span>${safe(text('aiUse', 'For AI actions'))}</span></dt><dd>${number(value.base)}</dd><p>${safe(renewal)}</p></div>
        <div><dt>${safe(text('saved', 'Bonus & saved Coin'))}<span>${safe(text('priced', 'For any priced feature'))}</span></dt><dd>${number(value.bonus)}</dd><p>${safe(text('noExpiry', 'No expiry'))}</p></div>
      </dl>
      ${value.reserved ? `<p class="token-reserved">${safe(text('reserved', '{count} Coin reserved for actions in progress', {count:number(value.reserved)}))}</p>` : ''}`;
    return `<section class="token-wallet${compact?' token-wallet-compact':''}" aria-label="${safe(heading)}">
      <div class="token-wallet-heading">
        <div class="token-wallet-title">${coin('large',value.coinColor)}<div><h2>${safe(heading)}</h2>
          <p><strong>${number(value.total)}</strong> ${safe(text('balanceAvailable', 'available'))}</p></div></div>
        ${activity || compact ? '' : `<a class="btn btn-secondary" href="#package-offers">${safe(window.ReGenText.get('store.explore'))}</a>`}
      </div>
      ${compact?`<details class="store-wallet-breakdown"><summary>${safe(storeText('walletDetails', 'Balance breakdown'))}</summary>${breakdown}</details>`:breakdown}
    </section>`;
  }
  function card(item,prices={},publicView=false,options={}){
    const promotion=item.promotion_active,claim=item.claim||{enabled:false},isClaim=claim.enabled;
    const featureCount=Object.keys(item.features||{}).length,tokens=Number(item.tokens||0)+Number(item.bonus_tokens||0);
    const features = Object.entries(item.features || {}).map(([key, uses]) => {
      if (key === 'templates') {
        const label = uses === null ? text('templateUnlimited', 'Unlimited template unlocks')
          : uses === 1 ? text('templateOne', '1 template unlock') : text('templateCount', '{count} template unlocks', {count:number(uses)});
        const tiers = (item.template_tiers || ['basic', 'premium'])
          .map(tier => tier === 'basic' ? text('basic', 'Basic') : text('premium', 'Premium')).join(' + ');
        return `<li><span aria-hidden="true">✓</span>${safe(label)} · ${safe(tiers)}</li>`;
      }
      const cap = uses === null ? (prices[key]?.packageMetered ? text('unlimited', 'Unlimited') + ' ' : '') : number(uses) + ' × ';
      return `<li><span aria-hidden="true">✓</span>${safe(cap + (prices[key]?.name || key.replaceAll('_',' ')))}</li>`;
    });
    if (tokens) {
      const saved = text('savedCount', '{count} saved Coin', {count:number(tokens)});
      const bonus = text('bonusCount', '{base} Coin + {bonus} bonus', {base:number(item.tokens),bonus:number(item.bonus_tokens)});
      features.unshift(`<li><span aria-hidden="true">✓</span><div><strong>${safe(saved)}</strong>${item.bonus_tokens ? '<small>' + safe(bonus) + '</small>' : ''}</div></li>`);
    }
    const benefits=`<ul class="token-package-benefits">${features.join('')}</ul>`;
    const states={claimed:'Claimed',upcoming:'Opens '+date(claim.startsAt),ended:'Claim period ended',full:'Fully claimed',unavailable:'Claims paused',disabled:'Claims paused'};
    const detail=options?.detail===true;
    const purchased=!publicView&&item.has_purchase;
    const ownedLabel=!publicView&&item.active_grant?'Active package':purchased?'Purchased':'';
    const owned=ownedLabel?`<span class="token-package-owned"><span aria-hidden="true">✓</span> ${ownedLabel}</span>`:'';
    const cta=safe(purchased?'Buy again':item.offer_cta||text('view', 'View package'));
    const payAction = options.checkoutAvailable && Number(item.display_price_minor) >= 30
      ? `<button class="btn btn-primary" type="button" data-start-checkout>${safe(storeText('checkout', 'Continue to payment'))}</button>`
      : `<p class="token-checkout-state">${safe(storeText('checkoutUnavailable', 'Checkout is currently unavailable.'))}</p>`;
    const action=isClaim?(claim.state==='available'?(publicView?'<a class="btn btn-primary" href="/store">Claim free package ↗</a>':`<button class="btn btn-primary" type="button" data-claim-package="${Number(item.id)}" data-package-version="${Number(item.version)}">Claim free package</button>`):`<button class="btn btn-secondary" type="button" disabled>${safe(states[claim.state]||'Unavailable')}</button>`):(publicView?`<a class="btn btn-primary" href="/store">${cta} ↗</a>`:detail?payAction:`<button class="btn btn-secondary" type="button" data-view-package="${Number(item.id)}">${cta}</button>`);
    const badge=isClaim?'<span class="token-package-badge">Free claim</span>':promotion&&(item.badge||item.discount_percent)?`<span class="token-package-badge">${safe(item.badge||'Save '+item.discount_percent+'%')}</span>`:'';
    const amount=`${!isClaim&&item.discount_percent?`<s>${safe(money(item.compare_price_minor,item.currency))}</s>`:''}<strong>${isClaim?safe(text('free', 'Free')):safe(money(item.display_price_minor,item.currency))}</strong>`;
    const validity = featureCount ? (item.validity_days
      ? text('featureDays', 'Feature access for {days} days', {days:number(item.validity_days)})
      : text('noFeatureExpiry', 'Feature access with no expiry')) : text('noTokenExpiry', 'No expiry for saved Coin');
    const offerEnd=isClaim?claim.endsAt&&claim.state==='available'?claim.endsAt:null:promotion?item.promotion_ends_at:null;
    const end=offerEnd?`<p class="token-promotion-end" data-promotion-end="${safe(offerEnd)}">Offer ends ${safe(date(offerEnd))}</p>`:'';
    const capacity=isClaim?`<span class="token-claim-capacity">${number(claim.remaining)} of ${number(claim.limit)} claims left</span>`:'';
    const motion=promotion&&['glow','shine'].includes(item.promotion_motion)?' motion-'+item.promotion_motion:'';
    if(item.card_layout==='row'){
      const detailId='offer-details-'+(++serial);
      return `<article class="token-offer-row${item.highlighted?' is-highlighted':''}${motion}"><div class="offer-row-identity">${coin('small',item.coin_color)}<div><h3>${safe(item.name)} ${badge}</h3>${owned}<p>${tokens?safe(text('savedCount', '{count} saved Coin', {count:number(tokens)})):safe(storeText('includedFeatures', '{count} included features').replace('{count}',number(featureCount)))}${featureCount&&tokens?' · '+number(featureCount)+' features':''}</p></div></div><div class="offer-row-price">${amount}</div><button class="offer-detail-toggle" type="button" data-offer-detail="${detailId}" aria-expanded="false" aria-controls="${detailId}" aria-label="Details for ${safe(item.name)}">Details</button><div class="offer-row-action">${action}</div>${isClaim?`<div class="offer-row-availability">${capacity}${end}</div>`:''}<div class="offer-row-details" id="${detailId}" hidden>${item.description?'<p>'+safe(item.description)+'</p>':''}${benefits}<p class="token-package-validity">${safe(validity)}</p>${!isClaim?end:''}</div></article>`;
    }
    const has=key=>Object.hasOwn(item.features||{},key);
    const headline=item.offer_headline||(has('cover_letters')&&has('resume_editor')?'Build your resume and cover letter':has('cover_letters')?'Prepare your next cover letter':has('pdf_download')?'Get more PDF downloads':has('ai_assist')||has('ai_refine')?'Get help writing your resume':item.name);
    return `<article class="token-package package-showcase${item.highlighted?' is-highlighted':''}${motion}${isClaim?' is-claim':''}"><div class="token-package-top">${coin('medium',item.coin_color)}<div class="token-package-markers">${owned}${badge}</div></div><h3>${safe(headline)}</h3>${headline!==item.name?`<p class="token-offer-name">${safe(item.name)}</p>`:''}${item.description?`<p class="token-package-description">${safe(item.description)}</p>`:''}<div class="token-package-price">${amount}<span>${safe(isClaim ? text('singleClaim', 'One claim per account') : text('oneTime', 'One-time package'))}</span></div>${benefits}<p class="token-package-validity">${safe(validity)}</p>${capacity}${end}${action}</article>`;
  }
  function featureGroups(prices) {
    const groups = [
      ['Resume workspace',['resume_create','resume_editor','templates','photo_upload','resume_rename','document_settings']],
      ['Cover letter workspace',['cover_letters','cover_letter_create']],
      ['Coaching and AI writing',['mochi_play','mochi_chat','mochi_coach','ai_assist','ai_refine','ai_review','ai_cover_letter']],
      ['Preview and export',['document_preview','pdf_download']]
    ];
    return groups.map(([name,keys])=>[name,keys.map(key=>prices[key]).filter(Boolean)]).filter(([,features])=>features.length);
  }
  function label(price,{aiCost}={}){
    if(!price)return '';if(price.packageUnlocked)return price.packageUnlimited?'Unlimited':'Included';if(price.packageUses>0)return 'Included · '+number(price.packageUses)+' left';if(price.mode==='package_only')return price.packageIncluded?(price.key==='templates'?'No new unlocks':'Limit reached'):'Package required';if(price.unlocked)return 'Unlocked';if(price.mode==='free')return 'Free';if(price.credits>0)return 'Prepaid · '+number(price.credits)+' left';const cost=aiCost??price.cost;return number(cost)+' '+'Coin'+(price.mode==='unlock'?' to unlock':'');
  }
  function tickPromotions(){document.querySelectorAll('[data-promotion-end]').forEach(element=>{const left=Math.max(0,Date.parse(element.dataset.promotionEnd.replace(' ','T')+'Z')-Date.now()),minutes=Math.floor(left/60000),days=Math.floor(minutes/1440),hours=Math.floor(minutes%1440/60),text=left?`Offer ends in ${days?days+'d ':''}${hours}h ${minutes%60}m`:'Offer ended';if(element.textContent!==text)element.textContent=text;if(!left&&!element.dataset.ended){element.dataset.ended='true';window.dispatchEvent(new CustomEvent('regen:promotion-ended'));}});}
  document.addEventListener('DOMContentLoaded',()=>{tickPromotions();const timer=setInterval(tickPromotions,10000);window.addEventListener('pagehide',()=>clearInterval(timer));document.body.addEventListener('click',event=>{const button=event.target.closest('[data-offer-detail]');if(!button)return;const details=button.closest('.token-offer-row')?.querySelector('.offer-row-details');if(details){details.hidden=!details.hidden;button.setAttribute('aria-expanded',String(!details.hidden));}});});
  return {safe,number,date,money,colors,coin,balance,card,label,featureGroups,paymentStatuses,paymentBadge};
})();
