document.addEventListener('DOMContentLoaded', () => {
  const host = document.getElementById('landing-pricing');
  if (!host) return;
  const section = document.getElementById('pricing');
  const promo = document.getElementById('landing-promotion');
  const status = document.getElementById('pricing-state');
  const standalone = section.hasAttribute('data-pricing-page');
  const {safe, card, money} = ReGenCommerce;
  const t = key => ReGenText.get('public.' + key);
  const pages = {hero: 1, row: 1};
  const pageSize = {hero: 3, row: 4};
  const visible = {...pageSize};
  let pending = false;
  let data = null;
  let signature = '';

  function showAvailability(show, available) {
    section.hidden = !standalone && !show;
    host.hidden = !show;
    document.querySelectorAll('[href="#pricing"]').forEach(link => { link.hidden = !show; });
    if (status) {
      status.hidden = show;
      status.textContent = show ? '' : t(available ? 'noPricing' : 'pricingError');
    }
    if (!show && promo) promo.hidden = true;
  }

  function footer(type, total) {
    if (visible[type] >= total) return '';
    return '<div class="landing-package-footer"><button class="btn btn-secondary" type="button" data-package-more="' + type
      + '">' + safe(t(type === 'hero' ? 'morePackages' : 'moreOffers')) + '</button></div>';
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
    const heading = standalone && !policy.version ? '<h2 class="sr-only">' + safe(t('packages')) + '</h2>'
      : '<div class="section-heading"><h2>' + safe(policy.version ? policy.title : t('packageTitle'))
      + '</h2><p>' + safe(policy.version ? policy.description : t('packageDescription')) + '</p></div>';
    const notice = policy.notice ? '<p class="landing-pricing-notice">' + safe(policy.notice) + '</p>' : '';
    const packages = hero.total ? '<div class="landing-package-rail">' + hero.items.slice(0, visible.hero)
      .map(item => card(item, next.prices, true)).join('') + '</div>' + footer('hero', hero.total) : '';
    const offers = row.total ? '<section class="landing-quick-offers"><h3>' + safe(t('offers')) + '</h3>'
      + '<div class="token-offer-list">' + row.items.slice(0, visible.row).map(item => card(item, next.prices, true)).join('')
      + '</div>' + footer('row', row.total) + '</section>' : '';
    const link = standalone ? '<a class="text-link" href="/store">' + safe(t('store')) + '</a>'
      : '<a class="text-link" href="/pricing">' + safe(t('allPackages')) + '</a>';
    host.innerHTML = heading + notice + packages + offers + link;
    if (activeMore) host.querySelector('[data-package-more="' + activeMore + '"]')?.focus({preventScroll: true});

    if (promo) {
      const offer = [...hero.items, ...row.items].find(item => item.highlighted
        && (item.claim?.state === 'available' || (item.promotion_active && (item.badge || item.discount_percent))));
      promo.hidden = !offer;
      if (offer) {
        promo.innerHTML = '<span>' + safe(offer.claim?.enabled ? t('freeClaim') : offer.badge || '-' + offer.discount_percent + '%')
          + '</span><strong>' + safe(offer.name) + '</strong><span>'
          + safe(offer.claim?.enabled ? t('limitedOffer') : money(offer.display_price_minor, offer.currency))
          + '</span><a href="#pricing">' + safe(t('offerAction')) + '</a>';
      }
    }
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

  try { render(JSON.parse(document.getElementById('pricing-catalogue').textContent)); }
  catch { showAvailability(false, false); }
  host.addEventListener('click', async event => {
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
    const list = type === 'hero' ? '.landing-package-rail' : '.token-offer-list';
    host.querySelector(list)?.children[previousCount]?.querySelector('a, button')?.focus();
  });

  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  window.addEventListener('online', refresh);
  window.addEventListener('offline', () => { showAvailability(false, false); signature = ''; });
  window.addEventListener('regen:promotion-ended', refresh);
  if (navigator.onLine && !data?.success) refresh();
  const timer = setInterval(() => { if (!document.hidden) refresh(); }, 30000);
  window.addEventListener('pagehide', () => clearInterval(timer));
});
