(() => {
  let installPrompt = null;
  const installed = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; });
  window.addEventListener('appinstalled', () => { installPrompt = null; document.querySelectorAll('[data-install]').forEach(button => { button.textContent = 'ReGen is installed'; button.disabled = true; }); });

  function showInstallHelp() {
    let dialog = document.getElementById('pwa-install-help');
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.id = 'pwa-install-help';
      dialog.className = 'pwa-dialog';
      dialog.setAttribute('aria-labelledby', 'pwa-install-title');
      const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const steps = ios
        ? '<li>Open ReGen in Safari.</li><li>Open the Share menu and choose <strong>Add to Home Screen</strong>.</li><li>Keep <strong>Open as Web App</strong> enabled if offered, then tap Add.</li>'
        : '<li>Open ReGen in a browser that supports installed web apps, such as Chrome or Edge.</li><li>Use the install icon in the address bar, or open the browser menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li><li>If no install option appears, you can bookmark ReGen and continue using it in your browser.</li>';
      dialog.innerHTML = `<h2 id="pwa-install-title">${installed() ? 'ReGen is already installed.' : 'Keep ReGen within reach.'}</h2><p>${installed() ? 'You are already using the installed app. Your workspace is ready when you sign in.' : 'Installation is available on supported browsers over HTTPS. Here is how to add ReGen:'}</p>${installed() ? '' : `<ol>${steps}</ol>`}<p>Editing, saving, AI recommendations and downloads need an internet connection. Private documents are not saved in the offline cache.</p><button type="button" class="btn btn-primary">Got it</button>`;
      dialog.querySelector('button').addEventListener('click', () => dialog.close());
      dialog.addEventListener('close', () => dialog.remove(), { once: true });
      document.body.append(dialog);
    }
    dialog.showModal();
  }

  document.addEventListener('click', async event => {
    const button = event.target.closest('[data-install]');
    if (!button) return;
    event.preventDefault();
    if (!installPrompt || installed()) { showInstallHelp(); return; }
    button.disabled = true;
    const prompt = installPrompt;
    installPrompt = null;
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } catch { showInstallHelp(); }
    finally { button.disabled = installed(); }
  });

  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  async function register() {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
      let updatePending = false;
      const showUpdate = () => {
        if (!updatePending || document.querySelector('.pwa-update,.privacy-banner:not([hidden]),#login-form,#register-form,#profile-form,#admin-login-form')) return;
        const notice = document.createElement('div');
        notice.className = 'pwa-update'; notice.setAttribute('role','status');
        notice.innerHTML = '<span>A fresh ReGen is ready.</span><button type="button" class="btn btn-secondary">Reload</button><button type="button" class="pwa-update-dismiss" aria-label="Dismiss update">×</button>';
        notice.querySelector('.btn').addEventListener('click',() => {
          const event = new Event('regen:before-update',{cancelable:true});
          if (!window.dispatchEvent(event)) {notice.querySelector('span').textContent = 'Save your changes before reloading.';return;}
          location.reload();
        });
        notice.querySelector('.pwa-update-dismiss').addEventListener('click',() => {updatePending = false;notice.remove();});
        document.body.append(notice);
      };
      const sentPolicies = new WeakMap();
      const syncPolicy = () => {
        const values = window.ReGenPrivacy?.get() || {offline:false,expires:Date.now() + 60000};
        const stamp = `${values.offline}:${values.expires}`;
        [registration.active,registration.waiting,registration.installing].filter(Boolean).forEach(worker => {
          if (sentPolicies.get(worker) === stamp) return;
          sentPolicies.set(worker,stamp);
          worker.postMessage({type:'regen:cache-policy',enabled:values.offline,expires:values.expires});
        });
        showUpdate();
      };
      registration.addEventListener('updatefound',() => {
        const worker = registration.installing;
        worker?.addEventListener('statechange',() => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {updatePending = true;showUpdate();}
          if (worker.state === 'activated') syncPolicy();
        });
      });
      navigator.serviceWorker.addEventListener('controllerchange',syncPolicy);
      window.addEventListener('regen:privacy',syncPolicy);
      syncPolicy();
      navigator.serviceWorker.ready.then(syncPolicy).catch(() => {});
      let lastCheck = 0;
      const checkUpdate = () => {
        if (Date.now()-lastCheck<60000 || !navigator.onLine) return;
        lastCheck=Date.now();
        registration.update().catch(() => {});
      };
      window.addEventListener('online',checkUpdate);
      window.addEventListener('pageshow',event=>{if(event.persisted)checkUpdate();});
      document.addEventListener('visibilitychange',()=>{if(!document.hidden&&installed())checkUpdate();});
    } catch { /* BROWSER ACCESS REMAINS AVAILABLE WITHOUT INSTALLATION. */ }
  }
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
})();
