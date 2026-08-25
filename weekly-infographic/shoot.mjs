import { spawn } from 'node:child_process';
import { writeFileSync, existsSync, readdirSync } from 'node:fs';

// Chromium location differs per host (CI runner, container, laptop). Resolve it
// at run time instead of pinning one path, or the job only works where it was written.
function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH, '/opt/pw-browsers',
                 `${process.env.HOME}/.cache/ms-playwright`].filter(Boolean);
  for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const d of readdirSync(root).filter(d => d.startsWith('chromium')).sort().reverse()) {
      for (const rel of ['chrome-linux/chrome', 'chrome-linux/headless_shell',
                         'chrome-mac/Chromium.app/Contents/MacOS/Chromium']) {
        const c = `${root}/${d}/${rel}`;
        if (existsSync(c)) return c;
      }
    }
    if (existsSync(`${root}/chromium`)) return `${root}/chromium`;
  }
  for (const c of ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
                   '/usr/bin/google-chrome-stable']) if (existsSync(c)) return c;
  throw new Error('no Chromium found — set CHROME_PATH');
}
const CHROME = findChrome();
const W = 1080, H = 1350, DSF = 2;
const files = process.argv.slice(2);
const port = 9222 + (process.pid % 900);

const chrome = spawn(CHROME, ['--headless=new','--disable-gpu','--no-sandbox','--hide-scrollbars',
  `--remote-debugging-port=${port}`,`--user-data-dir=/tmp/cdp-prof-${process.pid}`,'about:blank'],{stdio:'ignore'});

const sleep = ms => new Promise(r => setTimeout(r, ms));
let ver;
for (let i=0;i<60;i++){ try { ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); break; } catch { await sleep(250); } }
if(!ver) { chrome.kill(); throw new Error('chrome did not start'); }

let id = 0;
function conn(url){
  const ws = new WebSocket(url); const pend = new Map();
  const ready = new Promise(r => ws.onopen = r);
  ws.onmessage = e => { const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
  return { ready, ws,
    send: (method, params={}) => new Promise(res => { const i = ++id;
      pend.set(i, m => res(m.error ? Promise.reject(new Error(JSON.stringify(m.error))) : m.result));
      ws.send(JSON.stringify({id:i, method, params})); }) };
}

const FIT = `(async () => {
  await document.fonts.ready;
  const H=${H}, r=document.documentElement;
  const deepest=()=>{let m=0;document.querySelectorAll('body *').forEach(e=>{
    if(e.closest('[data-decor]'))return;               // decorative art bleeds by design
    const b=e.getBoundingClientRect();
    if(b.height>0&&b.width>0)m=Math.max(m,b.bottom);});return Math.ceil(m);};
  const cs=()=>getComputedStyle(r);
  let tx=parseFloat(cs().getPropertyValue('--tx'))||26, pd=parseFloat(cs().getPropertyValue('--pad'))||20, g=0;
  const set=()=>{r.style.setProperty('--tx',tx.toFixed(2)+'px');
                 r.style.setProperty('--pad',Math.max(pd,3).toFixed(2)+'px');};
  // grow into unused canvas first, then shrink back until it fits
  while(deepest()<H-8 && g++<250 && tx<34){ tx+=0.3; pd+=0.28; set(); }
  while(deepest()>H   && g++<500 && tx>11){ tx-=0.3; pd-=0.28; set(); }
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  return JSON.stringify({bottom:deepest(), tx:+tx.toFixed(1), fits:deepest()<=H});
})()`;

let bad = 0;
for (const f of files) {
  const t = await (await fetch(`http://127.0.0.1:${port}/json/new?file://${process.cwd()}/${f}.html`,{method:'PUT'})).json();
  const c = conn(t.webSocketDebuggerUrl); await c.ready;
  await c.send('Page.enable');
  await c.send('Emulation.setDeviceMetricsOverride',{width:W,height:H,deviceScaleFactor:DSF,mobile:false});
  await c.send('Page.navigate',{url:`file://${process.cwd()}/${f}.html`});
  await sleep(1800);
  const r = await c.send('Runtime.evaluate',{expression:FIT, awaitPromise:true, returnByValue:true});
  const info = JSON.parse(r.result.value);
  const shot = await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  writeFileSync(`${f}.png`, Buffer.from(shot.data,'base64'));
  console.log(`${info.fits?'OK  ':'FAIL'} ${f}  bottom=${info.bottom}  tx=${info.tx}`);
  if(!info.fits) bad++;
  await fetch(`http://127.0.0.1:${port}/json/close/${t.id}`); c.ws.close();
}
chrome.kill();
process.exit(bad ? 1 : 0);
