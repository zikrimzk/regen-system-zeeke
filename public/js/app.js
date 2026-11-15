/* APP.JS - REGEN BUILDER BOOTSTRAP */
const App = (() => {

  // ── TOAST NOTIFICATIONS ───────────────────────────────────────
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

  // ── PAGE LOADER ───────────────────────────────────────────────
  function showLoader(text = 'Saving...') {
    const loader = document.getElementById('page-loader');
    const p = loader?.querySelector('p');
    if (p) p.textContent = text;
    loader?.setAttribute('aria-hidden','false');
    loader?.classList.add('active');
  }

  function hideLoader() {
    const loader = document.getElementById('page-loader');
    loader?.classList.remove('active');
    loader?.setAttribute('aria-hidden','true');
  }

  // ── FINAL SCREEN ──────────────────────────────────────────────
  function showFinalScreen() {
    const content = document.getElementById('step-content');
    const navBar  = document.querySelector('.nav-bar');
    const stepperWrap = document.getElementById('stepper-wrap');
    const builder = document.querySelector('.builder-left');

    if (stepperWrap) stepperWrap.classList.add('hidden');
    if (navBar)  navBar.classList.add('hidden');
    builder?.classList.add('is-final');
    document.dispatchEvent(new Event('regen:studio-review'));

    if (content) {
      PdfPages.clear(document.getElementById('final-pdf-pages'));
      const previewSrc = Api.documentUrl();
      const kind=Stepper.getDraftResume().writing?.documentType==='academic-cv'?'CV':'Resume';
      content.innerHTML = `
        <div class="final-screen">
          <div class="final-layout">
            <div class="final-sidebar">
              <section class="final-panel">
                <div class="final-ready-row">
                  <div class="final-icon">
                    <svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
                  </div>
                  <div>
                    <h2 class="final-title">${kind} review</h2>
                  </div>
                </div>
                <p class="text-muted mt-sm">
                  A final look. Then your next move.
                </p>
              </section>

              <section class="ats-review-card" id="ats-review-card" aria-live="polite" aria-busy="true">
                <div class="ats-review-loading">
                  <span class="ai-spinner" aria-hidden="true"></span>
                  <div>
                    <strong>Loading writing checks</strong>
                    <p>This local check does not use a token.</p>
                  </div>
                </div>
              </section>

              <div class="final-actions">
                <button type="button" class="btn btn-primary btn-lg w-full" id="btn-download-pdf">
                  <svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>
                  Download
                </button>
                <div class="final-secondary-actions">
                  <button type="button" class="btn btn-secondary flex-1" id="btn-back-to-edit" aria-label="Edit resume">
                    <svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18 9 12l6-6"/></svg>
                      Edit
                  </button>
                  <a href="/dashboard" class="btn btn-secondary flex-1">
                    <svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h7v7H4z"/><path d="M13 4h7v7h-7z"/><path d="M4 13h7v7H4z"/><path d="M13 13h7v7h-7z"/></svg>
                    Dashboard
                  </a>
                </div>
              </div>
            </div>
            <div class="final-preview-card">
              <div class="final-preview-header">Your ${kind==='CV'?'CV':'resume'}</div>
              <div class="final-preview-stage">
                <div class="final-preview-page-shell" id="final-preview-page-shell">
                  <div id="final-pdf-pages" class="pdf-pages"></div>
                </div>
              </div>
            </div>
          </div>
        </div>`;

      PdfPages.render(document.getElementById('final-pdf-pages'), previewSrc, {documentType:kind==='CV'?'academic-cv':'resume',onSettings:()=>document.getElementById('resume-layout-settings')?.click()});
      document.getElementById('btn-download-pdf')?.addEventListener('click', async (e) => {
        const res = await Api.downloadPdf(e.currentTarget);
        if (!res.success && !res.handled) App.showToast(res.message || 'PDF download failed.', 'error');
      });

      document.getElementById('btn-back-to-edit')?.addEventListener('click', async () => {
        PdfPages.clear(document.getElementById('final-pdf-pages'));
        if (stepperWrap) stepperWrap.classList.remove('hidden');
        if (navBar) navBar.classList.remove('hidden');
        builder?.classList.remove('is-final');
        await Stepper.resumeEditing();
        document.getElementById('step-content')?.focus({preventScroll:true});
      });

      loadAtsReviewState();
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
          <strong>Writing review is temporarily unavailable</strong>
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

    const result = await Api.generateAtsReview(undefined, Number(card.dataset.aiCost ?? 1));
    if (result.quota) window.ReGenAI?.setQuota(result.quota);
    if (!card.isConnected) return;
    if (!result.success || !result.review) {
      card.setAttribute('aria-busy', 'false');
      button.disabled = false;
      button.innerHTML = originalHtml;
      if (status) {
        status.textContent = result.message || 'The comment could not be generated. Your local writing checks are still available.';
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
    const date = quota?.resetAt ? new Date(quota.resetAt) : null;
    const reset = date && !Number.isNaN(date.getTime())
      ? date.toLocaleString(undefined, {
          year: 'numeric', month: 'short', day: 'numeric',
          hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
        })
      : 'the next reset';
    return quota?.renewable===false?'This action needs more tokens than are available. Your AI allowance does not renew automatically. Saved tokens are used after base tokens.':`This action needs more tokens than are available. Your AI allowance renews ${reset}. Saved tokens are used after base tokens.`;
  }

  function renderAtsReview(
    review,
    { aiEnabled = true, revealAi = false, cached = false, quota = null } = {}
  ) {
    const card = document.getElementById('ats-review-card');
    if (!card) return;
    const reviewCost = Number(quota?.costs?.review ?? 1);
    card.dataset.aiCost = String(reviewCost);
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
        <div class="ats-score ats-score-${level}" role="img" aria-label="Local writing readiness score ${score} out of 100">
          <strong></strong>
          <span>/100</span>
        </div>
        <div class="ats-review-title">
          <p class="final-eyebrow">Writing readiness</p>
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
      <details class="writing-check-details"><summary>See all checks</summary><ul></ul></details>
      <details class="writing-proofread"><summary>Before you apply</summary><ul><li>Verify every qualification, date, contribution and number.</li><li>Check contact details and open your professional links.</li><li>Read aloud for grammar, spelling and natural wording.</li><li>Check tense, punctuation and citation consistency.</li><li>Inspect every PDF page and follow the employer’s file instructions.</li></ul></details>
      <p class="ats-disclaimer">Local writing guidance. Employer ATS parsing, factual accuracy and spelling or grammar are not certified by this score.</p>`;

    card.querySelector('.ats-score strong').textContent = String(score);
    card.querySelector('.ats-review-title h3').textContent = `${review.label || 'Writing review'}`;
    card.querySelector('.ats-review-mode').textContent = showAiComment
      ? (cached ? 'Saved ReGen AI review - no new token used' : 'Reviewed with ReGen AI')
      : 'Local checks · No token used';
    card.querySelector('.ats-review-comment').textContent = showAiComment
      ? review.comment
      : review.summary || review.comment || '';
    const checks=card.querySelector('.writing-check-details ul');
    (Array.isArray(review.checks)?review.checks:[]).forEach(check=>{const li=document.createElement('li');li.className='writing-check '+(check.status==='improve'?'needs-review':check.status==='pass'?'checked':'information');const title=document.createElement('strong');title.textContent=(check.status==='pass'?'✓ ':check.status==='improve'?'Review: ':'')+check.label;const text=document.createElement('p');text.textContent=check.detail;li.append(title,text);checks.append(li);});

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
      : ['Tailor the relevant evidence to the role, then proofread and inspect the exported PDF.'];
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
        ? 'This comment was reused without using another token.'
        : 'Returning to this unchanged resume will not generate the comment again.';
      action.remove();
      return;
    }

    if (hasSavedComment) {
      requestTitle.textContent = 'Saved ReGen comment available';
      requestCopy.textContent = 'View the saved comment without using another token.';
      action.id = 'ats-review-view-saved';
      action.textContent = 'View saved comment';
      action.addEventListener('click', () => {
        card.querySelector('.ats-review-comment').textContent = savedComment;
        card.querySelector('.ats-review-mode').textContent = 'Saved ReGen AI review - no new token used';
        requestTitle.textContent = 'Saved comment loaded';
        requestCopy.textContent = 'No token was used.';
        action.remove();
      }, { once: true });
      return;
    }

    if (!aiEnabled) {
      requestTitle.textContent = 'ReGen AI comment unavailable';
      requestCopy.textContent = 'Local writing checks remain available without AI.';
      action.remove();
      return;
    }

    if (quota && Number(quota.remaining) < reviewCost) {
      requestTitle.textContent = 'Not enough tokens';
      requestCopy.textContent = `This comment uses ${reviewCost} tokens; ${Number(quota.remaining)} remain. ${quota.resetAt ? 'Resets ' + new Date(quota.resetAt).toLocaleString() + '.' : 'Check your allowance with an administrator.'}`;
      action.remove();
      return;
    }

    const reviewNeedsUpdate = review.hasPriorReview === true && review.isCurrent === false;
    requestTitle.textContent = reviewNeedsUpdate
      ? 'ReGen comment needs an update'
      : 'Want a concise ReGen comment?';
    requestCopy.textContent = quota ? `${Number(quota.remaining).toLocaleString()} tokens available` : '';
    action.id = 'ats-review-generate';
    action.innerHTML = `${ReGenIcons.icon('sparkles')} Generate ReGen comment`;
    window.ReGenTokens?.setAiCosts({review:reviewCost});
    window.ReGenTokens?.bind(action,'ai_review','Generate review');
    action.addEventListener('click', requestAtsReview);
  }


  async function init() {
    const params = new URLSearchParams(window.location.search);
    let id = params.get('id');
    
    if (!id) {
      const dashboard = await Api.listResumes();
      if (!dashboard.success) {
        App.showToast(dashboard.message || 'Unable to open your workspace.', 'error');
        window.location.replace('/dashboard');
        return;
      }
      window.location.replace(dashboard.profile
        ? `/builder?id=${encodeURIComponent(dashboard.profile.id)}`
        : '/templates');
      return;
    }

    Api.setResumeId(id);
    Preview.init();

    const userResPromise = Api.getMe();

    // FETCH EXISTING DATA
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
    Studio.init(res.title, resumeData.templateId || 'classic');
    document.addEventListener('regen:writing-settings-changed',()=>{if(document.querySelector('.builder-left.is-final'))showFinalScreen();});
    const layoutButton = document.getElementById('resume-layout-settings');
    if (layoutButton) layoutButton.innerHTML = `${ReGenIcons.icon('settings')} ${ReGenText.get('studio.pageSettings')}`;
    const templateButton = document.getElementById('change-resume-template');
    function updateTemplateName(id) {
      ReGenTemplates.catalog().then(templates => {
        const template = templates.find(t => t.id === id) || templates[0];
        templateButton.innerHTML = `${ReGenIcons.icon('template')} ${ZeekeSafe.attr(template.name)}`;
        templateButton.title = ReGenText.get('public.sampleSwitch');
        templateButton.setAttribute('aria-label', `${ReGenText.get('studio.currentDesign')}: ${template.name}`);
      }).catch(() => { templateButton.textContent = ReGenText.get('demo.design'); });
    }
    updateTemplateName(resumeData.templateId || 'classic');
    templateButton?.addEventListener('click', () => {
      ReGenTemplates.choose(Stepper.getDraftResume().templateId || 'classic', async templateId => {
        const result = await Api.saveSection('templateId', templateId);
        if (!result.success) throw new Error(result.message || 'Unable to change the template.');
        Stepper.setTemplate(templateId);
        updateTemplateName(templateId);
        App.showToast('Resume and cover letter design updated.', 'success');
      });
    });
    if (params.get('review') === '1') {
      showFinalScreen();
    } else if (params.get('designs') === '1') {
      const url = new URL(location.href);
      url.searchParams.delete('designs');
      history.replaceState(null, '', url);
      templateButton?.click();
    }

    // BACK / NEXT NAV
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
