/* Keep the editor inside the area above the software keyboard, including iOS panning. */
(() => {
  const root=document.documentElement,body=document.body;
  if(!body?.classList.contains('user-workspace'))return;
  const mobile=matchMedia('(max-width:980px)'),viewport=window.visualViewport;
  let frame=0,revealTimer=0,baseline=window.innerHeight;
  const editable=field=>!!field&&!field.disabled&&!field.readOnly&&(field.tagName==='TEXTAREA'||field.tagName==='INPUT'&&['text','email','search','tel','url','password','number'].includes(field.type));
  function reveal(){
    const field=document.activeElement;
    if(!mobile.matches||!editable(field)||(viewport&&Math.abs(viewport.scale-1)>.01))return;
    const area=field.closest('dialog[open]')||field.closest('#step-content');
    if(!area)return;
    const bounds=area.getBoundingClientRect(),rect=field.getBoundingClientRect();
    const top=Math.max(bounds.top,viewport?.offsetTop||0)+12;
    const bottom=Math.min(bounds.bottom,(viewport?.offsetTop||0)+(viewport?.height||window.innerHeight))-12;
    if(bottom<=top)return;
    // Scroll the editor or sheet, never the whole page or on every keystroke.
    const delta=rect.top<top?rect.top-top:rect.bottom>bottom?Math.min(rect.bottom-bottom,rect.top-top):0;
    if(Math.abs(delta)>1)area.scrollTop+=delta;
  }
  function update(){
    frame=0;
    if(!mobile.matches||(viewport&&Math.abs(viewport.scale-1)>.01)){
      for(const name of ['--app-visible-height','--app-viewport-bottom','--app-visual-top','--builder-header-height'])root.style.removeProperty(name);
      delete body.dataset.keyboardOpen;return;
    }
    const height=viewport?.height||window.innerHeight,offset=viewport?.offsetTop||0;
    const layout=Math.max(root.clientHeight,window.innerHeight);
    if(!editable(document.activeElement)&&height>=baseline-100)baseline=layout;
    baseline=Math.max(baseline,layout);
    root.style.setProperty('--app-visible-height',`${Math.round(height)}px`);
    root.style.setProperty('--app-viewport-bottom',`${Math.round(height+offset)}px`);
    root.style.setProperty('--app-visual-top',`${Math.round(offset)}px`);
    const header=document.querySelector('.builder-page .topbar');
    if(header)root.style.setProperty('--builder-header-height',`${header.offsetHeight}px`);
    body.dataset.keyboardOpen=String(editable(document.activeElement)&&Math.max(layout-height-offset,baseline-height)>100);
  }
  function schedule(revealAfter=false){
    if(!frame)frame=requestAnimationFrame(update);
    if(revealAfter){clearTimeout(revealTimer);revealTimer=setTimeout(reveal,160);}
  }
  window.addEventListener('resize',()=>schedule(true),{passive:true});
  viewport?.addEventListener('resize',()=>schedule(true),{passive:true});
  viewport?.addEventListener('scroll',()=>schedule(),{passive:true});
  document.addEventListener('focusin',()=>schedule(true));
  document.addEventListener('focusout',()=>schedule());
  mobile.addEventListener('change',()=>{baseline=window.innerHeight;schedule(true);});
  matchMedia('(orientation:portrait)').addEventListener('change',()=>{baseline=window.innerHeight;schedule(true);});
  window.addEventListener('pageshow',()=>schedule(true));
  update();
})();
