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
    const toolbar = document.createElement('div');
    toolbar.className = 'live-proof-toolbar';
    const retryButton = document.createElement('button');
    retryButton.type = 'button';
    retryButton.className = 'btn btn-secondary btn-sm';
    retryButton.textContent = ReGenText.get('common.retry');
    retryButton.hidden = true;
    toolbar.append(status, retryButton);
    host.append(toolbar);
    let revision = 0, timer, request, automatic, trailing, current, staging, displayed = '', queued = '', latest, zoom = 1;

    function cancel(abort = true) {
      revision++;
      clearTimeout(timer);
      if (abort) request?.abort();
      trailing = null;
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
      if (!interactive && automatic) {
        trailing = {payload, key, version};
        return;
      }
      const controller = new AbortController();
      request = controller;
      if (!interactive) automatic = controller;
      host.setAttribute('aria-busy', 'true');
      status.textContent = t(current ? 'pdfUpdating' : 'pdfLoading');
      try {
        const bytes = await load(payload, {signal: controller.signal, interactive});
        if (version !== revision) return;
        const next = document.createElement('div');
        next.className = 'pdf-pages live-proof-staging';
        next.setAttribute('aria-hidden', 'true');
        host.append(next);
        staging = next;
        const painted = await PdfPages.render(next, bytes, {zoom});
        if (version !== revision) return;
        if (!painted) throw new Error('Could not paint PDF');
        const previous = current;
        current = next;
        staging = null;
        next.classList.remove('live-proof-staging');
        next.removeAttribute('aria-hidden');
        if (previous) {
          previous.replaceWith(next);
          PdfPages.clear(previous);
        }
        displayed = key;
        host.dataset.pageCount = next.dataset.pageCount;
        status.textContent = t('pdfReady');
      } catch (error) {
        if (version !== revision || error.name === 'AbortError') return;
        if (staging) { PdfPages.clear(staging); staging.remove(); staging = null; }
        status.textContent = t(!navigator.onLine ? 'pdfOffline' : error.status === 429 ? 'pdfSlow' : 'pdfFailed');
        retryButton.hidden = false;
      } finally {
        if (request === controller) request = null;
        if (version === revision) {
          queued = '';
          host.setAttribute('aria-busy', 'false');
        }
        if (automatic === controller) {
          automatic = null;
          const next = trailing;
          trailing = null;
          if (next) void render(next.payload, next.key, next.version, false);
        }
      }
    }

    function update(payload, {immediate = false, interactive = false, force = false} = {}) {
      const key = JSON.stringify(payload);
      latest = {payload, interactive};
      if (!force && key === queued) return;
      if (!force && key === displayed) {
        if (queued) cancel(false);
        retryButton.hidden = true;
        status.textContent = t('pdfReady');
        return;
      }
      cancel(interactive);
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
      zoom(value) {
        zoom = value;
        host.classList.toggle('live-proof-zoomed', zoom > 1);
        if (current) PdfPages.zoom(current, zoom);
        if (staging) PdfPages.zoom(staging, zoom);
      },
    };
  }
  return {allowed, create};
})();
