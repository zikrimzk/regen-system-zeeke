'use strict';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const narrowPreview = matchMedia('(max-width: 700px)');
const featuredOffer = document.querySelector('[data-offer-until]');
if (featuredOffer) {
  function refreshOffer() {
    const remaining = Number(featuredOffer.dataset.offerUntil) * 1000 - Date.now();
    if (remaining > 0) {
      setTimeout(refreshOffer, Math.min(remaining, 2147483647));
    } else {
      featuredOffer.hidden = true;
      document.querySelector('[data-offer-fallback]').hidden = false;
    }
  }
  refreshOffer();
}

for (const group of document.querySelectorAll('[data-product-tabs]')) {
  const list = group.querySelector('.product-tabs');
  const tabs = [...list.querySelectorAll('button')];
  const panels = tabs.map(tab => document.getElementById(tab.getAttribute('aria-controls')));
  let active = 0;
  let visible = false;
  let animations = [];
  let processing;

  function play() {
    animations.forEach(animation => animation.cancel());
    animations = [];
    processing?.removeAttribute('data-active');
    processing = panels[active].querySelector('.demo-processing');
    if (!visible || reducedMotion.matches) return;
    const steps = [...panels[active].querySelectorAll('[data-step]')];
    animations = steps.map((step, index) => (step.querySelector('.demo-suggestion') || step).animate(
      [{opacity: 0, transform: 'translateY(5px)'}, {opacity: 1, transform: 'translateY(0)'}],
      {duration: 226, delay: index * 340 + (processing && index > 1 ? 490 : 0), fill: 'backwards', easing: 'ease-out'}
    ));
    if (processing) {
      processing.setAttribute('data-active', '');
      const layer = processing;
      const cue = layer.animate([{opacity:0}, {opacity:1,offset:.15}, {opacity:1,offset:.86}, {opacity:0}], {duration:570,delay:600,fill:'both'});
      animations.push(cue);
      cue.onfinish = () => layer.removeAttribute('data-active');
    }
    const highlight = panels[active].querySelector('mark');
    if (highlight) animations.push(highlight.animate([{backgroundColor:'transparent'},{backgroundColor:getComputedStyle(highlight).backgroundColor}],{duration:260,delay:285,fill:'backwards'}));
  }

  function activate(next) {
    active = next;
    tabs.forEach((tab, index) => {
      const selected = index === active;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      panels[index].hidden = !selected;
    });
    play();
  }

  list.setAttribute('role', 'tablist');
  list.hidden = false;
  document.querySelectorAll('[data-hero-mochi]').forEach(link=>link.addEventListener('click', () => {
    activate(0);
    tabs[0].focus({preventScroll:true});
  }));
  tabs.forEach((tab, index) => {
    tab.setAttribute('role', 'tab');
    tab.disabled = false;
    panels[index].setAttribute('role', 'tabpanel');
    panels[index].tabIndex = 0;
    tab.addEventListener('click', () => activate(index));
    const replay = panels[index].querySelector('[data-replay]');
    if (replay) {
      const displayReplay = () => { replay.hidden = reducedMotion.matches; };
      displayReplay();
      reducedMotion.addEventListener('change', displayReplay);
      replay.addEventListener('click', play);
    }
  });
  list.addEventListener('keydown', event => {
    const current = tabs.indexOf(event.target);
    if (current < 0) return;
    const last = tabs.length - 1;
    const next = ({
      ArrowLeft: (current + last) % tabs.length,
      ArrowRight: (current + 1) % tabs.length,
      Home: 0,
      End: last,
    })[event.key];
    if (next === undefined) return;
    const focused = document.activeElement;
    event.preventDefault();
    tabs[next].focus();
    if (focused !== tabs[next]) activate(next);
  });
  activate(0);
  new IntersectionObserver(([entry]) => {
    const wasVisible = visible;
    visible = entry.isIntersecting;
    if (visible && !wasVisible) {
      if (animations.length) animations.forEach(animation => animation.play());
      else play();
    } else if (!visible) {
      animations.filter(animation => animation.playState === 'running').forEach(animation => animation.pause());
    }
  }, {threshold: .2}).observe(group);
  reducedMotion.addEventListener('change', play);
}

for (const studio of document.querySelectorAll('[data-device-preview]')) {
  const controls = studio.querySelector('.device-tabs');
  const stage = studio.querySelector('.studio-product-stage');
  const motion = getComputedStyle(stage);
  const duration = Number.parseFloat(motion.getPropertyValue('--c-device'));
  const easing = motion.getPropertyValue('--c-ease').trim();
  const buttons = [...controls.querySelectorAll('[data-device]')];
  const previews = [...stage.querySelectorAll('[data-preview]')];
  let chosen = false;
  let transition;
  function select(device, animate = false) {
    if (stage.dataset.activeDevice === device) return;
    transition?.cancel();
    stage.removeAttribute('data-switching');
    const previousHeight = stage.offsetHeight;
    stage.dataset.activeDevice = device;
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.device === device)));
    previews.forEach(preview => { preview.hidden = preview.dataset.preview !== device; });
    if (!animate || reducedMotion.matches) return;
    const nextHeight = stage.offsetHeight;
    stage.setAttribute('data-switching','');
    transition = stage.animate([{height: previousHeight+'px'}, {height: nextHeight+'px'}], {duration,easing});
    transition.onfinish = () => stage.removeAttribute('data-switching');
    previews.find(preview => !preview.hidden).animate(
      [{opacity:.66, transform:'translateY(5px)'}, {opacity:1, transform:'none'}], {duration,easing}
    );
  }
  buttons.forEach(button => button.addEventListener('click', () => {
    chosen = true;
    select(button.dataset.device,true);
  }));
  const useLayout = () => { if (!chosen) select(narrowPreview.matches ? 'mobile' : 'desktop'); };
  useLayout();
  narrowPreview.addEventListener('change', useLayout);
  controls.hidden = false;
}
