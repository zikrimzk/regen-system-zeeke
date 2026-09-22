const db = require('../config/db');

let indexesEnsured = false;
const RETRYABLE_WRITE_ERRORS = new Set(['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT']);

async function withWriteRetry(operation, maxAttempts = 4) {
  let retryDelayMs = 25;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (err) {
      if (!RETRYABLE_WRITE_ERRORS.has(err.code) || attempt === maxAttempts) throw err;
      await new Promise(resolve => setTimeout(resolve, retryDelayMs));
      retryDelayMs *= 2;
    }
  }
  throw new Error('Database write retry exhausted.');
}

function seedLocation(address = '') {
  const value = String(address || '').trim();
  const parts = value.split(',').map(part => part.trim()).filter(Boolean);
  const country = parts.at(-1) || 'Malaysia';
  const postcode = (value.match(/\b\d{5}\b/) || [''])[0];
  const state = country === 'Malaysia' && parts.length >= 2
    ? parts.at(-2).replace(/\b\d{5}\b/g, '').trim()
    : '';
  return { country, state, postcode };
}

async function ensureIndexes() {
  if (indexesEnsured) return;
  try {
    await db.execute(
      'ALTER TABLE resumes ADD INDEX idx_resumes_user_updated (user_id, updated_at, id)'
    );
  } catch (err) {
    if (err.code !== 'ER_DUP_KEYNAME') throw err;
  }
  indexesEnsured = true;
}

/**
 * Create a new empty resume for a user.
 * Pre-fills personal section from user's registration data.
 */
async function createResume(userId, user, title = 'Untitled Resume') {
  const location = seedLocation(user.address);
  const defaultData = {
    personal: {
      fullName:    `${user.first_name} ${user.last_name}`.trim(),
      jobTitle:    '',
      phone:       user.phone   || '',
      email:       user.email   || '',
      linkedin:    '',
      address:     user.address || '',
      streetAddress: '',
      locationCountry: location.country,
      locationState: location.state,
      locationCity: '',
      postcode: location.postcode,
      photoPath:   '',
      photoBase64: '',
    },
    summary:         '',
    education:       [],
    experience:      [],
    projects:        [],
    extracurricular: [],
    skills:          { interpersonal: '', software: '', technical: '', language: '', custom: [] },
    achievements:    [],
    certifications:  [],
    references:      [],
  };

  const [result] = await db.execute(
    'INSERT INTO resumes (user_id, title, resume_data) VALUES (?, ?, ?)',
    [userId, title, JSON.stringify(defaultData)]
  );
  return { id: result.insertId, title, resumeData: defaultData };
}

async function getOrCreatePrimaryResume(userId, user, title = 'Untitled Resume') {
  const lockName = `resume-single:${userId}`;
  const connection = await db.getConnection();
  let hasLock = false;
  try {
    const [lockRows] = await connection.execute('SELECT GET_LOCK(?, 5) AS acquired', [lockName]);
    hasLock = lockRows[0]?.acquired === 1;
    if (!hasLock) {
      const existing = await getPrimaryResumeByUser(userId);
      if (existing) {
        return { id: existing.id, title: existing.title, resumeData: existing.resume_data, existing: true };
      }
      throw new Error('Could not reserve resume creation lock.');
    }

    const existing = await getPrimaryResumeByUser(userId);
    if (existing) {
      return { id: existing.id, title: existing.title, resumeData: existing.resume_data, existing: true };
    }

    return createResume(userId, user, title);
  } finally {
    if (hasLock) {
      try { await connection.execute('SELECT RELEASE_LOCK(?)', [lockName]); } catch (err) {}
    }
    connection.release();
  }
}

/**
 * Get all resumes for a user (summary only, no heavy JSON).
 */
async function getResumesByUser(userId) {
  await ensureIndexes();
  const [rows] = await db.execute(
    `SELECT id, title, created_at, updated_at,
            JSON_UNQUOTE(JSON_EXTRACT(resume_data, '$.personal.fullName')) AS full_name,
            JSON_UNQUOTE(JSON_EXTRACT(resume_data, '$.personal.jobTitle')) AS job_title
     FROM resumes WHERE user_id = ? ORDER BY updated_at DESC, id DESC LIMIT 1`,
    [userId]
  );
  return rows;
}

async function getPrimaryResumeByUser(userId) {
  const [rows] = await db.execute(
    'SELECT * FROM resumes WHERE user_id = ? ORDER BY updated_at DESC, id DESC LIMIT 1',
    [userId]
  );
  if (!rows[0]) return null;
  const row = rows[0];
  row.resume_data = typeof row.resume_data === 'string'
    ? JSON.parse(row.resume_data)
    : row.resume_data;
  return row;
}

async function getLatestProfilePhotoByUser(userId) {
  const [rows] = await db.execute(
    `SELECT JSON_UNQUOTE(JSON_EXTRACT(resume_data, '$.personal.photoBase64')) AS photo_base64
     FROM resumes
     WHERE user_id = ?
       AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(resume_data, '$.personal.photoBase64')), '') <> ''
     ORDER BY updated_at DESC, id DESC
     LIMIT 1`,
    [userId]
  );
  return rows[0]?.photo_base64 || '';
}

/**
 * Get a single resume (full data) — only if it belongs to userId.
 */
async function getResumeById(id, userId) {
  const [rows] = await db.execute(
    `SELECT * FROM resumes
     WHERE id = ? AND user_id = ?
       AND id = (
         SELECT active.primary_id FROM (
           SELECT id AS primary_id FROM resumes
           WHERE user_id = ? ORDER BY updated_at DESC, id DESC LIMIT 1
         ) AS active
       )
     LIMIT 1`,
    [id, userId, userId]
  );
  if (!rows[0]) return null;
  const row = rows[0];
  row.resume_data = typeof row.resume_data === 'string'
    ? JSON.parse(row.resume_data)
    : row.resume_data;
  return row;
}

/**
 * Save a specific section of resume_data.
 */
async function saveSection(resumeId, userId, section, data) {
  // Use JSON_SET to update just the section
  const path = `$.${section}`;
  const [result] = await withWriteRetry(() => db.execute(
    `UPDATE resumes SET resume_data = JSON_SET(resume_data, ?, CAST(? AS JSON)), updated_at = NOW()
     WHERE id = ? AND user_id = ?
       AND id = (SELECT active.primary_id FROM (SELECT id AS primary_id FROM resumes WHERE user_id = ? ORDER BY updated_at DESC, id DESC LIMIT 1) AS active)`,
    [path, JSON.stringify(data), resumeId, userId, userId]
  ));
  return result.affectedRows > 0;
}

/**
 * Save personal fields while preserving a photo written by another request.
 */
async function savePersonalSection(resumeId, userId, data) {
  const [result] = await withWriteRetry(() => db.execute(
    `UPDATE resumes
     SET resume_data = JSON_SET(
       resume_data,
       '$.personal',
       JSON_MERGE_PATCH(
         COALESCE(JSON_EXTRACT(resume_data, '$.personal'), JSON_OBJECT()),
         CAST(? AS JSON)
       )
     ),
     updated_at = NOW()
     WHERE id = ? AND user_id = ?
       AND id = (SELECT active.primary_id FROM (SELECT id AS primary_id FROM resumes WHERE user_id = ? ORDER BY updated_at DESC, id DESC LIMIT 1) AS active)`,
    [JSON.stringify(data), resumeId, userId, userId]
  ));
  return result.affectedRows > 0;
}

async function updatePersonalPhoto(resumeId, userId, photoBase64 = '') {
  const [result] = await withWriteRetry(() => db.execute(
    `UPDATE resumes
     SET resume_data = JSON_SET(
       resume_data,
       '$.personal.photoPath', '',
       '$.personal.photoBase64', ?
     ),
     updated_at = NOW()
     WHERE id = ? AND user_id = ?
       AND id = (SELECT active.primary_id FROM (SELECT id AS primary_id FROM resumes WHERE user_id = ? ORDER BY updated_at DESC, id DESC LIMIT 1) AS active)`,
    [photoBase64, resumeId, userId, userId]
  ));
  return result.affectedRows > 0;
}

/**
 * Update resume title.
 */
async function updateTitle(resumeId, userId, title) {
  const [result] = await withWriteRetry(() => db.execute(
    `UPDATE resumes SET title = ?, updated_at = NOW()
     WHERE id = ? AND user_id = ?
       AND id = (SELECT active.primary_id FROM (SELECT id AS primary_id FROM resumes WHERE user_id = ? ORDER BY updated_at DESC, id DESC LIMIT 1) AS active)`,
    [title, resumeId, userId, userId]
  ));
  return result.affectedRows > 0;
}

/**
 * Delete a resume.
 */
async function deleteResume(resumeId, userId) {
  const [result] = await db.execute(
    'DELETE FROM resumes WHERE id = ? AND user_id = ?',
    [resumeId, userId]
  );
  return result.affectedRows > 0;
}

module.exports = {
  createResume, getOrCreatePrimaryResume, getResumesByUser, getPrimaryResumeByUser, getLatestProfilePhotoByUser, getResumeById,
  saveSection, savePersonalSection, updatePersonalPhoto, updateTitle, deleteResume,
};
