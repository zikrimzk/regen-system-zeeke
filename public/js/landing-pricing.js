document.addEventListener('DOMContentLoaded', () => {
  const host = document.getElementById('landing-pricing');
  if (!host) return;
  const preview = host.closest('[data-pricing-preview]');
  let previewVisible = false;
  const status = document.getElementById('pricing-state');
  const {safe, number, date, money} = ReGenCommerce;
  const retry = document.querySelector('[data-pricing-retry]');
  const copy = (key, value) => ReGenText.get('commercial.' + key).replace('{value}', String(value ?? ''));
  const categories = {
    groupDocuments: {resume_create:'fNewResume', resume_editor:'fResume', templates:'fTemplates', cover_letters:'fCover',
      cover_letter_create:'fNewCover', document_preview:'fPreview', pdf_download:'fPdf', photo_upload:'fPhoto',
      resume_rename:'fRename', document_settings:'fAppearance'},
    groupWriting: {ai_assist:'fAssist', ai_refine:'fRefine', ai_review:'fReview', ai_cover_letter:'fLetterAI'},
    groupMochi: {mochi_coach:'fMochiCoach', mochi_chat:'fMochiChat', mochi_play:'fMochiPlay'},
  };
  const labels = Object.assign({}, ...Object.values(categories));
  const featureName = (key, prices) => labels[key] ? copy(labels[key]) : prices[key]?.name || key.replaceAll('_',' ');
  const savedTokens = plan => Number(plan.tokens ?? 0) + Number(plan.bonus_tokens ?? 0);
  const validity = plan => plan.validity_days ? copy('planDays', number(plan.validity_days)) : copy('planForever');
  const claimStates = {full:'planFull', ended:'planExpired', upcoming:'planUpcoming'};
  let scheduledRefresh;
  let carouselObserver;
  let previewObserver;

  function inclusion(plan, key, prices) {
    const features = plan.features || {};
    if (!Object.hasOwn(features, key)) return copy('planNotIncluded');
    const uses = features[key];
    const value = uses === null ? copy(prices[key]?.packageMetered ? 'planUnlimited' : 'planIncluded') : copy(Number(uses) === 1 ? 'planUse' : 'planUses',number(uses));
    if (key !== 'templates') return value;
    const tiers = (plan.template_tiers || []).map(tier => copy(tier === 'premium' ? 'planPremium' : 'planBasic'));
    return [value, ...tiers].join(' · ');
  }

  function card(plan, prices) {
    const claim = plan.claim?.enabled === true;
    const available = plan.claim?.state === 'available';
    const discount = plan.promotion_active && !claim && plan.discount_percent > 0;
    const end = claim ? (available ? plan.claim.endsAt : null) : (discount ? plan.promotion_ends_at : null);
    const name = safe(plan.name);
    const amount = claim ? copy('planFree') : money(plan.display_price_minor,plan.currency);
    const tag = discount ? `<span class="plan-promo">${safe(plan.badge || copy('planSave',plan.discount_percent))}</span>` : '';
    const strike = discount && plan.compare_price_minor != null ? `<s>${safe(money(plan.compare_price_minor,plan.currency))}</s>` : '';
    const actionLabel = claim ? copy('planClaimAction') : (plan.offer_cta || copy('planContinue'));
    const action = !claim || available ? `<a class="product-button" href="/store" aria-label="${safe(actionLabel+' · '+plan.name)}">${safe(actionLabel)} <span aria-hidden="true">↗</span></a>`
      : `<p class="plan-action-disabled">${safe(copy(claimStates[plan.claim.state] || 'planClosed',date(plan.claim.startsAt)))}</p>`;
    const benefits = Object.keys(plan.features || {}).map(key => featureName(key,prices)+' · '+inclusion(plan,key,prices));
    if (savedTokens(plan)) benefits.unshift(number(savedTokens(plan))+' '+copy('planToken'));
    return `<article class="commercial-plan token-package${plan.highlighted ? ' is-highlighted' : ''}" data-plan-id="${Number(plan.id)}">
      <div class="plan-identity"><h3>${name}</h3>${plan.description ? '<p>'+safe(plan.description)+'</p>' : ''}</div>
      <div class="plan-value">${tag}<div class="plan-amount">${strike}<strong>${safe(amount)}</strong></div>
        <p class="plan-period">${safe(copy(claim ? 'planClaim' : 'planOneTime'))}</p></div>
      <div>${action}</div>
      <ul>${benefits.slice(0,4).map(benefit=>'<li><span aria-hidden="true">✓</span>'+safe(benefit)+'</li>').join('')}</ul>
      <div class="plan-conditions">
        ${Object.keys(plan.features || {}).length ? '<p>'+safe(copy('planExpiry')+' · '+validity(plan))+'</p>' : ''}
        ${claim && available ? '<p>'+safe(copy('planAvailability',number(plan.claim.remaining)))+'</p>' : ''}
        ${end ? `<p data-plan-end="${safe(end)}">${safe(copy('planEnds',date(end)))}</p>` : ''}
      </div>
    </article>`;
  }

  function comparison(plans, prices) {
    if (!plans.length) return '';
    const keys = [...new Set(plans.flatMap(plan=>Object.keys(plan.features || {})))];
    const sections = Object.entries(categories).map(([group, features]) => [group, keys.filter(key=>Object.hasOwn(features,key))]);
    sections.push(['groupCareer',keys.filter(key=>!Object.hasOwn(labels,key))]);
    const row = (label, values) => `<tr><th scope="row">${safe(label)}</th>${values.map(value=>'<td>'+safe(value)+'</td>').join('')}</tr>`;
    const groupHeading = name => `<tr><th scope="rowgroup" colspan="${plans.length+1}">${safe(copy(name))}</th></tr>`;
    const groups = sections.filter(([,items])=>items.length).map(([group,items])=>'<tbody>'+groupHeading(group)
      +items.map(key=>row(featureName(key,prices),plans.map(plan=>inclusion(plan,key,prices)))).join('')+'</tbody>').join('');
    const limits = groupHeading('groupUsage')+row(copy('planToken'),plans.map(plan=>number(savedTokens(plan))))
      +row(copy('planExpiry'),plans.map(plan=>Object.keys(plan.features || {}).length ? validity(plan) : '—'));
    return `<details class="plan-comparison"><summary>${safe(copy('planCompare'))}</summary>
      <div class="plan-table-wrap" tabindex="0" role="region" aria-label="${safe(copy('planCompare'))}">
        <table><thead><tr><th scope="col">${safe(copy('planFeature'))}</th>${plans.map(plan=>'<th scope="col">'+safe(plan.name)+'</th>').join('')}</tr></thead>
        ${groups}<tbody>${limits}</tbody></table>
      </div></details>`;
  }
  const t = key => ReGenText.get('public.' + key);
  const pages = {hero: 1, row: 1};
  const pageSize = {hero: 3, row: 4};
  const visible = {...pageSize};
  let pending = false;
  let data = null;
  let signature = '';

  function showAvailability(show, available) {
    host.hidden = !show;
    if (status) {
      status.hidden = show;
      status.textContent = show ? '' : t(available ? 'noPricing' : 'pricingError');
    }
    if (retry) retry.hidden = show || available;
  }

  function footer(type, total) {
    if (visible[type] >= total) return '';
    return '<div class="landing-package-footer"><button class="btn btn-secondary" type="button" data-package-more="' + type
      + '">' + safe(t(type === 'hero' ? 'morePackages' : 'moreOffers')) + '</button></div>';
  }

  function cardOffset(rail, index) {
    const cards = rail.children;
    return cards[index].getBoundingClientRect().left - cards[0].getBoundingClientRect().left;
  }

  function currentCard(rail) {
    const last = rail.children.length - 1;
    if (last < 1) return 0;
    if (rail.scrollWidth > rail.clientWidth && rail.scrollLeft >= rail.scrollWidth - rail.clientWidth - 2) return last;
    let best = 0;
    for (let index = 1; index <= last; index++) {
      if (Math.abs(cardOffset(rail, index) - rail.scrollLeft) < Math.abs(cardOffset(rail, best) - rail.scrollLeft)) best = index;
    }
    return best;
  }

  function scrollToCard(rail, index, immediate = false) {
    const last = rail.children.length - 1;
    if (last < 0) return;
    const left = cardOffset(rail, Math.max(0, Math.min(last, index)));
    rail.scrollTo({left, behavior: immediate || matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
  }

  function setupCarousel() {
    const rail = host.querySelector('.landing-package-rail');
    const prev = host.querySelector('[data-pricing-prev]');
    const next = host.querySelector('[data-pricing-next]');
    const announcement = host.querySelector('[data-price-position]');
    const dots = host.querySelectorAll('.pricing-dot');
    if (!rail || !dots.length) return;

    function update() {
      const cards = rail.children;
      if (!cards.length) return;
      const active = currentCard(rail);
      announcement.hidden = rail.scrollWidth <= rail.clientWidth;
      const position = copy('slideCount', (active+1)+' / '+cards.length);
      if (announcement.textContent !== position) announcement.textContent = position;
      dots.forEach((dot, idx) => {
        const isCurrent = idx === active;
        dot.classList.toggle('is-active', isCurrent);
        dot.setAttribute('aria-current', String(isCurrent));
      });
      prev?.setAttribute('aria-disabled',String(rail.scrollLeft <= 6));
      next?.setAttribute('aria-disabled',String(rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 6));
    }

    rail.addEventListener('keydown', event => {
      if (event.target !== rail || rail.scrollWidth <= rail.clientWidth) return;
      const active = currentCard(rail);
      const destination = {ArrowLeft:active-1,ArrowRight:active+1,Home:0,End:rail.children.length-1}[event.key];
      if (destination === undefined) return;
      event.preventDefault();
      scrollToCard(rail,destination,true);
    });
    rail.addEventListener('scroll', () => {
      window.requestAnimationFrame(update);
    }, {passive: true});

    carouselObserver = new ResizeObserver(update);
    carouselObserver.observe(rail);
    update();
  }

  function render(next, force = false) {
    data = next;
    const policy = next.policy;
    const show = Boolean(next.success && policy.enabled && policy.showOnLanding && next.total > 0);
    showAvailability(show, next.success);
    if (!show) {
      host.replaceChildren();
      signature = '';
      return;
    }
    const changed = JSON.stringify([next, visible]);
    if (!force && signature === changed) return;
    signature = changed;
    const activeMore = document.activeElement?.dataset.packageMore;
    const hero = next.sections.hero;
    const row = next.sections.row;
    const selectedRail = host.querySelector('.landing-package-rail');
    const activeId = selectedRail?.children[currentCard(selectedRail)]?.dataset.planId;
    const heading = !preview && policy.version && policy.title ? '<p class="plan-configuration"><strong>' + safe(policy.title)
      + '</strong>' + (policy.description ? ' · ' + safe(policy.description) : '') + '</p>' : '';
    const notice = policy.notice ? '<p class="landing-pricing-notice">' + safe(policy.notice) + '</p>' : '';
    const heroItems = preview ? [...hero.items,...row.items].slice(0,3) : hero.items.slice(0,visible.hero);
    const count = heroItems.length;
    const prevText = safe(t('previousPackage') || 'Pakej sebelumnya');
    const nextText = safe(t('nextPackage') || 'Pakej seterusnya');
    const paginationText = safe(t('pricingPagination') || 'Penomboran pakej');
    const slideText = t('viewPackageSlide') || 'Lihat slaid pakej {index}';

    let carouselControls = '';
    if (count > 1) {
      const dots = heroItems.map((_, i) => '<button type="button" class="pricing-dot" aria-current="' + (i === 0 ? 'true' : 'false') + '" aria-label="' + safe(slideText.replace('{index}', i + 1)) + '" data-slide-index="' + i + '">' + (i + 1) + '</button>').join('');
      const dotsHtml = '<div class="pricing-carousel-dots" role="group" aria-label="' + paginationText + '">' + dots + '</div>';
      carouselControls = '<div class="pricing-carousel-controls"><button type="button" class="pricing-carousel-btn pricing-carousel-prev" data-pricing-prev aria-label="' + prevText + '" aria-disabled="true"><span aria-hidden="true">&larr;</span></button>' + dotsHtml + '<button type="button" class="pricing-carousel-btn pricing-carousel-next" data-pricing-next aria-label="' + nextText + '"><span aria-hidden="true">&rarr;</span></button></div>';
    }

    const packages = count ? '<div class="pricing-carousel-wrapper"><div class="landing-package-rail" role="region" aria-label="'
      + safe(t('pricingCarousel')) + '" tabindex="0" data-plan-count="'+count+'" style="--plan-columns:'+Math.min(3,count)+'">'
      + heroItems.map(item => card(item,next.prices)).join('') + '</div>' + carouselControls
      + (count>1 ? '<p class="sr-only" data-price-position role="status" aria-live="polite"></p>' : '')
      + '</div>' + (preview ? '' : footer('hero',hero.total)) : '';
    const rowItems = preview ? [] : row.items.slice(0,visible.row);
    const offers = rowItems.length ? '<section class="landing-quick-offers"><h2>' + safe(copy('planOther')) + '</h2>'
      + '<div class="public-offer-grid" style="--plan-columns:'+Math.min(3,rowItems.length)+'">'
      + rowItems.map(item=>card(item,next.prices)).join('') + '</div>' + footer('row',row.total) + '</section>' : '';
    const openComparison = host.querySelector('.plan-comparison')?.open === true;
    carouselObserver?.disconnect();
    host.innerHTML = heading + notice + packages + offers + '<p class="plan-terms">'+safe(copy('planTerms'))+'</p>'
      + (preview ? '' : comparison([...heroItems,...rowItems],next.prices));
    if (activeId) {
      const replacement = host.querySelector('.landing-package-rail');
      const position = [...(replacement?.children || [])].findIndex(plan=>plan.dataset.planId===activeId);
      if (position>0) scrollToCard(replacement,position,true);
    }
    if (openComparison) host.querySelector('.plan-comparison').open = true;
    clearTimeout(scheduledRefresh);
    const ends = [...host.querySelectorAll('[data-plan-end]')].map(el=>Date.parse(el.dataset.planEnd.replace(' ','T')+'Z'))
      .filter(timestamp=>timestamp > Date.now());
    if (ends.length) scheduledRefresh = setTimeout(refresh, Math.min(Math.min(...ends)-Date.now()+500,2147483647));
    setupCarousel();
    if (activeMore) host.querySelector('[data-package-more="' + activeMore + '"]')?.focus({preventScroll: true});


  }

  async function refresh() {
    if (!navigator.onLine) {
      showAvailability(false, false);
      signature = '';
      return false;
    }
    if (pending) return false;
    pending = true;
    try {
      const results = await Promise.all(Array.from({length: Math.max(pages.hero, pages.row)}, async (_, index) => {
        const response = await fetch('/site/pricing.json?heroPage=' + Math.min(index + 1, pages.hero) + '&rowPage='
          + Math.min(index + 1, pages.row), {cache: 'no-store'});
        if (!response.ok) throw new Error();
        const result = await response.json();
        if (!result.success) throw new Error();
        return result;
      }));
      const sections = {};
      for (const type of ['hero', 'row']) {
        sections[type] = {...results[0].sections[type], items: [...new Map(
          results.flatMap(result => result.sections[type].items).map(item => [item.id, item])
        ).values()]};
      }
      render({...results[0], sections});
      return true;
    } catch {
      showAvailability(false, false);
      signature = '';
      return false;
    } finally {
      pending = false;
    }
  }

  if (preview) {
    previewObserver = new IntersectionObserver(([entry]) => {
      previewVisible = entry.isIntersecting;
      if (previewVisible && !data) refresh();
    },{rootMargin:'380px 0px'});
    previewObserver.observe(preview);
  } else {
    try { render(JSON.parse(document.getElementById('pricing-catalogue').textContent)); }
    catch { showAvailability(false,false); }
    if (navigator.onLine && !data?.success) refresh();
  }
  host.addEventListener('click', async event => {
    const rail = host.querySelector('.landing-package-rail');
    if (rail) {
      const currentIndex = currentCard(rail);

      const prevBtn = event.target.closest('[data-pricing-prev]');
      if (prevBtn) {
        if (prevBtn.getAttribute('aria-disabled') !== 'true') scrollToCard(rail,currentIndex-1);
        return;
      }

      const nextBtn = event.target.closest('[data-pricing-next]');
      if (nextBtn) {
        if (nextBtn.getAttribute('aria-disabled') !== 'true') scrollToCard(rail,currentIndex+1);
        return;
      }

      const dot = event.target.closest('[data-slide-index]');
      if (dot) {
        const targetIdx = Number(dot.dataset.slideIndex);
        if (Number.isInteger(targetIdx)) scrollToCard(rail, targetIdx);
        return;
      }
    }

    const more = event.target.closest('[data-package-more]');
    const type = more?.dataset.packageMore;
    if (!more || pending || !['hero', 'row'].includes(type)) return;
    const previousCount = visible[type];
    if (previousCount >= data.sections[type].items.length) {
      pages[type]++;
      more.disabled = true;
      const updated = await refresh();
      more.disabled = false;
      if (!updated) {
        pages[type]--;
        return;
      }
    }
    visible[type] = Math.min(previousCount + pageSize[type], data.sections[type].total);
    render(data, true);
    const list = type === 'hero' ? '.landing-package-rail' : '.public-offer-grid';
    host.querySelector(list)?.children[previousCount]?.querySelector('a, button')?.focus();
  });

  retry?.addEventListener('click', async () => {
    retry.disabled = true;
    if (await refresh()) host.querySelector('a,summary')?.focus();
    retry.disabled = false;
  });
  const refreshVisible = () => {if (!document.hidden && (!preview || previewVisible)) refresh();};
  document.addEventListener('visibilitychange', refreshVisible);
  window.addEventListener('online', refreshVisible);
  window.addEventListener('offline', () => { showAvailability(false, false); signature = ''; });
  window.addEventListener('regen:promotion-ended', refresh);
  const timer = setInterval(refreshVisible,30000);
  window.addEventListener('pagehide', () => {clearInterval(timer);clearTimeout(scheduledRefresh);carouselObserver?.disconnect();previewObserver?.disconnect();});
});
