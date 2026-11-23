import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir, mkdtemp, readFile, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

const [base, output, mode, resumeId] = process.argv.slice(2);
if (!base || !output || new URL(base).hostname !== '127.0.0.1') throw new Error('Use the disposable PHP fixture.');
const chrome = process.env.KERJAYA_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const profile = await mkdtemp(path.join(tmpdir(), 'kerjayaku-world-'));
await mkdir(output, {recursive:true});
const browser = spawn(chrome, ['--headless=new','--disable-gpu','--disable-extensions','--disable-background-networking',
  '--disable-component-update','--no-first-run','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],
{windowsHide:true,stdio:'ignore'});
browser.on('error', error => { console.error(error.message); });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const pending = new Map();
const report = {checks:[], viewports:[], errors:[], requests:[], vitals:[]};
let socket;
let serial = 0;

function send(method, params={}) {
  return new Promise((resolve,reject) => {
    const id = ++serial;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('Chrome timed out at '+method)); }, 10000);
    pending.set(id,{resolve,reject,timer});
    socket.send(JSON.stringify({id,method,params}));
  });
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}
async function until(expression, label) {
  for (let index=0; index<140; index++) {
    try { if (await evaluate(expression)) return; } catch {}
    await sleep(90);
  }
  throw new Error('Timed out: '+label);
}
function check(value, label) {
  assert.ok(value,label);
  report.checks.push(label);
}
async function size(width,height=900) {
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});
  await send('Emulation.setTouchEmulationEnabled',{enabled:width<600});
  await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))');
}
async function navigate(route, selector) {
  await send('Page.navigate',{url:base+route});
  const requested = new URL(route,base);
  const locale = requested.searchParams.get('lang');
  await until('location.pathname==='+JSON.stringify(requested.pathname)+' && document.readyState==="complete" && !!document.querySelector('+JSON.stringify(selector)+')'+(locale ? ' && document.documentElement.lang==='+JSON.stringify(locale) : ''),route);
  await evaluate('document.fonts.ready.then(()=>true)');
}
async function click(selector) {
  await until('!!document.querySelector('+JSON.stringify(selector)+')?.getClientRects().length',selector);
  await evaluate('document.querySelector('+JSON.stringify(selector)+').click()');
}
async function theme(next) {
  if (await evaluate('document.documentElement.dataset.theme') === next) return;
  await click('.appearance-toggle');
  await click('[data-appearance-choice='+next+']');
  await until('document.documentElement.dataset.theme==='+JSON.stringify(next), next+' theme');
}
async function shot(name) {
  const result=await send('Page.captureScreenshot',{format:'png'});
  await writeFile(path.join(output,name+'.png'),Buffer.from(result.data,'base64'));
}
async function noOverflow(route,width,language,appearance) {
  const measure=await evaluate('(()=>{const width=document.documentElement.clientWidth;return {width,scroll:document.documentElement.scrollWidth,body:document.body.scrollWidth,offenders:[...document.querySelectorAll("body *")].filter(e=>!e.closest("#tool-rail") && e.getBoundingClientRect().right>width+.8).slice(0,15).map(e=>[e.id||e.className?.baseVal||e.className||e.dataset.device||e.textContent.slice(0,25)||e.tagName,Math.round(e.getBoundingClientRect().right)])}})()');
  assert.ok(Math.max(measure.scroll,measure.body)<=measure.width+1,JSON.stringify({route,width,language,appearance,measure}));
  report.viewports.push({route,width,language,appearance,...measure});
}
async function field(id,value) {
  await evaluate(`(()=>{const field=document.getElementById(${JSON.stringify(id)});field.value=${JSON.stringify(value)};field.dispatchEvent(new Event('input',{bubbles:true}));field.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`);
}
function receive(event) {
  const message=JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const call=pending.get(message.id);pending.delete(message.id);clearTimeout(call.timer);
    if (message.error) call.reject(new Error(message.error.message)); else call.resolve(message.result);
  }
  if (message.method==='Runtime.exceptionThrown') report.errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
  if (message.method==='Network.requestWillBeSent' && message.params.request.url.startsWith(base+'/')) {
    const request=message.params.request;
    if (new URL(request.url).pathname.startsWith('/api/')) report.requests.push([request.method,new URL(request.url).pathname]);
  }
}

try {
  let port;
  for (let attempt=0; attempt<140; attempt++) {
    try { port=(await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split(/\r?\n/)[0];break; } catch { await sleep(100); }
  }
  if (!port) throw new Error('Chrome did not start.');
  const tabs=await fetch('http://127.0.0.1:'+port+'/json/list').then(response=>response.json());
  socket=new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  socket.addEventListener('message',receive);
  for (const domain of ['Page','Runtime','Network']) await send(domain+'.enable');
  await send('Network.setBlockedURLs',{urls:['https://*','wss://*']});
  await send('Page.addScriptToEvaluateOnNewDocument',{source:`window.worldVitals={lcp:0,cls:0};new PerformanceObserver(list=>{worldVitals.lcp=list.getEntries().at(-1)?.startTime||0}).observe({type:'largest-contentful-paint',buffered:true});new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)worldVitals.cls+=e.value}).observe({type:'layout-shift',buffered:true});`});

  if (mode === 'baseline') {
    for (const [width, height, device] of [[1440,900,'desktop'],[390,844,'mobile']]) {
      await size(width,height);
      for (const [route, selector, name] of [['/','.landing-page','landing'],['/login','#login-form','login'],['/register','#register-form','register']]) {
        await navigate(route+'?lang=en',selector);
        await evaluate('document.querySelector("[data-reject-privacy]")?.click()');
        await sleep(200);
        const previous = 'before-'+name+'-'+device;
        if (!await readFile(path.join(output,previous+'.png')).catch(()=>null)) await shot(previous);
      }
    }
    await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'light'}]});
    await size(1440,900);
    await navigate('/login?lang=en','#login-form');
    await field('email','amina@qa.regen.local');
    await field('password','New-Password-567890');
    await click('#login-btn');
    await until('location.pathname==="/dashboard"','isolated sign in');
    await theme('light');
    await until('document.querySelector(".overview-template img")?.naturalWidth > 0','painted workspace');
    await size(1200,760);
    await shot('source-workspace-en');
    await navigate('/dashboard?lang=ms','.overview-resume');
    await theme('light');
    await until('document.querySelector(".overview-template img")?.naturalWidth > 0','painted Malay workspace');
    await shot('source-workspace-ms');
    await navigate('/cover-letters','#letter-company');
    await until('!document.querySelector("#letter-workspace").hidden','letter workspace');
    await field('letter-company','Syarikat Contoh');
    await field('letter-role','Operations Coordinator');
    await field('letter-body','I am applying for the Operations Coordinator role. In my previous role, I kept inventory records up to date and supported the operations team.');
    await click('#save-letter');
    await until('location.search.includes("id=") && !document.querySelector("#download-letter").disabled','synthetic cover letter');
    const letterRoute = await evaluate('location.pathname + location.search');
    for (const [lang, locale] of [['en','en'],['ms','ms']]) {
      for (const [width, height, device] of [[1200,780,'desktop'],[390,752,'mobile']]) {
        await size(width,height);
        await navigate('/builder?id='+resumeId+'&section='+'personal'+'&lang='+lang,'#studio-save');
        await until('document.querySelector("#p-fullname")?.value?.length > 3','synthetic resume ready');
        if (device === 'desktop') {
          await until('document.querySelector("#studio-preview-sample img")?.naturalWidth > 0','rendered preview thumbnail');
        }
        await shot('source-resume-'+device+'-'+locale);
        await navigate(letterRoute+'&lang='+lang,'#letter-company');
        await until('document.querySelector("#letter-company").value==="Syarikat Contoh"','saved letter loaded');
        await shot('source-letter-'+device+'-'+locale);
      }
    }
  }
  if (mode === 'final') {
    await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'light'}]});
    const viewports = [320,360,390,430,768,1024,1280,1440];
    const routes = [['/','.product-landing','landing'],['/login','#login-form','login'],['/register','#register-form','register']];
    const go = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'start',behavior:'instant'})`);
    const settled = () => sleep(640);
    for (const width of viewports) {
      await size(width,width <= 430 ? 844 : 940);
      for (const lang of ['en','ms']) {
        for (const [route, selector, name] of routes) {
          await navigate(route+'?lang='+lang,selector);
          await evaluate('document.querySelector("[data-reject-privacy]")?.click()');
          if (route === '/') {
            await until('document.querySelector(".hero-phone img").naturalWidth>0','hero screenshot decoded');
          }
          await theme('light');
          await noOverflow(route,width,lang,'light');
          check(await evaluate('!!document.querySelector("meta[name=viewport]") && !!document.querySelector(".appearance-toggle") && !document.body.innerText.includes("{{")'),name+' locale '+lang+' at '+width);
          if (width === 1440 || width === 390) {
            const device = width === 390 ? 'mobile' : 'desktop';
            await settled();
            await shot(name+'-'+device+'-'+lang+'-light');
            if (lang === 'en') {
              await theme('dark');
              await noOverflow(route,width,lang,'dark');
              await shot(name+'-'+device+'-'+lang+'-dark');
              await theme('light');
            }
          }
        }
      }
    }

    await size(1440,940);
    await send('Network.clearBrowserCache');
    await navigate('/?lang=en','.product-landing');
    await settled();
    report.vitals.push({scenario:'desktop loopback',...await evaluate('({...worldVitals,assets:performance.getEntriesByType("resource").filter(x=>x.name.includes("/img/marketing/")).map(x=>({path:new URL(x.name).pathname,encoded:x.encodedBodySize}))})')});
    const publicStart = report.requests.length;
    await click('.product-hero a[href="#showcase"]');
    await until('location.hash==="#showcase"','secondary CTA');
    await go('#showcase');
    await sleep(600);
    await shot('writing-mochi');
    await evaluate('document.querySelector("#tab-mochi").focus()');
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
    await until('document.activeElement.id==="tab-assist" && !document.querySelector("#demo-assist").hidden','keyboard Assist tab');
    await click('#demo-assist [data-replay]');
    await until('document.querySelector("#demo-assist").getAnimations({subtree:true}).length>0','Assist replay');
    await sleep(1400);
    await shot('writing-assist');
    await click('#tab-refine');
    await sleep(880);
    await shot('writing-refine');
    check(await evaluate('document.querySelector("#tab-refine").getAttribute("aria-selected")==="true" && document.querySelector("#demo-assist").hidden'),'Writing tabs switch and retain keyboard focus');

    for (const [id, label] of [['studio','resume'],['letters','letter']]) {
      for (const device of ['desktop','mobile']) {
        await click('#'+id+' [data-device='+device+']');
        await go('#'+id);
        await until('document.querySelector("#'+id+'-'+device+' img").naturalWidth>0','decoded marketing '+label+' '+device);
        await settled();
        await shot('preview-'+label+'-'+device);
      }
    }
    await go('#career-tools');
    await shot('tools-desktop');
    await click('[data-tool-next]');
    await until('document.querySelector("#tool-rail").scrollLeft>50','carousel next');
    await click('[data-tool-prev]');
    await until('document.querySelector("#tool-rail").scrollLeft<5','carousel previous');
    await go('#premium');
    await shot('packages-invitation');
    check(await evaluate('document.querySelector("#premium a").pathname==="/pricing" && document.querySelector("#resume-designs").pathname==="/resume-templates"'),'Package and template destinations');
    await go('#faq-title');
    await click('#faq-title summary');
    check(await evaluate('document.querySelector("#faq-title details").open'),'FAQ accordion');
    await shot('faq');
    check(report.requests.slice(publicStart).every(([method]) => method === 'GET'),'Public interactions send zero API mutations');

    await size(390,844);
    await send('Network.clearBrowserCache');
    await navigate('/?lang=ms','.product-landing');
    await until('document.querySelector(".hero-phone img").naturalWidth>0','mobile product visual');
    await settled();
    report.vitals.push({scenario:'mobile loopback',...await evaluate('({...worldVitals,assets:performance.getEntriesByType("resource").filter(x=>x.name.includes("/img/marketing/")).map(x=>({path:new URL(x.name).pathname,encoded:x.encodedBodySize}))})')});
    await go('#career-tools');
    const touch = await evaluate('(()=>{const r=document.querySelector("#tool-rail").getBoundingClientRect();return {x:r.x+r.width-55,y:Math.min(innerHeight-100,r.y+120)}})()');
    await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch]});
    for (let dx=30;dx<=210;dx+=30) {
      await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:touch.x-dx,y:touch.y}]});
      await sleep(24);
    }
    await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await until('document.querySelector("#tool-rail").scrollLeft>30','native mobile swipe');
    await shot('tools-mobile');
    await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    await go('#showcase');
    await click('#tab-assist');
    check(await evaluate('!document.querySelector("#demo-assist").getAnimations({subtree:true}).length && document.querySelector("#demo-assist [data-replay]").hidden'),'Reduced motion renders complete static demo');
    await click('[data-language-switch]');
    await until('document.documentElement.lang==="en"','language link');
    await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'light'}]});
    await click('.product-hero a[href="/register"]');
    await until('location.pathname==="/register"','registration CTA');
    await send('Page.navigate',{url:base+'/packages?lang=en'});
    await until('location.pathname==="/pricing" && !!document.querySelector("#landing-pricing")','legacy Packages redirect');
    await navigate('/resume-templates?lang=en','.public-catalogue');

    await navigate('/login?lang=en','#login-form');
    await field('email','amina@qa.regen.local');
    await field('password','Wrong-Fixture-Password');
    await click('.auth-password-toggle');
    check(await evaluate('document.querySelector("#password").type==="text" && document.querySelector(".auth-password-toggle").getAttribute("aria-label")==="Hide password"'),'Password toggle has an accessible state');
    await click('.auth-password-toggle');
    await click('#login-btn');
    await until('document.querySelector("#login-error").classList.contains("visible") && document.querySelector("#login-error").textContent.includes("Check your details")','invalid credentials feedback');
    await shot('login-invalid');
    await navigate('/login?lang=ms&expired=1','#login-form');
    check(await evaluate('document.querySelector("#login-error").textContent.includes("Sesi anda")'),'Malay expiry notice');
    await field('email','amina@qa.regen.local');
    await field('password','New-Password-567890');
    await evaluate('document.querySelector("#password").focus()');
    await size(390,520);
    await until('document.activeElement.id==="password" && document.querySelector("#password").getBoundingClientRect().bottom<=innerHeight','keyboard-sized focused password field');
    await size(390,844);
    await send('Network.setBlockedURLs',{urls:['https://*','wss://*',base+'/api/auth/login']});
    await click('#login-btn');
    await until('document.querySelector("#login-error").textContent.includes("Sambungan terputus")','localized connection error');
    await send('Network.setBlockedURLs',{urls:['https://*','wss://*']});
    await click('#remember-me');
    await click('#login-btn');
    await until('location.pathname==="/dashboard"','remembered sign in');
    const cookies = await send('Network.getCookies',{urls:[base]});
    check(cookies.cookies.some(cookie=>cookie.httpOnly && cookie.expires>0),'Remember me sets a persistent HttpOnly cookie');
    await send('Network.clearBrowserCookies');
    await send('Storage.clearDataForOrigin',{origin:base,storageTypes:'local_storage'});
    await navigate('/register?lang=ms','#register-form');
    await field('firstName','Alya'); await field('lastName','Rahman');
    await field('email','product-signup@qa.regen.local');
    await field('registerState','Wilayah Persekutuan Kuala Lumpur');
    await field('registerPostcode','50000');
    await field('password','Career-Qa-Password-784391');
    await field('confirmPassword','Mismatch-fixture-only');
    await click('#register-btn');
    await until('document.querySelector("#register-error").classList.contains("visible")','pre-submit password mismatch');
    await field('confirmPassword','Career-Qa-Password-784391');
    await click('#register-btn');
    await until('location.pathname==="/verify-email" && location.search.includes("pending")','registration entered email verification');
    await until('document.querySelector("#verification-title")?.textContent.includes("Semak e-mel")','localized verification pending');
    await settled();
    await shot('register-verification');
    await navigate('/login?lang=en','#login-form');
    await field('email','product-signup@qa.regen.local');
    await field('password','Career-Qa-Password-784391');
    await click('#login-btn');
    await until('location.pathname==="/verify-email"','unverified candidate returned to verification');
    await navigate('/login?lang=en','#login-form');
    await field('email','rate-limit@qa.regen.local');
    await field('password','Invalid-local-fixture');
    for (let count=0; count<9; count++) {
      await click('#login-btn');
      await until('!document.querySelector("#login-btn").disabled && document.querySelector("#login-error").classList.contains("visible")','synthetic login attempt '+count);
    }
    check(await evaluate('document.querySelector("#login-error").textContent.includes("Too many attempts")'),'Existing local rate limit is surfaced in the form');

    await navigate('/?lang=en','.product-landing');
    const manifest = await send('Page.getAppManifest');
    check(manifest.url.endsWith('/manifest.webmanifest') && !manifest.errors.some(issue=>issue.critical),'Chrome accepts the published PWA manifest');
    await evaluate('window.ReGenPrivacy.open()');
    await click('.privacy-dialog [name=offline]');
    await click('.privacy-dialog [data-save-privacy]');
    await until(`(async()=>{const key=(await caches.keys()).find(name=>name.startsWith('regen-public-'));if(!key)return false;const cache=await caches.open(key);const paths=(await cache.keys()).map(item=>new URL(item.url).pathname);return paths.includes('/img/marketing/studios/workspace-en.webp') && paths.includes('/img/marketing/studios/letter-mobile-en.webp') && !paths.some(path=>/^\\/(builder|api|dashboard|cover-letters|login)(\\/|$)/.test(path));})()`,'opt-in public worker cache and protected-route exclusion');
    check(true,'Opt-in caches the hero assets and excludes private paths in Chrome');
    check(report.errors.length===0, JSON.stringify(report.errors));
  }
  await writeFile(path.join(output,'browser-'+mode+'.json'),JSON.stringify(report,null,2));
} finally {
  if (socket?.readyState === WebSocket.OPEN) await send('Browser.close').catch(()=>{});
  if (browser.exitCode === null) browser.kill();
}
