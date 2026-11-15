// Browser smoke test with a local fixture, no accounts, network, or live services.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { readFileSync, mkdirSync } = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.REGEN_NODE_MODULES ? path.join(process.env.REGEN_NODE_MODULES, 'playwright') : 'playwright');
process.chdir(path.resolve(__dirname, '..'));

const base = 'http://regen-editor.test';
const fixture = readFileSync('php/views/builder.html','utf8');
const css = [...fixture.matchAll(/<link rel="stylesheet" href="(\/css\/[^"?]+)/g)].map(([,href])=>'<link rel="stylesheet" href="'+href+'">').join('');
const start = fixture.indexOf('<div class="builder-layout">');
const end = fixture.indexOf('<script src=',start);
const shell = fixture.slice(start,end);
const scripts = ['api','lookups','form-assist','form-cards','points',...['personal','summary','education','experience','projects','extracurricular','skills','achievements','certifications','references','additional'].map(n=>'sections/'+n),'stepper'];
const markup = '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">'+css+
  '<body class="user-workspace builder-page"><span id="mobile-section-title" hidden></span><span id="mobile-section-count" hidden></span>'+shell+
  scripts.map(name=>'<script src="/js/'+name+'.js"></script>').join('')+
  '<script>window.record={};window.editorMoments=[];document.addEventListener("regen:editor-moment",event=>editorMoments.push(event.detail));window.App={showToast(){},showFinalScreen(){}};window.DocumentSettings={init(){}};window.Preview={renderDraft(){}};'+
  'Api.saveSection=async (key,value)=>{window.record[key]=value;return {success:true}};'+
  'Stepper.init({projects:[{title:"Booking system",type:"",description:"Built a booking form.",bullets:["Tested with five users."]}],education:[]});</script>';

const output = 'tmp/editor-browser-review';
mkdirSync(output, { recursive: true });
const php = 'require "vendor/autoload.php"; echo json_encode(ReGen\\InstitutionDirectory::search($argv[1],$argv[2]),JSON_THROW_ON_ERROR);';
const mime = {'css':'text/css','js':'application/javascript','woff2':'font/woff2'};
async function configure(context) {
  await context.route('**/*', async route=>{
    const u=new URL(route.request().url());
    if (u.origin !== base) return route.abort();
    if (u.pathname==='/builder') return route.fulfill({contentType:'text/html; charset=utf-8',body:markup});
    if (u.pathname==='/api/lookups/institutions') {
      const results=JSON.parse(execFileSync('php',['-r',php,'--',u.searchParams.get('q')||'',u.searchParams.get('country')||''],{encoding:'utf8'}));
      return route.fulfill({json:{success:true,results}});
    }
    const local=path.resolve('public',u.pathname.slice(1));
    if (local.startsWith(path.resolve('public')+path.sep)) {
      try {
        return await route.fulfill({contentType:mime[path.extname(local).slice(1)],body:readFileSync(local)});
      } catch {}
    }
    return route.fulfill({status:404});
  });
}
async function go(page, section, mobile) {
  if (mobile) await page.locator('#editor-sections-open').click();
  const label=new RegExp(section+'$','i');
  await page.locator((mobile ? '#mobile-section-list' : '#stepper-track') + ' button').filter({hasText:label}).click();
  await page.locator('#stepper-track [aria-current="step"]').filter({hasText:label}).waitFor({state:'attached'});
  if (mobile) await page.locator('#editor-sections').waitFor({state:'hidden'});
}
async function viewportFits(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  assert.equal(overflow,false,'Editor viewport should not scroll horizontally.');
}
(async ()=>{
  const browser = await chromium.launch({...(process.env.REGEN_BROWSER_PATH ? {executablePath:process.env.REGEN_BROWSER_PATH} : {channel:'chrome'}),headless:true,args:['--disable-background-networking']});
  try {
    for(const mobile of [false,true]) {
      const context = await browser.newContext(mobile ? {viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1} : {viewport:{width:1366,height:930}});
      await configure(context);
      const page = await context.newPage(); page.setDefaultTimeout(15000);
      const errors=[];
      page.on('pageerror', error=>{console.error(error);errors.push(error.message)});
      await page.goto(base+'/builder?section=education');
      await page.locator('#btn-add-edu').click();
      assert.equal(await page.locator('.edu-inst').evaluate(el=>el===document.activeElement),true);
      await page.locator('.edu-inst').fill('utm');
      const campuses=page.getByRole('listbox',{name:'Matching campuses'});
      await campuses.waitFor({state:'visible'});
      assert.equal(await campuses.getByRole('option').count(),3);
      await viewportFits(page);
      await page.screenshot({path:output+'/education-'+(mobile?'mobile':'desktop')+'.png'});
      if (mobile) await campuses.getByText('Universiti Teknologi Malaysia (Kuala Lumpur)',{exact:true}).tap();
      else {
        await page.locator('.edu-inst').press('ArrowDown');
        await page.locator('.edu-inst').press('ArrowDown');
        await page.locator('.edu-inst').press('Enter');
      }
      assert.equal(await page.locator('.edu-loc').inputValue(),'Kuala Lumpur');
      assert.equal(await page.locator('.edu-country').inputValue(),'Malaysia');
      await page.locator('.edu-degree').fill('Diploma in Computing');
      await page.waitForFunction(()=>record.education?.[0]?.degree==='Diploma in Computing');
      assert.equal(await page.evaluate(()=>record.education[0].location),'Kuala Lumpur, Malaysia');
      await page.locator('#btn-add-edu').click();
      await page.locator('.edu-inst').last().fill('University of My Fictional City');
      await page.locator('.edu-degree').last().fill('Computer Science');
      await page.locator('.edu-country').last().fill('Canada');
      await page.locator('.edu-loc').last().fill('Toronto, Ontario');
      await page.waitForFunction(()=>record.education?.[1]?.location==='Toronto, Ontario, Canada');
      await go(page,'Projects',mobile);
      assert.equal(await page.getByText('Short Description').count(),0);
      assert.equal(await page.locator('.proj-type').inputValue(),'');
      assert.match(await page.locator('.proj-bullet-input').inputValue(),/Built a booking form/);
      await page.locator('.proj-title').fill('Booking demo');
      await page.waitForFunction(()=>record.projects?.[0]?.title==='Booking demo');
      await go(page,'Skills',mobile);
      const skill=page.locator('#sk-tech-entry');
      await skill.fill('SQL, Python, sql');
      await skill.press('Enter');
      await skill.evaluate(input => {
        const clipboardData = new DataTransfer();
        clipboardData.setData('text', 'Python; Excel\nGit');
        input.dispatchEvent(new ClipboardEvent('paste', {clipboardData,bubbles:true,cancelable:true}));
      });
      await page.getByRole('button',{name:'Remove Excel',exact:true}).click();
      await page.getByRole('button',{name:'Remove Git',exact:true}).click();
      await page.getByRole('button',{name:'+ Data analysis',exact:true}).click();
      await page.locator('.skill-group').filter({hasText:'Languages'}).locator('summary').click();
      await page.locator('#sk-lang-entry').fill('English (Fluent)');
      await page.locator('.skill-group').filter({hasText:'Languages'}).getByRole('button',{name:'Add',exact:true}).click();
      assert.equal(await page.getByRole('button',{name:'Remove English (Fluent)',exact:true}).count(),1);
      await page.waitForFunction(()=>record.skills?.technical==='SQL, Python, Data analysis');
      await viewportFits(page);
      await page.screenshot({path:output+'/skills-'+(mobile?'mobile':'desktop')+'.png'});
      await page.getByRole('button',{name:'Remove Python',exact:true}).click();
      await page.getByRole('button',{name:'Add a custom group',exact:true}).click();
      await page.getByLabel('Group name').fill('Research');
      await page.locator('.custom-skill-category .skill-entry').fill('Interviews');
      await page.locator('.custom-skill-category .skill-entry').press('Enter');
      await page.waitForFunction(()=>record.skills?.technical==='SQL, Data analysis' && record.skills.custom[0].value==='Interviews');
      for(const section of ['Personal','Profile','Experience','Activities','Achievements','Certifications','More sections','References']){
        await go(page,section,mobile);
        await page.waitForFunction(()=>document.querySelector('#step-content h2')?.textContent?.trim().length);
        await viewportFits(page);
      }
      await go(page,'Profile',mobile);
      await page.evaluate(()=>Stepper.next());
      assert.deepEqual(await page.evaluate(()=>editorMoments.at(-1)),{kind:'skipped',section:'summary'});
      await go(page,'Profile',mobile);
      await page.locator('#s-summary').fill('Fictional summary about the work I did on campus.');
      await page.evaluate(()=>Stepper.next());
      assert.deepEqual(await page.evaluate(()=>editorMoments.at(-1)),{kind:'completed',section:'summary'});
      assert.deepEqual(errors,[]);
      await context.close();
      console.log((mobile?'Mobile':'Desktop')+' editor checks passed.');
    }
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
