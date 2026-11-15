/* Local play shared by the workspace and the public Mochi preview. */
window.MochiPlay = (() => {
  const moves = [
    ['wave','Hai! Ingat saya tak nampak awak scroll tadi?','Hi! I saw you scroll past.','Hai! Saya nampak awak lalu tadi.'],
    ['hop','Boing! Parkour level: satu Mochi.','Boing! That’s one small hop for Mochi.','Boing! Tinggi tak saya lompat?'],
    ['laugh','Hehehe geli lah! Okay, my turn to kacau awak.','Hehehe, that tickles! My turn to bother you.','Hehehe, geli lah! Giliran saya kacau awak.'],
    ['dance','Tiny dance break. Shh, jangan bagitahu resume tu.','Tiny dance break. Don’t tell the resume.','Rehat menari kejap. Jangan beritahu resume tu.'],
    ['yarn','Eh benang! Come back sini, Mochi belum menang!','Come back, yarn! I haven’t won yet.','Eh benang! Datang balik, Mochi belum menang!'],
    ['climb','Tinggi sikit je… okay siapa nak tolong Mochi turun?','Just a bit higher… wait, how do I get down?','Tinggi sikit lagi… siapa nak tolong Mochi turun?'],
    ['purr','Prrr… Mochi suka bila awak datang teman.','Prrr… I like it when you keep me company.','Prrr… Mochi suka bila awak teman.'],
    ['sneak','Jangan pandang. Mochi tengah buat stealth mission.','Don’t look. I’m on a stealth mission.','Jangan pandang. Mochi tengah menyelinap.'],
  ];
  const idleMoves = [
    moves[4], moves[5], moves[7],
    ['sleep','Power nap dulu… jangan curi snack Mochi.','Power nap. Please guard my snacks.','Tidur kejap… tolong jaga snek Mochi.'],
    moves[6], moves[3],
  ];
  const activities=window.MochiActivities?.moves??[];
  const clips=new WeakMap();
  const lowMotion=matchMedia('(prefers-reduced-motion: reduce)');
  function stop(pet) {
    const active=clips.get(pet);
    if (!active) return;
    active.motion?.cancel();
    active.toy?.remove();
    active.shadowMotion?.cancel();
    active.shadow?.remove();
    delete pet.dataset.mochiGrounded;
    clips.delete(pet);
  }
  function perform(pet,activity) {
    stop(pet);
    if (!activity) return;
    const {left,right,width,height,top,bottom}=pet.getBoundingClientRect();
    const stage=pet.closest('.mochi-den-stage');
    const room=stage&&!pet.classList.contains('mochi-positioned')?stage.getBoundingClientRect():null;
    const ranges={
      left:Math.max(0,Math.min(left-8,room?left-room.left-8:130)),
      right:Math.max(0,Math.min(innerWidth-right-8,room?room.right-right-8:105)),
      up:Math.max(0,Math.min(top-8,room?top-room.top+height*.16:height*.34)),
      down:Math.max(0,Math.min(innerHeight-bottom-8,room?room.bottom-bottom-8:height*.14)),
    };
    const toy=activity.toy==='none'?null:document.createElement('span');
    if (toy) {
      toy.className='mochi-play-prop';
      toy.dataset.toy=activity.toy;
      toy.textContent=window.MochiActivities.toys[activity.toy]??'';
      toy.setAttribute('aria-hidden','true');
      (room?stage:pet).append(toy);
    }
    const transform=([offset,x,y,angle=0,scale=1])=>{
      const kx=x*(x<0?ranges.left:ranges.right), ky=y*(y<0?ranges.up:ranges.down);
      return {offset,transform:`translate(${kx}px,${ky}px) rotate(${angle}deg) scale(${scale})`,easing:'cubic-bezier(.35,.12,.55,.98)'};
    };
    const motion=lowMotion.matches||typeof pet.animate!=='function'?null:pet.animate(activity.track.map(transform),{duration:activity.duration});
    let shadow, shadowMotion;
    if (motion&&room) {
      shadow=document.createElement('span');
      shadow.className='mochi-contact-shadow';
      shadow.style.cssText=`left:${left-room.left+width*.16}px;top:${bottom-room.top-height*.17}px;width:${width*.68}px;height:${height*.13}px`;
      shadow.setAttribute('aria-hidden','true');
      stage.prepend(shadow);
      pet.dataset.mochiGrounded='true';
      shadowMotion=shadow.animate(activity.track.map(([offset,x,y])=>({
        offset, transform:`translateX(${x*(x<0?ranges.left:ranges.right)}px) scale(${1+Math.min(0,y)*.35})`,
        opacity:1+Math.min(0,y)*.48,easing:'cubic-bezier(.35,.12,.55,.98)',
      })),{duration:activity.duration});
    }
    const current={motion,toy,shadow,shadowMotion};
    clips.set(pet,current);
    motion?.finished.then(()=>{if(clips.get(pet)===current)stop(pet);},()=>{});
  }
  const durations = {yarn:3900,climb:4200,sneak:2600,purr:3000,sleep:5000,proud:2700,startle:1600};
  const duration = mood => durations[mood] || 2100;
  const line = (move,language) => move[language==='en'?2:language==='ms'?3:1];
  const effect = mood => ({sleep:'z Z',laugh:'✧ ✦',hop:'✧',dance:'♪ ✧',bright:'✦',sad:'💧',purr:'♥',sneak:'· ·',proud:'✦ ♡',startle:'!'})[mood]||'';
  function idle(pet, canPlay, play, health, showcase=false, pace=()=> 'balanced') {
    let next=0, timer=0, visible=true;
    function schedule(first=false) {
      clearTimeout(timer);
      if (!visible || document.hidden) return;
      const multiplier={calm:1.8,balanced:1,playful:.7}[pace()]||1;
      timer=setTimeout(()=>{
        const rect=pet.getBoundingClientRect();
        if (!document.hidden&&rect.bottom>0&&rect.top<innerHeight&&rect.width&&canPlay()) {
          const index=next++;
          if (index<2||!activities.length) play(idleMoves[index%idleMoves.length]);
          else {
            const activity=activities[(index*13+7)%activities.length];
            play(activity.speech,activity);
          }
        }
        schedule();
      }, (health()<35?24000:first?(showcase?2600:6500):showcase?5600+Math.random()*3800:9500+Math.random()*6500)*multiplier);
    }
    schedule(true);
    if ('IntersectionObserver' in window) new IntersectionObserver(([entry])=>{
      if (entry.isIntersecting===visible) return;
      visible=entry.isIntersecting;schedule(next===0);
    }).observe(pet);
    document.addEventListener('visibilitychange',()=>schedule(next===0));
  }
  function renderWhenVisible(pet,ready) {
    if (!window.MochiAvatar) return;
    if (!('IntersectionObserver' in window)) {ready(window.MochiAvatar.mount(pet));return;}
    const observer=new IntersectionObserver(([entry])=>{
      if (!entry.isIntersecting) return;
      observer.disconnect();
      ready(window.MochiAvatar.mount(pet));
    });
    observer.observe(pet);
  }

  let audio, soundOn=false, lastSound=0;
  const voices=new Set();
  function stopSound() {
    for (const voice of voices) {try {voice.stop();} catch {}}
    voices.clear();
  }
  try { soundOn=sessionStorage.getItem('mochi-sound')==='on'; } catch {}
  const soundCapable=()=>!!(window.AudioContext||window.webkitAudioContext);
  const soundEnabled=()=>soundOn&&soundCapable();
  function unlockSound() {
    if (!soundEnabled()) return;
    try {
      if (!audio) audio=new (window.AudioContext||window.webkitAudioContext)();
      if (audio.state==='suspended') audio.resume().catch(()=>{});
    } catch {}
  }
  function soundFor(mood, preview=false) {
    if (!soundEnabled()||audio?.state!=='running'||document.hidden||(!preview&&Date.now()-lastSound<900)) return;
    const effects = {
      laugh:[[0,540,820,.14],[.13,600,890,.13],[.25,730,470,.17]],
      purr:[[0,31,36,.7]], wave:[[0,425,610,.15],[.13,600,335,.29]],
      yarn:[[0,440,575,.13],[.14,545,380,.23]], climb:[[0,490,680,.17]],
      startle:[[0,580,900,.12]], proud:[[0,500,700,.17],[.17,710,430,.24]],
      bright:[[0,420,660,.2]], sneak:[[0,355,430,.15]], hop:[[0,500,665,.12]],
      meow:[[0,470,670,.42],[.55,460,620,.32]],
      'long-meow':[[0,415,630,.6],[.95,480,700,.76],[2.1,420,590,.74],[3.25,525,725,1.08],[4.85,425,575,.66]],
    };
    if (!effects[mood]) return;
    lastSound=Date.now();
    for (const [delay,from,to,length] of effects[mood]) {
      const start=audio.currentTime+delay+.015;
      const voice=audio.createOscillator(), envelope=audio.createGain(), filter=audio.createBiquadFilter();
      const feline=mood==='meow'||mood==='long-meow';
      voice.type=mood==='purr'||feline?'sawtooth':'triangle';
      voice.frequency.setValueAtTime(from,start);
      voice.frequency.exponentialRampToValueAtTime(to,start+length*(feline?.29:.7));
      voice.frequency.exponentialRampToValueAtTime(Math.max(25,to*(feline?.59:.8)),start+length);
      filter.type='lowpass';
      filter.frequency.value=mood==='purr'?135:feline?950:1650;
      envelope.gain.setValueAtTime(.001,start);
      envelope.gain.exponentialRampToValueAtTime(mood==='purr'?.05:feline?.043:.072,start+.04);
      envelope.gain.exponentialRampToValueAtTime(.001,start+length);
      voice.connect(filter).connect(envelope).connect(audio.destination);
      voices.add(voice);
      voice.onended=()=>voices.delete(voice);
      voice.start(start);
      voice.stop(start+length+.02);
    }
  }
  async function toggleSound() {
    soundOn=!soundOn;
    try {sessionStorage.setItem('mochi-sound',soundOn?'on':'off');} catch {}
    if (soundOn) {
      unlockSound();
      try {await audio?.resume();soundFor('wave',true);} catch {}
    } else stopSound();
    return soundEnabled();
  }
  document.addEventListener('pointerdown',unlockSound,{passive:true});
  document.addEventListener('keydown',unlockSound);
  function draggable(pet, anchor=pet) {
    let start=null, position=null, suppressClick=false;
    function moveTo(x,y) {
      const rect=pet.getBoundingClientRect();
      x=Math.max(8,Math.min(innerWidth-rect.width-8,x));
      y=Math.max(8,Math.min(innerHeight-rect.height-8,y));
      for (const selector of ['.feedback-launcher','.mobile-product-nav','.builder-bottom-bar']) {
        const obstacle=document.querySelector(selector)?.getBoundingClientRect();
        if (obstacle?.width&&x<obstacle.right+8&&x+rect.width>obstacle.left-8&&y<obstacle.bottom+8&&y+rect.height>obstacle.top-8) {
          y=Math.max(8,obstacle.top-rect.height-8);
        }
      }
      if (!anchor.classList.contains('mochi-positioned')) {
        anchor.style.setProperty('--mochi-drag-size',Math.round(rect.width)+'px');
      }
      anchor.classList.add('mochi-positioned');
      anchor.dataset.mochiDragLeft=String(x<innerWidth/2);
      anchor.dataset.mochiDragTop=String(y<130);
      anchor.style.setProperty('--mochi-x',Math.round(x)+'px');
      anchor.style.setProperty('--mochi-y',Math.round(y)+'px');
      position={x,y};
    }
    pet.addEventListener('pointerdown',event=>{
      if (event.button!==0||!event.isPrimary) return;
      suppressClick=false;
      const rect=pet.getBoundingClientRect();
      start={id:event.pointerId,x:event.clientX,y:event.clientY,left:rect.left,top:rect.top};
      pet.setPointerCapture(event.pointerId);
    });
    pet.addEventListener('pointermove',event=>{
      if (!start||start.id!==event.pointerId) return;
      const dx=event.clientX-start.x,dy=event.clientY-start.y;
      if (!suppressClick&&Math.hypot(dx,dy)<8) return;
      stop(pet);
      suppressClick=true;
      moveTo(start.left+dx,start.top+dy);
    });
    const finish=()=>{start=null;};
    for (const event of ['pointerup','pointercancel','lostpointercapture']) pet.addEventListener(event,finish);
    pet.addEventListener('click',event=>{
      if (!suppressClick) return;
      event.stopImmediatePropagation();
      event.preventDefault();
      suppressClick=false;
    },true);
    pet.addEventListener('keydown',event=>{
      if (event.key==='Escape'&&position) {
        anchor.classList.remove('mochi-positioned');
        position=null;
        return;
      }
      const directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
      const direction=directions[event.key];
      if (!direction) return;
      event.preventDefault();
      const rect=pet.getBoundingClientRect();
      moveTo(rect.left+direction[0]*24,rect.top+direction[1]*24);
    });
    window.addEventListener('resize',()=>{if(position&&pet.offsetWidth)moveTo(position.x,position.y);});
  }

  function demo() {
    const den=document.querySelector('[data-mochi-demo]');
    if (!den) return;
    const pet=den.querySelector('[data-mochi-pet]'), caption=den.querySelector('[data-mochi-den-line]');
    const sound=den.querySelector('[data-mochi-demo-sound]');
    const studio=document.querySelector('[data-mochi-studio]');
    const links=document.querySelectorAll('[data-mochi-demo-link]');
    let avatar, rendererPending=false, health=100, next=0, timer, lastTap=0, autoplay=true, canSound=true, busyUntil=0, napUntil=0, longActs=0;
    let pace='balanced', naps=true, activeMove=null, activeClip=null;
    const soundState=()=> {
      if (!sound) return;
      sound.setAttribute('aria-pressed',String(soundEnabled()));
      sound.textContent=soundEnabled()?'Sound on':'Sound off';
    };
    function pose(move,activity=null) {
      clearTimeout(timer);
      stopSound();
      den.dataset.mochiMood=move[0];
      pet.querySelector('[data-mochi-fx]').textContent=effect(move[0]);
      caption.textContent=line(move);
      const length=activity?.duration??duration(move[0]);
      activeMove=move;activeClip=activity;
      if (activity) longActs++;
      busyUntil=Date.now()+length;
      avatar?.setMood(move[0],activity?length:undefined,activity);
      perform(pet,activity);
      if (canSound) soundFor(/meow/i.test(activity?.name||'')?'long-meow':move[0]==='sleep'?'sleep':move[0]==='laugh'?'laugh':'meow');
      timer=setTimeout(()=>{
        den.dataset.mochiMood='curious';
        activeMove=null;activeClip=null;
        pet.querySelector('[data-mochi-fx]').textContent='';
        avatar?.setMood('curious');
        stop(pet);
      },length);
    }
    function idlePose(move,activity) {
      if (naps&&activity&&longActs>=4&&Math.random()<.25) {
        const duration=28000+Math.round(Math.random()*20000);
        napUntil=Date.now()+duration;
        pose(['sleep','Shh… Mochi tengah lena. Nanti bangun sendiri.'],{duration,track:[[0,0,0,0,1],[1,0,0,0,1]],toy:'none'});
        longActs=0;
      } else pose(move,activity);
    }
    function apply(status) {
        const hidden=status.available!==true;
        if (!hidden && den.hidden) studio?.removeAttribute('open');
        den.hidden=hidden;
        links.forEach(link=>{link.hidden=hidden;});
        health=status.health??100;
        autoplay=status.autoplay!==false;
        pace=status.pace??'balanced';
        naps=status.naps!==false;
        canSound=status.sound!==false&&soundCapable();
        if (!canSound||hidden) stopSound();
        if (sound) {sound.hidden=!canSound;soundState();}
        if (!den.hidden&&!rendererPending) {
          rendererPending=true;
          renderWhenVisible(pet,renderer=>{
            avatar=renderer;
            if (activeMove) avatar.setMood(activeMove[0],Math.max(0,busyUntil-Date.now()),activeClip);
          });
        }
    }
    async function refresh() {
      try {
        const response=await fetch('/site/mochi.json',{cache:'no-store'});
        if (response.ok) apply(await response.json());
      } catch { /* Keep the rendered public preview when offline. */ }
    }
    pet.addEventListener('click',()=>{
      if (Date.now()<napUntil) return;
      lastTap=Date.now();
      const index=next++;
      if (index<2||!activities.length) pose(moves[index%moves.length]);
      else {const activity=activities[(index*11)%activities.length];pose(activity.speech,activity);}
    });
    den.querySelector('[data-mochi-demo-greet]')?.addEventListener('click',()=>{
      if (Date.now()<napUntil) return;
      lastTap=Date.now();
      pose(['wave','Hai, I’m Mochi! Nak polish resume atau tulis cover letter? Mochi boleh tolong.']);
    });
    sound?.addEventListener('click',async()=>{await toggleSound();soundState();});
    draggable(pet);
    idle(pet,()=>!den.hidden&&autoplay&&Date.now()>=busyUntil&&Date.now()-lastTap>4400,idlePose,()=>health,true,()=>pace);
    try {
      const initial=JSON.parse(document.getElementById('mochi-preview-status')?.textContent??'null');
      if (initial) apply(initial);
      else refresh();
    } catch { refresh(); }
    setInterval(()=>{if(!document.hidden)refresh();},60000);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)stopSound();else refresh();});
  }
  document.addEventListener('DOMContentLoaded',demo,{once:true});
  return {moves,activities,line,effect,idle,draggable,renderWhenVisible,perform,stop,duration,soundCapable,soundEnabled,soundFor,toggleSound,stopSound};
})();
