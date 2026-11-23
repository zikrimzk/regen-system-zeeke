import {spawn} from 'node:child_process';
import {readFile, mkdir, mkdtemp, writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const project = fileURLToPath(new URL('../..', import.meta.url));
const folder = path.join(project, 'prototypes', 'kerjaya');
const screenshots = path.join(folder, 'screenshots');
const chrome = process.env.KERJAYA_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const type = {
  '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.woff2':'font/woff2', '.webp':'image/webp', '.pdf':'application/pdf',
};
const pages = [
  ['landing','index.html'],
  ['dashboard','dashboard.html'],
  ['studio','studio.html'],
];
const widths = [360,390,430,768,1024,1440];
const permitted = /^\/(?:prototypes\/kerjaya\/(?:prototype\.(?:css|js)|assets\/kl-skyline-(?:640|1120)\.webp|(?:city|workspace)\/(?:index|dashboard|studio)\.html)|public\/(?:fonts\/(?:Inter-Latin|EBGaramond-Regular)\.woff2|img\/templates\/(?:classic|modern)-640\.webp|samples\/(?:classic|modern)\.pdf))$/;
const service = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    if (!permitted.test(url.pathname)) { response.writeHead(404).end(); return; }
    const body = await readFile(path.join(project, ...url.pathname.slice(1).split('/')));
    response.writeHead(200, {'Content-Type':type[path.extname(url.pathname)]}).end(body);
  } catch {
    response.writeHead(500).end();
  }
});
await new Promise((resolve, reject) => {
  service.on('error',reject);
  service.listen(0,'127.0.0.1',resolve);
});
const base = 'http://127.0.0.1:' + service.address().port;
if (process.argv.includes('--serve')) {
  for (const concept of ['city','workspace']) console.log(base+'/prototypes/kerjaya/'+concept+'/index.html');
  await new Promise(resolve => process.once('SIGINT', () => service.close(resolve)));
  process.exit(0);
}
const profile = await mkdtemp(path.join(tmpdir(), 'kerjaya-chrome-'));
const browser = spawn(chrome, [
  '--headless=new','--disable-gpu','--disable-extensions','--no-first-run','--disable-default-apps',
  '--disable-background-networking','--disable-component-update','--disable-sync','--remote-debugging-port=0',
  '--remote-debugging-address=127.0.0.1','--user-data-dir='+profile,'about:blank',
], {windowsHide:true,stdio:'ignore'});
browser.on('error', error => console.error(error.message));
const report = {viewport:[],journeys:[],performance:[],unexpected:[]};
const requests = new Map();
let socket, serial=0, current='';
const encode = JSON.stringify;

function send(method, params={}) {
  return new Promise((resolve,reject) => {
    const id = ++serial;
    const timeout = setTimeout(() => { requests.delete(id); reject(new Error('DevTools timed out at '+method)); }, 14000);
    requests.set(id,{resolve,reject,timeout});
    socket.send(JSON.stringify({id,method,params}));
  });
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}
async function until(expression, description) {
  for (let attempt=0; attempt<170; attempt++) {
    try { if (await evaluate(expression)) return; } catch {}
    await pause(100);
  }
  throw new Error(description + ' · ' + current);
}
function check(condition, description) {
  if (!condition) throw new Error(description + ' · ' + current);
  report.journeys.push(description);
}
async function page(concept, filename) {
  current = '/prototypes/kerjaya/' + concept + '/' + filename;
  const response = await send('Page.navigate',{url:base+current});
  if (response.errorText) await send('Page.navigate',{url:base+current});
  await until('location.pathname === '+encode(current)+' && document.readyState === "complete" && !!document.querySelector("main h1")','Page did not load');
  await evaluate('document.fonts.ready.then(()=>true)');
}
async function dimensions(width, height) {
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});
  await send('Emulation.setTouchEmulationEnabled',{enabled:width<600});
}
async function screenshot(name) {
  const result = await send('Page.captureScreenshot',{format:'png'});
  await writeFile(path.join(screenshots,name+'.png'),Buffer.from(result.data,'base64'));
}
async function click(selector) {
  await until('document.querySelector('+encode(selector)+')?.getClientRects().length','Control unavailable '+selector);
  const point=await evaluate('(()=>{const control=document.querySelector('+encode(selector)+');control.scrollIntoView({block:"center",inline:"center",behavior:"instant"});const bounds=control.getBoundingClientRect();const x=bounds.x+bounds.width/2;const y=bounds.y+bounds.height/2;return {x,y,reachable:control.contains(document.elementFromPoint(x,y))}})()');
  if (!point.reachable) throw new Error('Click target is obstructed '+selector+' · '+current);
  const coordinates={x:point.x,y:point.y,button:'left',clickCount:1};
  await send('Input.dispatchMouseEvent',{...coordinates,type:'mousePressed'});
  await send('Input.dispatchMouseEvent',{...coordinates,type:'mouseReleased'});
}
async function key(value, code, vk) {
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:value,code,windowsVirtualKeyCode:vk});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:value,code,windowsVirtualKeyCode:vk});
}
function readFrame(event) {
  const message=JSON.parse(event.data);
  if (message.id && requests.has(message.id)) {
    const {resolve,reject,timeout}=requests.get(message.id);requests.delete(message.id);clearTimeout(timeout);
    if (message.error) reject(new Error(message.error.message));else resolve(message.result);
  }
  if (message.method==='Runtime.exceptionThrown') report.unexpected.push(current+': '+message.params.exceptionDetails.text);
  if (message.method==='Runtime.consoleAPICalled' && message.params.type==='error') report.unexpected.push(current+': '+message.params.args.map(arg=>arg.description||arg.value).join(' '));
  if (message.method==='Network.responseReceived' && message.params.response.status>=400) report.unexpected.push(message.params.response.status+' '+message.params.response.url);
}

try {
  await mkdir(screenshots,{recursive:true});
  let endpoint;
  for(let attempt=0;attempt<150;attempt++){
    try { endpoint=(await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split(/\r?\n/)[0];break; } catch { await pause(100); }
  }
  if (!endpoint) throw new Error('Chrome did not start');
  const tabs = await fetch('http://127.0.0.1:'+endpoint+'/json/list').then(response=>response.json());
  socket = new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject) => { socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true}); });
  socket.addEventListener('message',readFrame);
  for (const name of ['Page','Runtime','Network']) await send(name+'.enable');
  await send('Network.setBlockedURLs',{urls:['https://*','wss://*']});
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'light'},{name:'prefers-reduced-motion',value:'reduce'}]});
  await send('Page.addScriptToEvaluateOnNewDocument',{source:`window.previewVitals={lcp:0,cls:0};
    new PerformanceObserver(list=>{previewVitals.lcp=list.getEntries().at(-1)?.startTime||0}).observe({type:"largest-contentful-paint",buffered:true});
    new PerformanceObserver(list=>{for(const shift of list.getEntries()) if(!shift.hadRecentInput) previewVitals.cls+=shift.value}).observe({type:"layout-shift",buffered:true});`});
  for (const concept of ['city','workspace']) {
    for (const [screen,filename] of pages) {
      for (const width of widths) {
        const height=width===1440?1000:844;
        await dimensions(width,height);
        await page(concept,filename);
        const metric=await evaluate('({width:innerWidth,content:document.documentElement.scrollWidth,body:document.body.scrollWidth,h1:document.querySelectorAll("main h1").length})');
        report.viewport.push({concept,screen,width,height,...metric,pass:metric.content<=width && metric.body<=width && metric.h1===1});
        if (metric.content>width || metric.body>width || metric.h1!==1) throw new Error('Viewport or heading issue '+JSON.stringify(metric)+' · '+current);
        if (width===390 || width===1440) {
          if (screen==='landing' && concept==='city') await until('document.querySelector(".skyline").naturalWidth>0 && document.querySelector(".hero-resume").naturalWidth>0','Hero art is missing');
          await screenshot(concept+'-'+screen+'-'+(width===390?'mobile':'desktop'));
          if (screen==='landing') report.performance.push({concept,width,...await evaluate('window.previewVitals')});
        }
      }
    }
    await dimensions(390,844);
    await page(concept,'index.html');
    await key('Tab','Tab',9);
    check(await evaluate('document.activeElement.classList.contains("skip")'),concept+' skip link is first tab stop');
    await click('#public-menu-button');
    check(await evaluate('document.getElementById("public-menu-button").getAttribute("aria-expanded")==="true" && !!document.querySelector("#public-nav").getClientRects().length'),concept+' mobile menu opens');
    await key('Escape','Escape',27);
    check(await evaluate('document.getElementById("public-menu-button").getAttribute("aria-expanded")==="false" && document.activeElement.id==="public-menu-button"'),concept+' mobile menu Escape and focus');
    await click('[data-show-design="classic"]');
    await until('document.querySelector("#compare-image").complete && document.querySelector("#compare-image").naturalWidth === 640','Classic image did not load');
    check(await evaluate('document.querySelector("[data-show-design=classic]").getAttribute("aria-pressed")==="true" && document.querySelector("#compare-pdf").pathname.endsWith("classic.pdf")'),concept+' public template and sample PDF agree');
    check(await evaluate('fetch(document.querySelector("#compare-pdf").href).then(response=>response.ok && response.headers.get("content-type")==="application/pdf")'),concept+' sample PDF is available');
    await click('.hero-actions .primary');
    await until('location.pathname.endsWith("/dashboard.html")','Hero action did not reach the dashboard');
    check(await evaluate('document.querySelector(".resume-command").textContent.includes("Aina")'),concept+' primary landing action reaches candidate workspace');
    await click('[data-preview-open]');
    await until('document.querySelector("#preview-dialog").open','Candidate preview did not open');
    check(await evaluate('document.querySelector("#preview-dialog .paper h2").textContent==="Aina Rahman"'),concept+' candidate preview shows fixture resume');
    await key('Escape','Escape',27);
    await until('!document.querySelector("#preview-dialog").open && document.activeElement.matches("[data-preview-open]")','Preview did not return focus');
    check(true, concept+' candidate preview Escape returns focus');
    await click('[data-letter-open]');
    check(await evaluate('document.querySelector("#letter-dialog").open && document.querySelector(".letter-content").textContent.includes("Hiring Manager")'),concept+' existing sample letter is readable');
    await key('Escape','Escape',27);
    await click('.mobile-dock a[href$="#documents"]');
    await until('document.querySelector(".mobile-dock [aria-current=location]")?.hash==="#documents"','Documents navigation did not become current');
    check(true, concept+' mobile documents navigation updates its selected location');
    await page(concept,'studio.html');
    await click('[data-section-open]');
    await click('#section-dialog [data-section="experience"]');
    check(await evaluate('document.querySelector("#editor-heading").textContent==="Experience" && document.activeElement.id==="editor-heading"'),concept+' mobile outline changes section and focuses heading');
    await evaluate(`(()=>{const field=document.querySelector('#field-achievement');field.value='Coordinated stock checks in Shah Alam';field.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    check(await evaluate('document.querySelector("[data-save-status]").textContent==="Unsaved changes"'),concept+' edit shows unsaved state');
    await click('[data-template-open]');
    await click('[data-use-design="classic"]');
    check(await evaluate('document.querySelector("#canvas-panel .paper").dataset.design==="classic" && document.getElementById("field-achievement").value.includes("Shah Alam")'),concept+' switching layout preserves draft content');
    await click('.mobile-save');
    check(await evaluate('document.querySelector("[data-save-status]").textContent.includes("this browser session")'),concept+' save reports prototype scope');
    await page(concept,'studio.html');
    await click('[data-section-open]');
    await click('#section-dialog [data-section="experience"]');
    check(await evaluate('document.getElementById("field-achievement").value.includes("Shah Alam")'),concept+' saved draft survives reload in same tab');
    if(concept==='city') {
      await click('.studio-modal-trigger');
      check(await evaluate('document.querySelector("#preview-dialog").open'), 'city mobile uses a separate preview dialog');
    } else {
      await click('[data-mode="preview"]');
      check(await evaluate('document.querySelector("#canvas-panel").getClientRects().length>0 && !document.querySelector("#editor-panel").getClientRects().length'), 'workspace mobile uses a dedicated preview mode');
    }
    await screenshot(concept+'-studio-preview-mobile');
    await evaluate('sessionStorage.clear()');
    await dimensions(1440,1000);
    await page(concept,'dashboard.html');
    await click('.command-actions .primary');
    await until('location.search==="?section=experience" && document.querySelector("#editor-heading")?.textContent==="Experience"','Continue editing did not land on Experience');
    check(true, concept+' desktop continue action opens the next section');
    await evaluate('document.querySelector("#field-achievement").focus()');
    await until('document.activeElement.id==="field-achievement"','Desktop textarea did not receive focus');
    await send('Input.insertText',{text:'Reviewed returns in Ampang.'});
    await until('document.querySelector("#canvas-panel .paper").textContent.includes("Reviewed returns in Ampang.")','Desktop typing did not update the inline preview');
    check(true, concept+' desktop typing refreshes the inline preview');
  }
  if (report.unexpected.length) throw new Error(report.unexpected.join('\n'));
  console.log(report.viewport.length+' responsive checks and '+report.journeys.length+' interaction checks passed.');
} catch(error) {
  console.error(error.message);
  report.failure=error.message;
  process.exitCode=1;
} finally {
  await writeFile(path.join(screenshots,'browser-results.json'),JSON.stringify(report,null,2)+'\n');
  socket?.close();
  browser.kill();
  await new Promise(resolve=>service.close(resolve));
}
