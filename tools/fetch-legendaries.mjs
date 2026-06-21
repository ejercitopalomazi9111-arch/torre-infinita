// fetch-legendaries.mjs — Baja de PokeAPI qué especies son LEGENDARIAS o MÍTICAS
// (endpoint /pokemon-species/{id}: is_legendary || is_mythical) y escribe un Set
// data-driven a data/legendaries.generated.js. Se FUSIONA con la lista hardcodeada
// de FloorScene (que además trae pseudolegendarios) → nunca aparecen al azar.
// Uso: node tools/fetch-legendaries.mjs [desde] [hasta]   (por defecto 1..1025)

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FROM = parseInt(process.argv[2] || '1', 10);
const TO = parseInt(process.argv[3] || '1025', 10);
const CONCURRENCY = 12;
const OUT = fileURLToPath(new URL('../data/legendaries.generated.js', import.meta.url));

async function get(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!r.ok) throw new Error(`${r.status}`);
      return r;
    } catch (e) { if (i === tries - 1) throw e; await new Promise(r => setTimeout(r, 500 * (i + 1))); }
  }
}

const ids = [];
for (let id = FROM; id <= TO; id++) ids.push(id);
const legend = new Set();
let done = 0, failed = 0;

async function worker(queue) {
  while (queue.length) {
    const id = queue.shift();
    try {
      const sp = await (await get(`https://pokeapi.co/api/v2/pokemon-species/${id}`)).json();
      if (sp.is_legendary || sp.is_mythical) legend.add(id);
    } catch { failed++; }
    if (++done % 100 === 0 || done === ids.length) process.stdout.write(`  ${done}/${ids.length} (legendarios ${legend.size}, fallos ${failed})\r`);
  }
}

const q = ids.slice();
await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(q)));

const sorted = [...legend].sort((a, b) => a - b);
writeFileSync(OUT, `// AUTO-GENERADO por tools/fetch-legendaries.mjs — NO editar a mano.\n` +
  `// IDs de especies LEGENDARIAS o MÍTICAS (PokeAPI is_legendary || is_mythical).\n` +
  `// Se fusiona con la exclusión de encuentros salvajes en FloorScene.\n` +
  `export const LEGENDARY_IDS = ${JSON.stringify(sorted)};\n`);
console.log(`\n✅ ${sorted.length} legendarios/míticos → data/legendaries.generated.js (fallos ${failed})`);
