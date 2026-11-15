/* Persistent inbox delivery is always on; optional on-screen/browser alerts require consent. */
(()=>{
  let region;
  function updateStatus(state){const bell=document.querySelector('.workspace-notification-bell');if(!bell)return;bell.dataset.deliveryState=state;const delivery={live:'Live updates',polling:'Automatic updates',offline:'Offline',delayed:'Updates delayed',paused:'Updates paused'}[state]||'Checking for updates';bell.title=(bell.getAttribute('aria-label')||'Notifications')+' · '+delivery;}
  window.addEventListener('regen:live-status',event=>updateStatus(event.detail.state));
  window.addEventListener('regen:user-notification',event=>{
    const item=event.detail;if(!item||document.hidden)return;
    if(!region){region=document.createElement('div');region.className='user-notification-toasts';region.setAttribute('role','log');region.setAttribute('aria-live','polite');region.setAttribute('aria-label','New notifications');document.body.append(region);}
    if(region.querySelector('[data-notification-id="'+Number(item.id)+'"]'))return;
    const toast=document.createElement('article');toast.className='user-notification-toast';toast.dataset.notificationId=Number(item.id);
    const heading=document.createElement('strong');heading.textContent=item.title;
    const body=document.createElement('p');body.textContent=String(item.body||'').slice(0,160);
    const link=document.createElement('a');link.href=/^\/(?:dashboard|support|notifications|store|payments)(?:\?|$)/.test(item.link||'')?item.link:'/notifications';link.textContent='View update →';link.onclick=async event=>{event.preventDefault();await Api.readNotification(Number(item.id));location.assign(link.href);};
    const close=document.createElement('button');close.type='button';close.setAttribute('aria-label','Dismiss notification');close.textContent='×';close.onclick=()=>toast.remove();toast.append(heading,body,link,close);region.append(toast);
    while(region.children.length>3)region.firstElementChild.remove();setTimeout(()=>toast.remove(),12000);
  });
  document.addEventListener('DOMContentLoaded',()=>updateStatus(window.ReGenLive?.state||'connecting'));
})();
