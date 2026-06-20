// debug-town.mjs — verifica que un PUEBLO (piso seguro /5) renderice sin errores.
import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
const page = await browser.newPage();
await page.setViewport({ width: 672, height: 360 });
const errs = [];
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', e => errs.push('PAGEERROR: ' + (e.stack || e.message)));
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 30000 });
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
// forzar piso 5 (pueblo) reusando el run actual
const r = await page.evaluate(() => {
  const f = window.__GAME.scene.getScene('Floor');
  try { f.scene.restart({ seed: f.seedBase, floor: 5 }); return 'restart ok'; }
  catch (e) { return 'THROW: ' + (e.stack || e.message); }
});
console.log('restart→piso5:', r);
await sleep(2500);
const info = await page.evaluate(() => {
  const f = window.__GAME.scene.getScene('Floor');
  return { floor: f.floorNum, safe: f.floor?.isSafeFloor, biome: f.biome?.id, npcs: f.npcs?.length, active: f.scene.isActive() };
});
console.log('estado:', JSON.stringify(info));
await page.screenshot({ path: 'assets/_preview/debug_town.png' });
console.log(errs.length ? '❌ errores:\n' + errs.slice(0, 8).join('\n') : '✅ sin errores de consola');
await browser.close();
