window.ZeekeForm = (() => {
  const bound = new WeakSet();

  function fieldLabel(el) {
    const text = el.closest('.form-group')?.querySelector('.form-label')?.textContent || 'This field';
    return text.replace('*', '').trim();
  }

  function errorElement(el) {
    const group = el.closest('.form-group');
    if (!group) return null;
    let error = group.querySelector(`.form-error[data-for="${el.id || ''}"]`);
    if (!error) error = group.querySelector('.form-error');
    if (!error) {
      error = document.createElement('div');
      error.className = 'form-error';
      error.dataset.generated = 'true';
      if (el.id) error.dataset.for = el.id;
      const anchor = el.closest('.lookup-field') || el;
      anchor.insertAdjacentElement('afterend', error);
    }
    return error;
  }

  function setError(el, message = '', { silent = false } = {}) {
    if (!el) return false;
    if (silent) return !message;
    const error = errorElement(el);
    el.classList.toggle('is-error', !!message);
    el.setAttribute('aria-invalid', String(!!message));
    if (error) {
      if (message) error.textContent = message;
      error.classList.toggle('visible', !!message);
    }
    return !message;
  }

  function countryFor(el) {
    const selector = el.dataset.phoneCountry || el.dataset.locationCountry;
    if (!selector) return 'Malaysia';
    const scope = el.closest('.entry-card') || el.closest('.form-body') || document;
    return scope.querySelector(selector)?.value || document.querySelector(selector)?.value || 'Malaysia';
  }

  function normalizeUrl(value, kind = '') {
    let text = String(value || '').trim();
    if (!text) return '';
    if (kind === 'linkedin') {
      text = text.replace(/^@/, '');
      if (!/^https?:\/\//i.test(text) && !/^www\./i.test(text) && !/linkedin\.com/i.test(text)) {
        text = `linkedin.com/in/${text.replace(/^\/+|\/+$/g, '')}`;
      }
    }
    if (!/^https?:\/\//i.test(text)) text = `https://${text.replace(/^\/+/, '')}`;
    return text;
  }

  function validateUrl(value, kind = '') {
    if (!value) return true;
    try {
      const url = new URL(normalizeUrl(value, kind));
      if (!['http:', 'https:'].includes(url.protocol)) return false;
      return kind !== 'linkedin' || /(^|\.)linkedin\.com$/i.test(url.hostname.replace(/^www\./, ''));
    } catch (err) {
      return false;
    }
  }

  function validateAcademicResult(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    if (/^\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)?$/.test(text)) {
      const parts = text.split('/').map(Number);
      if (parts.some(num => !Number.isFinite(num) || num < 0)) return 'Enter a valid CGPA value.';
      if (parts.length === 1 && parts[0] > 10) return 'CGPA must be 10 or below. Add % if this is a percentage grade.';
      if (parts.length === 2 && (parts[1] <= 0 || parts[0] > parts[1])) return 'CGPA must not be higher than its scale.';
    }
    return '';
  }

  function validateField(el, options = {}) {
    if (!el || el.disabled || el.type === 'file' || el.type === 'checkbox') return true;
    const value = String(el.value || '').trim();
    let message = '';

    if (el.required && !value) message = `${fieldLabel(el)} is required.`;
    else if (value && el.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) message = 'Enter a valid email address.';
    else if (value && el.type === 'tel') message = ZeekeLookups.validatePhone(value, countryFor(el)).message;
    else if (value && el.dataset.url && !validateUrl(value, el.dataset.url)) message = el.dataset.url === 'linkedin' ? 'Enter a valid LinkedIn profile URL or username.' : 'Enter a valid web address.';
    else if (value && el.dataset.academicResult === 'true') message = validateAcademicResult(value);
    else if (value && el.dataset.minlength && value.length < Number(el.dataset.minlength)) message = `${fieldLabel(el)} should be at least ${el.dataset.minlength} characters.`;

    return setError(el, message, options);
  }

  function validateDateRanges(root, options = {}) {
    let valid = true;
    root.querySelectorAll('.entry-card').forEach((card) => {
      const start = card.querySelector('.edu-start, .exp-start');
      const end = card.querySelector('.edu-end, .exp-end');
      if (!start || !end || end.disabled || !start.value || !end.value) return;
      const message = end.value < start.value ? 'End date cannot be earlier than the start date.' : '';
      if (!setError(end, message, options)) valid = false;
    });
    return valid;
  }

  function validateScope(root, { silent = false, focus = true } = {}) {
    let valid = true;
    root.querySelectorAll('input, select, textarea').forEach((el) => {
      if (!validateField(el, { silent })) valid = false;
    });
    if (!validateDateRanges(root, { silent })) valid = false;
    if (!valid && !silent && focus) root.querySelector('.is-error')?.focus({ preventScroll: false });
    return valid;
  }

  function normalizeCommaList(el) {
    const seen = new Set();
    el.value = String(el.value || '').split(/[,;\n]/)
      .map(item => item.trim())
      .filter(Boolean)
      .filter((item) => {
        const key = item.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .join(', ');
  }

  function updateCounter(el) {
    if (!el.dataset.counter) return;
    const max = Number(el.maxLength) > 0 ? Number(el.maxLength) : Number(el.dataset.counter);
    let counter = el.closest('.form-group')?.querySelector('.field-counter');
    if (!counter) {
      counter = document.createElement('span');
      counter.className = 'field-counter';
      el.insertAdjacentElement('afterend', counter);
    }
    counter.textContent = `${el.value.length}/${max}`;
  }

  function bindField(el) {
    if (bound.has(el)) return;
    bound.add(el);
    if (el.type === 'tel') {
      if (el.value.trim()) el.value = ZeekeLookups.formatPhone(el.value, countryFor(el));
      el.addEventListener('blur', () => {
        el.value = ZeekeLookups.formatPhone(el.value, countryFor(el));
        validateField(el);
      });
    }
    if (el.matches('#p-country, .ref-country')) {
      el.addEventListener('change', () => {
        const scope = el.closest('.entry-card') || el.closest('.form-body') || document;
        scope.querySelectorAll('input[type="tel"]').forEach((phone) => {
          phone.value = ZeekeLookups.formatPhone(phone.value, countryFor(phone));
          validateField(phone);
        });
      });
    }
    if (el.type === 'email') {
      el.addEventListener('blur', () => {
        el.value = el.value.trim().toLowerCase();
        validateField(el);
      });
    }
    if (el.dataset.url) {
      el.addEventListener('blur', () => {
        if (el.value.trim()) el.value = normalizeUrl(el.value, el.dataset.url);
        validateField(el);
      });
    }
    if (el.dataset.commaList === 'true') el.addEventListener('blur', () => normalizeCommaList(el));
    if (el.dataset.counter) {
      el.addEventListener('input', () => updateCounter(el));
      updateCounter(el);
    }
    el.addEventListener('input', () => {
      if (el.classList.contains('is-error')) validateField(el);
    });
    el.addEventListener('change', () => validateField(el));
  }

  function bind(root = document) {
    root.querySelectorAll('input, select, textarea').forEach(bindField);
  }

  function init() {
    bind(document);
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => mutation.addedNodes.forEach((node) => {
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        bind(node);
      }));
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  return { bind, validateScope, validateField, setError, normalizeUrl };
})();
