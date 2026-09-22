/**
 * api.js — Frontend API Client for v2
 */
const Api = (() => {
  let csrfToken = '';

  async function _fetch(url, { timeoutMs = 15000, ...options } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const method = String(options.method || 'GET').toUpperCase();
      const hasBody = options.body !== undefined && options.body !== null;
      const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
      const res = await fetch(url, {
        ...options,
        credentials: 'same-origin',
        signal: controller.signal,
        headers: {
          ...(hasBody && !isFormData ? { 'Content-Type': 'application/json' } : {}),
          ...(!['GET', 'HEAD', 'OPTIONS'].includes(method) && csrfToken
            ? { 'X-CSRF-Token': csrfToken }
            : {}),
          ...(options.headers || {})
        }
      });
      const text = await res.text();
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch (err) {
        data = { success: false, message: res.ok ? 'Invalid server response.' : 'Server request failed.' };
      }
      if (typeof data.csrfToken === 'string' && data.csrfToken) csrfToken = data.csrfToken;
      if (!res.ok && data.success !== false) data.success = false;
      const isPublicAuthRequest = [
        '/api/auth/login',
        '/api/auth/register',
        '/api/auth/email-verification/',
      ].some(prefix => url.startsWith(prefix));
      if (res.status === 401 && !isPublicAuthRequest) {
        window.dispatchEvent(new CustomEvent('regen:session-expired'));
      }
      return { ...data, status: res.status };
    } catch (err) {
      console.error('API Error:', err);
      return {
        success: false,
        message: err.name === 'AbortError'
          ? 'The request took too long. Please try again.'
          : 'Unable to reach the server. Please try again.',
      };
    } finally {
      clearTimeout(timer);
    }
  }

  // ── Auth ──────────────────────────────────────────────────────
  const login    = (data) => _fetch('/api/auth/login', { method: 'POST', body: JSON.stringify(data) });
  const register = (data) => _fetch('/api/auth/register', { method: 'POST', body: JSON.stringify(data) });
  const getRecaptchaConfig = () => _fetch('/api/auth/recaptcha/config', { timeoutMs: 8000 });
  const verifyEmail = (token) => _fetch('/api/auth/email-verification/verify', {
    method: 'POST',
    body: JSON.stringify({ token }),
    timeoutMs: 12000,
  });
  const resendEmailVerification = (data) => _fetch('/api/auth/email-verification/resend', {
    method: 'POST',
    body: JSON.stringify(data),
    timeoutMs: 12000,
  });
  const logout   = () => _fetch('/api/auth/logout', { method: 'POST' });
  const getMe    = () => _fetch('/api/auth/me');

  // ── Dashboard ─────────────────────────────────────────────────
  const listResumes  = () => _fetch('/api/dashboard');
  const createResume = (title = '') => _fetch('/api/dashboard', { method: 'POST', body: JSON.stringify({ title }) });
  const renameResume = (id, title) => _fetch(`/api/dashboard/${id}/title`, { method: 'PATCH', body: JSON.stringify({ title }) });
  const deleteResume = (id) => _fetch(`/api/dashboard/${id}`, { method: 'DELETE' });

  // ── Builder (requires ID) ─────────────────────────────────────
  let _resumeId = null;
  function setResumeId(id) { _resumeId = id; }
  function getResumeId() { return _resumeId; }

  const getResume   = () => _fetch(`/api/resume/${_resumeId}`);
  const saveSection = (section, data) => _fetch(`/api/resume/${_resumeId}/section`, {
    method: 'POST', body: JSON.stringify({ section, data })
  });
  const getAIStatus = () => _fetch('/api/ai/status', { timeoutMs: 8000 });
  const suggestResumeSection = (data) => _fetch(`/api/resume/${_resumeId}/ai-suggest`, {
    method: 'POST',
    body: JSON.stringify(data),
    timeoutMs: 34000,
  });
  const getAtsReviewState = (resumeId = _resumeId) => _fetch(`/api/resume/${resumeId}/ats-review`, {
    method: 'GET',
    timeoutMs: 10000,
  });
  const generateAtsReview = (resumeId = _resumeId) => _fetch(`/api/resume/${resumeId}/ats-review`, {
    method: 'POST',
    body: '{}',
    timeoutMs: 34000,
  });

  const uploadPhoto = async (file) => {
    const formData = new FormData();
    formData.append('photo', file);
    return _fetch(`/api/resume/${_resumeId}/photo`, {
      method: 'POST',
      body: formData,
      timeoutMs: 25000,
    });
  };
  const deletePhoto = () => _fetch(`/api/resume/${_resumeId}/photo`, { method: 'DELETE' });

  // ── URLs ──────────────────────────────────────────────────────
  const previewUrl = () => `/api/pdf/${_resumeId}/preview`;
  const pdfUrl     = () => `/api/pdf/${_resumeId}/generate`;
  const previewDraft = async (resumeData) => {
    try {
      const res = await fetch(`/api/pdf/${_resumeId}/preview-data`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
        body: JSON.stringify({ resumeData }),
      });
      if (!res.ok) return { success: false, html: '' };
      return { success: true, html: await res.text() };
    } catch (err) {
      console.error('Preview Draft Error:', err);
      return { success: false, html: '' };
    }
  };

  async function downloadPdf(button, filename = 'resume.pdf', resumeId = _resumeId) {
    const originalText = button?.textContent;
    const originalHtml = button?.innerHTML;
    if (button) {
      button.disabled = true;
      button.textContent = 'Preparing PDF...';
    }

    try {
      const res = await fetch(`/api/pdf/${resumeId}/generate`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error('PDF download failed.');

      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="([^"]+)"/i);
      const safeFilename = match?.[1] || filename;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = safeFilename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      return { success: true };
    } catch (err) {
      console.error('PDF Download Error:', err);
      return { success: false, message: err.message || 'PDF download failed.' };
    } finally {
      if (button) {
        button.disabled = false;
        if (originalHtml !== undefined) button.innerHTML = originalHtml;
        else button.textContent = originalText;
      }
    }
  }

  return {
    login, register, getRecaptchaConfig, verifyEmail, resendEmailVerification, logout, getMe,
    listResumes, createResume, renameResume, deleteResume,
    setResumeId, getResumeId,
    getResume, saveSection, uploadPhoto, deletePhoto,
    getAIStatus, suggestResumeSection, getAtsReviewState, generateAtsReview,
    previewUrl, pdfUrl, previewDraft, downloadPdf,
  };
})();

window.addEventListener('regen:session-expired', () => {
  if (['/login', '/register', '/verify-email'].includes(window.location.pathname)) return;
  window.location.replace('/login?expired=1');
}, { once: true });

window.ReGenIcons = (() => {
  const paths = {
    add: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 15H6L5 6"/><path d="M10 11v5"/><path d="M14 11v5"/>',
    upload: '<path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M5 20h14"/>',
    arrowRight: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
    arrowLeft: '<path d="M19 12H5"/><path d="m11 18-6-6 6-6"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    retry: '<path d="M20 6v5h-5"/><path d="M19 11a7 7 0 1 0 1 5"/>',
    sparkles: '<path d="m12 3 1.2 3.3L16.5 7.5l-3.3 1.2L12 12l-1.2-3.3-3.3-1.2 3.3-1.2z"/><path d="m18.5 13 0.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/><path d="m6 13 1.1 2.9L10 17l-2.9 1.1L6 21l-1.1-2.9L2 17l2.9-1.1z"/>',
    eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="m3 3 18 18"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-2.2 3.1"/><path d="M6.2 6.2C3.5 8 2 12 2 12s3.5 7 10 7a10.8 10.8 0 0 0 3-.4"/>',
  };

  function icon(name) {
    return `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || ''}</svg>`;
  }

  return { icon };
})();

window.ZeekeSafe = (() => {
  const BULLET_RE = /^[\s>]*(?:[•●○◦▪▫■□‣⁃*]|[-–—]{1,2}|\d{1,3}[.)]|[a-zA-Z][.)])\s+/;
  const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200D\uFEFF]/g;

  function attr(value) {
    return String(value || '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[ch]));
  }

  function cleanText(value, { multiline = false } = {}) {
    const normalized = String(value || '')
      .normalize('NFKC')
      .replace(CONTROL_RE, '')
      .replace(/\u00A0/g, ' ')
      .replace(/\r\n?/g, '\n')
      .replace(/\t/g, ' ');

    const lines = normalized.split('\n')
      .map(line => line.replace(BULLET_RE, '').replace(/[ ]{2,}/g, ' ').trim())
      .filter(Boolean);

    return multiline ? lines.join('\n') : lines.join(' ').replace(/[ ]{2,}/g, ' ').trim();
  }

  function cleanElement(el) {
    if (!shouldSanitize(el)) return el?.value || '';
    return cleanText(el.value, { multiline: el.tagName === 'TEXTAREA' });
  }

  function shouldSanitize(el) {
    if (!el || !('value' in el)) return false;
    if (el.dataset?.preserveSpaces === 'true') return false;
    const type = String(el.type || '').toLowerCase();
    return !['password', 'file', 'checkbox', 'radio', 'month', 'date', 'time'].includes(type);
  }

  function setCleanValue(el) {
    if (!shouldSanitize(el)) return;
    const next = cleanElement(el);
    if (el.value !== next) el.value = next;
    autoGrow(el);
  }

  function autoGrow(el) {
    if (!el || el.tagName !== 'TEXTAREA' || !el.classList.contains('list-item-input')) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(44, el.scrollHeight)}px`;
  }

  function bindFormSanitizer(root = document) {
    root.addEventListener('paste', (event) => {
      const el = event.target;
      if (!shouldSanitize(el)) return;
      const text = event.clipboardData?.getData('text/plain');
      if (typeof text !== 'string') return;
      event.preventDefault();
      const cleaned = cleanText(text, { multiline: el.tagName === 'TEXTAREA' });
      const type = String(el.type || '').toLowerCase();
      const supportsSelection = el.tagName === 'TEXTAREA'
        || ['text', 'search', 'tel', 'url'].includes(type);
      if (
        supportsSelection
        && typeof el.setRangeText === 'function'
        && Number.isInteger(el.selectionStart)
        && Number.isInteger(el.selectionEnd)
      ) {
        el.setRangeText(cleaned, el.selectionStart, el.selectionEnd, 'end');
      } else {
        el.value = cleaned;
      }
      autoGrow(el);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, true);

    root.addEventListener('blur', (event) => setCleanValue(event.target), true);
    root.addEventListener('input', (event) => autoGrow(event.target), true);
  }

  function refreshTextareas(root = document) {
    root.querySelectorAll('textarea.list-item-input').forEach(autoGrow);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => bindFormSanitizer(document), { once: true });
  } else {
    bindFormSanitizer(document);
  }

  return { attr, cleanText, value: cleanElement, setCleanValue, refreshTextareas };
})();

window.ZeekeAccountMenu = (() => {
  function init({ userName = 'User', initials = 'U', photoBase64 = '' } = {}) {
    const toggle = document.getElementById('account-menu-toggle');
    const panel = document.getElementById('account-menu-panel');
    const nameEl = document.getElementById('topbar-user-name');
    const avatar = document.getElementById('topbar-avatar');
    const logout = document.getElementById('account-menu-logout');
    if (!toggle || !panel || !avatar) return;

    if (nameEl) nameEl.textContent = userName || 'User';
    avatar.dataset.initials = initials || 'U';
    avatar.textContent = initials || 'U';
    avatar.style.backgroundImage = '';
    avatar.classList.remove('has-image');

    if (photoBase64) {
      avatar.textContent = '';
      avatar.style.backgroundImage = `url("${photoBase64}")`;
      avatar.classList.add('has-image');
    }

    if (!toggle.dataset.accountBound) {
      toggle.dataset.accountBound = 'true';
      toggle.addEventListener('click', (event) => {
        event.stopPropagation();
        const isOpen = !panel.classList.contains('hidden');
        panel.classList.toggle('hidden', isOpen);
        toggle.setAttribute('aria-expanded', String(!isOpen));
      });

      document.addEventListener('click', () => close(toggle, panel));
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') close(toggle, panel);
      });

      logout?.addEventListener('click', async () => {
        await Api.logout();
        window.location.href = '/login';
      });
    }
  }

  function close(toggle, panel) {
    panel.classList.add('hidden');
    toggle.setAttribute('aria-expanded', 'false');
  }

  function initialsFromUser(user) {
    const first = user?.first_name?.[0] || user?.firstName?.[0] || 'U';
    const last = user?.last_name?.[0] || user?.lastName?.[0] || '';
    return `${first}${last}`.toUpperCase();
  }

  function setPhoto(photoBase64 = '') {
    const avatar = document.getElementById('topbar-avatar');
    if (!avatar) return;
    if (photoBase64) {
      avatar.dataset.initials = avatar.textContent || avatar.dataset.initials || 'U';
      avatar.textContent = '';
      avatar.style.backgroundImage = `url("${photoBase64}")`;
      avatar.classList.add('has-image');
    } else {
      avatar.style.backgroundImage = '';
      avatar.classList.remove('has-image');
      avatar.textContent = avatar.dataset.initials || 'U';
    }
  }

  return { init, initialsFromUser, setPhoto };
})();
