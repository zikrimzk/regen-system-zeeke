const puppeteer = require('puppeteer');
const { sanitizeResumeData } = require('../utils/sanitizeResume');

function positiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const PDF_CONCURRENCY = positiveInt(process.env.PDF_CONCURRENCY, 3);
const PDF_QUEUE_LIMIT = positiveInt(process.env.PDF_QUEUE_LIMIT, 50);
let browserPromise = null;
let activeJobs = 0;
const waitingJobs = [];

/** HTML-escape helper */
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

/**
 * Format a YYYY-MM date string to "Month YYYY".
 * Accepts plain text too (returned as-is).
 */
function fmtDate(val) {
  if (!val) return '';
  const m = String(val).match(/^(\d{4})-(\d{2})$/);
  if (!m) return val;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const mon = months[parseInt(m[2]) - 1] || '';
  return `${mon} ${m[1]}`;
}

function dateRange(start, end) {
  const s = fmtDate(start);
  const e = fmtDate(end);
  if (!s && !e) return '';
  if (!e)       return s;
  return `${s} - ${e}`;
}

function inferAcademicResultType(value, explicitType = '') {
  const cleaned = String(value || '').trim();
  if (!cleaned) return '';
  if (explicitType === 'cgpa' || explicitType === 'grade') return explicitType;
  // If purely numbers and decimals (with optional spaces/slashes for something like 4.0 / 4.0), it's CGPA
  if (/^[0-9]+(?:\.[0-9]+)?(?:\s*\/\s*[0-9]+(?:\.[0-9]+)?)?$/.test(cleaned)) return 'cgpa';
  // Anything else with letters or symbols is considered Grade
  return 'grade';
}

function academicResultLabel(entry) {
  const value = entry?.cgpa || '';
  if (!value) return '';
  return inferAcademicResultType(value, entry?.academicResultType) === 'grade' ? 'Grade' : 'CGPA';
}

function skillRows(sk = {}) {
  const rows = [
    ['Interpersonal', sk.interpersonal],
    ['Software', sk.software],
    ['Technical', sk.technical],
    ['Language', sk.language],
  ];
  (Array.isArray(sk.custom) ? sk.custom : []).forEach(item => {
    if (item?.label || item?.value) rows.push([item.label || 'Other', item.value || '']);
  });
  return rows.filter(row => row[1]);
}

/** Bullet list */
function bulletList(items) {
  if (!items || items.length === 0) return '';
  return `<ul class="bullets">${items.map(b => `<li>${esc(b).replace(/\n/g, '<br>')}</li>`).join('')}</ul>`;
}

/** Section header with rule */
function sectionHeader(title) {
  return `<div class="sec-hdr"><span>${title}</span><hr /></div>`;
}

/**
 * Build the full resume HTML string.
 */
function buildHtml(resume) {
  resume = sanitizeResumeData(resume);
  const p = resume.personal || {};
  const hasPhoto = !!p.photoBase64;

  /* ── HEADER ─────────────────────────────────────────────── */
  const header = `
    <div class="cv-header">
      ${hasPhoto ? `<img class="cv-photo" src="${p.photoBase64}" alt="Photo" />` : ''}
      <div class="cv-header-info">
        <div class="cv-name">${esc(p.fullName) || 'Your Name'}</div>
        ${p.jobTitle ? `<div class="cv-title">${esc(p.jobTitle)}</div>` : ''}
        <div class="cv-contacts">
          ${p.phone    ? `<div class="cv-contact-row"><span class="cv-cl">Phone Number</span><span class="cv-cs">:</span><span class="cv-cv">${esc(p.phone)}</span></div>` : ''}
          ${p.email    ? `<div class="cv-contact-row"><span class="cv-cl">Email</span><span class="cv-cs">:</span><span class="cv-cv">${esc(p.email)}</span></div>` : ''}
          ${p.linkedin ? `<div class="cv-contact-row"><span class="cv-cl">LinkedIn</span><span class="cv-cs">:</span><span class="cv-cv">${esc(p.linkedin)}</span></div>` : ''}
          ${p.address  ? `<div class="cv-contact-row"><span class="cv-cl">Location</span><span class="cv-cs">:</span><span class="cv-cv">${esc(p.address)}</span></div>` : ''}
        </div>
      </div>
    </div>`;

  /* ── SUMMARY ─────────────────────────────────────────────── */
  const summary = resume.summary ? `
    ${sectionHeader('SUMMARY')}
    <p class="cv-summary">${esc(resume.summary).replace(/\n/g, '<br>')}</p>` : '';

  /* ── EDUCATION ───────────────────────────────────────────── */
  const education = resume.education && resume.education.length ? `
    ${sectionHeader('EDUCATION')}
    ${resume.education.map(e => `
      <div class="cv-entry">
        <div class="cv-entry-row">
          <div class="cv-entry-left"><strong>${esc(e.degree)}</strong></div>
          <div class="cv-entry-date">${esc(dateRange(e.startDate, e.endDate))}</div>
        </div>
        <div class="cv-entry-sub">${esc(e.institution)}${e.location ? ', ' + esc(e.location) : ''}</div>
        ${e.cgpa ? `<div class="cv-entry-detail">${academicResultLabel(e)}: ${esc(e.cgpa)}</div>` : ''}
      </div>`).join('')}` : '';

  /* ── WORK EXPERIENCE ─────────────────────────────────────── */
  const experience = resume.experience && resume.experience.length ? `
    ${sectionHeader('WORK EXPERIENCE')}
    ${resume.experience.map(e => `
      <div class="cv-entry">
        <div class="cv-entry-row">
          <div class="cv-entry-left"><strong>${esc(e.jobTitle)}</strong></div>
          <div class="cv-entry-date">${esc(dateRange(e.startDate, e.endDate))}</div>
        </div>
        <div class="cv-entry-sub">${esc(e.company)}${e.employmentType ? ' - ' + esc(e.employmentType) : ''}${e.location ? ', ' + esc(e.location) : ''}</div>
        ${bulletList(e.bullets)}
      </div>`).join('')}` : '';

  /* ── ACADEMIC PROJECTS ───────────────────────────────────── */
  const projects = resume.projects && resume.projects.length ? `
    ${sectionHeader('ACADEMIC PROJECTS')}
    ${resume.projects.map(p => `
      <div class="cv-entry">
        ${p.type ? `<div class="cv-entry-type">${esc(p.type)}</div>` : ''}
        <strong>Title: ${esc(p.title)}</strong>
        ${p.description ? `<div class="cv-entry-sub italic">${esc(p.description)}</div>` : ''}
        ${bulletList(p.bullets)}
      </div>`).join('')}` : '';

  /* ── EXTRACURRICULAR ─────────────────────────────────────── */
  const extra = resume.extracurricular && resume.extracurricular.length ? `
    ${sectionHeader('EXTRACURRICULAR ACTIVITIES')}
    ${resume.extracurricular.map(a => `
      <div class="cv-entry">
        <div class="cv-entry-row">
          <div class="cv-entry-left">
            <strong>${esc(a.organization)}</strong>${a.role ? ` - <em>${esc(a.role)}</em>` : ''}
          </div>
        </div>
        ${bulletList(a.bullets)}
      </div>`).join('')}` : '';

  /* ── SKILLS ──────────────────────────────────────────────── */
  const sk = resume.skills || {};
  const skRows = skillRows(sk);
  const hasSkills = skRows.length > 0;
  const skills = hasSkills ? `
    ${sectionHeader('SKILLS')}
    <div class="cv-skills">
      ${skRows.map(([label, value]) => `<div class="cv-skill-row"><span class="cv-sk-label">${esc(label)}</span><span class="cv-sk-sep">:</span><span class="cv-sk-val">${esc(value)}</span></div>`).join('')}
    </div>` : '';

  /* ── ACHIEVEMENT ─────────────────────────────────────────── */
  const achievements = resume.achievements && resume.achievements.length ? `
    ${sectionHeader('ACHIEVEMENT')}
    ${bulletList(resume.achievements)}` : '';

  /* ── LICENSE & CERTIFICATIONS ────────────────────────────── */
  const certs = resume.certifications && resume.certifications.length ? `
    ${sectionHeader('LICENSE & CERTIFICATION')}
    ${bulletList(resume.certifications)}` : '';

  /* ── REFERENCES ──────────────────────────────────────────── */
  const refs = resume.references && resume.references.length ? `
    ${sectionHeader('REFERENCES')}
    <div class="cv-refs">
      ${resume.references.map(r => `
        <div class="cv-ref-card">
          <div class="cv-ref-name">${esc(r.name || 'Reference')}</div>
          ${r.position ? `<div class="cv-ref-pos">${esc(r.position)}</div>` : ''}
          ${r.email ? `<div class="cv-ref-contact">${esc(r.email)}</div>` : ''}
          ${r.phone ? `<div class="cv-ref-contact">${esc(r.phone)}</div>` : ''}
        </div>`).join('')}
    </div>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=800">
<title>Resume</title>
<script>
  function scaleFit() {
    var w = window.innerWidth;
    var scale = w / 800;
    if (scale < 1) {
      document.body.style.transform = 'scale(' + scale + ')';
      document.body.style.transformOrigin = 'top left';
      document.body.style.width = '800px';
    } else {
      document.body.style.transform = 'none';
    }
  }
  window.addEventListener('resize', scaleFit);
  window.addEventListener('DOMContentLoaded', scaleFit);
</script>
<style>
  @page {
    size: A4;
    margin: 18mm 18mm 16mm 18mm;
  }

  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 10.8pt;
    color: #000;
    background: #fff;
    padding: 18mm 18mm 16mm 18mm;
    line-height: 1.42;
    width: 800px;
    margin: 0 auto;
    overflow-x: hidden;
  }

  @media print {
    html, body {
      width: auto;
      min-height: 0;
      margin: 0;
      padding: 0;
      overflow: visible;
      transform: none !important;
    }
  }

  /* ── Header ── */
  .cv-header {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    margin-bottom: 14px;
    position: relative;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .cv-photo {
    width: 88px;
    height: 115px;
    object-fit: cover;
    object-position: center top;
    border: 1px solid #555;
    flex-shrink: 0;
    order: 2;
    margin-left: auto;
  }
  .cv-header-info { flex: 1; order: 1; }
  .cv-name  { font-size: 19pt; font-weight: 700; margin-bottom: 3px; }
  .cv-title { font-size: 11.5pt; font-weight: 700; margin-bottom: 8px; }
  .cv-contacts { margin-top: 6px; }
  .cv-contact-row { display: flex; font-size: 10.5pt; line-height: 1.55; }
  .cv-cl { min-width: 90px; }
  .cv-cs { min-width: 22px; text-align:center; }
  .cv-cv { flex: 1; word-break: break-word; }

  /* ── Section Headers ── */
  .sec-hdr {
    margin: 12px 0 4px;
    break-after: avoid;
    page-break-after: avoid;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .sec-hdr span { font-size: 11pt; font-weight: 700; letter-spacing: 0; }
  .sec-hdr hr { border: none; border-top: 1px solid #000; margin: 2px 0 0; }

  /* ── Entries ── */
  .cv-entry {
    margin-bottom: 9px;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .cv-entry-row { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
  .cv-entry-left { flex: 1; }
  .cv-entry-date { font-weight: 700; font-size: 10pt; white-space: nowrap; }
  .cv-entry-sub  { font-size: 10.5pt; margin-top: 1px; }
  .cv-entry-type { font-weight: bold; font-size: 10.5pt; }
  .cv-entry-detail { font-size: 10.5pt; color: #222; }
  .italic { font-style: italic; }

  /* ── Bullets ── */
  .bullets {
    margin: 4px 0 0 18px;
    font-size: 10.5pt;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .bullets li {
    margin-bottom: 2px;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  /* ── Summary ── */
  .cv-summary {
    font-size: 10.8pt;
    line-height: 1.48;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  /* ── Skills ── */
  .cv-skills {
    display:flex;
    flex-direction:column;
    gap:2px;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .cv-skill-row { display:flex; font-size:11pt; break-inside: avoid; page-break-inside: avoid; }
  .cv-sk-label { font-weight:bold; min-width:115px; }
  .cv-sk-sep   { min-width:22px; text-align:center; }
  .cv-sk-val   { flex:1; }

  /* ── References ── */
  .cv-refs { display:flex; flex-wrap:wrap; gap:20px; break-inside: avoid; page-break-inside: avoid; }
  .cv-ref-card { flex:1; min-width:160px; break-inside: avoid; page-break-inside: avoid; }
  .cv-ref-name { font-weight:bold; font-size:11pt; text-transform:uppercase; }
  .cv-ref-pos  { font-size:10.5pt; }
  .cv-ref-contact { font-size:10.5pt; }
</style>
</head>
<body>
${header}
${summary}
${education}
${experience}
${projects}
${extra}
${skills}
${achievements}
${certs}
${refs}
</body>
</html>`;
}

/**
 * Generate PDF buffer using Puppeteer.
 */
async function getBrowser() {
  if (browserPromise) return browserPromise;
  browserPromise = puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--font-render-hinting=none',
    ],
  }).then((browser) => {
    browser.once('disconnected', () => {
      browserPromise = null;
    });
    return browser;
  }).catch((err) => {
    browserPromise = null;
    throw err;
  });
  return browserPromise;
}

function acquirePdfSlot() {
  if (activeJobs < PDF_CONCURRENCY) {
    activeJobs += 1;
    return Promise.resolve(releasePdfSlot);
  }
  if (waitingJobs.length >= PDF_QUEUE_LIMIT) {
    const error = new Error('PDF service is busy.');
    error.code = 'PDF_BUSY';
    return Promise.reject(error);
  }
  return new Promise(resolve => waitingJobs.push(resolve));
}

function releasePdfSlot() {
  const next = waitingJobs.shift();
  if (next) next(releasePdfSlot);
  else activeJobs = Math.max(0, activeJobs - 1);
}

async function generate(resume) {
  const release = await acquirePdfSlot();
  const html = buildHtml(resume);
  let page;

  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    page.setDefaultTimeout(15000);
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => document.fonts?.ready);

    const pdfBuffer = await page.pdf({
      format:          'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' },
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await page?.close().catch(() => {});
    release();
  }
}

async function close() {
  const pendingBrowser = browserPromise;
  browserPromise = null;
  if (!pendingBrowser) return;
  const browser = await pendingBrowser.catch(() => null);
  await browser?.close().catch(() => {});
}

module.exports = { generate, buildHtml, close };
