// fetch-sprites.mjs — Cachea Pokémon REALES desde PokeAPI (D-002).
// Sprite + stats base + tipos + habilidades + peso/altura/exp, guardados LOCAL
// para no depender de red en runtime. Idempotente (salta lo ya bajado),
// concurrente y con reintentos.
//
// Uso:  node tools/fetch-sprites.mjs [desde] [hasta]
//   p.ej.  node tools/fetch-sprites.mjs 1 386   (Gen 1-3)
//          node tools/fetch-sprites.mjs          (por defecto 1..386)

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';

const FROM = parseInt(process.argv[2] || '1', 10);
const TO = parseInt(process.argv[3] || '386', 10);
const CONCURRENCY = 8;

const SPRITES = new URL('../assets/sprites/pokemon/', import.meta.url);
const DATA = new URL('../data/species.generated.js', import.meta.url);
mkdirSync(SPRITES, { recursive: true });

async function get(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!r.ok) throw new Error(`${r.status}`);
      return r;
    } catch (e) { if (i === tries - 1) throw e; await new Promise(r => setTimeout(r, 600 * (i + 1))); }
  }
}

// carga roster previo (para fusionar, no perder lo ya cacheado)
let prev = [];
if (existsSync(DATA)) {
  try { const m = await import(DATA.href + '?t=' + Date.now()); prev = m.SPECIES || []; } catch { /* ignore */ }
}
const byId = new Map(prev.map(s => [s.id, s]));

const ids = [];
for (let id = FROM; id <= TO; id++) ids.push(id);
let done = 0, added = 0, failed = 0;

async function worker(queue) {
  while (queue.length) {
    const id = queue.shift();
    try {
      const data = await (await get(`https://pokeapi.co/api/v2/pokemon/${id}`)).json();
      const file = new URL(`${id}.png`, SPRITES);
      if (!existsSync(file)) {
        const png = Buffer.from(await (await get(data.sprites.front_default)).arrayBuffer());
        writeFileSync(file, png);
      }
      const stat = (n) => data.stats.find(s => s.stat.name === n).base_stat;
      const rec = {
        id, name: data.name,
        types: data.types.map(t => t.type.name),
        base: { hp: stat('hp'), atk: stat('attack'), def: stat('defense'), spa: stat('special-attack'), spd: stat('special-defense'), spe: stat('speed') },
        abilities: data.abilities.map(a => ({ name: a.ability.name, hidden: a.is_hidden })),
        height: data.height, weight: data.weight, baseExp: data.base_experience ?? 0,
        sprite: `assets/sprites/pokemon/${id}.png`,
      };
      if (!byId.has(id)) added++;
      byId.set(id, rec);
    } catch (e) { failed++; process.stderr.write(`\n  ✗ #${id}: ${e.message}`); }
    done++;
    if (done % 20 === 0 || done === ids.length) process.stdout.write(`\r  ${done}/${ids.length} (nuevos ${added}, fallos ${failed})   `);
  }
}

const queue = [...ids];
await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(queue)));

const species = [...byId.values()].sort((a, b) => a.id - b.id);
const out = `// AUTO-GENERADO por tools/fetch-sprites.mjs — NO editar a mano.
// Stats base + habilidades REALES de PokeAPI. Fuente única para computeStats (A-01).
// Total: ${species.length} Pokémon.
export const SPECIES = ${JSON.stringify(species)};
export const SPECIES_BY_ID = Object.fromEntries(SPECIES.map(s => [s.id, s]));
export const SPECIES_BY_TYPE = SPECIES.reduce((m, s) => { for (const t of s.types) (m[t] ||= []).push(s.id); return m; }, {});
`;
writeFileSync(DATA, out);
console.log(`\n✅ Roster: ${species.length} Pokémon en data/species.generated.js (nuevos ${added}, fallos ${failed}).`);
