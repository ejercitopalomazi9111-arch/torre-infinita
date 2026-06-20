// fetch-walk.mjs — Hojas de CAMINAR reales por Pokémon desde PMD SpriteCollab
// (github.com/PMDCollab/SpriteCollab, proyecto fan abierto). 8 direcciones por
// filas: 0=abajo 1=abajo-der 2=der 3=arriba-der 4=arriba 5=arriba-izq 6=izq 7=abajo-izq.
// Guarda assets/sprites/walk/<id>.png + data/walkmeta.generated.js {id:{fw,fh,frames}}.
// Idempotente. Uso: node tools/fetch-walk.mjs [desde] [hasta]
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FROM = parseInt(process.argv[2] || '1', 10);
const TO = parseInt(process.argv[3] || '251', 10);
const CONCURRENCY = 6;
const BASE = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/sprite/';
const OUT = fileURLToPath(new URL('../assets/sprites/walk/', import.meta.url));
const META = new URL('../data/walkmeta.generated.js', import.meta.url);
mkdirSync(OUT, { recursive: true });

let prev = {};
if (existsSync(META)) {
  try { prev = (await import(META.href + '?t=' + Date.now())).WALKMETA || {}; } catch { /* */ }
}

async function get(url, tries = 2) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!r.ok) throw new Error(r.status);
      return r;
    } catch (e) { if (i === tries - 1) throw e; await new Promise(r2 => setTimeout(r2, 500)); }
  }
}

const ids = []; for (let i = FROM; i <= TO; i++) if (!prev[i]) ids.push(i);
let done = 0, added = 0, missing = 0;

async function one(id) {
  const pad = String(id).padStart(4, '0');
  try {
    const xml = await (await get(BASE + pad + '/AnimData.xml')).text();
    const m = xml.match(/<Anim>\s*<Name>Walk<\/Name>[\s\S]*?<FrameWidth>(\d+)<\/FrameWidth>\s*<FrameHeight>(\d+)<\/FrameHeight>/);
    if (!m) { missing++; return; }
    const fw = +m[1], fh = +m[2];
    const png = Buffer.from(await (await get(BASE + pad + '/Walk-Anim.png')).arrayBuffer());
    const width = png.readUInt32BE(16);                 // IHDR
    const frames = Math.floor(width / fw);
    writeFileSync(OUT + id + '.png', png);
    prev[id] = { fw, fh, frames };
    added++;
  } catch { missing++; }
  finally { done++; if (done % 20 === 0) process.stdout.write(`  ${done}/${ids.length} (ok ${added}, sin hoja ${missing})\r`); }
}

const queue = [...ids];
await Promise.all(Array.from({ length: CONCURRENCY }, async () => { while (queue.length) await one(queue.shift()); }));

const body = '// GENERADO por tools/fetch-walk.mjs — hojas de caminar PMD SpriteCollab\n'
  + 'export const WALKMETA = ' + JSON.stringify(prev) + ';\n';
writeFileSync(META, body);
console.log(`\n✅ Walk: ${Object.keys(prev).length} Pokémon con hoja de caminar (nuevos ${added}, sin hoja ${missing}).`);
