// texgen.js — Motor de TEXTURAS procedurales (bitmaps).
// Genera tiles de pixel-art por código, con variación por ruido y por semilla:
// nunca se ven dos tiles idénticos pegados, pero sin recargar (gusto: sutil).
// Pure-JS: devuelve buffers RGBA testeables en Node y convertibles a textura
// (ImageData) en el navegador para Phaser.
//
// Filosofía Spore (sección N): generas N variantes por bioma una vez → atlas;
// el mundo elige variante por celda. Cero placeholders, cero PNGs a mano.

import { fbm2D, valueNoise2D } from './noise.js';

export const TILE = 16; // tamaño base de tile (estilo GBA)

// ---- utilidades de color ----
export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);
/** aclara/oscurece por factor relativo (amt en [-1,1]). */
function shade([r, g, b], amt) {
  if (amt >= 0) return [clamp(r + (255 - r) * amt), clamp(g + (255 - g) * amt), clamp(b + (255 - b) * amt)];
  return [clamp(r * (1 + amt)), clamp(g * (1 + amt)), clamp(b * (1 + amt))];
}
const mix = (a, b, t) => [clamp(a[0] + (b[0] - a[0]) * t), clamp(a[1] + (b[1] - a[1]) * t), clamp(a[2] + (b[2] - a[2]) * t)];

function newBuf(w = TILE, h = TILE) {
  return { w, h, data: new Uint8ClampedArray(w * h * 4) };
}
function setPx(buf, x, y, [r, g, b], a = 255) {
  const i = (y * buf.w + x) * 4;
  buf.data[i] = r; buf.data[i + 1] = g; buf.data[i + 2] = b; buf.data[i + 3] = a;
}

// ---- TILE DE SUELO ----
// Variación suave por fBm + motas + ligera junta de rejilla para legibilidad.
export function makeFloorTile(palette, seed = 0, opts = {}) {
  const base = hexToRgb(palette.floor);
  const accent = hexToRgb(palette.accent);
  const strength = opts.variation ?? 0.16;   // sutil (gusto: no recargar)
  const speckle = opts.speckle ?? 0.06;
  const buf = newBuf();
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const n = fbm2D(x * 0.18 + seed * 7.3, y * 0.18 + seed * 3.1, { octaves: 3, seed, freq: 1 });
      let col = shade(base, (n - 0.5) * strength * 2);
      // motas oscuras dispersas (textura de piedra/tierra)
      const sp = valueNoise2D(x * 1.7 + seed * 11, y * 1.7 + seed * 5, seed + 99);
      if (sp < speckle) col = shade(col, -0.22);
      else if (sp > 1 - speckle * 0.6) col = mix(col, accent, 0.12); // brillo mineral raro
      // junta de rejilla muy tenue en el borde
      if (x === 0 || y === 0) col = shade(col, -0.10);
      setPx(buf, x, y, col);
    }
  }
  return buf;
}

// ---- TILE DE MURO ----
// Patrón de roca/ladrillo con veta (ridged) + luz arriba, sombra abajo.
export function makeWallTile(palette, seed = 0, opts = {}) {
  const base = hexToRgb(palette.wall);
  const accent = hexToRgb(palette.accent);
  const buf = newBuf();
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const n = fbm2D(x * 0.22 + seed * 4.7, y * 0.22 + seed * 9.2, { octaves: 4, seed, freq: 1 });
      let col = shade(base, (n - 0.5) * 0.3);
      // vetas/grietas
      const v = fbm2D(x * 0.5 + seed, y * 0.12, { octaves: 2, seed: seed + 7 });
      const ridge = 1 - Math.abs(2 * v - 1);
      if (ridge > 0.86) col = shade(col, -0.35);
      // luz superior / sombra inferior (volumen)
      if (y <= 1) col = shade(col, 0.18);
      if (y >= TILE - 2) col = shade(col, -0.28);
      // coronación con un toque de acento
      if (y === 0) col = mix(col, accent, 0.18);
      setPx(buf, x, y, col);
    }
  }
  return buf;
}

// ---- DECORACIONES (con transparencia) ----
// kind: 'rock' | 'crack' | 'flora' | 'crystal'. Variación por seed.
export function makeDecor(kind, palette, seed = 0) {
  const buf = newBuf();
  const accent = hexToRgb(palette.accent);
  const wall = hexToRgb(palette.wall);
  const rnd = (sx, sy) => valueNoise2D(sx + seed * 13, sy + seed * 31, seed + 3);
  const cx = 8, cy = 9;
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const dx = x - cx, dy = y - cy, d = Math.sqrt(dx * dx + dy * dy);
      let col = null, a = 0;
      if (kind === 'rock') {
        const rad = 4.5 + rnd(x * 0.4, y * 0.4) * 1.6;
        if (d < rad) { col = shade(wall, 0.12 + (cy - y) * 0.03); a = 255;
          if (d > rad - 1.2) col = shade(col, -0.3); }
      } else if (kind === 'crystal') {
        // cristal romboidal
        if (Math.abs(dx) + Math.abs(y - 8) < 5 + rnd(x, y) * 1.2) {
          col = mix(accent, [255, 255, 255], 0.15 + Math.max(0, (8 - y)) * 0.05); a = 235;
          if (dx > 0) col = shade(col, -0.2);
        }
      } else if (kind === 'flora') {
        // matas: tallos verticales con jitter
        const blade = Math.abs(((x * 1.3 + Math.sin(y * 0.9 + seed) * 1.5) % 4));
        if (y > 7 && blade < 1.0 && rnd(x, 0) > 0.25) {
          col = mix(accent, [40, 120, 50], 0.5 + rnd(x, y) * 0.3); a = 255;
        }
      } else if (kind === 'crack') {
        const v = fbm2D(x * 0.4 + seed, y * 0.4, { octaves: 2, seed });
        if (1 - Math.abs(2 * v - 1) > 0.9) { col = shade(wall, -0.45); a = 200; }
      }
      if (col) setPx(buf, x, y, col, a);
    }
  }
  return buf;
}

/** Genera un set de variantes de un tipo de tile (para el atlas del bioma). */
export function makeVariants(kind, palette, count = 5, baseSeed = 0) {
  const fn = kind === 'wall' ? makeWallTile : makeFloorTile;
  const out = [];
  for (let i = 0; i < count; i++) out.push(fn(palette, baseSeed * 100 + i, {}));
  return out;
}
