// stats.js — FUENTE ÚNICA de cálculo de stats (resuelve A-01 de la auditoría).
// Fórmula Gen III+ exacta. Prohibido calcular stats inline en otros módulos.
// Datos base reales vienen de data/species.generated.js (PokeAPI).

export const NATURES = {
  hardy: {}, lonely: { atk: 1.1, def: 0.9 }, brave: { atk: 1.1, spe: 0.9 },
  adamant: { atk: 1.1, spa: 0.9 }, naughty: { atk: 1.1, spd: 0.9 },
  bold: { def: 1.1, atk: 0.9 }, docile: {}, relaxed: { def: 1.1, spe: 0.9 },
  impish: { def: 1.1, spa: 0.9 }, lax: { def: 1.1, spd: 0.9 },
  timid: { spe: 1.1, atk: 0.9 }, hasty: { spe: 1.1, def: 0.9 }, serious: {},
  jolly: { spe: 1.1, spa: 0.9 }, naive: { spe: 1.1, spd: 0.9 },
  modest: { spa: 1.1, atk: 0.9 }, mild: { spa: 1.1, def: 0.9 },
  quiet: { spa: 1.1, spe: 0.9 }, bashful: {}, rash: { spa: 1.1, spd: 0.9 },
  calm: { spd: 1.1, atk: 0.9 }, gentle: { spd: 1.1, def: 0.9 },
  sassy: { spd: 1.1, spe: 0.9 }, careful: { spd: 1.1, spa: 0.9 }, quirky: {},
};

const STATS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

/**
 * Calcula los stats finales de un Pokémon.
 * @param {object} mon { base:{hp,atk,def,spa,spd,spe}, level, ivs?, evs?, nature? }
 * @returns {{hp,atk,def,spa,spd,spe}}
 */
export function computeStats(mon) {
  const level = mon.level ?? 5;
  const ivs = mon.ivs ?? {}, evs = mon.evs ?? {};
  const nat = NATURES[mon.nature ?? 'hardy'] ?? {};
  const out = {};
  for (const s of STATS) {
    const base = mon.base[s], iv = ivs[s] ?? 0, ev = evs[s] ?? 0;
    const core = Math.floor((2 * base + iv + Math.floor(ev / 4)) * level / 100);
    if (s === 'hp') {
      out.hp = base === 1 ? 1 : core + level + 10; // Shedinja-like guard
    } else {
      out[s] = Math.floor((core + 5) * (nat[s] ?? 1.0));
    }
  }
  return out;
}

/** XP necesaria para el siguiente nivel (curva medium-fast). */
export function xpForLevel(level) { return Math.floor(level ** 3); }
