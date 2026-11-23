document.addEventListener('DOMContentLoaded', () => {
  const {safe, date, money, paymentStatuses, paymentBadge} = ReGenCommerce;
  const list = document.getElementById('payment-history');
  const result = document.getElementById('payment-return');
  const notice = document.getElementById('payment-status');
  const form = document.getElementById('payment-filters');
  const params = new URLSearchParams(location.search);
  const resultPage = location.pathname.replace(/\/$/,'') === '/payments/result';
  const orderParam = params.get('order') || '';
  let reference = /^RG-[a-f0-9]{32}$/.test(orderParam) ? orderParam : '';
  let page = Math.max(1, Number.parseInt(params.get('page'),10) || 1);
  let generation = 0, timer, checks = 0, lastStatus;

  document.getElementById('payment-history-heading').hidden = resultPage;
  document.getElementById('payment-history-view').hidden = resultPage;
  document.title = (resultPage ? 'Payment result' : ReGenText.get('nav.payments')) + ' | K-Store';
  for (const [value,label] of Object.entries(paymentStatuses)) form.elements.status.add(new Option(label,value));
  for (const key of ['q','status','days']) form.elements[key].value = params.get(key) || '';
  let filters = Object.fromEntries(new FormData(form));

  const icon = (body) => `<svg viewBox="0 0 24 24" class="ui-icon" aria-hidden="true">${body}</svg>`;
  const receiptIcon = icon('<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6m-6 4h6"/>');
  const pending = item => ['creating','pending'].includes(item?.status);
  const shortReference = value => value.slice(0,12)+'…'+value.slice(-6);
  const resume = item => item.checkoutUrl
    ? `<a class="btn btn-secondary" href="${safe(item.checkoutUrl)}" rel="noreferrer">${safe(ReGenText.get('store.checkout'))}</a>` : '';

  function renderResult(item) {
    result.hidden = !(resultPage || reference);
    if (result.hidden) return;
    if (!item) {
      result.innerHTML = '<article class="payment-result"><h1>Payment not found</h1><p>Check the reference or sign in to the account used to pay.</p><a class="btn btn-secondary" href="/store/payments">Payment history</a></article>';
      return;
    }
    const success = item.status === 'paid' && item.delivered;
    const title = success ? 'Payment successful' : item.status === 'paid' ? 'Payment received' : paymentStatuses[item.status];
    const descriptions = {
      creating:'We’re preparing your checkout.',
      pending:'We’re waiting for your payment to be confirmed.',
      paid:success ? 'Your package benefits are ready to use.' : 'Contact support with your order reference for help accessing your package.',
      failed:'Your payment could not be completed.',
      unavailable:'Return to the store to start a new checkout.',
      link_expired:'Return to the store to start a new checkout.',
    };
    const tag = resultPage ? 'h1' : 'h2';
    const action = success ? '<a class="btn btn-primary" href="/store#your-packages">View your packages</a>'
      : resume(item) || '<a class="btn btn-secondary" href="/store">Back to K-Store</a>';
    result.innerHTML = `<article class="payment-result${success?' is-success':''}">
      <span class="payment-result-icon">${success ? icon('<path d="m5 12 4 4L19 6"/>') : receiptIcon}</span>
      <${tag}>${safe(title)}</${tag}>
      ${descriptions[item.status] ? `<p>${safe(descriptions[item.status])}</p>` : ''}
      <dl class="payment-receipt">
        <div><dt>Package</dt><dd>${safe(item.package)}</dd></div>
        <div><dt>${item.paidAt?'Amount paid':'Order amount'}</dt><dd>${safe(money(item.amountMinor,item.currency))}</dd></div>
        ${item.refundedMinor ? `<div><dt>Refunded</dt><dd>${safe(money(item.refundedMinor,item.currency))}</dd></div>` : ''}
        <div class="payment-receipt-reference"><dt>Order reference</dt><dd class="payment-reference">${safe(item.reference)}</dd></div>
      </dl>
      <div class="payment-result-actions">${action}
        ${pending(item) ? '<button class="btn btn-secondary" type="button" data-refresh-result>Check status</button>' : ''}
        <a class="text-link" href="/store/payments">Payment history</a>
      </div></article>`;
    if (success && lastStatus !== 'paid') window.dispatchEvent(new CustomEvent('regen:wallet-changed'));
    lastStatus = item.status;
  }

  function renderHistory(data) {
    if (!data.items.length) {
      const filtered = Object.values(filters).some(Boolean);
      list.innerHTML = `<div class="token-empty"><h2>${filtered?'No matching payments':'No payments yet'}</h2>
        <p>${filtered?'Try a different search or clear your filters.':'Your purchases will appear here.'}</p></div>`;
      return;
    }
    const maxPage = Math.max(1,Math.ceil(data.total / data.pageSize));
    const first = (data.page-1)*data.pageSize+1;
    const last = first+data.items.length-1;
    list.innerHTML = `<ol class="payment-list">${data.items.map(item => `<li>
      <div class="payment-list-identity"><span class="payment-row-icon">${receiptIcon}</span><div>
        <h3>${safe(item.package)}</h3><time>${safe(date(item.paidAt || item.createdAt))}</time>
        <small class="payment-reference" title="${safe(item.reference)}">${safe(shortReference(item.reference))}</small></div></div>
      <div class="payment-list-total"><strong>${safe(money(item.amountMinor,item.currency))}</strong>
        ${paymentBadge(item.status)}
        ${item.refundedMinor ? `<small>${safe(money(item.refundedMinor,item.currency))} refunded</small>` : ''}</div>
      <a class="payment-row-link text-link" href="?order=${encodeURIComponent(item.reference)}" data-payment-order="${safe(item.reference)}">View details <span aria-hidden="true">→</span></a>
    </li>`).join('')}</ol>
      <nav class="payment-pagination" aria-label="Payment pages">
        <span>${first}–${last} of ${data.total} payments</span>
        <div><button class="btn btn-secondary" type="button" data-payment-page="-1" ${page<=1?'disabled':''}>Previous</button>
        <span>Page ${page} of ${maxPage}</span>
        <button class="btn btn-secondary" type="button" data-payment-page="1" ${page>=maxPage?'disabled':''}>Next</button></div>
      </nav>`;
  }

  function updateAddress() {
    if (resultPage) return;
    const search = new URLSearchParams(Object.entries({...filters, page:page>1?page:'', order:reference}).filter(([,value]) => value));
    window.history.replaceState(null,'',location.pathname+(search.size?'?'+search:''));
  }

  async function load({scroll = false, quiet = false} = {}) {
    const request = ++generation;
    clearTimeout(timer);
    if (!quiet) {
      notice.textContent = 'Loading payments…';
      list.setAttribute('aria-busy','true');
    }
    try {
      const data = await Api.getPayments(page,reference,resultPage?{view:'result'}:filters);
      if (request !== generation) return;
      if (!data.success) throw new Error(data.message || 'Unable to load payments.');
      notice.textContent = '';
      renderResult(data.selected);
      if (!resultPage) {
        page = data.page;
        if (!quiet) renderHistory(data);
        updateAddress();
      }
      if (scroll && !result.hidden) result.scrollIntoView({block:'start'});
      if (pending(data.selected) && !document.hidden && ++checks < 12) timer = setTimeout(() => load({quiet:true}),4000);
    } catch (error) {
      if (request !== generation) return;
      notice.textContent = error.message;
      if (resultPage && result.hidden) {
        result.hidden = false;
        result.innerHTML = '<article class="payment-result"><h1>Unable to check your payment</h1><div class="payment-result-actions"><button class="btn btn-secondary" type="button" data-refresh-result>Try again</button><a class="text-link" href="/store/payments">Payment history</a></div></article>';
      }
    } finally {
      if (request === generation) list.removeAttribute('aria-busy');
    }
  }
  function applyFilters() {
    filters = Object.fromEntries(new FormData(form));
    reference = '';
    page = 1;
    checks = 0;
    load();
  }
  form.addEventListener('submit', event => { event.preventDefault(); applyFilters(); });
  document.getElementById('reset-payment-filters').onclick = () => { form.reset(); applyFilters(); };
  document.getElementById('refresh-payments').onclick = () => { checks = 0; load(); };
  result.addEventListener('click',event => {
    if (event.target.closest('[data-refresh-result]')) { checks = 0; load(); }
  });
  list.addEventListener('click',event => {
    const link = event.target.closest('[data-payment-order]');
    if (link && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      event.preventDefault();
      reference = link.dataset.paymentOrder;
      checks = 0;
      load({scroll:true});
    }
    const button = event.target.closest('[data-payment-page]');
    if (button) { page += Number(button.dataset.paymentPage); load(); }
  });
  document.addEventListener('visibilitychange',() => {
    if (document.hidden) clearTimeout(timer);
    else if (reference) load({quiet:true});
  });
  window.addEventListener('pagehide',() => clearTimeout(timer));
  load();
});
