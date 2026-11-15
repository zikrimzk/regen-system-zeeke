/* Lightweight, locally rendered Mochi. One mesh is reused for every sculpted part. */
window.MochiAvatar = (() => {
  const vertex = [
    'attribute vec3 point;',
    'uniform mat3 pose;',
    'uniform vec3 center, radii, offset;',
    'uniform float angle, aspect, zoom;',
    'varying vec3 normal;',
    'vec3 spin(vec3 v) { float s=sin(angle), c=cos(angle); return vec3(c*v.x-s*v.y,s*v.x+c*v.y,v.z); }',
    'void main(){',
    '  vec3 p=zoom*(pose*(center+spin(point*radii)))+offset;',
    '  normal=normalize(pose*spin(point/radii));',
    '  float d=5.45-p.z;',
    '  gl_Position=vec4(p.x*3.13/aspect,p.y*3.13,d*1.012-.25,d);',
    '}'
  ].join('\n');
  const fragment = [
    'precision mediump float;',
    'uniform vec3 color;',
    'uniform float shine;',
    'varying vec3 normal;',
    'void main(){',
    ' vec3 n=normalize(normal);',
    ' vec3 light=normalize(vec3(-.52,.77,1.1));',
    ' float key=max(dot(n,light),0.);',
    ' float bounce=max(dot(n,normalize(vec3(.7,-.3,.5))),0.);',
    ' float spec=pow(max(dot(n,normalize(vec3(-.28,.38,1.))),0.),22.);',
    ' float rim=pow(1.-max(n.z,0.),2.) * max(n.y+.35,0.) * .09;',
    ' vec3 rgb=color*(.70+.30*key+.08*bounce)+vec3(.99,.97,.79)*(spec*shine+rim);',
    ' gl_FragColor=vec4(rgb,1.);',
    '}'
  ].join('\n');
  const palette = Object.fromEntries(Object.entries({
    leaf:'#b4dc8c', ear:'#9bcf79', cream:'#fff4cc', shadow:'#d1e69d', stem:'#629840',
    lime:'#d1f57a', collar:'#548d4c', scarf:'#77ae54', mint:'#bae477', yellow:'#ffdb69',
    honey:'#eaaa3c', dark:'#232c1d', olive:'#648b3e', black:'#111e15', gleam:'#fffdf0',
    cheek:'#f3a7a1', pad:'#f4a2a5', mouth:'#5b2b2a', tongue:'#ff969d', tear:'#7ad9f3',
    yarn:'#ee8f9e', stitch:'#ffd4d9', bark:'#a57856', rung:'#ddae75'
  }).map(([key,hex])=>[key,[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255)]));
  const PI = Math.PI;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function mesh() {
    const positions = [], indices = [];
    const rows = 16, columns = 24;
    for (let i = 0; i <= rows; i++) {
      const theta = i * PI / rows;
      for (let j = 0; j <= columns; j++) {
        const phi = j * 2 * PI / columns;
        positions.push(Math.sin(theta) * Math.cos(phi), Math.cos(theta), Math.sin(theta) * Math.sin(phi));
      }
    }
    for (let i = 0; i < rows; i++) for (let j = 0; j < columns; j++) {
      const a = i * (columns + 1) + j, b = a + columns + 1;
      indices.push(a,b,a+1,a+1,b,b+1);
    }
    return {positions:new Float32Array(positions),indices:new Uint16Array(indices)};
  }
  function rotation(x,y,z) {
    const cx=Math.cos(x),sx=Math.sin(x),cy=Math.cos(y),sy=Math.sin(y),cz=Math.cos(z),sz=Math.sin(z);
    return new Float32Array([cy*cz,cy*sz,-sy,sx*sy*cz-cx*sz,sx*sy*sz+cx*cz,sx*cy,cx*sy*cz+sx*sz,cx*sy*sz-sx*cz,cx*cy]);
  }

  function mount(button) {
    const canvas = button.querySelector('canvas');
    const fallback = {setMood() {}};
    if (!canvas) return fallback;
    let gl, program;
    try {
      gl = canvas.getContext('webgl', {alpha:true,antialias:true,powerPreference:'low-power'});
      if (!gl) return fallback;
      const shader = (type, source) => {
        const out = gl.createShader(type);
        gl.shaderSource(out,source);
        gl.compileShader(out);
        if (!gl.getShaderParameter(out,gl.COMPILE_STATUS)) throw new Error('Mochi shader unavailable');
        return out;
      };
      program=gl.createProgram();
      const vs=shader(gl.VERTEX_SHADER,vertex), fs=shader(gl.FRAGMENT_SHADER,fragment);
      gl.attachShader(program,vs);
      gl.attachShader(program,fs);
      gl.linkProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      if (!gl.getProgramParameter(program,gl.LINK_STATUS)) return fallback;
    } catch { return fallback; }
    const m = mesh();
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER,m.positions,gl.STATIC_DRAW);
    const point = gl.getAttribLocation(program,'point');
    gl.enableVertexAttribArray(point);
    gl.vertexAttribPointer(point,3,gl.FLOAT,false,0,0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,gl.createBuffer());
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,m.indices,gl.STATIC_DRAW);
    const uniforms = Object.fromEntries(['center','radii','offset','angle','aspect','zoom','pose','color','shine'].map(name=>[name,gl.getUniformLocation(program,name)]));
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0,0,0,0);

    const round = (x,y,z,rx,ry,rz,color,angle=0,shine=.07) => {
      gl.uniform3f(uniforms.center,x,y,z);
      gl.uniform3f(uniforms.radii,rx,ry,rz);
      gl.uniform1f(uniforms.angle,angle);
      gl.uniform3fv(uniforms.color,palette[color]);
      gl.uniform1f(uniforms.shine,shine);
      gl.drawElements(gl.TRIANGLES,m.indices.length,gl.UNSIGNED_SHORT,0);
    };
    function stroke(x1,y1,x2,y2,z,thickness,color) {
      const dx=x2-x1,dy=y2-y1;
      round((x1+x2)/2,(y1+y2)/2,z,Math.hypot(dx,dy)/2+thickness,thickness,thickness,color,Math.atan2(dy,dx),.01);
    }
    function arc(cx,cy,z,w,curve,thickness,color) {
      for (let i=0;i<5;i++) {
        const a=-1+i*.4,b=a+.4;
        stroke(cx+w*a,cy+curve*a*a,cx+w*b,cy+curve*b*b,z,thickness,color);
      }
    }
    const still = matchMedia('(prefers-reduced-motion: reduce)');
    let mood = 'curious', started = performance.now(), last = 0, end = started+1400;
    let frame = 0, idle = 0, lost = false, lookX=0, lookY=0;
    let activeBlink = false, onScreen = true, activity = null;
    const neutral = rotation(0,0,0);
    const ease = x => { x=clamp(x,0,1);return x*x*(3-2*x); };

    function draw(now) {
      const width = canvas.clientWidth, height = canvas.clientHeight;
      if (!width || !height || lost) return false;
      // Large stages keep their detail on Retina screens without making small pets expensive.
      const ratio = Math.min(devicePixelRatio || 1,2.25,(width>=180?920:300)/Math.max(width,height));
      const w = Math.max(1,Math.round(width*ratio)), h = Math.max(1,Math.round(height*ratio));
      if (canvas.width!==w || canvas.height!==h) { canvas.width=w; canvas.height=h; }
      gl.viewport(0,0,w,h);
      gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      const sleeping=mood==='sleep', laughing=mood==='laugh', crying=mood==='sad', joyful=mood==='bright', wave=mood==='wave';
      const hopping=mood==='hop', dancing=mood==='dance';
      const yarn=mood==='yarn', climbing=mood==='climb', sneaking=mood==='sneak';
      const purring=mood==='purr', proud=mood==='proud', startled=mood==='startle';
      const t = still.matches ? .44 : Math.max(0,(now-started)/1000);
      const meowing=activity?.toy==='note'&&/meow/i.test(activity.name??'');
      const meow=meowing?Math.max(0,...[[0,.6],[.95,.76],[2.1,.74],[3.25,1.08],[4.85,.66]].map(([start,length])=>{
        const phase=(t-start)/length;
        return phase<0||phase>1?0:Math.sin(phase*PI);
      })):0;
      let stride=0, direction=0;
      if (activity && !still.matches && (sneaking||hopping||climbing||yarn)) {
        const progress=clamp((now-started)/activity.duration,0,1);
        const index=Math.max(1,activity.track.findIndex(point=>point[0]>=progress));
        const from=activity.track[index-1], to=activity.track[index];
        const phase=clamp((progress-from[0])/(to[0]-from[0]),0,1);
        const speed=(to[1]-from[1])/(to[0]-from[0]);
        direction=clamp(speed/4,-1,1)*Math.sin(Math.PI*phase);
        stride=Math.abs(direction)*Math.min(1,(1-progress)*12);
      }
      const wobble = still.matches || sleeping ? 0 : Math.sin(t*3.5)*.025;
      const energy = still.matches ? 0 : Math.max(0,1-t/1.8);
      const jump = (laughing||joyful||hopping||dancing)
        ? Math.abs(Math.sin(t*(hopping?5.4:8.5)))*(hopping?.32:.12)*energy : 0;
      gl.uniform1f(uniforms.aspect,w/h);
      const batTime = Math.max(0,t-.52);
      const bat = yarn ? Math.max(0,Math.sin(t*7))*Math.max(0,1-t/3.9) : 0;
      const yarnX = .9+ .58*(1-Math.exp(-batTime*1.45))*Math.cos(batTime*2.9);
      const yarnY = -.97+Math.max(0,.90*batTime-.93*batTime*batTime);
      const climb = climbing ? ease((t-.35)/1.55)*(1-ease((t-2.55)/1.15)) : 0;
      if (yarn || climbing) {
        gl.uniform1f(uniforms.zoom,1);
        gl.uniform3f(uniforms.offset,0,0,0);
        gl.uniformMatrix3fv(uniforms.pose,false,neutral);
        if (yarn) {
          round(yarnX,yarnY,.68,.23,.22,.22,'yarn');
          for (const seam of [-1,0,1]) {
            const tilt = .7+Math.sin(batTime*4+seam)*.7;
            round(yarnX+seam*.07,yarnY,.868,.025,.177,.017,'stitch',tilt);
          }
          stroke(yarnX+.15,yarnY-.12,yarnX+.29,yarnY-.22,.69,.017,'yarn');
          stroke(yarnX+.29,yarnY-.22,yarnX+.38,yarnY-.17,.69,.017,'stitch');
        } else {
          stroke(1.19,-1.14,1.21,1.05,-.24,.085,'bark');
          stroke(1.48,-1.14,1.51,1.07,-.24,.085,'bark');
          for (let i=0;i<5;i++) stroke(1.18,-.91+i*.43,1.51,-.91+i*.43,-.15,.062,'rung');
          round(1.14,1.12,-.23,.17,.078,.066,'ear',.42);
          round(1.43,1.15,-.23,.18,.073,.073,'leaf',-.31);
        }
      }
      const sway = dancing ? Math.sin(t*9)*.26*energy : 0;
      const turn = (dancing ? Math.sin(t*5.7)*.7*energy : 0)+(yarn?.28:climbing?.34:0);
      const angle = sleeping ? -.39 : crying ? -.055 : wobble+sway-direction*.15+(laughing?Math.sin(t*9)*.052*energy:0)+(purring?-.16:sneaking?.14:climbing?-.12:0);
      const startle = startled && t<.55 ? Math.max(0,1.9*t-3.3*t*t) : 0;
      const stalk = sneaking ? Math.sin(t*2.4)*.24*ease(t/.45)*(1-ease((t-1.7)/.8)) : 0;
      gl.uniformMatrix3fv(uniforms.pose,false,rotation(sleeping?.15:-.07+lookY, sleeping?-.17:lookX+wobble*.9+turn+direction*.6,angle));
      gl.uniform1f(uniforms.zoom,yarn||climbing?.73:sneaking?.85:1);
      gl.uniform3f(uniforms.offset,(yarn?-.38+bat*.26:climbing?.11+climb*.29:stalk), (sleeping?-.25:-.13)+jump+climb*.53+startle+Math.abs(Math.sin(t*11))*.055*stride-(sneaking?.24:purring?.07:0),0);

      // Coat, velvet ear linings, scarf and foot pads.
      round(-.59,-.91,-.37,.32,.27,.31,'cream',.3);
      if (yarn||sneaking||purring||climbing) {
        const tail = still.matches?0:Math.sin(t*5.2)*.15;
        stroke(-.57,-.83,-.91,-.66+tail,-.33,.125,'leaf');
        stroke(-.91,-.66+tail,-.98,-.49+tail,-.33,.102,'ear');
      }
      round(0,-.62,-.01,.68,.64,.49,'leaf');
      round(0,-.68,.40,.47,.43,.14,'cream');
      round(-.51,-.18,-.19,.49,.17,.15,'scarf',.39);
      round(-.68,-.32,-.20,.41,.11,.13,'collar',-.16);
      for (const side of [-1,1]) {
        const stepCycle=Math.sin(t*11+side*PI/2)*stride;
        const earTilt=-side*(.50+wobble*1.5)+direction*.16-Math.sin(t*11-.7)*stride*.10;
        round(side*.93,.36,-.04,.56,.29,.26,'ear',earTilt);
        round(side*1.02,.29,.11,.43,.195,.13,'shadow',earTilt);
        round(side*1.09,.24,.171,.33,.145,.085,'cream',earTilt);
        const raised = hopping||dancing||proud||startled||climbing||side===1&&(wave||laughing||yarn);
        const step = climbing&&!still.matches ? Math.sin(t*12+side*1.57)*.24*climb : 0;
        const handX=side*(raised?.68:.58)+(yarn&&side===1?bat*.4:0)+stepCycle*.08, handY=(raised?-.33:-.67)+step+stepCycle*.10;
        const handAngle=(raised?side*(-.35+Math.sin(t*13)*.25*energy):side*.36)+stepCycle*.35;
        round(handX,handY,.20,.24,.35,.23,'leaf',handAngle);
        if (raised) {
          round(handX+.065,handY+.10,.388,.16,.19,.072,'cream',handAngle);
          round(handX+.064,handY+.064,.454,.076,.067,.018,'pad');
          for (let j=-1;j<=1;j++) round(handX+.061+j*.053,handY+.18-Math.abs(j)*.027,.445,.029,.033,.013,'pad');
        }
        const footX=side*.39-stepCycle*.11, lift=Math.max(0,-stepCycle)*.15, reach=stepCycle*.10;
        round(footX,-1.035+lift,.36+reach,.29,.27,.27,'leaf',side*.18);
        round(footX,-1.065+lift,.55+reach,.242,.222,.115,'cream',side*.18);
        round(footX,-1.117+lift,.65+reach,.106,.077,.024,'pad',side*.12);
        for (let j=-1;j<=1;j++) round(footX+j*.069,-.983+lift-Math.abs(j)*.022,.633+reach,.033,.036,.022,'pad');
      }
      round(-.09,-.632,.537,.105,.047,.023,'scarf',-.71);
      round(.077,-.619,.538,.117,.053,.024,'scarf',.65);
      stroke(-.005,-.74,0,-.641,.538,.017,'scarf');
      round(0,-.15,.025,.65,.155,.49,'collar',-.015);
      round(.17,-.21,.478,.178,.136,.085,'scarf',.12);
      round(.18,-.214,.552,.103,.083,.03,'mint');
      round(.132,-.146,.548,.032,.048,.022,'mint',.17);
      round(.23,-.146,.548,.032,.047,.022,'mint',-.17);
      round(.15,-.213,.582,.011,.014,.008,'dark');
      round(.21,-.213,.582,.011,.014,.008,'dark');

      // Face sits within the head silhouette. Antennae and flower are modeled in volume.
      round(0,.53,0,.92,.696,.568,'leaf');
      round(0,.416,.379,.795,.532,.299,'cream');
      round(-.30,.764,.548,.284,.205,.084,'cream',.52);
      round(.28,.759,.55,.299,.216,.081,'cream',-.45);
      for (const side of [-1,1]) {
        const ax=side*(.39+wobble*1.25), ay=1.38+side*.028;
        stroke(side*.22,1.043,side*.25,1.245,.02,.048,'stem');
        stroke(side*.25,1.245,ax,ay,.02,.047,'stem');
        round(ax,ay,.016,.057,.057,.052,'stem');
        round(ax+side*.109,ay+.086,.038,.207,.118,.112,'stem',side*.31);
        round(ax+side*.124,ay+.095,.084,.186,.106,.097,'lime',side*.31,.22);
        round(ax+side*.087,ay+.119,.172,.052,.036,.014,'gleam',side*.31,.03);
      }
      const flowerX=-.54, flowerY=.993;
      for (let i=0;i<5;i++) {
        const a=2*PI*i/5+PI/2;
        round(flowerX+.094*Math.cos(a),flowerY+.094*Math.sin(a),.412,.084,.112,.048,'yellow',a-PI/2);
      }
      round(flowerX,flowerY,.449,.076,.074,.052,'honey',0,.05);
      round(flowerX-.014,flowerY+.02,.498,.041,.022,.009,'yellow',.36);

      for (const side of [-1,1]) {
        const x=side*.306;
        const closed=sleeping||laughing||dancing||purring&&!meowing||proud||activeBlink&&t>.27&&t<.39;
        const eyeY=.493+(crying?-.027:0);
        if (closed) arc(x,eyeY,.666,.126,laughing||dancing?-.076:.044,.023,'dark');
        else {
          const ey=crying?.151:startled?.22:sneaking?.117:.181;
          round(x,eyeY,.638,.146,ey,.085,'dark',side*.02,.15);
          round(x,eyeY-.044,.705,.113,ey*.68,.042,'olive',side*.02,.14);
          round(x+lookX*.042,eyeY+.003,.729,.074,.097,.029,'black',0,.20);
          round(x-.04,eyeY+.065,.755,.046,.039,.014,'gleam',.29,.04);
          round(x+.051,eyeY-.065,.745,.022,.023,.013,'gleam',0,.02);
          if (crying) stroke(x-side*.093,eyeY+.218,x+side*.081,eyeY+.154,.65,.019,'stem');
        }
        round(side*.513,.288,.616,.115,.062,.039,'cheek',side*.14,.03);
        if (crying) {
          const fall=still.matches?.19:((t+(.15*side+.15))%.70)*.43;
          round(x+side*.068,.35-fall,.736,.043,.071,.040,'tear',side*.12,.26);
          round(x+side*.057,.372-fall,.773,.013,.018,.007,'gleam');
        }
      }
      if (meow>.04) {
        round(0,.283,.681,.041+meow*.045,.021+meow*.076,.036,'mouth',0,.02);
        if (meow>.45) round(0,.239,.709,.030,.021,.015,'tongue',0,.05);
      } else if (laughing || joyful || hopping || dancing || proud) {
        round(0,.292,.675,laughing?.161:.126,laughing?.144:.109,.068,'mouth',0,.03);
        round(0,.235,.721,.092,.051,.024,'tongue',0,.10);
      } else if (sleeping || startled) round(0,.273,.689,startled?.067:.044,startled?.085:.039,.023,'mouth');
      else arc(0,.275,.698,.101,crying?-.046:.043,.016,'mouth');

      button.dataset.mochiRenderer='webgl';
      return true;
    }
    function cancel() { cancelAnimationFrame(frame); clearTimeout(idle); frame=0; idle=0; }
    function loop(now) {
      frame=0;
      if (lost || !onScreen || document.hidden || button.offsetWidth===0) return;
      if (now-last>31 || now>=end) { draw(now); last=now; }
      if (!still.matches && mood!=='sleep' && now<end) frame=requestAnimationFrame(loop);
      else if (!still.matches && mood==='curious') {
        idle=setTimeout(()=>{activeBlink=true; animate(620);}, 3100 + Math.random()*1900);
      }
    }
    function animate(duration=1400) {
      cancel();
      if (lost || document.hidden) return;
      started=performance.now();
      end=started+duration;
      frame=requestAnimationFrame(loop);
    }
    function setMood(next, length, clip=null) {
      if (!['curious','bright','laugh','sad','wave','hop','dance','sleep','yarn','climb','purr','sneak','proud','startle'].includes(next)) next='curious';
      mood=next;
      activity=clip?.track?clip:null;
      activeBlink=false;
      animate(next==='sleep'?0:length??window.MochiPlay?.duration(next)??1850);
    }
    button.addEventListener('pointermove',event=>{
      if (event.pointerType==='touch'||mood==='sleep'||still.matches) return;
      const rect=canvas.getBoundingClientRect();
      lookX=clamp((event.clientX-rect.left)/Math.max(1,rect.width)-.5,-.5,.5)*.68;
      lookY=clamp((event.clientY-rect.top)/Math.max(1,rect.height)-.5,-.5,.5)*.30;
      if (!frame) animate(250);
    });
    button.addEventListener('pointerleave',()=>{
      lookX=0; lookY=0;
      if (!frame) animate(330);
    });
    canvas.addEventListener('webglcontextlost',()=>{lost=true;cancel();delete button.dataset.mochiRenderer;});
    const redraw=()=>{if(!frame&&!lost&&onScreen&&!document.hidden) frame=requestAnimationFrame(loop);};
    document.addEventListener('visibilitychange',()=>document.hidden?cancel():redraw());
    if ('ResizeObserver' in window) new ResizeObserver(redraw).observe(canvas);
    if ('IntersectionObserver' in window) new IntersectionObserver(([entry])=>{
      if (onScreen===entry.isIntersecting) return;
      onScreen=entry.isIntersecting;
      if (onScreen) redraw();
      else cancel();
    }).observe(button);
    still.addEventListener?.('change',()=>animate(100));
    animate();
    return {setMood};
  }

  return {mount};
})();
