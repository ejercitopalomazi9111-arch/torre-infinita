// debug-center.mjs — repro del crash al usar el servicio del Centro (love/heal ball).
import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
const page = await browser.newPage();
await page.setViewport({ width: 672, height: 360 });
const errs = [];
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', e => errs.push('PAGEERROR: ' + (e.stack || e.message)));
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2', timeout: 30000 });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const press = async (k, h = 90) => { await page.keyboard.down(k); await sleep(h); await page.keyboard.up(k); };
await sleep(2500);
await press('Enter'); await sleep(900);
await press('Enter'); await sleep(500);
for (let i = 0; i < 9; i++) { await press('Enter'); await sleep(420); }
await press('Enter'); await sleep(900);
await press('ArrowRight'); await sleep(350);
await press('Enter'); await sleep(900);
await press('KeyC'); await sleep(1400);
const ready = await page.evaluate(() => { const f = window.__GAME?.scene.getScene('Floor'); return !!(f && f.floorNum && f.run); });
console.log('Floor listo:', ready);
const res = await page.evaluate(() => {
  const f = window.__GAME.scene.getScene('Floor');
  const out = [];
  // 1) ruta de curación REAL: daña party + pon correa (ejercita buildFollowers)
  try { f.run.party.forEach(m => { m.hp = 1; m.status = 'poison'; m.correa = true; }); f.useService('pokecenter'); out.push('heal+correa: ok'); }
  catch (e) { out.push('heal THROW: ' + (e.stack || e.message)); }
  // 2) descanso
  try { f.useService('rest'); out.push('rest: ok'); } catch (e) { out.push('rest THROW: ' + (e.stack || e.message)); }
  // 3) tienda
  try { f.useService('shop'); out.push('shop: ok'); } catch (e) { out.push('shop THROW: ' + (e.stack || e.message)); }
  // 4) PASO EXACTO sobre el marcador del centro (serviceTile + onTileStep)
  try { f.serviceTile = { type: 'pokecenter', c: f.col, r: f.row }; f.run.party.forEach(m => m.hp = 1); f.onTileStep(); out.push('onTileStep marker: ok'); }
  catch (e) { out.push('marker THROW: ' + (e.stack || e.message)); }
  return out.join(' | ');
});
console.log('servicios:', res);
await sleep(800);
console.log(errs.length ? '❌ errores:\n' + errs.slice(0, 8).join('\n') : '✅ sin errores de consola');
await browser.close();
