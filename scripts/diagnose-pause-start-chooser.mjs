import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const distDir = fileURLToPath(new URL('../dist/', import.meta.url));
const user = { id:'pause-start-diagnostic', name:'PAUSE Start Test', email:'pause-start@example.test', role:'user', status:'active', plan:'free', app:'pause' };
const recoveryPlan = { version:2, setupComplete:true, nudgeConsentComplete:true, workDays:[1,2,3,4,5], shiftStart:'22:00', shiftEnd:'08:00', commuteMinutes:60, windDownMinutes:45, recoveryMinutes:480, nudges:{} };
const activities = { version:1, activities:[{ id:'spanish', name:'Spanish Language Practice', targetMode:'track', targetMinutes:null, spanMode:'ongoing', endDate:null, createdAt:Date.now() }], sessions:[], active:null };

const b64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const token = `${b64({alg:'none',typ:'JWT'})}.${b64({app:'pause',aud:'pause-client',exp:Math.floor(Date.now()/1000)+3600})}.diagnostic`;
let syncSnapshot = null;

function type(pathname) {
  const ext = extname(pathname).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.js') return 'text/javascript; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.json' || ext === '.webmanifest') return 'application/json; charset=utf-8';
  if (ext === '.png') return 'image/png';
  if (ext === '.svg') return 'image/svg+xml';
  return 'application/octet-stream';
}

function json(res, status, payload) {
  res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
  res.end(JSON.stringify(payload));
}

async function body(req) {
  const chunks=[];
  for await (const chunk of req) chunks.push(chunk);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : null;
}

const server = createServer(async (req,res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  if (url.pathname === '/api/pause/me') return json(res,200,user);
  if (url.pathname === '/api/pause/recovery-plan') return json(res,200,{exists:true,plan:recoveryPlan});
  if (url.pathname === '/api/pause/sync') {
    if (req.method === 'GET') return json(res,200,syncSnapshot || {exists:false,revision:0});
    if (req.method === 'PUT') {
      const payload = await body(req);
      syncSnapshot = { exists:true, state:payload?.state || {active:null,history:[]}, scorePreference:payload?.scorePreference || {version:2,timeframe:'daily',customRange:null}, revision:(syncSnapshot?.revision || 0)+1 };
      return json(res,200,syncSnapshot);
    }
  }
  const relative = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, '');
  const safe = normalize(relative).replace(/^(\.\.(\/|\\|$))+/, '');
  const path = join(distDir,safe);
  const info = await stat(path).catch(() => null);
  if (!info?.isFile()) { res.writeHead(404); res.end('Not found'); return; }
  res.writeHead(200,{'Content-Type':type(path),'Cache-Control':'no-store'});
  res.end(await readFile(path));
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const origin = `http://127.0.0.1:${server.address().port}`;

const candidates=[process.env.CHROME_PATH,'google-chrome','google-chrome-stable','chromium','chromium-browser'].filter(Boolean);
let chromePath='';
for (const candidate of candidates) {
  const found=spawnSync('which',[candidate],{encoding:'utf8'});
  if (found.status===0 && found.stdout.trim()) { chromePath=found.stdout.trim(); break; }
}
if (!chromePath) throw new Error('Chrome/Chromium not found');
const chrome=spawn(chromePath,['--headless','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-first-run','--remote-debugging-port=0',`--user-data-dir=/tmp/pause-start-${process.pid}`,'--window-size=390,844','about:blank'],{stdio:['ignore','ignore','pipe']});
let stderr='';
chrome.stderr.on('data',(chunk)=>{stderr+=chunk.toString();});
let port=null;
for (let i=0;i<100;i+=1) {
  const match=stderr.match(/DevTools listening on ws:\/\/[^:]+:(\d+)\//);
  if (match) { port=Number(match[1]); break; }
  if (chrome.exitCode!==null) throw new Error(`Chrome exited early: ${stderr}`);
  await sleep(100);
}
if (!port) throw new Error(`DevTools unavailable: ${stderr}`);
const targets=await fetch(`http://127.0.0.1:${port}/json/list`).then((r)=>r.json());
const page=targets.find((target)=>target.type==='page');
const ws=new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
let id=0;
const pending=new Map();
const runtime=[];
ws.addEventListener('message',(event)=>{
  const message=JSON.parse(event.data);
  if (message.method==='Runtime.exceptionThrown') runtime.push(message.params?.exceptionDetails?.exception?.description || message.params?.exceptionDetails?.text || 'runtime exception');
  if (!message.id || !pending.has(message.id)) return;
  const job=pending.get(message.id); pending.delete(message.id);
  if (message.error) job.reject(new Error(message.error.message)); else job.resolve(message);
});
function send(method,params={}) {
  const messageId=++id;
  ws.send(JSON.stringify({id:messageId,method,params}));
  return new Promise((resolve,reject)=>{pending.set(messageId,{resolve,reject});setTimeout(()=>{if(pending.delete(messageId))reject(new Error(`CDP timeout: ${method}`));},6000);});
}
async function evalValue(expression) {
  const response=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
  if (response.result?.exceptionDetails) throw new Error(response.result.exceptionDetails.exception?.description || response.result.exceptionDetails.text);
  return response.result?.result?.value;
}
async function wait(expression,label,timeout=12000) {
  const start=Date.now();
  while(Date.now()-start<timeout){if(await evalValue(`Boolean(${expression})`))return;await sleep(80);} throw new Error(`Timed out waiting for ${label}`);
}

try {
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.addScriptToEvaluateOnNewDocument',{source:`(() => {
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
    window.PAUSE_API_URL=location.origin;
    window.__pauseBrowserErrors=[];
    window.addEventListener('error',(e)=>window.__pauseBrowserErrors.push(String(e.error?.stack||e.message||'error')));
    window.addEventListener('unhandledrejection',(e)=>window.__pauseBrowserErrors.push(String(e.reason?.stack||e.reason||'rejection')));
    localStorage.clear();
    localStorage.setItem('pause_backend_access_token_v1',${JSON.stringify(token)});
    localStorage.setItem('pause_backend_user_v1',${JSON.stringify(JSON.stringify(user))});
    localStorage.setItem('pause-recovery-plan-v1:account:${user.id}',${JSON.stringify(JSON.stringify(recoveryPlan))});
    localStorage.setItem('pause-activity-commitments-v1:account:${user.id}',${JSON.stringify(JSON.stringify(activities))});
  })();`});
  await send('Page.navigate',{url:`${origin}/`});
  await wait(`document.querySelector('.pause-main-screen .orb')`,'main ORB');
  await wait(`window.__PAUSE_ACTIVITIES__?.getActivities?.().length===1`,'activity API');
  const before=await evalValue(`window.__PAUSE__.getState()`);
  const modeBefore=await evalValue(`document.querySelector('.orb-shell')?.className`);
  await evalValue(`(() => { const orb=document.querySelector('.pause-main-screen .orb'); orb.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:41,button:0,clientX:195,clientY:422})); orb.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:41,button:0,clientX:195,clientY:422})); })()`);
  await sleep(200);
  const after=await evalValue(`window.__PAUSE__.getState()`);
  const modeAfter=await evalValue(`document.querySelector('.orb-shell')?.className`);
  const chooser=await evalValue(`Boolean(document.querySelector('.pause-start-chooser'))`);
  const browserErrors=await evalValue(`window.__pauseBrowserErrors`);
  console.log('PAUSE tap diagnostic', JSON.stringify({before,modeBefore,after,modeAfter,chooser,browserErrors,runtime}));
  assert.equal(chooser,true,'Normal ORB pointer tap must open the Rest + Activity chooser');
} finally {
  try{ws.close();}catch{}
  chrome.kill('SIGTERM');
  await new Promise((resolve)=>server.close(resolve));
}
