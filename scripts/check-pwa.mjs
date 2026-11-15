import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// Exercise the shipped worker with deterministic Cache/Fetch implementations.
// No browser automation, network access, account data or external packages are used.
const root = new URL('../',import.meta.url);
const source = await fs.readFile(new URL('public/sw.js',root),'utf8');
const origin = 'https://regen.test';
const buckets = new Map();
const handlers = new Map();
let online = true, contentVersion = 1, fetches = 0, assertions = 0;
let landingMarkup = '';
let fetchGate = null, notifyFetch = null;
const check = (value,message) => {assert.ok(value,message); assertions++;};
const keyOf = request => new URL(typeof request === 'string' ? request : request.url,origin).href;
const cacheStorage = {
  async keys() {return [...buckets.keys()];},
  async delete(name) {return buckets.delete(name);},
  async open(name) {
    if (!buckets.has(name)) buckets.set(name,new Map());
    const values = buckets.get(name);
    return {
      async match(request) {return values.get(keyOf(request))?.clone();},
      async put(request,response) {values.set(keyOf(request),response.clone());},
      async keys() {return [...values.keys()].map(url => ({url}));},
      async delete(request) {return values.delete(keyOf(request));},
    };
  }
};
const context = vm.createContext({
  URL,Response,Date,Promise,JSON,Number,Map,console,caches:cacheStorage,
  fetch:async request => {
    fetches++;
    if (fetchGate) { notifyFetch?.(); await fetchGate; }
    if (!online) throw new TypeError('Simulated offline network');
    const url = new URL(keyOf(request));
    const path = url.pathname;
    if (path==='/css/invalid.css') return new Response('<html>Not a stylesheet</html>',{headers:{'Content-Type':'text/html'}});
    if (path==='/' && url.searchParams.has('lang')) return new Response('LOCALIZED',{headers:{'Cache-Control':'private, no-store'}});
    if (path==='/' && landingMarkup) return new Response(landingMarkup,{headers:{'Content-Type':'text/html'}});
    return new Response((['/dashboard','/builder','/profile','/mochi'].includes(path) ? 'PRIVATE' : 'PUBLIC') + contentVersion);
  },
  self:{location:{origin},clients:{claim:async () => {}},skipWaiting:async () => {},addEventListener:(type,handler) => handlers.set(type,handler)},
});
vm.runInContext(source,context,{filename:'public/sw.js'});
async function event(type,values = {}) {
  const tasks = [];let response;
  const value = {...values,waitUntil:task => tasks.push(task),respondWith:task => {response = task;}};
  handlers.get(type)(value);
  const result = response ? await response : null;
  await Promise.all(tasks);
  return result;
}
const request = (path,mode = 'cors',method = 'GET') => ({url:new URL(path,origin).href,mode,method});
const get = (path,mode) => event('fetch',{request:request(path,mode)});
async function policy(enabled,expires = Date.now()+3600000,sourceOrigin = origin) {
  let ack;
  await event('message',{source:{url:sourceOrigin+'/'},data:{type:'regen:cache-policy',enabled,expires},ports:[{postMessage:value => {ack = value;}}]});
  return ack;
}
const publicBuckets = () => [...buckets.entries()].filter(([name]) => name.startsWith('regen-public-'));
const publicKeys = () => publicBuckets().flatMap(([,values]) => [...values.keys()]);

await event('install');await event('activate');
check(publicKeys().length === 0,'Installation must not pre-cache without a choice.');
const first = await get('/css/main.css?v=one');
check((await first.text()) === 'PUBLIC1','Online assets remain available without optional storage.');
check(publicKeys().length === 0,'Declining optional storage must not cache assets.');
check(await policy(true,Date.now()+3600000,'https://other.test') === undefined,'Reject cross-origin policy messages.');
check(publicKeys().length === 0,'A foreign message cannot enable caching.');
const accepted = await policy(true);
check(accepted?.enabled === true,'A same-origin choice enables offline public caching.');
check(publicKeys().some(url => new URL(url).pathname === '/'),'Accepting warms the landing page.');
check(publicKeys().some(url => new URL(url).pathname === '/offline'),'Accepting warms the offline fallback.');
const beforeAsset = fetches;
await get('/css/site.css');
check(fetches === beforeAsset,'A cached asset avoids another network request.');
contentVersion = 2;
const cachedLanding = await get('/','navigate');
check((await cachedLanding.text()) === 'PUBLIC2','Installed app navigation receives the current public release while online.');
const publicCache = (await cacheStorage.keys()).find(name => name.startsWith('regen-public-'));
check(await (await (await cacheStorage.open(publicCache)).match('/')).text() === 'PUBLIC2','The current release is available as the offline fallback.');
await get('/?lang=ms','navigate');
check(await (await (await cacheStorage.open(publicCache)).match('/')).text() === 'PUBLIC2','A private locale response cannot overwrite the public offline landing.');
await get('/css/invalid.css?v=latest');
check(!publicKeys().some(url=>url.includes('/css/invalid.css')),'Never save an HTML error page as a stylesheet.');
online = false;
check((await (await get('/','navigate')).text()) === 'PUBLIC2','The accepted landing page works offline.');
check((await (await get('/builder?id=123','navigate')).text()).includes('A moment offline.'),'A private page gets a safe offline response.');
check((await get('/css/site.css?v=uncached')).type==='error','A different revision must never be substituted for a requested stylesheet.');
check((await (await get('/mochi','navigate')).text()).includes('A moment offline.'),'Mochi room remains private and gets the standard offline screen.');
check(!publicKeys().some(url => /^\/(?:builder|dashboard|profile|mochi|api)(?:\/|$)/.test(new URL(url).pathname)),'Private routes never enter Cache Storage.');
online = true;
check((await (await get('/dashboard','navigate')).text()) === 'PRIVATE2','Private navigation still reaches the server online.');
check(await get('/api/resume/123') === null,'The worker never handles API fetches.');
check(await get('/uploads/photo.png') === null,'Uploads are excluded.');
check(await event('fetch',{request:request('/','cors','POST')}) === null,'POST requests are excluded.');
check(await event('fetch',{request:{url:'https://other.test/css/main.css',mode:'cors',method:'GET'}}) === null,'Third-party responses are excluded.');
await get('/demo/templates/modern?v=sample');
check(publicKeys().some(url => url.includes('/demo/templates/modern')),'Only the explicit public sample routes can be cached.');
const beforeThumbnail = fetches;
await get('/img/templates/modern-320.webp');
await get('/img/templates/modern-320.webp');
check(fetches === beforeThumbnail + 1,'Responsive public previews can be reused without another download.');
await get('/img/templates/modern-1280.webp');
check(publicKeys().some(url => url.includes('/img/templates/modern-1280.webp')),'High-resolution public previews must be available offline.');
check(await get('/img/templates/private-320.webp') === null,'Unrecognised images do not enter the public cache.');
await get('/samples/modern.pdf');
online = false;
check((await (await get('/samples/modern.pdf','navigate')).text()).startsWith('PUBLIC'),'A viewed public sample PDF can also open offline through navigation.');
online = true;
check(await get('/samples/private-resume.pdf') === null,'Only named fictional sample PDFs are eligible for public caching.');
await cacheStorage.open('unrelated-app');
await policy(false);
check(publicBuckets().length === 0,'Revocation purges all ReGen public cache versions.');
check((await cacheStorage.keys()).includes('unrelated-app'),'Revocation leaves unrelated cache data alone.');
online = false;
check((await (await get('/','navigate')).text()).includes('A moment offline.'),'An essential-only visit has a working inline offline fallback.');
online = true;
const expired = await policy(true,Date.now()-1);
check(expired?.enabled === false && publicKeys().length === 0,'Expired consent cannot enable storage.');
await policy(true);
for (let i=0;i<130;i++) await get('/css/main.css?v='+i);
check(publicKeys().length <= 120,'The public cache has a bounded size.');
check(publicKeys().some(url => new URL(url).pathname === '/'),'Cache trimming preserves the landing fallback.');
await policy(false);

landingMarkup = '<link rel="stylesheet" href="/css/site.css?v=0123456789ab"><script src="/js/interface.js?v=9876543210ab"></script><img id="hero-document-image" src="/img/templates/classic-320.webp">';
await policy(true);
online = false;
check((await get('/css/site.css?v=0123456789ab')).ok,'First consent warms the exact landing stylesheet revision.');
check((await get('/js/interface.js?v=9876543210ab')).ok,'First consent warms the exact critical script revision.');
check((await get('/img/templates/classic-320.webp')).ok,'First consent warms the published hero sample.');
online = true;
await policy(false);
landingMarkup = '';

// Changing a choice while warm-up requests are in flight must honor the final choice.
let releaseFetch;
fetchGate = new Promise(resolve => { releaseFetch = resolve; });
const firstFetch = new Promise(resolve => { notifyFetch = resolve; });
const firstChoice = policy(true);
await firstFetch;
await policy(false);
const latestChoice = policy(true);
await new Promise(resolve => setImmediate(resolve));
fetchGate = null;
notifyFetch = null;
releaseFetch();
await Promise.all([firstChoice,latestChoice]);
check(publicKeys().some(url => new URL(url).pathname === '/'),'A rapid accept/reject/accept sequence still warms the final accepted choice.');
await policy(false);

const manifest = JSON.parse(await fs.readFile(new URL('public/manifest.webmanifest',root),'utf8'));
check(Boolean(manifest.name && manifest.short_name && manifest.id && manifest.start_url && manifest.scope),'Manifest identity and start route exist.');
check(manifest.display === 'standalone','Installed launch uses standalone display.');
check(manifest.icons.some(icon => icon.sizes === '192x192') && manifest.icons.some(icon => icon.sizes === '512x512' && icon.purpose === 'maskable'),'Install icons include 192, 512 and a maskable asset.');
for (const icon of manifest.icons) await fs.access(new URL('public'+icon.src,root));
check(manifest.screenshots?.some(item => item.form_factor === 'wide') && manifest.screenshots?.some(item => item.form_factor === 'narrow'),'Enhanced installation has desktop and mobile previews.');
for (const item of manifest.screenshots || []) await fs.access(new URL('public'+item.src,root));
console.log(`PWA cache privacy, offline responses and manifest checks passed (${assertions} assertions; no network requests).`);
