import puppeteer from 'puppeteer';
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--disable-gpu'] });
const p = await b.newPage(); await p.setViewport({ width: 672, height: 360 });
const logs=[]; p.on('console',m=>logs.push(m.type()[0]+':'+m.text().slice(0,80)));
await p.goto('http://localhost:4173/', { waitUntil: 'domcontentloaded', timeout: 30000 });
const sleep = ms => new Promise(r=>setTimeout(r,ms));
await sleep(6000);
const dump = await p.evaluate(() => {
  const g = window.__GAME; if (!g) return 'no game';
  return g.scene.scenes.map(s => s.scene.key + ':' + (s.sys?.settings?.status ?? '?')).join(', ');
});
console.log('escenas/estado:', dump);
// ¿el Boot cargó assets? progreso
const prog = await p.evaluate(() => { try { return 'cache mon_1: ' + window.__GAME.textures.exists('mon_1'); } catch(e){ return 'err '+e.message; } });
console.log(prog);
console.log('logs:', logs.slice(-8).join(' || '));
await b.close();
