window.ReGenDocumentPreview = (() => {
  let model = null;
  const version = document.querySelector('meta[name=regen-preview-version]')?.content || 'product2';
  const frames = new Set();
  const originalNodes = new WeakMap();
  const originalDates = new WeakMap();
  const visible = new Set();
  function refresh(frame) {
    if (!model) return;
    const kind = frame.dataset.documentPreview === 'letter' ? 'letters' : 'templates';
    const path = `/demo/${kind}/${model.template}?v=${encodeURIComponent(version)}`;
    if (frame.getAttribute('src') !== path) frame.src = path;
    else patch(frame);
  }
  // Hidden letters and below-fold samples only load when they can be seen.
  const visibility = new IntersectionObserver(entries => {
    for (const {target,isIntersecting} of entries) {
      if (isIntersecting) { visible.add(target); refresh(target); }
      else visible.delete(target);
    }
  }, {rootMargin:'160px 0px'});
  const observer = new ResizeObserver(entries => {
    entries.forEach(({target}) => {
      const frame = target.querySelector('[data-document-preview]');
      if (frame) frame.style.transform = `scale(${target.clientWidth / 794})`;
    });
  });
  function patch(frame) {
    const doc = frame.contentDocument;
    if (!model || !doc?.body) return;
    const set = (selector, value, scope = doc) => { const element = scope.querySelector(selector); if (element && value) element.textContent = value; };
    set('.cv-name', model.name.trim() || 'Your name');
    if (frame.dataset.documentPreview === 'letter') {
      const paragraphs = [...doc.body.querySelectorAll(':scope > p')];
      if (paragraphs.length >= 7) {
        paragraphs[1].replaceChildren(doc.createTextNode('Hiring Manager'), doc.createElement('br'), doc.createTextNode(model.company.trim() || 'Your chosen company'));
        set('.letter-subject span', `Application for ${model.profile.role}`);
        paragraphs[3].textContent = `I am applying for the ${model.profile.role} opportunity at ${model.company.trim() || 'your organisation'}.`;
        paragraphs[4].textContent = model.profile.letter;
        paragraphs.at(-1).replaceChildren(doc.createTextNode('Kind regards,'), doc.createElement('br'), doc.createTextNode(model.name.trim() || 'Your name'));
      }
      return;
    }
    set('.cv-title', model.profile.role);
    set('.cv-summary', model.profile.summary);
    const sections = [...doc.querySelectorAll('.cv-section')];
    const section = name => sections.find(element => element.querySelector('.sec-hdr')?.textContent.toLowerCase().includes(name));
    const experience = section('experience');
    if (experience) {
      const first = experience.querySelector('.cv-entry');
      set('.cv-entry-left strong', model.profile.position, first);
      set('.cv-entry-meta', model.profile.employer, first);
      const date = first?.querySelector('.cv-entry-date');
      if (date) { if (!originalDates.has(date)) originalDates.set(date,date.textContent); date.textContent = model.profileId === 'operations' ? originalDates.get(date) : model.profile.period; }
      experience.querySelectorAll('.cv-entry').forEach((entry, index) => { entry.hidden = index > 0 && model.profileId !== 'operations'; });
      const list = first?.querySelector('.bullets');
      if (list) list.replaceChildren(...model.profile.bullets.map((text, index) => { const li = doc.createElement('li'); li.textContent = index === 0 && model.applied ? model.profile.suggestion : text; return li; }));
    }
    const education = section('education');
    if (education) set('.cv-entry-left strong', model.profile.degree, education);
    const skills = section('skills');
    skills?.querySelectorAll('.cv-skill-row').forEach((row,index) => {
      if (!originalNodes.has(row)) originalNodes.set(row,[...row.childNodes].map(node => node.cloneNode(true)));
      row.hidden = model.profileId !== 'operations' && index > 0;
      if (model.profileId === 'operations') row.replaceChildren(...originalNodes.get(row).map(node => node.cloneNode(true)));
      else if (index === 0) row.textContent = model.profile.skills;
    });
  }
  function init(root = document) {
    root.querySelectorAll('[data-document-preview]:not([data-preview-bound])').forEach(frame => {
      frame.dataset.previewBound = 'true';
      frames.add(frame);
      visibility.observe(frame);
      frame.addEventListener('load', () => patch(frame));
      if (frame.parentElement) observer.observe(frame.parentElement);
    });
  }
  function update(value) {
    model = value;
    visible.forEach(refresh);
  }
  init();
  return { init, update };
})();
