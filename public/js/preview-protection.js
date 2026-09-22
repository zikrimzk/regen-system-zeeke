/**
 * Best-effort protection for resume previews rendered in same-origin iframes.
 * Browser controls and operating-system capture tools cannot be fully blocked.
 */
window.PreviewProtection = (() => {
  const surfaces = new Set();
  const protectedDocuments = new WeakSet();
  const blockedPointerEvents = ['contextmenu', 'copy', 'cut', 'dragstart', 'selectstart'];
  let globalListenersBound = false;
  let revealTimer = null;

  function cancelEvent(event) {
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
  }

  function isActive(surface) {
    if (!surface.container.isConnected || !surface.iframe.isConnected) {
      surfaces.delete(surface);
      return false;
    }
    if (typeof surface.isActive === 'function' && !surface.isActive()) return false;
    return surface.container.getClientRects().length > 0;
  }

  function activeSurfaces() {
    return Array.from(surfaces).filter(isActive);
  }

  function obscure(surface, message = 'Preview hidden while the window is inactive.') {
    if (!surface.container.isConnected) return;
    surface.container.dataset.previewProtectionMessage = message;
    surface.container.classList.add('is-preview-obscured');
    try {
      surface.iframe.contentDocument?.documentElement.classList.add('preview-document-obscured');
    } catch (error) {
      // The parent overlay remains effective if a browser denies frame access.
    }
  }

  function reveal(surface, { force = false } = {}) {
    if (!force && (document.hidden || !document.hasFocus())) return;
    surface.container.classList.remove('is-preview-obscured');
    try {
      surface.iframe.contentDocument?.documentElement.classList.remove('preview-document-obscured');
    } catch (error) {
      // The frame can be replaced while a preview request is in flight.
    }
  }

  function obscureAll(message, autoRevealMs = 0) {
    clearTimeout(revealTimer);
    activeSurfaces().forEach(surface => obscure(surface, message));
    if (autoRevealMs > 0) {
      revealTimer = setTimeout(() => {
        activeSurfaces().forEach(surface => reveal(surface));
      }, autoRevealMs);
    }
  }

  function scheduleReveal() {
    clearTimeout(revealTimer);
    revealTimer = setTimeout(() => {
      activeSurfaces().forEach(surface => reveal(surface));
    }, 240);
  }

  function surfaceForCopyShortcut() {
    return activeSurfaces().find(surface => (
      surface.pointerInside || surface.container.contains(document.activeElement)
    ));
  }

  function handleShortcut(event) {
    const key = String(event.key || '').toLowerCase();
    const modified = event.ctrlKey || event.metaKey;
    const active = activeSurfaces();
    if (!active.length) return;

    if (key === 'printscreen') {
      cancelEvent(event);
      obscureAll('Preview briefly hidden during a capture request.', 1400);
      return;
    }

    if (!modified) return;
    if (key === 'p' || key === 's') {
      cancelEvent(event);
      obscureAll('Printing and browser export are unavailable from preview.', 1100);
      return;
    }
    if (['a', 'c', 'x'].includes(key) && surfaceForCopyShortcut()) cancelEvent(event);
  }

  function bindGlobalListeners() {
    if (globalListenersBound) return;
    globalListenersBound = true;
    document.addEventListener('keydown', handleShortcut, true);
    window.addEventListener('blur', () => {
      obscureAll('Preview hidden while the window is inactive.');
    });
    window.addEventListener('focus', scheduleReveal);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) obscureAll('Preview hidden while the page is inactive.');
      else scheduleReveal();
    });
    window.addEventListener('beforeprint', () => {
      obscureAll('Preview unavailable in print.');
    });
    window.addEventListener('afterprint', scheduleReveal);
  }

  function sanitizeHtml(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(String(html || ''), 'text/html');
    doc.querySelectorAll([
      'script',
      'base',
      'iframe',
      'object',
      'embed',
      'form',
      'meta[http-equiv="refresh" i]',
      'link',
    ].join(',')).forEach(element => element.remove());
    doc.querySelectorAll('*').forEach((element) => {
      Array.from(element.attributes).forEach((attribute) => {
        if (/^on/i.test(attribute.name) || ['formaction', 'ping', 'srcdoc'].includes(attribute.name.toLowerCase())) {
          element.removeAttribute(attribute.name);
        }
      });
    });
    doc.documentElement.classList.add('preview-document-protected');
    if (!doc.head.querySelector('link[data-preview-protection]')) {
      const stylesheet = doc.createElement('link');
      stylesheet.rel = 'stylesheet';
      stylesheet.href = '/css/preview-protection.css?v=20260801c';
      stylesheet.dataset.previewProtection = 'true';
      doc.head.appendChild(stylesheet);
    }
    return `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`;
  }

  function setFrameHtml(iframe, html) {
    if (!iframe) return false;
    iframe.setAttribute('sandbox', 'allow-same-origin');
    iframe.setAttribute('tabindex', '-1');
    iframe.setAttribute('draggable', 'false');
    iframe.removeAttribute('src');
    iframe.srcdoc = sanitizeHtml(html);
    return true;
  }

  async function loadUrl(iframe, url, { shouldCommit } = {}) {
    let target;
    try {
      target = new URL(url, window.location.href);
    } catch (error) {
      return { success: false, message: 'Preview URL is invalid.' };
    }
    if (target.origin !== window.location.origin) {
      return { success: false, message: 'Cross-origin previews are not allowed.' };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(target.href, {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { Accept: 'text/html' },
        signal: controller.signal,
      });
      if (response.status === 401) window.dispatchEvent(new CustomEvent('regen:session-expired'));
      if (!response.ok) return { success: false, message: 'Preview is temporarily unavailable.' };
      const contentType = String(response.headers.get('content-type') || '').toLowerCase();
      if (contentType && !contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
        return { success: false, message: 'Preview returned an unexpected response.' };
      }
      const html = await response.text();
      if (typeof shouldCommit === 'function' && !shouldCommit()) {
        return { success: false, stale: true };
      }
      setFrameHtml(iframe, html);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.name === 'AbortError'
          ? 'Preview loading took too long.'
          : 'Preview is temporarily unavailable.',
      };
    } finally {
      clearTimeout(timer);
    }
  }

  function protectFrameDocument(surface) {
    let doc;
    let frameWindow;
    try {
      doc = surface.iframe.contentDocument;
      frameWindow = surface.iframe.contentWindow;
    } catch (error) {
      return;
    }
    if (!doc?.documentElement || protectedDocuments.has(doc)) return;
    protectedDocuments.add(doc);
    doc.documentElement.classList.add('preview-document-protected');
    if (doc.body) doc.body.draggable = false;
    doc.querySelectorAll('img').forEach((image) => { image.draggable = false; });
    blockedPointerEvents.forEach((type) => doc.addEventListener(type, cancelEvent, true));
    doc.addEventListener('keydown', handleShortcut, true);
    frameWindow?.addEventListener('beforeprint', () => obscure(surface, 'Preview unavailable in print.'));
    frameWindow?.addEventListener('afterprint', scheduleReveal);
    try {
      frameWindow.print = () => obscure(surface, 'Printing is unavailable from preview.');
    } catch (error) {
      // Browser print UI is still covered by beforeprint and print styles.
    }
  }

  function register({ iframe, container, isActive: activeCheck } = {}) {
    if (!iframe || !container) return null;
    const surface = {
      iframe,
      container,
      isActive: activeCheck,
      pointerInside: false,
    };
    surfaces.add(surface);
    container.classList.add('preview-protection-surface');
    container.dataset.previewProtectionMessage = 'Preview hidden while the window is inactive.';
    iframe.setAttribute('sandbox', 'allow-same-origin');
    iframe.setAttribute('tabindex', '-1');
    iframe.setAttribute('draggable', 'false');
    blockedPointerEvents.forEach((type) => container.addEventListener(type, cancelEvent, true));
    container.addEventListener('pointerenter', () => { surface.pointerInside = true; });
    container.addEventListener('pointerleave', () => { surface.pointerInside = false; });
    iframe.addEventListener('load', () => protectFrameDocument(surface));
    bindGlobalListeners();
    return {
      activate() {
        reveal(surface);
        protectFrameDocument(surface);
      },
      deactivate() {
        reveal(surface, { force: true });
      },
      obscure(message) {
        obscure(surface, message);
      },
    };
  }

  return { loadUrl, register, sanitizeHtml, setFrameHtml };
})();
