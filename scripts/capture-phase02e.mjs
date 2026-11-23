import { spawn } from 'node:child_process';
import { readFile, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const project = fileURLToPath(new URL('..', import.meta.url));
const screenshotsDir = path.join(project, 'docs', 'kerjayaku', 'phase-02e', 'screenshots');
const chrome = process.env.KERJAYA_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const pause = ms => new Promise(res => setTimeout(res, ms));

await mkdir(screenshotsDir, { recursive: true });

// Start PHP built-in server
const port = 8765;
const base = `http://127.0.0.1:${port}`;
console.log(`Starting PHP server on ${base} ...`);
const php = spawn('php', ['-S', `127.0.0.1:${port}`, '-t', 'public'], {
  cwd: project,
  windowsHide: true,
  stdio: 'ignore'
});

php.on('error', err => {
  console.error('Failed to spawn PHP server:', err);
  process.exit(1);
});

// Wait for PHP server to be ready
let serverReady = false;
for (let i = 0; i < 50; i++) {
  try {
    const res = await fetch(`${base}/`);
    if (res.status === 200) {
      serverReady = true;
      break;
    }
  } catch {
    await pause(100);
  }
}
if (!serverReady) {
  php.kill();
  throw new Error('PHP server did not respond in time.');
}
console.log('PHP server is ready.');

// Launch Chrome
const profile = await mkdtemp(path.join(tmpdir(), 'kerjayaku-p02e-'));
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

let socket, serial = 0;
const requests = new Map();

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

function handleMessage(evt) {
  const msg = JSON.parse(evt.data);
  if (msg.id && requests.has(msg.id)) {
    const { resolve, reject, timeout } = requests.get(msg.id);
    requests.delete(msg.id);
    clearTimeout(timeout);
    if (msg.error) reject(new Error(msg.error.message));
    else resolve(msg.result);
  }
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

async function capture(name, fullPage = false) {
  const params = { format: 'png' };
  if (fullPage) {
    const layout = await send('Page.getLayoutMetrics');
    const width = Math.ceil(layout.contentSize.width);
    const height = Math.ceil(layout.contentSize.height);
    await setViewport(width, height);
    params.captureBeyondViewport = true;
  }
  const result = await send('Page.captureScreenshot', params);
  const targetPath = path.join(screenshotsDir, name + '.png');
  await writeFile(targetPath, Buffer.from(result.data, 'base64'));
  console.log(`Saved screenshot: ${name}.png`);
}

try {
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

  // 1. Landing Desktop Light
  console.log('Capturing Landing Desktop Light...');
  await setViewport(1440, 900);
  await send('Page.navigate', { url: `${base}/` });
  await pause(1500);
  await evaluate('document.documentElement.setAttribute("data-theme", "light")');
  await pause(300);
  await capture('landing-desktop-light');
  await capture('landing-desktop-full', true);
  await setViewport(1440, 900);

  // 2. Landing Desktop Dark
  console.log('Capturing Landing Desktop Dark...');
  await evaluate('document.documentElement.setAttribute("data-theme", "dark")');
  await pause(300);
  await capture('landing-desktop-dark');

  // 3. Landing Mobile Light
  console.log('Capturing Landing Mobile Light...');
  await setViewport(390, 844);
  await evaluate('document.documentElement.setAttribute("data-theme", "light")');
  await pause(400);
  await capture('landing-mobile-light');

  // 4. Landing Mobile Dark
  console.log('Capturing Landing Mobile Dark...');
  await evaluate('document.documentElement.setAttribute("data-theme", "dark")');
  await pause(400);
  await capture('landing-mobile-dark');

  // 5. Login Desktop
  console.log('Capturing Login Desktop...');
  await setViewport(1280, 800);
  await send('Page.navigate', { url: `${base}/login` });
  await pause(1200);
  await evaluate('document.documentElement.setAttribute("data-theme", "light")');
  await pause(300);
  await capture('login-desktop');

  // 6. Login Mobile
  console.log('Capturing Login Mobile...');
  await setViewport(390, 844);
  await pause(400);
  await capture('login-mobile');

  // 7. Register Desktop
  console.log('Capturing Register Desktop...');
  await setViewport(1280, 800);
  await send('Page.navigate', { url: `${base}/register` });
  await pause(1200);
  await evaluate('document.documentElement.setAttribute("data-theme", "light")');
  await pause(300);
  await capture('register-desktop');

  // 8. Register Mobile
  console.log('Capturing Register Mobile...');
  await setViewport(390, 844);
  await pause(400);
  await capture('register-mobile');

  console.log('All 8 Phase 02E screenshots successfully captured!');
} finally {
  try { socket?.close(); } catch {}
  try { browser?.kill(); } catch {}
  try { php?.kill(); } catch {}
}
