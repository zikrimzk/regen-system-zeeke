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
  const timeout=setTimeout(()=>{requests.delete(id);reject(new Error('Chrome timed out: '+method))},method==='Page.navigate'?25000:10000);
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
  assert(await evaluate('document.title === "Overview | Kerjayaku." && !!document.querySelector("#overview-next-action a")'), 'Overview has a localized browser title and a real next action');
  await wait('!document.querySelector("[data-mochi-float-stage]").hidden');
  assert(await evaluate('!!document.querySelector(".workspace-header [data-mochi-visibility] img") && document.querySelectorAll(".mochi-float-chat svg circle").length===3'), 'The header controls mascot visibility and the animated pet has a three-dot chat button');
  await click('.mochi-float-chat');
  await wait('!document.querySelector("#mochi-panel").hidden');
  await click('[data-mochi-close]');
  assert(await evaluate('document.activeElement.matches(".mochi-float-chat")'), 'Closing chat returns focus to the companion’s three-dot button');
  assert(await evaluate('document.querySelector("#overview-resume-progress").max > 0'), 'Overview exposes saved section progress in its next-step card');
  assert(await evaluate('document.querySelectorAll(".overview-milestones [data-state=done]").length===document.querySelector("#overview-resume-progress").value && [...document.querySelectorAll(".overview-milestones a")].every(link=>link.href.includes("section=")&&link.offsetHeight>=44)'), 'Visible section links and completion count agree');
  await click('[data-mochi-visibility]');
  assert(await evaluate('document.querySelector("[data-mochi-float-stage]").hidden && !!document.querySelector("[data-mochi-open] svg")'), 'Hiding the floating companion leaves the distinct chat control available');
  await save('overview-returning-mobile');
  await save('navigation-bottom-mobile');
  await click('.mobile-product-nav [data-workspace-more]');
  await wait('document.querySelector("#workspace-more").open'); await save('navigation-more-mobile');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await wait('!document.querySelector("#workspace-more").open && document.activeElement.matches("[data-workspace-more]")');
    assert(await evaluate('document.querySelector(".mobile-product-nav a[href=\'/builder\']").getClientRects().length > 0'),'Resume bottom link is visible');
  await click('.mobile-product-nav a[href="/builder"]');
  await wait('location.pathname==="/builder" && !!document.querySelector("#step-content h2")');
  assert(await evaluate('document.querySelector("[data-mochi-float-stage]").hidden && !!document.querySelector(".studio-mochi-chat svg")'), 'Mascot visibility persists across candidate routes');
  await click('[data-mochi-visibility]');
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'light'},{name:'prefers-reduced-motion',value:'no-preference'}]});
  await wait('!!document.querySelector("#p-fullname")');
  assert(await evaluate('!document.querySelector(".workspace-sidebar,.mobile-product-nav") && document.querySelector(".studio-exit").pathname === "/dashboard"'),'Resume Studio has independent navigation');
  await click('[data-mochi-float] [data-mochi-pet]');
  assert(await evaluate('!document.querySelector("[data-mochi-bubble]").hidden && /good example|guard the preview/.test(document.querySelector("[data-mochi-bubble-text]").textContent)'), 'The separate companion reacts with a Resume Studio message');
  assert(await evaluate('getComputedStyle(document.querySelector("[data-mochi-pet] img")).animationName !== "none"'), 'The workspace companion animates when motion is enabled');
  const petCenter = await evaluate('(()=>{const rect=document.querySelector("[data-mochi-pet]").getBoundingClientRect();return {x:rect.x+rect.width/2,y:rect.y+rect.height/2}})()');
  await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[petCenter]});
  await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:petCenter.x-90,y:petCenter.y-105}]});
  await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert(await evaluate('document.querySelector("[data-mochi-float]").classList.contains("mochi-positioned")'), 'Touch dragging repositions the animated companion');
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'light'},{name:'prefers-reduced-motion',value:'reduce'}]});
  await save('resume-editor-mobile');
  await click('#studio-preview-mode');
  await wait('document.querySelector("#preview-pdf-pages").dataset.pageCount && document.querySelector("#preview-pdf-pages").getAttribute("aria-busy")==="false"');
  await save('resume-preview-mobile');
  await click('[data-studio-focus]');
  assert(await evaluate('!document.body.hasAttribute("data-studio-mode") && !!document.querySelector("#p-fullname").getClientRects().length'), 'Focus mode returns the phone’s inline preview to writing');
  await click('[data-studio-focus]');
  await click('#studio-sections-open'); await click('[data-editor-action="resume-layout-settings"]');
  await wait('!!document.querySelector(".appearance-inspector[open]")'); await save('resume-appearance-mobile');
  assert(await evaluate('document.querySelector("#save-document-settings").offsetWidth===44 && document.querySelector("#save-document-settings").getAttribute("aria-label") && !document.querySelector(".settings-preview").getClientRects().length'), 'Mobile Appearance opens on the controls with a named icon-only save action');
  await click('#toggle-settings-preview');
  await wait('!!document.querySelector("#settings-pdf-pages canvas")');
  assert(await evaluate('!document.querySelector(".appearance-inspector .settings-body").getClientRects().length'), 'Mobile paper preview has its own full pane');
  await click('#toggle-settings-preview');
  await click('#close-document-settings');
  await size(1440,900);
  await wait('!!document.querySelector("#studio-pdf-pages .pdf-page canvas")');
  await click('[data-studio-focus]');
  assert(await evaluate('document.querySelector("[data-studio-focus]").getAttribute("aria-pressed")==="true" && !document.querySelector("#stepper-wrap").getClientRects().length && !document.querySelector("#studio-preview").getClientRects().length && !!document.querySelector("#p-fullname").getClientRects().length'), 'Resume Focus mode leaves the editor available and hides both panes');
  await click('[data-studio-focus]');
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
  await sleep(2100);
  assert(await evaluate('!document.querySelector("#preview-pdf-pages .sr-only")'),'The automatic preview waits for its in-flight request');
  await evaluate('window.releaseOldPreview();window.restorePreview()');
  await wait('document.querySelector("#preview-pdf-pages .sr-only")?.textContent.includes("Phase N Newer Preview")');
  await click('#close-preview-modal');
  // A real paid export follows the save of a still-edited section.
  const walletBefore=await evaluate('Api.getFeaturePrices().then(r=>r.wallet.available)');
  await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:profile});
  await setField('#p-postcode','75000');
  await setField('#p-fullname','Phase N Export Revision');
  await click('#studio-review');
  await wait('!!document.querySelector("#btn-download-pdf")');
  await wait('document.querySelector("#final-pdf-pages .sr-only")?.textContent.includes("Phase N Export Revision") && document.querySelector("#final-page-count").textContent');
  assert(await evaluate('document.activeElement.id==="resume-review-title" && document.querySelector(".final-screen").getBoundingClientRect().width > 1080'), 'Desktop review uses the studio width and moves focus to the review heading');
  await save('resume-review-desktop');
  await size(390,844);
  await noOverflow('Resume Review mobile');
  await wait('(()=>{const frame=document.querySelector(".final-preview-stage");const paper=frame.querySelector("canvas");return paper.getBoundingClientRect().width <= frame.clientWidth && frame.clientWidth < 390})()');
  await click('.review-paper-jump');
  assert(await evaluate('document.activeElement.id==="final-pdf-heading"'), 'Mobile review jumps to and focuses the PDF preview');
  await save('resume-review-mobile');
  await size(1440,900);
  assert(await evaluate('Api.getResume().then(r=>r.data.personal.fullName==="Phase N Export Revision")'),'Review & export saves the latest resume revision');
  await evaluate('window.exportFinished=false; window.addEventListener("regen:resume-downloaded",()=>window.exportFinished=true,{once:true})');
  await click('#btn-download-pdf');
  await wait('!!document.querySelector(".token-dialog[open] [data-spend]:not([disabled])")');
  await click('.token-dialog[open] [data-spend]');
  await wait('window.exportFinished');
  assert(await evaluate('Api.getFeaturePrices().then(r=>r.wallet.available)') === walletBefore-2,'One resume export debits two synthetic wallet tokens');
  const savedExperience = await evaluate('Api.getResume().then(r=>r.data.experience)');
  assert(await evaluate(`Api.saveSection('experience',Array.from({length:12}, (_,index)=>({
    jobTitle:'Fixture role '+index,company:'Fixture company',startDate:'2020-04',endDate:'2022-07',
    bullets:Array.from({length:5},(_,number)=>'Fixture example '+number+' documents a multi-step handover and validates its application records and outcomes.')
  }))).then(r=>r.success)`), 'A synthetic resume can populate a multi-page review');
  await page('/builder?id='+resumeId+'&review=1','Number(document.querySelector("#final-pdf-pages")?.dataset.pageCount)>=3 && !document.querySelector("#final-pdf-pages").matches("[aria-busy=true]")');
  assert(await evaluate('document.querySelector("#final-pdf-pages figure:last-child canvas").width===0'), 'Resume Review defers rasterizing a distant page');
  await evaluate('document.querySelector("#final-pdf-pages figure:last-child").scrollIntoView({block:"center"})');
  await wait('document.querySelector("#final-pdf-pages figure:last-child canvas").width>0 && document.querySelector("#final-pdf-pages figure:last-child .sr-only").textContent');
  assert(await evaluate(`Api.saveSection('experience',${JSON.stringify(savedExperience)}).then(r=>r.success)`),'The browser fixture restores its original experience data');
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
  await click('.studio-mochi-chat'); await wait('!document.querySelector("#mochi-panel").hidden'); await save('resume-mochi-desktop');
  await click('[data-mochi-close]');
  await evaluate('document.querySelector("[data-mochi-pet]").focus()');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowLeft',code:'ArrowLeft',windowsVirtualKeyCode:37});
  assert(await evaluate('document.querySelector("[data-mochi-float]").classList.contains("mochi-positioned")'), 'Keyboard movement repositions the workspace companion');
  await page('/cover-letters?new=1','document.querySelector("#letter-workspace")?.hidden===false');
  await setField('#letter-company','Syarikat Contoh'); await setField('#letter-role','Regional Operations and Customer Support Adviser');
  await setField('#letter-body','I coordinated a documented project using synthetic data.');
  await wait('document.querySelector("#letter-working-paper").textContent.includes("synthetic data")');
    assert(await evaluate('!new URL(location.href).searchParams.has("id")'),'New draft does not create a record during typing');
  await click('#save-letter'); await wait('!!new URL(location.href).searchParams.get("id")');
  const letterId=await evaluate('new URL(location.href).searchParams.get("id")');
  await save('letter-writing-desktop');
  const letterGeometry = `(() => {
    const viewport = document.querySelector('.letter-working-preview .studio-preview-scroll');
    const page = viewport.querySelector('.pdf-pages:not(.live-proof-staging) canvas');
    return page && [Math.round(page.getBoundingClientRect().width), viewport.scrollTop, viewport.scrollWidth - viewport.clientWidth];
  })()`;
  await evaluate('document.querySelector(".letter-working-preview .studio-preview-scroll").scrollTop=35');
  const beforeLetterRefresh = await evaluate(letterGeometry);
  await setField('#letter-body','I improved fixture reporting and handovers.');
  await wait('document.querySelector("#letter-working-paper").textContent.includes("fixture reporting")');
  assert(JSON.stringify(await evaluate(letterGeometry))===JSON.stringify(beforeLetterRefresh) && beforeLetterRefresh[2]===0, 'An edited letter retains its fitted PDF width and scroll position');
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
  assert(await evaluate('(()=>{const stage=document.querySelector(".letter-preview-stage");return stage.scrollWidth===stage.clientWidth})()'), 'Desktop letter PDF fits without horizontal overflow');
  await save('letter-preview-desktop'); await click('#close-letter-preview');
  // Replace only these two replies for the UI interaction. No provider is contacted.
  await evaluate(`(() => {
    const realFetch=window.fetch;
    window.fetch=(input,options)=> {
      const path=new URL(typeof input==='string'?input:input.url,location.origin).pathname;
      const quota={remaining:10,costs:{cover_letter:1}};
      if(path==='/api/ai/status')return Promise.resolve(Response.json({success:true,enabled:true,quota}));
      if(path.endsWith('/ai-suggest')) {
        window.letterAIRequest=JSON.parse(options.body);
        return Promise.resolve(Response.json({success:true,suggestion:'I built an internal reporting process using fixture evidence.',quota}));
      }
      return realFetch(input,options);
    };
    window.dispatchEvent(new CustomEvent('regen:live-change',{detail:{topic:'ai'}}));
  })()`);
  await wait('!document.querySelector("#generate-letter").disabled');
  await size(390,844);
  await evaluate('document.querySelector(".letter-ai-tools").scrollIntoView({block:"center"})');
  await noOverflow('Enabled AI writer on mobile');
  assert(await evaluate('(()=>{const title=document.querySelector(".letter-workbench-header .studio-identity > span"),style=getComputedStyle(title);return title.offsetHeight<=Math.ceil(parseFloat(style.lineHeight))+1 && document.querySelector("#generate-letter").offsetHeight>=44})()'), 'Mobile studio title occupies one line and generation has a touch-sized control');
  await save('letter-ai-mobile');
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'dark'},{name:'prefers-reduced-motion',value:'reduce'}]});
  await wait('document.documentElement.dataset.theme==="dark"');
  await save('letter-ai-mobile-dark');
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'light'},{name:'prefers-reduced-motion',value:'reduce'}]});
  await size(1440,900);
  await click('#letter-draft-style label:last-child');
  await click('#generate-letter'); await wait('!document.querySelector("#letter-suggestion").hidden');
  assert(await evaluate('window.letterAIRequest.draftStyle==="concise"'),'The selected draft length reaches the suggestion endpoint');
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
  await click('[data-studio-focus]');
  assert(await evaluate('document.querySelector("[data-studio-focus]").getAttribute("aria-pressed")==="true" && !!document.querySelector("#letter-body").getClientRects().length'), 'Letter Focus mode keeps the mobile writing surface available');
  await click('[data-studio-focus]');
  await wait('!!document.querySelector("[data-mochi-float].mochi-positioned")','companion position restored in Cover Letter Studio');
  await evaluate('document.querySelector("[data-mochi-pet]").focus()');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  assert(await evaluate('!document.querySelector("[data-mochi-float]").classList.contains("mochi-positioned")'), 'Escape returns the companion to its default position');
  assert(await evaluate('!document.querySelector(".workspace-sidebar,.mobile-product-nav") && !document.querySelector("#letter-library-dialog").open'),'Letter workspace opens with a focused mobile editor');
  assert(await evaluate('[...document.querySelectorAll("#letter-form [name]")].at(-1).id==="letter-body" && document.querySelector(".letter-body-field").contains(document.querySelector("#generate-letter"))'),'Letter body is the last input and contains the AI draft control');
  await click('#letter-library-toggle');
  await wait('document.querySelector("#letter-library-dialog").open && !!document.querySelector("#letter-list [data-id]")');
  assert(await evaluate('document.querySelector("#letter-search-field").hidden'),'Saved-letter search is collapsed by default');
  await click('#letter-search-toggle');
  await setField('#letter-search','no matching draft');
  assert(await evaluate('!document.querySelector("#letter-list [data-id]")'),'Search filters saved letters');
  await click('#letter-search-toggle');
  await click('#letter-full-titles');
  assert(await evaluate('document.querySelector("#letter-full-titles").getAttribute("aria-pressed")==="true" && getComputedStyle(document.querySelector("#letter-list strong")).whiteSpace==="normal"'), 'Long saved-letter titles can be expanded');
  assert(await evaluate('getComputedStyle(document.querySelector("#letter-list .letter-list-meta")).display==="flex" && !!document.querySelector("#letter-list time").dateTime'), 'Saved letters display separately spaced company and date metadata');
  await save('saved-letters-mobile');
  await click('[data-close-library]');
  await click('.studio-mochi-chat');
  await wait('!document.querySelector("#mochi-panel").hidden');
  await setField('#mochi-message','What can I do on this page?');
  await evaluate('document.querySelector("[data-mochi-compose]").requestSubmit()');
  await wait('document.querySelector("#mochi-panel").textContent.includes("AI draft action beside it")');
  await click('[data-mochi-close]');
  await click('#preview-letter'); await wait('!!document.querySelector("#letter-pdf-pages .sr-only")?.textContent');
  assert(await evaluate('(()=>{const stage=document.querySelector(".letter-preview-stage");return stage.scrollWidth===stage.clientWidth})()'), 'Mobile letter PDF fits without horizontal overflow');
  await click('#letter-zoom-in');
  await wait('(()=>{const stage=document.querySelector(".letter-preview-stage");return stage.scrollWidth>stage.clientWidth})()');
  await click('#letter-zoom-fit');
  await wait('(()=>{const stage=document.querySelector(".letter-preview-stage");return stage.scrollWidth===stage.clientWidth})()');
  await size(1024,900);
  await noOverflow('Cover letter dialog at 1024px');
  await size(390,844);
  await save('letter-preview-mobile'); await click('#close-letter-preview');
  await click('#letter-proof-toggle');
  await wait('document.body.classList.contains("letter-proof-mode")');
  await wait('document.querySelector("#letter-working-paper .sr-only")?.textContent.includes("fixture reporting")');
  assert(await evaluate('!!document.querySelector("#letter-working-paper canvas")'),'Mobile working mode displays the actual PDF');
  for (const width of [360,390,768,1024]) {
    await size(width,844);
    await wait('Math.abs(document.querySelector("#letter-working-preview").getBoundingClientRect().width - innerWidth)<20');
    await noOverflow('Cover Letter Studio reading at '+width+'px');
  }
  await size(390,844);
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
  for (const width of [320,360,390,430,768,1024,1440,1920]) {
      await size(width); await noOverflow('Letter '+width);
    }
  for (const [name,route,ready] of [['overview','/dashboard','document.querySelector("#resume-home")?.getAttribute("aria-busy")==="false"'],['resume','/builder?id='+resumeId,'!!document.querySelector("#p-fullname")']]) {
      await page(route,ready);
      for (const width of [320,360,390,430,768,1024,1440,1920]) { await size(width); await noOverflow(name+' '+width); }
    }
  await size(1440,900);
  await page('/dashboard','document.querySelector("#resume-home")?.getAttribute("aria-busy")==="false"');
  await save('overview-returning-desktop'); await save('navigation-expanded-desktop');
  assert(await evaluate('document.querySelector("#overview-shortcuts-title").textContent==="Your career toolkit" && document.querySelector("#dashboard-open-resume small").textContent.includes("part-time")'), 'Overview explains how to start with real experience');
  const announcement = await send('Page.addScriptToEvaluateOnNewDocument',{source:`{
    const real=window.fetch.bind(window), item={id:91,title:'Career workshop',body:'Bring a draft resume.',color:'jade',rewardEnabled:false};
    window.fetch=(input,options)=>{
      const pathname=new URL(input?.url||input,location.href).pathname;
      if(pathname==='/api/campaigns')return Promise.resolve(Response.json({success:true,items:[item]}));
      if(pathname==='/api/campaigns/91')return Promise.resolve(Response.json({success:true,campaign:item}));
      return real(input,options);
    };
  }`});
  await page('/dashboard','document.querySelector(".campaign-banner")?.dataset.campaignId==="91"');
  await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:announcement.identifier});
  assert(await evaluate('document.querySelector(".campaign-kicker").textContent==="From Kerjayaku"'), 'Campaign banner uses the Kerjayaku name');
  await click('[data-campaign-details]');
  await wait('document.querySelector(".campaign-dialog[open] .campaign-kicker")?.textContent==="Kerjayaku announcement"');
  await click('.campaign-dialog .campaign-dismiss');
  await page('/mochi','document.querySelector("[data-mochi-den]")?.hidden===false');
  for(const width of [320,360,390,430,768,1024,1440,1920]) {await size(width);await noOverflow('Mochi room '+width);}
  await size(844,390);await noOverflow('Mochi room in phone landscape');
  await size(1440,900);
  await save('mochi-room-desktop');
  await size(390,844);await save('mochi-room-mobile');
  const roomLine = await evaluate('document.querySelector("[data-mochi-den-line]").textContent');
  await click('[data-mochi-play-activity]');
  await wait('document.querySelector("[data-mochi-den-line]").textContent!=='+t(roomLine));
  await click('[data-mochi-room-support]');
  const askMochi = async message => {
    await setField('[data-mochi-compose] [name="message"]',message);
    await evaluate('document.querySelector("[data-mochi-compose]").requestSubmit()');
  };
  await askMochi('Asal x boleh download resume?');
  await wait('document.querySelector("#mochi-panel .mochi-ticket-action")?.href.includes("topic=resume") && document.querySelector("#mochi-panel").textContent.includes("check makluman akses")');
  await askMochi('Dah cuba, masih sama');
  await wait('document.querySelector("#mochi-panel").textContent.includes("Bagitahu butang")');
  await click('#mochi-panel a[href*="topic=resume"]');
  await wait('document.querySelector("#support-create [name=category]")?.value==="resume"');
  assert(await evaluate('document.querySelector("#support-create [name=body]").value===""'), 'Malay PDF troubleshooting opens the appropriate blank support request');
  await size(1440,900);
  await page('/dashboard','document.querySelector("#resume-home")?.getAttribute("aria-busy")==="false"');
  await wait('document.querySelector("#dashboard-metrics").getAttribute("aria-busy")==="false"');
  await page('/resumes?lang=en','location.pathname==="/dashboard" && !!document.querySelector("#open-resume-preview")');
  assert(await evaluate('!!document.querySelector("#download-resume") && !document.querySelector("#workspace-sidebar-nav a[href=\'/resumes\']")'), 'Overview contains preview and download without a duplicate resume page');
  await click('#open-resume-preview');
  await wait('!!document.querySelector("#dashboard-pdf-pages canvas")');
  await click('#dashboard-preview-close');
  assert(await evaluate('!!document.querySelector("#overview-resume-progress") && document.querySelectorAll(".overview-metric strong").length===2 && document.querySelectorAll(".overview-recent-item").length===2'), 'Overview shows progress once alongside balances and recent documents');
  assert(await evaluate('performance.getEntriesByType("resource").some(entry=>entry.name.endsWith("/api/dashboard?view=overview")) && !performance.getEntriesByType("resource").some(entry=>entry.name.endsWith("/api/cover-letters"))'), 'Overview loads recent letters without requesting the full library');
  await page('/store','!!document.querySelector(".token-wallet") && !!document.querySelector("[data-view-package]")');
  await wait('!document.querySelector("[data-mochi-float-stage]").hidden');
  assert(await evaluate(`(() => {
    const mascot = document.querySelector('[data-mochi-float] [data-mochi-pet]');
    const bounds = mascot.getBoundingClientRect();
    const sidebar = document.querySelector('.workspace-sidebar').getBoundingClientRect();
    return bounds.right <= sidebar.right && mascot.contains(document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2));
  })()`), 'The desktop companion is visible and interactive inside the sidebar');
  assert(await evaluate('!!document.querySelector(".store-current-offer a[href^=\\\"#package-offer-\\\"]") && document.querySelector(".token-wallet h2").textContent==="Coin balance"'),'Store highlights a published discount and shows the Coin wallet');
  await click('.store-wallet-breakdown summary');
  assert(await evaluate('document.querySelector(".store-wallet-breakdown").open'),'Wallet breakdown can be expanded');
  await click('.store-benefits-more summary');
  assert(await evaluate('!!document.querySelector(".store-benefits-more[open] .token-package-benefits")'), 'K-Store expands the remaining listed package benefits');
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
  await wait('!document.querySelector(".workspace-confirm-dialog") && !document.querySelector("#clear-all-notifications").disabled');
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
    window.fetch=(input,options)=>input==='/api/dashboard?view=overview' && window.fixtureFailDashboard
      ? Promise.resolve(Response.json({success:false,message:'Fixture unavailable'},{status:503}))
      : request(input,options);
  }`});
  await page('/dashboard','!!document.querySelector("#retry-load")');
  await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:intercept.identifier});
  assert(await evaluate('document.querySelector("#resume-home").textContent.includes("Cuba lagi")'),'Overview shows the real failure state instead of a false empty state');
  await evaluate('window.fixtureFailDashboard=false');
  await click('#retry-load');
  await wait('!!document.querySelector("#resume-home .overview-recent")');
  const aiFixture = await send('Page.addScriptToEvaluateOnNewDocument',{source:`{
    const fetchOriginal=window.fetch.bind(window);
    window.fetch=async (...args)=>{
      const response=await fetchOriginal(...args);
      if(new URL(args[0]?.url||args[0],location.href).pathname!=='/api/ai/status'||!response.ok)return response;
      const status=await response.json();return Response.json({...status,enabled:true});
    };
  }`});
  await page('/builder.html?id='+resumeId+'&section=summary','location.pathname==="/builder" && !!document.querySelector("#step-content h2")');
  await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:aiFixture.identifier});
  await wait('document.querySelector("[data-ai-section=summary] .assist-open:enabled") && document.querySelector(".ai-token-badge")?.textContent.includes("Coin")');
  await size(390,844);
  await evaluate('document.querySelector(".ai-desk-actions").scrollIntoView({block:"center"})');
  await noOverflow('Resume AI desk on a phone'); await save('resume-ai-mobile');
  await click('.assist-open');
  await wait('!!document.querySelector(".assist-dialog[open]")');
  await click('.assist-dialog[open] .assist-close');
  assert(await evaluate('document.activeElement.matches(".assist-open")'), 'Draft command opens the guided writer and regains focus on close');
  await size(1440,900); await save('resume-ai-desktop');
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
  assert(await evaluate('Api.getOverview().then(result => result.latestLetter === null && result.coverLetterCount === 0)'), 'Overview excludes another candidate’s letters');
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
  await send('Network.clearBrowserCookies');
  await page('/admin/login','!!document.querySelector("#admin-login-form")');
  await submit('#admin-login-form','admin-email','admin-password','jamie@qa.regen.local','Qa-Admin-567891');
  await wait('!!document.querySelector(".admin-workspace-controls [data-open-view=mochi]")');
  await click('.admin-topbar .appearance-toggle');
  await click('[data-appearance-choice="light"]');
  await save('admin-overview-light');
  await click('#admin-nav [data-view="ai"]');
  await wait('!!document.querySelector("#ai-policy-preview")');
  const originalLimit = await evaluate('document.querySelector("#ai-limit").value');
  await setField('#ai-limit', originalLimit === '63' ? '64' : '63');
  assert(await evaluate('!document.querySelector("#ai-revert").hidden'), 'Admin can discard an unsaved allowance change');
  await click('#ai-revert');
  await wait('document.querySelector("#ai-limit").value===' + JSON.stringify(originalLimit));
  await save('admin-ai-policy');
  await click('#admin-nav [data-view="mochi"]');
  await wait('!!document.querySelector("#mochi-settings-form")');
  assert(await evaluate('document.documentElement.dataset.theme==="light" && getComputedStyle(document.querySelector(".admin-sidebar .product-wordmark")).color==="rgb(244, 248, 246)" && getComputedStyle(document.querySelector(".admin-brand-compact")).display==="none"'), 'The full admin wordmark is readable against the dark rail in light mode');
  await save('admin-mochi-desktop');
  await click('#admin-nav-collapse');
  await wait('document.body.classList.contains("admin-nav-collapsed") && !!document.querySelector(".admin-brand-compact").getClientRects().length');
  await click('#admin-nav-collapse');
  await click('.admin-topbar .appearance-toggle');
  await click('[data-appearance-choice="dark"]');
  assert(await evaluate('document.documentElement.dataset.theme==="dark" && !!document.querySelector("#mochi-settings-form")'), 'Admin dark theme keeps the active module and navigation');
  await save('admin-mochi-dark');
  await click('.admin-topbar .appearance-toggle');
  await click('[data-appearance-choice="light"]');
  await size(390,844);
  await noOverflow('Mochi admin mobile');
  await click('#admin-menu-toggle');
  await wait('document.querySelector("#admin-sidebar").classList.contains("is-open")');
  await save('admin-sidebar-mobile');
  await click('#admin-mobile-close');
  await save('admin-mochi-mobile');
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
