import puppeteer from 'puppeteer';
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--disable-gpu'] });
const p = await b.newPage(); await p.setViewport({ width: 672, height: 360 });
const fails=[], errs=[];
p.on('requestfailed', r => fails.push(r.url().replace('http://localhost:4173','')+' '+(r.failure()?.errorText||'')));
p.on('response', r => { if (r.status()>=400) fails.push(r.status()+' '+r.url().replace('http://localhost:4173','')); });
p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
await p.goto('http://localhost:4173/', { waitUntil: 'domcontentloaded', timeout: 30000 });
const sleep = ms => new Promise(r=>setTimeout(r,ms));
let game=false;
for (let i=0;i<10;i++){ await sleep(1200); game = await p.evaluate(()=>!!window.__GAME); if (game) break; }
const scenes = await p.evaluate(()=>window.__GAME?.scene.scenes.filter(s=>s.scene.isActive()).map(s=>s.scene.key).join(',')||'none');
console.log('__GAME:', game, '· escenas:', scenes);
console.log('fallos red('+fails.length+'):', fails.slice(0,8).join(' | ')||'ninguno');
console.log('errores('+errs.length+'):', errs.slice(0,5).join(' | ')||'ninguno');
await b.close();
