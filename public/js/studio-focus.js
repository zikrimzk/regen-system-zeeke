/* Focus mode is a view preference for the open editor. */
(() => {
  const button = document.querySelector('[data-studio-focus]');
  if (!button) return;
  button.addEventListener('click', () => {
    const active = document.body.classList.toggle('studio-focus-mode');
    button.setAttribute('aria-pressed', String(active));
    document.dispatchEvent(new CustomEvent('regen:studio-focus', {detail: {active}}));
  });
})();
