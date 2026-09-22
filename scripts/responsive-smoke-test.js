process.env.PORT = process.env.RESPONSIVE_SMOKE_PORT || '3202';
process.env.NODE_ENV = 'test';

const fs = require('fs');
const os = require('os');
const path = require('path');
const puppeteer = require('puppeteer');
const app = require('../server');
const db = require('../app/config/db');
const pdfService = require('../app/services/pdfService');

const baseUrl = `http://127.0.0.1:${process.env.PORT}`;
const outputDir = process.env.RESPONSIVE_SCREENSHOT_DIR
  || path.join(os.tmpdir(), 'regen-responsive-audit');
const email = `regen-responsive-test-${Date.now()}@example.com`;
const password = 'Responsive-Test-Password-2026!';
const viewports = [
  { name: 'phone-320', width: 320, height: 568, isMobile: true, hasTouch: true },
  { name: 'phone-360', width: 360, height: 800, isMobile: true, hasTouch: true },
  { name: 'phone-390', width: 390, height: 844, isMobile: true, hasTouch: true },
  { name: 'phone-landscape', width: 844, height: 390, isMobile: true, hasTouch: true },
  { name: 'tablet-768', width: 768, height: 1024, isMobile: true, hasTouch: true },
  { name: 'tablet-landscape', width: 1024, height: 768, isMobile: true, hasTouch: true },
  { name: 'laptop-1366', width: 1366, height: 768 },
  { name: 'desktop-1920', width: 1920, height: 1080 },
];

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForServer() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/health`, {
        signal: AbortSignal.timeout(1500),
      });
      if (response.ok) return;
    } catch (err) {
      // The server can still be establishing its database connection.
    }
    await delay(250);
  }
  throw new Error('Responsive test server did not become ready.');
}

async function auditPage(page, route, viewport, { label = route, prepare } = {}) {
  await page.setViewport(viewport);
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle0' });
  if (prepare) await prepare(page);
  await page.waitForFunction(() => (
    !document.querySelector('#page-loader')?.classList.contains('active')
  ));
  await delay(250);

  const metrics = await page.evaluate(() => {
    const root = document.documentElement;
    const viewportWidth = root.clientWidth;
    const excluded = [
      '.stepper-track',
      '.dashboard-preview-stage',
      '.dashboard-preview-shell',
      '.preview-stage',
      '.preview-page-shell',
      '.final-preview-stage',
      '.final-preview-page-shell',
      'iframe',
    ].join(',');

    function isVisible(element) {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && Number(style.opacity) !== 0
        && rect.width > 0
        && rect.height > 0;
    }

    function hasScrollableAncestor(element) {
      let current = element.parentElement;
      while (current && current !== document.body) {
        const style = getComputedStyle(current);
        if (['auto', 'scroll'].includes(style.overflowX) && current.scrollWidth > current.clientWidth) {
          return true;
        }
        current = current.parentElement;
      }
      return false;
    }

    const offscreen = Array.from(document.body.querySelectorAll('*'))
      .filter(element => isVisible(element))
      .filter(element => !element.matches(excluded) && !element.closest(excluded))
      .filter(element => !hasScrollableAncestor(element))
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.left < -2 || rect.right > viewportWidth + 2;
      })
      .slice(0, 12)
      .map(element => ({
        tag: element.tagName.toLowerCase(),
        id: element.id,
        className: typeof element.className === 'string' ? element.className : '',
        left: Math.round(element.getBoundingClientRect().left),
        right: Math.round(element.getBoundingClientRect().right),
      }));

    const smallTouchTargets = Array.from(document.querySelectorAll('button, a, input, select, textarea'))
      .filter(element => isVisible(element) && !element.closest('.stepper-track'))
      .filter(element => (
        !['checkbox', 'radio'].includes(String(element.type || '').toLowerCase())
        || !element.closest('.check-row, label')
      ))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          id: element.id,
          className: typeof element.className === 'string' ? element.className : '',
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      })
      .filter(target => target.width < 36 || target.height < 36)
      .slice(0, 12);

    const profileName = document.querySelector('.profile-copy h2');
    const profileNameClipped = Boolean(profileName)
      && (
        profileName.scrollWidth > profileName.clientWidth + 1
        || profileName.scrollHeight > profileName.clientHeight + 1
      );

    return {
      title: document.title,
      viewportWidth,
      documentWidth: root.scrollWidth,
      horizontalOverflow: root.scrollWidth > viewportWidth + 1,
      offscreen,
      smallTouchTargets,
      profileNameClipped,
    };
  });

  const safeRoute = label.replace(/[/?=&]+/g, '-').replace(/^-|-$/g, '') || 'home';
  const screenshotPath = path.join(outputDir, `${safeRoute}-${viewport.name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  return { route, viewport: viewport.name, screenshotPath, ...metrics };
}

async function auditDynamicTextarea(page, resumeId, {
  section,
  listSelector,
  inputSelector,
  descriptionSelector = '',
}) {
  const phoneViewport = viewports.find(viewport => viewport.name === 'phone-390');
  await page.setViewport(phoneViewport);
  await page.goto(`${baseUrl}/builder?id=${resumeId}&section=${section}`, { waitUntil: 'networkidle0' });
  await page.waitForSelector(`${listSelector} .entry-card .add-bullet-btn`);

  if (descriptionSelector) {
    const descriptionTag = await page.$eval(descriptionSelector, element => element.tagName);
    if (descriptionTag !== 'TEXTAREA') {
      throw new Error(`${section} short description must render as a textarea.`);
    }
  }

  const initialCount = await page.$$eval(inputSelector, fields => fields.length);
  await page.click(`${listSelector} .entry-card .add-bullet-btn`);
  await page.waitForFunction(
    (selector, count) => document.querySelectorAll(selector).length === count + 1,
    {},
    inputSelector,
    initialCount
  );

  const measureLast = selector => page.$$eval(selector, (fields) => {
    const field = fields[fields.length - 1];
    const rect = field.getBoundingClientRect();
    return {
      height: Math.round(rect.height),
      overflowY: getComputedStyle(field).overflowY,
    };
  });

  const immediate = await measureLast(inputSelector);
  await delay(100);
  const settled = await measureLast(inputSelector);
  await page.$$eval(inputSelector, (fields) => fields[fields.length - 1].focus());
  await page.keyboard.type(
    'Implemented a responsive workflow and reduced repeated manual processing across the team.'
  );
  const typed = await measureLast(inputSelector);

  if (Math.abs(immediate.height - settled.height) > 2) {
    throw new Error(`${section} bullet height shifted after insertion (${immediate.height}px to ${settled.height}px).`);
  }
  if (typed.height + 1 < settled.height) {
    throw new Error(`${section} bullet shrank after typing (${settled.height}px to ${typed.height}px).`);
  }
  if (settled.height > 52 || typed.height > 120) {
    throw new Error(`${section} bullet height exceeded its compact limits (${settled.height}px / ${typed.height}px).`);
  }
}

async function auditEmptyEntryStates(page, resumeId) {
  const states = [
    { section: 'education', selector: '#edu-list', copy: 'No education entries added.' },
    { section: 'experience', selector: '#exp-list', copy: 'No work experience entries added.' },
    { section: 'projects', selector: '#proj-list', copy: 'No project entries added.' },
    { section: 'extracurricular', selector: '#extra-list', copy: 'No activity entries added.' },
    { section: 'achievements', selector: '#ach-list', copy: 'No achievement entries added.' },
    { section: 'certifications', selector: '#cert-list', copy: 'No certification entries added.' },
    { section: 'references', selector: '#ref-list', copy: 'No reference entries added.' },
  ];

  const phoneViewport = viewports.find(viewport => viewport.name === 'phone-360');
  await page.setViewport(phoneViewport);

  for (const state of states) {
    await page.goto(
      `${baseUrl}/builder?id=${resumeId}&section=${state.section}`,
      { waitUntil: 'networkidle0' }
    );
    await page.waitForSelector(state.selector);
    await page.waitForFunction(() => (
      !document.querySelector('#page-loader')?.classList.contains('active')
    ));
    const copy = await page.$eval(state.selector, (element) => (
      getComputedStyle(element, '::before').content.replace(/^["']|["']$/g, '')
    ));
    if (copy !== state.copy) {
      throw new Error(
        `${state.section} empty state is "${copy || 'missing'}"; expected "${state.copy}".`
      );
    }
    if (state.section === 'references') {
      await page.screenshot({
        path: path.join(outputDir, 'empty-references-phone-360.png'),
        fullPage: true,
      });
    }
  }
}

async function run() {
  fs.mkdirSync(outputDir, { recursive: true });
  await waitForServer();

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(20000);

  const browserErrors = [];
  page.on('pageerror', error => browserErrors.push(error.message));

  const results = [];
  try {
    for (const viewport of viewports) {
      results.push(await auditPage(page, '/login', viewport));
      results.push(await auditPage(page, '/register', viewport));
    }

    await page.goto(`${baseUrl}/register`, { waitUntil: 'networkidle0' });
    const registration = await page.evaluate(async ({ accountEmail, accountPassword }) => {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: 'Responsive',
          lastName: 'Test',
          email: accountEmail,
          phone: '0123456789',
          address: '40000, Selangor, Malaysia',
          password: accountPassword,
          confirmPassword: accountPassword,
        }),
      });
      return { status: response.status, body: await response.json() };
    }, { accountEmail: email, accountPassword: password });

    if (registration.status !== 201 || registration.body.success !== true) {
      throw new Error(`Responsive test registration failed with ${registration.status}.`);
    }

    const resume = await page.evaluate(async () => {
      const response = await fetch('/api/dashboard', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Responsive Test Resume' }),
      });
      return response.json();
    });
    if (!resume.success || !resume.data?.id) {
      throw new Error('Responsive test resume could not be created.');
    }

    await auditEmptyEntryStates(page, resume.data.id);

    const sectionFixtures = {
      personal: {
        fullName: 'MUHAMMAD ZIKRI BIN KASHIM ABDULLAH',
        jobTitle: 'Internship - Software Development and Technical Operations',
        email: 'muhammad.zikri.bin.kashim.abdullah@example-company.com',
        phone: '012-345 6789',
        linkedin: 'linkedin.com/in/muhammad-zikri-bin-kashim-abdullah',
        locationCountry: 'Malaysia',
        locationState: 'Melaka',
        postcode: '75350',
      },
      summary: 'Operations-focused professional with experience coordinating teams, improving processes, and delivering measurable outcomes.',
      education: [{
        degree: 'Bachelor of Business Administration',
        institution: 'University of Malaya',
        institutionCountry: 'Malaysia',
        location: 'Kuala Lumpur',
        startDate: '2020-01',
        endDate: '2024-01',
        cgpa: '3.75',
        academicResultType: 'cgpa',
      }],
      experience: [{
        jobTitle: 'Operations Executive',
        company: 'Zeeke Holdings',
        employmentType: 'Full-time',
        locationCountry: 'Malaysia',
        location: 'Selangor',
        startDate: '2024-02',
        endDate: '',
        isCurrent: true,
        bullets: ['Coordinated cross-functional delivery across three business units.'],
      }],
      projects: [{
        type: 'Business Improvement',
        title: 'Operations Reporting Dashboard',
        description: 'Consolidated weekly reporting for management review.',
        bullets: ['Reduced manual reporting time by 30 percent.'],
      }],
      extracurricular: [{
        organization: 'Graduate Business Society',
        role: 'Committee Member',
        bullets: ['Organized professional development sessions for 120 students.'],
      }],
      skills: {
        interpersonal: 'Stakeholder management, communication',
        software: 'Microsoft Excel, PowerPoint',
        technical: 'Process mapping, reporting',
        language: 'English, Bahasa Malaysia',
        custom: [{ label: 'Industry', value: 'Business operations' }],
      },
      achievements: ['Recognized for process improvement and service quality.'],
      certifications: ['Certified Associate in Project Management, 2025'],
      references: [{
        name: 'Amina Rahman',
        position: 'Operations Manager',
        email: 'amina.rahman@example.com',
        phone: '0123456789',
        phoneCountry: 'Malaysia',
      }],
    };

    const fixtureResult = await page.evaluate(async ({ resumeId, fixtures }) => {
      const responses = await Promise.all(Object.entries(fixtures).map(async ([section, data]) => {
        const response = await fetch(`/api/resume/${resumeId}/section`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ section, data }),
        });
        return response.ok;
      }));
      return responses.every(Boolean);
    }, { resumeId: resume.data.id, fixtures: sectionFixtures });
    if (!fixtureResult) throw new Error('Responsive section fixtures could not be saved.');

    const photoResult = await page.evaluate(async (resumeId) => {
      const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
      const bytes = Uint8Array.from(atob(base64), character => character.charCodeAt(0));
      const form = new FormData();
      form.append('photo', new Blob([bytes], { type: 'image/png' }), 'responsive-test.png');
      const response = await fetch(`/api/resume/${resumeId}/photo`, {
        method: 'POST',
        credentials: 'same-origin',
        body: form,
      });
      return response.ok;
    }, resume.data.id);
    if (!photoResult) throw new Error('Responsive profile-photo fixture could not be saved.');

    await auditDynamicTextarea(page, resume.data.id, {
      section: 'experience',
      listSelector: '#exp-list',
      inputSelector: '.exp-bullet-input',
    });
    await auditDynamicTextarea(page, resume.data.id, {
      section: 'projects',
      listSelector: '#proj-list',
      inputSelector: '.proj-bullet-input',
      descriptionSelector: '.proj-desc',
    });

    for (const viewport of viewports) {
      results.push(await auditPage(page, '/dashboard', viewport));
      results.push(await auditPage(page, `/builder?id=${resume.data.id}`, viewport));
    }

    const detailedViewports = viewports.filter(viewport => (
      viewport.name === 'phone-320' || viewport.name === 'laptop-1366'
    ));
    for (const section of Object.keys(sectionFixtures)) {
      for (const viewport of detailedViewports) {
        results.push(await auditPage(
          page,
          `/builder?id=${resume.data.id}&section=${section}`,
          viewport
        ));
      }
    }

    for (const viewport of detailedViewports) {
      results.push(await auditPage(
        page,
        `/builder?id=${resume.data.id}&section=references`,
        viewport,
        {
          label: '/builder-final',
          prepare: async currentPage => currentPage.evaluate(() => App.showFinalScreen()),
        }
      ));
    }
  } finally {
    await browser.close();
  }

  const failures = results.filter(result => (
    result.horizontalOverflow || result.offscreen.length || result.profileNameClipped
  ));
  const touchWarnings = results
    .filter(result => result.viewport.startsWith('phone') || result.viewport.startsWith('tablet'))
    .filter(result => result.smallTouchTargets.length);

  if (browserErrors.length) {
    throw new Error(`Browser errors: ${[...new Set(browserErrors)].join(' | ')}`);
  }
  if (failures.length) {
    const details = failures.map(result => (
      `${result.route} at ${result.viewport}: document ${result.documentWidth}px / viewport ${result.viewportWidth}px; `
      + `offscreen ${JSON.stringify(result.offscreen)}; profile name clipped ${result.profileNameClipped}`
    ));
    throw new Error(`Responsive overflow detected:\n${details.join('\n')}`);
  }
  if (touchWarnings.length) {
    const details = touchWarnings.map(result => (
      `${result.route} at ${result.viewport}: ${JSON.stringify(result.smallTouchTargets)}`
    ));
    throw new Error(`Touch targets smaller than 36px detected:\n${details.join('\n')}`);
  }

  console.log(`Responsive smoke test passed (${results.length} page/viewport checks).`);
  console.log(`Screenshots: ${outputDir}`);
}

run()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.execute('DELETE FROM users WHERE email = ?', [email]).catch(() => {});
    await new Promise(resolve => app.server.close(resolve));
    await pdfService.close();
    await db.end();
  });
