// fetch-evos.mjs — Cadenas de EVOLUCIÓN reales (PokeAPI evolution-chain).
// Solo trigger level-up con min_level por ahora → data/evos.generated.js
// { idPadre: { to: idHijo, level: N } }
import { writeFileSync } from 'node:fs';

const MAX_CHAIN = 265;   // cubre Gen 1-5
const evos = {};
const idOf = (url) => parseInt(url.split('/').filter(Boolean).pop(), 10);

function walk(node) {
  const from = idOf(node.species.url);
  for (const child of node.evolves_to || []) {
    const to = idOf(child.species.url);
    const det = (child.evolution_details || []).find(d => d.trigger?.name === 'level-up' && d.min_level);
    if (det && from <= 576 && to <= 576) evos[from] = { to, level: det.min_level };
    walk(child);
  }
}

let ok = 0, fail = 0;
const queue = Array.from({ length: MAX_CHAIN }, (_, i) => i + 1);
await Promise.all(Array.from({ length: 8 }, async () => {
  while (queue.length) {
    const i = queue.shift();
    try {
      const r = await fetch(`https://pokeapi.co/api/v2/evolution-chain/${i}/`, { signal: AbortSignal.timeout(20000) });
      if (!r.ok) throw new Error(r.status);
      walk((await r.json()).chain);
      ok++;
    } catch { fail++; }
  }
}));

writeFileSync(new URL('../data/evos.generated.js', import.meta.url),
  '// GENERADO por tools/fetch-evos.mjs — evoluciones por subida de nivel\nexport const EVOS = ' + JSON.stringify(evos) + ';\n');
console.log(`✅ Evoluciones: ${Object.keys(evos).length} (cadenas ok ${ok}, fallos ${fail})`);
