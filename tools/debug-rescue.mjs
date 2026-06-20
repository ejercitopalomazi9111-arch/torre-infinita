// debug-rescue.mjs — prueba el RESCATE DEL PC (todo el equipo cae + hay Pokémon
// en la caja → uno sale, te protege y se une). Requiere vite dev en :5173.
import puppeteer from 'puppeteer';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const OUT = fileURLToPath(new URL('../assets/_preview/', import.meta.url));
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
const page = await browser.newPage();
await page.setViewport({ width: 480, height: 360, deviceScaleFactor: 2 });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
const press = async (k, hold = 100) => { await page.keyboard.down(k); await sleep(hold); await page.keyboard.up(k); };
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2', timeout: 30000 });
await sleep(2500);
await press('Enter'); await sleep(800);
await press('Enter'); await sleep(400);
for (let i = 0; i < 9; i++) { await press('Enter'); await sleep(300); }
await press('Enter'); await sleep(800);
await press('Enter'); await sleep(800);
await press('KeyC'); await sleep(1300);            // → floor
// forzar un encuentro (tecla F) y esperar a que cargue el combate
await press('KeyF'); await sleep(3000);

const before = await page.evaluate(() => {
  const b = window.__GAME.scene.getScene('Battle');
  if (!b || !b.scene.isActive()) return { err: 'Battle no activo' };
  // inyecta un Pokémon en la caja (clona el inicial) y dispara el rescate
  const c = structuredClone(b.run.party[0]);
  c.hp = 0; c.maxhp = c.maxhp || 20;
  b.run.box.push(c);
  const partyLen = b.run.party.length, boxLen = b.run.box.length;
  b.pcRescue();
  return { partyLen, boxLen };
});
console.log('  antes:', JSON.stringify(before));
await page.screenshot({ path: OUT + 'rescue_mid.png' }); console.log('  → rescue_mid.png');
await sleep(7000);   // dejar correr toda la cinemática + fade + resume

const after = await page.evaluate(() => {
  const f = window.__GAME.scene.getScene('Floor');
  const b = window.__GAME.scene.getScene('Battle');
  return {
    floorActive: f?.scene.isActive() || false,
    battleActive: b?.scene.isActive() || false,
    partyLen: f?.run?.party?.length ?? -1,
    boxLen: f?.run?.box?.length ?? -1,
  };
});
console.log('  después:', JSON.stringify(after));
await page.screenshot({ path: OUT + 'rescue_floor.png' }); console.log('  → rescue_floor.png');
await browser.close();

let bad = false;
if (errors.length) { console.error(`\n❌ ${errors.length} errores:`); errors.slice(0, 15).forEach(e => console.error('  ✗', e)); bad = true; }
if (!after.floorActive) { console.error('❌ no volvió al piso tras el rescate'); bad = true; }
if (after.partyLen <= (before.partyLen || 0)) { console.error('❌ el rescatado no se unió al equipo'); bad = true; }
if (bad) process.exit(1);
console.log('\n✅ DEBUG-RESCUE OK — el Pokémon del PC te rescató y se unió al equipo.');
