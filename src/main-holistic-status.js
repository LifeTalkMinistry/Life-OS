/* LIFE OS — persistent 7-day Holistic Health status on the main screen. */
(() => {
  const TRACKER_KEY = 'life-os-v1-live-activity-tracker';
  const CATEGORIES = [
    { id:'physical', keywords:['sleep','nap','workout','exercise','gym','run','walk','jog','food','eat','meal','breakfast','lunch','dinner','doctor','medical','health','shower','bath'] },
    { id:'spiritual', keywords:['devotion','church','pray','prayer','bible','worship','ministry','service','faith','choir'] },
    { id:'mental', keywords:['journal','therapy','meditate','meditation','reflect','reflection','mental','emotional','counsel'] },
    { id:'relationships', keywords:['family','friend','friends','partner','wife','husband','girlfriend','boyfriend','date','social','parents','mother','father','brother','sister'] },
    { id:'work', keywords:['work','shift','office','job','career','meeting','client','call center','training','commute to work'] },
    { id:'financial', keywords:['budget','money','finance','financial','bill','bills','expense','expenses','saving','savings','bank','income','debt','clara'] },
    { id:'growth', keywords:['study','learn','learning','read','reading','course','class','practice','lesson','research','tutorial'] },
    { id:'purpose', keywords:['project','purpose','mission','book','write','writing','content','create','creative','business','startup','build app','life os'] },
    { id:'rest', keywords:['rest','relax','movie','movies','watch','game','gaming','music','hobby','recreation','leisure','break','hangout','youtube','netflix'] }
  ];

  function classify(log){
    if(CATEGORIES.some(c=>c.id===log?.category)) return log.category;
    const name=String(log?.name||'').toLowerCase();
    let best='purpose',bestScore=0;
    CATEGORIES.forEach(c=>{
      const score=c.keywords.reduce((sum,k)=>sum+(name.includes(k)?k.length:0),0);
      if(score>bestScore){best=c.id;bestScore=score;}
    });
    return best;
  }

  function sevenDayHealth(){
    let logs=[];
    try{
      const parsed=JSON.parse(localStorage.getItem(TRACKER_KEY)||'{}');
      logs=Array.isArray(parsed.logs)?parsed.logs:[];
    }catch{}
    const since=Date.now()-7*86400000;
    const recent=logs.filter(log=>Number(log?.endedAt||0)>=since);
    const totals=Object.fromEntries(CATEGORIES.map(c=>[c.id,0]));
    recent.forEach(log=>{totals[classify(log)]+=Math.max(0,Number(log.durationMs||0));});
    const totalMs=Object.values(totals).reduce((sum,v)=>sum+v,0);
    if(!totalMs) return {score:0,label:'No Data'};
    const n=CATEGORIES.length;
    const shares=Object.values(totals).map(v=>v/totalMs);
    const concentration=shares.reduce((sum,s)=>sum+s*s,0);
    const minimumConcentration=1/n;
    const normalizedImbalance=Math.max(0,Math.min(1,(concentration-minimumConcentration)/(1-minimumConcentration)));
    const score=Math.max(0,Math.min(100,Math.round((1-normalizedImbalance)*100)));
    let label='Critical Imbalance';
    if(score>=100) label='Thriving';
    else if(score>=90) label='Healthy';
    else if(score>=80) label='Stable';
    else if(score>=70) label='Improving';
    else if(score>=60) label='Needs Attention';
    else if(score>=50) label='Concerning';
    return {score,label};
  }

  const priorMainScreen=MainScreen;
  MainScreen=function MainScreenWithHolisticStatus(){
    const view=priorMainScreen();
    if(!view?.classList?.contains('life-tracker-screen')) return view;
    const stage=view.querySelector('.orb-stage');
    if(!stage) return view;

    const health=sevenDayHealth();
    const displayScore=String(health.score).padStart(2,'0');
    const status=document.createElement('div');
    status.className='main-holistic-status';
    status.innerHTML=`<strong>${displayScore}%</strong><b>${health.label}</b>`;
    view.insertBefore(status,stage);
    return view;
  };

  const style=document.createElement('style');
  style.textContent=`
    .life-tracker-screen{position:relative}
    .main-holistic-status{
      position:absolute;
      left:50%;
      bottom:clamp(88px,12svh,116px);
      transform:translateX(-50%);
      z-index:4;
      width:min(88vw,460px);
      display:flex;
      flex-direction:column;
      align-items:center;
      justify-content:center;
      gap:.34rem;
      color:rgba(244,239,251,.78);
      text-align:center;
      pointer-events:none;
      white-space:nowrap;
    }
    .main-holistic-status strong{
      font:620 1.28rem/1 Inter,ui-sans-serif,sans-serif;
      letter-spacing:.015em;
      color:rgba(255,255,255,.94);
      text-shadow:0 0 18px rgba(168,123,255,.12);
      font-variant-numeric:tabular-nums;
    }
    .main-holistic-status b{
      font:520 .68rem/1 Inter,ui-sans-serif,sans-serif;
      letter-spacing:.025em;
      color:rgba(228,218,241,.56);
    }
    @media(max-width:420px){
      .main-holistic-status{bottom:clamp(84px,11.5svh,104px);gap:.3rem}
      .main-holistic-status strong{font-size:1.18rem}
      .main-holistic-status b{font-size:.64rem}
    }
  `;
  document.head.appendChild(style);

  // Some users enter the tracker immediately through the deferred-setup path,
  // which renders before this MainScreen wrapper is installed. Re-render once
  // after the full bundle finishes so the persistent status is present without
  // requiring the user to tap or swipe first.
  queueMicrotask(() => {
    if (screen === 'now' && !systemView) render();
  });
})();
