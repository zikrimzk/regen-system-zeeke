(() => {
  const dictionary = document.getElementById('regen-interface-text');
  const messages = dictionary ? JSON.parse(dictionary.textContent) : {};
  const locale = document.documentElement.lang === 'ms' ? 'ms-MY' : 'en-MY';
  window.ReGenText = Object.freeze({locale, get: (key, fallback = '') => messages[key] ?? fallback});

  document.addEventListener('click', event => {
    const link = event.target.closest('[data-language-switch]');
    if (link && location.hash) {
      const href = new URL(link.href);
      href.hash = location.hash;
      link.href = href.href;
    }

    if (event.target.closest('[data-showcase-open]')) document.getElementById('showcase-dialog').showModal();
    const opener = event.target.closest('[data-workspace-more]');
    const more = document.getElementById('workspace-more');
    if (!more) return;
    if (opener) more.showModal();
    if (event.target === more || event.target.closest('[data-workspace-more-close]')) more.close();
  });
})();
