const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const failures = [];

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

const javascriptFiles = [
  path.join(root, 'server.js'),
  ...walk(path.join(root, 'app')).filter(file => file.endsWith('.js')),
  ...walk(path.join(root, 'public', 'js')).filter(file => file.endsWith('.js')),
];

for (const file of javascriptFiles) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    failures.push(`${path.relative(root, file)}: ${result.stderr.trim()}`);
  }
}

const personal = fs.readFileSync(path.join(root, 'public/js/sections/personal.js'), 'utf8');
const stepper = fs.readFileSync(path.join(root, 'public/js/stepper.js'), 'utf8');
const dashboard = fs.readFileSync(path.join(root, 'public/js/dashboard.js'), 'utf8');
const auth = fs.readFileSync(path.join(root, 'public/js/auth.js'), 'utf8');
const publicIndex = fs.readFileSync(path.join(root, 'public/index.php'), 'utf8');
const phpApplication = fs.readFileSync(path.join(root, 'php/src/Application.php'), 'utf8');
const googleIdentity = fs.readFileSync(path.join(root, 'php/src/GoogleIdentityService.php'), 'utf8');
const schema = fs.readFileSync(path.join(root, 'database/schema.sql'), 'utf8');
const publicFiles = walk(path.join(root, 'public'))
  .filter(file => /\.(?:html|js|css)$/.test(file))
  .map(file => fs.readFileSync(file, 'utf8'))
  .join('\n');

if (personal.includes('id="p-city"') || personal.includes('id="p-address-line"')) {
  failures.push('Personal information still renders city or street-address fields.');
}
if (!personal.includes('[postcode, state, country]')) {
  failures.push('Personal address is not composed from postcode, state, and country.');
}
const previewDataBlock = stepper.match(/function getCurrentPreviewData[\s\S]*?\n  }\n/)?.[0] || '';
if (previewDataBlock.includes('sanitizeFields(')) {
  failures.push('Live preview still rewrites active form fields.');
}
for (const control of ['dashboard-zoom-out', 'dashboard-zoom-fit', 'dashboard-zoom-in', 'dashboard-fullscreen']) {
  if (!dashboard.includes(control)) failures.push(`Dashboard preview control missing: ${control}`);
}
if (!dashboard.includes('requestFullscreen') || !dashboard.includes('fullscreenchange')) {
  failures.push('Dashboard fullscreen behavior is not wired to the browser fullscreen API.');
}
if (!auth.includes('let countryInput = null;') || !auth.includes('validateRegistrationPostcode = function')) {
  failures.push('Registration location fields are not available to the submit handler.');
}
if (
  !auth.includes('/api/auth/google/config')
  || !auth.includes('https://accounts.google.com/gsi/client')
  || !publicFiles.includes('id="google-auth"')
) {
  failures.push('Google Identity Services is not wired into the authentication pages.');
}
if (
  !phpApplication.includes("'/api/auth/google'")
  || !phpApplication.includes("!($method === 'POST' && $path === '/api/auth/google')")
  || !googleIdentity.includes('AccessToken')
  || !googleIdentity.includes("'audience' => $this->clientId")
  || !googleIdentity.includes('validCsrfToken')
) {
  failures.push('Server-side Google credential verification is incomplete.');
}
const productionBootstrap = publicIndex.indexOf("__DIR__ . '/_app/bootstrap.php'");
const developmentBootstrap = publicIndex.indexOf("dirname(__DIR__) . '/php/bootstrap.php'");
if (
  productionBootstrap === -1
  || developmentBootstrap === -1
  || productionBootstrap > developmentBootstrap
) {
  failures.push('Production must prefer the deployed _app bootstrap over legacy PHP files.');
}
if (
  !schema.includes('CREATE TABLE IF NOT EXISTS user_identities')
  || !schema.includes('provider_subject')
) {
  failures.push('Google identity persistence is missing from the database schema.');
}
if (/>\s*Remove\s*<\/button>/i.test(publicFiles)) {
  failures.push('A text-only Remove button remains in the interface.');
}
if (/Zeeke Resume Gen|professional resume|Edit Resume/i.test(publicFiles)) {
  failures.push('Legacy or promotional interface wording remains.');
}

JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`Project checks passed (${javascriptFiles.length} JavaScript files).`);
