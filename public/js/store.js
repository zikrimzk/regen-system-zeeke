document.addEventListener('DOMContentLoaded', () => {
  const host = document.getElementById('token-store-content');
  if (!host) return;
  const status = document.getElementById('store-status');
  const {safe, number, date, money, balance, card, coin} = ReGenCommerce;
  const t = ReGenText.get;
  const copy = (key, fields = {}) => safe(t('store.' + key).replace(/\{([a-z]+)\}/g, (match, field) => fields[field] ?? match));
  const activity = document.body.dataset.tokenView === 'activity';
  const feature = new URLSearchParams(location.search).get('feature') || '';
  const pages = {activity: 1, hero: 1, row: 1, owned: 1};
  const sessionReady = Api.getMe();
  let current = null;
  let pending = false;
  let reload = false;
  let initialAnchor = true;
  let timer, boundaryTimer;

  function scheduleOffers(items) {
    clearTimeout(boundaryTimer);
    const now = Date.now();
    const future = items.flatMap(item => [item.promotion_starts_at, item.promotion_ends_at, item.claim?.startsAt, item.claim?.endsAt])
      .filter(Boolean).map(value => Api.parseDate(value)?.getTime()).filter(time => time > now);
    if (future.length) {
      boundaryTimer = setTimeout(() => { if (!document.hidden) load(); }, Math.min(2147483647, Math.min(...future) - now + 100));
    }
  }

  function pagination(key, page, total, title) {
    if (total <= 1) return '';
    return `<nav class="token-pagination" aria-label="${title}">
      <button class="btn btn-secondary" type="button" data-pager="${key}" data-direction="-1"${page <= 1 ? ' disabled' : ''}>${copy('previous')}</button>
      <span>${copy('pageCount', {page, total})}</span>
      <button class="btn btn-secondary" type="button" data-pager="${key}" data-direction="1"${page >= total ? ' disabled' : ''}>${copy('next')}</button>
    </nav>`;
  }

  function activityView(response) {
    const aiFeatures = {assist: 'ai_assist', refine: 'ai_refine', cover_letter: 'ai_cover_letter', review: 'ai_review'};
    const heading = safe(t('nav.tokens'));
    const rows = response.ledger.map(item => {
      const reason = item.reason
        .replace(/AI: (assist|refine|cover_letter|review)/, (found, key) => response.prices[aiFeatures[key]]?.name ?? found)
        .replace(/: ([a-z_]+)$/, (found, key) => response.prices[key] ? ': ' + response.prices[key].name : found);
      const positive = Number(item.amount) > 0;
      const detail = item.bucket === 'saved' ? copy('savedBalance', {count: number(item.balance_after)})
        : item.bucket === 'base' ? safe(t('commerce.base')) : copy('packageUse');
      return `<li><div><h3>${safe(reason)}</h3><time>${safe(date(item.created_at))}</time></div>
        <div class="token-history-change${positive ? ' is-positive' : ''}">${positive ? '+' : ''}${number(item.amount)}<small>${detail}</small></div></li>`;
    }).join('');
    const credits = response.credits.map(credit => `<article class="token-credit">
      <p>${safe(response.prices[credit.feature_key]?.name || credit.feature_key)}<small>${number(credit.paid_tokens)} Coin · ${copy(credit.state === 'held' ? 'inProgress' : 'ready')}</small></p>
      <button class="btn btn-secondary" type="button" data-refund="${Number(credit.id)}"${credit.state === 'held' ? ' disabled' : ''}>${copy('returnCredit')}</button>
    </article>`).join('');
    return balance(response.balance, {activity: true}) + `<section class="token-section">
      <h2>${copy('recentActivity')}</h2>
      ${rows ? '<ol class="token-history">' + rows + '</ol>' : '<p class="token-empty">' + copy('activityEmpty') + '</p>'}
      ${pagination('activity', pages.activity, Math.max(Math.ceil(response.total / response.pageSize), Math.ceil(response.creditTotal / 10)), heading)}
    </section>${credits ? '<section class="token-section"><h2>' + copy('prepaid') + '</h2><div class="token-used-credits">' + credits + '</div></section>' : ''}`;
  }

  function packageView(response) {
    function offers(layout, title) {
      const group = response.sections[layout];
      if (!group.total) return '';
      return `<section class="token-section" id="${layout === 'hero' ? 'token-packages' : 'token-quick-offers'}">
        <div class="token-section-head"><h2>${title}</h2></div>
        <div class="${layout === 'hero' ? 'token-package-grid' : 'token-offer-list'}">${group.items.map(item =>
          `<div class="store-catalog-item" id="package-offer-${Number(item.id)}">${card(item, response.prices, false, {catalog: true})}</div>`
        ).join('')}</div>
        ${pagination(layout, group.page, Math.ceil(group.total / group.pageSize), title)}
      </section>`;
    }
    const owned = response.grants.map(grant => {
      const saved = grant.credited_tokens || !grant.features.length
        ? `<li><span>${copy('savedCredited')}</span><strong>${number(grant.credited_tokens)}</strong></li>` : '';
      const benefits = grant.features.map(feature => {
        const label = feature.key === 'templates'
          ? (feature.tiers || ['basic', 'premium']).map(tier => t('commerce.' + tier)).join(' + ') + ' · ' + t('nav.templates')
          : feature.name;
        const remaining = feature.remaining === null ? (feature.unlimited ? safe(t('commerce.unlimited')) : copy('included'))
          : copy('usesLeft', {left: number(feature.remaining), total: number(feature.included)});
        return `<li><span>${safe(label)}</span><strong>${remaining}</strong></li>`;
      }).join('');
      return `<article class="token-owned"><div><h3>${safe(grant.package_name)}</h3>
        <span>${grant.expires_at ? copy('expires', {date: date(grant.expires_at)}) : safe(t('commerce.noExpiry'))}</span></div>
        <ul>${saved}${benefits}</ul></article>`;
    }).join('');
    const filter = response.feature && response.prices[response.feature]
      ? `<div class="package-filter"><h2>${copy('filtered', {feature: response.prices[response.feature].name})}</h2>
        <a class="btn btn-secondary" href="/store#package-offers">${copy('seeAll')}</a></div>` : '';
    const heading = response.policy.title === 'Packages for your next application' ? copy('featured') : safe(response.policy.title);
    const featured = offers('hero', heading);
    const description = response.policy.description !== 'Choose the features and uses you need.' ? response.policy.description : '';
    const quick = offers('row', copy('quickOffers'));
    const listed = [...response.sections.hero.items, ...response.sections.row.items];
    const spotlight = response.policy.enabled && !response.feature
      ? listed.find(item =>
        item.claim?.enabled ? item.claim.state === 'available' : item.promotion_active && Number(item.discount_percent) > 0)
      : null;
    const artwork = tint => `<div class="store-catalog-art" aria-hidden="true">${coin('large', tint)}${coin('large', tint)}</div>`;
    const packageLead = spotlight ? `<section class="store-catalog-lead store-current-offer" aria-labelledby="store-catalog-title">
        <div><h2 id="store-catalog-title">${safe(spotlight.offer_headline || spotlight.name)}</h2></div>
        <div class="store-offer-cta"><div class="store-offer-price"><strong>${spotlight.claim?.enabled ? safe(t('commerce.free')) : safe(money(spotlight.display_price_minor,spotlight.currency))}</strong>
          ${spotlight.claim?.enabled?'':`<s>${safe(money(spotlight.compare_price_minor,spotlight.currency))}</s>`}</div>
          <a class="btn btn-secondary" href="#package-offer-${Number(spotlight.id)}">${copy('reviewOffer')}</a></div>
        ${artwork(spotlight.coin_color)}
      </section>`
      : !response.feature && (featured || quick) ? `<section class="store-catalog-lead" aria-labelledby="store-catalog-title">
        <h2 id="store-catalog-title">${copy('catalogTitle')}</h2>
        <a class="btn btn-secondary" href="#package-offers">${copy('explore')}</a>
        ${artwork(listed.find(item => item.highlighted)?.coin_color ?? 'gold')}
      </section>` : '';
    return `<div class="store-catalog-header${packageLead?'':' store-catalog-wallet-only'}">${packageLead}${balance(response.balance, {compact:true})}</div>`
      + (description ? `<p class="token-offers-notice">${safe(description)}</p>` : '')
      + (response.policy.notice ? `<p class="token-offers-notice">${safe(response.policy.notice)}</p>` : '')
      + `<div id="package-offers" class="package-offers-anchor">${filter}${featured}${quick}
        ${featured || quick ? '' : '<section class="token-section"><p class="token-empty">' + copy(response.feature ? 'noMatches' : response.policy.enabled ? 'comingSoon' : 'paused') + '</p></section>'}
      </div>`
      + (owned ? `<section class="token-section token-your-packages" id="your-packages"><div class="token-section-head"><h2>${copy('owned')}</h2></div>
        <div class="token-owned-grid">${owned}</div>${pagination('owned', pages.owned, Math.ceil(response.grantTotal / 10), copy('owned'))}</section>` : '');
  }

  function announce(message, success = false) {
    status.textContent = message;
    status.classList.toggle('is-success', success);
  }

  async function load() {
    if (pending) { reload = true; return; }
    pending = true;
    host.setAttribute('aria-busy', 'true');
    try {
      const response = await (activity ? Api.getTokenActivity(pages.activity)
        : Api.getTokenStore(1, 1, pages.hero, pages.row, pages.owned, feature));
      if (!response.success) throw new Error(response.message || t('store.loadError'));
      current = response;
      window.ReGenTokens?.updateBalance(response.balance);
      const focused = document.activeElement;
      const pager = host.contains(focused) && focused.dataset.pager;
      const direction = focused.dataset.direction;
      const walletOpen = host.querySelector('.store-wallet-breakdown')?.open;
      const openBenefits = new Set([...host.querySelectorAll('.store-benefits-more[open]')]
        .map(detail => detail.closest('.store-catalog-item').id));
      host.innerHTML = activity ? activityView(response) : packageView(response);
      if (walletOpen) host.querySelector('.store-wallet-breakdown').open = true;
      for (const id of openBenefits) {
        const detail = document.getElementById(id)?.querySelector('.store-benefits-more');
        if (detail) detail.open = true;
      }
      if (pager) {
        const buttons = [...host.querySelectorAll('[data-pager]')].filter(button => button.dataset.pager === pager && !button.disabled);
        (buttons.find(button => button.dataset.direction === direction) ?? buttons[0])?.focus({preventScroll: true});
      }
      if (!activity) {
        if (initialAnchor && /^#(?:package-offers|your-packages|package-offer-\d+)$/.test(location.hash)) host.querySelector(location.hash)?.scrollIntoView();
        initialAnchor = false;
        scheduleOffers([...response.sections.hero.items, ...response.sections.row.items]);
      }
    } catch (error) {
      announce(error.message);
      if (!current) host.innerHTML = `<div class="token-empty"><button type="button" class="btn btn-secondary" data-retry>${safe(t('common.retry'))}</button></div>`;
    } finally {
      host.setAttribute('aria-busy', 'false');
      pending = false;
      if (reload) { reload = false; load(); }
    }
  }

  function openCheckout(trigger) {
    if (activity || !current || document.querySelector('.k-checkout[open]')) return;
    const item = [...current.sections.hero.items, ...current.sections.row.items].find(pkg => Number(pkg.id) === Number(trigger.dataset.viewPackage));
    if (!item) return;
    const dialog = document.createElement('dialog');
    const icon = ReGenIcons.icon;
    dialog.className = 'token-dialog package-offer-dialog k-checkout';
    dialog.setAttribute('aria-labelledby', 'checkout-title');
    dialog.innerHTML = `<header><div><h2 id="checkout-title">${copy('checkoutTitle')}</h2><p>K-Store</p></div>
      <button type="button" class="token-close" aria-label="${safe(t('common.close'))}">${icon('close')}</button></header>
      <div class="token-dialog-content">
        ${card({...item, card_layout: 'hero'}, current.prices, false, {detail: true, checkoutAvailable: current.checkoutAvailable})}
        ${current.checkoutAvailable && Number(item.display_price_minor) >= 30
          ? `<div class="k-checkout-note">${icon('lock')}<p>${copy('checkoutHelp')}</p></div>` : ''}
        <p class="payment-message" role="status"></p>
      </div>`;
    const pay = dialog.querySelector('[data-start-checkout]');
    const message = dialog.querySelector('.payment-message');
    let opening = false;
    const close = dialog.querySelector('.token-close');
    dialog.addEventListener('cancel', event => { if (opening) event.preventDefault(); });
    if (pay) pay.onclick = async () => {
      opening = true;
      close.disabled = true;
      pay.disabled = true;
      pay.textContent = t('store.checkoutOpening');
      message.textContent = '';
      try {
        const session = await sessionReady;
        if (!session.success) throw new Error(t('store.checkoutExpired'));
        const result = await Api.startCheckout({
          packageId: Number(item.id), version: Number(item.version), amountMinor: Number(item.display_price_minor),
          requestKey: crypto.randomUUID(),
        });
        if (result.success) {
          location.assign(result.order.checkoutUrl || '/store/payments?order=' + encodeURIComponent(result.order.reference));
          return;
        }
        if (result.status === 409) {
          message.textContent = result.message || t('store.checkoutError');
          pay.textContent = t('store.checkout');
          load();
          return;
        }
        throw new Error(t('store.checkoutError'));
      } catch (error) {
        message.textContent = error.message;
        pay.textContent = t('store.checkout');
        pay.disabled = false;
      } finally {
        opening = false;
        close.disabled = false;
      }
    };
    close.onclick = () => dialog.close();
    dialog.addEventListener('close', () => {
      dialog.remove();
      const replacement = [...host.querySelectorAll('[data-view-package]')].find(button => button.dataset.viewPackage === trigger.dataset.viewPackage);
      replacement?.focus({preventScroll: true});
    }, {once: true});
    document.body.append(dialog);
    dialog.showModal();
  }

  host.addEventListener('click', async event => {
    if (event.target.closest('[data-retry]')) {
      announce('');
      return load();
    }
    const pager = event.target.closest('[data-pager]');
    if (pager) {
      if (pending) return;
      pages[pager.dataset.pager] += Number(pager.dataset.direction);
      return load();
    }
    const offer = event.target.closest('[data-view-package]');
    if (offer) return openCheckout(offer);
    const claim = event.target.closest('[data-claim-package]');
    const refund = event.target.closest('[data-refund]');
    const button = claim || refund;
    if (!button) return;
    button.disabled = true;
    if (claim) button.textContent = t('store.claiming');
    try {
      await sessionReady;
      const result = claim
        ? await Api.claimPackage(Number(claim.dataset.claimPackage), Number(claim.dataset.packageVersion))
        : await Api.refundFeatureCredit(Number(refund.dataset.refund));
      if (!result.success) throw new Error(result.message || t('store.loadError'));
      announce(t(claim ? (result.duplicate ? 'store.alreadyClaimed' : 'store.claimed') : 'store.returned'), true);
      window.dispatchEvent(new CustomEvent('regen:wallet-changed'));
    } catch (error) {
      announce(error.message);
    } finally {
      await load();
      if (button.isConnected) button.disabled = false;
    }
  });

  const update = event => {
    if (event.detail?.topic && !['wallet', 'store', 'ai', 'pricing'].includes(event.detail.topic)) return;
    clearTimeout(timer);
    timer = setTimeout(load, 180);
  };
  for (const name of ['regen:live-change', 'regen:reconcile', 'regen:wallet-changed', 'regen:promotion-ended']) {
    window.addEventListener(name, update);
  }
  window.addEventListener('pagehide', () => { clearTimeout(timer); clearTimeout(boundaryTimer); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
  load();
});
