import puppeteer from 'puppeteer';
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--disable-gpu'] });
const p = await b.newPage(); await p.setViewport({ width: 672, height: 360 });
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 30000 });
const sleep = ms => new Promise(r=>setTimeout(r,ms));
await sleep(3000);
await p.evaluate(() => localStorage.setItem('torre_infinita_hasplayed','1'));
await p.evaluate(() => window.__GAME.scene.start('MainMenu'));
await sleep(1200);
// Nueva partida (1ª opción) → elige ranura 1 → dificultad
await p.keyboard.down('Enter'); await sleep(80); await p.keyboard.up('Enter'); await sleep(500);
await p.keyboard.down('Enter'); await sleep(80); await p.keyboard.up('Enter'); await sleep(600);
await p.screenshot({ path: 'assets/_preview/debug_diff.png' });
console.log(errs.length?'ERR:'+errs.slice(0,3).join(' | '):'sin errores');
await b.close();
