// _cooptest.mjs — QA del modo CO-OP LOCAL. Arranca CoopScene headless, verifica que
// construye N jugadores + cámaras split-screen + portal + fauna, que un jugador se
// mueve por casillas, que pisar un Pokémon suma captura, y que con todos en el portal
// se desciende — todo sin errores de consola.
// Uso: node tools/_cooptest.mjs [url]   (requiere vite dev/preview corriendo)
import puppeteer from 'puppeteer';
const URL = process.argv[2] || 'http://localhost:5173/';
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
const p = await b.newPage();
await p.setViewport({ width: 672, height: 360, deviceScaleFactor: 1 });
const errors = [];
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
p.on('pageerror', (e) => errors.push(String(e)));
await p.goto(URL, { waitUntil: 'load', timeout: 30000 });
await p.waitForFunction(() => window.__GAME && window.__GAME.scene, { timeout: 20000 });

// arranca el co-op a 3 jugadores directamente
await p.evaluate(() => {
  const g = window.__GAME;
  ['Title', 'MainMenu', 'Floor', 'Battle', 'Hud'].forEach((k) => { try { g.scene.stop(k); } catch { /* */ } });
  g.scene.start('Coop', { players: 3, depth: 1, seed: 'cooptest' });
});
await new Promise((r) => setTimeout(r, 1500));

const built = await p.evaluate(() => {
  const s = window.__GAME.scene.getScene('Coop');
  if (!s || !s.scene.isActive()) return null;
  return { players: s.players.length, cams: s.pcams.length, roamers: s.roamers.length, items: s.items.length, hasPortal: !!s.portal };
});
console.log('co-op construido:', JSON.stringify(built));

// mueve a P1 unas casillas (teclas WASD) y confirma que cambió de celda
const before = await p.evaluate(() => { const s = window.__GAME.scene.getScene('Coop'); return { c: s.players[0].c, r: s.players[0].r }; });
for (let i = 0; i < 4; i++) {
  await p.keyboard.down('d'); await new Promise((r) => setTimeout(r, 180)); await p.keyboard.up('d');
  await new Promise((r) => setTimeout(r, 60));
}
const after = await p.evaluate(() => { const s = window.__GAME.scene.getScene('Coop'); return { c: s.players[0].c, r: s.players[0].r }; });
const moved = after.c !== before.c || after.r !== before.r;
console.log('P1 se movió:', moved, JSON.stringify(before), '→', JSON.stringify(after));

// captura: teletransporta un roamer junto a P1 y haz que lo pise
const caught = await p.evaluate(async () => {
  const s = window.__GAME.scene.getScene('Coop');
  const c0 = s.catches;
  // coloca un roamer en la celda de P1 y dispara afterStep (misma ruta que pisarlo)
  if (s.roamers.length) { s.roamers[0].c = s.players[0].c; s.roamers[0].r = s.players[0].r; s.afterStep(s.players[0]); }
  return { before: c0, after: s.catches };
});
console.log('captura suma:', caught.after > caught.before, JSON.stringify(caught));

// descenso: pon a TODOS en el portal y avanza un frame → debe entrar en transición
const descended = await p.evaluate(() => {
  const s = window.__GAME.scene.getScene('Coop');
  s.players.forEach((pl) => { pl.c = s.portal.c; pl.r = s.portal.r; pl.stepping = false; });
  s.update(0, 16);
  return s.transitioning === true;
});
console.log('descenso disparado:', descended);

await new Promise((r) => setTimeout(r, 800));
console.log('errores consola:', errors.length); errors.slice(0, 6).forEach((e) => console.log('  ✗', e));

const ok = built && built.players === 3 && built.cams === 3 && built.roamers > 0 && built.hasPortal
  && moved && caught.after > caught.before && descended && errors.length === 0;
console.log(ok ? '\n✅ CO-OP OK — 3 jugadores, split-screen, movimiento, captura y descenso; 0 errores.' : '\n❌ CO-OP falló.');
await b.close(); process.exit(ok ? 0 : 1);
