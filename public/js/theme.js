/* ONLY THE APPEARANCE PREFERENCE IS STORED; OPTIONAL STORAGE FOLLOWS THE VISITOR'S CHOICE. */
(() => {
  const root = document.documentElement;
  const key = 'regen:appearance';
  const system = matchMedia('(prefers-color-scheme: dark)');
  const choices = ['light', 'dark', 'system'];
  const defaultPreference = root.dataset.defaultAppearance === 'light' ? 'light' : 'system';
  let preference = defaultPreference;
  const mayRemember = () => {
    try { const consent = JSON.parse(localStorage.getItem('regen:consent') || 'null'); return consent?.version === 1 && consent.preferences === true && consent.expires > Date.now(); } catch { return false; }
  };
  try { const saved = mayRemember() ? localStorage.getItem(key) : null; if (choices.includes(saved)) preference = saved; } catch {}
  const label = (key, fallback) => window.ReGenText?.get('common.' + key, fallback) ?? fallback;
  function apply() {
    const theme = preference === 'system' ? (system.matches ? 'dark' : 'light') : preference;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.append(meta); }
    meta.content = root.hasAttribute('data-commercial-appearance')
      ? (theme === 'dark' ? '#15161a' : '#f8f7f4')
      : (theme === 'dark' ? '#111b16' : '#f4f6f3');
    document.querySelectorAll('.appearance-toggle').forEach(button=>{button.dataset.mode=theme;button.setAttribute('aria-label', label('changeAppearance', 'Change appearance'));button.querySelector('svg').innerHTML=theme==='dark'?'<path d="M20.7 13A9 9 0 0 1 11 3.3 9 9 0 1 0 20.7 13Z"/>':'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/>';});
    document.querySelectorAll('[data-appearance-choice]').forEach(button => {
      button.setAttribute('aria-checked', String(button.dataset.appearanceChoice === preference));
    });
    window.dispatchEvent(new CustomEvent('regen:appearance', { detail: {theme, preference} }));
  }
  function select(value) {
    if (!choices.includes(value)) return;
    preference = value;
    if (mayRemember()) try { localStorage.setItem(key, value); } catch {}
    apply();
  }
  apply();
  system.addEventListener('change', apply);
  window.addEventListener('storage', event => {
    if (event.key !== key) return;
    preference = mayRemember() && choices.includes(event.newValue) ? event.newValue : defaultPreference;
    apply();
  });
  window.addEventListener('regen:privacy', event => {
    try { if (event.detail.preferences) localStorage.setItem(key, preference); else localStorage.removeItem(key); } catch {}
  });
  document.addEventListener('DOMContentLoaded', () => {
    const header = document.querySelector('.topbar, .auth-header, .admin-topbar, .site-header, .service-header');
    if (!header) return;
    const control = document.createElement('div');
    control.className = 'appearance-control';
    const paths = {light:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/>',dark:'<path d="M20.7 13A9 9 0 0 1 11 3.3 9 9 0 1 0 20.7 13Z"/>',system:'<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>'};
    control.innerHTML = `<button type="button" class="appearance-toggle" aria-label="${label('changeAppearance', 'Change appearance')}" aria-expanded="false" aria-controls="appearance-panel" aria-haspopup="menu"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor" stroke="none"/></svg></button><div class="appearance-panel" id="appearance-panel" role="menu" aria-label="${label('appearance', 'Appearance')}" hidden><span class="appearance-label">${label('appearance', 'Appearance')}</span>${choices.map(choice => `<button type="button" role="menuitemradio" data-appearance-choice="${choice}" aria-checked="false"><svg viewBox="0 0 24 24" aria-hidden="true">${paths[choice]}</svg><span>${choice === 'system' ? label('device', 'Use device setting') : label(choice, choice[0].toUpperCase() + choice.slice(1))}</span><svg class="appearance-check" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg></button>`).join('')}</div>`;
    const account = header.querySelector('.workspace-notification-bell, .admin-alert-toggle, .topbar-user, .site-menu-toggle');
    if (account) account.before(control); else header.append(control);
    const toggle = control.querySelector('.appearance-toggle');
    const panel = control.querySelector('.appearance-panel');
    document.body.append(panel);
    const contains=node=>node&&(control.contains(node)||panel.contains(node));
    const close = () => { panel.hidden = true; toggle.setAttribute('aria-expanded', 'false'); };
    toggle.addEventListener('click', () => {
      const open = panel.hidden;
      if (open) window.dispatchEvent(new CustomEvent('regen:menu-open',{detail:{owner:'appearance'}}));
      panel.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
      if (open) {
        const rect=toggle.getBoundingClientRect();
        panel.style.left=Math.max(12,Math.min(innerWidth-236,rect.right-224))+'px';
        panel.style.top=(rect.bottom+8)+'px';
        panel.querySelector('[aria-checked="true"]')?.focus();
      }
    });
    window.addEventListener('regen:menu-open', event => { if (event.detail?.owner !== 'appearance') close(); });
    const keys = event => {
      if (event.key === 'Escape') { close(); toggle.focus(); }
      if(!panel.hidden&&['ArrowDown','ArrowUp','Home','End'].includes(event.key)) {
        event.preventDefault();const items=[...panel.querySelectorAll('[role="menuitemradio"]')];const index=items.indexOf(document.activeElement);
        items[event.key==='Home'?0:event.key==='End'?items.length-1:(index+(event.key==='ArrowDown'?1:items.length-1))%items.length].focus();
      }
    };
    control.addEventListener('keydown',keys);panel.addEventListener('keydown',keys);
    for(const element of [control,panel])element.addEventListener('focusout',event=>{if(!contains(event.relatedTarget))close();});
    document.addEventListener('click', event => { if (!contains(event.target)) close(); });
    document.addEventListener('click', event => {
      const button = event.target.closest('[data-appearance-choice]');
      if (button) {select(button.dataset.appearanceChoice);close();toggle.focus();}
    });
    window.addEventListener('resize',close);
    window.addEventListener('scroll',close,{passive:true});
    apply();
  });
})();
