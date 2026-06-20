import puppeteer from 'puppeteer';
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--disable-gpu'] });
const p = await b.newPage(); await p.setViewport({ width: 672, height: 360 });
const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
await p.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 30000 });
const sleep = ms => new Promise(r=>setTimeout(r,ms));
await sleep(3000);
await p.evaluate(() => { localStorage.setItem('torre_infinita_hasplayed','1'); localStorage.setItem('torre_infinita_meta', JSON.stringify({points:340,perks:{wallet:2,bond:1}})); });
await p.evaluate(() => window.__GAME.scene.start('MainMenu'));
await sleep(1200);
// bajar a MEJORAS (Nueva/Cargar/Repeticiones/MEJORAS) = 3 abajo
for (let i=0;i<3;i++){ await p.keyboard.down('ArrowDown'); await sleep(70); await p.keyboard.up('ArrowDown'); }
await p.keyboard.down('Enter'); await sleep(70); await p.keyboard.up('Enter'); await sleep(700);
await p.screenshot({ path: 'assets/_preview/debug_perks.png' });
console.log(errs.length?'ERR:'+errs.slice(0,3).join(' | '):'sin errores');
await b.close();
