// godtest.mjs — CAZABUGS AUTOMÁTICO (Modo Dios). Lanza el juego headless, activa
// window.__GODTEST (IA invencible que explora TODAS las salas de cada piso a
// velocidad bestial) y desciende hasta un tope de pisos, registrando:
//   · errores/excepciones de consola (gate: 0)
//   · softlocks (un piso que no avanza en X ms)
//   · cobertura (pisos superados, salas visitadas, encuentros por tipo)
// Uso: node tools/godtest.mjs [floors] [url]
//   node tools/godtest.mjs              → 60 pisos en localhost:5173
//   node tools/godtest.mjs 200          → 200 pisos
//   node tools/godtest.mjs 100 http://localhost:4317/

import puppeteer from 'puppeteer';

const FLOORS = parseInt(process.argv[2] || '60', 10);
const TARGET = process.argv[3] || 'http://localhost:5173/';
const STALL_MS = 9000;       // sin avanzar de piso este tiempo = softlock
const HARD_TIMEOUT_MS = 8 * 60 * 1000;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
const page = await browser.newPage();
await page.setViewport({ width: 672, height: 360, deviceScaleFactor: 1 });

const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

console.log(`GODTEST — ${FLOORS} pisos · ${TARGET}`);
await page.goto(TARGET, { waitUntil: 'domcontentloaded', timeout: 30000 });

// esperar a que el juego BOOTEE (assets cargados → una escena no-Boot activa)
await page.waitForFunction(() => {
  const g = window.__GAME;
  return g && g.scene && g.scene.getScenes(true).some(s => s.scene.key !== 'Boot');
}, { timeout: 30000 });
await sleep(800);

// arrancar el tester
const ok = await page.evaluate(() => window.__GODTEST?.start({ floor: 1, speed: 200 }) === true);
if (!ok) { console.error('❌ No se pudo arrancar __GODTEST'); await browser.close(); process.exit(1); }

const softlocks = [];
let lastCleared = -1, lastChange = Date.now();
const t0 = Date.now();

while (true) {
  await sleep(300);
  const rep = await page.evaluate(() => window.__GODTEST?.report());
  if (!rep) { errors.push('REPORT nulo: el tester no expone __godreport'); break; }

  if (rep.floorsCleared !== lastCleared) { lastCleared = rep.floorsCleared; lastChange = Date.now(); }

  if (rep.floorsCleared >= FLOORS) { console.log(`  ✔ alcanzados ${rep.floorsCleared} pisos`); break; }

  if (Date.now() - lastChange > STALL_MS) {
    const snap = await page.evaluate(() => window.__GODTEST?.snapshot());
    softlocks.push({ floorsCleared: rep.floorsCleared, snap });
    console.error(`  ⚠ SOFTLOCK — snapshot: ${JSON.stringify(snap)}`);
    break;
  }
  if (Date.now() - t0 > HARD_TIMEOUT_MS) { console.error('  ⚠ timeout duro'); break; }
  if (errors.length > 30) { console.error('  ⚠ demasiados errores, abortando'); break; }
}

const rep = await page.evaluate(() => window.__GODTEST?.report()) || {};
const secs = ((Date.now() - t0) / 1000).toFixed(1);
await browser.close();

console.log('\n────────── REPORTE GODTEST ──────────');
console.log(`  Pisos superados:   ${rep.floorsCleared ?? 0} / ${FLOORS}   (último: piso ${rep.lastFloor ?? '?'})`);
console.log(`  Salas visitadas:   ${rep.roomsVisited ?? 0}`);
console.log(`  Encuentros:        ${rep.encounters ?? 0}  ${JSON.stringify(rep.byKind || {})}`);
console.log(`  Tiempo:            ${secs}s`);
console.log(`  Softlocks:         ${softlocks.length}`);
const boxed = rep.boxedIn || [];
console.log(`  Pisos encajonados: ${boxed.length}${boxed.length ? '  ' + JSON.stringify(boxed.slice(0, 8)) : ''}`);
console.log(`  Errores consola:   ${errors.length}`);
if (errors.length) { console.log('  ── errores ──'); for (const e of errors.slice(0, 25)) console.log('   ✗', e); }

const pass = errors.length === 0 && softlocks.length === 0 && (rep.floorsCleared ?? 0) >= FLOORS;
console.log(pass ? '\n✅ GODTEST OK — sin errores ni softlocks.' : '\n❌ GODTEST encontró problemas (ver arriba).');
process.exit(pass ? 0 : 1);
