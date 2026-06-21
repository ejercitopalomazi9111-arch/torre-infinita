// _touchtest.mjs — QA de los controles táctiles. Verifica que el overlay se
// monta y que pulsar un botón despacha el KeyboardEvent correcto en window.
// Uso: node tools/_touchtest.mjs [url]
import puppeteer from 'puppeteer';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const TARGET = (process.argv[2] || 'http://localhost:5173/') + (/\?/.test(process.argv[2] || '') ? '' : '?touch=1');
const OUT = fileURLToPath(new URL('../assets/_preview/', import.meta.url));
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
const page = await browser.newPage();
await page.setViewport({ width: 720, height: 360, deviceScaleFactor: 2 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(TARGET, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForFunction(() => window.__TOUCH && document.getElementById('ti-touch'), { timeout: 20000 });

// nº de botones del overlay
const nBtns = await page.$$eval('#ti-touch .ti-tbtn', (els) => els.length);
console.log('botones del overlay táctil:', nBtns);

// instala un espía de teclado y simula pulsar el D-pad ABAJO (▼ = ArrowDown)
await page.evaluate(() => {
  window.__lastKey = null;
  window.addEventListener('keydown', (e) => { window.__lastKey = e.key; }, true);
});
const downBtn = await page.evaluateHandle(() => [...document.querySelectorAll('#ti-touch .ti-tbtn')].find(b => b.textContent === '▼'));
const box = await downBtn.asElement().boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await new Promise(r => setTimeout(r, 120));
await page.mouse.up();
const lastKey = await page.evaluate(() => window.__lastKey);
console.log('tecla despachada al pulsar ▼:', lastKey);

await page.screenshot({ path: OUT + 'touch_overlay.png' });
console.log('  → touch_overlay.png');

let ok = nBtns >= 8 && lastKey === 'ArrowDown' && errors.length === 0;
if (errors.length) { console.log('errores de consola:'); errors.slice(0, 5).forEach(e => console.log('  ✗ ' + e)); }
console.log(ok ? '\n✅ TOUCH OK — overlay montado, botones despachan teclas, 0 errores.' : '\n❌ TOUCH falló.');
await browser.close();
process.exit(ok ? 0 : 1);
