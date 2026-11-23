import { spawn } from 'node:child_process';
import { readFile, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const project = fileURLToPath(new URL('../../..', import.meta.url));
const phaseFolder = path.join(project, 'prototypes', 'kerjaya', 'phase-02d');
const screenshotsDir = path.join(phaseFolder, 'screenshots');
const chrome = process.env.KERJAYA_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const pause = ms => new Promise(res => setTimeout(res, ms));

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.woff2': 'font/woff2',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
};

// Local HTTP Server to serve files cleanly to Chrome
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1');
    let relative = url.pathname.slice(1);
    if (!relative || relative === '') relative = 'prototypes/kerjaya/phase-02d/index.html';
    
    // Resolve safe path
    const filePath = path.normalize(path.join(project, relative));
    if (!filePath.startsWith(path.normalize(project))) {
      res.writeHead(403).end();
      return;
    }
    
    const body = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': mimeTypes[path.extname(filePath)] || 'application/octet-stream' }).end(body);
  } catch (err) {
    res.writeHead(404).end('Not found');
  }
});

await new Promise((resolve, reject) => {
  server.on('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});

const base = 'http://127.0.0.1:' + server.address().port;
console.log('Prototype server running at: ' + base);

const profile = await mkdtemp(path.join(tmpdir(), 'kerjaya-p02d-'));
const browser = spawn(chrome, [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  '--disable-extensions',
  '--no-first-run',
  '--disable-default-apps',
  '--remote-debugging-port=0',
  '--remote-debugging-address=127.0.0.1',
  '--user-data-dir=' + profile,
  'about:blank',
], { windowsHide: true });
browser.stdout?.on('data', d => console.log('[Chrome out]:', d.toString().trim()));
browser.stderr?.on('data', d => console.log('[Chrome err]:', d.toString().trim()));
browser.on('error', err => console.error('[Chrome spawn error]:', err));


const report = { viewports: [], interactions: [], errors: [] };
const requests = new Map();
let socket, serial = 0;

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++serial;
    const timeout = setTimeout(() => {
      requests.delete(id);
      reject(new Error('CDP timed out: ' + method));
    }, 15000);
    requests.set(id, { resolve, reject, timeout });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  }
  return result.result.value;
}

async function setViewport(width, height) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 768
  });
  await send('Emulation.setTouchEmulationEnabled', { enabled: width < 768 });
}

async function capture(name) {
  const result = await send('Page.captureScreenshot', { format: 'png' });
  const targetPath = path.join(screenshotsDir, name + '.png');
  await writeFile(targetPath, Buffer.from(result.data, 'base64'));
  console.log(`Saved screenshot: ${name}.png`);
}

function handleMessage(evt) {
  const msg = JSON.parse(evt.data);
  if (msg.id && requests.has(msg.id)) {
    const { resolve, reject, timeout } = requests.get(msg.id);
    requests.delete(msg.id);
    clearTimeout(timeout);
    if (msg.error) reject(new Error(msg.error.message));
    else resolve(msg.result);
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    report.errors.push(msg.params.exceptionDetails.text);
  }
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
    report.errors.push(msg.params.args.map(a => a.value || a.description).join(' '));
  }
}

try {
  await mkdir(screenshotsDir, { recursive: true });

  // Locate active port
  let endpoint;
  for (let i = 0; i < 150; i++) {
    try {
      endpoint = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split(/\r?\n/)[0];
      break;
    } catch {
      await pause(100);
    }
  }
  if (!endpoint) throw new Error('Could not connect to Chrome DevTools');

  const tabs = await fetch(`http://127.0.0.1:${endpoint}/json/list`).then(r => r.json());
  const pageTab = tabs.find(t => t.type === 'page');
  socket = new WebSocket(pageTab.webSocketDebuggerUrl);

  await new Promise((res, rej) => {
    socket.addEventListener('open', res, { once: true });
    socket.addEventListener('error', rej, { once: true });
  });

  socket.addEventListener('message', handleMessage);

  for (const domain of ['Page', 'Runtime', 'Network']) {
    await send(domain + '.enable');
  }

  // Navigate to prototype page
  const targetUrl = `${base}/prototypes/kerjaya/phase-02d/index.html`;
  await send('Page.navigate', { url: targetUrl });
  await pause(1200);

  // 1. Viewport sweep across 320, 360, 390, 430, 768, 1024, 1440
  const viewports = [
    { name: '01-landing-mobile-320', width: 320, height: 640 },
    { name: '02-landing-mobile-360', width: 360, height: 740 },
    { name: '03-landing-mobile-390', width: 390, height: 844 },
    { name: '04-landing-mobile-430', width: 430, height: 932 },
    { name: '05-landing-tablet-768', width: 768, height: 1024 },
    { name: '06-landing-laptop-1024', width: 1024, height: 768 },
    { name: '07-landing-desktop-1440', width: 1440, height: 900 },
  ];

  for (const vp of viewports) {
    await setViewport(vp.width, vp.height);
    await pause(300);

    const metrics = await evaluate(`({
      windowWidth: window.innerWidth,
      docWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      h1Count: document.querySelectorAll('h1').length,
      overflowing: Array.from(document.querySelectorAll('*'))
        .filter(el => {
          const r = el.getBoundingClientRect();
          return r.right > window.innerWidth + 1 || el.scrollWidth > window.innerWidth + 1;
        })
        .slice(0, 5)
        .map(el => el.tagName + (el.id ? '#' + el.id : '') + (el.className ? '.' + String(el.className).replace(/\\s+/g, '.') : ''))
    })`);

    const hasOverflow = metrics.docWidth > vp.width || metrics.bodyWidth > vp.width;
    report.viewports.push({
      viewport: vp.width,
      overflow: hasOverflow,
      h1Count: metrics.h1Count,
      overflowing: metrics.overflowing
    });

    if (hasOverflow) {
      console.warn(`WARNING: Horizontal overflow at ${vp.width}px! docWidth: ${metrics.docWidth}, culprits:`, metrics.overflowing);
    }

    await capture(vp.name);
  }

  // 2. Bahasa Melayu (BM) rendering at 390px mobile and 1440px desktop
  console.log('Testing Bahasa Melayu language switch...');
  await evaluate(`document.getElementById('lang-toggle-btn').click()`);
  await pause(300);

  await setViewport(390, 844);
  await capture('08-landing-bm-phone-390');

  await setViewport(1440, 900);
  await capture('09-landing-bm-desktop-1440');

  // 3. Dark Theme rendering at 390px and 1440px
  console.log('Testing Dark Theme toggle...');
  await evaluate(`document.getElementById('theme-toggle-btn').click()`);
  await pause(300);

  await setViewport(390, 844);
  await capture('10-landing-dark-phone-390');

  await setViewport(1440, 900);
  await capture('11-landing-dark-desktop-1440');

  // Switch back to light theme and EN for interactive testing
  await evaluate(`document.getElementById('theme-toggle-btn').click()`);
  await evaluate(`document.getElementById('lang-toggle-btn').click()`);
  await pause(200);

  // 4. Interactive Persona Switcher Test (Graduate & Tech personas)
  console.log('Testing persona switching...');
  await setViewport(1440, 900);
  await evaluate(`document.querySelector('.persona-btn[data-persona="graduate"]').click()`);
  await pause(300);
  await capture('12-hero-persona-graduate');

  await evaluate(`document.querySelector('.persona-btn[data-persona="tech"]').click()`);
  await pause(300);
  await capture('13-hero-persona-tech');

  // 5. Interactive Walkthrough Step 3 (AI Suggestion Diff)
  console.log('Testing walkthrough step 3...');
  await evaluate(`document.querySelectorAll('.step-nav-btn')[2].click()`);
  await pause(300);
  await capture('14-walkthrough-ai-step');

  // 6. Template Modal Sample Preview
  console.log('Testing PDF sample modal dialog...');
  await evaluate(`document.querySelector('[data-open-modal]').click()`);
  await pause(400);
  await capture('15-template-modal-preview');

  console.log('All prototype screenshots captured successfully.');
} catch (err) {
  console.error('Error during capture:', err);
  report.errors.push(err.message);
} finally {
  await writeFile(path.join(phaseFolder, 'capture-results.json'), JSON.stringify(report, null, 2));
  socket?.close();
  browser.kill();
  server.close();
  console.log('Capture run complete.');
}
