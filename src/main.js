// main.js — Punto de entrada. Config de Phaser + registro de escenas.
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { TitleScene } from './scenes/TitleScene.js';
import { FloorScene } from './scenes/FloorScene.js';
import { BattleScene } from './scenes/BattleScene.js';
import { PokedexScene } from './scenes/PokedexScene.js';
import { GameOverScene } from './scenes/GameOverScene.js';
import { CharacterSelectScene } from './scenes/CharacterSelectScene.js';
import { IntroScene } from './scenes/IntroScene.js';
import { TutorialScene } from './scenes/TutorialScene.js';
import { StoryScene } from './scenes/StoryScene.js';
import { HudScene } from './scenes/HudScene.js';
import { InteriorScene } from './scenes/InteriorScene.js';
import { MainMenuScene } from './scenes/MainMenuScene.js';
import { CoopScene } from './scenes/CoopScene.js';
import { OnlineScene } from './scenes/OnlineScene.js';
import { PvpScene } from './scenes/PvpScene.js';
import { Net } from './systems/net.js';
import { initTouchControls } from './systems/touch.js';

// VIEW = área LÓGICA de juego (cada escena la usa para su layout interno).
export const VIEW = { w: 480, h: 360 };
// El canvas es más ancho: el juego de 480 va CENTRADO y a los lados quedan los
// paneles del HUD lateral (equipo Nuzlocke + cabina arcade), estilo dashboard.
export const HUD = { margin: 96 };
export const CANVAS = { w: VIEW.w + HUD.margin * 2, h: VIEW.h };

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: CANVAS.w,
  height: CANVAS.h,
  pixelArt: true,            // sin blur: pixel-perfect (sección C)
  roundPixels: true,
  backgroundColor: '#05060a',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: 'arcade', arcade: { debug: false } },
  input: { gamepad: true },   // control PS4/DualShock (y cualquier gamepad estándar)
  // HudScene va al final → se renderiza POR ENCIMA (overlay persistente).
  scene: [BootScene, TitleScene, MainMenuScene, IntroScene, CharacterSelectScene, TutorialScene, StoryScene, FloorScene, BattleScene, PokedexScene, GameOverScene, InteriorScene, CoopScene, OnlineScene, PvpScene, HudScene],
};

/** Confina la cámara de una escena al área central de juego (deja los márgenes
 *  del canvas para el HUD lateral). Llamar al INICIO de create(). */
export function frameCamera(scene) {
  scene.cameras.main.setViewport(HUD.margin, 0, VIEW.w, VIEW.h);
}

// handle global para QA (tools/shot.mjs y debug)
window.__GAME = new Phaser.Game(config);
window.Net = Net;   // expuesto para QA del transporte P2P y debug
initTouchControls();   // mando táctil en pantallas de teléfono (auto) / ?touch=1

// ---------------------------------------------------------------------------
// MODO DIOS / TESTER AUTOMÁTICO — control externo para el cazabugs (tools/godtest.mjs)
// y para el menú DEBUG del Código Konami. Arranca una partida directa e invencible
// que explora TODAS las salas de cada piso a velocidad bestial, registrando errores.
// ---------------------------------------------------------------------------
window.__GODTEST = {
  /** Arranca el tester desde el piso indicado. opts: { floor, starter, speed }. */
  start(opts = {}) {
    const g = window.__GAME, reg = g.registry;
    const floor = opts.floor || 1;
    reg.set('starter', opts.starter || 25);     // Pikachu por defecto
    reg.remove('run');                          // partida nueva y limpia
    reg.set('godtest', true);
    reg.set('autoplay', true);
    reg.set('godspeed', opts.speed || 200);     // pasos por frame
    window.__godreport = { floorsCleared: 0, encounters: 0, byKind: {}, roomsVisited: 0, softlocks: [], startFloor: floor, lastFloor: floor, startedAt: Date.now() };
    // detén cualquier escena activa y entra directo al piso
    for (const s of g.scene.getScenes(true).slice()) g.scene.stop(s.scene.key);
    g.scene.start('Floor', { floor });
    return true;
  },
  stop() { const r = window.__GAME.registry; r.set('godtest', false); r.set('autoplay', false); },
  setSpeed(n) { window.__GAME.registry.set('godspeed', Math.max(1, n | 0)); },
  report() { return window.__godreport || null; },
  reset() { window.__godreport = { floorsCleared: 0, encounters: 0, byKind: {}, roomsVisited: 0, softlocks: [], boxedIn: [], startedAt: Date.now() }; },
  /** Radiografía del piso ACTIVO (para diagnosticar softlocks). */
  snapshot() {
    const g = window.__GAME;
    const fs = g.scene.getScene('Floor');
    if (!fs || !fs.floor) return { error: 'sin Floor activo' };
    const f = fs.floor;
    return {
      floorNum: fs.floorNum, biome: f.biome?.id, isSafeFloor: !!f.isSafeFloor, isBossFloor: !!f.isBossFloor,
      rooms: f.roomById.size, visited: fs.visited.size, currentRoom: fs.currentRoomId,
      exitId: f.exitId, exitVisited: fs.visited.has(f.exitId),
      holeTile: fs.holeTile, giveUpExplore: !!fs.giveUpExplore, exploreStall: fs.exploreStall, floorSteps: fs.floorSteps,
      pos: { c: fs.col, r: fs.row }, stepping: !!fs.stepping, transitioning: !!fs.transitioning,
      allRoomsVisited: fs.allRoomsVisited ? fs.allRoomsVisited() : null,
      nextDoorDir: fs.nextDoorDir ? fs.nextDoorDir() : null,
      nextUnvisitedDoorDir: fs.nextUnvisitedDoorDir ? fs.nextUnvisitedDoorDir() : null,
      trail: (window.__godtrail || []).slice(-24),
      unvisitedRooms: [...fs.floor.roomById.keys()].filter(id => !fs.visited.has(id)),
      doors: (f.roomById.get(fs.currentRoomId)?.doors || []).map(d => {
        const T = { N: { c: 7, r: 0 }, S: { c: 7, r: 10 }, W: { c: 0, r: 5 }, E: { c: 14, r: 5 } }[d.dir];
        const reach = fs.botPathDir ? !!fs.botPathDir(T) : null;
        return { dir: d.dir, to: d.to, borderWalk: fs.isBorderDoor(T.c, T.r), reach };
      }),
    };
  },
};

// ---------------------------------------------------------------------------
// CONSOLA DEBUG (Código Konami) — cheats para probar el juego: dar Pokémon por
// nombre/nivel/stats, curar, subir nivel, revelar mapa, dinero, warp, y control de
// la IA / Modo Dios. Puente window.__DEBUG → métodos de la escena Floor activa.
// ---------------------------------------------------------------------------
function _floor() { const fs = window.__GAME.scene.getScene('Floor'); return (fs && fs.sys.isActive() && fs.run) ? fs : null; }
window.__DEBUG = {
  give(name, level, stats) { return _floor()?.dbgGive(name, level, stats) ?? console.warn('DEBUG: entra a un piso primero'); },
  heal() { _floor()?.dbgHeal(); },
  level(n = 1) { _floor()?.dbgLevel(n); },
  warp(fl) { _floor()?.dbgWarp(fl); },
  money(n = 5000) { _floor()?.dbgMoney(n); },
  item(k, q = 10) { _floor()?.dbgItem(k, q); },
  reveal() { _floor()?.dbgReveal(); },
  god(on) { const r = window.__GAME.registry; if (on === undefined) on = !r.get('godtest'); r.set('godtest', on); r.set('autoplay', on); return on; },
  ai(on) { const r = window.__GAME.registry; if (on === undefined) on = !r.get('autoplay'); r.set('autoplay', on); return on; },
  speed(n) { window.__GAME.registry.set('godspeed', Math.max(1, n | 0)); return n; },
  save() { _floor()?.dbgSave(); },
  resetDefaults() {
    const r = window.__GAME.registry;
    r.set('godtest', false); r.set('autoplay', false); r.set('godspeed', 200);
    _floor()?.dbgResetNote();
  },
};

// --- panel HTML (se inyecta una vez) ---
function buildDebugPanel() {
  if (document.getElementById('dbg-panel')) return document.getElementById('dbg-panel');
  const css = document.createElement('style');
  css.textContent = `
    #dbg-panel{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:99999;display:none;
      width:340px;max-height:88vh;overflow:auto;background:#0b0e16f2;border:2px solid #ffd76a;border-radius:8px;
      padding:14px;font-family:'Press Start 2P',monospace;color:#e8f0ff;box-shadow:0 0 40px #000c}
    #dbg-panel h3{color:#ffd76a;font-size:11px;margin:0 0 8px}
    #dbg-panel h4{color:#54e0c8;font-size:8px;margin:12px 0 6px;border-bottom:1px solid #2a3350;padding-bottom:3px}
    #dbg-panel button{font-family:inherit;font-size:7px;background:#1a2030;color:#e8f0ff;border:1px solid #3a4566;
      border-radius:4px;padding:6px 7px;margin:2px;cursor:pointer}
    #dbg-panel button:hover{background:#2a3550;border-color:#ffd76a;color:#ffd76a}
    #dbg-panel input{font-family:inherit;font-size:7px;background:#05060a;color:#ffd76a;border:1px solid #3a4566;
      border-radius:3px;padding:4px;width:100%;margin:2px 0;box-sizing:border-box}
    #dbg-panel .row{display:flex;gap:4px;align-items:center}
    #dbg-panel .grid6{display:grid;grid-template-columns:repeat(3,1fr);gap:3px}
    #dbg-panel label{font-size:6px;color:#9fb0d0}
    #dbg-x{position:absolute;top:8px;right:10px;color:#ff6a6a;cursor:pointer;font-size:11px}
    #dbg-hint{font-size:6px;color:#5a6a8a;margin-top:10px}`;
  document.head.appendChild(css);
  const p = document.createElement('div');
  p.id = 'dbg-panel';
  p.innerHTML = `
    <span id="dbg-x">✕</span>
    <h3>⚙ CONSOLA DEBUG</h3>
    <h4>IA / MODO DIOS</h4>
    <div class="row"><button data-act="god">★ Modo Dios IA (on/off)</button><button data-act="ai">IA juega sola</button></div>
    <div class="row"><button data-spd="-100">Vel −</button><span id="dbg-spdShow" style="font-size:7px;color:#ffd76a"></span><button data-spd="100">Vel +</button></div>
    <h4>CHEATS RÁPIDOS</h4>
    <div><button data-act="heal">♥ Curar equipo</button><button data-act="lv1">+1 Nv</button><button data-act="lv10">+10 Nv</button></div>
    <div><button data-act="reveal">🗺 Revelar mapa</button><button data-act="money">+5000 ₽</button><button data-act="masterball">+5 Master Ball</button></div>
    <h4>DAR POKÉMON</h4>
    <input id="dbg-name" placeholder="nombre (ej. charizard) o id"/>
    <div class="row"><label>Nivel</label><input id="dbg-lvl" type="number" value="50" min="1" max="100"/></div>
    <label>Stats opcionales (vacío = naturales)</label>
    <div class="grid6">
      <input id="dbg-hp" placeholder="HP"/><input id="dbg-atk" placeholder="Atq"/><input id="dbg-def" placeholder="Def"/>
      <input id="dbg-spa" placeholder="AtE"/><input id="dbg-spd" placeholder="DefE"/><input id="dbg-spe" placeholder="Vel"/>
    </div>
    <button data-act="give" style="width:100%;margin-top:5px">➕ DAR POKÉMON</button>
    <h4>WARP DE PISO</h4>
    <div class="row"><input id="dbg-floor" type="number" placeholder="piso 1-9111" min="1" max="9111"/><button data-act="warp">Ir</button></div>
    <h4>AJUSTES</h4>
    <div class="row"><button data-act="confirm" style="flex:1;background:#1a3a24;border-color:#58e070;color:#bff0c8">✓ Confirmar cambios</button><button data-act="resetdef" style="flex:1;background:#3a1a1a;border-color:#f08080;color:#ffc8c8">↺ Restablecer</button></div>
    <div id="dbg-hint">Tecla <b>0</b> (o Konami ↑↑↓↓←→←→ B A) para abrir/cerrar.<br>Confirmar = guarda la partida con tus cambios · Restablecer = apaga Modo Dios/IA y velocidad a x200.<br>Consola: window.__DEBUG.give('mewtwo',100,{atk:999})</div>`;
  document.body.appendChild(p);
  const num = (id) => { const v = document.getElementById(id).value.trim(); return v === '' ? null : (parseInt(v, 10) || 0); };
  const refreshSpd = () => { const e = document.getElementById('dbg-spdShow'); if (e) e.textContent = 'x' + (window.__GAME.registry.get('godspeed') || 200); };
  p.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-act],[data-spd]'); if (!b) return;
    if (b.dataset.spd) { window.__DEBUG.speed((window.__GAME.registry.get('godspeed') || 200) + (+b.dataset.spd)); return refreshSpd(); }
    const a = b.dataset.act;
    if (a === 'god') window.__DEBUG.god();
    else if (a === 'ai') window.__DEBUG.ai();
    else if (a === 'heal') window.__DEBUG.heal();
    else if (a === 'lv1') window.__DEBUG.level(1);
    else if (a === 'lv10') window.__DEBUG.level(10);
    else if (a === 'reveal') window.__DEBUG.reveal();
    else if (a === 'money') window.__DEBUG.money(5000);
    else if (a === 'masterball') window.__DEBUG.item('masterball', 5);
    else if (a === 'warp') { const f = num('dbg-floor'); if (f) window.__DEBUG.warp(f); }
    else if (a === 'confirm') { window.__DEBUG.save(); }
    else if (a === 'resetdef') { window.__DEBUG.resetDefaults(); refreshSpd(); }
    else if (a === 'give') {
      const stats = {}; for (const k of ['hp', 'atk', 'def', 'spa', 'spd', 'spe']) { const v = num('dbg-' + k); if (v != null) stats[k] = v; }
      window.__DEBUG.give(document.getElementById('dbg-name').value, num('dbg-lvl') || 50, Object.keys(stats).length ? stats : null);
    }
  });
  document.getElementById('dbg-x').addEventListener('click', () => { p.style.display = 'none'; });
  p._refreshSpd = refreshSpd;
  return p;
}

function toggleDebugPanel() {
  const p = buildDebugPanel();
  const show = p.style.display === 'none' || !p.style.display;
  p.style.display = show ? 'block' : 'none';
  if (show) p._refreshSpd?.();
}

// secuencia Konami + atajo backtick
const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];
let konamiIdx = 0;
window.addEventListener('keydown', (e) => {
  // Atajos directos: tecla 0 (fila superior o numpad) y backtick abren/cierran el panel.
  if (e.code === 'Digit0' || e.code === 'Numpad0' || e.code === 'Backquote') {
    e.preventDefault();
    return toggleDebugPanel();
  }
  konamiIdx = (e.code === KONAMI[konamiIdx]) ? konamiIdx + 1 : (e.code === KONAMI[0] ? 1 : 0);
  if (konamiIdx === KONAMI.length) { konamiIdx = 0; toggleDebugPanel(); }
});
