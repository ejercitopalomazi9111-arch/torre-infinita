// rng.js — Generador de números pseudoaleatorios SEMBRADO y reproducible.
// Sin dependencias. Usable en Node (tests/smoke) y navegador (Phaser).
//
// mulberry32: rápido, buena distribución para juego, periodo suficiente.
// La reproducibilidad por semilla es requisito del generador de torre (D).

/** Convierte un string o número en una semilla uint32 estable. */
export function hashSeed(seed) {
  if (typeof seed === 'number') return seed >>> 0;
  let h = 1779033703 ^ String(seed).length;
  for (let i = 0; i < String(seed).length; i++) {
    h = Math.imul(h ^ String(seed).charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return (h >>> 0);
}

/** Crea un RNG con métodos de conveniencia. Determinista para una misma semilla. */
export function makeRNG(seed) {
  let a = hashSeed(seed);
  function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    /** float en [0,1) */
    float: next,
    /** entero en [min, max] inclusivo */
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    /** true con probabilidad p */
    chance: (p) => next() < p,
    /** elige un elemento al azar */
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    /** baraja Fisher-Yates IN PLACE y devuelve el array */
    shuffle: (arr) => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },
    /** elige según pesos {valor: peso} */
    weighted: (entries) => {
      const keys = Object.keys(entries);
      let total = 0;
      for (const k of keys) total += entries[k];
      let r = next() * total;
      for (const k of keys) { r -= entries[k]; if (r <= 0) return k; }
      return keys[keys.length - 1];
    },
    /** semilla derivada determinista (para sub-sistemas) */
    derive: (tag) => makeRNG(hashSeed(`${a}:${tag}`)),
  };
}
