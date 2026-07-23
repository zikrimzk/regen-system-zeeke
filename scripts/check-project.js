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
