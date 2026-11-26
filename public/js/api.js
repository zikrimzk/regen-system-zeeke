/* API.JS - FRONTEND API CLIENT FOR V2 */
const Api = (() => {
  let csrfToken = '';
  let accountId = null;
  let documentGeneration = 0;
  const pendingReads = new Map();
  function parseDate(value) {
    let text = String(value || '').trim();
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(text)) {
      text = text.replace(' ', 'T').replace(/(\.\d{3})\d+$/, '$1') + 'Z';
    }
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function _fetch(url, options = {}) {
    const method=String(options.method || 'GET').toUpperCase();
    if (method !== 'GET' || options.headers || options.body || options.signal) {
      pendingReads.clear();
      return _request(url,options);
    }
    if (pendingReads.has(url)) return pendingReads.get(url);
    const promise=_request(url,options).finally(()=>{if(pendingReads.get(url)===promise)pendingReads.delete(url);});
    pendingReads.set(url,promise);
    return promise;
  }

  async function _request(url, { timeoutMs = 15000, signal, ...options } = {}, tokenAttempt=0) {
    if (signal?.aborted) return { success:false, aborted:true };
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once:true });
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
          ...(!['GET','HEAD','OPTIONS'].includes(method) ? {'X-Document-Generation':String(documentGeneration)} : {}),
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
      if ((['/api/auth/me','/api/profile'].includes(url) || url.startsWith('/api/cover-letters?view=studio&letter=')) && data.success) {
        const id = Number(data.user?.id || data.profile?.id || data.studio?.accountId);
        if (id && accountId && accountId !== id) return {success:false,status:409,message:'Sign in to the same account to continue this draft.'};
        if (id) accountId = id;
        if (Object.hasOwn(data, 'avatarUrl')) window.ZeekeAccountMenu?.setPhoto(data.avatarUrl);
      }
      if(data.code==='MAINTENANCE_MODE')location.replace('/maintenance?returnTo='+encodeURIComponent(location.pathname+location.search));
      if(res.status===402&&data.code==='TOKEN_ACCESS_REQUIRED'&&tokenAttempt<3&&window.ReGenTokens){clearTimeout(timer);if(await window.ReGenTokens.authorize(data))return _request(url,{timeoutMs,signal,...options},tokenAttempt+1);}
      if(res.status===403&&['PACKAGE_ACCESS_REQUIRED','PACKAGE_LIMIT_REACHED','ACCESS_CHANGED'].includes(data.code)&&window.ReGenTokens?.showAccess){clearTimeout(timer);await window.ReGenTokens.showAccess(data);window.ReGenTokens.refresh();}
      if (typeof data.csrfToken === 'string' && data.csrfToken) csrfToken = data.csrfToken;
      if (Number.isInteger(data.documentGeneration)) documentGeneration = data.documentGeneration;
      if (res.ok && data.success && method!=='GET' && /\/(?:ai-assist|ai-suggest|ats-review|photo|title)$|^\/api\/cover-letters$|^\/api\/dashboard$/.test(url)) window.dispatchEvent(new CustomEvent('regen:priced-action-completed'));
      if (!res.ok && data.success !== false) data.success = false;
      const isPublicAuthRequest = [
        '/api/auth/login',
        '/api/auth/register',
        '/api/auth/email-verification/',
      ].some(prefix => url.startsWith(prefix));
      if (res.status === 401 && !isPublicAuthRequest) {
        window.dispatchEvent(new CustomEvent('regen:session-expired'));
      }
      if (!data.success && !data.requestId) {
        const requestId = res.headers?.get('X-Request-ID');
        if (requestId) data.requestId = requestId;
      }
      return { ...data, status: res.status };
    } catch (err) {
      if (signal?.aborted) return { success:false, aborted:true };
      console.error('API Error:', err);
      return {
        success: false,
        message: err.name === 'AbortError'
          ? 'The request took too long. Please try again.'
          : 'Unable to reach the server. Please try again.',
      };
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
  }

  // ── AUTH ──────────────────────────────────────────────────────
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
  const getProfile = () => _fetch('/api/profile');
  const updateProfile = (data) => _fetch('/api/profile', { method: 'PATCH', body: JSON.stringify(data) });
  const changePassword = (data) => _fetch('/api/profile/password', { method: 'PUT', body: JSON.stringify(data) });
  const changeEmail = (data) => _fetch('/api/profile/email', { method: 'PUT', body: JSON.stringify(data) });
  const revokeSession = (id) => _fetch(`/api/profile/sessions/${id}`, { method: 'DELETE' });
  const getSessions = (page = 1) => _fetch(`/api/profile/sessions?page=${encodeURIComponent(page)}`);
  const clearSessionHistory = () => _fetch('/api/profile/sessions/history', { method: 'DELETE' });
  const deleteAccount = (data) => _fetch('/api/profile/account', { method: 'DELETE', body: JSON.stringify(data) });

  // ── DASHBOARD ─────────────────────────────────────────────────
  const listResumes = () => _fetch('/api/dashboard');
  const getOverview = () => _fetch('/api/dashboard?view=overview');
  const createResume = (title = '', templateId = '') => _fetch('/api/dashboard', { method: 'POST', body: JSON.stringify({ title, templateId }) });
  const getTemplates = () => _fetch('/api/templates');
  const listCoverLetters = () => _fetch('/api/cover-letters');
  const getLetterStudio = letter => _fetch('/api/cover-letters?view=studio&letter=' + encodeURIComponent(letter));
  const getCoverLetter = (id) => _fetch(`/api/cover-letters/${id}`);
  const saveCoverLetter = (id, data) => _fetch(id ? `/api/cover-letters/${id}` : '/api/cover-letters', { method: id ? 'PUT' : 'POST', body: JSON.stringify(data) });
  const deleteCoverLetter = (id) => _fetch(`/api/cover-letters/${id}`, { method: 'DELETE' });
  const suggestCoverLetter = (id, data) => _fetch(`/api/cover-letters/${id}/ai-suggest`, { method: 'POST', body: JSON.stringify(data), timeoutMs: 90000 });
  const renameResume = (id, title) => _fetch(`/api/dashboard/${id}/title`, { method: 'PATCH', body: JSON.stringify({ title }) });
  const deleteResume = (id) => _fetch(`/api/dashboard/${id}`, { method: 'DELETE' });

  // ── BUILDER (REQUIRES ID) ─────────────────────────────────────
  let _resumeId = null;
  function setResumeId(id) { _resumeId = id; }
  function getResumeId() { return _resumeId; }

  const getResume   = () => _fetch(`/api/resume/${_resumeId}`);
  const saveSection = (section, data) => _fetch(`/api/resume/${_resumeId}/section`, {
    method: 'POST', body: JSON.stringify({ section, data })
  });
  const getAIStatus = (summary = false) => _fetch(summary ? '/api/ai/status?view=summary' : '/api/ai/status', { timeoutMs: 8000 });
  const assistResumeSection = data => _fetch(`/api/resume/${_resumeId}/ai-assist`, { method: 'POST', body: JSON.stringify(data), timeoutMs: 34000 });
  const suggestResumeSection = (data) => _fetch(`/api/resume/${_resumeId}/ai-suggest`, {
    method: 'POST',
    body: JSON.stringify(data),
    timeoutMs: 34000,
  });
  const getAtsReviewState = (resumeId = _resumeId) => _fetch(`/api/resume/${resumeId}/ats-review`, {
    method: 'GET',
    timeoutMs: 10000,
  });
  const generateAtsReview = (resumeId = _resumeId, expectedCost = null) => _fetch(`/api/resume/${resumeId}/ats-review`, {
    method: 'POST',
    body: JSON.stringify({ expectedCost }),
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

  // ── URLS ──────────────────────────────────────────────────────
  const documentUrl = () => `/api/pdf/${_resumeId}/document`;
  async function requestDraftPdf(url, payload, {signal, interactive = false} = {}) {
    const send = interactive ? (window.ReGenTokens?.fetch || fetch) : fetch;
    const response = await send(url, {
      method: 'POST', credentials: 'same-origin', cache: 'no-store', signal,
      headers: {'Content-Type':'application/json', 'X-CSRF-Token':csrfToken,
        ...(!interactive ? {'X-ReGen-Preview':'automatic'} : {})},
      body: JSON.stringify(payload),
    });
    if (response.status === 401) window.dispatchEvent(new Event('regen:session-expired'));
    if (!response.ok || !response.headers.get('content-type')?.includes('application/pdf')) {
      const error = new Error('Unable to create the PDF preview.');
      error.status = response.status;
      throw error;
    }
    return new Uint8Array(await response.arrayBuffer());
  }
  function documentDraft(resumeData, options) {
    const {photoBase64, photoPath, ...personal} = resumeData.personal || {};
    return requestDraftPdf(documentUrl(), {resumeData: {...resumeData, personal}}, options);
  }
  const letterDraftPdf = (data, options) => requestDraftPdf('/api/cover-letters/document', data, options);
  const previewUrl = () => `/api/pdf/${_resumeId}/preview`;
  const pdfUrl     = () => `/api/pdf/${_resumeId}/generate`;
  const previewDraft = async (resumeData) => {
    try {
      const res = await (window.ReGenTokens?.fetch||fetch)(`/api/pdf/${_resumeId}/preview-data`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
        body: JSON.stringify({ resumeData }),
      });
      if (!res.ok || !res.headers.get('content-type')?.includes('application/pdf')) return { success: false, data: null };
      return { success: true, data: new Uint8Array(await res.arrayBuffer()) };
    } catch (err) {
      console.error('Preview Draft Error:', err);
      return { success: false, data: null };
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
      const res = await (window.ReGenTokens?.fetch||fetch)(`/api/pdf/${resumeId}/generate`, { credentials: 'same-origin' });
      if (!res.ok) {
        if (res.status === 401) window.dispatchEvent(new CustomEvent('regen:session-expired'));
        const details = await res.json().catch(() => ({}));
        if(['PACKAGE_ACCESS_REQUIRED','PACKAGE_LIMIT_REACHED','ACCESS_CHANGED'].includes(details.code)&&window.ReGenTokens?.showAccess)return {success:false,handled:true,message:details.message};
        throw new Error(details.message || 'PDF download failed. Please try again.');
      }
      if (!res.headers.get('content-type')?.includes('application/pdf')) throw new Error('The server did not return a PDF. Please try again.');

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
      window.dispatchEvent(new CustomEvent('regen:resume-downloaded',{detail:{resumeId}}));
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
    recordActivity:()=>csrfToken?_fetch('/api/auth/activity',{method:'POST',timeoutMs:6000}):null,
    getMochiStatus:()=>_fetch('/api/mochi/status', {timeoutMs:6000}),
    commentWithMochi:(input,signal)=>_fetch('/api/mochi/comment',{method:'POST',body:JSON.stringify(input),signal,timeoutMs:9500}),
    saveMochiPreferences:input=>_fetch('/api/mochi/preferences',{method:'PUT',body:JSON.stringify(input),timeoutMs:7000}),
    chatWithMochi:(input,signal)=>_fetch('/api/mochi/chat',{method:'POST',body:JSON.stringify(input),signal,timeoutMs:28000}),
    getFeaturePrices:()=>_fetch('/api/store/prices'),
    getTokenActivity:(page=1)=>_fetch('/api/store/activity?page='+encodeURIComponent(page)),
    getNotificationPreferences:()=>_fetch('/api/notifications/preferences'),
    saveNotificationPreferences:values=>_fetch('/api/notifications/preferences',{method:'PUT',body:JSON.stringify(values)}),
    readNotification:id=>_fetch('/api/notifications/read',{method:'POST',body:JSON.stringify({id})}),
    getTokenStore:(page=1,historyPage=1,heroPage=1,rowPage=1,grantPage=1,feature='')=>_fetch(`/api/store?view=sections&heroPage=${heroPage}&rowPage=${rowPage}&grantPage=${grantPage}&feature=${encodeURIComponent(feature)}`),
    startCheckout:data=>_fetch('/api/store/checkout',{method:'POST',body:JSON.stringify(data)}),
    getPayments:(page=1,order='',filters={})=>_fetch('/api/store/payments?'+new URLSearchParams({...filters,page,...(order?{order}:{})})),
    claimPackage:(id,version)=>_fetch(`/api/store/packages/${Number(id)}/claim`,{method:'POST',body:JSON.stringify({version})}),
    purchaseFeatureAccess:data=>_fetch('/api/store/access',{method:'POST',body:JSON.stringify(data)}),
    refundFeatureCredit:id=>_fetch(`/api/store/credits/${id}/refund`,{method:'POST',body:'{}'}),
    login, register, getRecaptchaConfig, verifyEmail, resendEmailVerification, logout, getMe,
    getProfile, updateProfile, changePassword, changeEmail, revokeSession, getSessions, clearSessionHistory, deleteAccount, parseDate,
    listResumes, getOverview, createResume, renameResume, deleteResume,
    getTemplates, listCoverLetters, getLetterStudio, getCoverLetter, saveCoverLetter, deleteCoverLetter, suggestCoverLetter,
    setResumeId, getResumeId,
    getResume, saveSection, uploadPhoto, deletePhoto,
    getAIStatus, assistResumeSection, suggestResumeSection, getAtsReviewState, generateAtsReview,
    previewUrl, pdfUrl, previewDraft, downloadPdf, documentUrl, documentDraft, letterDraftPdf,
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  if (!document.body.classList.contains('user-workspace')) return;
  let last = 0;
  let trailing = 0;
  function report() {
    trailing = 0;
    if (document.hidden || document.getElementById('session-recovery')) return;
    if (Api.recordActivity()) last = Date.now();
  }
  function interacted(event) {
    if (!event.isTrusted || document.hidden) return;
    const wait = 15000 - (Date.now() - last);
    if (wait <= 0) { clearTimeout(trailing); report(); }
    else if (!trailing) trailing = setTimeout(report, wait);
  }
  for (const event of ['pointerdown','keydown','input','wheel','touchmove']) {
    window.addEventListener(event, interacted, {passive:true});
  }
});

window.addEventListener('regen:session-expired', () => {
  if (['/login','/register','/verify-email'].includes(location.pathname) || document.getElementById('session-recovery')) return;
  const dialog = document.createElement('dialog');
  dialog.id = 'session-recovery';
  dialog.className = 'session-recovery';
  dialog.setAttribute('aria-labelledby','session-recovery-title');
  dialog.innerHTML = '<h2 id="session-recovery-title">Sign in to keep working</h2><p>Your sign-in has ended. Your unsaved writing is still in this page. Sign in in a new tab, then return here to reconnect.</p><div class="recovery-actions"><a href="/login?expired=1" target="_blank" rel="noopener" class="btn btn-primary">Sign in again</a><button type="button" class="btn btn-secondary" id="session-reconnect">I have signed in</button></div><p class="recovery-message" role="status"></p>';
  document.body.append(dialog);
  dialog.addEventListener('cancel', event => event.preventDefault());
  dialog.querySelector('#session-reconnect').addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const result = await Api.getMe();
      if (!result.success) { dialog.querySelector('.recovery-message').textContent = result.status === 409 ? result.message : 'Sign in in the other tab first, then try reconnecting.'; return; }
      dialog.close();dialog.remove();
      window.dispatchEvent(new CustomEvent('regen:session-restored'));
    } finally { button.disabled = false; }
  });
  dialog.showModal();
});

window.ReGenIcons = (() => {
  const paths = {
    edit: '<path d="m16 3 5 5-12 12H4v-5zM14 5l5 5M12 21h9"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    circle: '<circle cx="12" cy="12" r="8"/>',
    logout: '<path d="M9 4H4v16h5M10 12h11m-4-4 4 4-4 4"/>',
    template: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/>',
    letter: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
    download: '<path d="M12 3v12m-5-5 5 5 5-5M5 17v4h14v-4"/>',
    personal: '<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
    education: '<path d="m2 8 10-5 10 5-10 5-10-5zm4 3v6c4 3 8 3 12 0v-6M22 8v9"/>',
    experience: '<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V3h8v4M3 12h18M10 12v3h4v-3"/>',
    skills: '<path d="m8 5-6 7 6 7m8-14 6 7-6 7m-3-16-2 18"/>',
    award: '<circle cx="12" cy="8" r="5"/><path d="m8 12-2 9 6-3 6 3-2-9"/>',
    add: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 15H6L5 6"/><path d="M10 11v5"/><path d="M14 11v5"/>',
    upload: '<path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M5 20h14"/>',
    arrowDown: '<path d="M12 5v14m-6-6 6 6 6-6"/>',
    arrowUp: '<path d="M12 19V5m-6 6 6-6 6 6"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
    arrowRight: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
    arrowLeft: '<path d="M19 12H5"/><path d="m11 18-6-6 6-6"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    retry: '<path d="M20 6v5h-5"/><path d="M19 11a7 7 0 1 0 1 5"/>',
    sparkles: '<path d="m12 3 1.2 3.3L16.5 7.5l-3.3 1.2L12 12l-1.2-3.3-3.3-1.2 3.3-1.2z"/><path d="m18.5 13 0.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/><path d="m6 13 1.1 2.9L10 17l-2.9 1.1L6 21l-1.1-2.9L2 17l2.9-1.1z"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
    writing: '<path d="M13 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-7M7 9h4M7 14h4m3 0 7-7-3-3-7 7-1 4z"/>',
    eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="3"/>',
    previewPane: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/>',
    store: '<path d="M4 10v10h16V10M3 10l2-6h14l2 6M3 10c0 3 5 3 6 0 1 3 5 3 6 0 1 3 6 3 6 0M10 20v-5h4v5"/>',
    mochi: '<path d="M4 13V6l5 3a11 11 0 0 1 6 0l5-3v7a8 6 0 0 1-16 0Z"/><path d="M9 13h.01M15 13h.01M11 16l1 1 1-1"/>',
    eyeOff: '<path d="m3 3 18 18"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-2.2 3.1"/><path d="M6.2 6.2C3.5 8 2 12 2 12s3.5 7 10 7a10.8 10.8 0 0 0 3-.4"/>',
  };

  function icon(name) {
    return `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || ''}</svg>`;
  }

  return { icon };
})();

window.ZeekeSafe = (() => {
  const BULLET_RE = /^[\s>]*(?:[•●○◦▪▫■□‣⁃*]|[-\u2013\u2014]{1,2}|\d{1,3}[.)]|[a-zA-Z][.)])\s+/;
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
  let signOutDialog = null;
  let photoSource = '';
  let photoRevision = 0;
  function init({ userName = 'User', initials = 'U', photoBase64 = null } = {}) {
    const toggle = document.getElementById('account-menu-toggle');
    const panel = document.getElementById('account-menu-panel');
    const nameEl = document.getElementById('topbar-user-name');
    const avatar = document.getElementById('topbar-avatar');
    const logout = document.getElementById('account-menu-logout');
    if (!toggle || !panel || !avatar) return;
    panel.querySelectorAll('.account-menu-item').forEach(item => {if(!item.querySelector('svg'))item.insertAdjacentHTML('afterbegin',ReGenIcons.icon(item.id === 'account-menu-logout' ? 'logout' : 'personal'));});

    if (nameEl) nameEl.textContent = userName || 'User';
    avatar.dataset.initials = initials || 'U';
    avatar.textContent = initials || 'U';
    setPhoto(photoBase64 === null ? photoSource : photoBase64);

    if (!toggle.dataset.accountBound) {
      toggle.dataset.accountBound = 'true';
      toggle.addEventListener('click', (event) => {
        event.stopPropagation();
        const isOpen = !panel.classList.contains('hidden');
        if (!isOpen) window.dispatchEvent(new CustomEvent('regen:menu-open',{detail:{owner:'account'}}));
        panel.classList.toggle('hidden', isOpen);
        toggle.setAttribute('aria-expanded', String(!isOpen));
      });

      document.addEventListener('click', () => close(toggle, panel));
      window.addEventListener('regen:menu-open', event => { if (event.detail?.owner !== 'account') close(toggle,panel); });
      toggle.addEventListener('keydown', event => {
        if (!['ArrowDown','ArrowUp'].includes(event.key)) return;
        event.preventDefault();panel.classList.remove('hidden');toggle.setAttribute('aria-expanded','true');
        const items=[...panel.querySelectorAll('[role=menuitem]')];(event.key==='ArrowUp'?items.at(-1):items[0])?.focus();
      });
      panel.addEventListener('keydown', event => {
        if (!['ArrowDown','ArrowUp','Home','End'].includes(event.key)) return;
        event.preventDefault();const items=[...panel.querySelectorAll('[role=menuitem]:not([disabled])')],index=items.indexOf(document.activeElement);
        const next=event.key==='Home'?0:event.key==='End'?items.length-1:(index+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;items[next]?.focus();
      });
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !panel.classList.contains('hidden')) { close(toggle, panel);toggle.focus(); }
      });

      logout?.addEventListener('click', async () => {
        if(signOutDialog)return;
        close(toggle,panel);
        const dialog=document.createElement('dialog');signOutDialog=dialog;
        dialog.className='workspace-signout-dialog';dialog.setAttribute('aria-labelledby','workspace-signout-title');
        dialog.innerHTML='<form><h2 id="workspace-signout-title">Sign out of ReGen?</h2><p>Your session will end. Make sure your latest changes are saved before signing out.</p><p class="workspace-signout-error" role="status"></p><footer><button type="button" class="btn btn-secondary">Cancel</button><button type="submit" class="btn btn-primary">Sign out</button></footer></form>';
        dialog.querySelector('[type="button"]').onclick=()=>dialog.close();
        dialog.addEventListener('close',()=>{dialog.remove();signOutDialog=null;toggle.focus();},{once:true});
        dialog.querySelector('form').onsubmit=async event=>{
          event.preventDefault();const button=dialog.querySelector('[type="submit"]');if(button.disabled)return;
          button.disabled=true;button.textContent='Signing out…';
          const result=await Api.logout();
          if(result.success){window.location.replace('/login');return;}
          button.disabled=false;button.textContent='Sign out';dialog.querySelector('[role="status"]').textContent=result.message||'Could not sign out. Try again.';
        };
        document.body.append(dialog);dialog.showModal();dialog.querySelector('[type="button"]').focus();
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

  function setPhoto(source = '') {
    photoSource = typeof source === 'string' && (source === '/api/profile/photo' || /^data:image\/(?:jpeg|png);base64,/i.test(source)) ? source : '';
    const current = photoSource, version = ++photoRevision;
    document.querySelectorAll('#topbar-avatar,[data-account-avatar]').forEach(avatar => {
      avatar.dataset.initials = avatar.dataset.initials || avatar.textContent.trim() || 'U';
      avatar.style.backgroundImage = 'none';
      avatar.classList.remove('has-image');
      avatar.textContent = avatar.dataset.initials;
      if (!current) return;
      const image = new Image();
      image.alt = ''; image.decoding = 'async';
      image.addEventListener('load', () => {
        if (photoRevision !== version || !avatar.isConnected) return;
        avatar.replaceChildren(image); avatar.classList.add('has-image');
      }, { once: true });
      image.addEventListener('error', () => {
        if (photoRevision !== version || !avatar.isConnected) return;
        avatar.textContent = avatar.dataset.initials; avatar.classList.remove('has-image');
      }, { once: true });
      image.src = current;
    });
  }

  return { init, initialsFromUser, setPhoto };
})();

// KEEP USER NAVIGATION ICONS CONSISTENT WITH THE DOCUMENT ACTIONS.
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.user-workspace a[href="/profile"]:not(.account-menu-item)').forEach(link=>{if(!link.querySelector('svg'))link.insertAdjacentHTML('afterbegin',ReGenIcons.icon('personal'));});
  document.querySelectorAll('.user-workspace .workspace-nav a').forEach(link => {
    if (!link.querySelector('svg')) link.insertAdjacentHTML('afterbegin', ReGenIcons.icon(link.getAttribute('href') === '/cover-letters' ? 'letter' : 'template'));
  });
});
