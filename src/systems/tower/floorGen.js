// floorGen.js — Generador procedural de un piso de la Torre Infinita.
// Estilo Binding of Isaac adaptado a Pokémon. SEMBRADO y reproducible.
// Sin dependencias de DOM/Phaser: testeable en Node.
//
// Salida: un grafo de salas con puertas, entrada, salida (escaleras),
// llaves/cerraduras y tipos de sala. SIEMPRE validado por el solver
// (validateFloor): si hay softlock, generateFloor regenera con otra semilla.

import { makeRNG } from '../../engine/rng.js';
import { biomeForFloor } from '../../../data/biomes.js';
import { validateFloor } from './solver.js';

const DIRS = [
  { dx: 0, dy: -1, name: 'N', opp: 'S' },
  { dx: 1, dy: 0, name: 'E', opp: 'W' },
  { dx: 0, dy: 1, name: 'S', opp: 'N' },
  { dx: -1, dy: 0, name: 'W', opp: 'E' },
];

// Tipos de sala (sección D). `weight` = frecuencia relativa de aparición
// como sala especial en dead-ends normales.
export const ROOM_TYPES = {
  entrance: { special: true },
  stairs: { special: true },     // salida
  boss: { special: true },
  normal: { weight: 0 },         // relleno (encuentros)
  treasure: { weight: 30 },
  shop: { weight: 18 },
  pokecenter: { weight: 14 },
  puzzle: { weight: 12 },
  rest: { weight: 10 },
  sanctuary: { weight: 6 },
  event: { weight: 12 },
  rare: { weight: 5 },
  secret: { weight: 0 },         // colocada aparte (oculta)
  hidden_merchant: { weight: 3 },
  legendary: { weight: 0 },      // solo en pisos especiales
  ultra_event: { weight: 1 },
};

function idx(x, y, W) { return y * W + x; }
function pos(id, W) { return { x: id % W, y: Math.floor(id / W) }; }

/** Crecimiento por grilla desde el centro hasta alcanzar targetRooms. */
function growLayout(rng, targetRooms, W, H) {
  const occupied = new Set();
  const cx = Math.floor(W / 2), cy = Math.floor(H / 2);
  const start = idx(cx, cy, W);
  occupied.add(start);
  const order = [start];

  const occNeighbors = (id) => {
    const { x, y } = pos(id, W);
    let n = 0;
    for (const d of DIRS) {
      const nx = x + d.dx, ny = y + d.dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      if (occupied.has(idx(nx, ny, W))) n++;
    }
    return n;
  };

  let queue = [start];
  let guard = 0;
  while (occupied.size < targetRooms && guard++ < 5000) {
    if (queue.length === 0) queue = rng.shuffle([...occupied]); // re-sembrar frontera
    const cur = queue.shift();
    const { x, y } = pos(cur, W);
    for (const d of rng.shuffle([...DIRS])) {
      if (occupied.size >= targetRooms) break;
      const nx = x + d.dx, ny = y + d.dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const nid = idx(nx, ny, W);
      if (occupied.has(nid)) continue;
      if (occNeighbors(nid) > 1) continue;   // evita salas pegadas (ramifica)
      if (rng.chance(0.5)) continue;          // ~50% rechazo → ramas y dead-ends
      occupied.add(nid);
      queue.push(nid);
      order.push(nid);
    }
  }
  return { occupied, order, start };
}

/** Construye el grafo de salas con puertas a partir de las celdas ocupadas. */
function buildGraph(occupied, W, start) {
  const roomById = new Map();
  for (const id of occupied) {
    const { x, y } = pos(id, W);
    roomById.set(id, { id, gx: x, gy: y, type: 'normal', doors: [], distance: Infinity });
  }
  for (const id of occupied) {
    const { x, y } = pos(id, W);
    for (const d of DIRS) {
      const nx = x + d.dx, ny = y + d.dy;
      if (nx < 0 || ny < 0 || nx >= W) continue;
      const nid = idx(nx, ny, W);
      if (!occupied.has(nid)) continue;
      roomById.get(id).doors.push({ to: nid, dir: d.name, locked: false, keyId: null });
    }
  }
  return roomById;
}

/** BFS de distancias desde `from` ignorando cerraduras (topología pura). */
function bfsDistances(roomById, from) {
  for (const r of roomById.values()) r.distance = Infinity;
  roomById.get(from).distance = 0;
  const q = [from];
  while (q.length) {
    const cur = q.shift();
    const cd = roomById.get(cur).distance;
    for (const door of roomById.get(cur).doors) {
      const nb = roomById.get(door.to);
      if (nb.distance > cd + 1) { nb.distance = cd + 1; q.push(door.to); }
    }
  }
}

function deadEnds(roomById, excludeIds) {
  const out = [];
  for (const r of roomById.values()) {
    if (excludeIds.has(r.id)) continue;
    if (r.doors.length === 1) out.push(r);
  }
  return out;
}

/** Coloca una cerradura segura: en una puerta cuyo lado lejano NO contenga
 *  la entrada, y pone la llave en el lado de la entrada. Garantiza
 *  "llave antes que puerta" por construcción. */
function placeLockAndKey(rng, roomById, entranceId, keyId) {
  // Candidatos: puertas (u->v) donde quitarla deja a v sin camino a la entrada.
  const candidates = [];
  for (const u of roomById.values()) {
    for (const door of u.doors) {
      if (door.locked) continue;
      const v = door.to;
      // componente de v al cortar la arista u-v
      const seen = new Set([v]);
      const stack = [v];
      let touchesEntrance = (v === entranceId);
      while (stack.length && !touchesEntrance) {
        const cur = stack.pop();
        for (const dd of roomById.get(cur).doors) {
          if ((cur === v && dd.to === u.id) || (cur === u.id)) continue; // arista cortada
          if (dd.to === u.id && cur === v) continue;
          if (!seen.has(dd.to)) {
            if (dd.to === entranceId) { touchesEntrance = true; break; }
            seen.add(dd.to); stack.push(dd.to);
          }
        }
      }
      if (!touchesEntrance && seen.size >= 1 && seen.size <= roomById.size - 2) {
        candidates.push({ u: u.id, v, farSide: seen });
      }
    }
  }
  if (!candidates.length) return false;
  const c = rng.pick(candidates);
  // bloquear la puerta en ambos sentidos
  for (const door of roomById.get(c.u).doors) if (door.to === c.v) { door.locked = true; door.keyId = keyId; }
  for (const door of roomById.get(c.v).doors) if (door.to === c.u) { door.locked = true; door.keyId = keyId; }
  // llave en una sala del lado de la entrada (no la entrada misma si se puede)
  const entranceSide = [...roomById.keys()].filter(id => !c.farSide.has(id) && id !== c.u || id === c.u);
  const keyRoom = rng.pick(entranceSide.length ? entranceSide : [entranceId]);
  return { keyId, roomId: keyRoom };
}

/** Asigna tipos especiales según cadencias y dead-ends disponibles. */
function assignRoomTypes(rng, roomById, floor, entranceId, exitId, bossId, isSafeFloor) {
  const reserved = new Set([entranceId, exitId]);
  if (bossId != null) reserved.add(bossId);
  roomById.get(entranceId).type = 'entrance';
  roomById.get(exitId).type = 'stairs';
  if (bossId != null) roomById.get(bossId).type = 'boss';

  const ends = rng.shuffle(deadEnds(roomById, reserved));
  const guaranteed = [];
  if (isSafeFloor) guaranteed.push('shop', 'pokecenter', 'rest'); // zona segura cada 5 pisos
  if (floor % 25 === 0) guaranteed.push('legendary');

  // primero las garantizadas: dead-ends si hay; si no, cualquier sala normal
  // libre (las zonas seguras DEBEN tener sus servicios sí o sí).
  const freeNormal = () => rng.shuffle(
    [...roomById.values()].filter(r => !reserved.has(r.id) && r.type === 'normal')
  );
  for (const t of guaranteed) {
    let slot = ends.pop();
    if (!slot) slot = freeNormal()[0];
    if (slot) { slot.type = t; reserved.add(slot.id); }
  }
  // resto de dead-ends → especiales ponderadas
  const weights = {};
  for (const [k, v] of Object.entries(ROOM_TYPES)) if (v.weight > 0) weights[k] = v.weight;
  for (const end of ends) {
    if (reserved.has(end.id)) continue;
    end.type = rng.weighted(weights);
    reserved.add(end.id);
  }

  // piso 1: TESORO garantizado (siempre hay algo que encontrar)
  if (floor === 1 && ![...roomById.values()].some(r => r.type === 'treasure')) {
    const cand = [...roomById.values()].filter(r => !reserved.has(r.id) && r.type === 'normal');
    if (cand.length) rng.pick(cand).type = 'treasure';
  }
  // sala secreta: una sala normal interior marcada como oculta (paredes rompibles).
  // Nunca puede ser la salida (exitId está en `reserved`): la bajada siempre aparece.
  const interior = [...roomById.values()].filter(r => r.doors.length >= 2 && !reserved.has(r.id) && r.type === 'normal');
  if (interior.length && (floor === 1 || rng.chance(0.7))) rng.pick(interior).type = 'secret';
}

/**
 * Genera un piso COMPLETO y VALIDADO.
 * @param {string|number} seed  semilla base (reproducible)
 * @param {number} floor        número de piso (1..9111)
 * @param {object} opts         { maxAttempts }
 */
export function generateFloor(seed, floor, opts = {}) {
  const maxAttempts = opts.maxAttempts ?? 40;
  let biome = biomeForFloor(floor, seed);
  const isBossFloor = floor % 10 === 0;
  const isSafeFloor = floor % 5 === 0 && !isBossFloor;
  // los biomas de CUEVA (dark) no tienen pueblo: si tocara zona segura en uno, el
  // pueblo se ubica en un claro de BOSQUE (nunca en cueva).
  if (isSafeFloor && biome.dark) biome = biomeForFloor(1, seed);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const rng = makeRNG(`${seed}|floor:${floor}|try:${attempt}`);
    const W = 9, H = 9;
    // VARIEDAD real de tamaños: piso 1 SIEMPRE 7 salas; después tamaños mixtos
    const target = floor === 1 ? 7
      : rng.pick([5, 7, 8, 9, 10, 12, 15, 20].filter(n => n <= 8 + floor * 2));

    const { occupied, start } = growLayout(rng, target, W, H);
    const roomById = buildGraph(occupied, W, start);
    bfsDistances(roomById, start);

    // salida = dead-end más lejano (o sala más lejana si no hay)
    const ends = deadEnds(roomById, new Set([start]));
    const farthest = (ends.length ? ends : [...roomById.values()])
      .filter(r => r.id !== start)
      .sort((a, b) => b.distance - a.distance)[0];
    if (!farthest) continue;
    const exitId = farthest.id;

    // jefe: en piso de jefe, sala justo antes de la escalera, en el camino crítico
    let bossId = null;
    if (isBossFloor) {
      const path = criticalPath(roomById, start, exitId);
      bossId = path.length >= 2 ? path[path.length - 2] : null;
      if (bossId === start) bossId = null;
    }

    assignRoomTypes(rng, roomById, floor, start, exitId, bossId, isSafeFloor);

    // metroidvania ligero: 0-2 cerraduras seguras (más arriba, más probable)
    const keys = [];
    const lockCount = rng.weighted({ '0': 50, '1': 35, '2': 15 }) | 0;
    for (let k = 0; k < lockCount; k++) {
      const res = placeLockAndKey(rng, roomById, start, `key_${floor}_${k}`);
      if (res) keys.push({ id: res.keyId, roomId: res.roomId });
    }

    const floorData = {
      seed: `${seed}`, floor, biome,
      width: W, height: H,
      entranceId: start, exitId, bossId,
      isBossFloor, isSafeFloor,
      keys,
      rooms: [...roomById.values()],
      roomById,
    };

    // GATE: validar contra el solver. Si hay softlock, reintentar.
    const verdict = validateFloor(floorData);
    if (verdict.ok) {
      floorData.validation = verdict;
      return floorData;
    }
  }
  throw new Error(`generateFloor: no se logró un piso resoluble tras ${maxAttempts} intentos (floor ${floor}, seed ${seed})`);
}

/** Camino crítico (BFS parent-trace) entrada→salida ignorando cerraduras. */
export function criticalPath(roomById, from, to) {
  const parent = new Map([[from, null]]);
  const q = [from];
  while (q.length) {
    const cur = q.shift();
    if (cur === to) break;
    for (const door of roomById.get(cur).doors) {
      if (!parent.has(door.to)) { parent.set(door.to, cur); q.push(door.to); }
    }
  }
  if (!parent.has(to)) return [];
  const path = [];
  for (let c = to; c != null; c = parent.get(c)) path.unshift(c);
  return path;
}
