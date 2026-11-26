/* Render the original PDF at the display's actual pixel density, including zoom. */
window.PdfPages = (() => {
  let library;
  let libraryAttempts=0;
  const libraryVersion=new URL(document.currentScript?.src||location.href).searchParams.get('v')||'pdf1';
  const tasks = new WeakMap();
  const pageWidth = 794, maxPixels = 12_000_000;
  const safeZoom = value => Number.isFinite(Number(value)) ? Math.max(.5, Math.min(2, Number(value))) : 1;
  const current = state => tasks.get(state.container) === state && !state.abort.signal.aborted && state.container.isConnected;
  function clear(container) {
    const state = tasks.get(container); if (!state) return;
    tasks.delete(container); state.abort.abort(); clearTimeout(state.timer); state.resize?.disconnect(); state.inView?.disconnect();
    window.removeEventListener('resize', state.onResize);
    window.visualViewport?.removeEventListener('resize', state.onResize);
    state.densityQuery?.removeEventListener('change', state.onDensity);
    state.renderTask?.cancel();
    const destruction = state.loading?.destroy(); destruction?.catch(() => {});
    state.items.forEach(item => { item.canvas.width = item.canvas.height = 0; });
    container.replaceChildren(); container.removeAttribute('data-page-count'); container.setAttribute('aria-busy', 'false');
  }
  function dimensions(state) {
    const width = Math.max(1, Math.round(Math.min(pageWidth, state.container.clientWidth || pageWidth) * state.zoom));
    const density = Math.max(1, Math.min(4, (window.devicePixelRatio || 1) * (window.visualViewport?.scale || 1)));
    return {width, density, key: `${width}:${density}`};
  }
  function layout(state) {
    const size = dimensions(state);
    state.items.forEach(item => { item.figure.style.width = `${size.width}px`; });
    return size;
  }
  async function paint(state, item, size) {
    const base = item.page.getViewport({scale: 1});
    const pixels = Math.min(size.width * size.density, Math.sqrt(maxPixels * base.width / base.height), 4095 / Math.max(1, base.height / base.width));
    const viewport = item.page.getViewport({scale: pixels / base.width});
    const width = Math.ceil(viewport.width), height = Math.ceil(viewport.height);
    if (item.painted && item.canvas.width === width && item.canvas.height === height) return;
    // Keep the previous page visible until the sharper replacement is complete.
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', `PDF page ${item.number} of ${state.pdf.numPages}`);
    state.renderTask = item.page.render({canvasContext: canvas.getContext('2d', {alpha: false}), viewport, background: '#ffffff'});
    await state.renderTask.promise; if (!current(state)) return;
    state.renderTask = null; item.canvas.replaceWith(canvas);
    item.canvas.width = item.canvas.height = 0; item.canvas = canvas;
    if (!item.painted) {
      const content = await item.page.getTextContent();
      if (!current(state)) return;
      item.accessible.textContent = content.items.map(entry => entry.str || '').join(' ');
    }
    item.painted = true;
    item.page.cleanup();
  }
  async function repaint(state) {
    if (!current(state) || state.rendering) return;
    state.rendering = true; state.container.setAttribute('aria-busy', 'true');
    try {
      do {
        state.dirty = false;
        const size = dimensions(state);
        for (const item of state.items) {
          if (!current(state)) return;
          if (item.requested) await paint(state, item, size);
        }
      } while (state.dirty && current(state));
    } catch (error) {
      if (current(state) && error.name !== 'RenderingCancelledException') {
        const message = document.createElement('p'); message.className = 'pdf-status'; message.setAttribute('role', 'status');
        message.textContent = 'Unable to refresh the preview. Reopen it to try again.'; state.container.append(message);
      }
    } finally {
      state.rendering = false;
      if (current(state)) state.container.setAttribute('aria-busy', 'false');
    }
  }
  function schedule(state) {
    if (!current(state)) return;
    const size = dimensions(state); if (size.key === state.layoutKey) return;
    layout(state);
    state.layoutKey = size.key; state.dirty = true; state.container.setAttribute('aria-busy', 'true');
    clearTimeout(state.timer); state.timer = setTimeout(() => repaint(state), 120);
  }
  function watchDensity(state) {
    state.densityQuery?.removeEventListener('change', state.onDensity);
    state.densityQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    state.densityQuery.addEventListener('change', state.onDensity, {once: true});
  }
  async function render(container, source, {zoom = 1, scrollRoot = null, onPageCount = null} = {}) {
    if (!container) return; clear(container);
    const state = {container, abort: new AbortController(), pdf: null, loading: null, renderTask: null,
      items: [], zoom: safeZoom(zoom), rendering: true, dirty: false, timer: null, resize: null, onResize: null,
      densityQuery: null, onDensity: null, inView: null};
    tasks.set(container, state); container.setAttribute('aria-busy', 'true');
    const status = document.createElement('p'); status.className = 'pdf-status'; status.setAttribute('role', 'status');
    status.textContent = 'Preparing your PDF preview…'; container.append(status);
    try {
      if(!library){const attempt=libraryAttempts++;library=import('/lib/pdfjs/pdf.min.mjs?v='+encodeURIComponent(libraryVersion)+(attempt?'&retry='+attempt:'')).catch(error=>{library=null;throw error;});}
      const pdfjs = await library; if (!current(state)) return;
      pdfjs.GlobalWorkerOptions.workerSrc = '/lib/pdfjs/pdf.worker.min.mjs?v='+encodeURIComponent(libraryVersion);
      let data = source;
      if (typeof source === 'string') {
        const response = await (window.ReGenTokens?.fetch||fetch)(source, {credentials: 'same-origin', cache: 'no-store', signal: state.abort.signal});
        if (!response.ok || !response.headers.get('content-type')?.includes('application/pdf')) throw new Error('The preview could not be loaded. Please try again.');
        data = new Uint8Array(await response.arrayBuffer());
      }
      if (!current(state)) return;
      state.loading = pdfjs.getDocument({data: data.slice(), standardFontDataUrl: '/lib/pdfjs/standard_fonts/', useWasm: false, isEvalSupported: false});
      state.pdf = await state.loading.promise; if (!current(state)) { await state.loading.destroy(); return; }
      container.dataset.pageCount = state.pdf.numPages;
      onPageCount?.(state.pdf.numPages);
      state.layoutKey = dimensions(state).key;
      state.onResize = () => schedule(state);
      state.onDensity = () => { watchDensity(state); schedule(state); }; watchDensity(state);
      state.resize = new ResizeObserver(state.onResize); state.resize.observe(container);
      window.addEventListener('resize', state.onResize); window.visualViewport?.addEventListener('resize', state.onResize);
      if (scrollRoot && typeof IntersectionObserver !== 'undefined') {
        state.inView = new IntersectionObserver(entries => {
          if (!current(state)) return;
          const near = entries.filter(entry => entry.isIntersecting);
          if (!near.length) return;
          for (const {target} of near) {
            const item = state.items[Number(target.dataset.page) - 1];
            item.requested = true;
            state.inView.unobserve(target);
          }
          state.dirty = true;
          void repaint(state);
        }, {root: scrollRoot, rootMargin: '220px 0px'});
      }
      for (let number = 1; number <= state.pdf.numPages; number++) {
        if (!current(state)) return;
        const page = await state.pdf.getPage(number); if (!current(state)) return;
        const figure = document.createElement('figure'); figure.className = 'pdf-page';
        figure.style.maxWidth = 'none'; figure.style.alignSelf = 'flex-start'; figure.style.margin = '0 auto';
        const canvas = document.createElement('canvas'), base = page.getViewport({scale: 1});
        canvas.width = 0; canvas.height = 0;
        canvas.style.aspectRatio = `${base.width} / ${base.height}`;
        const caption = document.createElement('figcaption'); caption.textContent = `Page ${number} of ${state.pdf.numPages}`;
        const accessible = document.createElement('div'); accessible.className = 'sr-only';
        figure.append(canvas, accessible, caption); container.insertBefore(figure, status);
        const requested = !state.inView || number === 1;
        const item = {number, page, figure, canvas, accessible, requested, painted: false};
        const size = dimensions(state);
        state.items.push(item);
        figure.style.width = `${size.width}px`;
        if (requested) { await paint(state, item, size); if (!current(state)) return; }
        else { figure.dataset.page = number; state.inView.observe(figure); }
        status.textContent = number === state.pdf.numPages ? '' : `Preparing page ${number + 1} of ${state.pdf.numPages}…`;
      }
      status.remove();
      return true;
    } catch (error) {
      if (!current(state)) return;
      console.error('PDF preview failed:',error);
      status.textContent = 'The PDF preview could not be loaded. Try again or reopen the document.';
      const retry = document.createElement('button'); retry.className = 'btn btn-secondary'; retry.textContent = 'Retry preview';
      retry.onclick = () => render(container, source, {zoom: state.zoom, scrollRoot, onPageCount}); container.append(retry);
    } finally {
      state.rendering = false;
      if (current(state)) {
        container.setAttribute('aria-busy', 'false');
        if (state.dirty) repaint(state);
      }
    }
  }
  function zoom(container, value) {
    const state = tasks.get(container); if (!state) return;
    state.zoom = safeZoom(value); schedule(state);
  }
  return {render, zoom, clear};
})();
