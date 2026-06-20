import puppeteer from 'puppeteer';
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--disable-gpu'] });
const p = await b.newPage(); await p.setViewport({ width: 672, height: 360 });
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:4173/', { waitUntil: 'domcontentloaded', timeout: 30000 });
const sleep = ms => new Promise(r=>setTimeout(r,ms));
for (let i=0;i<10;i++){ await sleep(1500); const a=await p.evaluate(()=>window.__GAME?.scene.scenes.filter(s=>s.scene.isActive()).map(s=>s.scene.key).join(',')||''); if (a.includes('Title')||a.includes('MainMenu')) break; }
await p.screenshot({ path: 'assets/_preview/debug_dist.png' });
console.log('dist render OK · errores:', errs.length);
await b.close();
