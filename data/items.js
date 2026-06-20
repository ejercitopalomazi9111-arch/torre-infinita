// items.js — OBJETOS EQUIPABLES (held items), BAYAS y DISCOS DE HABILIDAD.
// Sprites oficiales (PokeAPI, tools/fetch-items.mjs). DATA-DRIVEN: el motor
// (battle.js + abilities.js) interpreta los campos de efecto.

// ---- OBJETOS EQUIPABLES (uno por Pokémon, ranura "objeto") ----
export const HELD = {
  restos:          { file: 'leftovers',     name: 'Restos',           desc: 'Migajas mágicas: recupera un poquito de PS cada turno.', endTurnHeal: 1 / 16 },
  vidasfera:       { file: 'life-orb',       name: 'Vidasfera',        desc: 'Pega un 30% más fuerte... a costa de un pellizco de PS.', dmgMult: 1.3, recoil: 0.1 },
  bandafocus:      { file: 'focus-sash',     name: 'Banda Focus',      desc: 'Si estaba a tope, aguanta a 1 PS un golpe letal. Un solo uso.', survive: true, oneUse: true },
  cintaelegida:    { file: 'choice-band',    name: 'Cinta Elegida',    desc: 'Sube el Ataque un 50%. ¡Pura fuerza bruta!', atkMult: 1.5 },
  gafaselegidas:   { file: 'choice-specs',   name: 'Gafas Elegidas',   desc: 'Sube el Ataque Especial un 50%. Cerebrito ofensivo.', spaMult: 1.5 },
  panueloelegido:  { file: 'choice-scarf',   name: 'Pañuelo Elegido',  desc: 'Sube la Velocidad un 50%. Siempre llega primero.', speMult: 1.5 },
  piedraeterna:    { file: 'everstone',      name: 'Piedra Eterna',    desc: 'Quien la lleva NO evoluciona. Para los que quieren quedarse pequeños.', noEvolve: true },
  // OBJETOS DE FENÓMENO (gimmick): habilitan Mega/Z en combate SOLO si se equipan.
  megastone:       { file: 'mega-ring',       name: 'Piedra Mega',      desc: 'Permite MEGAEVOLUCIONAR en combate, pero SOLO a especies que pueden (p.ej. Charizard). Equípasela.', gimmick: 'mega' },
  zcrystal:        { file: 'z-ring',          name: 'Cristal Z',        desc: 'Convierte tu próximo golpe en el MOVIMIENTO Z de SU TIPO (×1.8, hay uno por tipo). Un uso por combate.', gimmick: 'z' },
  maxiband:        { file: 'max-elixir',      name: 'Maxibanda',        desc: 'Permite DINAMAX: el Pokémon se hace GIGANTE y sus golpes pegan como Movimientos Max.', gimmick: 'dynamax' },
};

// ESPECIES que PUEDEN megaevolucionar (Pokédex id). Sin esto + Piedra Mega, no hay
// Mega (antes un Charmander Nv1 megaevolucionaba; eso es incorrecto).
export const MEGA_SPECIES = new Set([
  3, 6, 9, 15, 18, 65, 80, 94, 115, 127, 130, 142, 150, 181, 208, 212, 214, 229, 248,
  254, 257, 260, 282, 302, 303, 306, 308, 310, 319, 323, 334, 354, 359, 362, 373, 376,
  380, 381, 428, 445, 448, 460, 475, 531, 719,
]);

// ---- BAYAS (se consumen; se equipan en la ranura "objeto") ----
// healFlat/healFrac: cura al bajar de la mitad. cure: estado que limpia al sufrirlo.
// resist: tipo cuyo golpe supereficaz reduce a la mitad (un solo uso).
export const BERRIES = {
  bayaaranja:  { file: 'oran-berry',    name: 'Baya Aranja',  desc: 'Cura 10 PS cuando andas bajo de vida.', healFlat: 10, trigger: 'lowhp', oneUse: true },
  bayazidra:   { file: 'sitrus-berry',  name: 'Baya Zidra',   desc: 'Cura un cuarto de tus PS cuando bajas de la mitad.', healFrac: 0.25, trigger: 'lowhp', oneUse: true },
  bayameloc:   { file: 'pecha-berry',   name: 'Baya Meloc',   desc: 'Cura el envenenamiento al instante.', cure: 'poison', oneUse: true },
  bayaziuela:  { file: 'lum-berry',     name: 'Baya Ziuela',  desc: 'Cura cualquier problema de estado.', cure: 'any', oneUse: true },
  bayaguinda:  { file: 'cheri-berry',   name: 'Baya Guinda',  desc: 'Cura la parálisis. Picante despertar.', cure: 'paralysis', oneUse: true },
  bayazreza:   { file: 'chesto-berry',  name: 'Baya Zreza',   desc: 'Espabila del sueño de golpe.', cure: 'sleep', oneUse: true },
  bayaratan:   { file: 'rawst-berry',   name: 'Baya Ratán',   desc: 'Calma las quemaduras al momento.', cure: 'burn', oneUse: true },
  bayacaspio:  { file: 'aspear-berry',  name: 'Baya Caspio',  desc: 'Descongela en un parpadeo.', cure: 'freeze', oneUse: true },
  bayacaoba:   { file: 'occa-berry',    name: 'Baya Caoba',   desc: 'Amortigua a la mitad un golpe de FUEGO supereficaz.', resist: 'fire', oneUse: true },
  bayapasio:   { file: 'passho-berry',  name: 'Baya Pasio',   desc: 'Amortigua a la mitad un golpe de AGUA supereficaz.', resist: 'water', oneUse: true },
  bayaacardo:  { file: 'wacan-berry',   name: 'Baya Acardo',  desc: 'Amortigua a la mitad un golpe ELÉCTRICO supereficaz.', resist: 'electric', oneUse: true },
};

// ---- DISCOS DE HABILIDAD ----
// Cada disco ENSEÑA una habilidad a un Pokémon del equipo (cambia su ranura de
// habilidad). Usa el sprite de la Cápsula de Habilidad. ability = id real.
export const DISCS = {
  disco_intimidacion: { file: 'ability-capsule', name: 'Disco: Intimidación', ability: 'intimidate', desc: 'Graba INTIMIDACIÓN: baja el Ataque del rival al entrar.' },
  disco_espesura:     { file: 'ability-capsule', name: 'Disco: Espesura',     ability: 'overgrow',   desc: 'Graba ESPESURA: ataques planta feroces al borde del K.O.' },
  disco_marllamas:    { file: 'ability-capsule', name: 'Disco: Mar Llamas',   ability: 'blaze',      desc: 'Graba MAR LLAMAS: fuego potenciado con pocos PS.' },
  disco_torrente:     { file: 'ability-capsule', name: 'Disco: Torrente',     ability: 'torrent',    desc: 'Graba TORRENTE: agua potenciada con pocos PS.' },
  disco_agallas:      { file: 'ability-capsule', name: 'Disco: Agallas',      ability: 'guts',       desc: 'Graba AGALLAS: +Ataque cuando tiene un problema de estado.' },
  disco_robustez:     { file: 'ability-capsule', name: 'Disco: Robustez',     ability: 'sturdy',     desc: 'Graba ROBUSTEZ: sobrevive a 1 PS un golpe letal desde full.' },
  disco_levitacion:   { file: 'ability-capsule', name: 'Disco: Levitación',   ability: 'levitate',   desc: 'Graba LEVITACIÓN: inmune a ataques de tierra.' },
  disco_potencia:     { file: 'ability-capsule', name: 'Disco: Potencia',     ability: 'huge-power', desc: 'Graba POTENCIA: dobla el Ataque. ¡Bestial!' },
  disco_impulso:      { file: 'ability-capsule', name: 'Disco: Impulso',      ability: 'speed-boost',desc: 'Graba IMPULSO: gana Velocidad cada turno.' },
};

// índice unificado por clave de bolsa
export const ITEMS = { ...HELD, ...BERRIES, ...DISCS };
export function itemKind(key) {
  if (HELD[key]) return 'held';
  if (BERRIES[key]) return 'berry';
  if (DISCS[key]) return 'disc';
  return null;
}
export function isHoldable(key) { return !!(HELD[key] || BERRIES[key]); }
