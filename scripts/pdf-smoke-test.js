const pdfService = require('../app/services/pdfService');

const sample = {
  personal: {
    fullName: 'ReGen Test User',
    jobTitle: 'Systems Analyst',
    email: 'test@example.com',
    phone: '+60 12-345 6789',
    locationCountry: 'Malaysia',
    locationState: 'Selangor',
    postcode: '40000',
  },
  summary: 'Test resume used to verify PDF generation.',
  education: [],
  experience: [],
  projects: [],
  extracurricular: [],
  skills: { technical: 'Testing', software: '', interpersonal: '', language: '', custom: [] },
  achievements: [],
  certifications: [],
  references: [],
};

async function run() {
  try {
    const buffer = await pdfService.generate(sample);
    if (!Buffer.isBuffer(buffer) || buffer.length < 1000 || buffer.subarray(0, 4).toString() !== '%PDF') {
      throw new Error('Generated output is not a valid PDF buffer.');
    }
    console.log(`PDF smoke test passed (${buffer.length} bytes).`);
  } finally {
    await pdfService.close();
  }
}

run().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
