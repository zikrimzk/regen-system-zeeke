window.DocumentSettings = (() => {

  const labels={summary:'Profile',education:'Education',experience:'Work experience',projects:'Projects',extracurricular:'Activities',skills:'Skills',achievements:'Achievements',certifications:'Certifications',additional:'More sections',references:'References'};

  const presets={experience:['summary','experience','education','skills','projects'],education:['summary','education','projects','extracurricular','experience','skills'],hybrid:['summary','skills','experience','projects','education'],academic:['summary','education','additional','experience','projects','skills','achievements']};

  let order=Object.keys(labels),dialog;

  function init(data){order=[...new Set([...(data.sectionOrder||[]),...Object.keys(labels)])].filter(id=>labels[id]);document.getElementById('resume-layout-settings')?.addEventListener('click',open);}

  async function open(){

    const previous=document.activeElement;

    dialog?.remove();dialog=document.createElement('dialog');dialog.className='document-settings-dialog';dialog.setAttribute('aria-labelledby','document-settings-title');

    const draft=Stepper.getDraftResume(),appearance=draft.appearance||{},writing=draft.writing||{};

    let template;try{template=(await ReGenTemplates.catalog()).find(t=>t.id===draft.templateId);}catch{App.showToast('Unable to load design settings. Please try again.','error');return;}

    order=[...new Set([...(draft.sectionOrder||[]),...Object.keys(labels)])].filter(id=>labels[id]);

    dialog.innerHTML=`<form method="dialog"><div class="settings-heading"><h2 id="document-settings-title">Document settings</h2><button class="btn btn-ghost btn-icon" aria-label="Close settings">${ReGenIcons.icon('close')}</button></div></form><div class="settings-body">

      <h3>Your application</h3><div class="document-appearance-grid">

      <label>Document type<select id="writing-documentType"><option value="resume">Job resume</option><option value="academic-cv">Academic CV</option></select></label>

      <label>Career stage<select id="writing-careerStage"><option value="auto">Use my existing context</option><option value="graduate">Student or graduate</option><option value="experienced">Experienced professional</option><option value="career-change">Changing careers</option></select></label>

      <label>Opening profile<select id="writing-profileType"><option value="summary">Professional summary</option><option value="objective">Career objective</option></select></label>

      <label>Work and education dates<select id="writing-dateOrder"><option value="entered">Keep my entry order</option><option value="newest">Newest first in the PDF</option></select></label></div>

      <p class="settings-description" id="writing-type-guide"></p>

      <label class="writing-job-label" for="writing-jobDescription">Job description or application requirements <span class="text-muted">(optional)</span></label><textarea class="form-textarea" id="writing-jobDescription" rows="5" maxlength="6000" placeholder="Paste the role requirements. Add only public job information, without personal contact details."></textarea><p class="settings-description">AI uses these notes to focus your existing evidence. A requirement never becomes a skill or qualification automatically.</p>

      <div class="settings-design-note"><strong>${ZeekeSafe.attr(template?.name||'Your design')}</strong><span>${template?.photo?'Portrait layout. Your photo has a dedicated place in the masthead.':'Text-only layout. Recommended for online applications.'}</span></div>

      <h3>Typography &amp; page layout</h3><p class="settings-description">Every design starts with a considered type scale. Adjust the details for your content.</p><div class="document-appearance-grid">

      <label>Font family<select id="document-font"><option value="template">Template default (${ZeekeSafe.attr(template?.font||'Inter')})</option><option value="sans">Inter · clean &amp; contemporary</option><option value="source">Source Sans 3 · clear &amp; versatile</option><option value="lato">Lato · warm &amp; professional</option><option value="garamond">EB Garamond · classic &amp; elegant</option><option value="baskerville">Libre Baskerville · formal &amp; assured</option><option value="serif">DejaVu Serif · traditional</option></select></label>

      <label>Body text<select id="document-size"><option value="10">10 pt</option><option value="10.5">10.5 pt</option><option value="11">11 pt · recommended</option><option value="11.5">11.5 pt</option><option value="12">12 pt</option></select></label>

      <label>Name size<select id="document-nameSize"><option value="template">Designed for this template</option><option value="22">22 pt</option><option value="26">26 pt</option><option value="30">30 pt</option></select></label>

      <label>Section heading size<select id="document-headingSize"><option value="template">Designed for this template</option><option value="11">11 pt</option><option value="12">12 pt</option><option value="13">13 pt</option></select></label>

      <label>Section spacing<select id="document-spacing"><option value="compact">Compact</option><option value="balanced">Balanced · recommended</option><option value="comfortable">Relaxed</option></select></label>

      <label>Line spacing<select id="document-lineHeight"><option value="template">Follow section spacing</option><option value="1.25">1.25 · compact</option><option value="1.3">1.30 · balanced</option><option value="1.35">1.35 · open</option><option value="1.45">1.45 · relaxed</option></select></label>

      <label>Page margins<select id="document-margins"><option value="compact">12.7 mm · compact</option><option value="balanced">16 mm · balanced</option><option value="generous">22 mm · generous</option></select></label>

      <label>Heading case<select id="document-headingStyle"><option value="template">Template default</option><option value="title">Title case</option><option value="uppercase">UPPERCASE</option></select></label>

      <label>Dates<select id="document-dates"><option value="right">Align right beside the role</option><option value="inline">On a separate line</option></select></label>

      <label>Color<select id="document-color"><option value="black">Monochrome</option><option value="accent">Subtle template accent</option></select></label></div>

      <div class="document-type-sample" aria-label="Typography sample"><strong>Zamir Zaini</strong><span>Operations Specialist</span><h4>Work Experience</h4><b>Project Coordinator</b><p>Coordinated a team of 12 and introduced clearer project reporting.</p></div><p class="settings-description">This is a typography sample. Check your complete PDF after saving. Text remains selectable, with the chosen fonts embedded. Edit for relevance before reducing readability.</p>

      <p class="settings-description">${template?.photo?'This template includes a portrait. Upload your photo in Personal details.':'This is a text-only template. Choose a photo template in the gallery to include a portrait.'}</p><div class="document-photo-settings" ${template?.photo?'':'hidden'}><h3>Portrait framing</h3><div class="document-appearance-grid"><label>Photo frame<select id="document-photoShape"><option value="portrait">Portrait · 3:4</option><option value="square">Square · 1:1</option></select></label><label>Photo placement<select id="document-photoPosition"><option value="right">Right of your introduction</option><option value="left">Left of your introduction</option></select></label><label>Crop focus<select id="document-photoFocus"><option value="top">Upper area · portraits</option><option value="center">Centre of image</option><option value="bottom">Lower area</option></select></label></div><p class="settings-description">Upload or replace the photo in Personal details. The image is cropped proportionally to the frame. Use a text-only design when the employer does not request a photo.</p></div>

      <button type="button" class="btn btn-secondary" id="reset-document-design">Restore design defaults</button>

      <h3>Section order</h3><div class="writing-order-tools"><label for="writing-preset">Starting structure</label><select id="writing-preset" class="form-select"><option value="experience">Experience first</option><option value="education">Education and projects first</option><option value="hybrid">Skills first (hybrid)</option><option value="academic">Academic CV</option></select><button type="button" class="btn btn-secondary" id="writing-apply-order">Use this order</button></div><p class="settings-description">This changes section order only. Dates and work history remain visible. Empty sections are omitted.</p><ol id="document-section-order"></ol><p class="settings-status" role="status"></p><button type="button" class="btn btn-primary" id="save-document-settings">${ReGenIcons.icon('check')} Save settings</button></div>`;

    const choices={font:'template',size:'11',spacing:'balanced',color:'black',nameSize:'template',headingSize:'template',lineHeight:'template',margins:'balanced',headingStyle:'template',dates:'right',photoShape:'portrait',photoPosition:'right',photoFocus:'top'};

    Object.entries(choices).forEach(([key,fallback])=>{const control=dialog.querySelector(`#document-${key}`);control.value=appearance[key]||fallback;if(!control.value)control.value=fallback;control.onchange=updateSample;});

    dialog.querySelector('#reset-document-design').onclick=()=>{Object.entries(choices).forEach(([key,value])=>dialog.querySelector('#document-'+key).value=value);updateSample();dialog.querySelector('.settings-status').textContent='Design defaults restored. Save settings to apply them.';};

    dialog.dataset.font=template?.fontKey||'sans';

    Object.entries({documentType:'resume',careerStage:'auto',profileType:'summary',dateOrder:'entered',jobDescription:''}).forEach(([key,fallback])=>{const control=dialog.querySelector('#writing-'+key);control.value=writing[key]||fallback;if(control.tagName==='SELECT'&&!control.value)control.value=fallback;});

    const type=()=>{dialog.querySelector('#writing-type-guide').textContent=dialog.querySelector('#writing-documentType').value==='academic-cv'?'Use research, teaching and publication sections where relevant. CV length follows your discipline and application requirements.':'For most job applications, one or two focused pages are useful. A short profile is optional; projects and volunteering can demonstrate experience.';};

    dialog.querySelector('#writing-documentType').onchange=type;

    dialog.querySelector('#writing-apply-order').onclick=()=>{const selected=presets[dialog.querySelector('#writing-preset').value];order=[...selected,...order.filter(id=>!selected.includes(id))];render();dialog.querySelector('.settings-status').textContent='Order updated below. Save settings to apply it.';};

    document.body.append(dialog);render();updateSample();type();dialog.showModal();

    const opened=dialog;dialog.addEventListener('close',()=>{opened.remove();previous?.focus();},{once:true});

    dialog.querySelector('#save-document-settings').onclick=async event=>{

      const button=event.currentTarget;button.disabled=true;

      const writingValues=Object.fromEntries(['documentType','careerStage','profileType','dateOrder','jobDescription'].map(key=>[key,dialog.querySelector('#writing-'+key).value]));

      const settings={sectionOrder:[...order],appearance:Object.fromEntries(Object.keys(choices).map(key=>[key,dialog.querySelector(`#document-${key}`).value])),writing:writingValues};

      try{const result=await Api.saveSection('documentSettings',settings);if(!result.success)throw new Error(result.message||'Unable to save document settings.');Stepper.setPreferences(settings);document.dispatchEvent(new CustomEvent('regen:writing-settings-changed',{detail:writingValues}));App.showToast('Document settings saved.','success');dialog.close();}

      catch(error){dialog.querySelector('.settings-status').textContent=error.message;}finally{button.disabled=false;}

    };

  }

  function updateSample(){

    const sample=dialog.querySelector('.document-type-sample'),get=key=>dialog.querySelector('#document-'+key).value;

    const faces={sans:'Resume Sans',source:'Resume Source',lato:'Resume Lato',garamond:'Resume Garamond',baskerville:'Resume Baskerville',serif:'Resume Serif'};

    const key=get('font')==='template'?dialog.dataset.font:get('font');

    sample.style.fontFamily=`"${faces[key]||faces.sans}"`;

    sample.style.fontSize=get('size')+'pt';sample.style.lineHeight=get('lineHeight')==='template'?({compact:'1.25',balanced:'1.3',comfortable:'1.4'})[get('spacing')]:get('lineHeight');

    sample.querySelector('strong').style.fontSize=(get('nameSize')==='template'?'26':get('nameSize'))+'pt';

    sample.querySelector('h4').style.fontSize=(get('headingSize')==='template'?'12':get('headingSize'))+'pt';

    sample.querySelector('h4').style.textTransform=get('headingStyle')==='uppercase'?'uppercase':'none';sample.dataset.accent=get('color')==='accent';

  }

  function render(focusId,direction){const list=dialog.querySelector('ol');list.innerHTML=order.map((id,index)=>`<li><span class="order-number">${index+1}</span><strong>${labels[id]}</strong><button type="button" class="btn btn-ghost btn-icon" data-section="${id}" data-direction="-1" aria-label="Move ${labels[id]} up" ${index===0?'disabled':''}>${ReGenIcons.icon('arrowUp')}</button><button type="button" class="btn btn-ghost btn-icon" data-section="${id}" data-direction="1" aria-label="Move ${labels[id]} down" ${index===order.length-1?'disabled':''}>${ReGenIcons.icon('arrowDown')}</button></li>`).join('');list.querySelectorAll('button').forEach(button=>button.onclick=()=>{const index=order.indexOf(button.dataset.section),delta=Number(button.dataset.direction);[order[index],order[index+delta]]=[order[index+delta],order[index]];render(button.dataset.section,delta);});if(focusId)list.querySelector(`[data-section="${focusId}"][data-direction="${direction}"]`)?.focus();}

  return {init};

})();

