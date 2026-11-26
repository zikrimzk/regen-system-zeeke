/* Mochi keeps the chat in this page; only preferences are saved to the account. */
(() => {
  const editors = '#step-content, #letter-form';
  const defaults = {nickname:'',goal:'',stage:'',tone:'playful',language:'auto',intro:'new',asleep:false,live:false,napUntil:0};
  const screens = {
    dashboard:'Overview',builder:'Resume Studio','cover-letters':'Cover Letter Studio',templates:'Templates',
    profile:'Profile',support:'Support',notifications:'Notifications',store:'K-Store',payments:'Payment history',
    'token-activity':'Coin activity',mochi:'Mochi’s room',jobs:'Saved jobs',applications:'Applications',
    tailor:'Resume tailoring',interview:'Interview practice'
  };
  const sections = {
    personal:'Personal details',summary:'Profile summary',education:'Education',experience:'Work experience',
    projects:'Projects',extracurricular:'Activities',skills:'Skills',achievements:'Achievements',
    certifications:'Certifications',additional:'More sections',references:'References',review:'Resume review'
  };
  const expressions = {curious:'Ready to help',bright:'Celebrating',laugh:'Giggling',sad:'Feeling for you',wave:'Saying hello',hop:'Doing a hop',dance:'Dancing',sleep:'Asleep',
    yarn:'Chasing yarn',climb:'Climbing',sneak:'Sneaking',purr:'Purring',proud:'Proud of you',startle:'Wait a second'};
  const withoutEmDash = text=>text.replace(/[^\S\n]*—[^\S\n]*/g, ', ');
  const guidance = [
    ['#p-fullname', 'Use the name you want an employer to address you by.'],
    ['#p-jobtitle', 'Choose a clear title that matches the work you want to do.'],
    ['#p-email, .ref-email', 'Check the spelling so the right person can be reached.'],
    ['#p-phone, .ref-phone', 'Include the country code if an employer might call from overseas.'],
    ['#p-linkedin, #p-portfolio', 'Use a public link that opens without signing in.'],
    ['#s-summary', 'Try two lines: what you do, then one thing you bring to this role.', 'summary'],
    ['.edu-inst', 'Pick your campus to fill the location, or keep the school name you type.'],
    ['.edu-degree', 'Use the qualification name shown on your transcript or certificate.'],
    ['.edu-cgpa', 'Include a grade if it helps. For CGPA, add the scale.'],
    ['.edu-loc, .exp-loc, #p-city', 'A city or state is usually enough.'],
    ['.edu-start, .edu-end, .exp-start, .exp-end', 'Use the months you know. For ongoing work or study, use the checkbox.'],
    ['.edu-current, .exp-current', 'Tick this if you’re still there. Your resume will show “Present.”'],
    ['.exp-title, .extra-role', 'Use a title that makes your responsibilities easy to understand.'],
    ['.exp-company, .extra-org', 'Use a name the reader would recognize.'],
    ['.exp-bullet-input', 'Start with what you did. Add a result or a detail you can explain.', 'experience'],
    ['.proj-title', 'Give the project a short name that tells the reader what it was.'],
    ['.proj-type', 'Add a type if it gives useful context, like Final Year Project.'],
    ['.proj-bullet-input', 'Say what you built, which part was yours, and how you knew it worked.', 'project'],
    ['.extra-bullet-input', 'Describe your contribution and who it helped.', 'activity'],
    ['#sk-lang-entry', 'Add the language and how comfortably you use it.'],
    ['.skill-entry', 'Add skills you can back up with an example. You can paste a list.', 'skills'],
    ['.custom-skill-label', 'Name this group for the skills inside it, like Research methods.'],
    ['#ach-points', 'Name the achievement and what you did to earn it.', 'achievement'],
    ['#cert-points', 'Include the credential, issuer, and year. One per line works well.', 'certification'],
    ['.additional-items', 'Put each entry on its own line, with enough detail to identify it.', 'additional'],
    ['.additional-kind, .additional-title', 'Choose a heading a reader will recognize quickly.'],
    ['.ref-name, .ref-pos', 'Use a referee who knows your work and has agreed to be contacted.'],
    ['#letter-company', 'Copy the company name as it appears in the posting.'],
    ['#letter-role', 'Use the job title from the listing so the purpose is clear.'],
    ['#letter-recipient', '“Hiring Manager” works if you don’t know the recipient’s name.'],
    ['#letter-job-description, #letter-company-details', 'Keep the parts of the posting that explain what the employer needs.'],
    ['#letter-body', 'Give one example that connects your experience to the role.', 'letter'],
  ];

  function tipFor(field) {
    const match = guidance.find(([selector]) => field.matches(selector));
    if (match) return {text:match[1],kind:match[2]||''};
    if (field.matches('select')) return {text:'Choose the option that best matches your situation.'};
    if (field.type === 'checkbox') return {text:'Tick this only if it applies to you.'};
    if (field.matches('textarea')) return {text:'Start with the clearest detail. Add more only if it helps the reader.'};
    return {text:'Use the wording you’d want a reader to see.'};
  }
  function excerpt(field) {
    const raw=field.value, caret=field.selectionEnd??raw.length;
    const start=Math.max(0,Math.min(raw.length-900,caret-650));
    return raw.slice(start,start+900).replace(/^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/g,'').trim();
  }
  function localTip(tip, value) {
    if (value.length<24) return tip.text;
    if (['experience','project','activity'].includes(tip.kind) && /(^|\n)\s*(responsible for|helped with|worked on)\b/i.test(value)) {
      return 'Try a verb that tells the reader exactly what you did.';
    }
    if (tip.kind==='summary' && value.length>460) return 'Could this be two or three sentences? Keep the detail that best fits the role.';
    return tip.text;
  }

  function init() {
    const teaser = window.ReGenText?.get('mochi.teaser') || 'Want to play? See the packages that include Mochi.';
    const panel=document.getElementById('mochi-panel');
    const floating=document.querySelector('[data-mochi-float]');
    if (!panel || !floating || typeof Api==='undefined' || !window.MochiPlay) return;
    const visibility=document.querySelector('[data-mochi-visibility]');
    const openers=document.querySelectorAll('[data-mochi-open]');
    const stage=floating.querySelector('[data-mochi-float-stage]');
    const text=(key,fallback)=>window.ReGenText?.get('mochi.'+key,fallback) ?? fallback;
    const visibilityKey='kerjayaku-mochi-hidden';
    let mascotHidden=false;
    try { mascotHidden=localStorage.getItem(visibilityKey)==='1'; } catch {}
    const find=(key, root=panel)=>root.querySelector('[data-mochi-'+key+']');
    const bubble=find('bubble',floating), bubbleText=find('bubble-text',floating);
    const pet=find('pet',floating), fx=find('fx',floating);
    const den=document.querySelector('[data-mochi-den]');
    const denState=den&&find('den-state',den), denCaption=den&&find('den-line',den);
    const meet=den&&find('kenal',den);
    if (den) find('den-stage',den).append(pet);
    const playKit=window.MochiPlay;
    const assist=window.MochiAssist;
    const roomClosed=document.querySelector('[data-mochi-room-closed]');
    const roomPlay=den&&find('room-play',den), roomSupport=den&&find('room-support',den);
    const roomSound=den&&find('room-sound',den);
    const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
    const activitySelect=den&&find('activity',den);
    if (activitySelect) playKit.activities.forEach((activity,i)=>activitySelect.add(new Option(activity.name,i)));
    const petPosition = playKit.draggable(pet, den ? pet : floating, den ? '' : 'regen-mochi-position');
    const intro=find('intro'), chat=find('chat'), options=find('options'), sleepView=find('sleep-view'), locked=find('locked');
    const history=find('history'), composer=find('compose'), message=composer.elements.message;
    const supportHistory=history.cloneNode(false);
    supportHistory.removeAttribute('data-mochi-history');
    supportHistory.setAttribute('aria-label',text('productHelp','Ask about Kerjayaku'));
    supportHistory.hidden=true;
    history.after(supportHistory);
    const preferenceButton=find('options-button'), liveButton=find('live'), status=find('status');
    const soundButton=find('sound');
    const channel='BroadcastChannel' in window?new BroadcastChannel('regen-mochi-preferences'):null;
    const urlScreen=location.pathname.replace(/^\/|\/$/g,'');
    const screenAliases = {'store/activity':'token-activity','store/payments':'payments','payments/result':'payments','jobs/saved':'jobs'};
    const screen = screenAliases[urlScreen] || (Object.hasOwn(screens, urlScreen) ? urlScreen : 'dashboard');
    let section=new URLSearchParams(location.search).get('section')||'';
    let profile={...defaults}, access=null, available=null, chatAllowed=false, health=100;
    let autoplay=true, allowSound=true, editorReactions=true, adminPlayOnly=false, pace='balanced', naps=true;
    let scheduled=false;
    let liveAvailable=false, liveFeedback=true, feedbackSeconds=90, avatar=null, rendererPending=false, loadFailed=false, refreshing=false, revision=0;
    let view='chat', opener=null, mood='curious', moodTimer=0, bubbleTimer=0;
    let field=null, fieldTip=null, displayedTip='', fieldTimer=0, fieldRequest=null, fieldRevision=0, lastExcerpt='', nextFieldRequest=0;
    let displayedModel=false;
    let coaching=null, conversation=[], retryTurn=null, useSavedResume=false, chatRequest=null, writing=false, saving=false, localJoke=0;
    const troubleshooting = new Map();
    let playIndex=0, denLine='', lastPlayAt=0, playingUntil=0;
    let napTimer=0, wasNapping=false, longActs=0, lastNapAttempt=0;
    let lastReaction=0, reactionCount=0;
    const praised=new Set();
    const contextual = {
      dashboard:['overview',2], builder:['resume',2], 'cover-letters':['letters',2],
      store:['store',2], 'token-activity':['activity',1], payments:['payments',1],
      templates:['templates',1], profile:['profile',1], notifications:['notifications',1], support:['support',1],
    };
    let pageReactions = 0;

    function pageMove(index) {
      const [key,count] = contextual[screen] ?? [];
      if (!key || index >= count) return null;
      const line = window.ReGenText?.get('mochi.' + key + '.' + index, '');
      return line ? [index ? 'purr' : 'wave',line,line,line] : null;
    }

    const locationName=()=>{
      if (screen==='builder' && document.querySelector('.builder-left.is-final')) return sections.review;
      return screen==='builder'&&Object.hasOwn(sections,section)?sections[section]:screens[screen];
    };
    const setText=(node,value)=>{if(node.textContent!==value) node.textContent=value;};
    const open=()=>!panel.hidden;
    const isNapping=()=>Number(profile.napUntil)*1000>Date.now();
    const isSleeping=()=>profile.asleep||isNapping();
    const visibleState=()=>isSleeping()?'sleep':mood;
    const phrase=(english,malay)=>profile.language==='ms'?malay:english;
    const chatLanguage=text=>profile.language==='auto' && !assist?.useMalay.test(text) ? 'en' : profile.language;

    function updateShare() {
      const canShare=field?.isConnected&&fieldTip?.kind&&liveAvailable&&!field.readOnly&&!field.disabled;
      const button=find('share');
      button.hidden=!canShare;
      if (canShare) {
        setText(button,fieldTip.kind==='letter'?'Share letter and role':field.value.trim()?'Share this field':'Draft for this field');
        button.title=fieldTip.kind==='letter'?'Includes the letter text, role, employer and job description.':'Shares the selected text or this field only.';
      }
    }

    function update() {
      const entitled=access===true;
      const pose=visibleState();
      const visible=available===true;
      const sleeping=isSleeping(), supporting=view==='support';
      stage.hidden = !visible || !!den || mascotHidden;
      floating.hidden = stage.hidden;
      if (visibility) {
        visibility.hidden = !visible;
        const visibilityLabel=mascotHidden?text('show','Show floating Mochi'):text('hide','Hide floating Mochi');
        visibility.setAttribute('aria-label',visibilityLabel);
        visibility.setAttribute('aria-expanded',String(!mascotHidden));
        visibility.title=visibilityLabel;
      }
      if (!entitled) hideBubble();
      (den||floating).dataset.mochiMood=pose;
      panel.dataset.mochiMood=pose;
      floating.dataset.mochiOpen=String(open());
      pet.setAttribute('aria-label',isNapping()?'Mochi is napping':profile.asleep?'Wake Mochi':entitled?'Pet Mochi':'Meet Mochi');
      pet.title=isNapping()?'Mochi is napping':'Tap or drag Mochi';
      setText(fx,playKit.effect(pose));
      if (den) {
        den.hidden=!visible;
        setText(denState,!entitled?'Looking for a friend':pose==='sleep'?'Taking a nap':mood==='curious'?'Ready to play':expressions[mood]);
        setText(denCaption,isNapping()?'Shh… Mochi tengah lena. Nanti dia bangun sendiri.':denLine||(!entitled?teaser:profile.asleep?phrase('Shh… tap to wake me.','Senyap… sentuh untuk kejutkan saya.'):
          playKit.line(['','Tap je. Berani tak?','Tap me. I dare you.','Sentuh je. Berani tak?'],profile.language)));
        find('den-chat',den).hidden=!entitled;
        if (roomSupport) roomSupport.hidden=!visible;
        if (roomPlay) {
          roomPlay.hidden=!entitled;
          roomPlay.querySelectorAll('button,select').forEach(item=>item.disabled=sleeping||saving);
        }
        find('adopt',den).hidden=entitled;
        meet.hidden=!entitled||sleeping||profile.intro!=='new';
      }
      if (roomClosed) {
        roomClosed.hidden=visible;
        setText(roomClosed,available===false?'Mochi’s room is closed right now.':loadFailed?'Couldn’t check if Mochi is home. Refresh to try again.':'Checking if Mochi is home…');
      }
      document.querySelectorAll('[data-mochi-room-link]').forEach(link=>link.hidden=available===false);
      setText(find('expression'),entitled&&pose!=='curious'?expressions[pose]:text('coach','Career coach'));
      locked.hidden=entitled||supporting;
      find('packages').hidden=access!==false;
      setText(find('access-message'),access===false?text('packageRequired','Mochi comes with selected Kerjayaku packages.'):loadFailed?'I couldn’t check your access. Open Mochi again to retry.':'Checking your Mochi access…');
      sleepView.hidden=!entitled||!sleeping||supporting;
      find('wake').hidden=isNapping();
      setText(find('sleep-copy'),isNapping()?'Mochi dah penat sangat. He’ll wake up on his own in a little while.':'Mochi is asleep. He’ll stay quiet until you wake him.');
      preferenceButton.hidden=!entitled||sleeping;
      find('sleep').hidden=!entitled||sleeping;
      preferenceButton.setAttribute('aria-expanded',String(entitled&&view==='options'));
      intro.hidden=!entitled||sleeping||view!=='intro';
      options.hidden=!entitled||sleeping||view!=='options';
      chat.hidden = !supporting && (!entitled || sleeping || !chatAllowed || view !== 'chat');
      find('play-only').hidden=!entitled||chatAllowed||sleeping||view!=='chat';
      history.hidden=supporting;
      supportHistory.hidden=!supporting;
      find('support',chat).hidden=supporting;
      find('back-chat').hidden=!supporting||!chatAllowed;
      message.placeholder=supporting ? phrase('Ask Mochi about this page…','Tanya Mochi tentang halaman ini…')
        : coaching?.kind==='question' ? phrase('Reply with what you know…','Balas dengan maklumat yang awak tahu…')
        : phrase('What’s on your mind?','Apa yang awak fikirkan?');
      const savedGoal=find('saved-goal');
      savedGoal.hidden=!profile.goal;
      setText(savedGoal,profile.goal?'What we’re working toward: '+profile.goal:'');
      find('forget').hidden=profile.intro!=='known';
      liveButton.hidden=!liveAvailable||!liveFeedback;
      liveButton.setAttribute('aria-pressed',String(profile.live));
      soundButton.hidden=!allowSound||!playKit.soundCapable();
      soundButton.setAttribute('aria-pressed',String(allowSound&&playKit.soundEnabled()));
      setText(soundButton,allowSound&&playKit.soundEnabled()?'Mochi sounds on':'Mochi sounds off');
      if (roomSound) {
        roomSound.hidden=soundButton.hidden;
        roomSound.setAttribute('aria-pressed',String(allowSound&&playKit.soundEnabled()));
        setText(roomSound,text(allowSound&&playKit.soundEnabled()?'roomSoundOn':'roomSoundOff'));
      }
      const modelNote=find('model');
      modelNote.hidden=supporting;
      setText(modelNote,liveAvailable
        ?phrase('Live replies use your chat allowance. You choose what resume details to share for writing help.','Balasan langsung menggunakan kuota sembang. Anda pilih butiran resume yang dikongsi untuk bantuan penulisan.')
        :phrase('Page help is available while live coaching is offline.','Bantuan halaman tersedia ketika bimbingan langsung di luar talian.'));
      setText(find('location'),locationName());
      const note=find('field-note');
      note.hidden=supporting||!displayedTip||!!fieldTip?.kind&&!displayedModel;
      setText(note,displayedTip);
      updateShare();
      find('help').hidden=supporting;
      if (supporting) find('share').hidden=true;
      find('retry').hidden=supporting||!retryTurn;
      find('retry').disabled=writing;
      const resumeButton=find('resume');
      resumeButton.hidden=supporting||!liveAvailable||!['builder','cover-letters'].includes(screen);
      resumeButton.disabled=writing;
      resumeButton.setAttribute('aria-pressed',String(useSavedResume));
      find('share').disabled=writing;
      find('help').disabled=writing;
      composer.querySelector('button').disabled=writing;
      panel.dataset.saving=String(saving);
      openers.forEach(button=>{
        button.setAttribute('aria-expanded',String(open()));
        button.hidden=available===false || (button.matches('.mochi-header-chat:not(.studio-mochi-chat)') && !den && !stage.hidden);
      });
      if (den && visible && !reducedMotion.matches && !rendererPending && window.MochiAvatar) {
        rendererPending=true;
        playKit.renderWhenVisible(pet,renderer=>{avatar=renderer;avatar.setMood(visibleState());});
      }
      if (visible && !document.querySelector('.builder-left.is-final')) petPosition.restore();
    }
    function tell(text='') { setText(status,text); status.hidden=!text; }
    function emotion(next, duration=playKit.duration(next), clip=null, cue=next) {
      clearTimeout(moodTimer);
      playKit.stop(pet);
      playKit.stopSound();
      playingUntil=clip?Date.now()+duration:0;
      mood=Object.hasOwn(expressions,next)?next:'curious';
      update();
      avatar?.setMood(visibleState(),clip?duration:undefined,clip);
      if (access&&allowSound&&!isSleeping()) playKit.soundFor(cue);
      if (!isSleeping() && (mood!=='curious'||clip) && duration) moodTimer=setTimeout(()=>{
        playKit.stop(pet);
        mood='curious'; update(); avatar?.setMood(visibleState());
      },duration);
    }
    function hideBubble() {
      clearTimeout(bubbleTimer);
      bubble.hidden=true;
    }
    function speak(text, kind='tip') {
      if (den||mascotHidden||(!access&&kind!=='teaser')||isSleeping()||open()||!text
        ||document.body.matches('.studio-focus-mode,.letter-proof-mode,.preview-open,[data-studio-mode="preview"],:has(dialog[open],.builder-left.is-final)')) return;
      if (document.querySelector('.letter-working-preview:not([hidden])') && innerWidth >= 1200) return;
      clearTimeout(bubbleTimer);
      setText(bubbleText,text);
      find('bubble-adopt',floating).hidden=kind!=='teaser';
      bubble.hidden=false;
      bubbleTimer=setTimeout(hideBubble,kind==='play'?8500:6500);
    }
    function cancelField() {
      clearTimeout(fieldTimer);
      fieldRequest?.abort();
      fieldRequest=null;
      fieldRevision++;
    }
    function cancelChat() {
      chatRequest?.abort();
      chatRequest=null;
      writing=false;
    }
    function clearConversation() {
      troubleshooting.clear();
      cancelChat();
      coaching=null;
      conversation=[];
      retryTurn=null;
      useSavedResume=false;
      history.replaceChildren();
      supportHistory.replaceChildren();
      message.value='';
    }
    function applyState(result) {
      const previous=profile.asleep||wasNapping;
      access=result.access===true;
      available=result.available!==false;
      chatAllowed=access&&(result.chatAllowed??result.liveAvailable??chatAllowed);
      if (!chatAllowed&&writing) cancelChat();
      health=result.health??health;
      autoplay=result.autoplay??autoplay;
      scheduled=result.scheduled??scheduled;
      pace=result.pace??pace;
      naps=result.naps??naps;
      liveFeedback=result.liveFeedback??liveFeedback;
      feedbackSeconds=result.feedbackSeconds??feedbackSeconds;
      if (!liveFeedback) cancelField();
      allowSound=result.sound??allowSound;
      if (!allowSound) playKit.stopSound();
      editorReactions=result.editorReactions??editorReactions;
      adminPlayOnly=result.playOnly??adminPlayOnly;
      liveAvailable=chatAllowed&&result.liveAvailable===true;
      profile=access?{...defaults,...result.profile}:{...defaults};
      wasNapping=isNapping();
      clearTimeout(napTimer);
      if (wasNapping) napTimer=setTimeout(()=>{
        wasNapping=false;
        denLine='Haa… Mochi dah bangun. Mana benang tadi?';
        emotion('wave');
        if (open()&&view==='chat') seedChat();
        if (open()&&view==='support') seedSupport();
        refresh();
      },Math.max(0,profile.napUntil*1000-Date.now()+100));
      if (!available && open() && view !== 'support') show('support');
      const playNote=find('play-only').querySelector('p');
      setText(playNote,adminPlayOnly?'Jom main! Chat is paused for this account.':'Jom main! For resume and cover letter help, pick a package with Mochi chat.');
      find('play-only').querySelector('a').hidden=adminPlayOnly;
      if (!access||previous!==isSleeping()) {
        clearTimeout(moodTimer);
        playKit.stop(pet);
        playKit.stopSound();
        mood='curious';
        denLine='';
      }
      if (!access || profile.asleep) {
        cancelField();
        if (view !== 'support') clearConversation();
        else { cancelChat(); coaching = null; retryTurn = null; history.replaceChildren(); }
        hideBubble();
        displayedTip = '';
      }
      if (isNapping()) {cancelField();cancelChat();hideBubble();tell('');}
      if (access&&!isSleeping()&&open()&&view==='chat') seedChat();
      if (open() && view === 'support') seedSupport();
      update();
      if (previous!==isSleeping()) avatar?.setMood(visibleState());
    }
    async function refresh() {
      if (refreshing) return;
      refreshing=true;
      loadFailed=false;
      const mark=revision;
      update();
      try {
        const result=await Api.getMochiStatus();
        if (result.success && (mark===revision || result.access===false)) applyState(result);
        else if (!result.success) loadFailed=true;
      } finally { refreshing=false; update(); }
    }

    async function save(change) {
      if (saving||!access) return false;
      saving=true;
      tell('');
      update();
      try {
        const result=await Api.saveMochiPreferences(change);
        if (!result.success) {
          if (result.reason==='package') applyState({access:false});
          else if (den&&!open()) denLine='Mochi couldn’t save that yet. Try again.';
          else tell('Mochi couldn’t save that yet. Try again.');
          return false;
        }
        revision++;
        applyState({access:true,available,chatAllowed,health,liveAvailable,profile:result.profile});
        channel?.postMessage('changed');
        return true;
      } finally {saving=false;update();}
    }
    function seedChat() {
      if (history.children.length) return;
      const salutation=profile.nickname?'Hi, '+profile.nickname+'!':'Hi, I’m Mochi!';
      const greeting=profile.language==='ms'
        ? (profile.nickname?'Hai, '+profile.nickname+'!':'Hai, saya Mochi!')+' Nak sembang atau perlukan bantuan di sini?'
        : salutation+' Want help here, or shall we chat for a bit?';
      append('assistant',greeting);
    }
    function seedSupport() {
      if (!supportHistory.children.length) append('assistant',phrase(
        'Hi, I’m Mochi! We’re in '+locationName()+'. Tell me what you’re working on and we’ll take it from there.',
        'Hai, saya Mochi! Kita di '+locationName()+'. Cerita apa yang awak sedang buat, kita bincang sama-sama.'
      ),null,null,null,true);
    }
    function show(next, trigger) {
      if (!open()) { opener=trigger||null; panel.hidden=false; }
      hideBubble();
      cancelField();
      tell('');
      if ((next==='support')!==(view==='support')) message.value='';
      view=next;
      if (next==='intro') {
        for (const key of ['nickname','goal','stage','tone','language']) intro.elements[key].value=profile[key];
      }
      if (next==='chat'&&access&&!isSleeping()) seedChat();
      if (next==='support') seedSupport();
      update();
      position();
      (next==='intro'?intro.querySelector('input'):panel.querySelector('h2')).focus({preventScroll:true});
      if (access===null) refresh();
    }
    function close() {
      panel.hidden=true;
      update();
      if (opener?.isConnected && opener.offsetWidth) opener.focus({preventScroll:true});
      else if (access) document.querySelector('[data-mochi-open]:not([hidden])')?.focus({preventScroll:true});
    }
    function append(role,text,suggestion,target,action=null,supporting=false) {
      if (!text) return;
      const row=document.createElement('p');
      row.className='mochi-turn mochi-turn-'+role;
      const speaker=document.createElement('span');
      speaker.className='sr-only';
      speaker.textContent=role==='user'?'You: ':'Mochi: ';
      row.append(speaker,document.createTextNode(role==='assistant'?withoutEmDash(text):text));
      if (role==='assistant'&&typeof suggestion==='string'&&suggestion) {
        suggestion=withoutEmDash(suggestion);
        const draft=document.createElement('span');
        draft.className='mochi-suggestion';
        draft.textContent=suggestion;
        const use=document.createElement('button');
        use.type='button';
        use.className='mochi-use-suggestion';
        use.textContent=target?'Use suggestion':'Copy draft';
        use.addEventListener('click',async ()=>{
          if (!target) {
            try {
              await navigator.clipboard.writeText(suggestion);
              tell('Draft copied.');
            } catch {
              const range=document.createRange();
              range.selectNodeContents(draft);
              window.getSelection()?.removeAllRanges();
              window.getSelection()?.addRange(range);
              tell('Draft selected. Copy it to use it.');
            }
            return;
          }
          const {element,original,start,end}=target;
          const replacement=original.slice(0,start)+suggestion+original.slice(end);
          if (!element.isConnected||element.value!==original||element.disabled||element.readOnly) {
            tell('This field changed. Share the current text to get an updated suggestion.');
            return;
          }
          if (element.maxLength>=0&&replacement.length>element.maxLength) {
            tell('This draft is longer than the field allows. Ask Mochi to shorten it.');
            return;
          }
          element.value=replacement;
          element.dispatchEvent(new Event('input',{bubbles:true}));
          element.dispatchEvent(new Event('change',{bubbles:true}));
          use.disabled=true;
          use.textContent='Applied';
          tell('Suggestion added to your field.');
        });
        row.append(draft,use);
      }
      if (action) {
        const link=document.createElement('a');
        link.className='mochi-ticket-action';
        link.textContent=action.label;
        link.href=action.href;
        row.append(link);
      }
      const log=supporting?supportHistory:history;
      log.append(row);
      if (log.children.length>22) log.firstElementChild.remove();
      if (row.offsetHeight>log.clientHeight && log.clientHeight>0) {
        log.scrollTop+=row.getBoundingClientRect().top-log.getBoundingClientRect().top;
      } else log.scrollTop=log.scrollHeight;
    }
    function localReply(prompt) {
      const ms=chatLanguage(prompt)!=='en';
      const name=profile.nickname? ', '+profile.nickname : '';
      if (assist?.outside(prompt)) return {reply:ms?'Kod bukan kepakaran Mochi. Kalau ini projek awak, saya boleh bantu terangkan hasilnya untuk resume atau temu duga.':'Coding is outside my lane. If this is your project, I can help you explain what you built on a resume or in an interview.',mood:'curious'};
      if (/^(?:thank(?:s| you)|tq|terima kasih|nice|okay thanks|ok thanks)[.!\s]*$/i.test(prompt)) {
        return {reply:ms?'Sama-sama'+name+'.':'You’re welcome'+name+'.',mood:'bright'};
      }
      if (/\b(reject\w*|failed|sad|down|disappoint\w*|kecewa|gagal|sedih)\b/i.test(prompt)) {
        return {reply:ms?'Bunyinya memang berat'+name+'. Nak kita pilih satu langkah kecil untuk seterusnya?':'That sounds rough'+name+'. Want to pick one small next step together?',mood:'sad'};
      }
      if (/\b(joke|laugh|funny|haha\w*|kelakar|lawak)\b/i.test(prompt)) {
        const jokes=ms?['Kenapa resume bawa payung? Sebab nak hadapi hujan soalan!','Kenapa surat iringan tersenyum? Sebab akhirnya jumpa padanan!']
          : ['Why did the resume take a nap? It had too many outstanding positions.','Why did the cover letter blush? It found a perfect match.','I tried to write a one-line resume joke. It needed a second draft.'];
        return {reply:jokes[localJoke++%jokes.length],mood:'laugh'};
      }
      if (/\b(got the job|got an offer|passed|hired|dapat kerja|berjaya)\b/i.test(prompt)) {
        return {reply:ms?'Wah, tahniah'+name+'! Itu satu langkah besar.':'That’s worth celebrating'+name+'! What are you most excited about?',mood:'bright'};
      }
      if (/\b(where am i|what am i doing|kat mana|di mana)\b/i.test(prompt)) {
        return {reply:(ms?'Sekarang kita di: ':'We’re here: ')+locationName()+'.',mood:'curious'};
      }
      if (/^(?:hi|hai|hello|hey|helo|salam|apa khabar)\b/i.test(prompt)||/\b(?:tickle|geli|geletek|meow|comel|cute|good cat|miss you|sayang|rindu)\b/i.test(prompt)) {
        return {reply:ms?'Hai'+name+'! Mochi sedia teman awak. Hari ini nak buat apa?':'Hey'+name+'! I was about to take a catnap, but you’re better company. What’s on your mind?',mood:'wave'};
      }
      if (/\b(?:interview|temu duga|temuduga)\b/i.test(prompt)) {
        return {reply:ms?'Pilih satu pengalaman yang berkait dengan jawatan. Terangkan situasi, tindakan awak dan hasilnya. Nak cuba satu soalan?':'Pick one example relevant to the role. Explain what was happening, what you did and what changed. Want to practise an interview question?',mood:'curious'};
      }
      return null;
    }
    function shareField() {
      if (!field?.isConnected||!fieldTip?.kind||field.disabled||field.readOnly) return;
      const original=field.value;
      const selected=(field.selectionEnd??0)>(field.selectionStart??0);
      let start=selected?field.selectionStart:0;
      let end=selected?field.selectionEnd:original.length;
      const portion=original.slice(start,end);
      const text=portion.trim();
      if (selected&&text) {
        start+=portion.length-portion.trimStart().length;
        end-=portion.length-portion.trimEnd().length;
      }
      if (text.length>5000) {
        tell('Select the passage you want to work on, then share it with Mochi.');
        return;
      }
      const data={field:fieldTip.kind,text};
      if (selected) data.passage=true;
      if (fieldTip.kind==='letter') {
        data.target={};
        for (const [key,id,limit] of [['role','letter-role',120],['company','letter-company',120],['description','letter-job-description',1500]]) {
          const value=document.getElementById(id)?.value.trim().slice(0,limit);
          if (value) data.target[key]=value;
        }
      }
      const prompt=text
        ? phrase('Can you help improve this draft?','Boleh tolong kemaskan draf ini?')
        : phrase('Help me write this field from scratch.','Bantu saya tulis bahagian ini dari mula.');
      send(prompt,{share:{data,target:{element:field,original,start,end}}});
    }

    async function send(text, {share=null,help=false,retry=false}={}) {
      text=text.trim();
      const supporting=view==='support';
      if (!text || (!supporting && (!access || !chatAllowed || isSleeping())) || writing || saving) return;
      cancelField();
      retryTurn=null;
      message.value='';
      tell('');
      if (!retry) append('user',text,null,null,null,supporting);
      if (!supporting&&/^(?:(?:mochi[, ]+)?(?:go to sleep|sleep now|good night|tidur dulu)(?:[, ]+mochi)?)[.! ]*$/i.test(text)) {
        await sleep();
        return;
      }
      const language=chatLanguage(text);
      if (screen==='dashboard' && !share && (help || /\b(?:next step|what should i do next|langkah seterusnya)\b/i.test(text))) {
        const next=document.querySelector('#overview-next-action a.btn-primary:not([data-service-hidden]):not([data-service-unavailable])');
        if (next) {
          append('assistant',window.ReGenText.get('mochi.nextStep'),null,null,{href:next.href,label:next.textContent.trim()},supporting);
          emotion('bright');
          return;
        }
      }
      const starts=!!assist?.needsWriting(text,share?.data,screen);
      const revising=coaching?.draft && /\b(?:this draft|that draft|shorter|more concise|previous draft|last version|draf tadi|lebih ringkas)\b/i.test(text);
      const continuing=(coaching?.kind==='question'||revising)&&!assist?.outside(text)&&!assist?.smallTalk(text);
      const drafting=retry ? retry!=='conversation' : starts||continuing;
      const support=share?null:assist?.followUp(text,language,troubleshooting.get(supporting))
        || assist?.exportHelp(text,screen,language)
        || assist?.pageHelp(text,screen,language)||assist?.navigate(text,language)||assist?.support(text,language,starts);
      if (support?.topic) troubleshooting.set(supporting,support.topic);
      else if (!share) troubleshooting.delete(supporting);
      const guide=assist?.guide(screen,language==='auto'?'ms':language);
      const useLocal = !liveAvailable || supporting || assist?.smallTalk(text) || assist?.outside(text)
        || /^(?:i got rejected(?: today)?|saya baru kena reject|i got (?:the job|an offer))[.! ]*$/i.test(text);
      const local=share||retry||starts||!useLocal?null:localReply(text);
      if (local||support||(help&&!drafting)||supporting||!liveAvailable) {
        const reply=support||local||(guide && (help||drafting||/\b(?:here|page|screen|sini|halaman)\b/i.test(text))
          ? {reply:guide,mood:'curious'} : {reply:phrase(
            'I’m here with you. I can help with the steps on '+locationName()+'. What would you like to do next?',
            'Saya di sini. Saya boleh bantu dengan langkah di '+locationName()+'. Apa yang awak nak buat selepas ini?'
          ),mood:'curious'});
        append('assistant',reply.reply,null,null,reply.action,supporting);
        emotion(reply.mood);
        return;
      }
      if (drafting&&!retry&&(share||!coaching||!continuing)) {
        coaching={request:text,focus:share?.data.field||(field?.isConnected?fieldTip?.kind:null),share,turns:[],kind:null,draft:null};
      }
      const thread=drafting?coaching:null;
      writing=true;
      const controller=chatRequest=new AbortController();
      tell('Mochi is working on your reply…');
      update();
      try {
        const result=await Api.chatWithMochi({
          message:text,screen,section:locationName()===sections.review?'review':section,
          ...(thread?{
            history:thread.turns,coachingRequest:thread.request,
            ...(thread.focus?{focusField:thread.focus}:{}),
            ...(thread.share?{sharedField:thread.share.data}:{}),
            ...(thread.draft?{previousDraft:thread.draft}:{}),
            ...(useSavedResume?{useSavedResume:true}:{}),
          }:{history:conversation,intent:'conversation'}),
        },controller.signal);
        if (chatRequest!==controller||isSleeping()||!access) return;
        tell('');
        if (result.reason==='package') { applyState({access:false}); return; }
        if (result.reason==='chat_package') { refresh(); tell('You’ve reached the coaching allowance for this package.'); return; }
        if (result.reason==='daily') { tell('Mochi has reached the daily coaching limit. Your conversation is still here.');return; }
        if (result.reason==='asleep'||result.reason==='nap') { refresh(); return; }
        if (result.success&&typeof result.reply==='string'&&result.reply.trim()) {
          if (result.kind!=='outside') {
            const turns=[...(thread?.turns||conversation),{role:'user',text},{role:'assistant',text:result.reply}].slice(-8);
            if (thread) {
              thread.turns=turns;
              thread.kind=result.kind;
              if (result.suggestion) thread.draft=result.suggestion;
            } else conversation=turns;
          } else if (thread&&!thread.turns.length) coaching=null;
          append('assistant',result.reply,result.suggestion,thread?.share?.target);
          emotion(result.mood);
        } else {
          retryTurn={text,mode:thread?'writing':'conversation'};
          if(result.reason!=='busy'&&guide) append('assistant',guide);
          tell(result.reason==='busy'||result.status===429
            ? 'Mochi is busy. Try again in a moment.' : 'Mochi couldn’t finish this reply. You can retry without retyping.');
        }
      } finally {
        if (chatRequest===controller) { chatRequest=null; writing=false; update(); }
      }
    }
    function play(move,activity=null) {
      if (!access||isSleeping()||saving) return;
      if (!move) {
        const index=playIndex++;
        if (index>=4&&playKit.activities.length) activity=playKit.activities[((index-4)*13)%playKit.activities.length];
        move=activity?.speech||playKit.moves[index%playKit.moves.length];
      }
      lastPlayAt=Date.now();
      if (activity) longActs++;
      const line=playKit.line(move,profile.language);
      if (den) denLine=line;
      emotion(move[0],activity?.duration,activity,/meow/i.test(activity?.name||'')?'long-meow':move[0]==='sleep'?'sleep':move[0]==='laugh'?'laugh':'meow');
      if (activity) playKit.perform(pet,activity);
      speak(line,'play');
    }
    async function idlePlay(move,activity) {
      const now=Date.now();
      if (naps&&activity&&longActs>=3&&now-lastNapAttempt>150000&&Math.random()<.32) {
        lastNapAttempt=now;
        if (await save({action:'nap'})&&isNapping()) {longActs=0;return;}
      }
      const context = !den && pageMove(pageReactions++);
      if (context) play(context);
      else play(move,activity);
    }
    async function wake() {
      if (isNapping()||!profile.asleep||!await save({action:'sleep',enabled:false})) return;
      const line=phrase('Yawn… I’m here again!','Haa… dah bangun!');
      if (den) denLine=line;
      emotion('wave');
      if (open()) show('chat');
      else speak(line,'play');
    }
    async function sleep() {
      if (isNapping()) return;
      cancelField();cancelChat();hideBubble();
      if(await save({action:'sleep',enabled:true})) {
        view='chat';
        update();
        if(open()) find('wake').focus({preventScroll:true});
      }
    }

    document.addEventListener('focusin',event=>{
      const target=event.target;
      if (!(target instanceof HTMLElement)||!target.closest(editors)||!target.matches('input:not([type=hidden]),textarea,select')) return;
      cancelField();
      field=target;
      fieldTip=tipFor(target);
      displayedTip=fieldTip.text;
      displayedModel=false;
      lastExcerpt='';
      update();
      if (chatAllowed) speak(displayedTip);
    });
    document.addEventListener('focusout',event=>{if(event.target===field) cancelField();});
    document.addEventListener('input',event=>{
      if (!access||!chatAllowed||isSleeping()||event.isComposing||event.target!==field||!fieldTip?.kind||writing||saving) return;
      cancelField();
      updateShare();
      const value=excerpt(field), tip=fieldTip;
      const local=localTip(tip,value);
      if (displayedTip!==local) { displayedTip=local; displayedModel=false; update(); speak(local); }
      if (!profile.live||!liveAvailable||!liveFeedback||value.length<(tip.kind==='skills'?6:24)||lastExcerpt===value||nextFieldRequest-Date.now()>2400) return;
      const ticket=fieldRevision, input=field;
      fieldTimer=setTimeout(async()=>{
        if(ticket!==fieldRevision||document.activeElement!==input||!input.isConnected||document.hidden||isSleeping()||writing||saving) return;
        const controller=fieldRequest=new AbortController();
        nextFieldRequest=Date.now()+feedbackSeconds*1000;
        lastExcerpt=value;
        try {
          const result=await Api.commentWithMochi({field:tip.kind,text:value,live:true},controller.signal);
          if(ticket!==fieldRevision||fieldRequest!==controller||document.activeElement!==input||!input.isConnected) return;
          if(result.reason==='package') { applyState({access:false}); return; }
          if(result.reason==='asleep'||result.reason==='off'||result.reason==='nap') { refresh(); return; }
          if(result.success&&typeof result.comment==='string'&&result.comment.trim()) {
            displayedTip=result.comment; displayedModel=true; emotion(result.mood); speak(displayedTip,'model');
          } else if (result.status===429||['busy','unavailable','daily','chat_package'].includes(result.reason)) {
            nextFieldRequest=Math.max(nextFieldRequest,Date.now()+feedbackSeconds*1000);
          }
        } finally {if(fieldRequest===controller) fieldRequest=null;}
      },2400);
    });
    document.addEventListener('regen:section-ready',event=>{
      if (section!==event.detail?.section) {
        cancelChat();
        coaching=null;
        retryTurn=null;
        tell('');
      }
      section=event.detail?.section||'';
      cancelField(); field=null; fieldTip=null; displayedTip='';displayedModel=false;
      hideBubble();
      update();
    });
    document.addEventListener('regen:letter-loaded',()=>{
      cancelField();
      field=null;
      fieldTip=null;
      displayedTip='';
      displayedModel=false;
      clearConversation();
      tell('');
      if (open()&&view==='chat') seedChat();
      update();
    });
    document.addEventListener('regen:studio-review',()=>{
      hideBubble();
      petPosition.park();
    });
    document.addEventListener('regen:document-reading',hideBubble);
    document.addEventListener('regen:editor-moment',event=>{
      if (!access||!available||!chatAllowed||!editorReactions||isSleeping()||document.hidden||Date.now()-lastReaction<7000) return;
      const {kind,section:where}=event.detail||{};
      const label=sections[where]||'this section';
      const reactions={
        blocked:['startle',`Eh awak, kejap! ${label} ada ruangan yang belum siap. Mochi tunggu sini.`,
          `Wait up! A field in ${label} still needs you.`,`Kejap! Ada ruangan dalam ${label} yang belum lengkap.`],
        skipped:['sneak',`Eh, ${label} kosong lagi. Mochi nampak tau 👀 Kalau tak relevan, skip je.`,
          `I saw that empty ${label} section 👀 It’s fine to skip it if it doesn’t fit.`,`Eh, ${label} masih kosong. Kalau tak berkaitan, boleh langkau.`],
        review:['proud','Wah dah sampai review! Mochi nak buat victory lap.','You made it to review! Time for a victory lap.','Dah sampai semakan! Mochi nak pusing satu kali.'],
        'letter-saved':['purr','Cover letter dah save. Wah, pandai nyaa!','Cover letter saved. Look at you go!','Surat iringan dah disimpan. Wah, pandainya!'],
      };
      let move=reactions[kind];
      if (kind==='completed') {
        if (praised.has(where)) return;
        praised.add(where);
        move=++reactionCount%2?['proud',`Wah, pandai nyaa! ${label} dah siap. Mochi nak jadi macam awak jugakkk.`,
          `Look at you go! ${label} is done. I want to be like you when I grow up.`,`Wah, pandainya! ${label} dah siap.`]:
          ['purr','Okay nice, satu lagi section settle. Mochi proud kejap.', 'Another section done. I’m proud of you.', 'Satu lagi bahagian siap. Mochi bangga!'];
      }
      if (!move) return;
      lastReaction=Date.now();
      if (open()&&view==='chat') append('assistant',playKit.line(move,profile.language));
      play(move);
    });

    document.addEventListener('click',async event=>{
      const button=event.target.closest('button');
      if (!button) return;
      if (button===visibility) {
        mascotHidden=!mascotHidden;
        try { localStorage.setItem(visibilityKey,mascotHidden?'1':'0'); } catch {}
        hideBubble();
        playKit.stop(pet);
        update();
        return;
      }
      if(button.matches('[data-mochi-open]')) { if(open()) close(); else show(access && chatAllowed ? 'chat' : 'support',button); return; }
      if(!button.closest('#mochi-panel, [data-mochi-float], [data-mochi-den]')) return;
      if(button.matches('[data-mochi-close]')) {close();return;}
      if(button.matches('[data-mochi-support]')) {show('support',button);return;}
      if(button.matches('[data-mochi-back-chat]')) {show('chat',button);return;}
      if(button.matches('[data-mochi-options-button]')) {show(view==='options'?'chat':'options',button);return;}
      if ((button===soundButton||button===roomSound)&&allowSound) {await playKit.toggleSound();update();return;}
      if(button.matches('[data-mochi-kenal]')) {show('intro',button);return;}
      if(button.matches('[data-mochi-skip]')) {
        const wasOpen=open();
        hideBubble();
        if(await save({action:'skip'})&&wasOpen) show('chat');
        return;
      }
      if(button.matches('[data-mochi-sleep]')) {
        await sleep();
        return;
      }
      if (activitySelect&&button.matches('[data-mochi-play-activity],[data-mochi-surprise]')) {
        const index=button.matches('[data-mochi-surprise]')?Math.floor(Math.random()*playKit.activities.length):Number(activitySelect.value);
        const activity=playKit.activities[index];
        if (activity) {activitySelect.value=String(index);play(activity.speech,activity);}
        return;
      }
      if (button===pet&&isNapping()) {if(!den) show('chat',button);return;}
      if(button.matches('[data-mochi-wake]')||button===pet&&profile.asleep) {
        await wake();
        return;
      }
      if (button===pet) {
        if (access) play(event.detail>1?playKit.moves[2]:(!den && pageMove(pageReactions++)) || undefined);
        else if (available) { denLine=teaser; emotion('laugh'); speak(teaser,'teaser'); }
        return;
      }
      if(button===liveButton) {
        cancelField();
        if(await save({action:'live',enabled:!profile.live})) tell(profile.live?'Live field feedback is on.':'Live field feedback is off.');
        return;
      }
      if(button.matches('[data-mochi-forget]')) {
        if(await save({action:'forget'})) {clearConversation();update();tell('I’ve cleared your saved details.');}
        return;
      }
      if(button.matches('[data-mochi-help]')) {
        send(phrase('Can you help me with this part?','Boleh bantu saya di sini?'),{help:true});return;
      }
      if(button.matches('[data-mochi-share]')) {shareField();return;}
      if(button.matches('[data-mochi-resume]')) {
        useSavedResume=!useSavedResume;
        if (!useSavedResume) {coaching=null;retryTurn=null;}
        tell(useSavedResume?'Mochi will include your saved professional details in this chat.':'Saved resume sharing is off.');
        update();
        return;
      }
      if(button.matches('[data-mochi-retry]')&&retryTurn) {
        send(retryTurn.text,{retry:retryTurn.mode});return;
      }
    });
    intro.addEventListener('submit',async event=>{
      event.preventDefault();
      if(await save({action:'introduce',details:Object.fromEntries(new FormData(intro))})) {
        show('chat');
        append('assistant',profile.language==='ms'?'Seronok kenal awak! Kita boleh mula bila awak sedia.':
          (profile.nickname?'Nice to meet you, '+profile.nickname+'!':'Nice to meet you!')+' I’ll remember what you chose to share.');
        emotion('bright');
      }
    });
    composer.addEventListener('submit',event=>{event.preventDefault();send(message.value);});
    message.addEventListener('keydown',event=>{
      if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing) {event.preventDefault();composer.requestSubmit();}
    });
    panel.addEventListener('keydown',event=>{if(event.key==='Escape'){event.stopPropagation();close();}});
    let policyTimer;
    window.addEventListener('regen:live-change',event=>{
      if (!['features','store'].includes(event.detail?.topic)) return;
      clearTimeout(policyTimer);
      policyTimer=setTimeout(refresh,180);
    });
    window.addEventListener('storage',event=>{
      if (event.key!==visibilityKey) return;
      mascotHidden=event.newValue==='1';
      hideBubble();
      update();
    });
    window.addEventListener('regen:session-expired',()=>{applyState({access:false,available:false});hideBubble();});
    window.addEventListener('regen:session-restored',refresh);
    channel?.addEventListener('message',event=>{if(event.data==='changed') refresh();});
    document.addEventListener('visibilitychange',()=>{if(document.hidden) {cancelField();hideBubble();playKit.stopSound();}});
    reducedMotion.addEventListener('change',update);
    document.addEventListener('regen:studio-focus',event=>{
      if (event.detail.active) hideBubble();
      else petPosition.constrain();
    });
    window.addEventListener('pagehide',()=>{cancelField();cancelChat();});
    window.addEventListener('pageshow',event=>{if(event.persisted) refresh();});
    let frame=0;
    const header=document.querySelector('.workbench-header,.workspace-header');
    const position=()=>{
      cancelAnimationFrame(frame);
      frame=requestAnimationFrame(()=>{
        const vv=window.visualViewport, usable=vv?.scale===1;
        const height=usable?vv.height:innerHeight, top=usable?vv.offsetTop:0;
        const inset=Math.max(0,innerHeight-height-top);
        const floor=Math.max(8,(header?.getBoundingClientRect().bottom??0)-top+8);
        panel.style.setProperty('--mochi-header-floor',Math.ceil(floor)+'px');
        document.documentElement.style.setProperty('--mochi-viewport-inset',Math.round(inset)+'px');
        document.documentElement.style.setProperty('--mochi-visible-height',Math.round(height)+'px');
        floating.dataset.keyboard=String(inset>90);
      });
    };
    window.visualViewport?.addEventListener('resize',position);
    window.visualViewport?.addEventListener('scroll',position);
    window.addEventListener('resize',position);
    window.addEventListener('scroll',()=>{if(open())position();},{passive:true});
    if (header&&'ResizeObserver' in window) new ResizeObserver(position).observe(header);
    position();
    update();
    refresh();
    setInterval(()=>{if(!document.hidden&&(open()||scheduled||!window.ReGenLive?.connected))refresh();},90000);
    playKit.idle(pet,()=>access&&(den||!mascotHidden)&&autoplay&&!isSleeping()&&!open()&&!saving&&mood==='curious'&&Date.now()>=playingUntil&&Date.now()-lastPlayAt>4400
      && !document.activeElement?.matches('input,textarea,select,[contenteditable="true"]'),idlePlay,()=>health,!!den,()=>pace);
  }

  if (document.readyState!=='complete') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
