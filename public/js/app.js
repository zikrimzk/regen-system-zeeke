/**
 * app.js - ReGen builder bootstrap
 */
const App = (() => {

  // ── Toast notifications ───────────────────────────────────────
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.setAttribute('role', 'status');
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3100);
  }

  // ── Page loader ───────────────────────────────────────────────
  function showLoader(text = 'Saving...') {
    const loader = document.getElementById('page-loader');
    const p = loader?.querySelector('p');
    if (p) p.textContent = text;
    loader?.classList.add('active');
  }

  function hideLoader() {
    document.getElementById('page-loader')?.classList.remove('active');
  }

  // ── Final Screen ──────────────────────────────────────────────
  function showFinalScreen() {
    const content = document.getElementById('step-content');
    const navBar  = document.querySelector('.nav-bar');
    const stepperWrap = document.getElementById('stepper-wrap');
    const builder = document.querySelector('.builder-left');

    if (stepperWrap) stepperWrap.classList.add('hidden');
    if (navBar)  navBar.classList.add('hidden');
    builder?.classList.add('is-final');

    if (content) {
      const previewSrc = `${Api.previewUrl()}?t=${Date.now()}`;
      content.innerHTML = `
        <div class="final-screen" role="main">
          <div class="final-layout">
            <div class="final-sidebar">
              <section class="final-panel">
                <div class="final-ready-row">
                  <div class="final-icon">
                    <svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
                  </div>
                  <div>
                    <p class="final-eyebrow">Final step</p>
                    <h2 class="final-title">Resume review</h2>
                  </div>
                </div>
                <p class="text-muted mt-sm">
                  Review recommendations and the saved A4 layout before downloading.
                </p>
              </section>

              <section class="ats-review-card" id="ats-review-card" aria-live="polite" aria-busy="true">
                <div class="ats-review-loading">
                  <span class="ai-spinner" aria-hidden="true"></span>
                  <div>
                    <strong>Loading ATS checks</strong>
                    <p>This local check does not use a ReGen AI Token.</p>
                  </div>
                </div>
              </section>

              <div class="final-actions">
                <button type="button" class="btn btn-primary btn-lg w-full" id="btn-download-pdf">
                  <svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>
                  Download PDF
                </button>
                <div class="final-secondary-actions">
                  <button type="button" class="btn btn-secondary flex-1" id="btn-back-to-edit">
                    <svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18 9 12l6-6"/></svg>
                    Edit resume
                  </button>
                  <a href="/dashboard" class="btn btn-secondary flex-1">
                    <svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h7v7H4z"/><path d="M13 4h7v7h-7z"/><path d="M4 13h7v7H4z"/><path d="M13 13h7v7h-7z"/></svg>
                    Dashboard
                  </a>
                </div>
              </div>
            </div>
            <div class="final-preview-card">
              <div class="final-preview-header">Final Resume Preview</div>
              <div class="final-preview-stage">
                <div class="final-preview-page-shell" id="final-preview-page-shell">
                  <iframe class="final-preview-frame" title="Final Resume Preview" sandbox="allow-same-origin" tabindex="-1" draggable="false"></iframe>
                </div>
              </div>
            </div>
          </div>
        </div>`;

      const finalFrame = content.querySelector('.final-preview-frame');
      const finalStage = content.querySelector('.final-preview-stage');
      const finalProtection = window.PreviewProtection?.register({
        iframe: finalFrame,
        container: finalStage,
        isActive: () => finalStage?.isConnected === true,
      });
      finalProtection?.obscure('Loading protected preview...');

      document.getElementById('btn-download-pdf')?.addEventListener('click', async (e) => {
        const res = await Api.downloadPdf(e.currentTarget);
        if (!res.success) App.showToast(res.message || 'PDF download failed.', 'error');
      });

      document.getElementById('btn-back-to-edit')?.addEventListener('click', async () => {
        finalProtection?.deactivate();
        if (stepperWrap) stepperWrap.classList.remove('hidden');
        if (navBar) navBar.classList.remove('hidden');
        builder?.classList.remove('is-final');
        await Stepper.back();
      });

      finalFrame?.addEventListener('load', syncFinalPreviewHeight);
      if (finalFrame && window.PreviewProtection) {
        finalStage?.setAttribute('aria-busy', 'true');
        window.PreviewProtection.loadUrl(finalFrame, previewSrc, {
          shouldCommit: () => finalFrame.isConnected,
        }).then((result) => {
          if (!finalFrame.isConnected) return;
          finalStage?.removeAttribute('aria-busy');
          if (!result.success) {
            finalProtection?.obscure(result.message || 'Preview is temporarily unavailable.');
            App.showToast(result.message || 'Preview is temporarily unavailable.', 'error');
            return;
          }
          finalProtection?.activate();
        });
      }
      loadAtsReviewState();
      requestAnimationFrame(() => {
        syncFinalPreviewHeight();
        fitFinalPreview();
      });
      setTimeout(syncFinalPreviewHeight, 350);
    }

  }

  async function loadAtsReviewState() {
    const card = document.getElementById('ats-review-card');
    if (!card) return;
    card.setAttribute('aria-busy', 'true');
    const result = await Api.getAtsReviewState();
    if (result.quota) window.ReGenAI?.setQuota(result.quota);
    if (!card.isConnected) return;

    if (!result.success || !result.review) {
      card.setAttribute('aria-busy', 'false');
      card.innerHTML = `
        <div class="ats-review-error">
          <strong>ATS review is temporarily unavailable</strong>
          <p></p>
          <button type="button" class="btn btn-secondary btn-sm" id="ats-review-state-retry">Try again</button>
        </div>`;
      card.querySelector('p').textContent = result.message || 'You can still review and download your resume.';
      document.getElementById('ats-review-state-retry')?.addEventListener('click', loadAtsReviewState);
      return;
    }
    renderAtsReview(result.review, {
      aiEnabled: result.aiEnabled === true,
      quota: result.quota || null,
    });
  }

  async function requestAtsReview() {
    const card = document.getElementById('ats-review-card');
    const button = document.getElementById('ats-review-generate');
    const status = card?.querySelector('.ats-review-action-status');
    if (!card || !button || button.disabled) return;

    const originalHtml = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<span class="ai-spinner" aria-hidden="true"></span><span>Generating comment...</span>';
    card.setAttribute('aria-busy', 'true');
    if (status) {
      status.textContent = 'ReGen is reviewing the current resume.';
      status.className = 'ats-review-action-status';
    }

    const result = await Api.generateAtsReview();
    if (result.quota) window.ReGenAI?.setQuota(result.quota);
    if (!card.isConnected) return;
    if (!result.success || !result.review) {
      card.setAttribute('aria-busy', 'false');
      button.disabled = false;
      button.innerHTML = originalHtml;
      if (status) {
        status.textContent = result.message || 'The comment could not be generated. Your local ATS checks are still available.';
        status.className = 'ats-review-action-status is-error';
      }
      return;
    }

    renderAtsReview(result.review, {
      aiEnabled: result.aiEnabled === true,
      revealAi: result.review.aiEnhanced === true,
      cached: result.cached === true,
      quota: result.quota || null,
    });
    if (result.generationFailed === true) {
      const nextStatus = document.querySelector('.ats-review-action-status');
      if (nextStatus) {
        nextStatus.textContent = result.quotaExceeded === true
          ? quotaLimitMessage(result.quota)
          : 'ReGen could not generate the comment this time. You can try again when ready.';
        nextStatus.className = 'ats-review-action-status is-error';
      }
    }
  }

  function quotaLimitMessage(quota) {
    const limit = Math.max(1, Number(quota?.limit) || 15);
    const date = quota?.resetAt ? new Date(quota.resetAt) : null;
    const reset = date && !Number.isNaN(date.getTime())
      ? date.toLocaleString(undefined, {
          year: 'numeric', month: 'short', day: 'numeric',
          hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
        })
      : 'the next reset';
    return `You have used all ${limit} ReGen AI Tokens for this 24-hour period. More tokens will be available on ${reset}.`;
  }

  function renderAtsReview(
    review,
    { aiEnabled = true, revealAi = false, cached = false, quota = null } = {}
  ) {
    const card = document.getElementById('ats-review-card');
    if (!card) return;
    const score = Math.max(0, Math.min(100, Number(review.score) || 0));
    const level = score >= 85 ? 'excellent' : score >= 70 ? 'strong' : score >= 55 ? 'developing' : 'attention';
    const recommendations = Array.isArray(review.recommendations) ? review.recommendations.slice(0, 4) : [];
    const strengths = Array.isArray(review.strengths) ? review.strengths.slice(0, 3) : [];
    const savedComment = String(review.savedComment || '').trim();
    const hasSavedComment = review.hasSavedAiComment === true && savedComment !== '';
    const showAiComment = revealAi
      && review.aiEnhanced === true
      && String(review.comment || '').trim() !== '';

    card.setAttribute('aria-busy', 'false');
    card.innerHTML = `
      <div class="ats-review-head">
        <div class="ats-score ats-score-${level}" role="img" aria-label="ATS readiness score ${score} out of 100">
          <strong></strong>
          <span>/100</span>
        </div>
        <div class="ats-review-title">
          <p class="final-eyebrow">ReGen ATS check</p>
          <h3></h3>
          <span class="ats-review-mode"></span>
        </div>
      </div>
      <p class="ats-review-comment"></p>
      <div class="ats-strengths" aria-label="Resume strengths"></div>
      <div class="ats-priorities">
        <h4>${recommendations.length ? 'Priority improvements' : 'Ready to tailor'}</h4>
        <ol></ol>
      </div>
      <div class="ats-review-request">
        <div class="ats-review-request-copy">
          <strong></strong>
          <p></p>
        </div>
        <button type="button" class="btn btn-secondary btn-sm ats-review-action"></button>
        <span class="ats-review-action-status" role="status"></span>
      </div>
      <p class="ats-disclaimer">This is guidance, not a guarantee of how every employer's ATS will score a resume.</p>`;

    card.querySelector('.ats-score strong').textContent = String(score);
    card.querySelector('.ats-review-title h3').textContent = `${review.label || 'ATS review'} readiness`;
    card.querySelector('.ats-review-mode').textContent = showAiComment
      ? (cached ? 'Saved ReGen AI review - no new token used' : 'Reviewed with ReGen AI')
      : 'Local ATS checks - no ReGen AI Token used';
    card.querySelector('.ats-review-comment').textContent = showAiComment
      ? review.comment
      : review.summary || review.comment || '';

    const strengthWrap = card.querySelector('.ats-strengths');
    strengths.forEach((strength) => {
      const chip = document.createElement('span');
      chip.textContent = `✓ ${strength}`;
      strengthWrap.appendChild(chip);
    });
    if (!strengths.length) strengthWrap.remove();

    const list = card.querySelector('.ats-priorities ol');
    const items = recommendations.length
      ? recommendations
      : ['Tailor the role title and skill keywords to each job description before applying.'];
    items.forEach((item) => {
      const li = document.createElement('li');
      li.textContent = item;
      list.appendChild(li);
    });

    const request = card.querySelector('.ats-review-request');
    const requestTitle = request.querySelector('strong');
    const requestCopy = request.querySelector('p');
    const action = request.querySelector('.ats-review-action');

    if (showAiComment) {
      requestTitle.textContent = cached ? 'Saved comment loaded' : 'Comment saved for later';
      requestCopy.textContent = cached
        ? 'This comment was reused without using another ReGen AI Token.'
        : 'Returning to this unchanged resume will not generate the comment again.';
      action.remove();
      return;
    }

    if (hasSavedComment) {
      requestTitle.textContent = 'Saved ReGen comment available';
      requestCopy.textContent = 'View the saved comment without using another ReGen AI Token.';
      action.id = 'ats-review-view-saved';
      action.textContent = 'View saved comment';
      action.addEventListener('click', () => {
        card.querySelector('.ats-review-comment').textContent = savedComment;
        card.querySelector('.ats-review-mode').textContent = 'Saved ReGen AI review - no new token used';
        requestTitle.textContent = 'Saved comment loaded';
        requestCopy.textContent = 'No ReGen AI Token was used.';
        action.remove();
      }, { once: true });
      return;
    }

    if (!aiEnabled) {
      requestTitle.textContent = 'ReGen AI comment unavailable';
      requestCopy.textContent = 'Local ATS checks remain available without AI.';
      action.remove();
      return;
    }

    if (quota?.exhausted === true || Number(quota?.remaining) === 0) {
      requestTitle.textContent = 'Daily ReGen AI Token limit reached';
      requestCopy.textContent = quotaLimitMessage(quota);
      action.remove();
      return;
    }

    const reviewNeedsUpdate = review.hasPriorReview === true && review.isCurrent === false;
    requestTitle.textContent = reviewNeedsUpdate
      ? 'ReGen comment needs an update'
      : 'Want a concise ReGen comment?';
    const requestCountCopy = quota ? ` ${Number(quota.remaining) || 0} ReGen AI Tokens remain.` : '';
    requestCopy.textContent = (reviewNeedsUpdate
      ? 'Your resume or review checks changed. Generate a new comment only when you are ready.'
      : 'This runs only when you choose and the result is saved for later.') + requestCountCopy;
    action.id = 'ats-review-generate';
    action.innerHTML = `${ReGenIcons.icon('sparkles')} Generate ReGen comment`;
    action.addEventListener('click', requestAtsReview);
  }

  function syncFinalPreviewHeight() {
    const iframe = document.querySelector('.final-preview-frame');
    const shell = document.getElementById('final-preview-page-shell');
    if (!iframe || !shell) return;

    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      const pageHeight = 1123;
      const measured = Math.max(
        doc?.documentElement?.scrollHeight || 0,
        doc?.body?.scrollHeight || 0,
        pageHeight
      );
      const pageAlignedHeight = Math.ceil(measured / pageHeight) * pageHeight;
      shell.style.setProperty('--final-preview-doc-height', `${pageAlignedHeight}px`);
      iframe.style.height = `${pageAlignedHeight}px`;
    } catch (err) {
      // Keep the default one-page preview height if the iframe cannot be measured.
    }
    fitFinalPreview();
  }

  function fitFinalPreview() {
    const stage = document.querySelector('.final-preview-stage');
    const shell = document.getElementById('final-preview-page-shell');
    if (!stage || !shell) return;

    const fit = Math.min((stage.clientWidth - 32) / 794, 1);
    const zoom = Math.max(0.3, fit);
    const docHeight = parseFloat(getComputedStyle(shell).getPropertyValue('--final-preview-doc-height')) || 1123;
    shell.style.setProperty('--final-preview-zoom', zoom.toFixed(2));
    shell.style.marginBottom = `${docHeight * (zoom - 1)}px`;
  }

  // ── Bootstrap ─────────────────────────────────────────────────
  async function init() {
    const params = new URLSearchParams(window.location.search);
    let id = params.get('id');
    
    if (!id) {
      showLoader('Opening your resume...');
      const resume = await Api.createResume();
      hideLoader();
      if (resume.success && resume.data?.id) {
        window.location.replace(`/builder?id=${encodeURIComponent(resume.data.id)}`);
      } else {
        App.showToast(resume.message || 'Unable to open resume.', 'error');
        window.location.href = '/dashboard';
      }
      return;
    }

    Api.setResumeId(id);
    Preview.init();
    window.addEventListener('resize', fitFinalPreview, { passive: true });

    const userResPromise = Api.getMe();

    // Fetch existing data
    showLoader('Loading resume...');
    const res = await Api.getResume();
    hideLoader();

    if (!res.success) {
      alert('Resume not found or access denied.');
      window.location.href = '/dashboard';
      return;
    }

    const resumeData = res.data || {};
    const userRes = await userResPromise;
    if (userRes.success) {
      ZeekeAccountMenu.init({
        userName: userRes.userName || 'User',
        initials: ZeekeAccountMenu.initialsFromUser(userRes.user),
        photoBase64: resumeData.personal?.photoBase64 || '',
      });
    }
    await Stepper.init(resumeData);
    if (params.get('review') === '1') {
      showFinalScreen();
    }

    // Back / Next nav
    document.getElementById('btn-back')?.addEventListener('click', () => Stepper.back());
    document.getElementById('btn-next')?.addEventListener('click', () => Stepper.next());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { showFinalScreen, showToast, showLoader, hideLoader };
})();
