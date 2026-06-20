// evolution.js — Evolución por nivel (data/evos.generated.js). Mantiene PS
// proporcionales, recalcula stats y conserva la habilidad si sigue siendo válida.
import { EVOS } from '../../../data/evos.generated.js';
import { SPECIES_BY_ID } from '../../../data/species.generated.js';
import { computeStats } from './stats.js';
import { HELD } from '../../../data/items.js';

/** ¿Este Pokémon debe evolucionar ya? → id destino o null (Piedra Eterna lo frena). */
export function pendingEvolution(mon) {
  if (HELD[mon.item]?.noEvolve) return null;
  const e = EVOS[mon.speciesId];
  if (e && mon.level >= e.level && SPECIES_BY_ID[e.to]) return e.to;
  return null;
}

/** Aplica la evolución in-place; devuelve la especie nueva. */
export function evolveMon(mon, toId) {
  const sp = SPECIES_BY_ID[toId];
  const ratio = mon.maxhp ? mon.hp / mon.maxhp : 1;
  mon.speciesId = toId;
  mon.name = sp.name;            // los capturados usan el nombre de la especie
  mon.types = sp.types;
  mon.base = sp.base;
  mon.sprite = sp.sprite;
  // conserva la habilidad si la nueva especie también la tiene; si no, la primaria
  const list = sp.abilities || [];
  if (!list.some(a => a.name === mon.ability)) {
    const ab = list.find(a => !a.hidden) || list[0];
    if (ab) mon.ability = ab.name;
  }
  mon.stats = computeStats({ base: sp.base, level: mon.level, nature: mon.nature, ivs: mon.ivs, evs: mon.evs });
  mon.maxhp = mon.stats.hp;
  mon.hp = Math.max(1, Math.round(mon.maxhp * ratio));
  return sp;
}
