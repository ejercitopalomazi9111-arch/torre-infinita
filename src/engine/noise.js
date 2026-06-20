// noise.js — Ruido SEMBRADO y reproducible (value noise + fBm).
// Sin dependencias. Usable en Node (tests/render) y navegador (Phaser).
// Se usa para: variación de texturas, decoración dispersa, bordes orgánicos
// de salas y mapas de calor de dificultad. Mismo seed → mismo resultado.

/** hash entero 2D → [0,1). Determinista. */
function hash2(ix, iy, seed) {
  let h = (ix | 0) * 374761393 + (iy | 0) * 668265263 + (seed | 0) * 2147483647;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10); // quintic smoothstep
const lerp = (a, b, t) => a + (b - a) * t;

/** Value noise 2D en [0,1). */
export function valueNoise2D(x, y, seed = 0) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = fade(x - x0), fy = fade(y - y0);
  const v00 = hash2(x0, y0, seed), v10 = hash2(x0 + 1, y0, seed);
  const v01 = hash2(x0, y0 + 1, seed), v11 = hash2(x0 + 1, y0 + 1, seed);
  return lerp(lerp(v00, v10, fx), lerp(v01, v11, fx), fy);
}

/**
 * fBm (ruido fractal): suma de octavas. Devuelve [0,1).
 * @param {object} o { octaves=4, freq=1, lacunarity=2, gain=0.5, seed=0 }
 */
export function fbm2D(x, y, o = {}) {
  const { octaves = 4, lacunarity = 2, gain = 0.5, seed = 0 } = o;
  let freq = o.freq ?? 1, amp = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise2D(x * freq, y * freq, seed + i * 1013);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}

/** Crea un campo de ruido reutilizable con parámetros fijos. */
export function makeNoiseField(opts = {}) {
  return {
    value: (x, y) => valueNoise2D(x, y, opts.seed ?? 0),
    fbm: (x, y) => fbm2D(x, y, opts),
    /** ridged noise (vetas/grietas): 1-|2v-1| acentuado */
    ridged: (x, y) => {
      const v = fbm2D(x, y, opts);
      const r = 1 - Math.abs(2 * v - 1);
      return r * r;
    },
  };
}
