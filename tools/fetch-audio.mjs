// fetch-audio.mjs — Música y CRIES reales desde el cliente Pokémon Showdown.
// BGM → assets/audio/bgm/ · cries → assets/audio/cries/<id>.ogg (por nº de dex).
// Genera data/cries.generated.js (manifest de ids con cry disponible).
// Uso: node tools/fetch-audio.mjs [desdeId] [hastaId]
import { writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SPECIES } from '../data/species.generated.js';

const FROM = parseInt(process.argv[2] || '1', 10);
const TO = parseInt(process.argv[3] || '576', 10);
const BASE = 'https://play.pokemonshowdown.com/audio/';
const BGM_DIR = fileURLToPath(new URL('../assets/audio/bgm/', import.meta.url));
const CRY_DIR = fileURLToPath(new URL('../assets/audio/cries/', import.meta.url));
mkdirSync(BGM_DIR, { recursive: true });
mkdirSync(CRY_DIR, { recursive: true });

async function get(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(r.status);
  return Buffer.from(await r.arrayBuffer());
}

// BGM verificados (música real de los juegos, vía Showdown)
const BGM = {
  explore: 'hgss-johto-trainer.mp3',
  battle: 'bw-trainer.mp3',
  replay: 'xy-trainer.mp3',
  boss: 'dpp-trainer.mp3',
};
for (const [k, f] of Object.entries(BGM)) {
  const dest = BGM_DIR + k + '.mp3';
  if (existsSync(dest)) continue;
  try { writeFileSync(dest, await get(BASE + f)); console.log('  ✓ bgm ' + k); }
  catch (e) { console.log('  ✗ bgm ' + k + ' (' + e.message + ')'); }
}

// CRIES por especie (nombre showdown = minúsculas sin signos)
const CONCURRENCY = 8;
const targets = SPECIES.filter(s => s.id >= FROM && s.id <= TO && !existsSync(CRY_DIR + s.id + '.ogg'));
let ok = 0, miss = 0, done = 0;
const norm = (n) => n.toLowerCase().replace(/[^a-z0-9]/g, '');
const queue = [...targets];
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (queue.length) {
    const s = queue.shift();
    try { writeFileSync(CRY_DIR + s.id + '.ogg', await get(`${BASE}cries/${norm(s.name)}.ogg`)); ok++; }
    catch { miss++; }
    if (++done % 40 === 0) process.stdout.write(`  ${done}/${targets.length} (ok ${ok}, sin cry ${miss})\r`);
  }
}));

// manifest: ids con cry local disponible
const have = readdirSync(CRY_DIR).filter(f => f.endsWith('.ogg')).map(f => parseInt(f, 10)).filter(Number.isFinite).sort((a, b) => a - b);
writeFileSync(new URL('../data/cries.generated.js', import.meta.url),
  '// GENERADO por tools/fetch-audio.mjs\nexport const CRIES = new Set(' + JSON.stringify(have) + ');\n');
console.log(`\n✅ Audio: ${Object.keys(BGM).length} BGM · cries ok ${ok}, sin cry ${miss}, total local ${have.length}`);
