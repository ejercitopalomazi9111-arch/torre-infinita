// movepool.js — Asigna un set de 4 movimientos por TIPO (MVP sin learnsets
// per-especie; los learnsets reales vendrán del editor §14). Garantiza al
// menos un movimiento de daño y variedad coherente con los tipos del Pokémon.

import { STRONG_BY_TYPE, WEAK_BY_TYPE, MOVES } from '../../../data/moves.js';

export function makeMoveset(species) {
  const set = [];
  const add = (id) => { if (id && MOVES[id] && !set.includes(id)) set.push(id); };
  for (const ty of species.types) { add(STRONG_BY_TYPE[ty]); add(WEAK_BY_TYPE[ty]); }
  add('quick_attack');
  // relleno por si es monotipo con pocas opciones
  add(WEAK_BY_TYPE[species.types[0]]);
  add('tackle');
  return set.slice(0, 4);
}

/**
 * Pool de movimientos APRENDIBLES de un Pokémon: todos los de sus tipos + unos
 * normales base, ordenados por poder ascendente (aprende débiles antes que fuertes).
 * Es MAYOR que 4 a propósito: así, al estar lleno, un movimiento nuevo dispara el
 * menú de reemplazo (sin learnsets per-especie reales todavía).
 */
export function learnPool(types) {
  const out = [];
  const add = (id) => { if (id && MOVES[id] && !out.includes(id)) out.push(id); };
  for (const id of Object.keys(MOVES)) if (types.includes(MOVES[id].type) && MOVES[id].cat !== 'status') add(id);
  for (const n of ['tackle', 'scratch', 'quick_attack']) add(n);   // básicos universales
  return out.sort((a, b) => (MOVES[a].power || 0) - (MOVES[b].power || 0));
}

/**
 * Próximo movimiento que un Pokémon DEBERÍA aprender a su nivel actual, o null.
 * Desbloquea uno del pool cada ~3 niveles; con 4 movimientos ya, el siguiente
 * abre el menú interactivo de reemplazo.
 */
export function nextLearnableMove(mon) {
  const pool = learnPool(mon.types || []);
  const known = new Set(mon.moves);
  // MEMORIA anti-bucle: cada movimiento se ofrece UNA sola vez. Sin esto, al
  // reemplazar A por B el movimiento A "vuelve a faltar" y se re-ofrecía sin fin
  // (A→B→A→…). Se siembra con los movimientos iniciales para no re-ofrecerlos si
  // luego se olvidan.
  if (!mon._learnSeen) mon._learnSeen = [...(mon.moves || [])];
  const seen = new Set(mon._learnSeen);
  for (let i = 0; i < pool.length; i++) {
    const id = pool[i];
    if (known.has(id) || seen.has(id)) continue;
    const unlockLvl = 1 + i * 3;             // pos0→Nv1, pos1→Nv4, pos2→Nv7…
    if ((mon.level || 1) >= unlockLvl) { mon._learnSeen.push(id); return id; }
  }
  return null;
}
