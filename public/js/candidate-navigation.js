(() => {
  const button = document.querySelector('[data-workspace-collapse]');
  const more = document.getElementById('workspace-more');
  const breakpoint = matchMedia('(min-width: 981px)');
  const preference = 'regen-sidebar-compact';
  let compact = false;
  try { compact = localStorage.getItem(preference) === '1'; } catch {}

  function updateSidebar() {
    document.documentElement.toggleAttribute('data-sidebar-compact', compact);
    button?.setAttribute('aria-expanded', String(!compact));
  }
  updateSidebar();
  button?.addEventListener('click', () => {
    compact = !compact;
    updateSidebar();
    try { localStorage.setItem(preference, compact ? '1' : '0'); } catch {}
  });

  const trigger = document.querySelector('.mobile-product-nav [data-workspace-more]');
  trigger?.addEventListener('click', () => {
    if (more.open) return;
    more.showModal();
    trigger.setAttribute('aria-expanded', 'true');
  });
  more?.addEventListener('click', event => {
    if (event.target === more || event.target.closest('[data-workspace-more-close]')) more.close();
  });
  more?.addEventListener('close', () => {
    trigger?.setAttribute('aria-expanded', 'false');
    if (trigger?.getClientRects().length) trigger.focus({preventScroll: true});
  });
  breakpoint.addEventListener('change', event => {
    if (event.matches && more?.open) more.close();
  });
})();
