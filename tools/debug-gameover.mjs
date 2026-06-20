import puppeteer from 'puppeteer';
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--disable-gpu'] });
const p = await b.newPage(); await p.setViewport({ width: 672, height: 360 });
const errs=[]; p.on('pageerror', e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
await p.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 30000 });
const sleep = ms => new Promise(r=>setTimeout(r,ms));
await sleep(3000);
await p.evaluate(() => {
  const g = window.__GAME;
  g.registry.set('run', { wins: 17, dex: { caught: [1,4,7,25,133], seen: [] }, party: [{name:'Charizard',level:38},{name:'Gyarados',level:31}], box: [{name:'Snorlax',level:40}] });
  g.scene.start('GameOver', { floorReached: 23 });
});
await sleep(3500);
await p.screenshot({ path: 'assets/_preview/debug_gameover.png' });
console.log(errs.length ? 'ERR:'+errs.slice(0,4).join(' | ') : 'sin errores');
await b.close();
