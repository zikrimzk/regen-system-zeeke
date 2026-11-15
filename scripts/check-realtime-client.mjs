import vm from 'node:vm';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const code = await fs.readFile(new URL('../public/js/realtime.js', import.meta.url), 'utf8');
let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks++; };
class DetailEvent extends Event { constructor(name, options = {}) { super(name); this.detail = options.detail; } }
const settle = async () => { await new Promise(resolve => setImmediate(resolve)); };

function harness(managed = false) {
  let now = 1000000, sequence = 0, pending = 0, peak = 0, gate = null;
  const timers = new Map(), calls = [], replies = [], states = [], events = [], redirects = [];
  const window = new EventTarget(), document = new EventTarget();
  document.hidden = false;
  document.body = {matches:() => true, classList:{contains:() => false}};
  const identity = {success:true, role:'user', id:7, topics:['notifications','support'], transport:managed ? 'pusher' : 'poll', cursor:10, csrfToken:'fixture', maintenance:{active:false},
    managed:managed ? {key:'public-key', cluster:'ap1', channels:['private-regen-users','private-regen-user-account-7']} : null};
  class Provider {
    static instances = [];
    constructor(key, options) { this.key=key; this.options=options; this.subscriptions=new Map(); this.handlers=new Map(); this.connection={bind:(name, callback) => this.handlers.set(name, callback)}; Provider.instances.push(this); }
    subscribe(name) { const subscription={handlers:new Map(), bind(event, callback) { this.handlers.set(event, callback); }}; this.subscriptions.set(name, subscription); return subscription; }
    unsubscribe(name) { this.subscriptions.delete(name); }
    disconnect() { this.closed=true; }
    state(current) { this.handlers.get('state_change')?.({current}); }
    wake() { for(const subscription of this.subscriptions.values()) subscription.handlers.get('wake')?.({topic:'security', id:999}); }
  }
  window.Pusher=Provider;
  const fetch = async (url, options) => {
    calls.push({url, options});
    if(url.includes('/session')) return {ok:true, json:async () => structuredClone(identity)};
    if(url.includes('/authorize')) return {ok:true, json:async () => ({authorizations:Object.fromEntries(JSON.parse(options.body).channels.map(name => [name, {auth:'fixture-signature'}]))})};
    pending++; peak=Math.max(peak,pending);
    try {
      if(gate) await Promise.race([gate.promise, new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(new Error('aborted')), {once:true}))]);
      const reply=replies.shift();
      if(reply instanceof Error) throw reply;
      if(reply?.status) return {ok:false,status:reply.status,headers:{get:() => reply.retryAfter || ''}};
      return {ok:true,json:async () => reply || {events:[],cursor:10,topics:identity.topics,maintenance:{active:false}}};
    } finally { pending--; }
  };
  class Clock extends Date { static now() { return now; } }
  const context=vm.createContext({window,document,navigator:{onLine:true},location:{pathname:'/dashboard',search:'',replace:path => redirects.push(path)},
    EventSource:class { constructor() { throw new Error('A PHP-held stream must never be opened'); } },CustomEvent:DetailEvent,fetch,console,AbortController,Date:Clock,JSON,Set,Promise,
    setTimeout:(callback,delay) => { const id=++sequence;timers.set(id,{callback,due:now+delay,delay});return id; },clearTimeout:id => timers.delete(id)});
  vm.runInContext(code,context);
  window.addEventListener('regen:live-change', event => events.push(event.detail));
  window.addEventListener('regen:live-status', event => states.push(event.detail.state));
  const tick=async milliseconds => {
    const target=now+milliseconds;
    let iterations=0;
    while(true) {
      await settle();
      const next=[...timers].filter(([,task]) => task.due<=target).sort((a,b) => a[1].due-b[1].due)[0];
      if(!next) break;
      assert.ok(++iterations<100,'Timer loop must remain bounded');
      now=next[1].due;timers.delete(next[0]);next[1].callback();
    }
    now=target;await settle();
  };
  return {window,document,identity,calls,replies,events,states,redirects,timers,Provider,tick,
    get peak() { return peak; }, delta:() => calls.filter(call => call.url.includes('/changes')),
    hold() { let resolve;gate={promise:new Promise(done => { resolve=done; })};return () => { gate=null;resolve(); }; }};
}

const app=harness();let reconciles=0;app.window.addEventListener('regen:reconcile',()=>reconciles++);
await app.window.ReGenLive.start();await app.tick(0);
check(app.window.ReGenLive.state==='polling'&&app.window.ReGenLive.connected,'Unconfigured push uses healthy automatic checks, without reconnect warnings.');
check(app.delta().length===1&&reconciles===0,'Starting must not refetch every management view.');
let subscribed=0;const unsubscribe=app.window.ReGenLive.subscribe(['support'],()=>subscribed++);
app.replies.push({events:[{id:11,topic:'notifications'},{id:11,topic:'notifications'},{id:12,topic:'security'},{id:13,topic:'support'}],cursor:15});
app.window.dispatchEvent(new Event('focus'));await app.tick(750);
check(app.events.length===2,'Duplicate and unauthorized-topic events must be ignored.');
check(subscribed===1,'A relevant event reaches its subscription once.');unsubscribe();
app.replies.push({events:[{id:16,topic:'support'}],cursor:17});app.window.dispatchEvent(new Event('focus'));await app.tick(750);
check(subscribed===1,'Unsubscribed handlers must not be called.');
const release=app.hold();app.window.dispatchEvent(new Event('focus'));await app.tick(750);
app.window.dispatchEvent(new Event('focus'));await app.tick(750);
check(app.peak===1,'Only one delta request may be in flight.');
app.document.hidden=true;app.document.dispatchEvent(new Event('visibilitychange'));await settle();
check(app.timers.size===0&&!app.window.ReGenLive.connected,'Hidden tabs abort requests and release all update timers.');release();
const previous=app.delta().length;await app.tick(20000);check(app.delta().length===previous,'Hidden tabs must not poll.');
app.document.hidden=false;app.document.dispatchEvent(new Event('visibilitychange'));await app.tick(0);
check(app.delta().at(-1).url.endsWith('since=17'),'Returning tabs recover from the last authorized cursor.');
app.replies.push({status:503});app.window.dispatchEvent(new Event('focus'));await app.tick(750);
check(app.window.ReGenLive.state==='delayed','Failed checks use a stable delayed state.');
const failedCount=app.delta().length;await app.tick(9000);check(app.delta().length===failedCount,'Failures back off instead of creating reconnect storms.');await app.tick(1500);
check(app.window.ReGenLive.connected,'Healthy checks restore automatic updates.');
app.window.ReGenLive.stop();check(app.timers.size===0,'Stopping releases timers and requests.');

const managed=harness(true);await managed.window.ReGenLive.start();await managed.tick(0);
const provider=managed.Provider.instances[0];check(!!provider,'Configured delivery opens the managed SDK connection.');
check(provider.options.forceTLS&&provider.options.enabledTransports[0]==='ws','Managed connections require TLS and do not use PHP streaming fallbacks.');
provider.state('connected');await managed.tick(750);check(managed.window.ReGenLive.state==='live','A healthy managed connection is shown as live.');
managed.replies.push({events:[{id:20,topic:'support'}],cursor:20});const before=managed.delta().length;
for(let index=0;index<25;index++)provider.wake();await managed.tick(750);
check(managed.delta().length===before+1,'Burst wakeups coalesce into one authorized delta read.');
check(managed.events.length===1&&managed.events[0].topic==='support','Provider payloads cannot bypass server event authorization.');
let authorized=0;
provider.options.channelAuthorization.customHandler({socketId:'123.456',channelName:'private-regen-users'},(error,data)=>{if(!error&&data.auth)authorized++;});
provider.options.channelAuthorization.customHandler({socketId:'123.456',channelName:'private-regen-user-account-7'},(error,data)=>{if(!error&&data.auth)authorized++;});
await managed.tick(40);check(managed.calls.filter(call=>call.url.includes('/authorize')).length===1&&authorized===2,'Private subscriptions share one CSRF-protected authorization batch.');
provider.state('unavailable');await managed.tick(750);check(managed.window.ReGenLive.state==='polling','Provider failure immediately continues with nonblocking checks.');
managed.window.ReGenLive.stop();check(provider.closed&&managed.timers.size===0,'Stopping disconnects the provider and releases timers.');
const maintenanceCode = await fs.readFile(new URL('../public/js/maintenance.js', import.meta.url), 'utf8');
async function maintenanceReturn(pathname, hash, returnTo) {
  const redirects = [];
  const element = {};
  const document = new EventTarget();
  document.body = {dataset:{returnTo}};
  document.hidden = true;
  document.getElementById = document.querySelector = () => element;
  vm.runInNewContext(maintenanceCode, {
    document, window:new EventTarget(), clearTimeout() {},
    location:{pathname, hash, replace:url=>redirects.push(url)},
    fetch:async () => ({ok:true, json:async () => ({maintenance:{active:false}})}),
  });
  document.dispatchEvent(new Event('DOMContentLoaded'));
  await settle();
  return redirects[0];
}
const token = '#token=' + 'x'.repeat(43);
check(await maintenanceReturn('/verify-email.html', token, '/verify-email') === '/verify-email' + token, 'A legacy verification token must survive maintenance.');
check(await maintenanceReturn('/reset-password', token, '/reset-password') === '/reset-password' + token, 'A password reset token must survive maintenance.');
check(await maintenanceReturn('/maintenance', token, '/verify-email') === '/verify-email', 'A token fragment must stay on its original verification page.');
console.log(`Managed delivery, short checks, cancellation, backoff, authorization batching and replay passed (${checks} assertions; mocked transport).`);
