/* One managed connection or short delta request per visible account/browser. */
window.ReGenLive = (() => {
  let identity = null;
  let channel = null;
  let push = null;
  let lockAbort = null;
  let release = null;
  let timer = null;
  let timerDue = 0;
  let maintenanceTimer = null;
  let authTimer = null;
  let authorizationQueue = [];
  let sdkPromise = null;
  let stopped = true;
  let leader = false;
  let pushConnected = false;
  let healthy = false;
  let inFlight = null;
  let pending = false;
  let lifecycle = 0;
  let cursor = 0;
  let quiet = 0;
  let errors = 0;
  let lastCheck = 0;
  let currentState = 'connecting';
  const controllers = new Set();
  const seen = new Set();
  const listeners = new Set();
  const dispatch = (name, detail) => window.dispatchEvent(new CustomEvent(name, {detail}));
  const active = () => !stopped && !document.hidden && leader;

  function status(state) {
    healthy = state === 'live' || state === 'polling';
    if (state === currentState) return;
    currentState = state;
    dispatch('regen:live-status', {state});
  }

  function maintenance(value) {
    if (!value) return;
    dispatch('regen:maintenance', value);
    if (identity?.role === 'user' && value.active && !document.body.classList.contains('maintenance-page')) {
      location.replace('/maintenance?returnTo=' + encodeURIComponent(location.pathname + location.search));
    }
    clearTimeout(maintenanceTimer);
    if (!active()) return;
    const now = Date.parse(value.serverNow);
    const dates = [value.startsAt, value.endsAt].filter(Boolean).map(text => Date.parse(text.replace(' ', 'T') + 'Z')).filter(date => date > now);
    if (dates.length) maintenanceTimer = setTimeout(() => queueCheck(0), Math.min(2147483647, Math.max(250, Math.min(...dates) - now + 100)));
  }

  function receive(message, broadcast = false) {
    if (stopped || document.hidden) return;
    if (broadcast) channel?.postMessage(message);
    if (message.kind === 'state') { status(message.state); return; }
    if (message.kind !== 'batch') return;
    const batch = message.data;
    if (Array.isArray(batch.topics) && JSON.stringify(batch.topics) !== JSON.stringify(identity.topics)) {
      identity.topics = batch.topics;
      if (identity.role === 'admin' && identity.managed && push) {
        const names = ['private-regen-admin-account-' + identity.id, ...batch.topics.map(topic => 'private-regen-admin-' + topic)];
        for (const name of identity.managed.channels) if (!names.includes(name)) push.unsubscribe(name);
        for (const name of names) if (!identity.managed.channels.includes(name)) subscribe(name);
        identity.managed.channels = names;
      }
      dispatch('regen:reconcile', {});
    }
    maintenance(batch.maintenance);
    if (batch.reset) dispatch('regen:reconcile', {});
    for (const event of batch.events || []) {
      if (!identity?.topics.includes(event.topic) || seen.has(event.id)) continue;
      seen.add(event.id);
      if (seen.size > 1000) seen.delete(seen.values().next().value);
      dispatch('regen:live-change', event);
      for (const listener of listeners) if (listener.topics.includes(event.topic)) listener.callback(event);
    }
    cursor = Math.max(cursor, Number(batch.cursor) || 0);
  }

  async function json(url, options = {}) {
    const controller = new AbortController();
    controllers.add(controller);
    const timeout = setTimeout(() => controller.abort(), 6000);
    try {
      const response = await fetch(url, {credentials:'same-origin', cache:'no-store', ...options, signal:controller.signal,
        headers:{Accept:'application/json', ...(options.body ? {'Content-Type':'application/json', 'X-CSRF-Token':identity?.csrfToken || ''} : {})}});
      if (!response.ok) {
        const error = new Error('Update request failed');
        error.status = response.status;
        error.retryAfter = Math.max(0, Number(response.headers?.get('Retry-After')) || 0);
        throw error;
      }
      return await response.json();
    } finally {
      clearTimeout(timeout);
      controllers.delete(controller);
    }
  }

  function queueCheck(delay) {
    if (!active()) return;
    const due = Date.now() + Math.max(delay, 750 - (Date.now() - lastCheck), 0);
    if (timer && timerDue <= due) return;
    clearTimeout(timer);
    timerDue = due;
    timer = setTimeout(() => { timer = null; check(); }, Math.max(0, due - Date.now()));
  }

  async function check() {
    if (!active()) return;
    if (inFlight) { pending = true; return; }
    const requestToken = {};
    inFlight = requestToken;
    const generation = lifecycle;
    lastCheck = Date.now();
    let delay = pushConnected ? 30000 : 4000;
    try {
      const batch = await json('/api/realtime/changes?since=' + cursor);
      if (!active() || generation !== lifecycle) return;
      receive({kind:'batch', data:batch}, true);
      errors = 0;
      quiet = batch.events?.length ? 0 : quiet + 1;
      const waitingForUpdates=['support','notifications'].includes(document.body.dataset?.servicePage);
      delay = pushConnected ? 30000 : Math.min(waitingForUpdates?6000:15000, 4000 + quiet * 1500);
      receive({kind:'state', state:pushConnected ? 'live' : 'polling'}, true);
    } catch (error) {
      if (!active() || generation !== lifecycle) return;
      if (error.status === 401 && !document.body.classList.contains('maintenance-page')) {
        const role = identity.role;
        stop();
        if (role === 'user' && document.body.classList.contains('studio-workbench')) {
          dispatch('regen:session-expired', {});
        } else location.replace(role === 'admin' ? '/admin/login' : '/login');
        return;
      }
      delay = Math.max(error.retryAfter * 1000, Math.min(60000, 5000 * 2 ** Math.min(4, ++errors)));
      receive({kind:'state', state:navigator.onLine === false ? 'offline' : 'delayed'}, true);
    } finally {
      if (inFlight === requestToken) inFlight = null;
      if (active() && generation === lifecycle) {
        const next = pending ? 750 : delay;
        pending = false;
        queueCheck(next);
      }
    }
  }

  function loadSdk() {
    if (window.Pusher) return Promise.resolve();
    if (sdkPromise) return sdkPromise;
    sdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = identity.managed.script;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => { sdkPromise = null; script.remove(); reject(new Error('Managed updates unavailable')); };
      document.head.append(script);
    });
    return sdkPromise;
  }

  function authorize(params, callback) {
    authorizationQueue.push({params, callback});
    if (authTimer) return;
    const generation = lifecycle;
    authTimer = setTimeout(async () => {
      authTimer = null;
      const requests = authorizationQueue.splice(0);
      try {
        const data = await json('/api/realtime/authorize', {method:'POST', body:JSON.stringify({socket_id:requests[0].params.socketId, channels:requests.map(item => item.params.channelName)})});
        if (!active() || generation !== lifecycle) return;
        for (const item of requests) item.callback(null, data.authorizations[item.params.channelName]);
      } catch (error) {
        if (active() && generation === lifecycle) for (const item of requests) item.callback(error, null);
      }
    }, 40);
  }

  async function connectManaged() {
    const generation = lifecycle;
    try {
      await loadSdk();
      if (!active() || generation !== lifecycle) return;
      push = new window.Pusher(identity.managed.key, {cluster:identity.managed.cluster, forceTLS:true,
        enabledTransports:['ws'], enableStats:false, channelAuthorization:{customHandler:authorize}});
      push.connection.bind('state_change', states => {
        if (!active() || generation !== lifecycle) return;
        pushConnected = states.current === 'connected';
        // Ordinary requests continue through the fallback while the provider reconnects.
        if (pushConnected) queueCheck(0);
        else { if (healthy) receive({kind:'state', state:'polling'}, true); queueCheck(0); }
      });
      for (const name of identity.managed.channels) subscribe(name);
    } catch { /* Adaptive delta checks remain available if the SDK cannot load. */ }
  }

  function subscribe(name) {
    const subscription = push.subscribe(name);
    subscription.bind('wake', () => queueCheck(150));
    subscription.bind('pusher:subscription_succeeded', () => queueCheck(0));
    subscription.bind('pusher:subscription_error', () => { pushConnected = false; queueCheck(0); });
  }

  function lead() {
    if (stopped || document.hidden) return;
    const begin = () => { leader = true; queueCheck(0); if (identity.transport === 'pusher' && identity.managed) connectManaged(); };
    if (navigator.locks && channel) {
      lockAbort = new AbortController();
      navigator.locks.request('regen-live:' + identity.role + ':' + identity.id, {signal:lockAbort.signal}, async () => {
        if (stopped || document.hidden) return;
        begin();
        await new Promise(resolve => { release = resolve; });
        release = null;
      }).catch(() => {});
      channel.postMessage({kind:'hello'});
    } else begin();
  }

  function pause() {
    lifecycle++;
    leader = false;
    inFlight = null; pending = false;
    clearTimeout(timer); timer = null;
    clearTimeout(maintenanceTimer); clearTimeout(authTimer); authTimer = null;
    authorizationQueue = [];
    for (const controller of controllers) controller.abort();
    push?.disconnect(); push = null; pushConnected = false;
    lockAbort?.abort(); lockAbort = null;
    release?.(); release = null;
    status('paused');
  }

  async function start() {
    if (!stopped) return;
    clearTimeout(timer); timer = null;
    stopped = false;
    const generation = ++lifecycle;
    try {
      const next = await json('/api/realtime/session');
      if (stopped || generation !== lifecycle) return;
      identity = next; cursor = next.cursor;
      maintenance(next.maintenance);
      if ('BroadcastChannel' in window) {
        channel = new BroadcastChannel('regen-live:' + identity.role + ':' + identity.id);
        channel.onmessage = event => {
          if (event.data.kind === 'hello') { if (leader) channel.postMessage({kind:'state', state:currentState}); return; }
          receive(event.data);
        };
      }
      if (!document.hidden) lead();
    } catch {
      if (stopped || generation !== lifecycle) return;
      status('delayed');
      timer = setTimeout(() => { stopped = true; start(); }, 15000);
    }
  }

  function stop() { stopped = true; pause(); channel?.close(); channel = null; identity = null; seen.clear(); }
  function resume() {
    if (stopped) return;
    if (identity) { if (!leader) lead(); else queueCheck(0); }
    else { stopped = true; start(); }
  }
  document.addEventListener('visibilitychange', () => document.hidden ? pause() : resume());
  window.addEventListener('online', resume);
  window.addEventListener('regen:session-restored', start);
  window.addEventListener('offline', () => { pause(); status('offline'); });
  window.addEventListener('focus', () => { if (active()) queueCheck(0); });
  let lastActivity = 0;
  const activity = event => { if (event.isTrusted && active() && !pushConnected && Date.now() - lastActivity > 4000) { lastActivity = Date.now(); quiet = 0; queueCheck(1000); } };
  document.addEventListener('pointerdown', activity, {passive:true});
  document.addEventListener('keydown', activity);
  window.addEventListener('pagehide', stop);
  window.addEventListener('pageshow', event => { if (event.persisted) start(); });
  document.addEventListener('DOMContentLoaded', () => {
    if (document.body.matches('.admin-page,.maintenance-page,.user-workspace:not(.auth-page)')) start();
  });
  return {start, stop, get connected() { return healthy; }, get isLeader() { return leader; },
    get state() { return currentState; },
    subscribe(topics, callback) { const item = {topics, callback}; listeners.add(item); return () => listeners.delete(item); }};
})();
