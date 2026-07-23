const {
  Document, Packer, Paragraph, TextRun, ImageRun,
  HeadingLevel, AlignmentType, BorderStyle,
  Table, TableRow, TableCell, WidthType,
  VerticalAlign, ShadingType, convertInchesToTwip,
  UnderlineType, PageBreak,
} = require('docx');
const fs = require('fs');

/** Format YYYY-MM to "Mon YYYY" */
function fmtDate(val) {
  if (!val) return '';
  const m = String(val).match(/^(\d{4})-(\d{2})$/);
  if (!m) return val;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m[2]) - 1] || ''} ${m[1]}`;
}
function dateRange(s, e) {
  const a = fmtDate(s), b = fmtDate(e);
  if (!a && !b) return '';
  if (!b) return a;
  return `${a} – ${b}`;
}

function inferAcademicResultType(value, explicitType = '') {
  const cleaned = String(value || '').trim();
  if (!cleaned) return '';
  if (explicitType === 'cgpa' || explicitType === 'grade') return explicitType;
  if (/^[0-9]+(?:\.[0-9]+)?(?:\s*\/\s*[0-9]+(?:\.[0-9]+)?)?$/.test(cleaned)) return 'cgpa';
  return /[a-z]/i.test(cleaned) ? 'grade' : 'grade';
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

const FONT    = 'Times New Roman';
const SZ_SM   = 20; // 10pt
const SZ_BODY = 22; // 11pt
const SZ_HEAD = 24; // 12pt
const SZ_NAME = 40; // 20pt

/** Plain text run */
function txt(text, opts = {}) {
  return new TextRun({ text: String(text || ''), font: FONT, size: SZ_BODY, ...opts });
}

/** Bold run */
function bold(text, size = SZ_BODY) {
  return new TextRun({ text: String(text || ''), font: FONT, size, bold: true });
}

/** Section header paragraph */
function sectionHeader(label) {
  return new Paragraph({
    spacing: { before: 140, after: 40 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: '000000' } },
    children: [bold(label, SZ_HEAD)],
  });
}

/** Horizontal rule paragraph */
function hr() {
  return new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000' } },
    children: [],
    spacing: { before: 0, after: 40 },
  });
}

/** Entry row: title left, date right using a 2-col table */
function entryRow(titleRuns, dateText) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top:    { style: BorderStyle.NONE, size: 0 },
      bottom: { style: BorderStyle.NONE, size: 0 },
      left:   { style: BorderStyle.NONE, size: 0 },
      right:  { style: BorderStyle.NONE, size: 0 },
      insideH:{ style: BorderStyle.NONE, size: 0 },
      insideV:{ style: BorderStyle.NONE, size: 0 },
    },
    rows: [new TableRow({
      children: [
        new TableCell({
          width: { size: 75, type: WidthType.PERCENTAGE },
          borders: { top:{style:BorderStyle.NONE,size:0}, bottom:{style:BorderStyle.NONE,size:0}, left:{style:BorderStyle.NONE,size:0}, right:{style:BorderStyle.NONE,size:0} },
          children: [new Paragraph({ children: titleRuns })],
        }),
        new TableCell({
          width: { size: 25, type: WidthType.PERCENTAGE },
          borders: { top:{style:BorderStyle.NONE,size:0}, bottom:{style:BorderStyle.NONE,size:0}, left:{style:BorderStyle.NONE,size:0}, right:{style:BorderStyle.NONE,size:0} },
          children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [bold(dateText)] })],
        }),
      ],
    })],
  });
}

/** Bullet paragraph */
function bullet(text) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { before: 20, after: 20 },
    children: [txt(text)],
  });
}

function buildPhotoImageRun(photoBase64) {
  if (!photoBase64 || typeof photoBase64 !== 'string') return null;

  const match = photoBase64.match(/^data:image\/(png|jpe?g);base64,([a-z0-9+/=\r\n]+)$/i);
  if (!match) return null;

  const type = match[1].toLowerCase() === 'png' ? 'png' : 'jpg';
  const data = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
  if (!data.length) return null;

  return new ImageRun({
    data,
    transformation: { width: 70, height: 90 },
    type,
  });
}

/**
 * Build a docx Document from resume data.
 */
async function buildDocument(resume) {
  const p = resume.personal || {};
  const sections = [];

  /* ── HEADER ─────────────────────────────────────────────── */
  // Name + photo in a table (photo right, info left)
  const photoImg = buildPhotoImageRun(p.photoBase64);
  const hasPhoto = !!photoImg;

  const headerInfoParagraphs = [
    new Paragraph({ children: [bold(p.fullName || 'Your Name', SZ_NAME)], spacing: { after: 40 } }),
    ...(p.jobTitle ? [new Paragraph({ children: [bold(p.jobTitle, SZ_HEAD)], spacing: { after: 60 } })] : []),
    ...(p.phone    ? [new Paragraph({ children: [txt('Phone Number'), txt('  :  '), txt(p.phone)], spacing: { after: 20 } })] : []),
    ...(p.email    ? [new Paragraph({ children: [txt('Email'), txt('  :  '), txt(p.email)], spacing: { after: 20 } })] : []),
    ...(p.linkedin ? [new Paragraph({ children: [txt('LinkedIn'), txt('  :  '), txt(p.linkedin)], spacing: { after: 20 } })] : []),
    ...(p.address  ? [new Paragraph({ children: [txt('Location'), txt('  :  '), txt(p.address)], spacing: { after: 20 } })] : []),
  ];

  if (hasPhoto && photoImg) {
    const headerTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top:{style:BorderStyle.NONE,size:0}, bottom:{style:BorderStyle.NONE,size:0},
        left:{style:BorderStyle.NONE,size:0}, right:{style:BorderStyle.NONE,size:0},
        insideH:{style:BorderStyle.NONE,size:0}, insideV:{style:BorderStyle.NONE,size:0},
      },
      rows: [new TableRow({
        children: [
          new TableCell({
            width: { size: 80, type: WidthType.PERCENTAGE },
            borders: { top:{style:BorderStyle.NONE,size:0}, bottom:{style:BorderStyle.NONE,size:0}, left:{style:BorderStyle.NONE,size:0}, right:{style:BorderStyle.NONE,size:0} },
            children: headerInfoParagraphs,
          }),
          new TableCell({
            width: { size: 20, type: WidthType.PERCENTAGE },
            borders: { top:{style:BorderStyle.NONE,size:0}, bottom:{style:BorderStyle.NONE,size:0}, left:{style:BorderStyle.NONE,size:0}, right:{style:BorderStyle.NONE,size:0} },
            verticalAlign: VerticalAlign.TOP,
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [photoImg] })],
          }),
        ],
      })],
    });
    sections.push(headerTable);
  } else {
    sections.push(...headerInfoParagraphs);
  }

  /* ── SUMMARY ─────────────────────────────────────────────── */
  if (resume.summary) {
    sections.push(sectionHeader('SUMMARY'));
    sections.push(new Paragraph({
      children: [txt(resume.summary)],
      alignment: AlignmentType.JUSTIFIED,
      spacing: { before: 40, after: 60 },
    }));
  }

  /* ── EDUCATION ───────────────────────────────────────────── */
  if (resume.education && resume.education.length) {
    sections.push(sectionHeader('EDUCATION'));
    resume.education.forEach(e => {
      sections.push(entryRow([bold(e.degree)], dateRange(e.startDate, e.endDate)));
      sections.push(new Paragraph({ children: [txt(`${e.institution}${e.location ? ', ' + e.location : ''}`)], spacing: { after: 20 } }));
      if (e.cgpa) sections.push(new Paragraph({ children: [txt(`${academicResultLabel(e)}: ${e.cgpa}`)], spacing: { after: 60 } }));
    });
  }

  /* ── WORK EXPERIENCE ─────────────────────────────────────── */
  if (resume.experience && resume.experience.length) {
    sections.push(sectionHeader('WORK EXPERIENCE'));
    resume.experience.forEach(e => {
      sections.push(entryRow([bold(e.jobTitle)], dateRange(e.startDate, e.endDate)));
      sections.push(new Paragraph({ children: [txt(`${e.company}${e.employmentType ? ' - ' + e.employmentType : ''}${e.location ? ', ' + e.location : ''}`)], spacing: { after: 20 } }));
      (e.bullets || []).forEach(b => sections.push(bullet(b)));
      sections.push(new Paragraph({ spacing: { after: 40 }, children: [] }));
    });
  }

  /* ── ACADEMIC PROJECTS ───────────────────────────────────── */
  if (resume.projects && resume.projects.length) {
    sections.push(sectionHeader('ACADEMIC PROJECTS'));
    resume.projects.forEach(pr => {
      if (pr.type) sections.push(new Paragraph({ children: [bold(pr.type)], spacing: { after: 20 } }));
      sections.push(new Paragraph({ children: [bold('Title: '), txt(pr.title)], spacing: { after: 20 } }));
      (pr.bullets || []).forEach(b => sections.push(bullet(b)));
      sections.push(new Paragraph({ spacing: { after: 40 }, children: [] }));
    });
  }

  /* ── EXTRACURRICULAR ─────────────────────────────────────── */
  if (resume.extracurricular && resume.extracurricular.length) {
    sections.push(sectionHeader('EXTRACURRICULAR ACTIVITIES'));
    resume.extracurricular.forEach(a => {
      sections.push(new Paragraph({
        children: [bold(a.organization), ...(a.role ? [txt(` - ${a.role}`)] : [])],
        spacing: { after: 20 },
      }));
      (a.bullets || []).forEach(b => sections.push(bullet(b)));
      sections.push(new Paragraph({ spacing: { after: 40 }, children: [] }));
    });
  }

  /* ── SKILLS ──────────────────────────────────────────────── */
  const sk = resume.skills || {};
  const skRows = skillRows(sk);
  const hasSkills = skRows.length > 0;
  if (hasSkills) {
    sections.push(sectionHeader('SKILLS'));
    skRows.forEach(([label, val]) => {
      sections.push(new Paragraph({
        children: [bold(label), txt('  :  '), txt(val)],
        spacing: { after: 20 },
      }));
    });
  }

  /* ── ACHIEVEMENT ─────────────────────────────────────────── */
  if (resume.achievements && resume.achievements.length) {
    sections.push(sectionHeader('ACHIEVEMENT'));
    resume.achievements.forEach(a => sections.push(bullet(a)));
  }

  /* ── LICENSE & CERTIFICATION ─────────────────────────────── */
  if (resume.certifications && resume.certifications.length) {
    sections.push(sectionHeader('LICENSE & CERTIFICATION'));
    resume.certifications.forEach(c => sections.push(bullet(c)));
  }

  /* ── REFERENCES ──────────────────────────────────────────── */
  if (resume.references && resume.references.length) {
    sections.push(sectionHeader('REFERENCES'));
    const refChunks = [];
    for (let i = 0; i < resume.references.length; i += 2) {
      refChunks.push(resume.references.slice(i, i + 2));
    }
    refChunks.forEach(pair => {
      const cells = pair.map(r => new TableCell({
        width: { size: 50, type: WidthType.PERCENTAGE },
        borders: { top:{style:BorderStyle.NONE,size:0}, bottom:{style:BorderStyle.NONE,size:0}, left:{style:BorderStyle.NONE,size:0}, right:{style:BorderStyle.NONE,size:0} },
        children: [
          new Paragraph({ children: [bold(r.name.toUpperCase())], spacing: { after: 20 } }),
          new Paragraph({ children: [txt(r.position)], spacing: { after: 20 } }),
          ...(r.email ? [new Paragraph({ children: [txt(r.email)], spacing: { after: 20 } })] : []),
          ...(r.phone ? [new Paragraph({ children: [txt(r.phone)], spacing: { after: 20 } })] : []),
        ],
      }));
      // Pad to 2 cells
      while (cells.length < 2) {
        cells.push(new TableCell({
          borders: { top:{style:BorderStyle.NONE,size:0}, bottom:{style:BorderStyle.NONE,size:0}, left:{style:BorderStyle.NONE,size:0}, right:{style:BorderStyle.NONE,size:0} },
          children: [new Paragraph({ children: [] })],
        }));
      }
      sections.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: { top:{style:BorderStyle.NONE,size:0}, bottom:{style:BorderStyle.NONE,size:0}, left:{style:BorderStyle.NONE,size:0}, right:{style:BorderStyle.NONE,size:0}, insideH:{style:BorderStyle.NONE,size:0}, insideV:{style:BorderStyle.NONE,size:0} },
        rows: [new TableRow({ children: cells })],
      }));
    });
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top:    convertInchesToTwip(1),
            bottom: convertInchesToTwip(1),
            left:   convertInchesToTwip(1),
            right:  convertInchesToTwip(1),
          },
        },
      },
      children: sections,
    }],
  });

  return doc;
}

/**
 * Generate a DOCX Buffer from resume data.
 */
async function generate(resume) {
  const doc = await buildDocument(resume);
  return Packer.toBuffer(doc);
}

module.exports = { generate };
