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
    const brand=view.querySelector('.brand, .brand-block, header');
    const stage=view.querySelector('.orb-stage');
    if(!stage) return view;

    const health=sevenDayHealth();
    const status=document.createElement('div');
    status.className='main-holistic-status';
    status.innerHTML=`<span>7 DAY HOLISTIC HEALTH</span><strong>${health.score}%</strong><b>${health.label}</b>`;
    view.insertBefore(status,stage);
    return view;
  };

  const style=document.createElement('style');
  style.textContent=`
    .life-tracker-screen{position:relative}
    .main-holistic-status{
      position:absolute;
      left:50%;
      top:clamp(180px,27svh,255px);
      transform:translateX(-50%);
      z-index:4;
      width:min(88vw,460px);
      display:flex;
      align-items:baseline;
      justify-content:center;
      gap:.45rem;
      color:rgba(244,239,251,.78);
      text-align:center;
      pointer-events:none;
      white-space:nowrap;
    }
    .main-holistic-status span{
      font:520 .52rem/1 Inter,ui-sans-serif,sans-serif;
      letter-spacing:.18em;
      color:rgba(211,198,234,.46);
    }
    .main-holistic-status strong{
      font:620 .92rem/1 Inter,ui-sans-serif,sans-serif;
      color:rgba(255,255,255,.92);
      font-variant-numeric:tabular-nums;
    }
    .main-holistic-status b{
      font:540 .62rem/1 Inter,ui-sans-serif,sans-serif;
      color:rgba(228,218,241,.58);
    }
    @media(max-width:420px){
      .main-holistic-status{top:clamp(175px,26svh,225px);gap:.35rem}
      .main-holistic-status span{font-size:.48rem;letter-spacing:.14em}
      .main-holistic-status strong{font-size:.86rem}
      .main-holistic-status b{font-size:.58rem}
    }
  `;
  document.head.appendChild(style);
})();