// Real workspace markup and WebGL character, with fixture accounts and a mock model.
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const {readFileSync,mkdirSync} = require('node:fs');
const path = require('node:path');
const {chromium} = require(process.env.REGEN_NODE_MODULES ? path.join(process.env.REGEN_NODE_MODULES,'playwright') : 'playwright');
process.chdir(path.resolve(__dirname,'..'));
const site='http://mochi-editor.test', out='tmp/mochi-interactive';
mkdirSync(out,{recursive:true});
const profileDefaults={nickname:'',goal:'',stage:'',tone:'playful',language:'auto',intro:'new',asleep:false,live:false,napUntil:0};
const renderView=file=>execFileSync('php',['-r','require "vendor/autoload.php"; ReGen\\PageRenderer::render(getcwd(),$argv[1]);','--',file],{encoding:'utf8'});
const view=file=>renderView(file)
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'')
  .replace('</body>',`<script src="/js/theme.js"></script><script src="/js/mobile-viewport.js"></script><script src="/js/api.js"></script><script src="/js/mochi-avatar.js"></script><script src="/js/mochi-activities.js"></script><script src="/js/mochi-play.js"></script><script src="/js/mochi-assist.js"></script><script src="/js/mochi.js"></script>
    <script src="/js/feedback.js"></script><script>
      if (document.querySelector('.mobile-product-nav')) document.body.classList.add('has-mobile-nav');
      if (document.body.classList.contains('user-workspace')) window.ReGenFeedback.start(async()=>({success:true}));
    </script></body>`);
const builder=view('builder.html').replace('role="main"></main>', 'role="main"><div class="step-header"><div class="step-header-info"><h2 class="step-title">Projects</h2><p class="step-subtitle">Show what you built.</p></div></div><div class="form-body form-section"><div class="form-group"><label class="form-label" for="proj-qa">Project contributions</label><textarea class="form-textarea proj-bullet-input" id="proj-qa" rows="4"></textarea></div><div class="form-group"><label class="form-label" for="p-email">Contact email</label><input class="form-input" id="p-email" type="email"></div></div></main>');
const dashboard=view('dashboard.html');
const profilePage=view('profile.html');
const letterPage=view('cover-letters.html').replace('id="letter-workspace" hidden','id="letter-workspace"');
const roomPage=view('mochi.html');
const supportPage=view('support.html').replace('</body>','<script src="/js/support-attachments.js"></script><script src="/js/service-centre.js"></script></body>');
const adminView=renderView('admin.html');

async function fixture(browser,options,config) {
  const context=await browser.newContext(options);
  const state={access:true,available:true,chatAllowed:true,model:true,profile:{...profileDefaults},chat:[],comments:[],changes:[],...config};
  await context.route('**/*',async route=>{
    const request=route.request(), url=new URL(request.url());
    if(url.origin!==site)return route.abort();
    const pageHtml={'/builder':builder,'/cover-letters':letterPage,'/dashboard':dashboard,'/profile':profilePage,'/mochi':roomPage,'/support':supportPage,'/admin':adminView}[url.pathname];
    if(pageHtml)return route.fulfill({contentType:'text/html; charset=utf-8',body:pageHtml});
    if(url.pathname==='/api/auth/me')return route.fulfill({json:{success:true,user:{},csrfToken:'mochi-fixture'}});
    if(url.pathname==='/api/capabilities')return route.fulfill({json:{success:true,features:{}}});
    if(url.pathname==='/api/support/configuration')return route.fulfill({json:{success:true,message:'Here to help'}});
    if(url.pathname==='/api/support/tickets'&&request.method()==='POST'){
      state.ticketSent=true;
      return route.fulfill({status:500});
    }
    if(url.pathname==='/api/admin/me')return route.fulfill({json:{success:true,admin:{id:1,first_name:'Ari',last_name:'Admin',role:'super_admin',status:'active'},permissions:['system'],capabilities:['system.view','system.manage'],csrfToken:'admin-fixture'}});
    if(url.pathname==='/api/admin/settings/system')return route.fulfill({json:{success:true,settings:{appName:'ReGen'}}});
    if(url.pathname==='/api/admin/users')return route.fulfill({json:{success:true,items:[{id:24,first_name:'Ari',last_name:'Example',email:'ari@example.test'}]}});
    if(url.pathname==='/api/admin/settings/mochi'){
      if(request.method()==='PUT') state.savedGlobal=request.postDataJSON();
      return route.fulfill({json:{success:true,available:state.savedGlobal?.enabled??true,mochi:state.savedGlobal??{
        enabled:true,preview:true,autoplay:true,sound:true,editorReactions:true,health:100,dailyTokens:30,start:'',end:'',
      }}});
    }
    if(url.pathname==='/api/admin/settings/mochi/user/24'){
      if(request.method()==='PUT') state.savedAccount=request.postDataJSON();
      const account=state.savedAccount??{mode:'inherit',dailyTokens:null};
      return route.fulfill({json:{success:true,account,limit:account.dailyTokens??30,usedToday:2}});
    }
    if(url.pathname==='/api/auth/activity')return route.fulfill({json:{success:true}});
    if(url.pathname==='/api/mochi/status')return route.fulfill({json:{success:true,access:state.access,available:state.available,chatAllowed:state.chatAllowed,liveAvailable:state.model,profile:state.access?state.profile:null,csrfToken:'mochi-fixture'}});
    if(url.pathname==='/api/mochi/preferences') {
      const input=request.postDataJSON();
      assert.equal(request.headers()['x-csrf-token'],'mochi-fixture');
      state.changes.push(input);
      if(input.action==='introduce')state.profile={...state.profile,...input.details,intro:'known'};
      if(input.action==='skip')state.profile.intro='skipped';
      if(input.action==='sleep')state.profile.asleep=input.enabled;
      if(input.action==='live')state.profile.live=input.enabled;
      if(input.action==='forget')state.profile={...profileDefaults,asleep:state.profile.asleep};
      return route.fulfill({json:{success:true,profile:state.profile}});
    }
    if(url.pathname==='/api/mochi/chat') {
      const input=request.postDataJSON();
      assert.equal(request.headers()['x-csrf-token'],'mochi-fixture');
      state.chat.push(input);
      if (state.failNext) {state.failNext=false;return route.fulfill({json:{success:true,reason:'busy'}});}
      if (input.intent==='conversation') {
        return route.fulfill({json:{success:true,kind:'advice',mood:'bright',reply:'Take five minutes to stretch — then pick one small task.'}});
      }
      if (input.screen==='cover-letters') {
        return route.fulfill({json:{success:true,kind:'question',mood:'curious',reply:input.sharedField
          ? 'What stock reporting have you done that would help in this role?'
          : 'Which role is this cover letter for?'}});
      }
      if (input.message==='I built the reusable components and documented them for the team.') {
        return route.fulfill({json:{success:true,kind:'draft',mood:'bright',reply:'Lead with the reusable components you built.',
          suggestion:'Built reusable components for an inventory design system and documented them for the team.'}});
      }
      return route.fulfill({json:{success:true,kind:'question',mood:'curious',reply:input.sharedField
        ? 'Which part of the inventory design system did you build yourself?'
        : 'What project contribution would you like a hiring manager to notice?'}});
    }
    if(url.pathname==='/api/mochi/comment') {
      state.comments.push(request.postDataJSON());
      if(state.delay) {state.delayed=route;return;}
      return route.fulfill({json:{success:true,comment:'What changed after people used your project?',mood:'curious'}});
    }
    const mimes={js:'application/javascript',css:'text/css',webp:'image/webp',png:'image/png',svg:'image/svg+xml',woff2:'font/woff2'};
    const file=path.resolve('public',url.pathname.slice(1));
    if(file.startsWith(path.resolve('public')+path.sep)) {
      try {return await route.fulfill({contentType:mimes[path.extname(file).slice(1)],body:readFileSync(file)});} catch {}
    }
    return route.fulfill({status:404});
  });
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(45000);
  return {context,page,state,errors};
}
const panel=page=>page.getByRole('dialog',{name:'Mochi',exact:true});
async function launch(page) {await page.locator('[data-mochi-float] [data-mochi-open]').click();}
async function say(page,text) {
  await panel(page).getByRole('textbox',{name:'Message Mochi'}).fill(text);
  await panel(page).getByRole('button',{name:'Send',exact:true}).click();
}
async function mood(page,value) {await page.locator(':is([data-mochi-float],[data-mochi-den],[data-mochi-demo],#mochi-panel)[data-mochi-mood="'+value+'"]:visible').first().waitFor();}
async function noFeedbackCollision(page, selector) {
  const gap=await page.evaluate(selector=>{
    const target=document.querySelector(selector).getBoundingClientRect();
    const feedback=document.querySelector('.feedback-launcher').getBoundingClientRect();
    return Math.max(feedback.top-target.bottom,target.top-feedback.bottom,feedback.left-target.right,target.left-feedback.right);
  },selector);
  assert(gap>=4,'Mochi must leave Feedback reachable');
}
async function fits(page) {
  const out=await page.evaluate(()=>{
    const element=document.querySelector('#mochi-panel');
    const bar=document.querySelector('.workspace-header,.workbench-header');
    const rect=element.getBoundingClientRect();
    return document.documentElement.scrollWidth>innerWidth+1||bar.scrollWidth>bar.clientWidth+1||
      (!element.hidden&&(rect.top<bar.getBoundingClientRect().bottom+6||rect.left<-1||rect.bottom>innerHeight+1||rect.right>innerWidth+1));
  });
  assert.equal(out,false,'Coach and navigation must fit within the viewport');
}

(async()=>{
  const browser=await chromium.launch({...(process.env.REGEN_BROWSER_PATH?{executablePath:process.env.REGEN_BROWSER_PATH}:{channel:'chrome'}),
    headless:true,args:['--disable-background-networking','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try {
    const locked=await fixture(browser,{viewport:{width:1366,height:900}},{access:false,model:false});
    await locked.page.goto(site+'/dashboard');
    await locked.page.locator('[data-mochi-float]').waitFor();
    await launch(locked.page);
    await panel(locked.page).getByText('We’re in Overview.',{exact:false}).waitFor();
    await say(locked.page,'Tell me a joke');
    await mood(locked.page,'laugh');
    assert.equal(await locked.page.locator('.workspace-header [data-mochi-open]').count(),0);
    assert.equal(locked.state.chat.length,0);
    assert.deepEqual(locked.errors,[]);
    await locked.context.close();

    const desktop=await fixture(browser,{viewport:{width:1366,height:900}},{profile:{...profileDefaults,intro:'known',nickname:'Ari'}});
    await desktop.page.goto(site+'/dashboard');
    await desktop.page.locator('.mochi-float-chat img').waitFor();
    await desktop.page.waitForFunction(()=>document.querySelector('[data-mochi-float]').dataset.mochiMood);
    assert.equal(await desktop.page.locator('[data-mochi-renderer="webgl"]').count(),0);
    await launch(desktop.page);
    await panel(desktop.page).getByText('Overview',{exact:true}).waitFor();
    await say(desktop.page,'How can I reset after a long afternoon?');
    await panel(desktop.page).getByText('Take five minutes to stretch, then pick one small task.').waitFor();
    assert.equal(desktop.state.chat[0].intent,'conversation');
    await say(desktop.page,'Can you write a Python script for me?');
    await panel(desktop.page).getByText('Coding is outside my lane.',{exact:false}).waitFor();
    assert.equal(desktop.state.chat.length,1);
    await fits(desktop.page);
    await noFeedbackCollision(desktop.page,'#mochi-panel');
    await desktop.page.screenshot({path:out+'/dashboard-mochi.png'});
    assert.deepEqual(desktop.errors,[]);
    await desktop.context.close();

    const {context,page,state,errors}=await fixture(browser,{viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1},{});
    await page.goto(site+'/builder?section=projects');
    await page.locator('.mochi-float-chat img').waitFor();
    await page.waitForFunction(()=>document.querySelector('[data-mochi-float]').dataset.mochiMood);
    const project=page.locator('#proj-qa'), email=page.locator('#p-email');
    await project.focus();
    assert.equal(await project.evaluate(el=>el===document.activeElement),true);
    await page.screenshot({path:out+'/mobile-hello.png'});
    await launch(page);
    await panel(page).getByRole('button',{name:'Options'}).click();
    await panel(page).getByRole('button',{name:'Tell Mochi about you'}).click();
    await panel(page).getByLabel('What should I call you?').fill('Ari');
    await panel(page).getByLabel('What are you working toward?').fill('My first design internship');
    await panel(page).getByLabel('Career stage').selectOption('student');
    await panel(page).getByRole('button',{name:'Remember this'}).click();
    await panel(page).getByText('Nice to meet you, Ari!',{exact:false}).waitFor().catch(async error=>{
      console.error('Introduction panel:',await panel(page).innerText(), 'Saved:', state.changes, 'Browser errors:', errors);
      throw error;
    });
    assert.equal(state.profile.goal,'My first design internship');
    await panel(page).getByRole('button',{name:'Close Mochi'}).click();
    await launch(page);
    await say(page,'I got rejected today.');
    await panel(page).getByText('That sounds rough, Ari.',{exact:false}).waitFor();
    await mood(page,'sad');
    assert.equal(state.chat.length,0,'An emotional check-in stays on the device');
    await page.screenshot({path:out+'/mobile-chat.png'});
    await fits(page);
    await panel(page).getByRole('button',{name:'Close Mochi'}).click();
    const emitEditorMoment=(kind,section)=>page.evaluate(detail=>document.dispatchEvent(new CustomEvent('regen:editor-moment',{detail})),{kind,section});
    await emitEditorMoment('skipped','summary');
    await page.getByText('Profile summary kosong lagi',{exact:false}).waitFor();
    assert.equal(state.chat.length,0,'An editor reaction does not send an AI request');

    await project.fill('Built a design system for a small inventory project.');
    await page.waitForTimeout(1750);
    assert.equal(state.comments.length,0,'Field feedback defaults to off');
    await launch(page);
    await say(page,'Apa nak isi kat sini?');
    await panel(page).getByText('What project contribution would you like a hiring manager to notice?', {exact:false}).waitFor();
    assert.equal(state.chat.length,1,'A question about the focused field reaches the coach.');
    assert.equal(state.chat[0].focusField,'project');
    assert.equal(Object.hasOwn(state.chat[0],'sharedField'),false,'The focus label travels without the draft.');
    state.failNext=true;
    await panel(page).getByRole('button',{name:'Share this field'}).click();
    await panel(page).getByRole('button',{name:'Try again'}).click();
    await panel(page).getByText('Which part of the inventory design system did you build yourself?',{exact:false}).waitFor();
    assert.equal(await panel(page).getByRole('button',{name:'Use suggestion'}).count(),0);
    await say(page,'I built the reusable components and documented them for the team.');
    await panel(page).getByRole('button',{name:'Use suggestion'}).waitFor();
    assert.deepEqual(state.chat.at(-1).sharedField,{field:'project',text:'Built a design system for a small inventory project.'});
    assert.equal(state.chat.at(-1).screen,'builder');
    assert.equal(state.chat.at(-1).section,'projects');
    assert.equal(state.chat.at(-1).history.at(-1).text,'Which part of the inventory design system did you build yourself?');
    assert(state.chat.at(-1).history.every(turn=>!/rejected|Apa nak isi/.test(turn.text)),'A newly shared field starts with its own context.');
    await panel(page).getByRole('button',{name:'Use suggestion'}).click();
    assert.equal(await project.inputValue(),'Built reusable components for an inventory design system and documented them for the team.');
    await panel(page).getByRole('button',{name:'Close Mochi'}).click();
    await email.fill('private@example.com');
    await launch(page);
    assert.equal(await panel(page).getByRole('button',{name:'Share this field'}).count(),0);
    await panel(page).getByRole('button',{name:'Options'}).click();
    await panel(page).getByRole('button',{name:'Live field feedback'}).click();
    await page.waitForFunction(()=>document.querySelector('[data-mochi-live]').getAttribute('aria-pressed')==='true');
    await panel(page).getByRole('button',{name:'Close Mochi'}).click();
    state.delay=true;
    await project.fill('Designed a prototype and gathered feedback from operations staff.');
    for(let i=0;i<16&&!state.delayed;i++)await page.waitForTimeout(250);
    assert(state.delayed,'Opted-in writing should request feedback');
    await email.focus();
    try {await state.delayed.fulfill({json:{success:true,comment:'Stale response',mood:'bright'}});} catch {}
    await page.waitForTimeout(200);
    assert.match(await page.locator('[data-mochi-bubble-text]').textContent(),/Check the spelling/);

    await launch(page);
    await say(page,'Good night Mochi');
    await mood(page,'sleep');
    assert.equal(state.profile.asleep,true);
    assert.equal(state.chat.length,4,'Sleep is a local command, not a model request');
    await page.reload();
    await mood(page,'sleep');
    assert.equal(await page.locator('[data-mochi-bubble]').isVisible(),false);
    await page.screenshot({path:out+'/mobile-sleep.png'});
    const callsBefore=state.comments.length;
    await project.fill('More writing while the coach sleeps should stay in the editor.');
    await page.waitForTimeout(1750);
    assert.equal(state.comments.length,callsBefore);
    await launch(page);
    await panel(page).getByRole('button',{name:'Wake Mochi'}).click();
    await mood(page,'wave');
    assert.equal(state.profile.asleep,false);
    await panel(page).getByRole('button',{name:'Options'}).click();
    await panel(page).getByText('What we’re working toward: My first design internship').waitFor();
    await panel(page).getByRole('button',{name:'Forget my details'}).click();
    await panel(page).getByText('I’ve cleared your saved details.').waitFor();
    assert.equal(state.profile.goal,'');
    assert.equal(state.profile.live,false);
    assert.deepEqual(errors,[]);
    await context.close();

    const offline=await fixture(browser,{viewport:{width:320,height:640},isMobile:true,hasTouch:true,deviceScaleFactor:1,reducedMotion:'reduce'},
      {model:false,profile:{...profileDefaults,intro:'skipped'}});
    await offline.page.goto(site+'/builder');
    await offline.page.locator('.mochi-float-chat img').waitFor();
    await offline.page.waitForFunction(()=>document.querySelector('[data-mochi-float]').dataset.mochiMood);
    await offline.page.evaluate(()=>document.documentElement.setAttribute('data-theme','dark'));
    await launch(offline.page);
    await panel(offline.page).getByText('Page help is available while live coaching is offline.',{exact:false}).waitFor();
    await say(offline.page,'Tell me a joke');
    await mood(offline.page,'laugh');
    assert.equal(offline.state.chat.length,0);
    await fits(offline.page);
    await offline.page.screenshot({path:out+'/mochi-chat-320-dark.png'});
    assert.equal(await offline.page.locator('[data-mochi-renderer="webgl"]').count(),0);
    assert.deepEqual(offline.errors,[]);
    await offline.context.close();
    const letter=await fixture(browser,{viewport:{width:390,height:844},isMobile:true,hasTouch:true},{profile:{...profileDefaults,intro:'skipped'}});
    await letter.page.goto(site+'/cover-letters');
    await letter.page.locator('#letter-role').fill('Inventory Assistant');
    await letter.page.locator('#letter-company').fill('Example Studio');
    await letter.page.locator('#letter-job-context summary').click();
    await letter.page.locator('#letter-job-description').fill('Reconcile weekly stock movements.');
    await letter.page.locator('#letter-body').focus();
    await launch(letter.page);
    await panel(letter.page).getByRole('button',{name:'Help me here'}).click();
    await panel(letter.page).getByText('Which role is this cover letter for?',{exact:false}).waitFor();
    assert.equal(letter.state.chat[0].focusField,'letter');
    assert.equal(Object.hasOwn(letter.state.chat[0],'sharedField'),false);
    await panel(letter.page).getByRole('button',{name:'Share letter and role'}).click();
    await panel(letter.page).getByText('What stock reporting have you done that would help in this role?',{exact:false}).waitFor();
    assert.deepEqual(letter.state.chat[1].sharedField,{field:'letter',text:'',target:{
      role:'Inventory Assistant',company:'Example Studio',description:'Reconcile weekly stock movements.',
    }});
    assert.equal(Object.hasOwn(letter.state.chat[1],'useSavedResume'),false);
    await panel(letter.page).getByRole('button',{name:'Use saved resume'}).click();
    await say(letter.page,'I reconciled stock counts for the campus store.');
    await letter.page.waitForFunction(()=>document.querySelector('[data-mochi-resume]').disabled===false);
    assert.equal(letter.state.chat[2].useSavedResume,true);
    assert.deepEqual(letter.errors,[]);
    await letter.context.close();
    const mobile=await fixture(browser,{viewport:{width:360,height:720},isMobile:true,hasTouch:true},{chatAllowed:false,model:false,profile:{...profileDefaults,intro:'known'}});
    await mobile.page.goto(site+'/profile');
    await mobile.page.locator('.mochi-float-chat img').waitFor();
    await noFeedbackCollision(mobile.page,'[data-mochi-float-stage], .mochi-float-stage');
    await launch(mobile.page);
    await panel(mobile.page).getByText('We’re in Profile.',{exact:false}).waitFor();
    await noFeedbackCollision(mobile.page,'#mochi-panel');
    assert.equal(mobile.state.chat.length,0);
    await mobile.context.close();
    const playroom=await fixture(browser,{viewport:{width:1366,height:900},deviceScaleFactor:2},{chatAllowed:false,model:false});
    await playroom.page.goto(site+'/mochi');
    const choose=playroom.page.getByLabel('Choose an activity');
    await choose.waitFor();
    assert.equal(await playroom.page.locator('.mobile-product-nav').isVisible(),false,'No mobile footer on desktop');
    await playroom.page.waitForFunction(()=>{
      const canvas=document.querySelector('.mochi-room canvas');
      return canvas.width>=canvas.clientWidth*1.9&&canvas.clientWidth>256;
    });
    const roomPet=playroom.page.locator('[data-mochi-den] [data-mochi-pet]');
    await roomPet.press('ArrowRight');
    assert.equal(await roomPet.evaluate(el=>el.classList.contains('mochi-positioned')),true,'The animated room mascot is still movable by keyboard.');
    await roomPet.press('Escape');
    assert.equal(await choose.locator('option').count(),48);
    await choose.selectOption({label:'Sofa zoomies'});
    await playroom.page.getByRole('button',{name:'Play',exact:true}).click();
    await playroom.page.getByText('Siapa letak sofa kat sini?',{exact:false}).waitFor();
    const track=await playroom.page.locator('.mochi-room-scene [data-mochi-pet]').evaluate(el=>{
      const effect=el.getAnimations().find(a=>a.effect?.target===el)?.effect;
      return {ms:effect?.getTiming().duration,frames:effect?.getKeyframes().map(frame=>frame.transform)};
    });
    assert.equal(track.ms,12000);
    assert(track.frames.some(frame=>/translate\(-\d/.test(frame))&&track.frames.some(frame=>/translate\([1-9]/.test(frame)));
    await playroom.page.screenshot({path:out+'/mochi-room.png'});
    await playroom.page.getByRole('button',{name:'Ask about ReGen ↗'}).click();
    await say(playroom.page,'Dah bayar, tapi token tak masuk');
    const ticket=panel(playroom.page).getByRole('link',{name:'Open support ticket'});
    await ticket.click();
    await playroom.page.getByRole('heading',{name:'How can we help?'}).waitFor();
    assert.equal(await playroom.page.getByLabel('Topic').inputValue(),'billing');
    assert.equal(await playroom.page.getByLabel('Details').inputValue(),'');
    assert.equal(playroom.state.ticketSent,undefined);
    assert.equal(playroom.state.chat.length,0);
    assert.deepEqual(playroom.errors,[]);
    await playroom.context.close();
    const nap=await fixture(browser,{viewport:{width:390,height:844},isMobile:true,hasTouch:true},{profile:{...profileDefaults,napUntil:Math.floor(Date.now()/1000)+45}});
    await nap.page.addInitScript(()=>Object.defineProperty(navigator,'standalone',{value:true}));
    await nap.page.clock.install();
    await nap.page.goto(site+'/mochi');
    await nap.page.locator('.mobile-product-nav').waitFor();
    assert.equal(await nap.page.locator('html[data-launch="pending"]').count(),0,'Standalone startup does not wait behind a blank splash.');
    assert(await nap.page.locator('.mobile-product-nav').evaluate(el=>getComputedStyle(el).position==='fixed'&&el.getBoundingClientRect().bottom<=innerHeight));
    assert(await nap.page.locator('.workspace-header').evaluate(el=>[...el.querySelectorAll('.workspace-tools > *')].every(control=>control.getBoundingClientRect().bottom<=el.getBoundingClientRect().bottom)));
    await nap.page.evaluate(()=>{document.documentElement.dataset.theme='dark';});
    await nap.page.getByRole('button',{name:'Mochi is napping'}).waitFor();
    await nap.page.locator('.mochi-room [data-mochi-renderer="webgl"]').waitFor();
    await nap.page.screenshot({path:out+'/mochi-room-standalone.png'});
    await nap.page.getByRole('button',{name:'Mochi is napping'}).click();
    await nap.page.getByRole('button',{name:'Chat with Mochi ↗'}).click();
    await panel(nap.page).getByText('He’ll wake up on his own',{exact:false}).waitFor();
    assert.equal(await panel(nap.page).getByRole('textbox',{name:'Message Mochi'}).count(),0);
    assert.equal(await panel(nap.page).getByRole('button',{name:'Wake Mochi'}).count(),0);
    assert.equal(nap.state.changes.length,0);
    assert.equal(nap.state.chat.length,0);
    await nap.page.clock.fastForward(46000);
    await panel(nap.page).getByRole('textbox',{name:'Message Mochi'}).waitFor();
    assert.deepEqual(nap.errors,[]);
    await nap.context.close();
    const admin=await fixture(browser,{viewport:{width:1366,height:900}},{});
    await admin.page.goto(site+'/admin');
    await admin.page.getByRole('button',{name:'Mochi',exact:true}).click();
    await admin.page.getByRole('checkbox',{name:/Mochi available/}).uncheck();
    await admin.page.getByLabel('Play pace').selectOption('calm');
    await admin.page.getByLabel('Daily requests across all accounts').fill('25');
    await admin.page.getByRole('checkbox',{name:'Allow live field feedback',exact:false}).uncheck();
    await admin.page.getByRole('button',{name:'Save global settings'}).click();
    await admin.page.waitForFunction(()=>document.querySelector('#mochi-global-state')?.textContent.toLowerCase().includes('disabled'));
    assert.equal(admin.state.savedGlobal.enabled,false);
    assert.equal(admin.state.savedGlobal.pace,'calm');
    assert.equal(admin.state.savedGlobal.dailyBudget,25);
    assert.equal(admin.state.savedGlobal.liveFeedback,false);
    await admin.page.getByLabel('Find an account').fill('Ari');
    await admin.page.getByRole('button',{name:'Find account'}).click();
    await admin.page.getByRole('button',{name:/Ari Example/}).click();
    await admin.page.getByLabel('Access for account #24').selectOption('play-only');
    await admin.page.getByLabel('Daily AI requests for this account').fill('5');
    await admin.page.getByRole('button',{name:'Save account limits'}).click();
    await admin.page.getByText('2 of 5 AI requests used today (Malaysia time)').waitFor();
    assert.deepEqual(admin.state.savedAccount,{mode:'play-only',dailyTokens:5});
    await admin.page.evaluate(()=>scrollTo(0,0));
    await admin.page.screenshot({path:out+'/mochi-admin.png'});
    await admin.context.close();
    console.log('Interactive Mochi passed: static launcher, casual conversation, writing, phone layouts, 48 room activities, napping, keyboard movement, support handoff and admin limits.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
