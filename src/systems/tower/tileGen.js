// tileGen.js — Tilemap INTERIOR de una sala (capa fina sobre el grafo de pisos).
// Usa ruido para: variante de textura por celda (clustering de desgaste),
// bordes orgánicos según bioma y decoración dispersa con buen gusto.
// SEMBRADO: misma sala+seed → mismo interior. Sin dependencias DOM.

import { fbm2D, valueNoise2D } from '../../engine/noise.js';

export const ROOM_COLS = 15;
export const ROOM_ROWS = 11;
export const VARIANTS = 5;

// Decoración favorita por bioma (gusto: poca densidad, no recargar).
const DECOR_BY_BIOME = {
  cuevas: ['rock', 'crack'],
  bosque: ['flora'],
  ruinas: ['rock', 'crack'],
  glaciar: ['crystal'],
  volcan: ['rock'],
  laboratorio: ['crack'],
  cielo: ['flora'],
  distorsion: ['crystal'],
  pradera: ['flora'],
};
const ORGANIC_BIOMES = new Set(['cuevas', 'ruinas', 'distorsion', 'glaciar']);

/**
 * @param {object} room   sala del grafo: { id, doors:[{dir}], type }
 * @param {object} biome  bioma del piso (id, palette...)
 * @param {string|number} seed  semilla del piso
 * @returns tilemap { cols, rows, cells[r][c] }
 */
export function generateRoomTiles(room, biome, seed) {
  const cols = ROOM_COLS, rows = ROOM_ROWS;
  const rseed = `${seed}:${room.id}`;
  const ns = hashStr(rseed);
  const decorKinds = DECOR_BY_BIOME[biome.id] || ['rock'];
  const organic = ORGANIC_BIOMES.has(biome.id);

  const cells = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      const border = r === 0 || c === 0 || r === rows - 1 || c === cols - 1;
      let base = border ? 'wall' : 'floor';

      // borde orgánico: erosiona/añade salientes cerca del muro con ruido
      if (organic && !border) {
        const edge = Math.min(r, c, rows - 1 - r, cols - 1 - c);
        if (edge === 1) {
          const e = fbm2D(c * 0.6 + ns, r * 0.6, { octaves: 2, seed: ns });
          if (e > 0.66) base = 'wall'; // saliente rocoso
        }
      }

      // variante de textura: clustering por ruido (zonas más desgastadas)
      const vn = valueNoise2D(c * 0.5 + ns * 0.7, r * 0.5 + ns * 1.3, ns + 5);
      const variant = Math.min(VARIANTS - 1, Math.floor(vn * VARIANTS));

      row.push({ base, variant, decor: null, blocked: base === 'wall' });
    }
    cells.push(row);
  }

  // aberturas de puerta (corredor de 3 de ancho) centradas según doors presentes
  const midC = (cols - 1) / 2, midR = (rows - 1) / 2;
  const dirs = new Set(room.doors.map(d => d.dir));
  const carve = (r, c) => { cells[r][c].base = 'door'; cells[r][c].blocked = false; cells[r][c].decor = null; };
  if (dirs.has('N')) for (let dc = -1; dc <= 1; dc++) carve(0, midC + dc);
  if (dirs.has('S')) for (let dc = -1; dc <= 1; dc++) carve(rows - 1, midC + dc);
  if (dirs.has('W')) for (let dr = -1; dr <= 1; dr++) carve(midR + dr, 0);
  if (dirs.has('E')) for (let dr = -1; dr <= 1; dr++) carve(midR + dr, cols - 1);

  // decoración dispersa en suelo (densidad baja, lejos del centro y de puertas)
  for (let r = 1; r < rows - 1; r++) {
    for (let c = 1; c < cols - 1; c++) {
      const cell = cells[r][c];
      if (cell.base !== 'floor') continue;
      const distCenter = Math.hypot(c - midC, r - midR);
      if (distCenter < 2.5) continue; // centro despejado para jugar
      const d = fbm2D(c * 0.35 + ns * 2, r * 0.35 + ns * 4, { octaves: 3, seed: ns + 11 });
      if (d > 0.74) {
        const kind = decorKinds[Math.floor(valueNoise2D(c, r, ns) * decorKinds.length)];
        cell.decor = kind;
        cell.blocked = (kind === 'rock' || kind === 'crystal'); // sólidos bloquean
      }
    }
  }

  // garantía de navegabilidad: carril limpio de cada puerta al centro
  const clear = (r, c) => { if (cells[r][c].base !== 'door') cells[r][c].base = 'floor'; cells[r][c].blocked = false; cells[r][c].decor = null; };
  const cR = Math.floor(midR), cC = Math.floor(midC);
  for (const dir of dirs) {
    if (dir === 'N') for (let r = 0; r <= cR; r++) clear(r, cC);
    if (dir === 'S') for (let r = rows - 1; r >= cR; r--) clear(r, cC);
    if (dir === 'W') { for (let c = 0; c <= cC; c++) clear(cR, c); }
    if (dir === 'E') { for (let c = cols - 1; c >= cC; c--) clear(cR, c); }
  }

  return { cols, rows, cells, tileSize: 16 };
}

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) % 100000;
}

/** Comprueba navegabilidad interior: las 4 puertas alcanzan el centro. */
export function roomIsTraversable(tilemap) {
  const { cols, rows, cells } = tilemap;
  const start = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++)
    if (cells[r][c].base === 'door') start.push([r, c]);
  if (!start.length) return true; // sala sin puertas (no debería)
  const seen = new Set(), q = [...start];
  for (const [r, c] of start) seen.add(r * cols + c);
  while (q.length) {
    const [r, c] = q.shift();
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
      const k = nr * cols + nc;
      if (seen.has(k)) continue;
      const cell = cells[nr][nc];
      if (cell.base === 'wall' || cell.blocked) continue;
      seen.add(k); q.push([nr, nc]);
    }
  }
  // todas las puertas deben quedar en el mismo componente que el centro
  const midK = Math.floor((rows - 1) / 2) * cols + Math.floor((cols - 1) / 2);
  return seen.has(midK) && start.every(([r, c]) => seen.has(r * cols + c));
}
