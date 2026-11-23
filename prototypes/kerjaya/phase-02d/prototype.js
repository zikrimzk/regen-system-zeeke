/**
 * Kerjaya. Phase 02D Interactive Prototype Logic
 * High-fidelity, accessible client-side interactions
 */
(() => {
  'use strict';

  // State Management
  const state = {
    lang: localStorage.getItem('kerjaya_lang') || 'en',
    theme: localStorage.getItem('kerjaya_theme') || 'light',
    persona: 'operations',
    walkthroughStep: 0,
    walkthroughDesign: 'modern',
    walkthroughSuggestionApplied: false,
    templateFilter: 'all',
  };

  // Personas Database (Authentic Malaysian profiles)
  const personas = {
    operations: {
      name: 'Aina Rahman',
      role: { en: 'Operations Coordinator', ms: 'Penyelaras Operasi' },
      location: 'Petaling Jaya, Selangor',
      email: 'aina.rahman@example.my',
      summary: {
        en: 'Experienced operations coordinator with 3+ years managing retail logistics, supplier dispatch, and daily store stock audits in Klang Valley.',
        ms: 'Penyelaras operasi berpengalaman lebih 3 tahun menguruskan logistik peruncitan, penghantaran pembekal, dan audit stok harian di Lembah Klang.'
      },
      experienceTitle: { en: 'Operations Specialist · Jaya Retail Sdn Bhd', ms: 'Pakar Operasi · Jaya Retail Sdn Bhd' },
      experienceDesc: {
        en: 'Coordinated weekly stock audits across 4 outlets, reduced inventory variance by 18%, and liaised directly with regional suppliers.',
        ms: 'Menyelaras audit stok mingguan di 4 cawangan, mengurangkan varians inventori sebanyak 18%, dan berurusan terus dengan pembekal serantau.'
      },
      education: { en: 'Diploma in Business Studies · Politeknik Sultan Salahuddin Abdul Aziz Shah', ms: 'Diploma Pengajian Perniagaan · Politeknik Sultan Salahuddin Abdul Aziz Shah' },
      skills: { en: 'Inventory Audit, ERP Systems, Supplier Relations, Microsoft Excel', ms: 'Audit Inventori, Sistem ERP, Hubungan Pembekal, Microsoft Excel' }
    },
    graduate: {
      name: 'Zamir Zaini',
      role: { en: 'Junior Business Analyst', ms: 'Penganalisis Perniagaan Muda' },
      location: 'Ayer Keroh, Melaka',
      email: 'zamir.zaini@example.my',
      summary: {
        en: 'First-class Business Administration graduate with hands-on internship experience in market research, customer data analysis, and dashboard reporting.',
        ms: 'Graduan Pentadbiran Perniagaan kelas pertama dengan pengalaman latihan industri dalam penyelidikan pasaran, analisis data pelanggan, dan laporan papan pemuka.'
      },
      experienceTitle: { en: 'Intern, Market Research · Melaka Biotech Holdings', ms: 'Pelatih Industri, Penyelidikan Pasaran · Melaka Biotech Holdings' },
      experienceDesc: {
        en: 'Analyzed regional survey responses from 350+ SME clients, visualized findings in Power BI, and assisted senior consultants in client presentations.',
        ms: 'Menganalisis maklum balas tinjauan serantau daripada 350+ PKS, memvisualisasikan data dalam Power BI, dan membantu konsultan kanan dalam sesi pembentangan.'
      },
      education: { en: 'Bachelor of Business Administration (Hons) · Universiti Teknologi MARA (UiTM)', ms: 'Ijazah Sarjana Muda Pentadbiran Perniagaan (Kepujian) · UiTM' },
      skills: { en: 'Market Research, Power BI, Statistical Analysis, Team Leadership', ms: 'Penyelidikan Pasaran, Power BI, Analisis Statistik, Kepimpinan Pasukan' }
    },
    tech: {
      name: 'Nurul Huda',
      role: { en: 'Frontend Software Engineer', ms: 'Jurutera Perisian Frontend' },
      location: 'Cyberjaya, Selangor',
      email: 'huda.tech@example.my',
      summary: {
        en: 'Frontend developer passionate about building accessible web apps, design system tokens, and reliable mobile-first PWA experiences in TypeScript.',
        ms: 'Pembangun frontend yang berdedikasi membina aplikasi web boleh akses, token sistem reka bentuk, dan pengalaman PWA mesra peranti mudah alih.'
      },
      experienceTitle: { en: 'Frontend Developer · Innovate MY Solutions', ms: 'Pembangun Frontend · Innovate MY Solutions' },
      experienceDesc: {
        en: 'Rebuilt candidate portal into a responsive PWA, improved Core Web Vitals to 98%, and established accessible component patterns across 6 web apps.',
        ms: 'Membina semula portal calon ke PWA responsif, meningkatkan Core Web Vitals ke 98%, dan menetapkan standard komponen boleh akses untuk 6 aplikasi web.'
      },
      education: { en: 'Bachelor of Computer Science (Software Engineering) · Universiti Malaya', ms: 'Ijazah Sarjana Muda Sains Komputer (Kejuruteraan Perisian) · Universiti Malaya' },
      skills: { en: 'TypeScript, React, PWA, WCAG 2.2 AA Accessibility, REST APIs', ms: 'TypeScript, React, PWA, Kebolehaksesan WCAG 2.2 AA, API REST' }
    }
  };

  // Dual-Language Dictionary (Strict Malaysian Malay vs English)
  const i18n = {
    en: {
      skip: 'Skip to content',
      brand: 'Kerjaya.',
      navWorkspace: 'Workspace',
      navJourneys: 'Career Stages',
      navFeatures: 'Features',
      navTemplates: 'Templates',
      navPricing: 'Pricing',
      navFaq: 'FAQ',
      signIn: 'Sign In',
      createAccount: 'Create Account',
      heroBadge: 'Malaysia’s Career Companion',
      heroTitle: 'Your next career move, <em>in one workspace.</em>',
      heroDesc: 'Craft an ATS-ready Malaysian resume, pair it with a role-tailored cover letter, and receive actionable writing suggestions. Built with care for every career stage.',
      heroStartBtn: 'Create Your Free Resume',
      heroDemoBtn: 'Explore Sample Workspace',
      personaOperations: 'Operations Specialist',
      personaGrad: 'Fresh Graduate',
      personaTech: 'Software Developer',
      previewVerified: 'ATS-Friendly & Formatted for Malaysia',
      journeysTitle: 'Tailored for Your Malaysian Career Journey',
      journeysDesc: 'Whether landing your first internship or stepping into executive leadership, Kerjaya. provides structure, guidance, and dignified tools.',
      journey1Badge: 'Students & Interns',
      journey1Title: 'Internships & First Roles',
      journey1Desc: 'Structure academic coursework, leadership activities, and university projects into a persuasive resume for industrial training.',
      journey2Badge: 'Fresh Graduates',
      journey2Title: 'Entry-Level Career Launch',
      journey2Desc: 'Highlight transferable skills, internships, and capstone achievements with clean layouts trusted by Malaysian employers.',
      journey3Badge: 'Experienced',
      journey3Title: 'Mid-Career & Advancement',
      journey3Desc: 'Condense years of professional impact, key metrics, and managerial experience into concise, multi-page executive formats.',
      journey4Badge: 'Career Changers',
      journey4Title: 'Industry Pivot & Upskilling',
      journey4Desc: 'Reframe TVET certifications, vocational training, and past accomplishments toward new high-demand industries.',
      featuresTitle: 'Built for High-Stakes Career Applications',
      featuresDesc: 'Everything you need to create, refine, and deliver job applications with absolute confidence.',
      feature1Title: 'Resume Studio',
      feature1Desc: 'Structured sections, instant live PDF preview, and full keyboard accessibility. Switch between 16 proven designs anytime.',
      feature2Title: 'Cover Letter Studio',
      feature2Desc: 'Generate tailored cover letters matching your resume typography and design. One cohesive application package.',
      feature3Title: 'Mochi Career Assistant',
      feature3Desc: 'Calm, human-in-the-loop writing assistance. Accepts or dismisses suggestions with complete candidate ownership.',
      walkthroughTitle: 'Try the Application Workflow',
      walkthroughDesc: 'See how effortlessly Kerjaya. transforms raw bullet points into compelling career statements.',
      step1Nav: '1. Layout',
      step2Nav: '2. Details',
      step3Nav: '3. Wording Review',
      step4Nav: '4. Cover Letter',
      step1Title: 'Choose Your Layout',
      step1Desc: 'Select an authentic layout. Your content seamlessly adapts across all designs.',
      step2Title: 'Refine Your Details',
      step2Desc: 'Input your verified career facts. AI never invents skills or employment dates.',
      step3Title: 'Review Writing Suggestions',
      step3Desc: 'Compare your original wording with active, metric-focused suggestions.',
      step4Title: 'Pair with Matching Letter',
      step4Desc: 'Generate a matching cover letter addressed to your target Malaysian employer.',
      originalWording: 'Original Draft',
      suggestedWording: 'Suggested Improvement',
      applySuggestionBtn: 'Apply Suggestion',
      appliedNotice: '✓ Suggestion applied to resume draft',
      aiDisclosure: 'AI suggestions are optional. You maintain full editorial control.',
      templatesTitle: '16 Professionally Designed Templates',
      templatesDesc: 'Engineered for ATS parsing, legible typography, and Malaysian hiring standards.',
      filterAll: 'All Designs (16)',
      filterBasic: 'Basic Unlocks',
      filterPremium: 'Premium Collection',
      viewPdfSample: 'View Sample PDF',
      pricingTitle: 'Simple, Transparent Malaysian Pricing',
      pricingDesc: 'Pay once in Malaysian Ringgit (RM). No hidden subscriptions, no automatic recurring charges.',
      pkg1Name: 'Free Starter',
      pkg1Desc: 'Ideal for trying the workspace and creating your first draft.',
      pkg1Price: 'RM 0',
      pkg1Feature1: 'Access to Classic & Modern templates',
      pkg1Feature2: 'Standard PDF download',
      pkg1Feature3: 'Basic Cover Letter Studio',
      pkg1Feature4: 'Full privacy & data export',
      pkg1Btn: 'Start Free',
      pkg2Badge: 'Most Popular',
      pkg2Name: 'Career Pro',
      pkg2Desc: 'For active jobseekers targeting competitive roles.',
      pkg2Price: 'RM 29',
      pkg2Feature1: 'All 16 ATS-ready resume templates',
      pkg2Feature2: 'Unlimited high-res PDF downloads',
      pkg2Feature3: '50 AI writing assistance uses',
      pkg2Feature4: 'Mochi career companion access',
      pkg2Btn: 'Get Career Pro',
      pkg3Name: 'Career Ultimate',
      pkg3Desc: 'Comprehensive suite with upcoming job tracker & prep.',
      pkg3Price: 'RM 49',
      pkg3Feature1: 'Permanent access to all current & future designs',
      pkg3Feature2: '150 AI writing & tailoring tokens',
      pkg3Feature3: 'Priority queue for upcoming Job Tracker',
      pkg3Feature4: '1-on-1 formatting review support',
      pkg3Btn: 'Get Ultimate',
      trustTitle: 'Your Data & Career Records Stay Yours',
      trustItem1Title: 'Zero Credential Invention',
      trustItem1Desc: 'We never fabricate degrees, employers, or skills. You provide the facts; we provide polish.',
      trustItem2Title: 'Private & Secure',
      trustItem2Desc: 'Your resumes remain encrypted. No candidate data is sold or shared with recruiters without permission.',
      trustItem3Title: 'Malaysian Privacy Compliant',
      trustItem3Desc: 'Hosted and operated in strict compliance with Personal Data Protection Act (PDPA) standards.',
      faqTitle: 'Frequently Asked Questions',
      faq1Q: 'Can I change my template later without losing my writing?',
      faq1A: 'Yes! Your profile data, work history, and custom bullets remain intact when switching between any of our 16 designs.',
      faq2Q: 'Does Kerjaya. work on mobile phones?',
      faq2A: 'Absolutely. Kerjaya. is built as a progressive web app (PWA). You can draft on your phone in Write mode, preview the final PDF, and save seamlessly.',
      faq3Q: 'Will the AI rewrite my resume without my consent?',
      faq3A: 'Never. You must explicitly review and accept each wording suggestion. You maintain complete editorial ownership over every word.',
      faq4Q: 'What happens to my account after I pay?',
      faq4A: 'All package purchases are one-time payments in RM. We never automatically renew or charge your card without your explicit authorization.',
      footerEntity: 'Kerjaya. is an enterprise product by Zeeke Software Solution (AS0482253-X), Malaysia.',
      footerPrivacy: 'Privacy Policy',
      footerTerms: 'Terms of Service',
      footerSecurity: 'Security & PDPA',
      footerCopyright: '© 2026 Zeeke Software Solution. Built with care for Malaysian career seekers.'
    },
    ms: {
      skip: 'Langkau ke kandungan utama',
      brand: 'Kerjaya.',
      navWorkspace: 'Ruang Kerja',
      navJourneys: 'Peringkat Kerjaya',
      navFeatures: 'Ciri Utama',
      navTemplates: 'Templat',
      navPricing: 'Harga',
      navFaq: 'Soalan Lazim',
      signIn: 'Log Masuk',
      createAccount: 'Daftar Akaun',
      heroBadge: 'Teman Kerjaya Pilihan Malaysia',
      heroTitle: 'Langkah kerjaya seterusnya, <em>dalam satu ruang kerja.</em>',
      heroDesc: 'Bina resume mesra ATS, padankan dengan surat iringan profesional, dan dapatkan cadangan penulisan bernas. Dicipta khusus untuk setiap peringkat kerjaya di Malaysia.',
      heroStartBtn: 'Bina Resume Percuma',
      heroDemoBtn: 'Lihat Contoh Ruang Kerja',
      personaOperations: 'Pakar Operasi',
      personaGrad: 'Graduan Baharu',
      personaTech: 'Pembangun Perisian',
      previewVerified: 'Format Mesra ATS & Standard Industri Malaysia',
      journeysTitle: 'Disesuaikan untuk Setiap Peringkat Kerjaya Anda',
      journeysDesc: 'Daripada latihan industri pertama hingga jawatan kepimpinan kanan, Kerjaya. menyediakan panduan berstruktur dan alat yang meyakinkan.',
      journey1Badge: 'Pelajar & Latihan Industri',
      journey1Title: 'Latihan Industri & Kerjaya Pertama',
      journey1Desc: 'Susun kursus akademik, kepimpinan kokurikulum, dan projek universiti menjadi resume yang meyakinkan majikan.',
      journey2Badge: 'Graduan Baharu',
      journey2Title: 'Memulakan Langkah Pekerjaan',
      journey2Desc: 'Serlahkan kemahiran yang boleh dipindahkan, pengalaman latihan industri, dan projek akhir dengan reka letak kemas.',
      journey3Badge: 'Berpengalaman',
      journey3Title: 'Pertengahan Kerjaya & Kenaikan Pangkat',
      journey3Desc: 'Padatkan pencapaian bertahun-tahun, metrik kejayaan, dan pengalaman pengurusan ke dalam format eksekutif yang meyakinkan.',
      journey4Badge: 'Peralihan Bidang',
      journey4Title: 'Peralihan Industri & Peningkatan Kemahiran',
      journey4Desc: 'Sesuaikan pensijilan TVET, latihan vokasional, dan kemahiran terdahulu untuk meneroka peluang dalam sektor berpermintaan tinggi.',
      featuresTitle: 'Direka untuk Permohonan Kerja Berkualiti Tinggi',
      featuresDesc: 'Segala yang anda perlukan untuk membina, menyunting, dan menghantar permohonan kerja dengan penuh keyakinan.',
      feature1Title: 'Studio Resume',
      feature1Desc: 'Bahagian berstruktur, pratonton PDF masa nyata, dan sokongan papan kekunci penuh. Tukar antara 16 reka letak bila-bila masa.',
      feature2Title: 'Studio Surat Iringan',
      feature2Desc: 'Cipta surat iringan yang sepadan dengan tipografi dan gaya resume anda. Pakej permohonan yang kemas dan seragam.',
      feature3Title: 'Pembantu Kerjaya Mochi',
      feature3Desc: 'Bantuan penulisan beradab yang mengutamakan kawalan anda. Anda membuat keputusan sama ada mahu menerima atau menolak cadangan.',
      walkthroughTitle: 'Cuba Aliran Kerja Permohonan',
      walkthroughDesc: 'Lihat bagaimana Kerjaya. memperkemaskan draf asal anda menjadi kenyataan kerjaya yang berkesan.',
      step1Nav: '1. Reka Letak',
      step2Nav: '2. Butiran',
      step3Nav: '3. Semakan Ayat',
      step4Nav: '4. Surat Iringan',
      step1Title: 'Pilih Reka Letak Anda',
      step1Desc: 'Pilih templat profesional. Kandungan anda akan dipindahkan secara automatik tanpa hilang.',
      step2Title: 'Perkemas Butiran Anda',
      step2Desc: 'Masukkan fakta kerjaya sebenar anda. AI tidak akan mencipta kemahiran atau tarikh palsu.',
      step3Title: 'Semak Cadangan Penulisan',
      step3Desc: 'Bandingkan draf asal dengan cadangan ayat yang lebih aktif dan berorientasikan hasil.',
      step4Title: 'Padankan dengan Surat Iringan',
      step4Desc: 'Hasilkan surat iringan yang sepadan dan dialamatkan kepada majikan sasaran anda di Malaysia.',
      originalWording: 'Draf Asal',
      suggestedWording: 'Cadangan Penambahbaikan',
      applySuggestionBtn: 'Gunakan Cadangan Ini',
      appliedNotice: '✓ Cadangan telah digunakan pada draf resume',
      aiDisclosure: 'Cadangan AI adalah pilihan. Anda mengawal sepenuhnya penulisan akhir anda.',
      templatesTitle: '16 Templat Rekaan Profesional',
      templatesDesc: 'Disesuaikan untuk sistem saringan ATS, tipografi jelas, dan kehendak majikan di Malaysia.',
      filterAll: 'Semua Reka Bentuk (16)',
      filterBasic: 'Koleksi Asas',
      filterPremium: 'Koleksi Premium',
      viewPdfSample: 'Lihat Contoh PDF',
      pricingTitle: 'Harga Telus dalam Ringgit Malaysia',
      pricingDesc: 'Bayar sekali sahaja dalam Ringgit Malaysia (RM). Tiada langganan tersembunyi atau caj automatik berulang.',
      pkg1Name: 'Permulaan Percuma',
      pkg1Desc: 'Sesuai untuk mencuba ruang kerja dan membina draf pertama anda.',
      pkg1Price: 'RM 0',
      pkg1Feature1: 'Akses kepada templat Classic & Modern',
      pkg1Feature2: 'Muat turun PDF standard',
      pkg1Feature3: 'Studio Surat Iringan asas',
      pkg1Feature4: 'Privasi penuh & eksport data',
      pkg1Btn: 'Mula Percuma',
      pkg2Badge: 'Pilihan Ramai',
      pkg2Name: 'Kerjaya Pro',
      pkg2Desc: 'Untuk pencari kerja aktif yang menyasarkan jawatan kompetitif.',
      pkg2Price: 'RM 29',
      pkg2Feature1: 'Kesemua 16 templat resume mesra ATS',
      pkg2Feature2: 'Muat turun PDF resolusi tinggi tanpa had',
      pkg2Feature3: '50 kali penggunaan bantuan penulisan AI',
      pkg2Feature4: 'Akses penuh kepada teman kerjaya Mochi',
      pkg2Btn: 'Dapatkan Kerjaya Pro',
      pkg3Name: 'Kerjaya Penuh',
      pkg3Desc: 'Pakej lengkap dengan penjejak permohonan dan persediaan temu duga.',
      pkg3Price: 'RM 49',
      pkg3Feature1: 'Akses kekal kepada semua templat semasa & baharu',
      pkg3Feature2: '150 token penulisan AI & penyesuaian JD',
      pkg3Feature3: 'Akses awal kepada Penjejak Permohonan Kerja',
      pkg3Feature4: 'Sokongan semakan format dokumen peribadi',
      pkg3Btn: 'Dapatkan Pakej Penuh',
      trustTitle: 'Data & Rekod Kerjaya Anda Kekal Milik Anda',
      trustItem1Title: 'Tiada Rekaan Kelayakan',
      trustItem1Desc: 'Kami tidak sekali-kali mencipta ijazah, majikan, atau kemahiran palsu. Anda berikan fakta; kami bantu kemaskan.',
      trustItem2Title: 'Selamat & Terpelihara',
      trustItem2Desc: 'Resume anda disulitkan sepenuhnya. Tiada data calon dijual atau dikongsi kepada pihak ketiga tanpa izin.',
      trustItem3Title: 'Pematuhan Standard Privasi Malaysia',
      trustItem3Desc: 'Dikendalikan dan disimpan mengikut peruntukan Akta Perlindungan Data Peribadi (APDP / PDPA) Malaysia.',
      faqTitle: 'Soalan Lazim',
      faq1Q: 'Bolehkah saya menukar templat kemudian tanpa kehilangan penulisan saya?',
      faq1A: 'Ya! Maklumat profil, pengalaman kerja, dan huraian anda kekal tersimpan rapi apabila anda menukar antara mana-mana 16 templat kami.',
      faq2Q: 'Bolehkah Kerjaya. digunakan menerusi telefon pintar?',
      faq2A: 'Sudah tentu. Kerjaya. dibina sebagai aplikasi web progresif (PWA). Anda boleh menulis pada telefon dalam mod Tulis, menyemak pratonton PDF, dan menyimpan dokumen dengan lancar.',
      faq3Q: 'Adakah AI akan menukar resume saya tanpa persetujuan?',
      faq3A: 'Sama sekali tidak. Anda mesti menyemak dan menerima setiap cadangan secara eksplisit. Anda memegang kawalan penyuntingan sepenuhnya.',
      faq4Q: 'Apakah yang berlaku kepada akaun saya selepas pembayaran dibuat?',
      faq4A: 'Semua pembelian pakej adalah bayaran sekali sahaja dalam RM. Kami tidak mengenakan caj pembaharuan automatik pada kad anda tanpa kebenaran jelas.',
      footerEntity: 'Kerjaya. ialah produk perusahaan oleh Zeeke Software Solution (AS0482253-X), Malaysia.',
      footerPrivacy: 'Dasar Privasi',
      footerTerms: 'Terma Perkhidmatan',
      footerSecurity: 'Keselamatan & PDPA',
      footerCopyright: '© 2026 Zeeke Software Solution. Dibina dengan teliti untuk pencari kerja di Malaysia.'
    }
  };

  // DOM Elements Selection & Binding
  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('kerjaya_theme', theme);
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
      themeBtn.textContent = theme === 'dark' ? '☀ Light' : '☾ Dark';
      themeBtn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    }
  }

  function applyLanguage(lang) {
    state.lang = lang;
    document.documentElement.lang = lang === 'ms' ? 'ms-MY' : 'en-MY';
    localStorage.setItem('kerjaya_lang', lang);

    const dictionary = i18n[lang];
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      if (dictionary[key]) {
        el.innerHTML = dictionary[key];
      }
    });

    const langBtn = document.getElementById('lang-toggle-btn');
    if (langBtn) {
      langBtn.textContent = lang === 'ms' ? 'EN' : 'BM';
      langBtn.setAttribute('aria-label', lang === 'ms' ? 'Tukar ke Bahasa Inggeris' : 'Switch to Bahasa Melayu');
    }

    renderPersona(state.persona);
  }

  function renderPersona(personaKey) {
    state.persona = personaKey;
    const p = personas[personaKey];
    if (!p) return;

    const lang = state.lang;
    const nameEl = document.getElementById('preview-name');
    const roleEl = document.getElementById('preview-role');
    const contactEl = document.getElementById('preview-contact');
    const summaryEl = document.getElementById('preview-summary');
    const expTitleEl = document.getElementById('preview-exp-title');
    const expDescEl = document.getElementById('preview-exp-desc');
    const eduEl = document.getElementById('preview-edu');
    const skillsEl = document.getElementById('preview-skills');

    if (nameEl) nameEl.textContent = p.name;
    if (roleEl) roleEl.textContent = p.role[lang] || p.role.en;
    if (contactEl) contactEl.textContent = `${p.location} · ${p.email}`;
    if (summaryEl) summaryEl.textContent = p.summary[lang] || p.summary.en;
    if (expTitleEl) expTitleEl.textContent = p.experienceTitle[lang] || p.experienceTitle.en;
    if (expDescEl) expDescEl.textContent = p.experienceDesc[lang] || p.experienceDesc.en;
    if (eduEl) eduEl.textContent = p.education[lang] || p.education.en;
    if (skillsEl) skillsEl.textContent = p.skills[lang] || p.skills.en;

    document.querySelectorAll('.persona-btn').forEach(btn => {
      const match = btn.dataset.persona === personaKey;
      btn.setAttribute('aria-pressed', match ? 'true' : 'false');
    });
  }

  function setupWalkthrough() {
    const tabs = document.querySelectorAll('.step-nav-btn');
    const panels = document.querySelectorAll('.step-panel');

    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => {
        state.walkthroughStep = index;
        tabs.forEach((t, i) => t.setAttribute('aria-selected', i === index ? 'true' : 'false'));
        panels.forEach((p, i) => {
          if (i === index) {
            p.removeAttribute('hidden');
          } else {
            p.setAttribute('hidden', '');
          }
        });
      });
    });

    const applyBtn = document.getElementById('apply-suggestion-btn');
    const appliedNotice = document.getElementById('applied-notice');
    const resumePreviewExp = document.getElementById('walkthrough-preview-exp');

    if (applyBtn && appliedNotice && resumePreviewExp) {
      applyBtn.addEventListener('click', () => {
        state.walkthroughSuggestionApplied = true;
        applyBtn.setAttribute('hidden', '');
        appliedNotice.removeAttribute('hidden');
        if (state.lang === 'ms') {
          resumePreviewExp.textContent = 'Menyelaras audit stok mingguan di 4 cawangan, mengurangkan varians inventori sebanyak 18%, dan berurusan terus dengan pembekal serantau.';
        } else {
          resumePreviewExp.textContent = 'Coordinated weekly stock audits across 4 outlets, reduced inventory variance by 18%, and liaised directly with regional suppliers.';
        }
      });
    }
  }

  function setupTemplateFilter() {
    const filterBtns = document.querySelectorAll('.gallery-filter-btn');
    const cards = document.querySelectorAll('.template-card');

    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const filter = btn.dataset.filter;
        state.templateFilter = filter;
        filterBtns.forEach(b => b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'));

        cards.forEach(card => {
          const tier = card.dataset.tier;
          if (filter === 'all' || tier === filter) {
            card.removeAttribute('hidden');
          } else {
            card.setAttribute('hidden', '');
          }
        });
      });
    });
  }

  function setupModal() {
    const modal = document.getElementById('pdf-sample-modal');
    const openBtns = document.querySelectorAll('[data-open-modal]');
    const closeBtn = document.getElementById('close-modal-btn');

    openBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        if (modal) modal.showModal();
      });
    });

    if (closeBtn && modal) {
      closeBtn.addEventListener('click', () => modal.close());
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.close();
      });
    }
  }

  // Initialize on DOM load
  document.addEventListener('DOMContentLoaded', () => {
    applyTheme(state.theme);
    applyLanguage(state.lang);

    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        applyTheme(state.theme === 'dark' ? 'light' : 'dark');
        state.theme = document.documentElement.dataset.theme;
      });
    }

    const langBtn = document.getElementById('lang-toggle-btn');
    if (langBtn) {
      langBtn.addEventListener('click', () => {
        applyLanguage(state.lang === 'en' ? 'ms' : 'en');
      });
    }

    document.querySelectorAll('.persona-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        renderPersona(btn.dataset.persona);
      });
    });

    const menuToggle = document.getElementById('menu-toggle');
    const mobileNav = document.getElementById('mobile-nav');
    if (menuToggle && mobileNav) {
      menuToggle.addEventListener('click', () => {
        const expanded = menuToggle.getAttribute('aria-expanded') === 'true';
        menuToggle.setAttribute('aria-expanded', !expanded);
        mobileNav.toggleAttribute('hidden');
      });
    }

    setupWalkthrough();
    setupTemplateFilter();
    setupModal();
  });
})();
