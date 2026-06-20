// debug-team.mjs — prueba el menú EQUIPO (correa/objeto/disco/PC). Requiere vite dev.
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
await press('Enter'); await sleep(800);            // intro
await press('Enter'); await sleep(400);
for (let i = 0; i < 9; i++) { await press('Enter'); await sleep(350); }  // quiz
await press('Enter'); await sleep(800);            // acepto
await press('Enter'); await sleep(800);            // charselect confirm
await press('KeyC'); await sleep(1300);            // saltar historia → floor
// abrir EQUIPO (T)
await press('KeyT'); await sleep(500);
await page.screenshot({ path: OUT + 'team_list.png' }); console.log('  → team_list.png');
await press('Enter'); await sleep(400);             // acción del primer mon
await page.screenshot({ path: OUT + 'team_action.png' }); console.log('  → team_action.png');
await press('Enter'); await sleep(400);             // toggle correa
await press('ArrowDown'); await sleep(150);
await press('Enter'); await sleep(400);             // equipar objeto → picker
await page.screenshot({ path: OUT + 'team_pickitem.png' }); console.log('  → team_pickitem.png');
await press('Enter'); await sleep(400);             // equipar primero
await page.screenshot({ path: OUT + 'team_action2.png' }); console.log('  → team_action2.png');
// volver a lista y abrir PC
await press('KeyX'); await sleep(300);              // atrás a lista
for (let i = 0; i < 3; i++) { await press('ArrowDown'); await sleep(120); }  // bajar a PC
await press('Enter'); await sleep(500);
await page.screenshot({ path: OUT + 'team_pc.png' }); console.log('  → team_pc.png');
await browser.close();
if (errors.length) { console.error(`\n❌ ${errors.length} errores:`); errors.slice(0, 15).forEach(e => console.error('  ✗', e)); process.exit(1); }
else console.log('\n✅ DEBUG-TEAM OK — 0 errores.');
