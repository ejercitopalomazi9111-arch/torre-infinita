// abilities.js (motor) — FUNCIONES PURAS de habilidades + objetos equipables que
// afectan al cálculo de daño/stats. La parte CON ESTADO (Intimidación al entrar,
// Robustez, Impulso, bayas, contacto, Restos) la maneja battle.js.
// Fórmulas Gen: pinch ×1.5 potencia · Potencia ×2 Atk · Sebo ×0.5 fuego/hielo.
import { HELD } from '../../../data/items.js';

const PINCH_TYPE = { overgrow: 'grass', blaze: 'fire', torrent: 'water', swarm: 'bug' };

/** Multiplicador al ATAQUE efectivo (físico o especial) por habilidad + objeto. */
export function attackMultiplier(mon, move) {
  let m = 1;
  const ab = mon.ability, it = HELD[mon.item];
  const phys = move.cat === 'physical';
  if (phys && (ab === 'huge-power' || ab === 'pure-power')) m *= 2;
  if (phys && ab === 'guts' && mon.status) m *= 1.5;
  if (phys && ab === 'hustle') m *= 1.5;
  if (it) { if (phys && it.atkMult) m *= it.atkMult; if (!phys && it.spaMult) m *= it.spaMult; }
  return m;
}

/** Multiplicador a la POTENCIA del movimiento (habilidades de apuro). */
export function powerMultiplier(mon, move) {
  const t = PINCH_TYPE[mon.ability];
  if (t && move.type === t && mon.hp <= mon.maxhp / 3) return 1.5;
  return 1;
}

/** Multiplicador FINAL al daño infligido (Vidasfera). */
export function finalDamageMultiplier(mon) { return HELD[mon.item]?.dmgMult || 1; }

/** Reducción del daño recibido por habilidad del defensor (Sebo). */
export function damageTakenMultiplier(def, move) {
  if (def.ability === 'thick-fat' && (move.type === 'fire' || move.type === 'ice')) return 0.5;
  return 1;
}

/** Inmunidad/absorción del defensor → null | {kind, ability, stat?}. */
export function typeImmunity(def, move) {
  const ab = def.ability;
  if (ab === 'levitate' && move.type === 'ground') return { kind: 'immune', ability: ab };
  if (ab === 'water-absorb' && move.type === 'water') return { kind: 'absorb', ability: ab };
  if (ab === 'volt-absorb' && move.type === 'electric') return { kind: 'absorb', ability: ab };
  if (ab === 'flash-fire' && move.type === 'fire') return { kind: 'flashfire', ability: ab };
  if (ab === 'lightning-rod' && move.type === 'electric') return { kind: 'redirect', ability: ab, stat: 'spa' };
  return null;
}

/** ¿Sobrevive a 1 PS un golpe letal? (Robustez / Banda Focus, solo desde full). */
export function survivesKO(def, hpBefore) {
  if (def.ability === 'sturdy' && hpBefore === def.maxhp) return 'sturdy';
  if (HELD[def.item]?.survive && hpBefore === def.maxhp && !def.itemUsed) return 'item';
  return null;
}

/** Multiplicador de Velocidad por objeto (Pañuelo Elegido). */
export function speedItemMultiplier(mon) { return HELD[mon.item]?.speMult || 1; }

/** ¿La habilidad impide un problema de estado concreto? */
export function blocksStatus(mon, status) {
  const ab = mon.ability;
  return (ab === 'limber' && status === 'paralysis')
      || (ab === 'immunity' && status === 'poison')
      || (ab === 'insomnia' && status === 'sleep')
      || (ab === 'water-veil' && status === 'burn');
}

/** ¿La habilidad impide que le bajen las características? (Cuerpo Puro). */
export function blocksStatDrop(mon) { return mon.ability === 'clear-body' || mon.ability === 'hyper-cutter'; }
