// moves.js — DATA-DRIVEN. Catálogo inicial de movimientos (ampliable por editor).
// cat: 'physical' | 'special' | 'status'. power en null para status.
// effect: descriptor serializable que la máquina de combate interpreta.
// anim: clave para el motor de animaciones de ataque (sección N).

export const MOVES = {
  // --- normal ---
  tackle:        { name: 'Placaje', type: 'normal', cat: 'physical', power: 40, acc: 100, pp: 35, prio: 0, anim: 'dash' },
  scratch:       { name: 'Arañazo', type: 'normal', cat: 'physical', power: 40, acc: 100, pp: 35, prio: 0, anim: 'slash' },
  quick_attack:  { name: 'Ataque Rápido', type: 'normal', cat: 'physical', power: 40, acc: 100, pp: 30, prio: 1, anim: 'dash' },
  body_slam:     { name: 'Golpe Cuerpo', type: 'normal', cat: 'physical', power: 85, acc: 100, pp: 15, prio: 0, effect: { status: 'paralysis', chance: 0.3 }, anim: 'impact' },
  growl:         { name: 'Gruñido', type: 'normal', cat: 'status', power: null, acc: 100, pp: 40, prio: 0, effect: { stat: 'atk', stages: -1, target: 'foe' }, anim: 'buff' },
  // --- fire ---
  ember:         { name: 'Ascuas', type: 'fire', cat: 'special', power: 40, acc: 100, pp: 25, prio: 0, effect: { status: 'burn', chance: 0.1 }, anim: 'projectile' },
  flamethrower:  { name: 'Lanzallamas', type: 'fire', cat: 'special', power: 90, acc: 100, pp: 15, prio: 0, effect: { status: 'burn', chance: 0.1 }, anim: 'beam' },
  fire_fang:     { name: 'Colmillo Ígneo', type: 'fire', cat: 'physical', power: 65, acc: 95, pp: 15, prio: 0, effect: { status: 'burn', chance: 0.1 }, anim: 'bite' },
  // --- water ---
  water_gun:     { name: 'Pistola Agua', type: 'water', cat: 'special', power: 40, acc: 100, pp: 25, prio: 0, anim: 'projectile' },
  surf:          { name: 'Surf', type: 'water', cat: 'special', power: 90, acc: 100, pp: 15, prio: 0, anim: 'wave' },
  aqua_jet:      { name: 'Acua Jet', type: 'water', cat: 'physical', power: 40, acc: 100, pp: 20, prio: 1, anim: 'dash' },
  // --- grass ---
  vine_whip:     { name: 'Látigo Cepa', type: 'grass', cat: 'physical', power: 45, acc: 100, pp: 25, prio: 0, anim: 'whip' },
  razor_leaf:    { name: 'Hoja Afilada', type: 'grass', cat: 'physical', power: 55, acc: 95, pp: 25, prio: 0, crit: 1, anim: 'projectile' },
  energy_ball:   { name: 'Energibola', type: 'grass', cat: 'special', power: 90, acc: 100, pp: 10, prio: 0, effect: { stat: 'spd', stages: -1, chance: 0.1, target: 'foe' }, anim: 'orb' },
  // --- electric ---
  thunder_shock: { name: 'Impactrueno', type: 'electric', cat: 'special', power: 40, acc: 100, pp: 30, prio: 0, effect: { status: 'paralysis', chance: 0.1 }, anim: 'spark' },
  thunderbolt:   { name: 'Rayo', type: 'electric', cat: 'special', power: 90, acc: 100, pp: 15, prio: 0, effect: { status: 'paralysis', chance: 0.1 }, anim: 'bolt' },
  thunder_wave:  { name: 'Onda Trueno', type: 'electric', cat: 'status', power: null, acc: 90, pp: 20, prio: 0, effect: { status: 'paralysis', target: 'foe' }, anim: 'spark' },
  // --- flying ---
  gust:          { name: 'Tornado', type: 'flying', cat: 'special', power: 40, acc: 100, pp: 35, prio: 0, anim: 'wind' },
  air_slash:     { name: 'Tajo Aéreo', type: 'flying', cat: 'special', power: 75, acc: 95, pp: 15, prio: 0, anim: 'slash' },
  // --- psychic ---
  confusion:     { name: 'Confusión', type: 'psychic', cat: 'special', power: 50, acc: 100, pp: 25, prio: 0, anim: 'orb' },
  psychic:       { name: 'Psíquico', type: 'psychic', cat: 'special', power: 90, acc: 100, pp: 10, prio: 0, effect: { stat: 'spd', stages: -1, chance: 0.1, target: 'foe' }, anim: 'orb' },
  // --- ghost / dark ---
  shadow_ball:   { name: 'Bola Sombra', type: 'ghost', cat: 'special', power: 80, acc: 100, pp: 15, prio: 0, anim: 'orb' },
  lick:          { name: 'Lengüetazo', type: 'ghost', cat: 'physical', power: 30, acc: 100, pp: 30, prio: 0, effect: { status: 'paralysis', chance: 0.3 }, anim: 'impact' },
  bite:          { name: 'Mordisco', type: 'dark', cat: 'physical', power: 60, acc: 100, pp: 25, prio: 0, anim: 'bite' },
  crunch:        { name: 'Triturar', type: 'dark', cat: 'physical', power: 80, acc: 100, pp: 15, prio: 0, effect: { stat: 'def', stages: -1, chance: 0.2, target: 'foe' }, anim: 'bite' },
  // --- ground / rock ---
  rock_throw:    { name: 'Lanzarrocas', type: 'rock', cat: 'physical', power: 50, acc: 90, pp: 15, prio: 0, anim: 'projectile' },
  earthquake:    { name: 'Terremoto', type: 'ground', cat: 'physical', power: 100, acc: 100, pp: 10, prio: 0, anim: 'quake' },
  // --- ice ---
  powder_snow:   { name: 'Nieve Polvo', type: 'ice', cat: 'special', power: 40, acc: 100, pp: 25, prio: 0, effect: { status: 'freeze', chance: 0.1 }, anim: 'projectile' },
  ice_beam:      { name: 'Rayo Hielo', type: 'ice', cat: 'special', power: 90, acc: 100, pp: 10, prio: 0, effect: { status: 'freeze', chance: 0.1 }, anim: 'beam' },
  // --- dragon ---
  dragon_claw:   { name: 'Garra Dragón', type: 'dragon', cat: 'physical', power: 80, acc: 100, pp: 15, prio: 0, anim: 'slash' },
  // --- poison ---
  sludge_bomb:   { name: 'Bomba Lodo', type: 'poison', cat: 'special', power: 90, acc: 100, pp: 10, prio: 0, effect: { status: 'poison', chance: 0.3 }, anim: 'orb' },
  poison_sting:  { name: 'Picotazo Ven.', type: 'poison', cat: 'physical', power: 15, acc: 100, pp: 35, prio: 0, effect: { status: 'poison', chance: 0.3 }, anim: 'projectile' },
  // --- fighting ---
  aura_sphere:   { name: 'Esfera Aural', type: 'fighting', cat: 'special', power: 80, acc: 999, pp: 20, prio: 0, anim: 'orb' },
  brick_break:   { name: 'Demolición', type: 'fighting', cat: 'physical', power: 75, acc: 100, pp: 15, prio: 0, anim: 'impact' },
  // --- steel / bug / fairy ---
  iron_tail:     { name: 'Cola Férrea', type: 'steel', cat: 'physical', power: 100, acc: 75, pp: 15, prio: 0, effect: { stat: 'def', stages: -1, chance: 0.3, target: 'foe' }, anim: 'slash' },
  metal_claw:    { name: 'Garra Metal', type: 'steel', cat: 'physical', power: 50, acc: 95, pp: 35, prio: 0, anim: 'slash' },
  bug_bite:      { name: 'Picadura', type: 'bug', cat: 'physical', power: 60, acc: 100, pp: 20, prio: 0, anim: 'bite' },
  moonblast:     { name: 'Fuerza Lunar', type: 'fairy', cat: 'special', power: 95, acc: 100, pp: 15, prio: 0, effect: { stat: 'spa', stages: -1, chance: 0.3, target: 'foe' }, anim: 'orb' },
  fairy_wind:    { name: 'Viento Feérico', type: 'fairy', cat: 'special', power: 40, acc: 100, pp: 30, prio: 0, anim: 'wind' },
  // struggle (fallback)
  struggle:      { name: 'Forcejeo', type: 'normal', cat: 'physical', power: 50, acc: 999, pp: 1, prio: 0, recoil: 0.25, anim: 'impact' },
};

// movimiento "bueno" por tipo (para asignar movepools por tipo)
export const STRONG_BY_TYPE = {
  normal: 'body_slam', fire: 'flamethrower', water: 'surf', electric: 'thunderbolt',
  grass: 'energy_ball', ice: 'ice_beam', fighting: 'aura_sphere', poison: 'sludge_bomb',
  ground: 'earthquake', flying: 'air_slash', psychic: 'psychic', bug: 'bug_bite',
  rock: 'rock_throw', ghost: 'shadow_ball', dragon: 'dragon_claw', dark: 'crunch',
  steel: 'iron_tail', fairy: 'moonblast',
};
export const WEAK_BY_TYPE = {
  normal: 'tackle', fire: 'ember', water: 'water_gun', electric: 'thunder_shock',
  grass: 'vine_whip', ice: 'powder_snow', fighting: 'brick_break', poison: 'poison_sting',
  ground: 'rock_throw', flying: 'gust', psychic: 'confusion', bug: 'bug_bite',
  rock: 'rock_throw', ghost: 'lick', dragon: 'dragon_claw', dark: 'bite',
  steel: 'metal_claw', fairy: 'fairy_wind',
};
