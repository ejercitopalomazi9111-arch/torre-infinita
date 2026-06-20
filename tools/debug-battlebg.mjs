import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
const page = await browser.newPage();
await page.setViewport({ width: 672, height: 360 });
const errs = [];
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', e => errs.push('PE: ' + (e.stack || e.message)));
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 30000 });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const press = async (k, h = 90) => { await page.keyboard.down(k); await sleep(h); await page.keyboard.up(k); };
const onFloor = () => page.evaluate(() => { const f = window.__GAME?.scene.getScene('Floor'); return !!(f && f.floorNum && f.run); });
await sleep(2500);
await press('Enter'); await sleep(900); await press('Enter'); await sleep(500);
// avanzar el quiz: pulsa Enter hasta que aparezca el carrusel/floor o se acaben
for (let i = 0; i < 16 && !(await onFloor()); i++) { await press('Enter'); await sleep(350); await press('ArrowRight'); await sleep(120); }
// saltar historia si está
for (let i = 0; i < 6 && !(await onFloor()); i++) { await press('KeyC'); await sleep(500); }
const ready = await onFloor();
console.log('floor listo:', ready);
if (ready) {
  const r = await page.evaluate(() => { const f = window.__GAME.scene.getScene('Floor'); f.run.wins = 5; f.startEncounter(true); return 'biome=' + f.biome.id; });
  console.log(r); await sleep(2600);
  await page.screenshot({ path: 'assets/_preview/debug_battlebg.png' });
}
console.log(errs.length ? 'ERR: ' + errs.slice(0,5).join(' | ') : 'sin errores');
await browser.close();
