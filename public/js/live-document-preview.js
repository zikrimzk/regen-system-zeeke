/* Keep the current PDF visible until the newest draft has finished painting. */
window.LiveDocumentPreview = (() => {
  let enabled = false;
  window.addEventListener('regen:preview-availability', event => { enabled = event.detail.available; });

  function allowed() {
    const price = window.ReGenTokens?.getPrice('document_preview');
    return enabled && price && (price.mode === 'free' || price.unlocked || price.packageUnlocked) && !price.hiddenByPackage;
  }

  function create(host, load) {
    const t = key => ReGenText.get('studio.' + key);
    const status = document.createElement('p');
    status.className = 'live-proof-status';
    status.setAttribute('role', 'status');
    const retryButton = document.createElement('button');
    retryButton.type = 'button';
    retryButton.className = 'btn btn-secondary btn-sm';
    retryButton.textContent = ReGenText.get('common.retry');
    retryButton.hidden = true;
    host.append(status, retryButton);
    let revision = 0, timer, request, current, staging, displayed = '', queued = '', latest, zoom = 1;

    function cancel() {
      revision++;
      clearTimeout(timer);
      request?.abort();
      if (staging) { PdfPages.clear(staging); staging.remove(); staging = null; }
      queued = '';
      host.setAttribute('aria-busy', 'false');
    }

    function clear(message = '') {
      cancel();
      if (current) { PdfPages.clear(current); current.remove(); current = null; }
      latest = null;
      displayed = '';
      retryButton.hidden = true;
      status.textContent = message;
      host.removeAttribute('data-page-count');
    }

    async function render(payload, key, version, interactive) {
      if (version !== revision) return;
      request = new AbortController();
      host.setAttribute('aria-busy', 'true');
      status.textContent = t(current ? 'pdfUpdating' : 'pdfLoading');
      try {
        const bytes = await load(payload, {signal: request.signal, interactive});
        if (version !== revision) return;
        const next = document.createElement('div');
        next.className = 'pdf-pages live-proof-staging';
        next.setAttribute('aria-hidden', 'true');
        host.append(next);
        staging = next;
        const painted = await PdfPages.render(next, bytes, {zoom});
        if (version !== revision) return;
        if (!painted) throw new Error('Could not paint PDF');
        if (current) { PdfPages.clear(current); current.remove(); }
        current = next;
        staging = null;
        next.classList.remove('live-proof-staging');
        next.removeAttribute('aria-hidden');
        displayed = key;
        host.dataset.pageCount = next.dataset.pageCount;
        status.textContent = t('pdfReady');
      } catch (error) {
        if (version !== revision || error.name === 'AbortError') return;
        if (staging) { PdfPages.clear(staging); staging.remove(); staging = null; }
        status.textContent = t(!navigator.onLine ? 'pdfOffline' : error.status === 429 ? 'pdfSlow' : 'pdfFailed');
        retryButton.hidden = false;
      } finally {
        if (version === revision) {
          queued = '';
          host.setAttribute('aria-busy', 'false');
        }
      }
    }

    function update(payload, {immediate = false, interactive = false, force = false} = {}) {
      const key = JSON.stringify(payload);
      latest = {payload, interactive};
      if (!force && key === queued) return;
      if (!force && key === displayed) {
        if (queued) cancel();
        retryButton.hidden = true;
        status.textContent = t('pdfReady');
        return;
      }
      cancel();
      queued = key;
      retryButton.hidden = true;
      const version = revision;
      if (immediate) void render(payload, key, version, interactive);
      else timer = setTimeout(() => render(payload, key, version, interactive), 1900);
    }

    retryButton.onclick = () => {
      if (latest) update(latest.payload, {immediate:true, interactive:latest.interactive, force:true});
    };
    return {
      update, clear,
      zoom(value) { zoom = value; if (current) PdfPages.zoom(current, zoom); if (staging) PdfPages.zoom(staging, zoom); },
    };
  }
  return {allowed, create};
})();
