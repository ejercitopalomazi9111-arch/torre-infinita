// breeding.js — CRIADERO. Reglas de cría:
//  · DITTO cruza con CUALQUIER Pokémon (no con otro Ditto).
//  · Dos Pokémon de la MISMA familia evolutiva también crían.
//  · El bebé es la FORMA BASE del progenitor que no es Ditto (la base se calcula
//    recorriendo hacia atrás la cadena de evolución por nivel de data/evos.generated.js).
import { EVOS } from '../../../data/evos.generated.js';
import { SPECIES_BY_ID } from '../../../data/species.generated.js';

const DITTO_ID = 132;
let _pre = null;

/** Mapa inverso evolución: especie → de quién evoluciona (a partir de EVOS). */
function preEvo() {
  if (_pre) return _pre;
  _pre = {};
  for (const from in EVOS) { const e = EVOS[from]; if (e && e.to != null) _pre[e.to] = Number(from); }
  return _pre;
}

/** Forma base (la más baja) de una línea evolutiva. */
export function baseFormOf(id) {
  const pre = preEvo(); let cur = Number(id), guard = 0;
  while (pre[cur] != null && guard++ < 12) cur = pre[cur];
  return cur;
}

export function isDitto(mon) {
  return !!mon && (mon.speciesId === DITTO_ID || (mon.name || '').toLowerCase() === 'ditto');
}

/** ¿Comparten la misma forma base? (misma familia evolutiva). */
export function sameFamily(a, b) { return baseFormOf(a.speciesId) === baseFormOf(b.speciesId); }

/** ¿Esta pareja puede criar? */
export function canBreed(a, b) {
  if (!a || !b || a === b) return false;
  if (isDitto(a) && isDitto(b)) return false;   // dos Dittos no producen huevo
  if (isDitto(a) || isDitto(b)) return true;     // Ditto + cualquiera
  return sameFamily(a, b);                        // o dos de la misma familia
}

/** Especie del huevo (forma base del progenitor no-Ditto), o null si no crían. */
export function eggSpeciesOf(a, b) {
  if (!canBreed(a, b)) return null;
  const nonDitto = isDitto(a) ? b : a;
  return baseFormOf(nonDitto.speciesId);
}

/** Resultado de cría listo para la UI: { id, name } o null. */
export function eggResult(a, b) {
  const id = eggSpeciesOf(a, b);
  const sp = id != null ? SPECIES_BY_ID[id] : null;
  return sp ? { id, name: sp.name } : null;
}
