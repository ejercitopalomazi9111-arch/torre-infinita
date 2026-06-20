// debug-charselect.mjs — diagnóstico puntual: ¿por qué Enter no elige entrenador?
import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
const page = await browser.newPage();
await page.setViewport({ width: 480, height: 360 });
page.on('console', (m) => console.log('[page]', m.text()));
page.on('pageerror', (e) => console.log('[PAGEERROR]', e.message));

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
await page.evaluate(() => {
  window.addEventListener('keydown', (e) => console.log('DOM keydown:', e.key, e.keyCode));
});
await new Promise(r => setTimeout(r, 2500));

const scenes = () => page.evaluate(() => {
  const g = window.__GAME || Phaser?.GAMES?.[0] || null;
  if (!g) return 'no game handle';
  return g.scene.scenes.filter(s => s.scene.isActive()).map(s => s.scene.key).join(',');
});

console.log('escenas activas (boot):', await scenes());
await page.keyboard.press('Enter');
await new Promise(r => setTimeout(r, 1000));
console.log('escenas tras Enter#1:', await scenes());

// mantener Enter pulsado y mirar el estado interno de la tecla START
await page.keyboard.down('Enter');
await new Promise(r => setTimeout(r, 400));
const state = await page.evaluate(() => {
  const sc = window.__GAME.scene.getScene('CharacterSelect');
  const k = sc.gba.keys.START[0];
  return {
    sceneActive: sc.scene.isActive(),
    kbEnabled: sc.input.keyboard.enabled,
    inputEnabled: sc.input.enabled,
    keyCode: k.keyCode, isDown: k.isDown, enabled: k.enabled,
    sel: sc.sel,
    updateRuns: (() => { sc.__tick = 0; const old = sc.update.bind(sc); return 'patched-no'; })(),
  };
});
console.log('estado tecla START con Enter mantenido:', JSON.stringify(state, null, 1));
await page.keyboard.up('Enter');
await new Promise(r => setTimeout(r, 800));
console.log('escenas tras Enter mantenido:', await scenes());

await browser.close();
