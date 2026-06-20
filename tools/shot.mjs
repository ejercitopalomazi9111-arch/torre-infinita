// shot.mjs — QA visual del juego REAL (sección A). Lanza Chromium headless,
// abre el juego servido por Vite, navega a pantallas y captura PNG que se
// revisan con la vista. Reporta errores de consola (gate: 0 errores).
// Uso: node tools/shot.mjs            (requiere vite dev en localhost:5173)
//      node tools/shot.mjs <url>

import puppeteer from 'puppeteer';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const TARGET = process.argv[2] || 'http://localhost:5173/';
const OUT = fileURLToPath(new URL('../assets/_preview/', import.meta.url));
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
const page = await browser.newPage();
await page.setViewport({ width: 480, height: 360, deviceScaleFactor: 2 });

const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

// pulsación SOSTENIDA (~100ms): en headless el frame rate baja y una pulsación
// instantánea (down+up en el mismo frame) puede perderse para el polling de Phaser
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const press = async (key, hold = 100) => { await page.keyboard.down(key); await sleep(hold); await page.keyboard.up(key); };

console.log('SHOT — abriendo', TARGET);
await page.goto(TARGET, { waitUntil: 'domcontentloaded', timeout: 30000 });
await sleep(2500); // fuentes + boot + carga de sprites

await page.screenshot({ path: OUT + 'game_title.png' });
console.log('  → game_title.png');

// título → ENTREVISTA del Gurú (estilo Mundo Misterioso)
await press('Enter');
await sleep(900);
await page.screenshot({ path: OUT + 'game_intro.png' });
console.log('  → game_intro.png (Gurú Xatu)');
await press('Enter');                       // "Estoy listo."
await sleep(500);
for (let i = 0; i < 9; i++) {               // 9 preguntas (primera opción)
  await press('Enter');
  await sleep(420);
}
for (let i = 0; i < 12; i++) {              // tutorial del Gurú (1ª partida): Continuar
  await press('Enter');
  await sleep(280);
}
await page.screenshot({ path: OUT + 'game_starter.png' });
console.log('  → game_starter.png (oferta de inicial)');
await press('Enter');                       // ¡Acepto!
await sleep(900);

// CARRUSEL de entrenador (sugerido preseleccionado)
await page.screenshot({ path: OUT + 'game_charselect.png' });
console.log('  → game_charselect.png');
await press('ArrowRight');
await sleep(350);
await press('Enter');
await sleep(900);

// INTRO NARRATIVA (picnic) → captura y saltar con Select (C)
await page.screenshot({ path: OUT + 'game_story.png' });
console.log('  → game_story.png (picnic del bosque)');
await press('KeyC');
await sleep(1300);
await page.screenshot({ path: OUT + 'game_floor.png' });
console.log('  → game_floor.png');

// caminar un poco para probar movimiento/seguidor
await page.keyboard.down('ArrowRight');
await sleep(500);
await page.keyboard.up('ArrowRight');
await page.keyboard.down('ArrowDown');
await sleep(350);
await page.keyboard.up('ArrowDown');
await sleep(200);
await page.screenshot({ path: OUT + 'game_floor_walk.png' });
console.log('  → game_floor_walk.png');

// MOCHILA en el overworld (M abre, X cierra)
await press('KeyM');
await sleep(450);
await page.screenshot({ path: OUT + 'game_bag.png' });
console.log('  → game_bag.png (mochila overworld)');
await press('KeyX');
await sleep(350);

// forzar un combate (tecla F) y capturar el menú principal
await press('KeyF');
await sleep(1700);
await page.screenshot({ path: OUT + 'game_battle.png' });
console.log('  → game_battle.png (menú: Luchar/Mochila/Pokémon/Huir)');

// LUCHAR (1) → primer movimiento (1) y capturar la animación
await press('Digit1');
await sleep(350);
await press('Digit1');
await sleep(1100);
await page.screenshot({ path: OUT + 'game_battle_move.png' });
console.log('  → game_battle_move.png');

// llevar el combate hasta el final (Luchar→mov por turno) → guarda grabación
for (let i = 0; i < 10; i++) {
  await press('Digit1'); await sleep(360);
  await press('Digit1'); await sleep(1250);
}
await sleep(1400); // volver al piso

// Pokédex (tecla P)
await press('KeyP');
await sleep(800);
await page.screenshot({ path: OUT + 'game_pokedex.png' });
console.log('  → game_pokedex.png');

// pestaña REPETICIONES (E) y reproducir (Enter) en modo retransmisión
await press('KeyE');
await sleep(500);
await page.screenshot({ path: OUT + 'game_recordings.png' });
console.log('  → game_recordings.png');
await press('Enter');
await sleep(2600);
await page.screenshot({ path: OUT + 'game_replay.png' });
console.log('  → game_replay.png (modo retransmisión)');

await browser.close();

if (errors.length) {
  console.error(`\n❌ ${errors.length} error(es) de consola:`);
  for (const e of errors.slice(0, 20)) console.error('  ✗', e);
  process.exit(1);
} else {
  console.log('\n✅ SHOT OK — 0 errores de consola.');
}
