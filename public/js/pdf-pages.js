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
    tasks.delete(container); state.abort.abort(); clearTimeout(state.timer); state.resize?.disconnect();
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
  async function paint(state, item) {
    const size = dimensions(state), base = item.page.getViewport({scale: 1});
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
    item.canvas.width = item.canvas.height = 0; item.canvas = canvas; item.painted = true; item.page.cleanup();
  }
  async function repaint(state) {
    if (!current(state) || state.rendering) return;
    state.rendering = true; state.container.setAttribute('aria-busy', 'true');
    try {
      do {
        state.dirty = false; layout(state);
        for (const item of state.items) { if (!current(state)) return; await paint(state, item); }
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
    const size = layout(state); if (size.key === state.layoutKey) return;
    state.layoutKey = size.key; state.dirty = true; state.container.setAttribute('aria-busy', 'true');
    clearTimeout(state.timer); state.timer = setTimeout(() => repaint(state), 120);
  }
  function watchDensity(state) {
    state.densityQuery?.removeEventListener('change', state.onDensity);
    state.densityQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    state.densityQuery.addEventListener('change', state.onDensity, {once: true});
  }
  function fitAdvice(count,type,onSettings){
    const note=document.createElement('aside');note.className='pdf-fit-note';note.setAttribute('aria-label','Document length');
    const title=document.createElement('strong');title.textContent=`${count} ${count===1?'page':'pages'} in your PDF`;
    const text=document.createElement('p');
    text.textContent=type==='academic-cv'?'Academic CV length follows your discipline and application instructions. Keep relevant citations and experience readable.':type==='cover-letter'?(count>1?'Aim for one readable page. Keep the strongest examples and remove repeated resume details before changing text size.':'A one-page letter. Check the employer, role and examples before sending.'):(count>2?'Review relevance before reducing text size. Most job resumes work well in one or two pages; the employer’s instructions come first.':'A focused length for most job applications. Check relevance, reading order and spacing at full size.');
    note.append(title,text);
    if(typeof onSettings==='function'){const button=document.createElement('button');button.type='button';button.className='btn btn-secondary btn-sm';button.textContent='Settings';button.onclick=onSettings;note.append(button);}
    return note;
  }
  async function render(container, source, {zoom = 1, documentType = null, onSettings = null} = {}) {
    if (!container) return; clear(container);
    const state = {container, abort: new AbortController(), pdf: null, loading: null, renderTask: null,
      items: [], zoom: safeZoom(zoom), rendering: true, dirty: false, timer: null, resize: null, onResize: null,
      densityQuery: null, onDensity: null};
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
      container.dataset.pageCount = state.pdf.numPages; state.layoutKey = dimensions(state).key;
      state.onResize = () => schedule(state);
      state.onDensity = () => { watchDensity(state); schedule(state); }; watchDensity(state);
      state.resize = new ResizeObserver(state.onResize); state.resize.observe(container);
      window.addEventListener('resize', state.onResize); window.visualViewport?.addEventListener('resize', state.onResize);
      for (let number = 1; number <= state.pdf.numPages; number++) {
        if (!current(state)) return;
        const page = await state.pdf.getPage(number); if (!current(state)) return;
        const figure = document.createElement('figure'); figure.className = 'pdf-page';
        figure.style.maxWidth = 'none'; figure.style.alignSelf = 'flex-start'; figure.style.margin = '0 auto';
        const canvas = document.createElement('canvas'), base = page.getViewport({scale: 1});
        canvas.width = Math.ceil(base.width); canvas.height = Math.ceil(base.height);
        const caption = document.createElement('figcaption'); caption.textContent = `Page ${number} of ${state.pdf.numPages}`;
        const accessible = document.createElement('div'); accessible.className = 'sr-only';
        accessible.textContent = (await page.getTextContent()).items.map(item => item.str || '').join(' ');
        figure.append(canvas, accessible, caption); container.insertBefore(figure, status);
        const item = {number, page, figure, canvas, painted: false}; state.items.push(item); layout(state);
        await paint(state, item); if (!current(state)) return;
        status.textContent = number === state.pdf.numPages ? '' : `Preparing page ${number + 1} of ${state.pdf.numPages}…`;
      }
      status.remove();
      if (documentType) container.prepend(fitAdvice(state.pdf.numPages, documentType, onSettings));
    } catch (error) {
      if (!current(state)) return;
      console.error('PDF preview failed:',error);
      status.textContent = 'The PDF preview could not be loaded. Try again or reopen the document.';
      const retry = document.createElement('button'); retry.className = 'btn btn-secondary'; retry.textContent = 'Retry preview';
      retry.onclick = () => render(container, source, {zoom: state.zoom, documentType, onSettings}); container.append(retry);
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
