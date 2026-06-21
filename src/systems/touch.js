// touch.js — CONTROLES TÁCTILES para jugar en el navegador de un TELÉFONO.
// Overlay en el DOM (fuera de Phaser) que despacha KeyboardEvent REALES en
// `window`; el input GBA existente (systems/input.js) los lee igual que un
// teclado, así que NO hay que tocar ninguna escena. Mismo truco probado que la
// palanca del HUD (HudScene.fireKey). Se auto-muestra en pantallas táctiles;
// en escritorio se puede forzar con ?touch=1 o window.__TOUCH.show().
//
// Mapeo: D-pad → flechas · A → Z · B → X · ≡ → Enter (menú/confirmar) ·
//        🎒 → M (mochila) · 👥 → T (equipo) · ▦ → P (Pokédex).

const KEYS = {
  up: { key: 'ArrowUp', code: 38 }, down: { key: 'ArrowDown', code: 40 },
  left: { key: 'ArrowLeft', code: 37 }, right: { key: 'ArrowRight', code: 39 },
  a: { key: 'z', code: 90 }, b: { key: 'x', code: 88 },
  start: { key: 'Enter', code: 13 }, bag: { key: 'm', code: 77 },
  team: { key: 't', code: 84 }, dex: { key: 'p', code: 80 },
};

function fireKey(spec, down) {
  const ev = new KeyboardEvent(down ? 'keydown' : 'keyup', { key: spec.key, bubbles: true, cancelable: true });
  Object.defineProperty(ev, 'keyCode', { get: () => spec.code });
  Object.defineProperty(ev, 'which', { get: () => spec.code });
  window.dispatchEvent(ev);
}

function makeBtn(label, spec, cls) {
  const b = document.createElement('button');
  b.className = 'ti-tbtn ' + (cls || '');
  b.textContent = label;
  b.setAttribute('aria-label', label);
  let held = false;
  const press = (e) => { e.preventDefault(); e.stopPropagation(); if (held) return; held = true; b.classList.add('on'); fireKey(spec, true); };
  const release = (e) => { if (e) { e.preventDefault(); e.stopPropagation(); } if (!held) return; held = false; b.classList.remove('on'); fireKey(spec, false); };
  // Pointer Events cubren táctil y ratón, y soportan multitáctil (mover + A).
  b.addEventListener('pointerdown', (e) => { try { b.setPointerCapture(e.pointerId); } catch { /* */ } press(e); });
  b.addEventListener('pointerup', release);
  b.addEventListener('pointercancel', release);
  b.addEventListener('pointerleave', release);
  b.addEventListener('lostpointercapture', () => release());
  b.addEventListener('contextmenu', (e) => e.preventDefault());
  return b;
}

let root = null;

function build() {
  if (root) return root;
  const style = document.createElement('style');
  style.textContent = `
    #ti-touch { position:fixed; inset:0; z-index:9000; pointer-events:none;
      font-family:system-ui,sans-serif; touch-action:none; user-select:none; -webkit-user-select:none; }
    #ti-touch .ti-tbtn { pointer-events:auto; position:absolute; touch-action:none;
      background:rgba(5,6,10,.62); color:#ffd76a; border:2px solid #ffd76a;
      border-radius:14px; font-size:20px; font-weight:700; line-height:1;
      display:flex; align-items:center; justify-content:center;
      box-shadow:0 2px 8px rgba(0,0,0,.5); backdrop-filter:blur(2px); }
    #ti-touch .ti-tbtn.on { background:rgba(255,215,106,.85); color:#05060a; transform:scale(.94); }
    #ti-touch .dpad { width:62px; height:62px; }
    #ti-touch .ab { width:74px; height:74px; border-radius:50%; font-size:26px; }
    #ti-touch .small { width:46px; height:38px; font-size:16px; border-radius:10px; opacity:.9; }
  `;
  document.head.appendChild(style);

  root = document.createElement('div');
  root.id = 'ti-touch';

  // D-PAD (cruz) abajo-izquierda — anclado con bottom/left + offsets relativos
  const dpad = [
    ['▲', KEYS.up, 'left:78px; bottom:150px;'],
    ['◀', KEYS.left, 'left:16px; bottom:86px;'],
    ['▶', KEYS.right, 'left:140px; bottom:86px;'],
    ['▼', KEYS.down, 'left:78px; bottom:22px;'],
  ];
  for (const [lbl, spec, pos] of dpad) { const b = makeBtn(lbl, spec, 'dpad'); b.style.cssText += pos; root.appendChild(b); }

  // A / B abajo-derecha (A más abajo-derecha, estilo Game Boy)
  const a = makeBtn('A', KEYS.a, 'ab'); a.style.cssText += 'right:24px; bottom:60px;'; root.appendChild(a);
  const b = makeBtn('B', KEYS.b, 'ab'); b.style.cssText += 'right:104px; bottom:118px;'; root.appendChild(b);

  // Atajos arriba-derecha
  const shortcuts = [
    ['≡', KEYS.start, 'right:16px; top:14px;'],
    ['🎒', KEYS.bag, 'right:68px; top:14px;'],
    ['👥', KEYS.team, 'right:120px; top:14px;'],
    ['▦', KEYS.dex, 'right:172px; top:14px;'],
  ];
  for (const [lbl, spec, pos] of shortcuts) { const sb = makeBtn(lbl, spec, 'small'); sb.style.cssText += pos; root.appendChild(sb); }

  // Botón de pantalla completa (no despacha tecla: maneja el Fullscreen API).
  const fs = document.createElement('button');
  fs.className = 'ti-tbtn small'; fs.textContent = '⛶'; fs.setAttribute('aria-label', 'Pantalla completa');
  fs.style.cssText += 'right:16px; bottom:14px;';
  fs.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); toggleFullscreen(); });
  fs.addEventListener('contextmenu', (e) => e.preventDefault());
  root.appendChild(fs);

  document.body.appendChild(root);
  return root;
}

/** Alterna pantalla completa y, si se puede, bloquea a horizontal (móvil). */
export function toggleFullscreen() {
  const el = document.documentElement;
  if (!document.fullscreenElement) {
    const p = (el.requestFullscreen || el.webkitRequestFullscreen || (() => Promise.reject())).call(el);
    Promise.resolve(p).then(() => { try { screen.orientation?.lock?.('landscape'); } catch { /* iOS no soporta */ } }).catch(() => { /* iOS Safari: no FS en iPhone, lo cubre el modo PWA standalone */ });
  } else {
    (document.exitFullscreen || document.webkitExitFullscreen || (() => {})).call(document);
  }
}

export const Touch = {
  show() { build().style.display = 'block'; localStorage.setItem('ti_touch', '1'); },
  hide() { if (root) root.style.display = 'none'; localStorage.setItem('ti_touch', '0'); },
  toggle() { if (root && root.style.display !== 'none') this.hide(); else this.show(); },
};

/** Inicializa los controles táctiles: auto-visibles en pantallas táctiles, o si
 *  el usuario los activó antes, o con ?touch=1. Siempre deja window.__TOUCH. */
export function initTouchControls() {
  window.__TOUCH = Touch;
  const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0;
  const forced = new URLSearchParams(location.search).has('touch');
  const pref = localStorage.getItem('ti_touch');
  if (pref === '0') return;                 // el usuario los apagó
  if (isTouch || forced || pref === '1') Touch.show();
}
