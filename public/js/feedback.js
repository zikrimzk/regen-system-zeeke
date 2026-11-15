window.ReGenFeedback = (() => {
  let request;
  let ready = false;
  let prompted = false;
  let activeDialog = null;
  let opening = false;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, value => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[value]));

  function ratingField(name, legend, optional = false) {
    return `<fieldset class="feedback-rating"><legend>${legend}${optional?' <span>Optional</span>':''}</legend><div class="feedback-stars">${[1,2,3,4,5].map(star=>`<label><input type="radio" name="${name}" value="${star}" ${optional?'':'required'}><span aria-hidden="true">★</span><span class="sr-only">${star} ${star===1?'star':'stars'}</span></label>`).join('')}</div><p>1 means needs work. 5 means works very well.</p></fieldset>`;
  }

  async function open(source = 'general') {
    if (!ready || activeDialog || opening) return;
    opening = true;
    const status = await request('/api/feedback');
    opening = false;
    if (!status.success || !status.policy.enabled) {
      const notice=document.createElement('div');notice.className='service-feature-message';notice.setAttribute('role','status');notice.textContent=status.message||'Feedback is temporarily unavailable. You can still contact support.';document.body.append(notice);setTimeout(()=>notice.remove(),6000);
      return;
    }
    const dialog = document.createElement('dialog');
    activeDialog = dialog;
    dialog.className = 'feedback-dialog';
    dialog.setAttribute('aria-labelledby','feedback-title');
    const reward = status.rewardEligible && status.policy.reward > 0
      ? `<p class="feedback-reward">This feedback earns <strong>${Number(status.policy.reward)} bonus tokens</strong>. They stay available until used. Every rating receives the same reward. ${Number(status.rewardsRemaining)} ${Number(status.rewardsRemaining)===1?'rewarded response':'rewarded responses'} remaining.</p>` : '';
    dialog.innerHTML = `<form method="post"><header><div><p class="service-eyebrow">Help shape ReGen</p><h2 id="feedback-title">How can we make this better?</h2></div><button type="button" class="feedback-close" aria-label="Close feedback">×</button></header><div class="feedback-body"><p class="feedback-intro">Tell us what really happened. Critical feedback is just as useful as praise.</p>${reward}${ratingField('rating','Your overall experience')}
      <details class="feedback-extra"><summary>Rate the features and ease of use</summary>${ratingField('functionalityRating','How well did the features work?',true)}${ratingField('easeRating','How easy was ReGen to use?',true)}</details>
      <label class="feedback-field">What is your feedback about?<select name="area">${[['overall','The overall experience'],['resume','Resume editor'],['ai','AI assistance'],['templates','Resume designs'],['downloads','PDF downloads'],['cover_letters','Cover letters'],['account','Account and sign-in'],['support','Support']].map(([key,label])=>`<option value="${key}"${source==='resume_download'&&key==='downloads'?' selected':''}>${label}</option>`).join('')}</select></label>
      <label class="feedback-field">What worked, and what should we improve?<textarea name="comment" rows="4" minlength="10" maxlength="5000" required placeholder="Be specific. What felt confusing, slow, missing or useful?"></textarea></label><p class="feedback-privacy">Please leave out passwords and sensitive personal details. For a problem that needs a reply, <a href="/support">open a support request</a>.</p><p class="feedback-error" role="status"></p></div><footer><button type="button" class="btn btn-secondary" data-later>Maybe later</button><button type="submit" class="btn btn-primary">Send feedback</button></footer></form>`;
    document.body.append(dialog);
    const returnFocus = document.activeElement;
    const close = () => dialog.close();
    dialog.querySelector('.feedback-close').onclick = close;
    dialog.querySelector('[data-later]').onclick = close;
    dialog.addEventListener('close',()=>{dialog.remove();activeDialog=null;if(returnFocus?.isConnected)returnFocus.focus();},{once:true});
    dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const bounds=dialog.getBoundingClientRect();if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)close();});
    const form = dialog.querySelector('form');
    const submissionKey = crypto.randomUUID();
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      if (!form.reportValidity()) return;
      const button = form.querySelector('[type="submit"]');
      if (button.disabled) return;
      button.disabled = true;
      button.textContent = 'Sending…';
      const values = Object.fromEntries(new FormData(form));
      const result = await request('/api/feedback','POST',{...values,source,submissionKey});
      button.disabled = false;
      button.textContent = 'Send feedback';
      if (!result.success) { form.querySelector('.feedback-error').textContent=result.message||'Your feedback was not sent. Please try again.';return; }
      prompted = true;
      window.dispatchEvent(new CustomEvent('regen:bonus-updated',{detail:result.bonus}));
      window.ReGenAI?.loadStatus({force:true});
      const bonusMessage = result.rewardGranted > 0 ? `${Number(result.rewardGranted)} bonus tokens have been added. Your bonus balance is ${Number(result.bonus.balance)}.` : 'Your feedback is with the team. It will help us decide what to improve next.';
      dialog.classList.add('is-complete');
      form.innerHTML = `<div class="feedback-thanks"><span aria-hidden="true">✓</span><p class="service-eyebrow">Feedback received</p><h2 id="feedback-title">Thank you for being honest.</h2><p>${escape(bonusMessage)}</p><button class="btn btn-primary" type="button">Back to ReGen</button></div>`;
      form.querySelector('button').onclick = close;
      form.querySelector('button').focus();
    });
    dialog.showModal();
    form.querySelector('input').focus();
  }

  async function afterDownload() {
    if (!ready || prompted) return;
    const status=await request('/api/feedback');
    if (!status.success || !status.policy.enabled || !status.policy.downloadPrompt) return;
    if (status.lastFeedbackAt && Date.now()-new Date(status.lastFeedbackAt.replace(' ','T')+'Z').getTime()<7*86400000) return;
    prompted=true;
    open('resume_download');
  }

  function start(client) {
    if(ready)return;
    request=client;
    ready=true;
    const launcher=document.createElement('button');
    launcher.type='button';launcher.className='feedback-launcher';launcher.setAttribute('aria-label','Give feedback');launcher.setAttribute('aria-haspopup','dialog');
    launcher.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11a8 8 0 0 1-8 8H7l-4 3V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3z"/><path d="M7 8h10M7 12h7"/></svg><span>Feedback</span>';
    launcher.onclick=()=>open();
    // The editor already exposes feedback in its account menu. Keep the writing
    // and navigation area clear at every viewport size.
    if(!document.body.matches('.builder-page,.cover-letter-page,.template-page,.store-page'))document.body.append(launcher);
    document.querySelectorAll('[data-feedback-open]').forEach(button=>button.onclick=()=>{const menu=button.closest('.account-menu-panel');menu?.classList.add('hidden');document.getElementById('account-menu-toggle')?.setAttribute('aria-expanded','false');open();});
    if(document.body.dataset.servicePage==='feedback'){
      document.getElementById('open-feedback')?.addEventListener('click',()=>open());
      document.getElementById('feedback-page-status')?.replaceChildren(document.createTextNode('Your honest feedback helps us improve. Use the button below whenever you want to share your experience.'));
    }
  }
  window.addEventListener('regen:resume-downloaded',afterDownload);
  return {start,open};
})();
