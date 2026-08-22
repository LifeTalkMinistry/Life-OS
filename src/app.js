import { Brand } from './components/Brand.js';
import { OrbArtwork } from './components/OrbArtwork.js';

const app = document.querySelector('#app');
const STORAGE_KEY = 'life-os-tracker-v1';
const INTRO_KEY = 'life-os-tracker-intro-seen';
const MIN_GAP = 15 * 60 * 1000;

const PRESETS = [
  ['Work', 'Responsibility'], ['Sleep', 'Sleep / Recovery'], ['Workout', 'Health'],
  ['Family', 'Relationships / Family'], ['Friends', 'Relationships / Family'],
  ['Devotion', 'Faith / Meaning'], ['Church', 'Faith / Meaning'],
  ['Project', 'Purpose / Projects'], ['Learning', 'Growth / Learning'],
  ['Entertainment', 'Recreation / Enjoyment']
];

const DOMAINS = [
  'Sleep / Recovery', 'Responsibility', 'Health', 'Relationships / Family',
  'Faith / Meaning', 'Growth / Learning', 'Purpose / Projects',
  'Recreation / Enjoyment', 'Other'
];

const emptyState = () => ({ sessions: [], active: null, customActivities: [], dismissedGaps: [] });
const isoNow = () => new Date().toISOString();
const uid = (p = 'item') => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function loadState() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!value) return emptyState();
    return {
      sessions: Array.isArray(value.sessions) ? value.sessions : [],
      active: value.active?.startedAt ? value.active : null,
      customActivities: Array.isArray(value.customActivities) ? value.customActivities : [],
      dismissedGaps: Array.isArray(value.dismissedGaps) ? value.dismissedGaps : []
    };
  } catch { return emptyState(); }
}

let state = loadState();
let screen = 'launch';
let overlay = null;
let analyticsPeriod = 'day';
let ticker = null;

function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {} }
function esc(v) { return String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;'); }
function ms(iso) { return new Date(iso).getTime(); }
function duration(v) {
  const minutes = Math.max(0, Math.round(v / 60000));
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}
function timer(v) {
  const total = Math.max(0, Math.floor(v / 1000));
  return [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60].map(n => String(n).padStart(2,'0')).join(':');
}
function clock(value) { return new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit'}).format(new Date(value)); }

function periodStart(period) {
  const d = new Date();
  if (period === 'day') d.setHours(0,0,0,0);
  if (period === 'week') { const x = d.getDay() === 0 ? 6 : d.getDay() - 1; d.setDate(d.getDate() - x); d.setHours(0,0,0,0); }
  if (period === 'month') { d.setDate(1); d.setHours(0,0,0,0); }
  return d.getTime();
}

function periodSessions(period) {
  const start = periodStart(period);
  const list = state.sessions.filter(s => ms(s.endedAt || s.startedAt) >= start);
  return state.active ? [...list, {...state.active, endedAt: isoNow(), live:true}] : list;
}

function summarize(period, keyFn) {
  const start = periodStart(period), map = new Map();
  periodSessions(period).forEach(s => {
    const from = Math.max(ms(s.startedAt), start);
    const span = Math.max(0, ms(s.endedAt) - from);
    const key = keyFn(s);
    map.set(key, (map.get(key) || 0) + span);
  });
  return [...map.entries()].map(([name,time]) => ({name,time})).sort((a,b) => b.time-a.time);
}

function todaySessions() {
  const start = periodStart('day');
  return state.sessions.filter(s => ms(s.endedAt || s.startedAt) >= start).sort((a,b) => ms(a.startedAt)-ms(b.startedAt));
}

function gapKey(start, end = null) { return end ? `${start}:${end}` : `open:${start}`; }
function gapsToday() {
  const sessions = todaySessions(), gaps = [];
  for (let i=1;i<sessions.length;i++) {
    const start = ms(sessions[i-1].endedAt), end = ms(sessions[i].startedAt);
    if (end-start >= MIN_GAP) {
      const key = gapKey(start,end);
      if (!state.dismissedGaps.includes(key)) gaps.push({key,start,end,time:end-start});
    }
  }
  const last = sessions.at(-1);
  if (last && !state.active) {
    const start = ms(last.endedAt), end = Date.now(), key = gapKey(start);
    if (end-start >= 30*60*1000 && !state.dismissedGaps.includes(key)) gaps.push({key,start,end,time:end-start,open:true});
  }
  return gaps;
}

function startActivity(name, domain='Other') {
  const clean = name.trim().slice(0,48); if (!clean) return;
  state.active = {id:uid('session'),name:clean,domain,startedAt:isoNow()};
  save(); overlay=null; render();
}
function stopActivity() {
  if (!state.active) return;
  const session = {...state.active,endedAt:isoNow()};
  state.sessions.push(session); state.active=null; save(); overlay={type:'complete',session}; render();
}
function addCustom(name) {
  const clean = name.trim().slice(0,48); if (!clean) return;
  let item = state.customActivities.find(x => x.name.toLowerCase() === clean.toLowerCase());
  if (!item) { item={id:uid('activity'),name:clean,domain:'Other'}; state.customActivities.push(item); save(); }
  startActivity(item.name,item.domain);
}
function classifyGap(gap, name, domain, leaveUnknown=false) {
  state.dismissedGaps.push(gap.open ? gapKey(gap.start) : gap.key);
  if (!leaveUnknown) state.sessions.push({id:uid('gap'),name,domain,startedAt:new Date(gap.start).toISOString(),endedAt:new Date(gap.end).toISOString(),retroactive:true});
  save(); render();
}

function Launch() { const n=document.createElement('section'); n.className='screen launch-screen'; return n; }
function Intro() {
  const n=document.createElement('div'); n.className='tracker-intro';
  n.innerHTML=`<div class="tracker-intro-card"><div class="tracker-intro-mark"></div><h1>See where your life is going.</h1><p>Track what you do. LIFE OS turns your actual time into a clear picture of how your life is being distributed.</p><button class="tracker-enter">ENTER LIFE OS</button></div>`;
  n.querySelector('button').onclick=()=>{try{localStorage.setItem(INTRO_KEY,'1')}catch{} overlay=null;render()}; return n;
}
function OrbView() {
  const shell=document.createElement('div'); shell.className='tracker-orb-shell'; shell.appendChild(OrbArtwork());
  const b=document.createElement('button'); b.className='tracker-orb'; b.type='button';
  if(state.active){b.innerHTML=`<div class="tracker-orb-content"><p class="tracker-kicker">RUNNING NOW</p><h1 class="tracker-title">${esc(state.active.name)}</h1><p class="tracker-timer" data-live-timer>${timer(Date.now()-ms(state.active.startedAt))}</p><p class="tracker-sub">Tap when you finish.</p></div>`; b.onclick=stopActivity}
  else{b.innerHTML=`<div class="tracker-orb-content"><p class="tracker-kicker">LIFE OS</p><h1 class="tracker-title">What are you doing?</h1><p class="tracker-sub">Tap to start tracking.</p></div>`; b.onclick=()=>{overlay={type:'choose'};render()}}
  shell.appendChild(b); return shell;
}
function Main() {
  const n=document.createElement('section'); n.className='tracker-screen'; n.appendChild(Brand());
  const stage=document.createElement('div'); stage.className='tracker-stage'; stage.appendChild(OrbView()); n.appendChild(stage);
  const gaps=gapsToday(); const bottom=document.createElement('div'); bottom.className='tracker-bottom';
  bottom.innerHTML=`<button class="tracker-pill" data-a="analytics">HOLISTIC LIFE</button>${gaps.length?`<button class="tracker-pill" data-a="gaps">${gaps.length} UNTRACKED</button>`:''}`;
  bottom.querySelector('[data-a="analytics"]').onclick=()=>{overlay={type:'analytics'};render()};
  bottom.querySelector('[data-a="gaps"]')?.addEventListener('click',()=>{overlay={type:'gaps'};render()}); n.appendChild(bottom); return n;
}
function Sheet(title,sub='') {
  const n=document.createElement('div'); n.className='tracker-overlay';
  n.innerHTML=`<section class="tracker-sheet" role="dialog" aria-modal="true"><header class="tracker-sheet-header"><div><h2>${esc(title)}</h2>${sub?`<p>${esc(sub)}</p>`:''}</div><button class="tracker-close" aria-label="Close">×</button></header><div data-body></div></section>`;
  n.querySelector('.tracker-close').onclick=()=>{overlay=null;render()}; n.onclick=e=>{if(e.target===n){overlay=null;render()}}; return n;
}
function Choose() {
  const n=Sheet('Start an activity','What are you doing right now?'), body=n.querySelector('[data-body]'), list=document.createElement('div'); list.className='tracker-choices';
  [...PRESETS.map(([name,domain])=>({name,domain})),...state.customActivities].forEach(item=>{const b=document.createElement('button');b.className='tracker-choice';b.innerHTML=`<strong>${esc(item.name)}</strong><span>${esc(item.domain)}</span>`;b.onclick=()=>startActivity(item.name,item.domain);list.appendChild(b)});
  const c=document.createElement('div'); c.className='tracker-custom'; c.innerHTML=`<input class="tracker-input" maxlength="48" placeholder="Something else…"><button class="tracker-add">Start</button>`; c.querySelector('button').onclick=()=>addCustom(c.querySelector('input').value); c.querySelector('input').onkeydown=e=>{if(e.key==='Enter')addCustom(e.currentTarget.value)}; list.appendChild(c); body.appendChild(list); return n;
}
function Complete(session) {
  const n=Sheet('Activity recorded',`${session.name} · ${duration(ms(session.endedAt)-ms(session.startedAt))}`);
  n.querySelector('[data-body]').innerHTML=`<div class="metric-hero"><p class="metric-eyebrow">ACTUAL TIME</p><h3>${esc(clock(session.startedAt))} — ${esc(clock(session.endedAt))}</h3><p>LIFE OS is building your real activity history. The more you track, the clearer your Holistic Life picture becomes.</p></div>`; return n;
}
function Analytics() {
  const n=Sheet('Holistic Life','See how your actual time is being distributed. Balance does not mean equal time.'), body=n.querySelector('[data-body]');
  const domains=summarize(analyticsPeriod,s=>DOMAINS.includes(s.domain)?s.domain:'Other'); const acts=summarize(analyticsPeriod,s=>s.name||'Other'); const total=domains.reduce((x,y)=>x+y.time,0);
  body.innerHTML=`<div class="analytics-tabs">${['day','week','month'].map(p=>`<button class="analytics-tab ${analyticsPeriod===p?'is-active':''}" data-p="${p}">${p==='day'?'TODAY':p.toUpperCase()}</button>`).join('')}</div><div class="metric-hero"><p class="metric-eyebrow">HOLISTIC LIFE METRIC</p>${total?`<h3>${esc(domains[0].name)} currently receives the most tracked time.</h3><p>${duration(total)} tracked in this period. LIFE OS looks for chronic imbalance, not mathematical equality.</p>`:`<h3>Your picture is still forming.</h3><p>Start tracking activities and LIFE OS will show where your time is actually going.</p>`}</div>`;
  body.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>{analyticsPeriod=b.dataset.p;render()});
  if(domains.length){const list=document.createElement('div');list.className='metric-list';domains.forEach(x=>{const pct=Math.max(3,Math.round(x.time/total*100));const r=document.createElement('div');r.className='metric-row';r.innerHTML=`<span class="metric-name">${esc(x.name)}</span><span class="metric-time">${duration(x.time)}</span><span class="metric-bar"><i style="width:${pct}%"></i></span>`;list.appendChild(r)});body.appendChild(list)}
  if(acts.length){const d=document.createElement('div');d.className='untracked-note';d.innerHTML=`<strong>Most time:</strong> ${esc(acts[0].name)} — ${duration(acts[0].time)}.`;body.appendChild(d)}
  const gaps=gapsToday(); if(analyticsPeriod==='day'&&gaps.length){const d=document.createElement('div');d.className='untracked-note';d.innerHTML=`<strong>${duration(gaps.reduce((s,g)=>s+g.time,0))} is untracked today.</strong> Untracked time is unknown, not automatically wasted. Tap to review.`;d.onclick=()=>{overlay={type:'gaps'};render()};body.appendChild(d)} return n;
}
function Gaps() {
  const n=Sheet('Untracked time','LIFE OS noticed gaps in today. What were you doing?'), body=n.querySelector('[data-body]'), gaps=gapsToday();
  if(!gaps.length){body.innerHTML='<div class="metric-hero"><h3>Nothing to review.</h3><p>Your detected gaps are already classified.</p></div>';return n}
  gaps.forEach(g=>{const c=document.createElement('div');c.className='gap-card';c.innerHTML=`<strong>${clock(g.start)} — ${clock(g.end)} · ${duration(g.time)}</strong><p>Did you do something, watch something, talk to someone, rest, or leave this unknown?</p><div class="gap-actions"></div>`;const a=c.querySelector('.gap-actions');[['Rest / Sleep','Sleep / Recovery'],['Friends / Social','Relationships / Family'],['Entertainment','Recreation / Enjoyment'],['Travel / Errand','Responsibility'],['Other activity','Other']].forEach(([name,domain])=>{const b=document.createElement('button');b.textContent=name;b.onclick=()=>classifyGap(g,name,domain,false);a.appendChild(b)});const u=document.createElement('button');u.textContent='Leave untracked';u.onclick=()=>classifyGap(g,'Untracked','Other',true);a.appendChild(u);body.appendChild(c)}); return n;
}
function Overlay() { if(!overlay)return null; if(overlay.type==='intro')return Intro(); if(overlay.type==='choose')return Choose(); if(overlay.type==='complete')return Complete(overlay.session); if(overlay.type==='analytics')return Analytics(); if(overlay.type==='gaps')return Gaps(); return null; }

function render() {
  clearInterval(ticker);
  if(screen==='launch'){app.replaceChildren(Launch());return}
  const main=Main(), layer=Overlay(); layer ? app.replaceChildren(main,layer) : app.replaceChildren(main);
  if(state.active) ticker=setInterval(()=>{const el=document.querySelector('[data-live-timer]');if(el&&state.active)el.textContent=timer(Date.now()-ms(state.active.startedAt))},1000);
}

document.addEventListener('keydown',e=>{if(e.key==='Escape'&&overlay){overlay=null;render()}});
render();
setTimeout(()=>{screen='tracker';let seen=false;try{seen=localStorage.getItem(INTRO_KEY)==='1'}catch{}if(!seen)overlay={type:'intro'};render()},1100);

window.__LIFE_OS__={getState:()=>({...state,screen,overlay,analyticsPeriod}),startActivity,stopActivity,openAnalytics:()=>{overlay={type:'analytics'};render()},resetTracker:()=>{try{localStorage.removeItem(STORAGE_KEY);localStorage.removeItem(INTRO_KEY)}catch{}state=emptyState();screen='tracker';overlay={type:'intro'};render()}};
