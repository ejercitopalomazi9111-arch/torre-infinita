import puppeteer from 'puppeteer';
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--disable-gpu'] });
const p = await b.newPage(); await p.setViewport({ width: 672, height: 360 });
await p.goto('http://localhost:4173/', { waitUntil: 'domcontentloaded', timeout: 30000 });
const sleep = ms => new Promise(r=>setTimeout(r,ms));
for (let i=0;i<10;i++){ await sleep(2000);
  const s = await p.evaluate(()=>{const g=window.__GAME;const bs=g?.scene.getScene('Boot');return { boot: bs?.sys?.settings?.status, active: g?.scene.scenes.filter(x=>x.scene.isActive()).map(x=>x.scene.key).join(',')||'-', prog: bs?.load?.progress?.toFixed(2) };});
  console.log(`${(i+1)*2}s`, JSON.stringify(s));
  if (s.active && s.active!=='-' && s.active!=='Boot,Hud' && !s.active.startsWith('Boot')) break;
}
await p.screenshot({ path: 'assets/_preview/debug_dist.png' });
await b.close();
