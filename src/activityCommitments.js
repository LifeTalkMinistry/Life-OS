/* PAUSE declared activity commitments. Additive: existing rest behavior is untouched. */
(() => {
  const PREFIX = 'pause-activity-commitments-v1';
  const USER_KEY = 'pause_backend_user_v1';
  const REST_KEY = 'pause-state-v1';
  const LIMIT = 500;
  let overlay = null;
  let mode = 'hub';
  let tick = null;

  const esc = (v) => String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  const clean = (v, n = 48) => String(v ?? '').trim().replace(/\s+/g,' ').slice(0,n);

  function accountId() {
    try {
      const u = JSON.parse(localStorage.getItem(USER_KEY) || 'null');
      return clean(u?.id ?? u?.user_id ?? u?.userId ?? 'guest', 96) || 'guest';
    } catch { return 'guest'; }
  }
  const key = () => `${PREFIX}:account:${accountId()}`;
  const empty = () => ({ version:1, activities:[], sessions:[], active:null });

  function read() {
    try {
      const x = JSON.parse(localStorage.getItem(key()) || 'null');
      if (!x || typeof x !== 'object') return empty();
      return {
        version:1,
        activities:Array.isArray(x.activities) ? x.activities.filter(a => a?.id && a?.name).slice(0,40) : [],
        sessions:Array.isArray(x.sessions) ? x.sessions.filter(s => s?.activityId && Number(s.startAt) && Number(s.endAt)).slice(-LIMIT) : [],
        active:x.active?.activityId && Number(x.active?.startAt) ? x.active : null
      };
    } catch { return empty(); }
  }

  function write(s) {
    const next = { version:1, activities:s.activities.slice(0,40), sessions:s.sessions.slice(-LIMIT), active:s.active || null };
    try { localStorage.setItem(key(), JSON.stringify(next)); } catch {}
    window.dispatchEvent(new CustomEvent('pause:activities-changed'));
    return next;
  }

  function manilaKey(ms = Date.now()) {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(ms)).map(x => [x.type,x.value]));
    return `${p.year}-${p.month}-${p.day}`;
  }
  function midnight(dateKey) {
    const [y,m,d] = dateKey.split('-').map(Number);
    return Date.UTC(y,m-1,d,-8,0,0,0);
  }
  function addDays(dateKey, days) { return manilaKey(midnight(dateKey) + days * 86400000); }
  function range(kind, now = Date.now()) {
    const startDay = midnight(manilaKey(now));
    if (kind === 'daily') return [startDay,startDay+86400000];
    if (kind === 'weekly') {
      const wd = ({Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6})[new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Manila',weekday:'short'}).format(new Date(now))] ?? 1;
      const monday = startDay - (wd === 0 ? 6 : wd - 1) * 86400000;
      return [monday,monday + 7*86400000];
    }
    return [0,Infinity];
  }
  function overlap(a,b,x,y) { return Math.max(0, Math.min(Number(b)||Date.now(),y) - Math.max(Number(a)||0,x)); }
  function duration(ms) {
    const m = Math.max(0,Math.round(ms/60000));
    return m < 60 ? `${m}m` : `${Math.floor(m/60)}h${m%60 ? ` ${m%60}m` : ''}`;
  }
  function clock(ms) {
    const s = Math.max(0,Math.floor(ms/1000)), h=Math.floor(s/3600), m=Math.floor((s%3600)/60);
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  }
  function endDateForPeriod(value, unit) {
    const n = Math.max(1,Math.min(120,Math.round(Number(value)||1)));
    const today = manilaKey();
    if (unit === 'months') {
      const [y,m,d] = today.split('-').map(Number);
      return manilaKey(Date.UTC(y,m-1+n,d,-8));
    }
    return addDays(today,n*7);
  }
  function activityMs(s,a,now=Date.now()) {
    const [r0,r1] = ['daily','weekly'].includes(a.targetMode) ? range(a.targetMode,now) : [Number(a.createdAt)||0, a.endDate ? midnight(addDays(a.endDate,1)) : Infinity];
    let total = s.sessions.filter(x=>x.activityId===a.id).reduce((n,x)=>n+overlap(x.startAt,x.endAt,r0,r1),0);
    if (s.active?.activityId===a.id) total += overlap(s.active.startAt,now,r0,r1);
    return total;
  }
  function targetText(a) {
    if (a.targetMode === 'track') return 'Track only';
    const h = Number(a.targetMinutes||0)/60;
    const n = Number.isInteger(h) ? h : Number(h.toFixed(2));
    return a.targetMode==='daily' ? `${n}h / day` : a.targetMode==='weekly' ? `${n}h / week` : `${n}h total`;
  }
  function progressText(s,a) {
    const spent = activityMs(s,a);
    return a.targetMode==='track' ? `${duration(spent)} tracked` : `${duration(spent)} / ${duration(Number(a.targetMinutes||0)*60000)}`;
  }
  function ended(a) { return Boolean(a.endDate && Date.now() >= midnight(addDays(a.endDate,1))); }
  function restActive() {
    try {
      const id=accountId(), accountKey=id==='guest'?null:`${REST_KEY}:account:${id}`;
      if (accountKey) {
        const raw=localStorage.getItem(accountKey);
        if (raw!==null) return Boolean(JSON.parse(raw)?.active?.startAt);
      }
      return Boolean(JSON.parse(localStorage.getItem(REST_KEY)||'null')?.active?.startAt);
    } catch { return false; }
  }

  function styles() {
    if (document.querySelector('#pause-activity-v1-style')) return;
    const el=document.createElement('style'); el.id='pause-activity-v1-style'; el.textContent=`
      .pause-activity-menu{left:50%!important;right:auto!important;top:auto!important;bottom:-7%!important;transform:translateX(-50%)!important;width:132px!important}.pause-activity-menu:hover{transform:translateX(-50%) scale(1.035)!important}.pause-activity-menu small{display:block;margin-top:3px;color:#8d8299;font-size:.52rem;line-height:1.1}.pause-activity-menu.is-running{border-color:rgba(205,160,255,.5)!important}
      .activity-backdrop{position:fixed;inset:0;z-index:90;display:grid;place-items:center;padding:20px;background:rgba(3,3,7,.82);backdrop-filter:blur(14px)}.activity-panel{box-sizing:border-box;width:min(94vw,440px);max-height:min(86svh,760px);overflow:auto;padding:22px;border:1px solid rgba(169,124,228,.2);border-radius:22px;background:linear-gradient(180deg,rgba(18,12,31,.98),rgba(7,6,13,.99));box-shadow:0 28px 80px rgba(0,0,0,.55);color:#eee8f5;font-family:Inter,ui-sans-serif,system-ui,sans-serif}
      .activity-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:14px}.activity-head p,.activity-label{margin:0 0 6px;color:#8d8299;font-size:.58rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase}.activity-head h2{margin:0;font-size:1.35rem;font-weight:520}.activity-close{width:34px;height:34px;border:1px solid rgba(169,124,228,.18);border-radius:50%;background:transparent;color:#aaa0b5;font-size:1rem}.activity-intro{margin:0 0 15px;color:#958b9f;font-size:.72rem;line-height:1.5}.activity-actions{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-bottom:14px}.activity-actions button,.activity-start,.activity-stop,.activity-submit{min-height:42px;border:1px solid rgba(169,124,228,.18);border-radius:12px;background:rgba(88,53,145,.1);color:#ddd4e7;font-size:.68rem;font-weight:650}.activity-actions button.is-on{border-color:rgba(200,155,255,.4);background:rgba(105,62,176,.18)}
      .activity-running{padding:15px;margin-bottom:14px;border:1px solid rgba(205,160,255,.28);border-radius:16px;text-align:center;background:rgba(105,62,176,.09)}.activity-running small{display:block;color:#9b90a7;font-size:.57rem;letter-spacing:.14em}.activity-running strong{display:block;margin:5px 0 2px;font-size:1rem}.activity-clock{font-size:1.5rem;font-variant-numeric:tabular-nums}.activity-stop{margin-top:9px;padding:0 16px}
      .activity-list{display:grid;gap:8px}.activity-card{display:grid;grid-template-columns:1fr auto;align-items:center;gap:10px;padding:12px;border:1px solid rgba(159,121,218,.14);border-radius:14px;background:rgba(11,8,20,.55)}.activity-card strong{display:block;font-size:.82rem}.activity-card span{display:block;margin-top:4px;color:#948a9d;font-size:.62rem}.activity-start{padding:0 13px}.activity-start:disabled{opacity:.35}.activity-empty{margin:18px 0;color:#81798a;font-size:.75rem;text-align:center;line-height:1.55}
      .activity-form{display:grid;gap:15px}.activity-field>label,.activity-field>span{display:block;margin-bottom:7px;color:#a79dac;font-size:.66rem}.activity-field input[type=text],.activity-field input[type=number],.activity-field input[type=date],.activity-field select{box-sizing:border-box;width:100%;min-height:44px;padding:0 12px;border:1px solid rgba(169,124,228,.18);border-radius:12px;background:rgba(7,5,14,.6);color:#eee8f5;outline:0}.activity-choices{display:grid;grid-template-columns:repeat(2,1fr);gap:7px}.activity-choice{position:relative}.activity-choice input{position:absolute;opacity:0}.activity-choice span{display:grid;place-items:center;min-height:42px;padding:5px;border:1px solid rgba(169,124,228,.16);border-radius:11px;color:#a9a0b3;font-size:.66rem;text-align:center}.activity-choice input:checked+span{border-color:rgba(200,155,255,.46);background:rgba(105,62,176,.18);color:#f0eaf5}.activity-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}.activity-help{margin:6px 0 0;color:#736b7b;font-size:.6rem;line-height:1.4}.activity-error{min-height:16px;margin:0;color:#c7a9d9;font-size:.65rem;text-align:center}.activity-submit{width:100%;min-height:46px;background:rgba(112,74,255,.16)}[hidden]{display:none!important}
      .activity-history{display:grid;gap:7px}.activity-history-row,.activity-break-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px;border-bottom:1px solid rgba(169,124,228,.1)}.activity-history-row strong,.activity-break-row strong{font-size:.76rem}.activity-history-row small{display:block;margin-top:3px;color:#7f7688;font-size:.58rem}.activity-history-row b,.activity-break-row b{font-size:.7rem}.activity-insights{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:15px}.activity-stat{padding:14px;border:1px solid rgba(169,124,228,.14);border-radius:14px;text-align:center;background:rgba(11,8,20,.5)}.activity-stat span{display:block;color:#81788a;font-size:.55rem;letter-spacing:.12em}.activity-stat strong{display:block;margin:6px 0 3px;font-size:1rem}.activity-stat small{color:#81788a;font-size:.58rem}
    `; document.head.appendChild(el);
  }

  function menuIcon() { return '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/><path d="M12 8v4l3 2M7 4l-2 2M17 4l2 2"/></svg>'; }
  function injectMenu() {
    const nav=document.querySelector('.pause-orb-menu');
    if (!nav || nav.querySelector('[data-pause-activity-menu]')) return;
    const b=document.createElement('button'); b.type='button'; b.className='pause-menu-node pause-activity-menu'; b.dataset.pauseActivitiesMenu='1';
    b.innerHTML=`<span class="pause-menu-node-icon" aria-hidden="true">${menuIcon()}</span><span class="pause-menu-node-copy"><strong>Activity</strong><small>Track declared time</small></span>`;
    b.addEventListener('click',e=>{e.stopPropagation();open('hub');}); nav.appendChild(b); refreshMenu();
  }
  function refreshMenu() {
    const b=document.querySelector('[data-pause-activity-menu]'); if(!b)return;
    const a=read().active; b.classList.toggle('is-running',Boolean(a));
    const c=b.querySelector('.pause-menu-node-copy'); if(c)c.innerHTML=`<strong>Activity</strong><small>${a?`${esc(a.name)} running`:'Track declared time'}</small>`;
  }

  function start(id) {
    if (restActive()) return;
    const s=read(); if(s.active)return;
    const a=s.activities.find(x=>x.id===id); if(!a || ended(a))return;
    s.active={id:`active-${Date.now()}`,activityId:a.id,name:a.name,startAt:Date.now()}; write(s); render();
  }
  function stop() {
    const s=read(); if(!s.active)return;
    const endAt=Date.now(), a=s.active;
    s.sessions.push({id:`session-${endAt}`,activityId:a.activityId,name:a.name,startAt:a.startAt,endAt,durationMs:Math.max(0,endAt-a.startAt)});
    s.active=null; write(s); render();
  }

  function hub(s) {
    const blocked=restActive();
    return `${s.active?`<div class="activity-running"><small>ACTIVITY IN PROGRESS</small><strong>${esc(s.active.name)}</strong><div class="activity-clock" data-activity-clock>${clock(Date.now()-s.active.startAt)}</div><button class="activity-stop" data-stop>END ACTIVITY</button></div>`:''}
      <div class="activity-actions"><button class="is-on" data-view="add">+ ADD</button><button data-view="history">HISTORY</button><button data-view="insights">INSIGHTS</button></div>
      ${blocked?'<p class="activity-intro">You are currently resting. Your rest continues exactly as it is; end it before starting an activity.</p>':''}
      <div class="activity-list">${s.activities.length?s.activities.map(a=>`<div class="activity-card"><div><strong>${esc(a.name)}</strong><span>${esc(targetText(a))} · ${esc(progressText(s,a))}${a.endDate?` · until ${esc(a.endDate)}`:''}</span></div><button class="activity-start" data-start="${esc(a.id)}" ${s.active||blocked||ended(a)?'disabled':''}>${s.active?.activityId===a.id?'RUNNING':'START'}</button></div>`).join(''):'<p class="activity-empty">No declared activities yet.<br>Add only what you intentionally want PAUSE to document.</p>'}</div>`;
  }

  function addForm() {
    return `<form class="activity-form" data-form>
      <div class="activity-field"><label>WHAT ARE YOU COMMITTING TIME TO?</label><input type="text" name="name" maxlength="48" placeholder="Spanish" autocomplete="off" required></div>
      <div class="activity-field"><span>HOW SHOULD PAUSE MEASURE IT?</span><div class="activity-choices">
        <label class="activity-choice"><input type="radio" name="targetMode" value="track" checked><span>Track only</span></label><label class="activity-choice"><input type="radio" name="targetMode" value="daily"><span>Daily target</span></label><label class="activity-choice"><input type="radio" name="targetMode" value="weekly"><span>Weekly target</span></label><label class="activity-choice"><input type="radio" name="targetMode" value="total"><span>Total target</span></label>
      </div><p class="activity-help">Weekly means total hours for the week. PAUSE does not assign specific days.</p></div>
      <div class="activity-field" data-target hidden><label>TARGET HOURS</label><input type="number" name="targetHours" min="0.25" max="1000" step="0.25" placeholder="7"></div>
      <div class="activity-field"><span>HOW LONG IS THIS COMMITMENT?</span><div class="activity-choices">
        <label class="activity-choice"><input type="radio" name="spanMode" value="ongoing" checked><span>Ongoing</span></label><label class="activity-choice"><input type="radio" name="spanMode" value="until"><span>Until a date</span></label><label class="activity-choice"><input type="radio" name="spanMode" value="period"><span>For a period</span></label>
      </div></div>
      <div class="activity-field" data-until hidden><label>END DATE</label><input type="date" name="endDate"></div>
      <div class="activity-field" data-period hidden><label>PERIOD</label><div class="activity-row"><input type="number" name="periodValue" min="1" max="120" value="4"><select name="periodUnit"><option value="weeks">Weeks</option><option value="months">Months</option></select></div></div>
      <p class="activity-error" data-error></p><button class="activity-submit" type="submit">CREATE ACTIVITY</button>
    </form>`;
  }

  function history(s) {
    const rows=[...s.sessions].sort((a,b)=>b.endAt-a.endAt).slice(0,30);
    return `<div class="activity-actions"><button data-view="hub">ACTIVITIES</button><button class="is-on">HISTORY</button><button data-view="insights">INSIGHTS</button></div><div class="activity-history">${rows.length?rows.map(x=>`<div class="activity-history-row"><div><strong>${esc(x.name)}</strong><small>${new Date(x.endAt).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</small></div><b>${duration(x.durationMs)}</b></div>`).join(''):'<p class="activity-empty">No completed activity sessions yet.</p>'}</div>`;
  }
  function insights(s) {
    const since=Date.now()-7*86400000, recent=s.sessions.filter(x=>x.endAt>=since); const totals=new Map(); let total=0;
    recent.forEach(x=>{const d=Math.max(0,Number(x.durationMs)||x.endAt-x.startAt);total+=d;totals.set(x.activityId,(totals.get(x.activityId)||0)+d);});
    if(s.active){const d=Math.max(0,Date.now()-s.active.startAt);total+=d;totals.set(s.active.activityId,(totals.get(s.active.activityId)||0)+d);}
    const names=new Map(s.activities.map(a=>[a.id,a.name])); const ranked=[...totals].sort((a,b)=>b[1]-a[1]); const top=ranked[0];
    return `<div class="activity-actions"><button data-view="hub">ACTIVITIES</button><button data-view="history">HISTORY</button><button class="is-on">INSIGHTS</button></div><div class="activity-insights"><div class="activity-stat"><span>LAST 7 DAYS</span><strong>${duration(total)}</strong><small>${recent.length} completed sessions</small></div><div class="activity-stat"><span>MOST TIME</span><strong>${top?esc(names.get(top[0])||'Activity'):'—'}</strong><small>${top?duration(top[1]):'No data yet'}</small></div></div><p class="activity-label">TIME BY ACTIVITY · LAST 7 DAYS</p><div>${ranked.length?ranked.map(([id,d])=>`<div class="activity-break-row"><strong>${esc(names.get(id)||'Activity')}</strong><b>${duration(d)}</b></div>`).join(''):'<p class="activity-empty">Track a few declared activities and PAUSE will build your time picture here.</p>'}</div>`;
  }

  function syncFields(form) {
    const target=form.querySelector('input[name=targetMode]:checked')?.value||'track', span=form.querySelector('input[name=spanMode]:checked')?.value||'ongoing';
    form.querySelector('[data-target]').hidden=target==='track'; form.querySelector('[data-until]').hidden=span!=='until'; form.querySelector('[data-period]').hidden=span!=='period';
  }
  function saveForm(form) {
    const d=new FormData(form), s=read(), err=form.querySelector('[data-error]'); const name=clean(d.get('name')); const targetMode=String(d.get('targetMode')||'track'), spanMode=String(d.get('spanMode')||'ongoing'), hours=Number(d.get('targetHours'));
    if(!name){err.textContent='Name the activity you want to document.';return;} if(targetMode!=='track'&&(!Number.isFinite(hours)||hours<.25||hours>1000)){err.textContent='Choose a target between 0.25 and 1000 hours.';return;}
    if(s.activities.some(a=>a.name.toLowerCase()===name.toLowerCase())){err.textContent='You already declared an activity with this name.';return;}
    let endDate=null; if(spanMode==='until'){endDate=clean(d.get('endDate'),10);if(!/^\d{4}-\d{2}-\d{2}$/.test(endDate)||midnight(addDays(endDate,1))<=Date.now()){err.textContent='Choose a future end date.';return;}} else if(spanMode==='period'){const v=Number(d.get('periodValue'));if(!Number.isFinite(v)||v<1||v>120){err.textContent='Choose a valid period.';return;}endDate=endDateForPeriod(v,d.get('periodUnit')==='months'?'months':'weeks');}
    s.activities.unshift({id:`activity-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,name,targetMode,targetMinutes:targetMode==='track'?null:Math.round(hours*60),spanMode,endDate,createdAt:Date.now()}); write(s); mode='hub'; render();
  }

  function render() {
    if(!overlay?.isConnected)return; clearInterval(tick); tick=null; const s=read(), panel=overlay.querySelector('.activity-panel');
    const title=mode==='add'?'Add Activity':mode==='history'?'Activity History':mode==='insights'?'Activity Insights':'Activities'; const body=mode==='add'?addForm():mode==='history'?history(s):mode==='insights'?insights(s):hub(s);
    panel.innerHTML=`<div class="activity-head"><div><p>PAUSE · INTENTIONAL EFFORT</p><h2>${title}</h2></div><button class="activity-close" data-close aria-label="Close">×</button></div>${mode==='hub'?'<p class="activity-intro">Document only the activities you intentionally choose to track. Your existing rest flow stays exactly as it is.</p>':''}${body}`;
    panel.querySelector('[data-close]')?.addEventListener('click',close); panel.querySelector('[data-stop]')?.addEventListener('click',stop); panel.querySelectorAll('[data-start]').forEach(b=>b.addEventListener('click',()=>start(b.dataset.start))); panel.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.view;render();}));
    const form=panel.querySelector('[data-form]'); if(form){form.addEventListener('change',()=>syncFields(form));form.addEventListener('submit',e=>{e.preventDefault();saveForm(form);});syncFields(form);queueMicrotask(()=>form.querySelector('input[name=name]')?.focus());}
    if(s.active)tick=setInterval(()=>{const n=overlay?.querySelector('[data-activity-clock]'),a=read().active;if(n&&a)n.textContent=clock(Date.now()-a.startAt);},1000);
  }
  function open(next='hub') { styles(); close(); mode=next; overlay=document.createElement('div');overlay.className='activity-backdrop';overlay.innerHTML='<section class="activity-panel" role="dialog" aria-modal="true" aria-label="PAUSE activities"></section>';overlay.addEventListener('pointerdown',e=>{if(e.target===overlay)close();});document.body.appendChild(overlay);render(); }
  function close() { clearInterval(tick);tick=null;overlay?.remove();overlay=null;mode='hub'; }

  function init() {
    styles(); injectMenu();
    new MutationObserver(()=>{if(overlay?.isConnected&&!document.querySelector('#app .pause-main-screen'))close();injectMenu();}).observe(document.documentElement,{childList:true,subtree:true});
    window.addEventListener('pause:activities-changed',refreshMenu); window.addEventListener('storage',e=>{if(e.key?.startsWith(PREFIX)||e.key===USER_KEY){refreshMenu();if(overlay?.isConnected)render();}});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();