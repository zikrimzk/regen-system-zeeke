/**
 * Resume Model
 * Defines the data schema and provides validation/sanitization helpers.
 * No DB in v1 — data lives in session. This model enforces structure.
 */

/**
 * Returns a fresh, empty resume data object.
 */
function createEmptyResume() {
  return {
    personal: {
      fullName: '',
      jobTitle: '',
      phone: '',
      email: '',
      linkedin: '',
      address: '',
      streetAddress: '',
      locationCountry: 'Malaysia',
      locationState: '',
      locationCity: '',
      postcode: '',
      photoPath: '',    // server file path
      photoBase64: '',  // base64 for PDF embedding
    },
    summary: '',
    education: [
      // { degree, institution, institutionCountry, location, startDate, endDate, cgpa, academicResultType }
    ],
    experience: [
      // { jobTitle, company, employmentType, locationCountry, location, startDate, endDate, bullets: [] }
    ],
    projects: [
      // { title, description, bullets: [] }
    ],
    extracurricular: [
      // { organization, role, bullets: [] }
    ],
    skills: {
      interpersonal: '',
      software: '',
      technical: '',
      language: '',
      custom: [],
    },
    achievements: [],   // array of strings
    certifications: [], // array of strings
    references: [
      // { name, position, email, phone, phoneCountry }
    ],
  };
}

/**
 * Merges partial section data into existing resume data.
 * @param {object} existing - Current resume data from session
 * @param {string} section  - Section key (e.g. 'personal', 'education')
 * @param {any}    data     - New data for that section
 * @returns {object} Updated resume data
 */
function mergeSection(existing, section, data) {
  const resume = existing || createEmptyResume();
  if (Object.prototype.hasOwnProperty.call(resume, section)) {
    resume[section] = data;
  }
  return resume;
}

/**
 * Basic validation — only personal.fullName is required.
 * Returns array of error strings (empty = valid).
 */
function validate(resume) {
  const errors = [];
  if (!resume.personal || !resume.personal.fullName.trim()) {
    errors.push('Full name is required.');
  }
  return errors;
}

module.exports = { createEmptyResume, mergeSection, validate };
