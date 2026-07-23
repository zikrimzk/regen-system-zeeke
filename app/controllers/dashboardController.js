const resumeDbModel = require('../models/resumeDbModel');
const userModel     = require('../models/userModel');

function parseResumeId(raw) {
  const id = Number.parseInt(raw, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function cleanTitle(value) {
  return String(value || '').trim().slice(0, 200);
}

function hasSkills(skills = {}) {
  return ['technical', 'software', 'interpersonal', 'language'].some(key => String(skills[key] || '').trim())
    || (Array.isArray(skills.custom) && skills.custom.some(item => item?.label || item?.value));
}

function buildResumeProfile(row) {
  if (!row) return null;
  const data = row.resume_data || {};
  const personal = data.personal || {};
  const contactChecks = ['fullName', 'jobTitle', 'email', 'phone', 'address'];
  const contactCount = contactChecks.filter(key => String(personal[key] || '').trim()).length;
  const hasSummary = !!String(data.summary || '').trim();
  const hasEducation = Array.isArray(data.education) && data.education.length > 0;
  const hasExperience = Array.isArray(data.experience) && data.experience.length > 0;
  const hasProjects = Array.isArray(data.projects) && data.projects.length > 0;
  const skillsComplete = hasSkills(data.skills);
  const completion = Math.round(
    (contactCount / contactChecks.length) * 40
    + (hasSummary ? 15 : 0)
    + (hasEducation ? 15 : 0)
    + (hasExperience || hasProjects ? 15 : 0)
    + (skillsComplete ? 15 : 0)
  );
  const sections = [
    { id: 'personal', label: 'Personal information', complete: contactCount === contactChecks.length, optional: false },
    { id: 'summary', label: 'Professional summary', complete: hasSummary, optional: false },
    { id: 'education', label: 'Education', complete: hasEducation, optional: false },
    { id: 'experience', label: 'Work experience', complete: hasExperience, optional: true },
    { id: 'projects', label: 'Projects', complete: hasProjects, optional: true },
    { id: 'extracurricular', label: 'Activities', complete: Array.isArray(data.extracurricular) && data.extracurricular.length > 0, optional: true },
    { id: 'skills', label: 'Skills', complete: skillsComplete, optional: false },
    { id: 'achievements', label: 'Achievements', complete: Array.isArray(data.achievements) && data.achievements.length > 0, optional: true },
    { id: 'certifications', label: 'Certifications', complete: Array.isArray(data.certifications) && data.certifications.length > 0, optional: true },
    { id: 'references', label: 'References', complete: Array.isArray(data.references) && data.references.length > 0, optional: true },
  ];
  const nextSection = sections.find(section => !section.optional && !section.complete)?.id || 'personal';

  return {
    id: row.id,
    title: row.title,
    updatedAt: row.updated_at,
    completion,
    nextSection,
    sections,
    personal: {
      fullName: personal.fullName || '',
      jobTitle: personal.jobTitle || '',
      email: personal.email || '',
      phone: personal.phone || '',
      address: personal.address || '',
    },
  };
}

/**
 * GET /api/dashboard/resumes
 * Returns all resumes for the logged-in user.
 */
async function listResumes(req, res) {
  try {
    const resumes = await resumeDbModel.getResumesByUser(req.session.userId);
    const primary = await resumeDbModel.getPrimaryResumeByUser(req.session.userId);
    const profilePhotoBase64 = primary?.resume_data?.personal?.photoBase64 || '';
    res.json({ success: true, data: resumes, profilePhotoBase64, profile: buildResumeProfile(primary) });
  } catch (err) {
    console.error('[Dashboard List Error]', err);
    res.status(500).json({ success: false, message: 'Failed to load resumes.' });
  }
}

/**
 * POST /api/dashboard/resumes
 * Creates a new resume and returns its ID.
 */
async function createResume(req, res) {
  try {
    const user  = await userModel.findById(req.session.userId);
    const title = cleanTitle(req.body.title) || 'Untitled Resume';
    const resume = await resumeDbModel.getOrCreatePrimaryResume(req.session.userId, user, title);
    res.status(resume.existing ? 200 : 201).json({ success: true, data: resume });
  } catch (err) {
    console.error('[Dashboard Create Error]', err);
    res.status(500).json({ success: false, message: 'Failed to create resume.' });
  }
}

/**
 * PATCH /api/dashboard/resumes/:id/title
 * Rename a resume.
 */
async function renameResume(req, res) {
  const { id } = req.params;
  const resumeId = parseResumeId(id);
  const title = cleanTitle(req.body.title);
  if (!resumeId) return res.status(400).json({ success: false, message: 'Invalid resume ID.' });
  if (!title) {
    return res.status(400).json({ success: false, message: 'Title is required.' });
  }
  try {
    const ok = await resumeDbModel.updateTitle(resumeId, req.session.userId, title);
    if (!ok) return res.status(404).json({ success: false, message: 'Resume not found.' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to rename.' });
  }
}

/**
 * DELETE /api/dashboard/resumes/:id
 * Deletes a resume.
 */
async function deleteResume(req, res) {
  res.status(405).json({ success: false, message: 'Each account keeps one resume. Edit the existing resume instead of deleting it.' });
}

module.exports = { listResumes, createResume, renameResume, deleteResume };
