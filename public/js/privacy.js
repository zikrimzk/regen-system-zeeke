/* Consent records contain choices only. No analytics, advertising IDs or document data. */
(() => {
  const key = 'regen:consent';
  const lifetime = 180 * 24 * 60 * 60 * 1000;
  function read() {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      if (value?.version === 1 && value.expires > Date.now() && typeof value.preferences === 'boolean' && typeof value.offline === 'boolean') return value;
    } catch {}
    return null;
  }
  let choice = read();
  let banner, dialog, trigger;
  const current = () => ({preferences:choice?.preferences === true, offline:choice?.offline === true, expires:choice?.expires || Date.now() + 60000});
  function save(preferences, offline) {
    choice = {version:1, preferences, offline, expires:Date.now() + lifetime};
    try {localStorage.setItem(key,JSON.stringify(choice));} catch {}
    if (banner) banner.hidden = true;
    window.dispatchEvent(new CustomEvent('regen:privacy',{detail:current()}));
  }
  function localize(container, labels) {
    for (const [selector, key, attribute] of labels) {
      const element = container.querySelector(selector);
      const text = window.ReGenText?.get('commercial.' + key);
      if (text && attribute) element.setAttribute(attribute, text);
      else if (text) element.textContent = text;
    }
  }
  function close() {dialog?.close();}
  function open(event) {
    trigger = event?.currentTarget || document.activeElement;
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.className = 'privacy-dialog';
      dialog.setAttribute('aria-labelledby','privacy-title');
      dialog.innerHTML = '<div class="privacy-heading"><h2 id="privacy-title">Your privacy choices.</h2><button type="button" class="privacy-close" aria-label="Close privacy choices">×</button></div><p>Choose what ReGen remembers on this device.</p><div class="privacy-setting"><div><h3>Essential</h3><p>Sign-in, abuse prevention and your privacy choices.</p></div><span class="privacy-essential">Always on</span></div><label class="privacy-setting"><span><strong>Preferences</strong><span>Remember your light or dark appearance.</span></span><input type="checkbox" name="preferences" role="switch"></label><label class="privacy-setting"><span><strong>Offline public pages</strong><span>Keep public pages and design samples for faster visits. Private documents stay online.</span></span><input type="checkbox" name="offline" role="switch"></label><p class="privacy-no-tracking">ReGen does not use advertising or analytics trackers.</p><div class="privacy-actions"><button type="button" class="btn btn-primary" data-save-privacy>Save choices</button><button type="button" class="btn btn-secondary" data-reject-privacy>Reject optional</button></div>';
      localize(dialog, [
        ['#privacy-title','privacyTitle'], ['.privacy-close','privacyClose','aria-label'],
        [':scope > p:first-of-type','privacyRemember'], ['h3','privacyEssential'], ['h3 + p','privacyEssentialCopy'],
        ['.privacy-essential','privacyAlways'], ['label:nth-of-type(1) strong','privacyPreferences'],
        ['label:nth-of-type(1) span span','privacyPreferencesCopy'], ['label:nth-of-type(2) strong','privacyOffline'],
        ['label:nth-of-type(2) span span','privacyOfflineCopy'], ['.privacy-no-tracking','privacyPrivacyCopy'],
        ['[data-save-privacy]','privacySave'], ['[data-reject-privacy]','privacyReject'],
      ]);
      dialog.querySelector('.privacy-close').addEventListener('click',close);
      dialog.querySelector('[data-save-privacy]').addEventListener('click',() => {
        save(dialog.querySelector('[name=preferences]').checked,dialog.querySelector('[name=offline]').checked); close();
      });
      dialog.querySelector('[data-reject-privacy]').addEventListener('click',() => {save(false,false);close();});
      dialog.addEventListener('close',() => {if (trigger?.isConnected && !trigger.closest('[hidden]')) trigger.focus({preventScroll:true});});
      document.body.append(dialog);
    }
    const values = current();
    dialog.querySelector('[name=preferences]').checked = values.preferences;
    dialog.querySelector('[name=offline]').checked = values.offline;
    dialog.showModal();
  }
  window.ReGenPrivacy = {get:current, hasChoice:() => !!choice, open};
  window.addEventListener('storage',event => {
    if (event.key !== key) return;
    choice = read(); if (banner) banner.hidden = !!choice;
    window.dispatchEvent(new CustomEvent('regen:privacy',{detail:current()}));
  });
  document.addEventListener('DOMContentLoaded',() => {
    if (document.body.classList.contains('landing-page')) {
      banner = document.createElement('section');
      banner.className = 'privacy-banner'; banner.hidden = !!choice;
      banner.setAttribute('aria-labelledby','privacy-banner-title');
      banner.innerHTML = '<div><h2 id="privacy-banner-title">Your privacy choices.</h2><p>Essential cookies keep sign-in secure. You choose whether to remember your appearance and save public pages for offline visits.</p></div><div class="privacy-actions"><button type="button" class="btn btn-primary" data-accept-privacy>Accept all</button><button type="button" class="btn btn-secondary" data-reject-privacy>Reject optional</button><button type="button" class="btn btn-secondary" data-choose-privacy>Choose cookies</button></div>';
      localize(banner, [
        ['#privacy-banner-title','privacyTitle'], ['p','privacyBanner'], ['[data-accept-privacy]','privacyAccept'],
        ['[data-reject-privacy]','privacyReject'], ['[data-choose-privacy]','privacyChoose'],
      ]);
      banner.querySelector('[data-accept-privacy]').addEventListener('click',() => save(true,true));
      banner.querySelector('[data-reject-privacy]').addEventListener('click',() => save(false,false));
      banner.querySelector('[data-choose-privacy]').addEventListener('click',open);
      document.body.append(banner);
    }
    document.querySelectorAll('[data-privacy-choices]').forEach(button => button.addEventListener('click',open));
  });
})();
