import { Brand } from './components/Brand.js';
import { OrbArtwork } from './components/OrbArtwork.js';

const app = document.querySelector('#app');
const STORAGE_KEY = 'life-os-tracker-v1';
const INTRO_KEY = 'life-os-tracker-intro-seen';
const MIN_GAP = 15 * 60 * 1000;

const PRESETS = [
  ['Work','Responsibility','💼'],['Sleep','Sleep / Recovery','🌙'],['Workout','Health','🏋️'],
  ['Family','Relationships / Family','🏠'],['Friends','Relationships / Family','🫂'],
  ['Devotion','Faith / Meaning','🙏'],['Church','Faith / Meaning','⛪'],
  ['Project','Purpose / Projects','◈'],['Learning','Growth / Learning','✦'],
  ['Entertainment','Recreation / Enjoyment','◉']
];
const DOMAINS = ['Sleep / Recovery','Responsibility','Health','Relationships / Family','Faith / Meaning','Growth / Learning','Purpose / Projects','Recreation / Enjoyment','Other'];
const emptyState = () => ({sessions:[],active:null,customActivities:[],dismissedGaps:[]});
const isoNow = () => new Date().toISOString();
const uid = (p='item') => `${p}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;

function loadState(){
  try{
    const value=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
    if(!value)return emptyState();
    return {
      sessions:Array.isArray(value.sessions)?value.sessions:[],
      active:value.active?.startedAt?value.active:null,
      customActivities:Array.isArray(value.customActivities)?value.customActivities:[],
      dismissedGaps:Array.isArray(value.dismissedGaps)?value.dismissedGaps:[]
    };
  }catch{return emptyState()}
}

let state=loadState();
let screen='launch';
let orbMode='idle';
let analyticsPeriod='day';
let ticker=null;
let modal=null;

function save(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}catch{}}
function esc(v){return String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;')}
function ms(v){return new Date(v).getTime()}
function duration(v){const mins=Math.max(0,Math.round(v/60000)),h=Math.floor(mins/60),m=mins%60;return h?(m?`${h}h ${m}m`:`${h}h`):`${m}m`}
function timer(v){const t=Math.max(0,Math.floor(v/1000));return [Math.floor(t/3600),Math.floor((t%3600)/60),t%60].map(n=>String(n).padStart(2,'0')).join(':')}
function clock(v){return new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit'}).format(new Date(v))}
function iconFor(name){const preset=PRESETS.find(x=>x[0].toLowerCase()===String(name).toLowerCase());return preset?.[2]||state.customActivities.find(x=>x.name.toLowerCase()===String(name).toLowerCase())?.icon||'✦'}

function periodStart(period){const d=new Date();if(period==='day')d.setHours(0,0,0,0);if(period==='week'){const x=d.getDay()===0?6:d.getDay()-1;d.setDate(d.getDate()-x);d.setHours(0,0,0,0)}if(period==='month'){d.setDate(1);d.setHours(0,0,0,0)}return d.getTime()}
function periodSessions(period){const start=periodStart(period);const list=state.sessions.filter(s=>ms(s.endedAt||s.startedAt)>=start);return state.active?[...list,{...state.active,endedAt:isoNow(),live:true}]:list}
function summarize(period,keyFn){const start=periodStart(period),map=new Map();periodSessions(period).forEach(s=>{const from=Math.max(ms(s.startedAt),start),span=Math.max(0,ms(s.endedAt)-from),key=keyFn(s);map.set(key,(map.get(key)||0)+span)});return [...map.entries()].map(([name,time])=>({name,time})).sort((a,b)=>b.time-a.time)}
function todaySessions(){const start=periodStart('day');return state.sessions.filter(s=>ms(s.endedAt||s.startedAt)>=start).sort((a,b)=>ms(a.startedAt)-ms(b.startedAt))}
function gapKey(start,end=null){return end?`${start}:${end}`:`open:${start}`}
function gapsToday(){
  const sessions=todaySessions(),gaps=[];
  for(let i=1;i<sessions.length;i++){
    const start=ms(sessions[i-1].endedAt),end=ms(sessions[i].startedAt);
    if(end-start>=MIN_GAP){const key=gapKey(start,end);if(!state.dismissedGaps.includes(key))gaps.push({key,start,end,time:end-start})}
  }
  const last=sessions.at(-1);
  if(last&&!state.active){const start=ms(last.endedAt),end=Date.now(),key=gapKey(start);if(end-start>=30*60*1000&&!state.dismissedGaps.includes(key))gaps.push({key,start,end,time:end-start,open:true})}
  return gaps;
}

function startActivity(name,domain='Other',opts={}){
  const clean=String(name).trim().slice(0,48);if(!clean)return;
  state.active={id:uid('session'),name:clean,domain,icon:opts.icon||iconFor(clean),startedAt:isoNow(),suggestSave:!!opts.suggestSave};
  save();modal=null;orbMode='running';render();
}
function stopActivity(){
  if(!state.active)return;
  const session={...state.active,endedAt:isoNow()};
  state.sessions.push(session);state.active=null;save();orbMode='complete';modal={type:'complete',session};render();
}
function saveActivityFromSession(session){
  if(state.customActivities.some(x=>x.name.toLowerCase()===session.name.toLowerCase()))return;
  state.customActivities.push({id:uid('activity'),name:session.name,domain:session.domain||'Other',icon:session.icon||'✦'});save();
}
function classifyGap(gap,name,domain,leaveUnknown=false){state.dismissedGaps.push(gap.open?gapKey(gap.start):gap.key);if(!leaveUnknown)state.sessions.push({id:uid('gap'),name,domain,icon:iconFor(name),startedAt:new Date(gap.start).toISOString(),endedAt:new Date(gap.end).toISOString(),retroactive:true});save();render()}

function Launch(){const n=document.createElement('section');n.className='screen launch-screen';return n}
function Intro(){const n=document.createElement('div');n.className='tracker-intro';n.innerHTML=`<div class="tracker-intro-card"><div class="tracker-intro-mark"></div><h1>See where your life is going.</h1><p>Track what you do. LIFE OS quietly turns your actual time into a clearer picture of your life.</p><button class="tracker-enter">ENTER LIFE OS</button></div>`;n.querySelector('button').onclick=()=>{try{localStorage.setItem(INTRO_KEY,'1')}catch{}modal=null;render()};return n}

function OrbContent(){
  if(state.active)return `<div class="tracker-orb-content"><p class="tracker-kicker">RUNNING NOW</p><div class="tracker-activity-icon">${esc(state.active.icon||'✦')}</div><h1 class="tracker-title tracker-title-activity">${esc(state.active.name)}</h1><p class="tracker-timer" data-live-timer>${timer(Date.now()-ms(state.active.startedAt))}</p><p class="tracker-sub">Tap when you finish.</p></div>`;
  if(orbMode==='choose')return `<div class="tracker-orb-content tracker-orb-menu"><p class="tracker-kicker">START ACTIVITY</p><h1 class="tracker-title tracker-title-small">What are you doing?</h1><div class="orb-mini-list" data-orb-list></div></div>`;
  return `<div class="tracker-orb-content"><p class="tracker-kicker">LIFE OS</p><h1 class="tracker-title">What are you doing?</h1><span class="tracker-divider"></span><p class="tracker-sub">Tap to start tracking.</p></div>`;
}

function OrbView(){
  const shell=document.createElement('div');shell.className=`tracker-orb-shell is-${state.active?'running':orbMode}`;shell.appendChild(OrbArtwork());
  const b=document.createElement('div');b.className='tracker-orb';b.setAttribute('role','button');b.tabIndex=0;b.innerHTML=OrbContent();
  if(state.active){b.onclick=stopActivity}
  else if(orbMode==='choose'){
    const list=b.querySelector('[data-orb-list]');
    const saved=[...state.customActivities.slice(-4).reverse(),...PRESETS.slice(0,4).map(([name,domain,icon])=>({name,domain,icon}))];
    const unique=[];saved.forEach(x=>{if(!unique.some(y=>y.name.toLowerCase()===x.name.toLowerCase()))unique.push(x)});
    unique.slice(0,5).forEach(item=>{const x=document.createElement('button');x.className='orb-mini-option';x.innerHTML=`<span>${esc(item.icon||iconFor(item.name))}</span><strong>${esc(item.name)}</strong>`;x.onclick=e=>{e.stopPropagation();startActivity(item.name,item.domain,{icon:item.icon})};list.appendChild(x)});
    const add=document.createElement('button');add.className='orb-mini-option orb-mini-add';add.innerHTML='<span>＋</span><strong>New activity</strong>';add.onclick=e=>{e.stopPropagation();modal={type:'new'};render()};list.appendChild(add);
    b.onclick=()=>{orbMode='idle';render()};
  } else b.onclick=()=>{orbMode='choose';render()};
  b.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();b.click()}};
  shell.appendChild(b);return shell;
}

function Main(){
  const n=document.createElement('section');n.className='tracker-screen';n.appendChild(Brand());
  const stage=document.createElement('div');stage.className='tracker-stage';stage.appendChild(OrbView());n.appendChild(stage);
  const nav=document.createElement('nav');nav.className='tracker-nav';
  const gaps=gapsToday();
  nav.innerHTML=`<button data-view="analytics">HOLISTIC LIFE</button>${gaps.length?`<button class="tracker-gap-link" data-view="gaps"><span></span>${gaps.length} UNTRACKED</button>`:''}`;
  nav.querySelector('[data-view="analytics"]').onclick=()=>{modal={type:'analytics'};render()};
  nav.querySelector('[data-view="gaps"]')?.addEventListener('click',()=>{modal={type:'gaps'};render()});
  n.appendChild(nav);return n;
}

function ModalShell(title,sub='',full=false){
  const n=document.createElement('div');n.className=`tracker-overlay${full?' tracker-overlay-full':''}`;
  n.innerHTML=`<section class="tracker-sheet${full?' tracker-sheet-full':''}" role="dialog" aria-modal="true"><header class="tracker-sheet-header"><div><p class="tracker-sheet-kicker">LIFE OS</p><h2>${esc(title)}</h2>${sub?`<p>${esc(sub)}</p>`:''}</div><button class="tracker-close" aria-label="Close">×</button></header><div data-body></div></section>`;
  n.querySelector('.tracker-close').onclick=()=>{modal=null;orbMode=state.active?'running':'idle';render()};
  if(!full)n.onclick=e=>{if(e.target===n){modal=null;render()}};
  return n;
}

function NewActivity(){
  const n=ModalShell('New activity','Tell LIFE OS what you are doing.');const body=n.querySelector('[data-body]');
  body.innerHTML=`<div class="new-activity-form"><label>ACTIVITY<input class="tracker-input" maxlength="48" placeholder="e.g. Gym" autofocus></label><label>HOLISTIC AREA<select class="tracker-select">${DOMAINS.map(d=>`<option>${esc(d)}</option>`).join('')}</select></label><button class="tracker-primary">START TRACKING</button></div><p class="tracker-ai-note">AI classification will eventually suggest the right area automatically. For now, you stay in control of the category.</p>`;
  const input=body.querySelector('input'),select=body.querySelector('select');
  body.querySelector('.tracker-primary').onclick=()=>startActivity(input.value,select.value,{suggestSave:true,icon:'✦'});
  input.onkeydown=e=>{if(e.key==='Enter')body.querySelector('.tracker-primary').click()};
  setTimeout(()=>input.focus(),80);return n;
}

function Complete(session){
  const n=ModalShell('Activity recorded',`${session.name} · ${duration(ms(session.endedAt)-ms(session.startedAt))}`);const body=n.querySelector('[data-body]');
  body.innerHTML=`<div class="completion-center"><div class="completion-icon">${esc(session.icon||'✦')}</div><p class="metric-eyebrow">ACTUAL TIME</p><h3>${esc(clock(session.startedAt))} — ${esc(clock(session.endedAt))}</h3><strong>${duration(ms(session.endedAt)-ms(session.startedAt))}</strong>${session.suggestSave?`<div class="save-activity-card"><p>Save <b>${esc(session.name)}</b> to My Activities?</p><span>You can select it instantly next time.</span><div><button data-save="yes">SAVE</button><button data-save="no">JUST THIS TIME</button></div></div>`:'<p class="completion-copy">Added to your Life history.</p>'}</div>`;
  const finish=()=>{modal=null;orbMode='idle';render()};
  body.querySelector('[data-save="yes"]')?.addEventListener('click',()=>{saveActivityFromSession(session);finish()});
  body.querySelector('[data-save="no"]')?.addEventListener('click',finish);
  if(!session.suggestSave)setTimeout(()=>{if(modal?.type==='complete')finish()},1100);
  return n;
}

function Analytics(){
  const n=ModalShell('Holistic Life','See where your actual life is going.',true),body=n.querySelector('[data-body]');
  const domains=summarize(analyticsPeriod,s=>DOMAINS.includes(s.domain)?s.domain:'Other'),acts=summarize(analyticsPeriod,s=>s.name||'Other'),total=domains.reduce((x,y)=>x+y.time,0);
  body.innerHTML=`<div class="analytics-tabs">${['day','week','month'].map(p=>`<button class="analytics-tab ${analyticsPeriod===p?'is-active':''}" data-p="${p}">${p==='day'?'TODAY':p.toUpperCase()}</button>`).join('')}</div><div class="analytics-hero"><p class="metric-eyebrow">HOLISTIC LIFE</p>${total?`<h3>${esc(domains[0].name)}</h3><p>currently receives the most tracked time.</p><strong>${duration(total)} tracked</strong>`:`<h3>Your picture is still forming.</h3><p>Track your activities and LIFE OS will reveal where your time actually goes.</p>`}</div><div data-metrics></div><div data-insights></div>`;
  body.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>{analyticsPeriod=b.dataset.p;render()});
  const metrics=body.querySelector('[data-metrics]');
  domains.forEach(x=>{const pct=total?Math.round(x.time/total*100):0,r=document.createElement('div');r.className='metric-row';r.innerHTML=`<div><span class="metric-name">${esc(x.name)}</span><span class="metric-time">${duration(x.time)}</span></div><span class="metric-bar"><i style="width:${pct}%"></i></span><small>${pct}%</small>`;metrics.appendChild(r)});
  const insights=body.querySelector('[data-insights]');if(acts.length)insights.innerHTML=`<div class="analytics-insight"><span>MOST TIME</span><strong>${esc(acts[0].name)} · ${duration(acts[0].time)}</strong></div>`;
  const gaps=gapsToday();if(analyticsPeriod==='day'&&gaps.length){const d=document.createElement('button');d.className='analytics-untracked';d.innerHTML=`<span>UNTRACKED TODAY</span><strong>${duration(gaps.reduce((s,g)=>s+g.time,0))}</strong><small>Unknown does not mean wasted. Review →</small>`;d.onclick=()=>{modal={type:'gaps'};render()};insights.appendChild(d)}
  return n;
}

function Gaps(){
  const n=ModalShell('Untracked time','LIFE OS noticed gaps in today.',true),body=n.querySelector('[data-body]'),gaps=gapsToday();
  if(!gaps.length){body.innerHTML='<div class="analytics-hero"><h3>Nothing to review.</h3><p>Your detected gaps are already classified.</p></div>';return n}
  gaps.forEach(g=>{const c=document.createElement('div');c.className='gap-card';c.innerHTML=`<p class="metric-eyebrow">UNKNOWN PERIOD</p><strong>${clock(g.start)} — ${clock(g.end)}</strong><h3>${duration(g.time)}</h3><p>What were you doing?</p><div class="gap-actions"></div>`;const a=c.querySelector('.gap-actions');[['Rest / Sleep','Sleep / Recovery'],['Friends / Social','Relationships / Family'],['Entertainment','Recreation / Enjoyment'],['Travel / Errand','Responsibility'],['Other activity','Other']].forEach(([name,domain])=>{const b=document.createElement('button');b.textContent=name;b.onclick=()=>classifyGap(g,name,domain,false);a.appendChild(b)});const u=document.createElement('button');u.textContent='Leave untracked';u.onclick=()=>classifyGap(g,'Untracked','Other',true);a.appendChild(u);body.appendChild(c)});return n;
}

function Modal(){if(!modal)return null;if(modal.type==='intro')return Intro();if(modal.type==='new')return NewActivity();if(modal.type==='complete')return Complete(modal.session);if(modal.type==='analytics')return Analytics();if(modal.type==='gaps')return Gaps();return null}
function render(){clearInterval(ticker);if(screen==='launch'){app.replaceChildren(Launch());return}const main=Main(),layer=Modal();layer?app.replaceChildren(main,layer):app.replaceChildren(main);if(state.active)ticker=setInterval(()=>{const el=document.querySelector('[data-live-timer]');if(el&&state.active)el.textContent=timer(Date.now()-ms(state.active.startedAt))},1000)}

document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(modal){modal=null;render()}else if(orbMode==='choose'){orbMode='idle';render()}}});
render();
setTimeout(()=>{screen='tracker';let seen=false;try{seen=localStorage.getItem(INTRO_KEY)==='1'}catch{}if(!seen)modal={type:'intro'};orbMode=state.active?'running':'idle';render()},1100);

window.__LIFE_OS__={getState:()=>({...state,screen,orbMode,modal,analyticsPeriod}),startActivity,stopActivity,openAnalytics:()=>{modal={type:'analytics'};render()},resetTracker:()=>{try{localStorage.removeItem(STORAGE_KEY);localStorage.removeItem(INTRO_KEY)}catch{}state=emptyState();screen='tracker';orbMode='idle';modal={type:'intro'};render()}};
