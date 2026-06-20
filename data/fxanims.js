// fxanims.js — LIBRERÍA de animaciones de ataque (200+), DATA-DRIVEN y GENERADA.
// Cada config = { motion, c, c2, tex } y se renderiza en fxPlayer.renderAnim con
// formas (círculos/líneas/triángulos) coloreadas + texturas fx_ reales. Se combinan
// muchos PATRONES de movimiento × PALETA por tipo × variantes → cada movimiento
// recibe una animación distinta y coherente con su tipo (sin reciclar todo).

// Paleta (color primario + secundario) por TIPO.
export const TYPE_PAL = {
  normal:[0xf0e8c0,0xa8a070], fire:[0xff7a30,0xffd060], water:[0x4f9fe0,0xbfe8ff], electric:[0xffe23a,0xfff7a0],
  grass:[0x6fd060,0xcaf0a0], ice:[0x9fe0f0,0xffffff], fighting:[0xe06030,0xffb080], poison:[0xb060d0,0xe0a0ff],
  ground:[0xc89a4a,0xe8c890], flying:[0xa8c0f0,0xe0ecff], psychic:[0xff6fb0,0xffc0e0], bug:[0x9fc040,0xd0f080],
  rock:[0xb09060,0xe0c890], ghost:[0x7a5fb0,0xc0a0f0], dragon:[0x6f70d0,0xb0b0ff], dark:[0x6a5a6a,0xb09ab0],
  steel:[0xb8c0d0,0xeef2ff], fairy:[0xff9fd0,0xffd8ef],
};
// Texturas fx_ sugeridas por tipo (si existen; si no, formas).
const TYPE_TEX = {
  fire:['fireball'], water:['waterwisp','iceball'], electric:['electroball','lightning'], grass:['leaf1','leaf2','energyball'],
  ice:['icicle','iceball'], poison:['poisonwisp'], ground:['mudwisp','rock1'], rock:['rock1','rock2','rock3'],
  ghost:['shadowball','blackwisp'], psychic:['mistball','energyball'], bug:['web','energyball'], flying:['feather','wisp'],
  dragon:['energyball','shadowball'], dark:['blackwisp','shadowball'], steel:['fist','sword'], fairy:['heart','shine'],
  fighting:['fist','foot'], normal:['shine','fist'],
};

// PATRONES de movimiento (renderizados en fxPlayer). Cuantos más, más variedad.
export const MOTIONS = [
  'projectile', 'burst', 'rain', 'strike', 'bolt',          // los clásicos
  'beam', 'slashArc', 'spiral', 'shockwave', 'vortex',      // nuevos
  'meteor', 'multiStrike', 'charge', 'wave', 'spikes',
  'orbit', 'crush', 'lasers', 'gust', 'comet',
  'ring', 'zigzag', 'rainUp', 'twin', 'nova',
];

// Genera la LIBRERÍA: por cada tipo, una config con cada motion (≈18×25 = 450).
function buildLibrary() {
  const lib = {};
  for (const [type, pal] of Object.entries(TYPE_PAL)) {
    const texs = TYPE_TEX[type] || [];
    MOTIONS.forEach((motion, mi) => {
      lib[`${type}_${motion}`] = { type, motion, c: pal[0], c2: pal[1], tex: texs[mi % Math.max(1, texs.length)] || null };
    });
  }
  return lib;
}
export const FX_ANIMS = buildLibrary();
export const FX_ANIM_COUNT = Object.keys(FX_ANIMS).length;

function hashStr(s) { let h = 2166136261; for (let i = 0; i < String(s).length; i++) { h ^= String(s).charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

/** Animación para un movimiento: determinista por su id (cada mov se ve distinto),
 *  pero coherente con su TIPO (usa la paleta del tipo). */
export function animForMove(moveId, type) {
  const t = TYPE_PAL[type] ? type : 'normal';
  const motion = MOTIONS[hashStr(moveId) % MOTIONS.length];
  return FX_ANIMS[`${t}_${motion}`] || FX_ANIMS['normal_burst'];
}
