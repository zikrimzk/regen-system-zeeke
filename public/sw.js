const CACHE_VERSION = 'regen-public-20261115-kerjaya';
const POLICY_CACHE = 'regen-storage-policy-v1';
const POLICY_KEY = '/__regen_storage_policy__';
const SHELL = ['/offline', '/css/site.css', '/css/mochi.css', '/js/theme.js', '/js/interface.js', '/js/privacy.js', '/js/document-preview.js', '/js/landing.js', '/js/commerce-ui.js', '/js/landing-pricing.js', '/js/pwa.js', '/fonts/Inter-Latin.woff2', '/fonts/Inter-Regular.woff2', '/fonts/Inter-SemiBold.woff2', '/demo/templates/modern', '/img/brand-wordmark-116.webp', '/img/app-mark-32.webp', '/img/app-mark-96.webp', '/manifest.webmanifest'];
const publicAsset = path => /^(?:\/css\/[a-z0-9-]+\.css|\/js\/[a-z0-9-]+\.js|\/fonts\/[a-z0-9-]+\.(?:ttf|woff2)|\/img\/(?:brand-wordmark(?:-(?:116|232|348))?|app-mark-(?:32|96)|app-icon-192|app-icon-512|app-icon-maskable|apple-touch-icon|social-preview|app-preview-wide|app-preview-narrow)\.(?:png|jpg|webp)|\/img\/templates\/(?:classic|executive|modern|minimal|editorial|precision|heritage|horizon|signature|essential|graduate|atlas|meridian|keystone|counsel|impact)-(?:320|640|1280)\.webp|\/samples\/(?:classic|executive|modern|minimal|editorial|precision|heritage|horizon|signature|essential|graduate|atlas|meridian|keystone|counsel|impact)\.pdf|\/manifest\.webmanifest)$/i.test(path);
const publicDemo = path => path === '/site/templates.json' || /^\/demo\/(?:templates|letters)\/(?:classic|executive|modern|minimal|editorial|precision|heritage|horizon|signature|essential|graduate|atlas|meridian|keystone|counsel|impact)$/.test(path);
let policy;
let policyExpires = 0;
let policyRevision = 0;
let warming;
let warmingRevision = -1;
async function allowed() {
  if (policy !== undefined && policyExpires > Date.now()) return policy;
  const revision = policyRevision;
  try {
    const stored = await (await caches.open(POLICY_CACHE)).match(POLICY_KEY);
    const value = stored ? await stored.json() : null;
    if (revision === policyRevision) {
      policyExpires = Number(value?.expires) || Date.now() + 60000;
      policy = value?.enabled === true && policyExpires > Date.now();
    }
  } catch {if (revision === policyRevision) {policy = false;policyExpires = Date.now() + 60000;}}
  return policy;
}
async function purgePublic() {
  const keys = await caches.keys();
  await Promise.all(keys.filter(key => key.startsWith('regen-public-')).map(key => caches.delete(key)));
}
async function remember(request, response) {
  if (!response.ok || response.redirected || response.type === 'opaque' || !await allowed()) return;
  if (/\b(?:private|no-store)\b/i.test(response.headers.get('Cache-Control') || '')) return;
  const path = new URL(typeof request === 'string' ? request : request.url,self.location.origin).pathname;
  if (/\.(?:css|js)$/.test(path) && /text\/html/i.test(response.headers.get('Content-Type') || '')) return;
  const cache = await caches.open(CACHE_VERSION);
  await cache.put(request,response.clone());
  const keys = await cache.keys();
  const removable = keys.filter(key => !['/','/offline'].includes(new URL(key.url).pathname));
  if (keys.length > 120) await Promise.all(removable.slice(0,keys.length - 120).map(key => cache.delete(key)));
}
async function warmAssets() {
  if (!await allowed()) return;
  const revision = policyRevision;
  const cache = await caches.open(CACHE_VERSION);
  async function warmPath(path) {
    const existing = await cache.match(path);
    if (existing) return existing;
    const response = await fetch(path,{credentials:'omit',cache:'reload'});
    if (policy && revision === policyRevision) await remember(path,response);
    return response;
  }
  const landing = await warmPath('/').catch(() => null);
  const versioned = new Map();
  let heroSample;
  if (landing?.ok) {
    const html = await landing.text();
    const assetReferences = /\b(?:href|src)="(\/(?:css|js)\/[a-z0-9-]+\.(?:css|js))\?v=([a-f0-9]{12})"/gi;
    for (const [, path, version] of html.matchAll(assetReferences)) versioned.set(path, `${path}?v=${version}`);
    const image = html.match(/<img id="hero-document-image" src="(\/img\/templates\/[a-z]+-320\.webp)"/i)?.[1];
    if (image && publicAsset(image)) heroSample = image;
  }
  if (policy && revision === policyRevision) {
    const paths = SHELL.map(path => versioned.get(path) || path);
    if (heroSample) paths.push(heroSample);
    await Promise.allSettled(paths.map(warmPath));
  }
}
function warm() {
  if (!warming || warmingRevision !== policyRevision) {
    warmingRevision = policyRevision;
    const work = warmAssets().finally(() => { if (warming === work) warming = null; });
    warming = work;
  }
  return warming;
}
function offlinePage() {
  return new Response('<!doctype html><html lang="en"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>Kerjaya. · Offline</title><style>body{font:16px/1.6 system-ui,sans-serif;margin:0;padding:32px;min-height:80vh;display:grid;place-content:center}main{max-width:420px}h1{font-size:36px;line-height:1.1;letter-spacing:-.04em}p{opacity:.75}a{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 24px;border-radius:999px;background:#087653;color:white;text-decoration:none}</style><main><strong>Kerjaya.</strong><h1>A moment offline.</h1><p>Reconnect to open your workspace. Your private documents are kept online.</p><a href="/">Try again</a></main></html>',{status:200,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
}
self.addEventListener('install',event => {
  event.waitUntil((async () => {await warm(); await self.skipWaiting();})());
});
self.addEventListener('activate',event => {
  event.waitUntil((async () => {
    const enabled = await allowed();
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('regen-public-') && (!enabled || key !== CACHE_VERSION)).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('message',event => {
  if (!event.source?.url || new URL(event.source.url).origin !== self.location.origin) return;
  if (event.data?.type !== 'regen:cache-policy' || typeof event.data.enabled !== 'boolean') return;
  event.waitUntil((async () => {
    policyRevision++;
    const expires = Math.min(Number(event.data.expires) || Date.now() + 60000,Date.now() + 180 * 86400000);
    policyExpires = expires;
    policy = event.data.enabled && expires > Date.now();
    await (await caches.open(POLICY_CACHE)).put(POLICY_KEY,new Response(JSON.stringify({enabled:policy,expires}),{headers:{'Content-Type':'application/json'}}));
    if (policy) await warm(); else await purgePublic();
    event.ports?.[0]?.postMessage({ok:true,enabled:policy});
  })());
});
self.addEventListener('fetch',event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate' && !publicDemo(url.pathname) && !publicAsset(url.pathname)) {
    if (url.pathname === '/' || url.pathname === '/offline') {
      event.respondWith((async () => {
        const enabled = await allowed();
        try {
          const response = await fetch(request,{cache:'no-cache'});
          if (response.status < 500) {
            if (enabled && response.ok) event.waitUntil(remember(url.pathname,response.clone()).catch(() => {}));
            return response;
          }
          return (enabled && await (await caches.open(CACHE_VERSION)).match(url.pathname)) || response;
        } catch {
          return (enabled && await (await caches.open(CACHE_VERSION)).match(url.pathname)) || offlinePage();
        }
      })());
    } else {
      // Authentication pages, APIs and private documents never enter Cache Storage.
      event.respondWith(fetch(request,{cache:'no-store'}).catch(() => offlinePage()));
    }
    return;
  }
  if (!publicAsset(url.pathname) && !publicDemo(url.pathname)) return;
  event.respondWith((async () => {
    if (!await allowed()) {
      try {return await fetch(request);} catch {return request.mode === 'navigate' ? offlinePage() : Response.error();}
    }
    const cache = await caches.open(CACHE_VERSION);
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      await remember(request,response);
      return response;
    } catch {return (!url.search && await cache.match(url.pathname)) || Response.error();}
  })());
});
