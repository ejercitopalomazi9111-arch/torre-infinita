// damage.js — Fórmula de daño Gen V+ (determinista vía RNG sembrado).
// Usa computeStats (A-01), la tabla de tipos, los CAMBIOS DE CARACTERÍSTICA
// (stages) y las HABILIDADES/OBJETOS (abilities.js). Fuente única de daño.

import { typeEffectiveness } from '../../../data/typechart.js';
import { MOVES } from '../../../data/moves.js';
import { attackMultiplier, powerMultiplier, finalDamageMultiplier, damageTakenMultiplier, typeImmunity } from './abilities.js';

const stageMult = (s) => (s >= 0 ? (2 + s) / 2 : 2 / (2 - s));

/**
 * @param {object} atk  battle mon atacante { level, types, stats, stages, status, ability, item }
 * @param {object} def  battle mon defensor { types, stats, stages, ability, item }
 * @param {string} moveId
 * @param {object} rng  RNG sembrado (makeRNG)
 * @returns {{damage, eff, crit, missed, move, immune?}}
 */
export function computeDamage(atk, def, moveId, rng) {
  const move = MOVES[moveId];
  if (!move || move.cat === 'status' || move.power == null) return { damage: 0, eff: 1, crit: false, missed: false, move };

  // inmunidad/absorción por habilidad del defensor (Levitación, Absorbe Agua...)
  const imm = typeImmunity(def, move);
  if (imm) return { damage: 0, eff: 0, crit: false, missed: false, move, immune: imm };

  // precisión (acc 999 = no falla nunca)
  const missed = move.acc < 999 && rng.float() * 100 >= move.acc;
  if (missed) return { damage: 0, eff: 1, crit: false, missed: true, move };

  const phys = move.cat === 'physical';
  // ATAQUE con stages + habilidad/objeto; DEFENSA con stages
  let A = (phys ? atk.stats.atk : atk.stats.spa) * stageMult((phys ? atk.stages.atk : atk.stages.spa) || 0);
  A *= attackMultiplier(atk, move);
  // quemadura ½ Atk físico (Agallas la ignora)
  if (phys && atk.status === 'burn' && atk.ability !== 'guts') A *= 0.5;
  const D = (phys ? def.stats.def : def.stats.spd) * stageMult((phys ? def.stages.def : def.stages.spd) || 0);

  const critRate = (move.crit ? 1 / 8 : 1 / 24);
  const crit = rng.float() < critRate;
  const critMult = crit ? 1.5 : 1;

  const level = atk.level;
  const power = move.power * powerMultiplier(atk, move);
  const base = Math.floor(Math.floor(Math.floor((2 * level / 5 + 2) * power * A / D) / 50) + 2);

  const stab = atk.types.includes(move.type) ? 1.5 : 1;
  const eff = typeEffectiveness(move.type, def.types);
  if (eff === 0) return { damage: 0, eff: 0, crit: false, missed: false, move };

  const rand = 0.85 + rng.float() * 0.15;
  let damage = Math.floor(base * stab * eff * critMult * rand);
  // modificadores finales: Sebo (defensor) y Vidasfera (atacante)
  damage = Math.floor(damage * damageTakenMultiplier(def, move) * finalDamageMultiplier(atk));
  if (damage < 1) damage = 1;
  return { damage, eff, crit, missed: false, move };
}
