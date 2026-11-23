window.ReGenTemplates = (() => {
  let cached, fetchedAt = 0, inFlight, serial = 0;
  const safe = value => ZeekeSafe.attr(value);
  const version = document.querySelector('meta[name=regen-preview-version]')?.content || 'templates';
  const image = (id, width) => '/img/templates/' + id + '-' + width + '.webp?v=' + encodeURIComponent(version);
  const pageSize = 6;

  function load(force = false) {
    if (inFlight) return inFlight;
    if (!force && cached && Date.now() - fetchedAt < 30000) return Promise.resolve(cached);
    inFlight = Api.getTemplates().then(result => {
      if (!result.success) throw new Error(result.message || 'Unable to load templates.');
      fetchedAt = Date.now();
      return cached = result;
    }).finally(() => { inFlight = null; });
    return inFlight;
  }

  function preview(template, select) {
    const previous = document.activeElement;
    const dialog = document.createElement('dialog');
    dialog.className = 'design-preview-dialog';
    dialog.setAttribute('aria-labelledby', 'design-preview-title');
    dialog.innerHTML = `<header><h2 id="design-preview-title">${safe(template.name)} sample</h2><button type="button" class="btn btn-secondary" data-close>Close</button></header>
      <div class="design-preview-paper" tabindex="0" aria-label="Sample resume, scroll to read"><img src="${image(template.id, 1280)}" width="1280" height="1810" decoding="async" alt="Sample resume using the ${safe(template.name)} design"></div>
      <footer><button type="button" class="btn btn-secondary" data-zoom aria-pressed="false">Zoom in</button><a class="btn btn-secondary" href="/samples/${template.id}.pdf?v=${safe(version)}" target="_blank" rel="noopener">Open PDF</a><button type="button" class="btn btn-primary" data-select>Select design</button></footer>`;
    const zoom = dialog.querySelector('[data-zoom]');
    const paper = dialog.querySelector('.design-preview-paper');
    dialog.querySelector('[data-close]').onclick = () => dialog.close();
    dialog.querySelector('[data-select]').onclick = () => { select(template.id); dialog.close('selected'); };
    zoom.onclick = () => {
      const enlarged = paper.classList.toggle('is-enlarged');
      zoom.setAttribute('aria-pressed', String(enlarged));
      zoom.textContent = enlarged ? 'Fit page' : 'Zoom in';
      if (!enlarged) paper.scrollLeft = 0;
    };
    dialog.addEventListener('close', () => {
      dialog.remove();
      if (dialog.returnValue !== 'selected' && previous?.isConnected) previous.focus({preventScroll:true});
    }, {once:true});
    document.body.append(dialog);
    dialog.showModal();
  }

  async function render(container, selected, {onApply, creating = false, initial} = {}) {
    container.setAttribute('aria-busy','true');
    container.innerHTML = '<div class="template-loading" role="status">Loading designs…</div>';
    let response = initial || await load();
    if (!container.isConnected) return () => {};
    let templates = response.data;
    if (!templates.length) throw new Error('No designs are available right now.');
    let current = templates.some(item => item.id === selected) ? selected : templates[0].id;
    if (templates.findIndex(item => item.id === current) >= pageSize) {
      templates = [templates.find(item => item.id === current), ...templates.filter(item => item.id !== current)];
    }
    const prefix = 'design-' + (++serial);
    let tier = 'all', layout = 'all', query = '', limit = pageSize, busy = false, disposed = false, refreshTimer;
    const getAccess = id => response.access.items[id];
    const tierName = template => template.tier === 'premium' ? 'Premium' : 'Basic';

    function action(template) {
      const access = getAccess(template.id);
      const price = response.prices.resume_create;
      const createLocked = creating && price?.accessAllowed === false;
      const blocked = !access.allowed || createLocked;
      const packageFeature = createLocked ? 'resume_create' : 'templates';
      const cost = Number(access.cost || 0) + (creating && price?.accessState === 'token_fallback' ? Number(price.cost) : 0);
      const alreadyApplied = !creating && access.state === 'current';
      if (alreadyApplied) return '';
      const label = creating ? 'Create resume' : 'Use design';
      const text = busy ? 'Applying…' : cost ? label + ' (' + cost + ' Coin)' : label;
      return blocked
        ? `<a class="btn btn-secondary" href="/store?feature=${packageFeature}#package-offers">See packages</a>`
        : `<button type="button" class="btn btn-primary" data-apply-design ${busy ? 'disabled' : ''}>${text}</button>`;
    }

    function card(template) {
      const id = template.id;
      const access = getAccess(id);
      return `<article class="design-card" data-design="${id}">
        <input type="radio" class="sr-only" id="${prefix}-${id}" name="${prefix}" value="${id}">
        <label class="design-card-choice" for="${prefix}-${id}">
          <div class="design-card-paper"><img src="${image(id, 320)}" srcset="${image(id,320)} 320w, ${image(id,640)} 640w" sizes="(max-width: 640px) calc(100vw - 52px), 240px" width="320" height="453" loading="lazy" decoding="async" alt=""><span class="design-selection-dot" aria-hidden="true"></span></div>
          <div class="design-card-copy"><div><h3>${safe(template.name)}</h3><p>${tierName(template)} · ${template.photo ? 'Photo option' : 'Text only'}</p></div>${template.popular ? '<span class="design-popular">Popular</span>' : ''}</div>
        </label>
        <div class="design-card-footer"><span>${access.allowed ? '' : ReGenIcons.icon('lock')}${safe(access.label)}</span><button type="button" class="design-preview-button" data-preview-design="${id}" aria-label="Preview ${safe(template.name)}">${ReGenIcons.icon('eye')} Preview</button></div>
        <div class="design-card-action"></div>
      </article>`;
    }

    container.innerHTML = `<div class="template-library">
      <div class="design-toolbar">
        <div class="design-filters" role="group" aria-label="Template collection">${[['all','All designs'],['basic','Basic'],['premium','Premium']].map(([key,label]) => `<button type="button" data-tier-filter="${key}" aria-pressed="${key === 'all'}">${label}</button>`).join('')}</div>
        <label class="design-search"><span class="sr-only">Search designs</span><input type="search" placeholder="Search designs"></label>
        <label class="design-layout"><span class="sr-only">Layout</span><select><option value="all">All layouts</option><option value="text">Text only</option><option value="photo">Photo option</option></select></label>
      </div>
      <div class="design-workspace">
        <section class="design-browser" aria-label="Resume designs"><p class="design-results" role="status"></p><fieldset class="design-grid"><legend class="sr-only">Select a resume design</legend></fieldset><p class="design-empty" hidden>No designs match your filters.</p><button class="btn btn-secondary design-more" type="button" hidden>Show more designs</button></section>
        <aside class="design-detail" aria-label="Selected design"><button type="button" class="design-detail-preview" data-selected-preview aria-label="Preview selected design"><img width="640" height="905" decoding="async" alt=""><span>${ReGenIcons.icon('eye')} Preview design</span></button><div class="design-detail-copy"><p data-selected-tier></p><h2 data-selected-name></h2><p data-selected-description></p></div><p class="design-eligibility" data-selected-access></p><div data-design-action></div></aside>
      </div><p class="design-save-message" role="status"></p>
    </div>`;
    const grid = container.querySelector('.design-grid');
    const more = container.querySelector('.design-more');
    const message = container.querySelector('.design-save-message');
    const templateById = id => templates.find(item => item.id === id);

    function paintSelection() {
      const template = templateById(current);
      if (!template) return;
      for (const tile of grid.querySelectorAll('.design-card')) {
        const checked = tile.dataset.design === current;
        tile.querySelector('input').checked = checked;
        tile.querySelector('.design-card-action').innerHTML = checked ? action(template) : '';
      }
      const img = container.querySelector('.design-detail-preview img');
      if (matchMedia('(min-width: 901px)').matches && img.getAttribute('src') !== image(current,640)) img.src = image(current,640);
      container.querySelector('[data-selected-tier]').textContent = tierName(template);
      container.querySelector('[data-selected-name]').textContent = template.name;
      container.querySelector('[data-selected-description]').textContent = template.description;
      container.querySelector('[data-selected-access]').textContent = getAccess(current).label;
      container.querySelector('[data-design-action]').innerHTML = action(template);
    }

    function draw({append = false} = {}) {
      const matching = templates.filter(template => (tier === 'all' || tier === template.tier)
        && (layout === 'all' || (layout === 'photo') === template.photo)
        && (!query || (template.name + ' ' + template.description).toLowerCase().includes(query)));
      const shown = matching.slice(0, limit);
      const previousCount = append ? grid.querySelectorAll('.design-card').length : 0;
      if (!append) grid.querySelectorAll('.design-card').forEach(tile => tile.remove());
      grid.insertAdjacentHTML('beforeend', shown.slice(previousCount).map(card).join(''));
      container.querySelector('.design-results').textContent = matching.length + (matching.length === 1 ? ' design' : ' designs');
      container.querySelector('.design-empty').hidden = matching.length > 0;
      container.querySelector('.design-detail').hidden = matching.length === 0;
      more.hidden = shown.length >= matching.length;
      if (matching.length && !matching.some(template => template.id === current)) current = shown[0].id;
      paintSelection();
      if (append) grid.querySelectorAll('.design-card input')[previousCount]?.focus({preventScroll:true});
    }

    function select(id, moveFocus = false) {
      if (!templateById(id)) return;
      current = id;
      message.textContent = '';
      paintSelection();
      if (moveFocus) grid.querySelector('input[value="' + id + '"]')?.focus({preventScroll:true});
    }
    async function refresh() {
      try {
        const next = await load(true);
        if (disposed || !next.data.length) return;
        response = next;
        templates = next.data;
        if (!templateById(current)) current = templates[0].id;
        draw();
      } catch { /* Keep the visible catalogue available when a background refresh fails. */ }
    }
    async function click(event) {
      const filter = event.target.closest('[data-tier-filter]');
      if (filter) {
        tier = filter.dataset.tierFilter;
        limit = pageSize;
        container.querySelectorAll('[data-tier-filter]').forEach(button => button.setAttribute('aria-pressed', String(button === filter)));
        draw();
      }
      const previewButton = event.target.closest('[data-preview-design],[data-selected-preview]');
      if (previewButton) preview(templateById(previewButton.dataset.previewDesign || current), id => select(id, true));
      if (event.target === more) { limit += pageSize; draw({append:true}); }
      if (!event.target.closest('[data-apply-design]') || busy) return;
      busy = true;
      const id = current;
      message.textContent = '';
      paintSelection();
      try {
        await onApply(id);
        cached = null;
      } catch (error) {
        message.textContent = error.message || 'Unable to use this design.';
        await refresh();
      } finally {
        busy = false;
        if (!disposed) paintSelection();
      }
    }
    const change = event => { if (event.target.name === prefix) select(event.target.value); };
    const onLive = event => {
      if (event.detail?.topic && !['store','pricing','templates','features'].includes(event.detail.topic)) return;
      cached = null;
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(refresh, 220);
    };
    const wide = matchMedia('(min-width: 901px)');
    container.addEventListener('click', click);
    container.addEventListener('change', change);
    container.querySelector('.design-search input').oninput = event => { query = event.target.value.trim().toLowerCase(); limit = pageSize; draw(); };
    container.querySelector('.design-layout select').onchange = event => { layout = event.target.value; limit = pageSize; draw(); };
    wide.addEventListener('change', paintSelection);
    window.addEventListener('regen:live-change', onLive);
    window.addEventListener('regen:reconcile', onLive);
    container.removeAttribute('aria-busy');
    draw();
    return () => {
      disposed = true;
      clearTimeout(refreshTimer);
      container.removeEventListener('click',click);
      container.removeEventListener('change',change);
      wide.removeEventListener('change',paintSelection);
      window.removeEventListener('regen:live-change',onLive);
      window.removeEventListener('regen:reconcile',onLive);
    };
  }

  async function choose(selected, onApply) {
    const previous = document.activeElement;
    const dialog = document.createElement('dialog');
    dialog.className = 'design-dialog';
    dialog.setAttribute('aria-labelledby','template-dialog-title');
    dialog.innerHTML = '<header class="design-dialog-heading"><h1 id="template-dialog-title">Resume designs</h1><button type="button" class="btn btn-secondary" data-close-design>Close</button></header><div class="template-picker"></div><p class="workspace-message" role="status"></p>';
    dialog.querySelector('[data-close-design]').onclick = () => dialog.close();
    let dispose;
    dialog.addEventListener('close', () => {
      dispose?.();
      dialog.remove();
      if (previous?.isConnected) previous.focus();
    }, {once:true});
    document.body.append(dialog);
    dialog.showModal();
    try {
      dispose = await render(dialog.querySelector('.template-picker'), selected, {onApply:async id => { await onApply(id); dialog.close(); }});
    } catch (error) {
      dialog.querySelector('.template-picker').innerHTML = '';
      dialog.querySelector('.workspace-message').textContent = error.message;
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const picker = document.getElementById('template-picker');
    if (!picker) return;
    const session = Api.getMe();
    try {
      const initial = await load();
      if (initial.primaryResumeId) { location.replace('/builder?id=' + initial.primaryResumeId); return; }
      let selected = new URLSearchParams(location.search).get('template');
      if (!selected) try { selected = sessionStorage.getItem('regen:onboarding-template'); } catch {}
      await render(picker, selected, {initial, creating:true, onApply:async id => {
        const me = await session;
        if (!me.success) throw new Error('Sign in again to create your resume.');
        const result = await Api.createResume('',id);
        if (!result.success) throw new Error(result.message || 'Unable to create your resume.');
        try { sessionStorage.removeItem('regen:onboarding-template'); } catch {}
        location.href = '/builder?id=' + result.data.id;
      }});
    } catch (error) {
      picker.removeAttribute('aria-busy');
      document.getElementById('template-message').textContent = error.message;
    }
  });
  window.addEventListener('regen:session-expired', () => { cached = null; });
  return {catalog: async () => (await load()).data, render, choose};
})();
