document.addEventListener('DOMContentLoaded', () => {
  const text = (key, fields = {}) => ReGenText.get('demo.' + key).replace(/\{([a-z]+)\}/g, (_, field) => fields[field]);
  const previewVersion = document.querySelector('meta[name=regen-preview-version]')?.content || 'product2';
  const ids = ["classic","modern","minimal","heritage","essential","graduate","executive","editorial","precision","horizon","signature","atlas","meridian","keystone","counsel","impact"];
  let catalog = [];
  try { catalog = JSON.parse(document.getElementById('template-catalogue')?.textContent || '[]').filter(t => ids.includes(t.id)); } catch {}
  const profiles = {
    operations: {
      role: 'Operations Specialist',
      position: 'Operations Specialist', employer: 'Syarikat Contoh', period: '2022 - Present', experienceLabel: 'Experience', degree: 'Bachelor of Business Administration',
      summary: 'Organised and thoughtful, with experience coordinating projects, supporting teams and keeping everyday operations moving.',
      skills: 'Project coordination · Reporting · Team communication',
      bullets: ['Helped the team organise daily project tasks.', 'Prepared reports and kept project information up to date.', 'Worked with colleagues to follow up on outstanding actions.'],
      suggestion: 'Supported daily project coordination by organising tasks and following up on team actions.',
      letter: 'My experience coordinating project tasks, preparing reports and following up on team actions has given me a practical understanding of how to keep work organised. I would bring that same thoughtful, dependable approach to your team.',
    },
    graduate: {
      role: 'Graduate Business Analyst',
      position: 'Business research project', employer: 'Universiti Malaya', period: 'Final-year project', experienceLabel: 'Academic projects', degree: 'Bachelor of Business Administration',
      summary: 'Business graduate with experience contributing to group projects, researching business problems and presenting practical recommendations.',
      skills: 'Business research · Presentations · Teamwork',
      bullets: ['Worked with classmates on business research projects.', 'Prepared presentations to explain our findings.', 'Helped the group organise tasks and meet project deadlines.'],
      suggestion: 'Collaborated on business research projects, contributing findings and helping the team organise its work.',
      letter: 'Through my academic projects, I have developed experience researching business problems, presenting findings and working with others to meet deadlines. I am keen to bring this foundation to a professional team and continue learning through practical work.',
    },
    developer: {
      role: 'Software Developer',
      position: 'Software Developer', employer: 'Sample Software Studio', period: '2022 - Present', experienceLabel: 'Experience', degree: 'Bachelor of Computer Science',
      summary: 'Software developer with experience building web features, investigating defects and documenting technical work for the team.',
      skills: 'Web development · Debugging · Technical documentation',
      bullets: ['Built web features and fixed bugs in the application.', 'Worked with the team to review changes.', 'Wrote notes to help others understand the code.'],
      suggestion: 'Developed web application features and resolved defects to support reliable day-to-day use.',
      letter: 'My experience developing web features, investigating defects and documenting technical work has shaped a careful, collaborative approach to software development. I value readable code and working with colleagues to deliver dependable features.',
    },
  };
  const state = { template: 'modern', profile: 'operations', name: 'Zamir Zaini', company: 'Syarikat Contoh', applied: false, letterBuilt: false, step: 0 };
  const gallery = document.getElementById('design-gallery');
  const selector = document.getElementById('demo-template');
  const status = document.getElementById('demo-live-status');
  const dialog = document.getElementById('design-preview-dialog');
  const fullPreview = document.getElementById('design-full-preview');
  let previewId = 'classic';
  let previewTrigger = null;
  const safe = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const motion = () => matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';

  const heroImage = document.getElementById('hero-document-image');
  const heroControls = document.getElementById('hero-template-controls');
  const heroPdf = document.getElementById('hero-sample-pdf');
  if (heroImage) {
    heroControls.addEventListener('click', event => {
      const option = event.target.closest('[data-hero-template]');
      if (!option || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const selected = catalog.find(template => template.id === option.dataset.heroTemplate);
      if (!selected) return;
      event.preventDefault();
      for (const link of heroControls.querySelectorAll('a')) link.removeAttribute('aria-current');
      option.setAttribute('aria-current', 'true');
      heroImage.src = '/img/templates/' + selected.id + '-320.webp';
      heroImage.alt = text('fullTitle', {name:selected.name});
      heroPdf.href = option.href;
      document.getElementById('hero-template-status').textContent = text('selectedName', {name:selected.name});
      selectTemplate(selected.id);
    });
  }

  const thumbnailObserver = new ResizeObserver(entries => {
    for (const { target } of entries) {
      if (target === fullPreview) {
        const iframe = target.querySelector('iframe');
        if (!iframe) continue;
        if (iframe.style.width !== `${target.clientWidth}px`) fitFullPreview();
      }
    }
  });

  function fitFullPreview() {
    const iframe = fullPreview.querySelector('iframe');
    if (!iframe || !dialog.open) return;
    iframe.style.width = `${fullPreview.clientWidth}px`;
    iframe.style.transform = 'none';
    try {
      if (!iframe.contentDocument?.body) return;
      iframe.style.height = '1px';
      const height = Math.max(500, iframe.contentDocument.documentElement.scrollHeight, iframe.contentDocument.body.scrollHeight);
      iframe.style.height = `${height}px`;
      fullPreview.style.height = `${height}px`;
    } catch { /* THE FRAME REMAINS A READ-ONLY PREVIEW. */ }
  }

  function createFrame(id, title) {
    const iframe = document.createElement('iframe');
    const path = `/demo/templates/${id}?v=${encodeURIComponent(previewVersion)}`;
    iframe.src = path;
    iframe.title = title;
    iframe.loading = 'lazy';
    iframe.tabIndex = -1;
    iframe.setAttribute('sandbox', 'allow-same-origin');
    return iframe;
  }

  function selectTemplate(id) {
    if (!catalog.some(template => template.id === id)) id = catalog[0]?.id;
    if (!id) return;
    state.template = id;
    selector.value = id;
    renderLetter();
    const selected = catalog.find(template => template.id === id);
    document.getElementById('demo-design-description').textContent = selected.description;
    document.querySelectorAll('[data-quick-template]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.quickTemplate === id)));
    document.querySelectorAll('[data-select-design]').forEach(button => {
      const active = button.dataset.selectDesign === id;
      button.setAttribute('aria-pressed', String(active));
      button.textContent = text(active ? 'selected' : 'choose');
      const name = catalog.find(item => item.id === button.dataset.selectDesign).name;
      button.setAttribute('aria-label', text(active ? 'selectedName' : 'chooseName', {name}));
      button.closest('.design-item').classList.toggle('is-selected', active);
    });
    document.querySelectorAll('[data-paper]').forEach(paper => { paper.className = `demo-paper template-${id}`; });
    document.querySelectorAll('[data-start]').forEach(link => { link.href = `/register?template=${id}`; });
    status.textContent = `${selected.name} selected. Your resume and letter share this design.`;
  }

  function renderGallery() {
    thumbnailObserver.disconnect();
    gallery.replaceChildren();
    for (const template of catalog) {
      const article = document.createElement('article');
      article.className = 'design-item';
      article.dataset.category = template.tier;
      const preview = document.createElement('div');
      preview.className = 'design-thumbnail';
      const previewButton = document.createElement('button');
      previewButton.type = 'button';
      previewButton.className = 'design-preview-trigger';
      previewButton.setAttribute('aria-label', text('fullDesign', {name:template.name}));
      const window = document.createElement('div');
      window.className = 'design-thumbnail-window';
      window.setAttribute('aria-hidden', 'true');
      const image = document.createElement('img');
      image.src = `/img/templates/${template.id}-320.webp?v=${previewVersion}`;
      image.srcset = `/img/templates/${template.id}-320.webp?v=${previewVersion} 320w, /img/templates/${template.id}-640.webp?v=${previewVersion} 640w, /img/templates/${template.id}-1280.webp?v=${previewVersion} 1280w`;
      image.sizes = '(max-width: 600px) 65vw, (max-width: 1000px) 35vw, 320px';
      image.width = 640;
      image.height = 905;
      image.alt = '';
      image.loading = 'lazy';
      image.decoding = 'async';
      window.append(image);
      preview.append(window, previewButton);
      previewButton.addEventListener('click', () => openPreview(template.id, previewButton));
      const footer = document.createElement('div');
      footer.className = 'design-item-footer';
      const heading = document.createElement('h3');
      heading.textContent = template.name;
      const select = document.createElement('button');
      select.type = 'button';
      select.className = 'design-select';
      select.dataset.selectDesign = template.id;
      select.setAttribute('aria-label', text('chooseName', {name:template.name}));
      select.addEventListener('click', () => selectTemplate(template.id));
      const identity = document.createElement('div');
      const tier = document.createElement('span');tier.className='design-tier';tier.textContent=ReGenText.get(template.tier==='premium'?'public.designPremium':'public.designBasic');
      identity.append(tier,heading);
      if (template.popular) { const badge=document.createElement('span');badge.className='template-popular-badge';badge.textContent=text('popular');identity.append(badge); }
      footer.append(identity,select);
      article.append(preview, footer);
      gallery.append(article);
    }
    selector.replaceChildren(...catalog.map(template => new Option(template.name, template.id)));
    gallery.setAttribute('aria-busy', 'false');
    document.querySelectorAll('[data-quick-template]').forEach(button => button.hidden=!catalog.some(t=>t.id===button.dataset.quickTemplate));
    if (!catalog.length) { gallery.textContent=text('galleryError'); selector.disabled=true; document.getElementById('hero-full-preview').disabled=true; }
    selectTemplate(state.template);
  }

  function openPreview(id, trigger) {
    previewId = id;
    previewTrigger = trigger;
    document.getElementById('design-pdf-sample').href='/samples/'+id+'.pdf?v='+previewVersion;
    document.getElementById('design-preview-title').textContent = text('fullTitle', {name:catalog.find(template => template.id === id).name});
    fullPreview.replaceChildren(createFrame(id, text('previewResume')));
    fullPreview.querySelector('iframe').addEventListener('load', () => {
      fitFullPreview();
      fullPreview.querySelector('iframe')?.contentDocument?.fonts?.ready.then(fitFullPreview);
    }, { once: true });
    dialog.showModal();
    thumbnailObserver.observe(fullPreview);
  }
  document.getElementById('close-design-preview').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { thumbnailObserver.unobserve(fullPreview); fullPreview.replaceChildren(); previewTrigger?.focus(); });
  document.getElementById('use-preview-design').addEventListener('click', () => {
    selectTemplate(previewId);
    dialog.close();
    setStep(0);
    document.getElementById('try-it').scrollIntoView({ behavior: motion() });
  });

  function renderLetter() {
    window.ReGenDocumentPreview?.update({ template: state.template, name: state.name, company: state.company, profile: profiles[state.profile], profileId: state.profile, applied: state.applied });
  }
  function updateProgress() {
    const count = 1 + Number(Boolean(state.detailsTouched)) + Number(state.applied) + Number(state.letterBuilt);
    document.getElementById('demo-progress').value = count;
    document.getElementById('demo-progress-copy').textContent = text('progress', {count});
  }
  function updateResume() {
    const profile = profiles[state.profile];
    const name=state.name.trim()||text('yourName');
    document.querySelector('.studio-document-head>span').firstChild.textContent=name+' ';
    document.getElementById('demo-original').textContent = profile.bullets[0];
    document.getElementById('demo-suggested').textContent = profile.suggestion;
    renderLetter();
    updateProgress();
  }

  function setStep(index, focus = false) {
    state.step = index;
    if (index >= 2) state.detailsTouched = true;
    updateProgress();
    document.querySelectorAll('[data-step]').forEach(button => {
      const selected = Number(button.dataset.step) === index;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
      if (selected && focus) button.focus();
    });
    document.querySelectorAll('.demo-step-panel').forEach((panel, panelIndex) => { panel.hidden = panelIndex !== index; });
    const letterVisible = index === 3 && state.letterBuilt;
    document.getElementById('demo-resume-content').hidden = letterVisible;
    document.getElementById('demo-letter-content').hidden = !letterVisible;
    document.getElementById('demo-document-label').textContent = text(letterVisible ? 'previewLetter' : 'previewResume');
    status.textContent = text(['designCopy', 'editCopy', 'reviewCopy', 'letterCopy'][index]);
  }

  document.querySelectorAll('[data-step]').forEach(button => button.addEventListener('click', () => setStep(Number(button.dataset.step))));
  document.querySelector('.demo-step-tabs').addEventListener('keydown', event => {
    const keys = { ArrowRight: (state.step + 1) % 4, ArrowLeft: (state.step + 3) % 4, Home: 0, End: 3 };
    if (!(event.key in keys)) return;
    event.preventDefault();
    setStep(keys[event.key], true);
  });
  document.querySelectorAll('[data-next]').forEach(button => button.addEventListener('click', () => setStep(Number(button.dataset.next), true)));
  document.querySelectorAll('[data-jump-step]').forEach(link => link.addEventListener('click', () => setStep(Number(link.dataset.jumpStep))));
  document.querySelectorAll('[data-quick-template]').forEach(button => button.addEventListener('click', () => selectTemplate(button.dataset.quickTemplate)));
  selector.addEventListener('change', () => selectTemplate(selector.value));
  document.getElementById('demo-name').addEventListener('input', event => { state.name = event.target.value; state.detailsTouched = true; updateResume(); });
  document.getElementById('demo-company').addEventListener('input', event => { state.company = event.target.value; renderLetter(); });
  document.getElementById('demo-profile').addEventListener('change', event => {
    if (!(event.target.value in profiles)) return;
    state.profile = event.target.value;
    state.detailsTouched = true;
    document.querySelectorAll("[data-persona]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.persona === state.profile)));
    state.applied = false;
    document.getElementById('demo-suggestion').hidden = true;
    document.getElementById('demo-review').hidden = false;
    document.getElementById('demo-apply').hidden = true;
    updateResume();
  });
  document.getElementById('demo-review').addEventListener('click', event => {
    document.getElementById('demo-suggestion').hidden = false;
    document.getElementById('demo-apply').hidden = false;
    event.currentTarget.hidden = true;
    status.textContent = text('suggestionReady');
  });
  document.getElementById('demo-apply').addEventListener('click', event => {
    state.applied = true;
    updateResume();
    event.currentTarget.hidden = true;
    status.textContent = text('applied');
  });
  document.getElementById('demo-letter').addEventListener('click', () => {
    state.letterBuilt = true;
    updateProgress();
    renderLetter();
    setStep(3);
    document.getElementById('demo-letter').textContent = text('refreshLetter') + ' →';
    status.textContent = text('letterReady');
  });
  document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll('[data-filter]').forEach(option => option.setAttribute('aria-pressed', String(option === button)));
    gallery.querySelectorAll('.design-item').forEach(item => { item.hidden = button.dataset.filter !== 'all' && item.dataset.category !== button.dataset.filter; });
  }));
  document.querySelectorAll('[data-start]').forEach(link => link.addEventListener('click', () => {
    try { sessionStorage.setItem('regen:onboarding-template', state.template); } catch { /* STORAGE IS OPTIONAL. */ }
  }));

  const menuToggle = document.querySelector('.site-menu-toggle');
  const navigation = document.getElementById('site-navigation');
  function closeMenu() { navigation.classList.remove('is-open'); menuToggle.setAttribute('aria-expanded', 'false'); menuToggle.setAttribute('aria-label', ReGenText.get('nav.open')); }
  menuToggle.addEventListener('click', () => {
    const open = menuToggle.getAttribute('aria-expanded') !== 'true';
    if (open) window.dispatchEvent(new CustomEvent('regen:menu-open',{detail:{owner:'site-navigation'}}));
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', ReGenText.get(open ? 'nav.close' : 'nav.open'));
    navigation.classList.toggle('is-open', open);
  });
  navigation.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
  window.addEventListener('regen:menu-open', event => {if (event.detail?.owner !== 'site-navigation') closeMenu();});
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && menuToggle.getAttribute('aria-expanded') === 'true') { closeMenu(); menuToggle.focus(); } });
  document.addEventListener('click', event => { if (!event.target.closest('.site-header')) closeMenu(); });
  matchMedia('(min-width: 851px)').addEventListener('change', closeMenu);
  document.querySelectorAll('[data-gallery-scroll]').forEach(button => button.addEventListener('click', () => {
    gallery.scrollBy({left: Number(button.dataset.galleryScroll) * gallery.clientWidth * .9, behavior:motion()});
  }));
  document.getElementById('site-year').textContent = new Date().getFullYear();
  document.getElementById('hero-full-preview').addEventListener('click', event => openPreview(state.template, event.currentTarget));
  document.querySelectorAll('[data-jump-step]').forEach(link => link.addEventListener('click', () => setStep(Number(link.dataset.jumpStep), true)));
  document.querySelectorAll('[data-persona]').forEach(button => button.addEventListener('click', () => { const field=document.getElementById('demo-profile'); field.value=button.dataset.persona; field.dispatchEvent(new Event('change')); status.textContent=`${profiles[state.profile].role} sample selected. Try editing it in the walkthrough.`; }));
  renderGallery();
  updateResume();
  setStep(0);

});
