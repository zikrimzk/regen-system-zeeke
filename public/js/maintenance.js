document.addEventListener('DOMContentLoaded',()=>{
  const preview=document.body.dataset.preview==='true';let timer;
  const date=value=>new Date(value.replace(' ','T')+'Z').toLocaleString('en-MY',{timeZone:'Asia/Kuala_Lumpur',dateStyle:'medium',timeStyle:'short'})+' MYT';
  const render=state=>{
    document.getElementById('maintenance-title').textContent=state.title;
    document.getElementById('maintenance-message').textContent=state.message;
    const estimate=document.getElementById('maintenance-estimate');estimate.hidden=!state.estimatedAt&&!state.endsAt;
    estimate.textContent=(state.estimatedAt?'Estimated return: ':state.endsAt?'Scheduled return: ':'')+((state.estimatedAt||state.endsAt)?date(state.estimatedAt||state.endsAt):'');
    if (!state.active && !preview) {
      const destination = document.body.dataset.returnTo || '/dashboard';
      const returnPath = destination.split('?')[0];
      const currentPath = location.pathname.replace(/\/$/, '').replace(/\.html$/, '');
      // A verification link's fragment stays in the browser while the server renders maintenance.
      const emailToken = currentPath === returnPath && ['/verify-email', '/reset-password'].includes(returnPath)
        && /^#token=[A-Za-z0-9_-]{43}$/.test(location.hash) ? location.hash : '';
      location.replace(destination + emailToken);
    }
  };
  async function check(){try{const response=await fetch('/api/system/status',{cache:'no-store'});if(response.ok)render((await response.json()).maintenance);}catch{}clearTimeout(timer);if(!document.hidden)timer=setTimeout(check,10000);}
  document.querySelector('.maintenance-preview-label').hidden=!preview;
  window.addEventListener('regen:maintenance',event=>render(event.detail));
  document.addEventListener('visibilitychange',()=>{clearTimeout(timer);if(!document.hidden)check();});
  window.addEventListener('pagehide',()=>clearTimeout(timer));check();
});
