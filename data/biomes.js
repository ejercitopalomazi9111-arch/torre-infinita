// biomes.js — DATA-DRIVEN. Tramos de pisos con identidad propia (sección D).
// Añadir un bioma = añadir una entrada. La lógica NO se toca.
//
// La torre tiene 9111 pisos. Los biomas se repiten en ciclos ascendentes
// con dificultad creciente; cada ciclo añade variantes. `span` = nº de pisos
// que ocupa cada bioma antes de pasar al siguiente dentro de un ciclo.

export const BIOMES = [
  {
    id: 'cuevas',
    name: 'Cuevas Resonantes',
    palette: { wall: '#3a2f4a', floor: '#5a4a6a', accent: '#8a6fb0' },
    dark: true,            // cueva: sin hierba/pueblo; salvajes en TODO el piso (usa repelente)
    music: 'bgm_cave',
    weather: ['none', 'none', 'fog'],
    typesFavored: ['rock', 'ground', 'bug'],
    ambient: 'Goteo de agua y ecos lejanos.',
  },
  {
    id: 'bosque',
    name: 'Bosque Susurrante',
    palette: { wall: '#23402a', floor: '#3f6b46', accent: '#9fd97f' },
    grassTint: 0xffffff,   // hierba alta: verde natural del sprite
    music: 'bgm_forest',
    weather: ['none', 'rain', 'none'],
    typesFavored: ['grass', 'bug', 'poison'],
    ambient: 'Hojas que se mueven sin viento.',
  },
  {
    id: 'ruinas',
    name: 'Ruinas Olvidadas',
    palette: { wall: '#4a4636', floor: '#726b50', accent: '#d8c98a' },
    grassTint: 0xc9b06a,   // hierba reseca/amarillenta entre la piedra
    music: 'bgm_ruins',
    weather: ['none', 'sand', 'none'],
    typesFavored: ['ground', 'psychic', 'ghost'],
    ambient: 'Inscripciones que nadie supo leer.',
  },
  {
    id: 'glaciar',
    name: 'Glaciar Silente',
    palette: { wall: '#2a4a5a', floor: '#6fa8c8', accent: '#e8f6ff' },
    dark: true,
    music: 'bgm_glacier',
    weather: ['none', 'snow', 'snow'],
    typesFavored: ['ice', 'water', 'flying'],
    ambient: 'El hielo cruje bajo tus pasos.',
  },
  {
    id: 'volcan',
    name: 'Corazón del Volcán',
    palette: { wall: '#4a1f1a', floor: '#8a3320', accent: '#ffb347' },
    dark: true,
    music: 'bgm_volcano',
    weather: ['none', 'sun', 'sun'],
    typesFavored: ['fire', 'rock', 'dragon'],
    ambient: 'El aire quema al respirar.',
  },
  {
    id: 'laboratorio',
    name: 'Laboratorio Sellado',
    palette: { wall: '#26323a', floor: '#3f5a66', accent: '#54e0c8' },
    dark: true,
    music: 'bgm_lab',
    weather: ['none', 'none', 'none'],
    typesFavored: ['electric', 'steel', 'poison'],
    ambient: 'Luces que parpadean en un código antiguo.',
  },
  {
    id: 'cielo',
    name: 'Torre Cielo',
    palette: { wall: '#3a4a7a', floor: '#7088c8', accent: '#fff3a8' },
    dark: true,            // cielo abierto: salvajes voladores por todas partes
    music: 'bgm_sky',
    weather: ['none', 'rain', 'sun'],
    typesFavored: ['flying', 'dragon', 'electric'],
    ambient: 'Las nubes quedan debajo de ti.',
  },
  {
    id: 'distorsion',
    name: 'Dimensión Distorsión',
    palette: { wall: '#2a1a3a', floor: '#4a2f6a', accent: '#ff6fd0' },
    dark: true,
    music: 'bgm_distortion',
    weather: ['none', 'fog', 'none'],
    typesFavored: ['ghost', 'psychic', 'dark'],
    ambient: 'La gravedad sugiere, no obliga.',
  },
  {
    id: 'pradera',
    name: 'Pradera Encantada',
    palette: { wall: '#4a7a4a', floor: '#7fc06a', accent: '#ffb0e0' },
    grassTint: 0xd6ffb0,   // hierba lozana y clara de la pradera
    music: 'bgm_sky',
    weather: ['none', 'none', 'sun'],
    typesFavored: ['fairy', 'grass', 'normal'],
    ambient: 'Flores que brillan suave y un aire dulce.',
  },
];

// Props de entorno por bioma (sprites FX reales de Showdown, assets/fx/).
// obstacles: bloquean la casilla (rodeables) · clutter: detalle visual pequeño.
export const BIOME_PROPS = {
  cuevas:      { obstacles: ['rock1', 'rock2', 'rock3'], clutter: ['rock3'] },
  bosque:      { obstacles: ['rock1', 'rock2'], clutter: ['leaf1', 'leaf2'] },
  ruinas:      { obstacles: ['rock2', 'rock3'], clutter: ['gear'] },
  glaciar:     { obstacles: ['icicle', 'iceball'], clutter: ['icicle'] },
  volcan:      { obstacles: ['rock1', 'rock3'], clutter: ['fireball'], tint: 0xffb088 },
  laboratorio: { obstacles: ['gear'], clutter: ['electroball'] },
  cielo:       { obstacles: ['wisp'], clutter: ['feather'] },
  distorsion:  { obstacles: ['shadowball'], clutter: ['blackwisp', 'mistball'] },
  pradera:     { obstacles: ['rock1', 'rock2'], clutter: ['leaf1', 'leaf2', 'heart'] },
};

export const BIOME_SPAN = 25; // pisos por bioma dentro de un ciclo

// PRNG sembrado (mulberry32) a partir de un string → orden de biomas por run.
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < String(s).length; i++) { h ^= String(s).charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
/** Permutación barajada de [0..n-1] determinista para (seed, cycle). */
function shuffledOrder(seed, cycle, n) {
  let a = hashStr(`${seed}|biomecycle:${cycle}`);
  const rnd = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const ord = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [ord[i], ord[j]] = [ord[j], ord[i]]; }
  return ord;
}

/** Devuelve el bioma (con ciclo y dificultad) para un piso dado. El ORDEN de
 *  biomas se baraja por `seed` (cada partida es distinta); el piso 1 siempre es
 *  bosque (Ruta 1) y dentro de una run el orden es reproducible. */
export function biomeForFloor(floor, seed = '') {
  const cycle = Math.floor((floor - 1) / (BIOME_SPAN * BIOMES.length));
  let idx;
  if (floor === 1) {
    idx = 1;                                 // bosque, como la Ruta 1 de los clásicos
  } else {
    const pos = Math.floor((floor - 1) / BIOME_SPAN) % BIOMES.length;
    idx = seed ? shuffledOrder(seed, cycle, BIOMES.length)[pos] : pos;
  }
  const base = BIOMES[idx];
  return {
    ...base,
    cycle,                                   // 0,1,2... endurece el bioma
    weather: base.weather,
    difficultyMult: 1 + cycle * 0.35,        // cada ciclo sube la apuesta
  };
}
