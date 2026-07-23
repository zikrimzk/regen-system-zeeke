const BULLET_RE = /^[\s>]*(?:[•●○◦▪▫■□‣⁃*]|[-–—]{1,2}|\d{1,3}[.)]|[a-zA-Z][.)])\s+/u;
const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200D\uFEFF]/g;

function cleanText(value, { multiline = false } = {}) {
  const normalized = String(value || '')
    .normalize('NFKC')
    .replace(CONTROL_RE, '')
    .replace(/\u00A0/g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/\t/g, ' ');

  const lines = normalized.split('\n')
    .map(line => line.replace(BULLET_RE, '').replace(/[ ]{2,}/g, ' ').trim())
    .filter(Boolean);

  return multiline ? lines.join('\n') : lines.join(' ').replace(/[ ]{2,}/g, ' ').trim();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanBullets(value) {
  return asArray(value)
    .flatMap(item => cleanText(item, { multiline: true }).split('\n'))
    .map(item => cleanText(item))
    .filter(Boolean);
}

function cleanEntryList(value, mapper) {
  return asArray(value).map(mapper).filter(item => Object.values(item).some(Boolean));
}

function firstNonEmptyArray(...values) {
  return values.find(value => Array.isArray(value) && value.length) || [];
}

function sanitizeSection(section, data) {
  switch (section) {
    case 'personal':
      return sanitizePersonal(data);
    case 'summary':
      return cleanText(data, { multiline: true });
    case 'education':
      return cleanEntryList(data, item => ({
        degree: cleanText(item?.degree),
        institution: cleanText(item?.institution),
        institutionCountry: cleanText(item?.institutionCountry),
        location: cleanText(item?.location),
        cgpa: cleanText(item?.cgpa),
        academicResultType: cleanText(item?.academicResultType),
        startDate: cleanText(item?.startDate),
        endDate: cleanText(item?.endDate),
      }));
    case 'experience':
      return cleanEntryList(data, item => ({
        jobTitle: cleanText(item?.jobTitle),
        company: cleanText(item?.company),
        employmentType: cleanText(item?.employmentType),
        locationCountry: cleanText(item?.locationCountry),
        location: cleanText(item?.location),
        startDate: cleanText(item?.startDate),
        endDate: cleanText(item?.endDate),
        bullets: cleanBullets(item?.bullets),
      }));
    case 'projects':
      return cleanEntryList(data, item => ({
        title: cleanText(item?.title),
        type: cleanText(item?.type),
        description: cleanText(item?.description, { multiline: true }),
        bullets: cleanBullets(item?.bullets),
      }));
    case 'extracurricular':
      return cleanEntryList(data, item => ({
        organization: cleanText(item?.organization),
        role: cleanText(item?.role),
        bullets: cleanBullets(item?.bullets),
      }));
    case 'skills':
      if (!data || typeof data !== 'object') return null;
      return {
        interpersonal: cleanText(data.interpersonal),
        software: cleanText(data.software),
        technical: cleanText(data.technical),
        language: cleanText(data.language),
        custom: asArray(data.custom).map(item => ({
          label: cleanText(item?.label),
          value: cleanText(item?.value),
        })).filter(item => item.label || item.value),
      };
    case 'achievements':
    case 'certifications':
      return cleanBullets(data);
    case 'references':
      return sanitizeReferences(data);
    default:
      return data;
  }
}

function sanitizePersonal(data) {
  if (!data || typeof data !== 'object') return {};
  const locationCountry = cleanText(data.locationCountry);
  const locationState = cleanText(data.locationState);
  const postcode = cleanText(data.postcode);
  const structuredLocation = locationCountry === 'Malaysia'
    ? [postcode, locationState, locationCountry].filter(Boolean).join(', ')
    : locationCountry;
  return {
    fullName: cleanText(data.fullName),
    jobTitle: cleanText(data.jobTitle),
    email: cleanText(data.email).toLowerCase(),
    phone: cleanText(data.phone),
    linkedin: cleanText(data.linkedin),
    address: structuredLocation || cleanText(data.address),
    streetAddress: '',
    locationCountry,
    locationState,
    locationCity: '',
    postcode,
    photoPath: data.photoPath || '',
    photoBase64: data.photoBase64 || '',
  };
}

function sanitizeReferences(data) {
  return cleanEntryList(data, item => ({
    name: cleanText(item?.name || item?.fullName || item?.referenceName),
    position: cleanText(item?.position || item?.jobTitle || item?.title || item?.company),
    email: cleanText(item?.email),
    phone: cleanText(item?.phone || item?.contact),
    phoneCountry: cleanText(item?.phoneCountry),
  }));
}

function sanitizeResumeData(resume = {}) {
  const source = resume && typeof resume === 'object' ? resume : {};
  return {
    personal: sanitizePersonal(source.personal),
    summary: sanitizeSection('summary', source.summary),
    education: sanitizeSection('education', source.education),
    experience: sanitizeSection('experience', source.experience),
    projects: sanitizeSection('projects', source.projects),
    extracurricular: sanitizeSection('extracurricular', source.extracurricular),
    skills: sanitizeSection('skills', source.skills) || { interpersonal: '', software: '', technical: '', language: '', custom: [] },
    achievements: sanitizeSection('achievements', source.achievements),
    certifications: sanitizeSection('certifications', source.certifications),
    references: sanitizeReferences(firstNonEmptyArray(source.references, source.reference, source.referees)),
  };
}

module.exports = { cleanText, cleanBullets, sanitizeSection, sanitizeResumeData };
