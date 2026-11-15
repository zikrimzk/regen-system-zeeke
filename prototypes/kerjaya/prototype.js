/* Fictional Phase 02B prototype. All interactions run in this browser. */
(() => {
  const {concept, screen} = document.body.dataset;
  const city = concept === 'city';
  const art = '../../../public/img/';
  const store = 'kerjaya.prototype.' + concept;
  const initial = {
    name: 'Aina Rahman',
    role: 'Operations coordinator',
    email: 'aina@example.com',
    location: 'Petaling Jaya, Selangor',
    summary: 'Operations coordinator with experience supporting retail teams. I keep order records organised, coordinate stock checks and communicate clearly with suppliers.',
    organisation: 'Syarikat Contoh',
    achievement: 'Coordinated weekly stock checks across two outlets and documented recurring discrepancies for the operations team.',
    course: 'Diploma in Business Studies',
    institution: 'Politeknik Contoh',
    skills: 'Stock coordination, spreadsheet reporting, supplier communication',
    design: 'modern',
  };
  const glyphs = {
    arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
    back: '<path d="M20 12H5m6-6-6 6 6 6"/>',
    home: '<path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-6h6v6"/>',
    file: '<path d="M6 3h8l4 4v14H6zM14 3v5h4M9 13h6m-6 4h6"/>',
    letter: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>',
    edit: '<path d="m14 5 5 5M5 19l3-1 12-12-3-3L5 15z"/>',
    view: '<path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2"/>',
    section: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    chevron: '<path d="m9 5 7 7-7 7"/>',
  };
  const icon = name => '<svg viewBox="0 0 24 24" aria-hidden="true">' + glyphs[name] + '</svg>';
  const safe = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;',
  })[character]);
  let draft = {...initial};
  try {
    const previous = JSON.parse(sessionStorage.getItem(store));
    if (previous) draft = {...draft, ...previous};
  } catch {}
  const resumeArt = name => art + 'templates/' + name + '-640.webp';
  const mark = '<a class="wordmark" href="index.html" aria-label="Kerjaya. home">Kerjaya<span>.</span></a>';
  const label = city ? 'City to Career' : 'Career Workspace';
  const action = (text, href, cls = 'primary') => '<a class="button ' + cls + '" href="' + href + '">' + text + icon('arrow') + '</a>';
  const navItems = [
    ['dashboard.html', 'Overview', 'home'],
    ['studio.html', 'Resume Studio', 'edit'],
    ['dashboard.html#documents', 'Documents', 'file'],
  ];
  const appNav = (accessibleLabel, cls) => '<nav class="' + cls + '" aria-label="' + accessibleLabel + '">' + navItems.map(
    ([href, title, image]) => '<a href="' + href + '">' + icon(image) + '<span>' + title + '</span></a>',
  ).join('') + '</nav>';
  const sampleLabel = '<span class="sample-label">Design prototype <span aria-hidden="true">·</span> Sample data</span>';

  function paper(data = draft) {
    return '<article class="paper" data-design="' + (data.design === 'classic' ? 'classic' : 'modern') + '" aria-label="Fictional resume layout">'
      + '<header><h2>' + safe(data.name || 'Your name') + '</h2><p class="paper-role">' + safe(data.role) + '</p><p>' + safe(data.location)
      + ' <span aria-hidden="true">·</span> ' + safe(data.email) + '</p></header>'
      + '<section><h3>Profile</h3><p>' + safe(data.summary) + '</p></section>'
      + '<section><h3>Experience</h3><strong>' + safe(data.role) + ' · ' + safe(data.organisation) + '</strong><p>' + safe(data.achievement) + '</p></section>'
      + '<section><h3>Education</h3><strong>' + safe(data.course) + '</strong><p>' + safe(data.institution) + '</p></section>'
      + '<section><h3>Skills</h3><p>' + safe(data.skills) + '</p></section></article>';
  }

  function landing() {
    return '<div class="public-shell">'
      + '<header class="public-header"><div class="public-inner">' + mark
      + '<button type="button" class="icon-button mobile-menu" id="public-menu-button" aria-expanded="false" aria-controls="public-nav" aria-label="Open navigation">' + icon('menu') + '</button>'
      + '<nav id="public-nav" aria-label="Main"><a href="#how">How it works</a><a href="#designs">Resume designs</a>'
      + '<a class="public-enter" href="dashboard.html">Sample workspace ' + icon('arrow') + '</a></nav></div></header>'
      + '<main id="main-content" tabindex="-1"><section class="public-hero"><div class="public-inner hero-grid">'
      + '<div class="hero-copy">' + sampleLabel
      + (city
        ? '<h1>Make your<br>next <em>move.</em></h1><p>Build a resume and cover letter for your next opportunity in Malaysia. Start with your own experience and see how it reads on the page.</p>'
        : '<h1>Your next application,<br><em>in one workspace.</em></h1><p>Write the resume, prepare the cover letter and check the PDF before you send it. Built for jobseekers in Malaysia.</p>')
      + '<div class="hero-actions">' + action(city ? 'Explore the sample' : 'Open sample workspace', 'dashboard.html')
      + '<a href="#designs" class="text-link">Compare designs</a></div></div>'
      + (city ? cityScene() : workspaceScene()) + '</div></section>'
      + '<section class="landing-story public-inner" id="how"><div class="story-lead"><h2>Bring your application together</h2><p>From an internship application to your next role.</p></div>'
      + '<div class="story-rows"><article>' + icon('edit') + '<div><h3>Build from your experience</h3><p>Organise projects, training and work history in Resume Studio.</p></div><a href="studio.html" aria-label="Open Resume Studio">' + icon('arrow') + '</a></article>'
      + '<article>' + icon('letter') + '<div><h3>Pair it with a cover letter</h3><p>See the fictional letter saved alongside the resume.</p></div><a href="dashboard.html#documents" aria-label="Open sample documents">' + icon('arrow') + '</a></article>'
      + '<article>' + icon('view') + '<div><h3>Check the layout</h3><p>Inspect the document before deciding what to send.</p></div><a href="#designs" aria-label="Compare resume layouts">' + icon('arrow') + '</a></article></div></section>'
      + designComparison() + '</main><footer class="public-footer"><div class="public-inner">' + mark + '<p>' + label
      + ' · Phase 02B concept preview</p><a href="dashboard.html">Open sample workspace</a></div></footer></div>';
  }

  function cityScene() {
    return '<figure class="city-scene"><img class="skyline" src="' + art + 'kl-skyline-1120.webp" srcset="' + art + 'kl-skyline-640.webp 640w, ' + art
      + 'kl-skyline-1120.webp 1120w" sizes="(max-width: 760px) 92vw, 51vw" width="1120" height="747" alt="">'
      + '<img class="hero-resume" src="' + resumeArt('modern') + '" width="640" height="905" alt="Fictional resume using ReGen’s Modern template">'
      + '<figcaption>Kuala Lumpur, Malaysia</figcaption></figure>';
  }

  function workspaceScene() {
    return '<figure class="workspace-scene" aria-label="Sample candidate workspace"><div class="scene-title"><span>Kerjaya.</span><span>Sample workspace</span></div>'
      + '<div class="scene-layout"><div class="scene-rail" aria-hidden="true"><span>' + icon('home') + ' Overview</span><span>' + icon('edit') + ' Studio</span>'
      + '<span>' + icon('file') + ' Documents</span></div><div class="scene-content"><p>Resume Studio</p><strong>Aina’s resume</strong><div class="scene-task">' + icon('check')
      + '<span>Contact details complete</span></div><div class="scene-task">' + icon('edit') + '<span>Continue with experience</span></div></div><div class="scene-paper">'
      + paper(initial) + '</div></div><figcaption>Fictional sample <a href="studio.html">Try Resume Studio ' + icon('arrow') + '</a></figcaption></figure>';
  }

  function designComparison() {
    return '<section class="design-comparison public-inner" id="designs"><div><h2>Find a layout that suits you</h2><p>Compare the same fictional resume in two existing ReGen designs.</p>'
      + '<div class="choice-group" role="group" aria-label="Sample template"><button type="button" data-show-design="modern" aria-pressed="true">Modern</button>'
      + '<button type="button" data-show-design="classic" aria-pressed="false">Classic</button></div><p id="compare-selection" class="muted" role="status">Modern template</p>'
      + '<a class="text-link" id="compare-pdf" href="../../../public/samples/modern.pdf">Open the sample PDF ' + icon('arrow') + '</a></div>'
      + '<figure><img id="compare-image" src="' + resumeArt('modern') + '" width="640" height="905" loading="lazy" alt="Fictional resume in the Modern template"></figure></section>';
  }

  function appHeader() {
    return '<header class="app-header"><div class="app-header-inner">' + mark
      + (city ? '<span class="header-divider"></span>' : appNav('Workspace', 'top-nav'))
      + sampleLabel + '<span class="avatar" aria-label="Aina Rahman, sample account">AR</span></div></header>';
  }

  function dashboard() {
    const studioLink = action('Continue editing', 'studio.html?section=experience');
    return '<div class="app-shell dashboard-shell">' + appHeader() + '<div class="dashboard-frame">'
      + (city ? '<aside class="app-rail">' + appNav('Workspace', 'rail-nav') + '</aside>' : '')
      + '<main id="main-content" class="dashboard-main" tabindex="-1">'
      + '<header class="workspace-intro"><div><h1>' + (city ? 'Welcome back, Aina.' : 'Your workspace') + '</h1><p>'
      + (city ? 'Pick up where you left off.' : 'Aina Rahman · Resume and cover letter') + '</p></div><a class="text-link intro-link" href="index.html">Public preview ' + icon('arrow') + '</a></header>'
      + '<div class="work-grid"><article class="resume-command"><div class="resume-copy"><p class="document-meta">' + icon('file') + ' Active resume</p><h2>Aina’s resume</h2>'
      + '<p class="document-date">Modern design · Saved 14 November, 9:42 am MYT</p><div class="resume-next"><strong>Next section</strong><span>Experience</span></div>'
      + '<div class="command-actions">' + studioLink + '<button class="button secondary" type="button" data-preview-open>' + icon('view') + ' Preview</button></div></div>'
      + '<figure class="resume-thumb">' + paper() + '</figure></article>'
      + '<aside class="workspace-side"><section class="work-next"><h2>Ready to finish?</h2><p>Add an example of how you helped a team or improved a process.</p>'
      + '<a href="studio.html?section=experience" class="text-link">Work on experience ' + icon('arrow') + '</a></section>'
      + '<section class="muted-status"><span class="status-dot"></span><p>Contact details complete</p></section></aside></div>'
      + '<section id="documents" class="documents" aria-labelledby="documents-heading"><h2 id="documents-heading">Your documents</h2>'
      + '<ul><li><span class="file-tile">' + icon('file') + '</span><div><strong>Aina’s resume</strong><p>Resume · 14 November</p></div>'
      + '<a href="studio.html" aria-label="Edit Aina’s resume" class="row-action">Edit ' + icon('chevron') + '</a></li>'
      + '<li><span class="file-tile">' + icon('letter') + '</span><div><strong>Operations Coordinator</strong><p>Cover letter · 12 November</p></div>'
      + '<button type="button" class="row-action" data-letter-open>Read ' + icon('chevron') + '</button></li></ul></section></main></div>'
      + appNav('Mobile workspace', 'mobile-dock') + previewDialog() + letterDialog() + '</div>';
  }

  const sections = [
    ['details', 'Personal details', 'Your contact details'],
    ['summary', 'Profile summary', 'A short introduction'],
    ['experience', 'Experience', 'Your roles and contributions'],
    ['education', 'Education', 'Qualifications and training'],
    ['skills', 'Skills', 'What you can do'],
  ];
  function sectionButtons() {
    return sections.map(([id, title]) => '<button type="button" data-section="' + id + '">' + icon(id === 'details' ? 'file' : 'section')
      + '<span>' + title + '</span></button>').join('');
  }

  function studio() {
    return '<div class="app-shell studio-shell">' + appHeader()
      + '<main id="main-content" class="studio-main" tabindex="-1"><div class="studio-top">'
      + '<div class="studio-context"><a href="dashboard.html">' + icon('back') + ' Workspace</a><h1>Aina’s resume</h1></div>'
      + '<div class="studio-tools"><button class="button secondary" data-template-open type="button">Template</button>'
      + (city ? '<button class="button secondary studio-modal-trigger" data-preview-open type="button">' + icon('view') + ' Preview</button>'
        : '<button class="button secondary desktop-preview-trigger" data-preview-open type="button">' + icon('view') + ' Full preview</button>')
      + '<button class="button primary desktop-save" data-save type="button">Save</button></div></div>'
      + '<div class="studio-mobile-bar"><button class="section-trigger" type="button" data-section-open aria-haspopup="dialog">' + icon('section') + ' Sections</button>'
      + (city ? '' : '<div class="choice-group mobile-modes" role="group" aria-label="Studio view"><button type="button" data-mode="write" aria-pressed="true">Write</button>'
        + '<button type="button" data-mode="preview" aria-pressed="false">Preview</button></div>') + '</div>'
      + '<div class="studio-grid" data-mode-view="write"><aside class="studio-outline"><h2>Sections</h2><nav aria-label="Resume sections">' + sectionButtons() + '</nav></aside>'
      + '<section class="studio-editor" id="editor-panel"><header><h2 id="editor-heading" tabindex="-1"></h2><p id="editor-hint"></p></header>'
      + '<form id="studio-form" aria-labelledby="editor-heading"><div id="fields"></div></form></section>'
      + '<section class="studio-canvas" id="canvas-panel" aria-labelledby="canvas-heading"><header><h2 id="canvas-heading">Resume preview</h2><p>Draft layout · Sample document</p></header>'
      + '<div class="canvas-sheet" data-paper></div></section></div>'
      + '<footer class="studio-footer"><p data-save-status role="status">Sample draft</p><button class="button primary mobile-save" type="button" data-save>Save draft</button></footer></main>'
      + '<dialog id="section-dialog" aria-labelledby="section-title"><header><h2 id="section-title">Resume sections</h2>' + closeButton()
      + '</header><nav class="section-dialog-nav" aria-label="Choose a resume section">' + sectionButtons() + '</nav></dialog>'
      + '<dialog id="template-dialog" aria-labelledby="template-title"><header><h2 id="template-title">Choose a template</h2>' + closeButton() + '</header>'
      + '<div class="template-grid">' + ['modern','classic'].map(name => '<button type="button" data-use-design="' + name + '" aria-pressed="false"><img src="' + resumeArt(name)
        + '" width="640" height="905" alt=""><span>' + (name === 'modern' ? 'Modern' : 'Classic') + '</span></button>').join('')
      + '</div><p class="dialog-note">The layout changes. Your draft stays in place.</p></dialog>' + previewDialog() + '</div>';
  }

  const closeButton = () => '<form method="dialog"><button class="icon-button" aria-label="Close dialog">' + icon('close') + '</button></form>';
  const previewDialog = () => '<dialog id="preview-dialog" class="preview-dialog" aria-labelledby="preview-title"><header><h2 id="preview-title">Resume preview</h2>' + closeButton()
    + '</header><div class="dialog-paper" data-paper></div><p class="dialog-note">Fictional draft preview. Browser rendering differs from the production PDF engine.</p></dialog>';
  const letterDialog = () => '<dialog id="letter-dialog" aria-labelledby="letter-title"><header><h2 id="letter-title">Operations Coordinator</h2>' + closeButton()
    + '</header><div class="letter-content"><p class="muted">Fictional cover letter · 12 November</p><p>Dear Hiring Manager,</p>'
    + '<p>I am applying for the Operations Coordinator role. In my current role, I organise order records, coordinate stock checks and report issues clearly so the team can follow up.</p>'
    + '<p>I would welcome the opportunity to contribute that practical experience to your team.</p><p>Kind regards,<br>Aina Rahman</p></div></dialog>';

  document.getElementById('prototype').innerHTML = {landing, dashboard, studio}[screen]();
  const query = selector => document.querySelector(selector);
  const all = selector => [...document.querySelectorAll(selector)];
  if (screen !== 'landing') {
    function updateNavigation() {
      const target = screen === 'studio' ? 'studio.html' : 'dashboard.html' + location.hash;
      all('.top-nav a,.rail-nav a,.mobile-dock a').forEach(link => {
        if (link.getAttribute('href') === target) link.setAttribute('aria-current', location.hash && screen === 'dashboard' ? 'location' : 'page');
        else link.removeAttribute('aria-current');
      });
    }
    updateNavigation();
    window.addEventListener('hashchange', updateNavigation);
  }
  function open(id) {
    const dialog = document.getElementById(id);
    if (dialog && !dialog.open) dialog.showModal();
  }
  function renderPapers() {
    all('[data-paper]').forEach(destination => { destination.innerHTML = paper(); });
  }
  all('[data-preview-open]').forEach(button => button.addEventListener('click', () => {
    renderPapers();
    open('preview-dialog');
  }));
  query('[data-letter-open]')?.addEventListener('click', () => open('letter-dialog'));

  const menu = query('#public-menu-button');
  if (menu) {
    function closeMenu() {
      menu.setAttribute('aria-expanded','false');
      menu.setAttribute('aria-label','Open navigation');
    }
    menu.addEventListener('click', () => {
      if (menu.getAttribute('aria-expanded') === 'true') return closeMenu();
      menu.setAttribute('aria-expanded','true');
      menu.setAttribute('aria-label','Close navigation');
    });
    query('#public-nav').addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') {
        closeMenu();
        menu.focus();
      }
    });
    const comparisons = all('[data-show-design]');
    comparisons.forEach(button => button.addEventListener('click', () => {
      const name = button.dataset.showDesign;
      const title = button.textContent;
      comparisons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      const image = query('#compare-image');
      image.src = resumeArt(name);
      image.alt = 'Fictional resume in the ' + title + ' template';
      query('#compare-pdf').href = '../../../public/samples/' + name + '.pdf';
      query('#compare-selection').textContent = title + ' template';
    }));
  }

  if (screen !== 'studio') return;
  const fieldSets = {
    details: [['name','Full name','text'], ['role','Job title','text'], ['email','Email address','email'], ['location','Location','text']],
    summary: [['summary','Profile summary','textarea']],
    experience: [['organisation','Organisation','text'], ['achievement','What you contributed','textarea']],
    education: [['course','Qualification','text'], ['institution','Institution','text']],
    skills: [['skills','Skills','textarea']],
  };
  const fields = query('#fields');
  function showSection(id, focus = false) {
    const section = sections.find(item => item[0] === id) || sections[0];
    query('#editor-heading').textContent = section[1];
    query('#editor-hint').textContent = section[2];
    fields.dataset.section = section[0];
    fields.innerHTML = fieldSets[section[0]].map(([key, caption, type]) => '<label for="field-' + key + '"><span>' + caption + '</span>'
      + (type === 'textarea' ? '<textarea id="field-' + key + '" name="' + key + '" rows="5" maxlength="1000">' + safe(draft[key]) + '</textarea>'
        : '<input id="field-' + key + '" name="' + key + '" type="' + type + '" maxlength="180" value="' + safe(draft[key]) + '">')
      + '</label>').join('');
    all('[data-section]').forEach(button => {
      if (button.dataset.section === section[0]) button.setAttribute('aria-current','step');
      else button.removeAttribute('aria-current');
    });
    if (focus) query('#editor-heading').focus();
  }
  function setMode(mode) {
    query('.studio-grid').dataset.modeView = mode;
    all('[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === mode)));
  }
  function setStatus(message) {
    query('[data-save-status]').textContent = message;
  }
  function save() {
    if (!query('#studio-form').reportValidity()) return;
    try {
      sessionStorage.setItem(store, JSON.stringify(draft));
      setStatus('Saved for this browser session');
    } catch {
      setStatus('Browser storage is unavailable. Keep this page open.');
    }
  }
  showSection(new URLSearchParams(location.search).get('section'));
  renderPapers();
  fields.addEventListener('input', event => {
    if (!Object.hasOwn(initial, event.target.name)) return;
    draft[event.target.name] = event.target.value;
    setStatus('Unsaved changes');
    renderPapers();
  });
  query('#studio-form').addEventListener('submit', event => { event.preventDefault(); save(); });
  all('[data-save]').forEach(button => button.addEventListener('click', save));
  all('[data-mode]').forEach(button => button.addEventListener('click', () => setMode(button.dataset.mode)));
  query('[data-section-open]').addEventListener('click', () => open('section-dialog'));
  all('[data-section]').forEach(button => button.addEventListener('click', () => {
    query('#section-dialog').close();
    setMode('write');
    showSection(button.dataset.section, true);
  }));
  query('[data-template-open]').addEventListener('click', () => {
    all('[data-use-design]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.useDesign === draft.design)));
    open('template-dialog');
  });
  all('[data-use-design]').forEach(button => button.addEventListener('click', () => {
    draft.design = button.dataset.useDesign;
    setStatus('Layout changed. Save to keep it.');
    renderPapers();
    query('#template-dialog').close();
  }));
})();
