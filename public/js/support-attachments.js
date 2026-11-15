window.ReGenAttachments=(()=>{
  const pickers=new WeakMap();
  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const size=value=>value>=1048576?(value/1048576).toFixed(1).replace('.0','')+' MB':Math.ceil(value/1024)+' KB';
  function render(items=[]){return items.length?`<div class="support-file-gallery">${items.map(file=>`<a class="support-file" href="${safe(file.url)}" target="_blank" rel="noopener" ${file.mime_type.startsWith('image/')?'data-support-image':''}><span class="support-file-preview">${file.mime_type.startsWith('image/')?`<img src="${safe(file.url)}" alt="${safe(file.filename)}" loading="lazy">`:'<span class="support-pdf-symbol">PDF</span>'}</span><span><strong>${safe(file.filename)}</strong><small>${size(Number(file.byte_size))} · ${file.mime_type.startsWith('image/')?'View image':'Download'}</small></span></a>`).join('')}</div>`:'';}
  function picker(form,limits,initial=[],allowEmptyBody=false){
    if(!limits.maxFiles)return;
    let files=[...initial];const field=document.createElement('fieldset');field.className='support-upload';
    field.innerHTML=`<legend>Attachments <span>Optional</span></legend><label class="support-upload-zone"><input type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" name="attachments[]"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 12 6-6a4 4 0 0 1 6 6L10 22a6 6 0 0 1-8-8L12 4M6 15l9-9"/></svg><strong>Add screenshots or documents</strong><span>Choose files or drop them here</span></label><p class="support-upload-limits">Up to ${limits.maxFiles} files · ${size(limits.effectiveMaxFileBytes||limits.maxFileBytes)} each · ${size(limits.effectiveMaxTotalBytes||limits.maxTotalBytes)} total<br>JPG, PNG, WebP or PDF</p><p class="support-upload-error" role="status"></p><ul class="support-upload-list"></ul>`;
    const actions=form.querySelector('.service-actions,.settings-save');actions?.before(field);
    const input=field.querySelector('input'),error=field.querySelector('[role=status]'),list=field.querySelector('ul');
    const draw=()=>{list.innerHTML=files.map((file,index)=>`<li><span><strong>${safe(file.name)}</strong><small>${size(file.size)}</small></span><button type="button" data-remove="${index}" aria-label="Remove ${safe(file.name)}">×</button></li>`).join('');if(allowEmptyBody&&form.elements.body)form.elements.body.required=!files.length;};
    const add=incoming=>{
      const next=[...files];let total=next.reduce((sum,file)=>sum+file.size,0);
      for(const file of incoming){
        if(next.some(item=>item.name===file.name&&item.size===file.size&&item.lastModified===file.lastModified))continue;
        if(!['image/jpeg','image/png','image/webp','application/pdf'].includes(file.type)){error.textContent='Choose JPG, PNG, WebP or PDF files.';return;}
        if(next.length>=limits.maxFiles||file.size>(limits.effectiveMaxFileBytes||limits.maxFileBytes)||total+file.size>(limits.effectiveMaxTotalBytes||limits.maxTotalBytes)){error.textContent='These files exceed the displayed count or size limit. Your earlier selections are still here.';return;}
        next.push(file);total+=file.size;
      }
      files=next;error.textContent='';draw();
    };
    input.onchange=()=>{add([...input.files]);input.value='';};
    const zone=field.querySelector('label');zone.ondragover=event=>{event.preventDefault();zone.classList.add('is-dragging');};zone.ondragleave=()=>zone.classList.remove('is-dragging');zone.ondrop=event=>{event.preventDefault();zone.classList.remove('is-dragging');add([...event.dataTransfer.files]);};
    list.onclick=event=>{const button=event.target.closest('[data-remove]');if(button){files.splice(Number(button.dataset.remove),1);error.textContent='';draw();}};
    pickers.set(form,{files:()=>[...files],clear:()=>{files=[];draw();}});draw();
  }
  const files=form=>pickers.get(form)?.files()||[];
  function payload(form,extra={}){const data=new FormData(form);data.delete('attachments[]');for(const file of files(form))data.append('attachments[]',file);for(const[key,value]of Object.entries(extra))data.set(key,typeof value==='object'?JSON.stringify(value):String(value));return data;}
  document.addEventListener('click',event=>{
    const link=event.target.closest('[data-support-image]');if(!link||event.ctrlKey||event.metaKey)return;
    event.preventDefault();const dialog=document.createElement('dialog');dialog.className='support-image-viewer';dialog.setAttribute('aria-label','Support attachment');
    const close=document.createElement('button');close.type='button';close.className='token-close';close.setAttribute('aria-label','Close image');close.textContent='×';
    const image=document.createElement('img');image.src=link.getAttribute('href');image.alt=link.querySelector('strong')?.textContent||'Support attachment';
    const caption=document.createElement('p');caption.textContent=image.alt;dialog.append(close,image,caption);close.onclick=()=>dialog.close();dialog.addEventListener('close',()=>dialog.remove());document.body.append(dialog);dialog.showModal();
  });
  return {render,picker,files,payload,clear:form=>pickers.get(form)?.clear()};
})();
