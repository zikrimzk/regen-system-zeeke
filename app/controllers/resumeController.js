const resumeDbModel   = require('../models/resumeDbModel');
const { sanitizeSection } = require('../utils/sanitizeResume');

const ALLOWED_SECTIONS = new Set([
  'personal', 'summary', 'education', 'experience', 'projects',
  'extracurricular', 'skills', 'achievements', 'certifications', 'references',
]);
function parseResumeId(raw) {
  const id = Number.parseInt(raw, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function isAllowedImage(buffer, mimetype) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return false;
  const header = buffer.subarray(0, 12);
  const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const isJpeg = header[0] === 0xff && header[1] === 0xd8 && mimetype === 'image/jpeg';
  const isPng = header.subarray(0, 8).equals(pngHeader) && mimetype === 'image/png';
  return isJpeg || isPng;
}

/**
 * GET /api/resume/:id
 * Returns resume data from DB.
 */
async function getResume(req, res) {
  const resumeId = parseResumeId(req.params.id);
  if (!resumeId) return res.status(400).json({ success: false, message: 'Invalid resume ID.' });
  try {
    const row = await resumeDbModel.getResumeById(resumeId, req.session.userId);
    if (!row) return res.status(404).json({ success: false, message: 'Resume not found.' });
    res.json({ success: true, data: row.resume_data, title: row.title });
  } catch (err) {
    console.error('[Resume Get Error]', err);
    res.status(500).json({ success: false, message: 'Failed to load resume.' });
  }
}

/**
 * POST /api/resume/:id/section
 * Saves a section to the DB resume.
 * Body: { section: string, data: any }
 */
async function saveSection(req, res) {
  const resumeId = parseResumeId(req.params.id);
  if (!resumeId) return res.status(400).json({ success: false, message: 'Invalid resume ID.' });
  const { section, data } = req.body;
  if (!ALLOWED_SECTIONS.has(section)) {
    return res.status(400).json({ success: false, message: 'Invalid section.' });
  }

  if (JSON.stringify(data || '').length > 6 * 1024 * 1024) {
    return res.status(413).json({ success: false, message: 'Resume section is too large.' });
  }

  try {
    const nextData = sanitizeSection(section, data);
    if (section === 'personal' && data && typeof data === 'object') {
      delete nextData.photoPath;
      delete nextData.photoBase64;
    }

    const ok = section === 'personal'
      ? await resumeDbModel.savePersonalSection(resumeId, req.session.userId, nextData)
      : await resumeDbModel.saveSection(resumeId, req.session.userId, section, nextData);
    if (!ok) return res.status(404).json({ success: false, message: 'Resume not found.' });
    res.json({ success: true });
  } catch (err) {
    console.error('[Resume Save Error]', err);
    res.status(500).json({ success: false, message: 'Failed to save section.' });
  }
}

/**
 * POST /api/resume/:id/photo
 * Handles photo upload — stores path and base64 in resume_data.
 */
async function uploadPhoto(req, res) {
  const resumeId = parseResumeId(req.params.id);
  if (!resumeId) return res.status(400).json({ success: false, message: 'Invalid resume ID.' });
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });

  try {
    if (!isAllowedImage(req.file.buffer, req.file.mimetype)) {
      return res.status(400).json({ success: false, message: 'Only valid JPG and PNG photos are accepted.' });
    }

    const row = await resumeDbModel.getResumeById(resumeId, req.session.userId);
    if (!row) return res.status(404).json({ success: false, message: 'Resume not found.' });

    const mimeType  = req.file.mimetype;
    const base64    = `data:${mimeType};base64,${req.file.buffer.toString('base64')}`;

    await resumeDbModel.updatePersonalPhoto(resumeId, req.session.userId, base64);
    res.json({ success: true, photoBase64: base64 });
  } catch (err) {
    console.error('[Photo Upload Error]', err);
    res.status(500).json({ success: false, message: 'Photo upload failed.' });
  }
}

/**
 * DELETE /api/resume/:id/photo
 * Removes photo from disk and DB.
 */
async function deletePhoto(req, res) {
  const resumeId = parseResumeId(req.params.id);
  if (!resumeId) return res.status(400).json({ success: false, message: 'Invalid resume ID.' });
  try {
    const row = await resumeDbModel.getResumeById(resumeId, req.session.userId);
    if (!row) return res.status(404).json({ success: false, message: 'Resume not found.' });

    await resumeDbModel.updatePersonalPhoto(resumeId, req.session.userId, '');
    res.json({ success: true });
  } catch (err) {
    console.error('[Photo Delete Error]', err);
    res.status(500).json({ success: false, message: 'Failed to remove photo.' });
  }
}

module.exports = { getResume, saveSection, uploadPhoto, deletePhoto };
