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
const report = {checks:[], viewports:[], errors:[], requests:[], vitals:[], motion:[], geometry:[]};
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
async function size(width,height=900,density=1) {
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:density,mobile:width<600});
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
  const measure=await evaluate('(()=>{const width=document.documentElement.clientWidth;return {width,scroll:document.documentElement.scrollWidth,body:document.body.scrollWidth,offenders:[...document.querySelectorAll("body *")].filter(e=>!e.closest(".landing-package-rail,.plan-table-wrap") && e.getBoundingClientRect().right>width+.8).slice(0,15).map(e=>[e.id||e.className?.baseVal||e.className||e.dataset.device||e.textContent.slice(0,25)||e.tagName,Math.round(e.getBoundingClientRect().right)])}})()');
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
  if (message.method==='Animation.animationStarted') {
    const {name,source} = message.params.animation;
    report.motion.push({type:'animation',name,delay:source?.delay,duration:source?.duration});
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
  for (const domain of ['Page','Runtime','Network','Animation']) await send(domain+'.enable');
  await send('Network.setBlockedURLs',{urls:['https://*','wss://*']});
  await send('Page.addScriptToEvaluateOnNewDocument',{source:`window.worldVitals={lcp:0,cls:0,interactionSamples:[]};new PerformanceObserver(list=>{for(const e of list.getEntries())if(e.interactionId)worldVitals.interactionSamples.push(e.duration)}).observe({type:'event',buffered:true,durationThreshold:16});new PerformanceObserver(list=>{worldVitals.lcp=list.getEntries().at(-1)?.startTime||0}).observe({type:'largest-contentful-paint',buffered:true});new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)worldVitals.cls+=e.value}).observe({type:'layout-shift',buffered:true});`});

  if (mode === 'baseline') {
    await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'light'}]});
    await size(390,844);
    await navigate('/?lang=en','.product-landing');
    await evaluate('document.querySelector("[data-reject-privacy]")?.click()');
    for (const appearance of ['light','dark']) {
      await theme(appearance);
      for (const [id, label] of [['ch1','hero'],['studio','resume'],['letters','letter'],['career-tools','features'],['premium','packages'],['site-publisher','footer']]) {
        await evaluate(`document.getElementById('${id}').scrollIntoView({block:'start',behavior:'instant'})`);
        await sleep(1150);
        await shot('before-'+label+'-390-'+appearance);
      }
    }
    await navigate('/login?lang=en','#login-form');
    await theme('light');
    await shot('before-login-390');
    await navigate('/register?lang=en','#register-form');
    await theme('light');
    await shot('before-register-390');
    await size(1440,940);
    await navigate('/login?lang=en','#login-form');
    await field('email','amina@qa.regen.local');
    await field('password','New-Password-567890');
    await click('#login-btn');
    await until('location.pathname==="/dashboard"','isolated candidate signed in');
    await navigate('/cover-letters','#letter-company');
    await until('!document.querySelector("#letter-workspace").hidden','letter workspace');
    await field('letter-company','Syarikat Contoh');
    await field('letter-role','Operations Coordinator');
    await field('letter-body','I am applying for the Operations Coordinator role. In my previous role I kept inventory records up to date and helped the team prepare weekly reports.');
    await click('#save-letter');
    await until('location.search.includes("id=") && !document.querySelector("#download-letter").disabled','saved synthetic cover letter');
    const letterRoute=await evaluate('location.pathname+location.search');
    for (const lang of ['en','ms']) {
      await size(390,844,2);
      await navigate('/builder?id='+resumeId+'&section=personal&lang='+lang,'#studio-save');
      await until('document.querySelector("#p-fullname")?.value?.length>3','synthetic resume ready');
      await sleep(700);
      await shot('source-resume-mobile-'+lang);
      await navigate(letterRoute+'&lang='+lang,'#letter-company');
      await until('document.querySelector("#letter-company").value==="Syarikat Contoh"','synthetic letter ready');
      await sleep(700);
      await shot('source-letter-mobile-'+lang);
    }
  }
  if (mode === 'mobile-gate') {
    await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'light'}]});
    for (const width of [390,360,320]) {
      await size(width,844,width===390?2:1);
      await navigate('/?lang=ms','.tool-grid');
      await evaluate('document.querySelector("[data-reject-privacy]")?.click()');
      await noOverflow('/',width,'ms','light');
      await until('document.querySelector(".hero-phone img")?.naturalWidth > 0','mobile hero image');
      const frame = await evaluate(`(()=>{const root=document.querySelector('.hero-phone'),img=root.querySelector('img');
        const fitted=img.getBoundingClientRect(),caseRect=root.querySelector('.device-shell').getBoundingClientRect();
        const safe=root.querySelector('.device-safe').getBoundingClientRect();
        return {width:fitted.width,height:fitted.height,caseWidth:caseRect.width,caseHeight:caseRect.height,
          ratio:img.naturalWidth/img.naturalHeight,safeAbove:safe.bottom<=fitted.top+1,src:img.currentSrc};})()`);
      const ratioDifference=Math.abs(frame.width/frame.height-frame.ratio);
      check(frame.width>=Math.min(234,width*.66) && ratioDifference<.01 && frame.safeAbove,'Screen fits without stretching or crossing the hardware area — '+JSON.stringify(frame));
      if (width===390) {
        for (const appearance of ['light','dark']) {
          await theme(appearance);
          await evaluate('window.scrollTo({top:0,behavior:"instant"})');
          await sleep(930);
          await shot('gate-hero-390-'+appearance);
          for (const [selector,label] of [['#studio .device-shell','resume'],['#letters .device-shell','letter'],['#career-tools','features'],['#landing-pricing','packages'],['#site-publisher','footer']]) {
            await evaluate(`document.querySelector('${selector}').scrollIntoView({block:'center',behavior:'instant'})`);
            if (label==='packages') await until('document.querySelectorAll("#landing-pricing .commercial-plan").length===3','landing packages load');
            if (label==='resume'||label==='letter') await until(`document.querySelector('${selector} img').naturalWidth>0`,'decoded Studio handset');
            await sleep(370);
            await shot('gate-'+label+'-390-'+appearance);
          }
        }
      }
      await navigate('/login?lang=ms','#login-form');
      await noOverflow('/login',width,'ms','light');
      await navigate('/register?lang=ms','#register-form');
      await noOverflow('/register',width,'ms','light');
    }
  }
  if (mode === 'final') {
    await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'light'}]});
    const viewports = [390,360,320,430,768,1024,1280,1440];
    const routes = [['/','.product-landing','landing'],['/pricing','.commercial-plan','packages'],['/login','#login-form','login'],['/register','#register-form','register']];
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
          if (route==='/') check(await evaluate('document.querySelectorAll(".tool-grid .tool-card").length===6'), 'Six career cards at '+width+' '+lang);
          if (lang==='en' || width===390) {
            await theme('dark');
            await noOverflow(route,width,lang,'dark');
            await theme('light');
          }
          if (width === 1440 || width === 390) {
            const device = width === 390 ? 'mobile' : 'desktop';
            if (route === '/') await sleep(1250); else await settled();
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
    report.geometry.push({width:1440,...await evaluate(`(()=>{const s=document.querySelector('.studio-product-stage');return {stageHeight:s.clientHeight,stageWidth:s.clientWidth,docHeight:document.documentElement.scrollHeight};})()`)});
    await go('#showcase');
    await click('#demo-mochi summary');
    check(await evaluate('document.querySelector("#demo-mochi details").open'),'Mochi offers a genuine next-tip interaction');
    await click('#demo-mochi summary');
    await click('.product-hero a[href="#showcase"]');
    await until('location.hash==="#showcase"','secondary CTA');
    await go('#showcase');
    await sleep(600);
    await shot('writing-mochi');
    await evaluate('document.querySelector("#tab-mochi").focus()');
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
    await until('document.activeElement.id==="tab-assist" && !document.querySelector("#demo-assist").hidden','keyboard Assist tab');
    await click('#demo-assist [data-replay]');
    report.motion.push({type:'draft-frames',frames:await evaluate(`new Promise(resolve=>{
      const samples=[];const start=performance.now();let prior=start;
      const read=(now)=>{const cue=document.querySelector('.demo-processing'),draft=document.querySelector('.demo-draft-step .demo-suggestion');
        samples.push({ms:Math.round(now-start),frame:Math.round(now-prior),cue:cue.hasAttribute('data-active')?Number(getComputedStyle(cue).opacity):0,draft:Number(getComputedStyle(draft).opacity)});
        prior=now;if(now-start<1500)requestAnimationFrame(read);else resolve(samples);};requestAnimationFrame(read);
    })`)});
    await click('#demo-assist summary');
    check(await evaluate('document.querySelector("#demo-assist details").open'),'Fictional draft review is actionable locally');
    await click('#demo-assist summary');
    await click('#demo-assist [data-replay]');
    await sleep(850);
    await shot('writing-assist-processing');
    await until('document.querySelector("#demo-assist").getAnimations({subtree:true}).length>0','Assist replay');
    await sleep(1400);
    await shot('writing-assist');
    await click('#tab-refine');
    await sleep(880);
    await click('#demo-refine summary');
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
    check(await evaluate('getComputedStyle(document.querySelector(".tool-grid")).gridTemplateColumns.split(" ").length===3'),'Three equally aligned desktop tool columns');
    await shot('tools-desktop');
    await go('#premium');
    await until('document.querySelectorAll("#landing-pricing .commercial-plan").length===3','live landing preview');
    check(await evaluate('!!document.querySelector("#premium a[href=\"/pricing\"]")'),'Landing comparison links to dedicated Packages');
    await shot('packages-desktop-preview');
    await go('#site-publisher');
    check(await evaluate('document.querySelector("#site-publisher [itemprop=identifier]").textContent.trim()==="AS0482253-X" && !!document.querySelector("#site-publisher [data-privacy-choices]")'),'Footer uses existing publisher registration and functional preferences');
    await shot('footer-desktop');
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
    report.geometry.push({width:390,...await evaluate(`(()=>{const s=document.querySelector('.studio-product-stage'),f=s.querySelector('figure:not([hidden])');return {stageHeight:s.clientHeight,stageWidth:s.clientWidth,frameWidth:f.clientWidth,docHeight:document.documentElement.scrollHeight};})()`)});
    for (const ident of ['studio','letters','faq-title']) {
      await go('#'+ident);
      await settled();
      await shot(ident+'-actual-mobile');
    }
    await go('#career-tools');
    check(await evaluate('getComputedStyle(document.querySelector(".tool-grid")).gridTemplateColumns.split(" ").length===1'),'Career tools stay in one readable mobile column');
    await shot('tools-mobile');
    await go('#site-publisher');
    await shot('footer-mobile');
    await evaluate('document.documentElement.style.fontSize="20px"');
    await noOverflow('/',390,'ms','light, 125% root text');
    await evaluate('document.documentElement.style.fontSize=""');
    await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    await go('#showcase');
    await click('#tab-assist');
    check(await evaluate('!document.querySelector("#demo-assist").getAnimations({subtree:true}).length && document.querySelector("#demo-assist [data-replay]").hidden'),'Reduced motion renders complete static demo');
    await click('[data-language-switch]');
    await until('document.documentElement.lang==="en"','language link');
    await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'light'}]});
    await click('.product-hero a[href="/register"]');
    await until('location.pathname==="/register"','registration CTA');
    await navigate('/?lang=en','[data-pricing-preview]');
    await go('#premium');
    await until('document.querySelectorAll("#landing-pricing .commercial-plan").length===3','landing preview loads');
    const prices = await evaluate(`(()=>{const list=[...document.querySelectorAll('.landing-package-rail article')];return {
       current:list.map(card=>card.querySelector('.plan-amount strong').textContent),
       paid:[ReGenCommerce.money(1200,'MYR'),ReGenCommerce.money(2900,'MYR')],
       original:list[1]?.querySelector('s')?.textContent,
       originalExpected:ReGenCommerce.money(3900,'MYR'),
       validity:list[0]?.textContent.includes('30 days'),
       hidden:document.body.innerText.includes('Hidden QA plan'),
    };})()`);
    check(prices.current.join('|')===[...prices.paid,'Free'].join('|') && prices.original===prices.originalExpected &&
      prices.validity && !prices.hidden,'Backend catalogue drives price, active promotion, validity and publication — '+JSON.stringify(prices));
    await go('.landing-package-rail');
    await settled();
    await shot('package-slide-1');
    const swipe = await evaluate('(()=>{const r=document.querySelector(".landing-package-rail").getBoundingClientRect();return {x:r.right-56,y:Math.min(innerHeight-120,r.top+226)}})()');
    await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[swipe]});
    await sleep(85);
    for (let dx=38;dx<=304;dx+=38) {
      await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:Math.max(12,swipe.x-dx),y:swipe.y}]});
      await sleep(32);
    }
    await sleep(130);
    await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await sleep(550);
    const swipeState = await evaluate(`(()=>{const rail=document.querySelector('.landing-package-rail');return {left:rail.scrollLeft,active:document.querySelector('.pricing-dot[aria-current=true]').dataset.slideIndex};})()`);
    check(swipeState.left>40 && swipeState.active==='1','Actual touch swipe to package two — '+JSON.stringify(swipeState));
    await settled();
    await shot('package-slide-2');
    await evaluate(`(()=>{const rail=document.querySelector('.landing-package-rail');rail.focus({preventScroll:true});
      window.packageKey='';rail.addEventListener('keydown',event=>window.packageKey=event.key,{once:true});})()`);
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
    await send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
    await settled();
    const keyState=await evaluate(`(()=>{const rail=document.querySelector('.landing-package-rail');
      return {left:rail.scrollLeft,max:rail.scrollWidth-rail.clientWidth,active:document.querySelector('.pricing-dot[aria-current=true]').dataset.slideIndex,focused:document.activeElement===rail,key:window.packageKey};})()`);
    check(keyState.active==='2','Keyboard advances to package three — '+JSON.stringify(keyState));
    await shot('package-slide-3');
    const stopped=await evaluate('document.querySelector(".landing-package-rail").scrollLeft');
    await sleep(900);
    check(await evaluate('document.querySelector(".landing-package-rail").scrollLeft')===stopped,'Carousel stays on the selected plan without input');
    await click('#premium .preview-all');
    await until('location.pathname==="/pricing" && !!document.querySelector(".plan-comparison")','dedicated Packages route');
    check(await evaluate('document.querySelector(".public-offer-grid .plan-action-disabled")?.textContent==="Claim has ended"'),'Expired offer cannot be selected');
    await click('.plan-comparison summary');
    check(await evaluate('document.querySelector(".plan-comparison").open && document.querySelector(".plan-comparison table").innerText.includes("5 uses")'),'Grouped comparison includes real allowances');
    await noOverflow('/pricing',390,'en','light');
    await click('.plan-comparison summary');
    await send('Network.setBlockedURLs',{urls:['https://*','wss://*',base+'/site/pricing.json*']});
    await evaluate('window.dispatchEvent(new Event("online"))');
    await until('!document.querySelector("[data-pricing-retry]").hidden','retry shown after pricing fetch failure');
    await send('Network.setBlockedURLs',{urls:['https://*','wss://*']});
    await click('[data-pricing-retry]');
    await until('!document.querySelector("#landing-pricing").hidden && !!document.querySelector(".commercial-plan")','pricing retry restores catalogue');
    const commerceStart=report.requests.length;
    await click('.commercial-plan a[href="/store"]');
    await until('location.pathname==="/login"','purchase CTA goes through sign-in');
    check(report.requests.slice(commerceStart).every(([method])=>method==='GET'),'Public package selection creates no transaction');
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
    await until('location.pathname==="/store"','remembered sign in resumes the previously selected Store destination');
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
    check(report.errors.length===0, 'No uncaught browser exception: '+JSON.stringify(report.errors));
    await size(1440,940);
    await navigate('/?lang=en','.product-landing');
    await evaluate(`Promise.all([...document.querySelectorAll('.studio-product-stage figure:not([hidden]) img')].map(img=>{img.loading='eager';return img.decode()})).then(()=>true)`);
    for (const appearance of ['light','dark']) {
      await theme(appearance);
      await sleep(1300);
      const {cssContentSize} = await send('Page.getLayoutMetrics');
      const capture = await send('Page.captureScreenshot',{format:'jpeg',quality:91,captureBeyondViewport:true,clip:{
        x:0,y:0,width:cssContentSize.width,height:cssContentSize.height,scale:1
      }});
      await writeFile(path.join(output,'landing-full-'+appearance+'.jpg'),Buffer.from(capture.data,'base64'));
    }
  }
  await writeFile(path.join(output,'browser-'+mode+'.json'),JSON.stringify(report,null,2));
} finally {
  if (socket?.readyState === WebSocket.OPEN) await send('Browser.close').catch(()=>{});
  if (browser.exitCode === null) browser.kill();
}
