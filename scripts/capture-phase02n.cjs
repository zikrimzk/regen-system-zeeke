const {spawn} = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const [upstream, output, resumeId] = process.argv.slice(2);
const base=upstream;
if (new URL(base).hostname !== '127.0.0.1') throw new Error('Use a synthetic loopback fixture.');
const qaWork = process.env.REGEN_QA_WORK || require('node:os').tmpdir();
const profile = fs.mkdtempSync(path.join(qaWork, 'chrome-phase02n-'));
fs.mkdirSync(output, {recursive:true});
const report = path.join(output, 'browser-results.txt');
fs.writeFileSync(report,'');
const log = (...items) => fs.appendFileSync(report, items.join(' ') + '\n');

const chrome = spawn(process.env.KERJAYAKU_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--disable-gpu', '--disable-background-networking', '--disable-component-update',
  '--disable-default-apps', '--disable-extensions', '--disable-sync', '--no-first-run',
  '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1', '--user-data-dir='+profile, 'about:blank',
], {windowsHide:true,stdio:'ignore'});
const sleep = ms => new Promise(resolve=>setTimeout(resolve,ms));
let assertionCount = 0, commandId = 0;
const requests = new Map(), errors = [], failed = [];
const apiTraffic = new Map();
let traceReady;
let socket;
function assert(pass, explanation) {if(!pass) throw new Error(explanation); assertionCount++;}
function send(method,params={}) {
  const id=++commandId;
  return new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>{requests.delete(id);reject(new Error('Chrome timed out: '+method))},10000);
    requests.set(id,{resolve,reject,timeout});
    socket.send(JSON.stringify({id,method,params}));
  });
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}
async function wait(expression, description=expression, retries=360) {
  for(let i=0;i<retries;i++) {
    try { if(await evaluate(expression)) return; } catch {}
  await sleep(100);
  }
  throw new Error('Waiting for '+description);
}
async function size(width,height=900) {
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});
  await send('Emulation.setTouchEmulationEnabled',{enabled:width<600});
}
async function page(route,ready='document.readyState==="complete"') {
  lastRoute=route;
  log('Testing',route);
  const navigation = await send('Page.navigate',{url:base+route});
  if (navigation.errorText) { await sleep(400); await send('Page.navigate',{url:base+route}); }
  await wait('document.readyState !== "loading" && location.origin==='+JSON.stringify(base)+' && (' + ready + ')',route+' ready');
}
async function save(name) {
  await evaluate("document.fonts.ready.then(()=>true)");
  const shot = await send('Page.captureScreenshot',{format:'png'});
  fs.writeFileSync(path.join(output,name+'.png'),Buffer.from(shot.data,'base64'));
}
async function click(selector) {
  await wait('Boolean(document.querySelector('+JSON.stringify(selector)+')?.getClientRects().length)',selector);
  await evaluate('document.querySelector('+JSON.stringify(selector)+').click()');
}
async function submit(selector, emailId, pwId, email, password) {
  await evaluate('(()=>{document.getElementById('+JSON.stringify(emailId)+').value='+JSON.stringify(email)
    +';document.getElementById('+JSON.stringify(pwId)+').value='+JSON.stringify(password)
    +';document.querySelector('+JSON.stringify(selector)+').requestSubmit(); return true})()');
}
async function noOverflow(label) {
  const values=await evaluate('({viewport:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,body:document.body.scrollWidth, offenders:[...document.body.querySelectorAll("*")].filter(e=>e.getBoundingClientRect().right>document.documentElement.clientWidth+1).slice(0,8).map(e=>e.tagName+"."+e.getAttribute("class"))})');
  assert(values.viewport + 1 >= Math.max(values.scroll,values.body),label+' overflows '+JSON.stringify(values));
}
let lastRoute='';

const t = s => JSON.stringify(s);
async function enter(route, user) {
  await send('Network.clearBrowserCookies');
  await page(route, '!!document.querySelector("#login-form") && !!window.ReGenText');
  const other = user === 'other';
  await submit('#login-form','email','password',other?'other@qa.regen.local':'amina@qa.regen.local',other?'Qa-Other-567890':'New-Password-567890');
  await wait('location.pathname==="/dashboard" && document.querySelector("#resume-home")?.getAttribute("aria-busy")==="false"');
}
async function setField(selector, value) {
  await wait('Boolean(document.querySelector('+t(selector)+'))');
  await evaluate('(()=>{const field=document.querySelector('+t(selector)+');field.value='+t(value)+';field.dispatchEvent(new Event("input",{bubbles:true}));field.dispatchEvent(new Event("change",{bubbles:true}));return true;})()');
}
async function perform() {
  const portFile=path.join(profile,'DevToolsActivePort');
  for(let i=0;i<180&&!fs.existsSync(portFile);i++) await sleep(100);
  const port=fs.readFileSync(portFile,'utf8').split(/\r?\n/)[0];
  log('Server preflight', (await fetch(base+'/api/health')).status, 'Phase 02N');
  const targets=await fetch('http://127.0.0.1:'+port+'/json/list').then(r=>r.json());
  socket=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  socket.addEventListener('message',event=>{
  const msg=JSON.parse(event.data);
    if(msg.id && requests.has(msg.id)) {
      const pending=requests.get(msg.id);requests.delete(msg.id);clearTimeout(pending.timeout);
      if(msg.error) pending.reject(new Error(msg.error.message));else pending.resolve(msg.result);
    }
    if(msg.method==='Page.javascriptDialogOpening') { log('Browser dialog',msg.params.type); void send('Page.handleJavaScriptDialog',{accept:msg.params.type==='beforeunload'}); }
    if(msg.method==='Tracing.tracingComplete') traceReady?.(msg.params.stream);
    if(msg.method==='Runtime.exceptionThrown') errors.push(lastRoute+': '+(msg.params.exceptionDetails.exception?.description||msg.params.exceptionDetails.text));
    if(msg.method==='Runtime.consoleAPICalled' && msg.params.type==='error') errors.push(lastRoute+': '+msg.params.args.map(a=>a.description||a.value).join(' '));
    if(msg.method==='Network.responseReceived' && msg.params.response.status>=400) failed.push(lastRoute+': '+msg.params.response.status+' '+msg.params.response.url.replace(base,''));
    if(msg.method==='Network.requestWillBeSent' && msg.params.request.url.startsWith(base+'/api/')) {
      const request=msg.params.request;
      const kind=request.method+' '+new URL(request.url).pathname;
      apiTraffic.set(kind,(apiTraffic.get(kind)||0)+1);
    }
  });
  for(const name of ['Page','Runtime','Network']) await send(name+'.enable');
  await send('Network.setBlockedURLs',{urls:['https://*','wss://*']});
  await send('Page.addScriptToEvaluateOnNewDocument',{source:
    'window.regenVitals={lcp:0,cls:0};try{new PerformanceObserver(list=>{regenVitals.lcp=list.getEntries().at(-1)?.startTime||0}).observe({type:"largest-contentful-paint",buffered:true});new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)regenVitals.cls+=e.value}).observe({type:"layout-shift",buffered:true})}catch{}'});
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'light'},{name:'prefers-reduced-motion',value:'reduce'}]});

  await size(390,844); await enter('/login?lang=en','candidate');
  await save('overview-returning-mobile');
  await save('navigation-bottom-mobile');
  await click('.mobile-product-nav [data-workspace-more]');
  await wait('document.querySelector("#workspace-more").open'); await save('navigation-more-mobile');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await wait('!document.querySelector("#workspace-more").open && document.activeElement.matches("[data-workspace-more]")');
    assert(await evaluate('document.querySelector(".mobile-product-nav a[href=\'/builder\']").getClientRects().length > 0'),'Resume bottom link is visible');
  await click('.mobile-product-nav a[href="/builder"]');
  await wait('location.pathname==="/builder" && !!document.querySelector("#step-content h2")');
  await page('/builder?id='+resumeId+'&section=personal','!!document.querySelector("#p-fullname")');
  assert(await evaluate('!document.querySelector(".workspace-sidebar,.mobile-product-nav") && document.querySelector(".studio-exit").pathname === "/dashboard"'),'Resume Studio has independent navigation');
  await save('resume-editor-mobile');
  await click('#studio-preview-mode');
  await wait('document.querySelector("#preview-pdf-pages").dataset.pageCount && document.querySelector("#preview-pdf-pages").getAttribute("aria-busy")==="false"');
  await save('resume-preview-mobile');
  await click('#studio-write-mode');
  await click('#studio-sections-open'); await click('[data-editor-action="resume-layout-settings"]');
  await wait('!!document.querySelector(".appearance-inspector[open]")'); await save('resume-appearance-mobile');
  await click('.appearance-inspector button[aria-label="Close settings"]');
  await size(1440,900);
  await wait('!!document.querySelector("#studio-pdf-pages .pdf-page canvas")');
  await save('resume-editor-desktop'); await save('resume-live-desktop');
  await send('Tracing.start',{categories:'blink.user_timing,devtools.timeline',transferMode:'ReturnAsStream'});
  const trace=new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Chrome did not finish the trace')),15000);
    traceReady=stream=>{clearTimeout(timer);resolve(stream);};
  });
  await evaluate('performance.mark("fixture-resume-before-input")');
  await evaluate('document.querySelector("#p-fullname").focus()');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA',modifiers:2,windowsVirtualKeyCode:65});
  const started=Date.now(); await send('Input.insertText',{text:'Phase N Fixture Name'});
  await wait('document.querySelector("#studio-pdf-pages .pdf-page .sr-only").textContent.includes("Phase N Fixture Name")');
  await evaluate('performance.mark("fixture-resume-working-paper")');
    log('CDP local resume update ms (wall clock)',Date.now()-started);
  assert(!apiTraffic.has('GET /api/pdf/'+resumeId+'/generate'),'Typing and working preview do not call export');
  await wait('document.querySelector("#save-indicator.is-saved")');
  await evaluate('performance.mark("fixture-resume-acknowledged")');
  await send('Tracing.end');
  const stream=await trace;
  const file=path.join(output,'resume-autosave.trace.json');
  fs.writeFileSync(file,'');
  let eof=false;
  while(!eof) {
    const chunk=await send('IO.read',{handle:stream});
    fs.appendFileSync(file,chunk.base64Encoded?Buffer.from(chunk.data,'base64'):chunk.data);
    eof=chunk.eof;
  }
  await send('IO.close',{handle:stream});
    assert(await evaluate('Api.getResume().then(r=>r.data.personal.fullName==="Phase N Fixture Name")'),'Resume persists the live edit');
  assert(await evaluate('document.querySelector("#studio-pdf-pages .pdf-page .sr-only")?.textContent.includes("Phase N Fixture Name")'), 'The resume canvas updates without using the preview command');
  await click('#studio-preview-refresh');
  await wait('document.querySelector("#preview-pdf-pages .sr-only")?.textContent.includes("Phase N Fixture Name")');
  await save('resume-pdf-desktop');
  await click('#close-preview-modal');
  await evaluate(`(() => {
    const request=window.fetch;
    window.fetch=async (input,options)=>{
      const response = await request(input,options);
      if (options?.method === "POST" && String(input).startsWith("/api/pdf/") && String(input).endsWith("/document")
        && JSON.parse(options.body).resumeData?.personal?.fullName === "Phase N Fixture Name") {
        await new Promise(resolve=>{window.releaseOldPreview=resolve;});
      }
      return response;
    };
    window.restorePreview=()=>{window.fetch=request;};
  })()`);
  await click('#preview-open-top');
  await wait('typeof window.releaseOldPreview==="function"');
  await setField('#p-fullname','Phase N Newer Preview');
  await wait('document.querySelector("#preview-pdf-pages .sr-only")?.textContent.includes("Phase N Newer Preview")');
  await evaluate('window.releaseOldPreview();window.restorePreview()');
  await sleep(180);
  assert(await evaluate('document.querySelector("#preview-pdf-pages .sr-only").textContent.includes("Phase N Newer Preview")'),'A deliberately late older PDF cannot replace the new preview');
  await click('#close-preview-modal');
  // A real paid export follows the save of a still-edited section.
  const walletBefore=await evaluate('Api.getFeaturePrices().then(r=>r.wallet.available)');
  await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:profile});
  await setField('#p-postcode','75000');
  await setField('#p-fullname','Phase N Export Revision');
  await click('#studio-review');
  await wait('!!document.querySelector("#btn-download-pdf")');
  assert(await evaluate('Api.getResume().then(r=>r.data.personal.fullName==="Phase N Export Revision")'),'Review & export saves the latest resume revision');
  await evaluate('window.exportFinished=false; window.addEventListener("regen:resume-downloaded",()=>window.exportFinished=true,{once:true})');
  await click('#btn-download-pdf');
  await wait('!!document.querySelector(".token-dialog[open] [data-spend]:not([disabled])")');
  await click('.token-dialog[open] [data-spend]');
  await wait('window.exportFinished');
  assert(await evaluate('Api.getFeaturePrices().then(r=>r.wallet.available)') === walletBefore-2,'One resume export debits two synthetic wallet tokens');
  await page('/builder?id='+resumeId+'&section=personal','!!document.querySelector("#p-fullname")');
  await wait('ReGenTokens.getPrice("resume_rename")?.cost===1');
  assert(await evaluate('!document.querySelector("#resume-rename .token-action-status")'),'Rename toolbar has a single pencil and no allowance badge');
  await click('#resume-rename');
  assert(await evaluate('document.querySelector(".studio-rename-allowance").textContent.includes("1 Coin")'),'Rename discloses its price inside the dialog');
  await setField('#resume-title-input','Fixture application resume');
  await click('#resume-rename-dialog button[type="submit"]');
  await click('.token-dialog[open] [data-spend]');
  await wait('document.querySelector("#studio-document-title").textContent==="Fixture application resume"');
  assert(await evaluate('Api.getResume().then(r=>r.title==="Fixture application resume")'),'Renamed title survives the round trip');
  await click('#resume-layout-settings');
  await wait('!!document.querySelector(".appearance-inspector[open] #settings-pdf-pages canvas")'); await save('resume-appearance-desktop');
  await evaluate('document.querySelector("#document-size").value="12";document.querySelector("#document-size").dispatchEvent(new Event("change",{bubbles:true}))');
  await click('#save-document-settings');
  await wait('!document.querySelector(".appearance-inspector[open]")');
  assert(await evaluate('Api.getResume().then(r=>Number(r.data.appearance.size)===12)'),'Supported typography saves through the existing resume settings endpoint');
  await wait('!!document.querySelector(".mochi-float-chat img")?.getClientRects().length');
  await click('.mochi-float-chat'); await wait('!document.querySelector("#mochi-panel").hidden'); await save('resume-mochi-desktop');
  await click('[data-mochi-close]');
  await page('/cover-letters?new=1','document.querySelector("#letter-workspace")?.hidden===false');
  await setField('#letter-company','Syarikat Contoh'); await setField('#letter-role','Operations Adviser');
  await setField('#letter-body','I coordinated a documented project using synthetic data.');
  await wait('document.querySelector("#letter-working-paper").textContent.includes("synthetic data")');
    assert(await evaluate('!new URL(location.href).searchParams.has("id")'),'New draft does not create a record during typing');
  await click('#save-letter'); await wait('!!new URL(location.href).searchParams.get("id")');
  const letterId=await evaluate('new URL(location.href).searchParams.get("id")');
  await save('letter-writing-desktop');
  await setField('#letter-body','I improved fixture reporting and handovers.');
  await wait('document.querySelector("#letter-working-paper").textContent.includes("fixture reporting")');
  await wait('document.querySelector("#letter-save-state").textContent === "All changes saved"');
    assert(await evaluate('Api.getCoverLetter('+letterId+').then(r=>r.data.body.includes("fixture reporting"))'),'Letter autosaves an existing record');
  await send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:-1,uploadThroughput:-1});
  await wait('!navigator.onLine');
  await setField('#letter-body','I preserved this letter while the fixture browser was offline.');
  await wait('document.querySelector("#letter-save-state").textContent.includes("Offline")');
  await wait('document.querySelector("#letter-working-paper .live-proof-status").textContent.includes("offline")');
  assert(await evaluate('document.querySelector("#letter-working-paper .sr-only").textContent.includes("fixture reporting")'),'The last rendered PDF stays visible during an offline edit');
  await send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
  await wait('navigator.onLine && document.querySelector("#letter-save-state").textContent==="All changes saved"');
  assert(await evaluate('Api.getCoverLetter('+letterId+').then(r=>r.data.body.includes("fixture browser was offline"))'),'Letter autosave recovers after network reconnect');
  await setField('#letter-body','I improved fixture reporting and handovers.');
  await wait('document.querySelector("#letter-save-state").textContent === "All changes saved"');
  await click('#preview-letter');
  await wait('document.querySelector("#letter-pdf-pages .sr-only")?.textContent.includes("fixture reporting")');
  await save('letter-preview-desktop'); await click('#close-letter-preview');
  // Replace only these two replies for the UI interaction. No provider is contacted.
  await evaluate(`(() => {
    const realFetch=window.fetch;
    window.fetch=(input,options)=> {
      const path=new URL(typeof input==='string'?input:input.url,location.origin).pathname;
      const quota={remaining:10,costs:{cover_letter:1}};
      if(path==='/api/ai/status')return Promise.resolve(Response.json({success:true,enabled:true,quota}));
      if(path.endsWith('/ai-suggest'))return Promise.resolve(Response.json({success:true,suggestion:'I built an internal reporting process using fixture evidence.',quota}));
      return realFetch(input,options);
    };
    window.dispatchEvent(new Event('regen:prices-updated'));
  })()`);
  await wait('!document.querySelector("#generate-letter").disabled');
  await click('#generate-letter'); await wait('!document.querySelector("#letter-suggestion").hidden');
  await evaluate('document.querySelector("#letter-suggestion").scrollIntoView({block:"center"})');
  await save('letter-ai-suggestion-desktop');
  await click('#discard-letter-suggestion');
  assert(await evaluate('document.querySelector("#letter-body").value.includes("fixture reporting")'),'Discarded suggestion preserves the body');
  await click('#generate-letter'); await wait('!document.querySelector("#letter-suggestion").hidden');
  await click('#apply-letter-suggestion');
  await click('dialog[open] [data-confirm]');
  await wait('document.querySelector("#letter-body").value.includes("internal reporting")');
  await wait('document.querySelector("#letter-save-state").textContent === "All changes saved"');
  await setField('#letter-body','I improved fixture reporting and handovers.');
  await wait('document.querySelector("#letter-save-state").textContent === "All changes saved"');
  await click('#letter-design-settings');
  await wait('!!document.querySelector(".appearance-inspector[open] #settings-pdf-pages canvas")');
  await evaluate('document.querySelector("#document-letterSignoff").value="regards";document.querySelector("#document-letterSignoff").dispatchEvent(new Event("change",{bubbles:true}))');
  await wait('document.querySelector("#settings-pdf-pages .sr-only")?.textContent.includes("Kind regards")');
  await save('letter-appearance-desktop');
  await click('#save-document-settings');
  await wait('!document.querySelector(".appearance-inspector[open]") && document.querySelector("#letter-working-paper .sr-only")?.textContent.includes("Kind regards")');
  assert(await evaluate('Api.getResume().then(r=>r.data.appearance.letterSignoff==="regards")'),'Letter settings persist and update the PDF immediately');
  await size(360,800);
  await wait('document.querySelector("#download-letter").getAttribute("aria-label")?.includes("2 Coin")');
  assert(await evaluate('!document.querySelector("#download-letter .token-action-status")'),'The phone download icon stays compact and has an accessible Coin price');
  await size(390,844); await evaluate('scrollTo(0,0)'); await save('letter-writing-mobile');
  assert(await evaluate('!document.querySelector(".workspace-sidebar,.mobile-product-nav") && !document.querySelector("#letter-library-dialog").open'),'Letter workspace opens with a focused mobile editor');
  assert(await evaluate('[...document.querySelectorAll("#letter-form [name]")].at(-1).id==="letter-body" && document.querySelector(".letter-body-field").contains(document.querySelector("#generate-letter"))'),'Letter body is the last input and contains the AI draft control');
  await click('#letter-library-toggle');
  await wait('document.querySelector("#letter-library-dialog").open && !!document.querySelector("#letter-list [data-id]")');
  await save('saved-letters-mobile');
  await click('[data-close-library]');
  await click('.mochi-float-chat');
  await wait('!document.querySelector("#mochi-panel").hidden');
  await setField('#mochi-message','What can I do on this page?');
  await evaluate('document.querySelector("[data-mochi-compose]").requestSubmit()');
  await wait('document.querySelector("#mochi-panel").textContent.includes("AI draft action beside it")');
  await click('[data-mochi-close]');
  await click('#preview-letter'); await wait('!!document.querySelector("#letter-pdf-pages canvas")');
  await save('letter-preview-mobile'); await click('#close-letter-preview');
  await click('#letter-proof-toggle');
  await wait('document.body.classList.contains("letter-proof-mode")');
  await wait('document.querySelector("#letter-working-paper .sr-only")?.textContent.includes("fixture reporting")');
  assert(await evaluate('!!document.querySelector("#letter-working-paper canvas")'),'Mobile working mode displays the actual PDF');
  await click('#letter-writing-mode');
  await wait('!document.body.classList.contains("letter-proof-mode")');
  await evaluate('document.querySelector("#letter-body").focus()');
  await wait('document.activeElement.id==="letter-body"');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:520,deviceScaleFactor:1,mobile:true});
  await wait('document.body.dataset.keyboardOpen==="true"');
  assert(await evaluate('getComputedStyle(document.querySelector(".workbench-header")).display==="none"'),'The editor toolbar leaves room for the software keyboard');
  await evaluate('document.activeElement.blur()');
  await size(390,844);
  const letterBalance=await evaluate('Api.getFeaturePrices().then(r=>r.wallet.available)');
  await setField('#letter-body','I confirmed that the latest cover letter draft exports.');
  await click('#download-letter');
  await wait('!!document.querySelector(".token-dialog[open] [data-spend]:not([disabled])")');
  await click('.token-dialog[open] [data-spend]');
  await wait('!document.querySelector("#download-letter").disabled');
  assert(await evaluate('Api.getFeaturePrices().then(r=>r.wallet.available)')===letterBalance-2,'A cover letter export debits one two-token use');
  assert(await evaluate('Api.getCoverLetter('+letterId+').then(r=>r.data.body.includes("latest cover letter"))'),'Cover letter PDF export saves the latest draft first');
  await setField('#letter-body','I improved fixture reporting and handovers.');
  await wait('document.querySelector("#letter-save-state").textContent === "All changes saved"');
  for (const width of [320,360,390,430,768,1024,1440]) {
      await size(width); await noOverflow('Letter '+width);
    }
  for (const [name,route,ready] of [['overview','/dashboard','document.querySelector("#resume-home")?.getAttribute("aria-busy")==="false"'],['resume','/builder?id='+resumeId,'!!document.querySelector("#p-fullname")']]) {
      await page(route,ready);
      for (const width of [320,360,390,430,768,1024,1440]) { await size(width); await noOverflow(name+' '+width); }
    }
  await page('/dashboard','document.querySelector("#resume-home")?.getAttribute("aria-busy")==="false"');
  await save('overview-returning-desktop'); await save('navigation-expanded-desktop');
  await page('/resumes?lang=en','location.pathname==="/dashboard" && !!document.querySelector("#open-resume-preview")');
  assert(await evaluate('!!document.querySelector("#download-resume") && !document.querySelector("#workspace-sidebar-nav a[href=\'/resumes\']")'), 'Overview contains preview and download without a duplicate resume page');
  await click('#open-resume-preview');
  await wait('!!document.querySelector("#dashboard-pdf-pages canvas")');
  await click('#dashboard-preview-close');
  assert(await evaluate('document.querySelectorAll(".overview-metric strong").length===3 && document.querySelectorAll(".overview-recent-item").length===2'), 'Overview shows progress, letter count, Coin balance and the recent documents');
  await page('/store','!!document.querySelector(".token-wallet") && !!document.querySelector("[data-view-package]")');
  assert(await evaluate('!!document.querySelector(".store-current-offer a[href^=\\\"#package-offer-\\\"]") && document.querySelector(".token-wallet h2").textContent==="Coin balance"'),'Store highlights a published discount and shows the Coin wallet');
  await click('.store-wallet-breakdown summary');
  assert(await evaluate('document.querySelector(".store-wallet-breakdown").open'),'Wallet breakdown can be expanded');
  await click('.store-wallet-breakdown summary');
  for (const width of [360,390,768,1024,1440]) { await size(width); await noOverflow('K-Store '+width); }
  await save('k-store-desktop');
  await size(360,780); await save('k-store-mobile');
  await click('.mochi-float-chat');
  await wait('!document.querySelector("#mochi-panel").hidden');
  await setField('#mochi-message','Where is payment history?');
  await evaluate('document.querySelector("[data-mochi-compose]").requestSubmit()');
  await wait('!!document.querySelector("#mochi-panel a[href=\'/store/payments\']")');
  await click('[data-mochi-close]');
  await click('[data-view-package]');
  await wait('!!document.querySelector(".k-checkout[open] .token-package-price")');
  assert(await evaluate('document.querySelector(".k-checkout").textContent.includes("Review your order") && !document.querySelector(".k-checkout").textContent.includes("HitPay")'), 'Order review shows price and provider-neutral checkout copy');
  await save('k-store-checkout-mobile');
  await click('.k-checkout .token-close');
  const checkoutFixture = await send('Page.addScriptToEvaluateOnNewDocument',{source:`
    document.addEventListener('DOMContentLoaded', () => {
      const getStore = Api.getTokenStore;
      Api.getTokenStore = async (...args) => ({...await getStore(...args), checkoutAvailable: true});
      Api.startCheckout = input => {
        window.fixtureCheckout = input;
        return Promise.resolve({success: false, status: 503});
      };
    }, {once: true});
  `});
  await page('/store?checkoutFixture=1','location.search.includes("checkoutFixture") && !!document.querySelector("[data-view-package]")');
  await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:checkoutFixture.identifier});
  await click('[data-view-package]');
  await wait('!!document.querySelector(".k-checkout [data-start-checkout]")');
  assert(await evaluate('document.querySelector(".k-checkout [data-start-checkout]").textContent === "Continue to payment"'), 'Enabled checkout has professional, provider-neutral copy');
  await click('.k-checkout [data-start-checkout]');
  await wait('window.fixtureCheckout && !document.querySelector(".k-checkout [data-start-checkout]").disabled');
  assert(await evaluate('Number.isInteger(fixtureCheckout.amountMinor) && fixtureCheckout.packageId > 0 && !!fixtureCheckout.requestKey'), 'Checkout submits the displayed package and price and recovers from a failed request');
  await click('.k-checkout .token-close');
  await page('/token-activity','location.pathname==="/store/activity" && !!document.querySelector(".token-wallet")');
  await noOverflow('Coin activity 360');
  await page('/payments','location.pathname==="/store/payments" && !document.querySelector("#payment-history-view").hidden');
  await noOverflow('Payment history 360');
  await page('/notifications','!!document.querySelector("#clear-all-notifications:not([disabled])")');
  await noOverflow('Notifications 360');
  await click('#clear-all-notifications');
  await click('.workspace-confirm-dialog [data-cancel]');
  assert(await evaluate('!!document.querySelector(".service-notification")'),'Cancel keeps inbox items');
  await click('#clear-all-notifications');
  await click('.workspace-confirm-dialog [data-confirm]');
  await wait('!!document.querySelector(".service-empty") && document.querySelector("#clear-all-notifications").disabled');
  assert(await evaluate('document.querySelector("#service-feedback").textContent==="All notifications cleared."'),'Confirmed clear shows the empty inbox and disables the action');
  await page('/settings?lang=en','location.pathname==="/profile"');
  await size(1440,900);
  await page('/dashboard','document.querySelector("#resume-home")?.getAttribute("aria-busy")==="false"');

  log('Overview paint readings', JSON.stringify(await evaluate('({vitals:regenVitals,nodes:document.getElementsByTagName("*").length})')));
  await click('[data-workspace-collapse]'); await wait('document.documentElement.hasAttribute("data-sidebar-compact")');
  await save('navigation-collapsed-desktop');
  await page('/dashboard','document.querySelector("#resume-home")?.getAttribute("aria-busy")==="false"');
    assert(await evaluate('document.documentElement.hasAttribute("data-sidebar-compact")'),'Sidebar choice survives refresh');
  await click('[data-workspace-collapse]');
  await size(844,390);
  await page('/dashboard?lang=ms','document.querySelector("#resume-home")?.getAttribute("aria-busy")==="false" && document.documentElement.lang==="ms"');
  await noOverflow('Overview Malay landscape');
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'dark'},{name:'prefers-reduced-motion',value:'reduce'}]});
  await size(390,844);
  await page('/builder?id='+resumeId+'&section=skills&lang=ms','document.documentElement.lang==="ms" && !!document.querySelector("#step-content h2") && document.querySelector("#stepper-track [aria-current=step]")?.dataset.idx==="6"');
  await noOverflow('Resume deep-link Malay dark');
  await save('resume-mobile-malay-dark');
  await page('/cover-letters?id='+letterId+'&lang=ms','document.documentElement.lang==="ms" && !!document.querySelector("#letter-body").value');
  await noOverflow('Cover Letter Studio Malay dark');
  await save('letter-mobile-malay-dark');
  await size(1440,900);
  const intercept=await send('Page.addScriptToEvaluateOnNewDocument',{source:`{
    const request=window.fetch;
    window.fixtureFailDashboard=true;
    window.fetch=(input,options)=>input==='/api/dashboard' && window.fixtureFailDashboard
      ? Promise.resolve(Response.json({success:false,message:'Fixture unavailable'},{status:503}))
      : request(input,options);
  }`});
  await page('/dashboard','!!document.querySelector("#retry-load")');
  await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:intercept.identifier});
  assert(await evaluate('document.querySelector("#resume-home").textContent.includes("Cuba lagi")'),'Overview shows the real failure state instead of a false empty state');
  await evaluate('window.fixtureFailDashboard=false');
  await click('#retry-load');
  await wait('!!document.querySelector("#resume-home .overview-recent")');
  await page('/builder.html?id='+resumeId+'&section=summary','location.pathname==="/builder" && !!document.querySelector("#step-content h2")');
  const resumeSections=['personal','summary','education','experience','projects','extracurricular','skills','achievements','certifications','additional','references'];
  for (const [index,section] of resumeSections.entries()) {
    await click('#stepper-track [data-idx="'+index+'"]');
    await wait('new URL(location.href).searchParams.get("section")==='+JSON.stringify(section));
  }
  assert(await evaluate('document.querySelector("#stepper-track [aria-current=step]").dataset.idx==="10"'),'All eleven supported sections are reachable');
  await page('/cover-letters?id='+letterId,'!document.querySelector("#letter-workspace").hidden && !!document.querySelector("#letter-body").value');
  await send('Network.clearBrowserCookies');
  await evaluate('Api.getMe().then(r=>r.status)');
  await wait('!!document.querySelector("#session-recovery[open]")');
  assert(await evaluate('document.querySelector("#letter-body").value.includes("fixture reporting")'),'Expired session retains the open letter in memory');
  await enter('/login?lang=en','other'); await save('overview-new-desktop');
  await size(390,844); await save('overview-new-mobile'); await size(1440,900);
  await click('#workspace-sidebar-nav a[href="/builder"]');
  await wait('document.querySelector("#studio-start")?.hidden===false');
    assert(await evaluate('!new URL(location.href).searchParams.has("id")'),'Empty Studio does not create a resume');
  await page('/builder?id='+resumeId,'document.querySelector("#studio-start")?.hidden===false');
    assert(await evaluate('!document.querySelector("#p-fullname")'),'Another user cannot open the owner’s resume');
  await page('/builder','document.querySelector("#studio-start")?.hidden===false');
  await click('#studio-start a[href="/templates"]');
  await wait('!!document.querySelector("#template-picker [data-design=classic]")');
  await click('#template-picker [data-design=classic] .design-card-choice');
  await click('#template-picker [data-design-action] [data-apply-design]');
  await wait('location.pathname==="/builder" && !!document.querySelector("#p-fullname")');
  assert(await evaluate('Api.getResume().then(r=>r.success && r.data.templateId==="classic")'),'Explicit template selection creates the new candidate’s resume');
  log('API request counts',JSON.stringify(Object.fromEntries(apiTraffic)));
  log('Browser assertions',assertionCount,'Page script errors',JSON.stringify(errors),'HTTP responses >=400',JSON.stringify(failed));
  assert(errors.length===0,'No browser script errors');
}
perform().catch(async error=>{
  log('FAILED',error.message,'route',lastRoute,'assertions',assertionCount);
  log('Page script errors',JSON.stringify(errors),'HTTP responses >=400',JSON.stringify(failed));
  try{await save('qa-debug')}catch{}
  process.exitCode=1;
}).finally(()=>{socket?.close();chrome.kill();});
