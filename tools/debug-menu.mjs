import puppeteer from 'puppeteer';
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--disable-gpu'] });
const p = await b.newPage(); await p.setViewport({ width: 672, height: 360 });
const errs = []; p.on('console', m => { if (m.type()==='error') errs.push(m.text()); }); p.on('pageerror', e => errs.push('PE:'+(e.stack||e.message)));
await p.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 30000 });
const sleep = ms => new Promise(r=>setTimeout(r,ms));
// simular que ya jugó + una partida guardada en ranura 0
await sleep(3000);
await p.evaluate(() => { localStorage.setItem('torre_infinita_hasplayed','1'); localStorage.setItem('torre_infinita_slot_0', JSON.stringify({run:{},floor:7,starter:4,trainer:{id:'red'},savedAt:Date.now()})); });
await p.evaluate(() => window.__GAME.scene.start('MainMenu'));
await sleep(1500);
await p.screenshot({ path: 'assets/_preview/debug_menu.png' });
// entrar a Ajustes
await p.keyboard.down('ArrowDown'); await sleep(80); await p.keyboard.up('ArrowDown');
await p.keyboard.down('ArrowDown'); await sleep(80); await p.keyboard.up('ArrowDown');
await p.keyboard.down('Enter'); await sleep(80); await p.keyboard.up('Enter'); await sleep(600);
await p.screenshot({ path: 'assets/_preview/debug_menu_settings.png' });
console.log(errs.length ? 'ERR:'+errs.slice(0,5).join(' | ') : 'sin errores');
await b.close();
