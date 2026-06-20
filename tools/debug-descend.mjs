// debug-descend.mjs — repro del bug "piso 2 en negro": fuerza descend() y
// reporta errores de consola + escena activa.
import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
const page = await browser.newPage();
await page.setViewport({ width: 480, height: 360 });
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + (e.stack || e.message)));
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 2500));

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const press = async (k, h = 90) => { await page.keyboard.down(k); await sleep(h); await page.keyboard.up(k); };

await press('Enter'); await sleep(800);                  // título → intro
await press('Enter'); await sleep(400);                  // hola
for (let i = 0; i < 9; i++) { await press('Enter'); await sleep(380); }
await press('Enter'); await sleep(800);                  // aceptar inicial
await press('Enter'); await sleep(800);                  // elegir entrenador
await press('KeyC'); await sleep(1400);                  // saltar historia → piso 1

const r1 = await page.evaluate(() => {
  const g = window.__GAME;
  const f = g.scene.getScene('Floor');
  return { active: g.scene.scenes.filter(s => s.scene.isActive()).map(s => s.scene.key).join(','), floor: f?.floorNum };
});
console.log('antes:', JSON.stringify(r1));

await page.evaluate(() => window.__GAME.scene.getScene('Floor').descend());
await sleep(2000);
const r2 = await page.evaluate(() => {
  const g = window.__GAME;
  const f = g.scene.getScene('Floor');
  return { active: g.scene.scenes.filter(s => s.scene.isActive()).map(s => s.scene.key).join(','), floor: f?.floorNum, visible: f?.scene.isVisible() };
});
console.log('después:', JSON.stringify(r2));
await page.screenshot({ path: 'assets/_preview/debug_floor2.png' });
console.log(errs.length ? '❌ errores:\n' + errs.slice(0, 10).join('\n') : '✅ sin errores de consola');
await browser.close();
