(() => {
  const guidance = {
    personal: ['Make it easy to contact you', 'Use the name you apply with, a professional email and a phone number with its country code. Your location helps employers understand where you are based.', 'Zamir Zaini | zamir@example.com | +60 12 345 6789 | Melaka, Malaysia'],
    summary: ['Introduce what you bring', 'Write two to four focused sentences. Include your experience level, strongest relevant skills and the work you want to do.', 'Operations specialist with experience coordinating projects, preparing reports and documenting team processes. Brings a structured approach and clear communication to day-to-day work.'],
    education: ['Show the qualifications that matter', 'Start with your most recent qualification. Include the institution, field of study and dates. Add your result if it strengthens your application.', 'Bachelor of Business Administration, Universiti Malaya. Include a relevant final-year project if you are a fresh graduate.'],
    experience: ['Turn responsibilities into evidence', 'Add your recent roles first. Write one point per line, using an action, what you worked on and an outcome you can support. Keep the facts accurate.', 'Coordinated weekly project updates and followed up on outstanding actions with team members.'],
    projects: ['Make your contribution clear', 'Include academic, personal or professional projects that show relevant skills. Explain what you built or delivered and your own role in the work.', 'Built a stock-tracking dashboard using Excel to help the team review item availability.'],
    extracurricular: ['Connect activities to useful skills', 'Include leadership, volunteering and activities that demonstrate relevant teamwork, communication or organisation.', 'Coordinated volunteers and organised the event schedule for a university careers programme.'],
    skills: ['Choose skills you can explain', 'Prioritise skills relevant to your target role. Group tools and technical skills clearly, and use accurate language proficiency levels.', 'Microsoft Excel, reporting, project coordination and business communication.'],
    achievements: ['Explain what you earned or achieved', 'Include meaningful awards or achievements, with the awarding organisation and year when relevant. Put each item on its own line.', 'Faculty academic excellence award, 2024.'],
    certifications: ['Add relevant professional learning', 'Include the certification name, issuing organisation and year. Add an expiry date when the qualification has one.', 'Project management fundamentals, issuing organisation, 2024.'],
    references: ['Include referees when requested', 'Most job resumes can omit this section. For an application that asks for referees, confirm their permission and contact details first.', 'Name, job title, organisation and an agreed professional email or phone number.'],
    additional: ['Choose evidence that serves the application', 'An academic CV can include research, teaching, publications, presentations and funding. A job resume needs only relevant additional sections.', 'Tan, A. and Lim, J. (2025). A supplied publication title. Journal or venue, volume and pages. State submitted or in preparation when appropriate.'],
  };
  const tips={
    personal:['Use a reachable personal email and phone number. Open your portfolio and LinkedIn links before applying.','City or region is usually enough. Leave out age, gender, identity numbers and a street address unless specifically requested.','A target headline should be clear about your actual experience; it must not imply a job or seniority you have not held.'],
    summary:['A summary highlights relevant evidence. An objective explains a next step using real strengths, especially for a graduate or career changer.','Write the profile after gathering your evidence. Keep it short and skip it if it adds nothing.','Use plain professional language. Numbers and years of experience belong here only when you can substantiate them.'],
    education:['Use the official qualification and institution names. Distinguish an expected graduation from a completed award.','Grades, relevant coursework and honours are optional. Give a grading scale when it helps the reader interpret a result.','Education and projects can come first for a graduate. Experienced applicants can keep education brief.'],
    experience:['Lead with your recent relevant roles. The PDF can sort dated entries newest first in Document settings.','Try action + work or method + a supported result. Specific qualitative outcomes are useful when no reliable metric exists.','Use past tense for completed contributions and present tense for ongoing duties. Keep punctuation consistent.','Keep support work and leadership distinct. A career gap does not need an invented explanation.'],
    projects:['State the project purpose, your own contribution and tools actually used. Distinguish team work from your individual work.','Student, personal, research and volunteer projects are valid evidence. Do not present them as paid employment.'],
    extracurricular:['Volunteering and student leadership can demonstrate experience without a paid job.','Explain a concrete contribution and its context. Do not infer a team size, impact or responsibility from a role title.'],
    skills:['Prioritise tools and methods relevant to the role; separate technical tools from interpersonal strengths.','Support qualities such as communication or leadership with examples elsewhere. Avoid ratings or proficiency claims you cannot explain.','Use only language proficiency levels you actually know. Job-description keywords never prove a skill.'],
    achievements:['Include the real award or contribution, issuer, date and significance where relevant.','An ordinary duty is not automatically an award. Keep recognition and outcomes accurate.'],
    certifications:['Use the exact credential or licence title and issuer. Include issue and expiry dates where relevant.','Keep completed, in-progress and expired status distinct. Do not describe attendance as certification.'],
    additional:['Use a consistent citation style and retain coauthors, dates and publication status. Submitted does not mean published.','Keep grants applied for separate from grants awarded. Describe your research or teaching contribution accurately.','Add interests or affiliations only when useful; extra sections are not a completeness requirement.'],
    references:['Referees are optional unless requested or expected for the application.','Get permission before sharing someone else’s contact information.'],
  };
  let dispose = () => {};
  document.addEventListener('regen:section-ready', event => {
    dispose();
    const content = document.getElementById('step-content');
    const section = event.detail.section;
    const item = guidance[section];
    if (!content || !item) return;
    const controller = new AbortController();
    const on = (element, type, handler) => element.addEventListener(type, handler, {signal:controller.signal});
    const details = document.createElement('details');
    details.className = 'candidate-guidance';
    const summary = document.createElement('summary');
    const title = document.createElement('span'); title.textContent = 'Writing guide';
    const state = document.createElement('span'); state.className = 'coach-state';
    summary.append(title, state);
    const body = document.createElement('div'); body.className = 'coach-body';
    const heading = document.createElement('h3'); heading.textContent = item[0];
    const help = document.createElement('p'); help.textContent = item[1];
    const sample = document.createElement('p'); sample.className = 'guidance-example'; sample.textContent = 'Example: ' + item[2];
    const principles=document.createElement('ul');principles.className='writing-principles';(tips[section]||[]).forEach(text=>{const li=document.createElement('li');li.textContent=text;principles.append(li);});
    const checklist = document.createElement('div'); checklist.className = 'coach-checklist';
    const actions = document.createElement('div'); actions.className = 'coach-actions';
    const check = document.createElement('button'); check.type = 'button'; check.className = 'btn btn-secondary btn-sm'; check.textContent = 'Check details';
    const feedback = document.createElement('p'); feedback.className = 'coach-feedback'; feedback.setAttribute('role','status');
    actions.append(check); body.append(heading, help, sample, principles, checklist, actions, feedback); details.append(summary, body);
    const header = content.querySelector('.step-header');
    if (header) header.after(details);

    const fields = () => [...content.querySelectorAll('input[required],select[required],textarea[required]')].filter(field => !field.disabled && !field.closest('.candidate-guidance'));
    const label = field => (field.closest('.form-group')?.querySelector('.form-label')?.textContent || 'Details').replace('*','').trim();
    function focusField(field) {
      const card = field.closest('.entry-card');
      card?.querySelector('.entry-collapse[aria-expanded="false"]')?.click();
      field.focus();
    }
    function update() {
      const missing = fields().filter(field => !field.value.trim());
      const cards = content.querySelectorAll('.entry-card').length;
      const words = String(content.querySelector('#s-summary')?.value || '').trim().split(/\s+/).filter(Boolean).length;
      const points = [...content.querySelectorAll('.points-editor')].reduce((count,field) => count + ReGenPoints.lines(field.value).length, 0);
      const skills = [...content.querySelectorAll('[data-comma-list]')].reduce((count,field) => count + field.value.split(/[,;\n]/).filter(value => value.trim()).length, 0);
      state.textContent = section === 'summary' ? `${words} words` : missing.length ? `${missing.length} ${missing.length === 1 ? 'detail' : 'details'} to add` : cards ? `${cards} ${cards === 1 ? 'entry' : 'entries'}` : points ? `${points} ${points === 1 ? 'item' : 'items'}` : skills ? `${skills} skills` : section === 'personal' ? 'Contact essentials' : 'Optional section';
      checklist.replaceChildren();
      missing.slice(0,3).forEach(field => {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = `Add ${label(field).toLowerCase()}`;
        button.addEventListener('click', () => focusField(field)); checklist.append(button);
      });
      enhanceFields(content);
      if(['experience','projects','extracurricular'].includes(section))content.querySelectorAll('.points-editor').forEach(field=>addContributionBuilder(field,on));
    }
    on(check,'click', () => {
      window.FormCards?.expand(content);
      const valid = window.ZeekeForm?.validateScope(content);
      feedback.textContent = valid ? 'Required fields are complete. Confirm the facts and review the wording before continuing.' : 'A few details need attention. Start with the highlighted field.';
      if (section === 'references' && [...content.querySelectorAll('.entry-card')].some(card => !card.querySelector('.ref-email').value.trim() && !card.querySelector('.ref-phone').value.trim())) feedback.textContent = 'Add an agreed email or phone number so your referee can be contacted.';
    });

    if (section === 'summary') {
      const choices = document.createElement('div'); choices.className = 'coach-choices'; choices.setAttribute('role','group'); choices.setAttribute('aria-label','Example profile outlines');
      const outline = document.createElement('p'); outline.className = 'coach-outline';
      const frames = {
        'Starting out':'Your qualification and target role. A relevant project or placement. The skills you will bring to the team.',
        'Experienced':'Your role and relevant experience. One strength backed by an outcome. The work you want to focus on next.',
        'Career change':'Your previous experience. Transferable skills with evidence. How they connect to the role you want.'
      };
      Object.entries(frames).forEach(([name,frame],index) => {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = name; button.setAttribute('aria-pressed',String(index === 0));
        on(button,'click', () => { choices.querySelectorAll('button').forEach(choice => choice.setAttribute('aria-pressed',String(choice === button))); outline.textContent = frame; });
        choices.append(button); if (!index) outline.textContent = frame;
      });
      sample.replaceWith(choices, outline);
      const approach=document.createElement('button');approach.type='button';approach.className='btn btn-secondary btn-sm';approach.textContent='Set my writing approach';on(approach,'click',()=>document.getElementById('resume-layout-settings')?.click());actions.prepend(approach);
    }
    if (section === 'skills') {
      const tidy = document.createElement('button'); tidy.type = 'button'; tidy.className = 'btn btn-secondary btn-sm'; tidy.textContent = 'Tidy skill lists';
      on(tidy,'click', () => {
        let removed = 0;
        content.querySelectorAll('[data-comma-list]').forEach(field => {
          const items = field.value.split(/[,;\n]/).map(value => value.trim()).filter(Boolean);
          const seen = new Set(); const unique = items.filter(value => {const key = value.toLocaleLowerCase(); if (seen.has(key)) return false; seen.add(key); return true;});
          const next = unique.join(', '); removed += items.length - unique.length;
          if (field.value !== next) {field.value = next; field.dispatchEvent(new Event('input',{bubbles:true}));}
        });
        feedback.textContent = removed ? `${removed} duplicate ${removed === 1 ? 'skill removed' : 'skills removed'}. Your groups are preserved.` : 'Lists tidied. No duplicate skills within each group.';
      }); actions.prepend(tidy);
    }
    if (section === 'achievements' || section === 'certifications') addItemComposer(body, section, feedback, on);

    let scheduled = false;
    const schedule = () => { if (scheduled) return; scheduled = true; queueMicrotask(() => { scheduled = false; if (!controller.signal.aborted) update(); }); };
    on(content,'input', event => {if (!event.target.closest('.candidate-guidance,.contribution-builder')) schedule();});
    on(content,'change', event => {if (!event.target.closest('.candidate-guidance,.contribution-builder')) schedule();});
    const observer = new MutationObserver(records => {
      if (records.some(record => [...record.addedNodes,...record.removedNodes].some(node => node.nodeType === 1 && (node.matches('.entry-card') || node.querySelector('.entry-card'))))) schedule();
    });
    observer.observe(content,{childList:true,subtree:true});
    dispose = () => {controller.abort(); observer.disconnect();};
    update();
  });

  function enhanceFields(content) {
    content.querySelectorAll('.edu-degree').forEach(field => {
      let hint = field.parentElement.querySelector('.qualification-guide');
      if (!hint) {hint = document.createElement('p'); hint.className = 'form-hint qualification-guide'; hint.id = `${field.closest('.entry-card').id}-qualification-guide`; field.after(hint); field.setAttribute('aria-describedby',hint.id);}
      const value = field.value.toLowerCase();
      const text = /spm|igcse|gcse|o[ -]?level/.test(value) ? 'Use your official qualification title. Add subject grades, such as 5A+ 2A, in the results field.'
        : /stpm|a[ -]?level|matric|foundation|baccalaureate/.test(value) ? 'Include your stream if relevant. Use the official CGPA with its scale, or subject grades such as AAB.'
        : /ph\.?d|doctor/.test(value) ? 'Include your discipline. You can describe relevant research in Projects; a result is optional.'
        : /diploma|bachelor|master|degree|honour/.test(value) ? 'Include your field of study. Results are optional: use a CGPA with its scale or your official classification.'
        : /certificat|professional|course/.test(value) ? 'Use the exact award title. Short courses and professional credentials can go in Certifications.'
        : 'Use the title on your certificate, followed by your field of study.';
      if (hint.textContent !== text) hint.textContent = text;
    });
    content.querySelectorAll('.points-editor').forEach(field => {
      let note = field.parentElement.querySelector('.writing-feedback');
      if (!note) {note = document.createElement('p'); note.className = 'writing-feedback'; field.after(note);}
      const items = ReGenPoints.lines(field.value);
      const long = items.some(item => item.split(/\s+/).length > 40);
      const ending=items.filter(item=>/[.!?]$/.test(item)).length;
      const text = items.length ? `${items.length} ${items.length === 1 ? 'point' : 'points'}${long ? ' · Shorten longer points where possible.' : ''}${ending>0&&ending<items.length?' · Check consistent end punctuation.':''}` : 'One clear point per line.';
      if (note.textContent !== text) note.textContent = text;
    });
  }

  function addContributionBuilder(field,on){
    if(field.parentElement.querySelector('.contribution-builder'))return;
    const builder=document.createElement('details');builder.className='contribution-builder';
    const summary=document.createElement('summary');summary.textContent='Build a contribution point';
    const body=document.createElement('div');body.className='contribution-body';
    const hint=document.createElement('p');hint.className='form-hint';hint.textContent='Start with something you actually did. Add a method or result only when you know it. Numbers are optional.';
    const inputs=[];
    [['Action and work','Prepared weekly inventory reports'],['How or scope (optional)','using Excel and warehouse stock records'],['Purpose or result (optional)','to help the team plan replenishment']].forEach(([label,placeholder],index)=>{
      const group=document.createElement('div');group.className='form-group';
      const caption=document.createElement('label');caption.className='form-label';caption.textContent=label;
      const input=document.createElement('input');input.type='text';input.className='form-input';input.id=`${field.id}-contribution-${index}`;input.maxLength=index?200:240;input.placeholder=placeholder;caption.htmlFor=input.id;
      group.append(caption,input);body.append(group);inputs.push(input);
    });
    const preview=document.createElement('p');preview.className='contribution-preview';preview.setAttribute('aria-live','polite');
    const feedback=document.createElement('p');feedback.className='form-hint';feedback.setAttribute('role','status');
    const add=document.createElement('button');add.type='button';add.className='btn btn-secondary btn-sm';add.textContent='Add point';add.disabled=true;
    const sentence=()=>inputs.map(input=>input.value.trim().replace(/\s+/g,' ').replace(/[.;]+$/,'')).filter(Boolean).join(' ');
    on(builder,'input',()=>{preview.textContent=sentence();add.disabled=!inputs[0].value.trim();});
    on(add,'click',()=>{
      const line=sentence();if(!inputs[0].value.trim())return;
      const existing=ReGenPoints.lines(field.value),next=ReGenPoints.format([...existing,line]);
      if(existing.length>=50||(field.maxLength>0&&next.length>field.maxLength)){feedback.textContent='This entry is full. Edit an existing point before adding another.';return;}
      if(existing.some(item=>item.toLowerCase()===line.toLowerCase())){feedback.textContent='This point is already in the entry.';return;}
      field.value=next;field.dispatchEvent(new Event('input',{bubbles:true}));inputs.forEach(input=>{input.value='';});preview.textContent='';add.disabled=true;feedback.textContent='Added. Review and edit the wording in your entry.';field.focus();
    });
    body.prepend(hint);body.append(preview,add,feedback);builder.append(summary,body);field.parentElement.append(builder);
  }

  function addItemComposer(body, section, feedback, on) {
    const isCertification = section === 'certifications';
    const composer = document.createElement('div'); composer.className = 'item-composer';
    const heading = document.createElement('h4'); heading.textContent = isCertification ? 'Build a credential entry' : 'Build an award entry'; composer.append(heading);
    const fields = {};
    const labels = {name:isCertification ? 'Certification or licence' : 'Award or achievement',issuer:isCertification ? 'Issuing organisation' : 'Awarded by',year:isCertification?'Issue or expected year (optional)':'Year (optional)',...(isCertification ? {expiry:'Expiry year (optional)'} : {})};
    Object.entries(labels).forEach(([key,label]) => {
      const group = document.createElement('div'); group.className = 'form-group';
      const caption = document.createElement('label'); caption.className = 'form-label'; caption.textContent = label;
      const input = document.createElement('input'); input.type = 'text'; input.className = 'form-input'; input.id = `coach-${section}-${key}`; input.dataset.coachInput = 'true'; input.maxLength = key === 'year' || key === 'expiry' ? 4 : 180;
      if (input.maxLength === 4) input.inputMode = 'numeric';
      caption.htmlFor = input.id; group.append(caption,input); composer.append(group); fields[key] = input;
    });
    let credentialStatus;
    if(isCertification){const group=document.createElement('label');group.className='credential-status-label';group.textContent='Status';credentialStatus=document.createElement('select');credentialStatus.className='form-select';credentialStatus.setAttribute('aria-label','Credential status');[['completed','Completed or awarded'],['in-progress','In progress'],['expired','Expired']].forEach(([value,label])=>{const option=document.createElement('option');option.value=value;option.textContent=label;credentialStatus.append(option);});group.append(credentialStatus);composer.append(group);on(credentialStatus,'change',()=>{fields.expiry.disabled=credentialStatus.value==='in-progress';if(fields.expiry.disabled)fields.expiry.value='';});}
    const add = document.createElement('button'); add.type = 'button'; add.className = 'btn btn-secondary btn-sm'; add.textContent = 'Add to my resume'; add.disabled = true;
    on(composer,'input', () => {add.disabled = !fields.name.value.trim() || !fields.issuer.value.trim();});
    on(add,'click', () => {
      const year = fields.year.value.trim(), expiry = fields.expiry?.value.trim();
      if ((year && !/^\d{4}$/.test(year)) || (expiry && (!/^\d{4}$/.test(expiry) || (year && expiry < year)))) {feedback.textContent = 'Use four-digit years. The expiry should follow the issue year.'; return;}
      const field = document.getElementById(isCertification ? 'cert-points' : 'ach-points');
      const pending=credentialStatus?.value==='in-progress',expired=credentialStatus?.value==='expired';
      const line = `${fields.name.value.trim()} - ${fields.issuer.value.trim()}${pending?' (in progress'+(year?'; expected '+year:'')+')':year?', '+year:''}${expired?' (expired'+(expiry?' '+expiry:'')+')':!pending&&expiry?' (expires '+expiry+')':''}`;
      const current = ReGenPoints.lines(field.value);
      if (current.length >= 50 || ReGenPoints.format([...current,line]).length > field.maxLength) {feedback.textContent = 'This section is full. Edit an existing item before adding another.'; return;}
      field.value = ReGenPoints.format([...current,line]); field.dispatchEvent(new Event('input',{bubbles:true}));
      Object.values(fields).forEach(input => {input.value = '';}); add.disabled = true;
      feedback.textContent = 'Added to your resume. You can edit the wording below.'; field.focus();
    });
    composer.append(add); body.insertBefore(composer,body.querySelector('.coach-actions'));
  }
})();
