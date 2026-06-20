// typechart.js — Tabla de efectividad de tipos COMPLETA (18 tipos, Gen 6+).
// Datos factuales canónicos. Solo se listan entradas != 1.
// TYPECHART[atacante][defensor] = multiplicador.

const SUPER = 2, NOT = 0.5, IMMUNE = 0;

export const TYPECHART = {
  normal:   { rock: NOT, ghost: IMMUNE, steel: NOT },
  fire:     { fire: NOT, water: NOT, grass: SUPER, ice: SUPER, bug: SUPER, rock: NOT, dragon: NOT, steel: SUPER },
  water:    { fire: SUPER, water: NOT, grass: NOT, ground: SUPER, rock: SUPER, dragon: NOT },
  electric: { water: SUPER, electric: NOT, grass: NOT, ground: IMMUNE, flying: SUPER, dragon: NOT },
  grass:    { fire: NOT, water: SUPER, grass: NOT, poison: NOT, ground: SUPER, flying: NOT, bug: NOT, rock: SUPER, dragon: NOT, steel: NOT },
  ice:      { fire: NOT, water: NOT, grass: SUPER, ice: NOT, ground: SUPER, flying: SUPER, dragon: SUPER, steel: NOT },
  fighting: { normal: SUPER, ice: SUPER, poison: NOT, flying: NOT, psychic: NOT, bug: NOT, rock: SUPER, ghost: IMMUNE, dark: SUPER, steel: SUPER, fairy: NOT },
  poison:   { grass: SUPER, poison: NOT, ground: NOT, rock: NOT, ghost: NOT, steel: IMMUNE, fairy: SUPER },
  ground:   { fire: SUPER, electric: SUPER, grass: NOT, poison: SUPER, flying: IMMUNE, bug: NOT, rock: SUPER, steel: SUPER },
  flying:   { electric: NOT, grass: SUPER, fighting: SUPER, bug: SUPER, rock: NOT, steel: NOT },
  psychic:  { fighting: SUPER, poison: SUPER, psychic: NOT, dark: IMMUNE, steel: NOT },
  bug:      { fire: NOT, grass: SUPER, fighting: NOT, poison: NOT, flying: NOT, psychic: SUPER, ghost: NOT, dark: SUPER, steel: NOT, fairy: NOT },
  rock:     { fire: SUPER, ice: SUPER, fighting: NOT, ground: NOT, flying: SUPER, bug: SUPER, steel: NOT },
  ghost:    { normal: IMMUNE, psychic: SUPER, ghost: SUPER, dark: NOT },
  dragon:   { dragon: SUPER, steel: NOT, fairy: IMMUNE },
  dark:     { fighting: NOT, psychic: SUPER, ghost: SUPER, dark: NOT, fairy: NOT },
  steel:    { fire: NOT, water: NOT, electric: NOT, ice: SUPER, rock: SUPER, steel: NOT, fairy: SUPER },
  fairy:    { fire: NOT, fighting: SUPER, poison: NOT, dragon: SUPER, dark: SUPER, steel: NOT },
};

/** Multiplicador total de un tipo de ataque contra uno o dos tipos defensores. */
export function typeEffectiveness(atkType, defTypes) {
  let mult = 1;
  const row = TYPECHART[atkType] || {};
  for (const d of defTypes) mult *= (row[d] ?? 1);
  return mult;
}

export const ALL_TYPES = Object.keys(TYPECHART);
