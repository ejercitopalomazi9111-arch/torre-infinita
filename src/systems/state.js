// state.js — Estado de PARTIDA (run): equipo, caja PC, mochila, Pokédex, dinero.
// Vive en el registry de Phaser; la Pokédex y mochila persisten en localStorage.
import { makeBattleMon } from './combat/battle.js';
import { MOVES } from '../../data/moves.js';
import { ACHIEVEMENTS } from '../../data/achievements.js';

// ---------- LOGROS (persisten siempre, no por ranura) ----------
const ACH_KEY = 'torre_infinita_achievements';
export function getUnlockedAch() { try { return JSON.parse(localStorage.getItem(ACH_KEY) || '[]'); } catch { return []; } }
/** Comprueba todos los logros con el contexto dado y devuelve los RECIÉN desbloqueados. */
export function tryUnlock(ctx) {
  const got = new Set(getUnlockedAch());
  const fresh = [];
  for (const a of ACHIEVEMENTS) {
    if (got.has(a.id)) continue;
    try { if (a.check(ctx)) { got.add(a.id); fresh.push(a); } } catch { /* */ }
  }
  if (fresh.length) { try { localStorage.setItem(ACH_KEY, JSON.stringify([...got])); } catch { /* */ } }
  return fresh;
}

const SAVE_KEY = 'torre_infinita_run';

// ---------- META-PROGRESIÓN (puntos entre partidas → mejoras permanentes) ----------
const META_KEY = 'torre_infinita_meta';
export const PERKS = {
  wallet:    { name: 'Cartera Gruesa', max: 5, cost: (l) => 50 + l * 30, desc: '+1500₽ al empezar cada partida', apply: (run, l) => { run.money += 1500 * l; } },
  medkit:    { name: 'Botiquín',       max: 5, cost: (l) => 40 + l * 25, desc: '+2 Pociones al empezar',        apply: (run, l) => { run.bag.potion = (run.bag.potion || 0) + 2 * l; } },
  lucky:     { name: 'Trébol',         max: 3, cost: (l) => 80 + l * 50, desc: '+3 Super Balls al empezar',     apply: (run, l) => { run.bag.superball = (run.bag.superball || 0) + 3 * l; } },
  bond:      { name: 'Vínculo Fuerte', max: 5, cost: (l) => 60 + l * 40, desc: 'Tu inicial empieza +2 niveles', apply: () => { } },
  collector: { name: 'Coleccionista',  max: 1, cost: () => 250,          desc: 'Empiezas con un Cristal Z',     apply: (run) => { run.bag.zcrystal = (run.bag.zcrystal || 0) + 1; } },
};
export function getMeta() { try { return JSON.parse(localStorage.getItem(META_KEY) || '{"points":0,"perks":{}}'); } catch { return { points: 0, perks: {} }; } }
function saveMeta(m) { try { localStorage.setItem(META_KEY, JSON.stringify(m)); } catch { /* */ } }
export function addMeta(points) { const m = getMeta(); m.points += Math.max(0, points | 0); saveMeta(m); return m; }
export function buyPerk(id) { const m = getMeta(); const p = PERKS[id]; if (!p) return false; const lvl = m.perks[id] || 0; if (lvl >= p.max) return false; const c = p.cost(lvl); if (m.points < c) return false; m.points -= c; m.perks[id] = lvl + 1; saveMeta(m); return true; }
export function applyPerks(run) { const m = getMeta(); for (const [id, lvl] of Object.entries(m.perks)) { const p = PERKS[id]; if (p && lvl > 0) p.apply(run, lvl); } return run; }

// ---------- DIFICULTAD (elegida al empezar; afecta niveles/jefes/recompensas) ----------
export const DIFFICULTY = {
  normal:    { name: 'Normal',    lvl: 1.0,  bossHp: 1.4, reward: 1.0, desc: 'La experiencia equilibrada.' },
  hard:      { name: 'Difícil',   lvl: 1.25, bossHp: 1.7, reward: 1.5, desc: 'Salvajes más fuertes, jefes duros, +50% recompensas.' },
  nightmare: { name: 'Pesadilla', lvl: 1.5,  bossHp: 2.2, reward: 2.2, desc: 'Solo para valientes. Todo brutal, +120% recompensas.' },
};
export function diffOf(run) { return DIFFICULTY[run?.difficulty] || DIFFICULTY.normal; }
const NEXTDIFF_KEY = 'torre_infinita_nextdiff';
export function setNextDifficulty(d) { try { localStorage.setItem(NEXTDIFF_KEY, d); } catch { /* */ } }
function nextDifficulty() { try { const d = localStorage.getItem(NEXTDIFF_KEY); return DIFFICULTY[d] ? d : 'normal'; } catch { return 'normal'; } }

export function createRun(starterId = 25) {
  const bond = (getMeta().perks.bond || 0) * 2;   // mejora "Vínculo": inicial de mayor nivel
  const starter = makeBattleMon(starterId, 1 + bond);   // NIVEL 1 (+ vínculo): el resto se gana jugando
  // empieza con los 2 movimientos MÁS DÉBILES (nada de Lanzallamas a Nv1;
  // learnsets reales por nivel llegan en B2 del roadmap)
  starter.moves = [...starter.moves].sort((a, b) => (MOVES[a].power || 0) - (MOVES[b].power || 0)).slice(0, 2);
  starter.exp = 0;
  starter.correa = true;   // el inicial ya viene con CORREA: te sigue desde el principio
  const run = {
    party: [starter],                            // SOLO tu inicial (nada de regalos)
    wins: 0,
    box: [],
    bag: {
      pokeball: 10, superball: 5, ultraball: 2, quickball: 3, duskball: 3, netball: 2, timerball: 2, healball: 1,
      potion: 5, superpotion: 2, hyperpotion: 1, revive: 1,
      // objetos equipables + bayas + un par de discos para estrenar el sistema
      restos: 1, vidasfera: 1, cintaelegida: 1, panueloelegido: 1,
      bayazidra: 2, bayaaranja: 2, bayameloc: 1, bayaziuela: 1,
      disco_intimidacion: 1, disco_agallas: 1,
      bici: 1,   // la bici para moverte rápido (úsala desde la mochila)
    },
    dex: { seen: [], caught: [] },
    money: 3000,
    difficulty: nextDifficulty(),   // dificultad elegida al empezar
  };
  return applyPerks(run);   // aplica las MEJORAS permanentes compradas con puntos
}

/** Obtiene la run del registry, creándola y fusionando la Pokédex guardada. */
export function getRun(registry) {
  let run = registry.get('run');
  if (!run) {
    run = createRun(registry.get('starter') || 25);
    const saved = loadDex();
    // SOLO la Pokédex persiste entre partidas; la mochila es NUEVA en cada run
    // (antes la bolsa gastada se heredaba y el juego se volvía injugable)
    if (saved) run.dex = saved.dex;
    registry.set('run', run);
  }
  return run;
}

export function markSeen(run, id) {
  if (!run.dex.seen.includes(id)) { run.dex.seen.push(id); saveDex(run); }
}
export function markCaught(run, id) {
  if (!run.dex.caught.includes(id)) run.dex.caught.push(id);
  if (!run.dex.seen.includes(id)) run.dex.seen.push(id);
  saveDex(run);
}
export function isCaught(run, id) { return run.dex.caught.includes(id); }
export function isSeen(run, id) { return run.dex.seen.includes(id); }

/** Añade un Pokémon capturado al equipo (o a la caja si está lleno). */
export function addCapturedMon(run, mon) {
  if (run.party.length < 6) run.party.push(mon);
  else run.box.push(mon);
  markCaught(run, mon.speciesId);
}

// ---------- GUARDADO de partida con 3 RANURAS (slots) ----------
const RUN_KEY = 'torre_infinita_partida';     // legacy (= ranura 0)
const SLOT_KEY = (s) => `torre_infinita_slot_${s}`;
const ACTIVE_SLOT_KEY = 'torre_infinita_activeslot';
const PLAYED_KEY = 'torre_infinita_hasplayed';
export const SLOT_COUNT = 3;

export function getActiveSlot() { const s = parseInt(localStorage.getItem(ACTIVE_SLOT_KEY) || '0', 10); return isNaN(s) ? 0 : s; }
export function setActiveSlot(s) { try { localStorage.setItem(ACTIVE_SLOT_KEY, String(s)); localStorage.setItem(PLAYED_KEY, '1'); } catch { /* */ } }
export function hasPlayed() { return localStorage.getItem(PLAYED_KEY) === '1' || !!readSlot(0) || !!readSlot(1) || !!readSlot(2); }

function readSlot(s) {
  try { return JSON.parse(localStorage.getItem(SLOT_KEY(s)) || (s === 0 ? localStorage.getItem(RUN_KEY) : null) || 'null'); } catch { return null; }
}

export function saveRun(registry, floorNum, slot) {
  try {
    const run = registry.get('run'); if (!run) return;
    const s = slot ?? getActiveSlot();
    localStorage.setItem(SLOT_KEY(s), JSON.stringify({
      run, floor: floorNum,
      trainer: registry.get('trainer') || null,
      starter: registry.get('starter') || 25,
      all: !!registry.get('allTrainers'),
      savedAt: Date.now(),
    }));
    setActiveSlot(s);
  } catch { /* cuota llena */ }
}

/** Metadatos de las 3 ranuras para el menú (null si vacía). */
export function listSlots() {
  const out = [];
  for (let s = 0; s < SLOT_COUNT; s++) {
    const sv = readSlot(s);
    out.push(sv ? { slot: s, floor: sv.floor || 1, starter: sv.starter || 25, trainer: sv.trainer?.id || null, savedAt: sv.savedAt || 0 } : null);
  }
  return out;
}

/** ¿Hay alguna partida guardada en cualquier ranura? */
export function hasSave() { return readSlot(0) || readSlot(1) || readSlot(2); }

/** Restaura la partida de una ranura al registry; devuelve el piso (o null). */
export function loadRun(registry, slot) {
  const s = slot ?? getActiveSlot();
  const sv = readSlot(s); if (!sv) return null;
  registry.set('run', sv.run);
  registry.set('starter', sv.starter);
  if (sv.trainer) registry.set('trainer', sv.trainer);
  if (sv.all) registry.set('allTrainers', true);
  setActiveSlot(s);
  return sv.floor || 1;
}

export function clearSave(slot) {
  try { const s = slot ?? getActiveSlot(); localStorage.removeItem(SLOT_KEY(s)); if (s === 0) localStorage.removeItem(RUN_KEY); } catch { /* */ }
}

/** REINICIO DE FÁBRICA: borra TODO (ranuras, dex, repeticiones, ajustes). */
export function factoryReset() {
  try {
    for (let s = 0; s < SLOT_COUNT; s++) localStorage.removeItem(SLOT_KEY(s));
    for (const k of [RUN_KEY, SAVE_KEY, ACTIVE_SLOT_KEY, PLAYED_KEY, 'torre_infinita_recordings', 'torre_infinita_settings']) localStorage.removeItem(k);
  } catch { /* */ }
}

function saveDex(run) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ dex: run.dex, bag: run.bag })); } catch { /* */ }
}
function loadDex() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch { return null; }
}
