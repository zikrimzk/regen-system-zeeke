const pdfService  = require('../services/pdfService');
const resumeDbModel = require('../models/resumeDbModel');
const { sanitizeResumeData } = require('../utils/sanitizeResume');

function parseResumeId(raw) {
  const id = Number.parseInt(raw, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function downloadName(value, fallback = 'Resume') {
  const safe = String(value || fallback)
    .replace(/[^a-z0-9_\- ]/gi, '')
    .trim()
    .replace(/\s+/g, '_');
  return safe || fallback;
}

async function _getResume(req, res) {
  const resumeId = parseResumeId(req.params.id);
  if (!resumeId) {
    res.status(400).json({ success: false, message: 'Invalid resume ID.' });
    return null;
  }
  const row = await resumeDbModel.getResumeById(resumeId, req.session.userId);
  if (!row) { res.status(404).json({ success: false, message: 'Resume not found.' }); return null; }
  return row;
}

/**
 * GET /api/pdf/:id/generate — Download PDF
 */
async function generatePdf(req, res) {
  try {
    const row = await _getResume(req, res);
    if (!row) return;
    const resume = sanitizeResumeData(row.resume_data);

    const pdfBuffer = await pdfService.generate(resume);
    const safeName  = downloadName(resume.personal?.fullName || row.title);

    res.set({
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${safeName}_Resume.pdf"`,
    });
    res.send(pdfBuffer);
  } catch (err) {
    console.error('[PDF Gen Error]', err);
    if (err.code === 'PDF_BUSY') {
      res.set('Retry-After', '5');
      return res.status(503).json({ success: false, message: 'PDF service is busy. Please try again shortly.' });
    }
    res.status(500).json({ success: false, message: 'PDF generation failed. Please try again.' });
  }
}

/**
 * GET /api/pdf/:id/preview — Preview as HTML in iframe
 */
async function previewHtml(req, res) {
  try {
    const row = await _getResume(req, res);
    if (!row) return;
    const html = pdfService.buildHtml(row.resume_data);
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    console.error('[Preview Error]', err);
    res.status(500).send('<p>Preview failed.</p>');
  }
}

async function previewDraftHtml(req, res) {
  try {
    const row = await _getResume(req, res);
    if (!row) return;

    const incoming = req.body?.resumeData;
    if (!incoming || typeof incoming !== 'object') {
      return res.status(400).send('<p>Preview data is invalid.</p>');
    }

    const merged = {
      ...(row.resume_data || {}),
      ...incoming,
      personal: {
        ...(row.resume_data?.personal || {}),
        ...(incoming.personal || {}),
      },
    };

    const html = pdfService.buildHtml(merged);
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    console.error('[Draft Preview Error]', err);
    res.status(500).send('<p>Preview failed.</p>');
  }
}

module.exports = { generatePdf, previewHtml, previewDraftHtml };
