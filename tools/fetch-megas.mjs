// fetch-megas.mjs — FORMAS MEGA reales (sprite + tipos + stats) desde PokeAPI,
// para las especies que megaevolucionan (data/items.js MEGA_SPECIES). Escribe
// data/megas.generated.js: { <id>: { name, types[], base{hp,atk,def,spa,spd,spe}, x?, y? } }
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MEGA_SPECIES } from '../data/items.js';

const OUT_DIR = fileURLToPath(new URL('../assets/sprites/pokemon/', import.meta.url));
mkdirSync(OUT_DIR, { recursive: true });
const API = 'https://pokeapi.co/api/v2';
const STAT = { hp: 'hp', attack: 'atk', defense: 'def', 'special-attack': 'spa', 'special-defense': 'spd', speed: 'spe' };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function getJSON(url) { const r = await fetch(url, { signal: AbortSignal.timeout(20000) }); if (!r.ok) throw new Error(r.status); return r.json(); }
async function dl(url, dst) { const r = await fetch(url, { signal: AbortSignal.timeout(20000) }); if (!r.ok) throw new Error(r.status); writeFileSync(dst, Buffer.from(await r.arrayBuffer())); }

async function formData(name, id, suffix = '') {
  const pk = await getJSON(`${API}/pokemon/${name}`);
  const types = pk.types.map(t => t.type.name);
  const base = {}; for (const s of pk.stats) base[STAT[s.stat.name]] = s.base_stat;
  const sprite = pk.sprites.front_default;
  if (sprite) await dl(sprite, OUT_DIR + `mega_${id}${suffix}.png`);
  return { types, base, hasSprite: !!sprite };
}

const out = {};
let ok = 0, fail = 0;
const ids = [...MEGA_SPECIES];
for (const id of ids) {
  try {
    const sp = await getJSON(`${API}/pokemon-species/${id}`);
    const megas = sp.varieties.filter(v => v.pokemon.name.includes('-mega'));
    if (!megas.length) { fail++; continue; }
    const rec = { name: sp.name };
    const x = megas.find(v => v.pokemon.name.endsWith('-mega-x'));
    const y = megas.find(v => v.pokemon.name.endsWith('-mega-y'));
    if (x && y) {   // Charizard / Mewtwo: dos megas
      const dx = await formData(x.pokemon.name, id, '_x'); const dy = await formData(y.pokemon.name, id, '_y');
      rec.x = { types: dx.types, base: dx.base }; rec.y = { types: dy.types, base: dy.base }; rec.dual = true;
    } else {
      const d = await formData(megas[0].pokemon.name, id, '');
      rec.types = d.types; rec.base = d.base;
    }
    out[id] = rec; ok++;
    process.stdout.write(`  ✓ ${id} ${sp.name}\n`);
  } catch (e) { fail++; process.stdout.write(`  ✗ ${id} (${e.message})\n`); }
  await sleep(120);
}
const dst = fileURLToPath(new URL('../data/megas.generated.js', import.meta.url));
writeFileSync(dst, '// AUTO-GENERADO por tools/fetch-megas.mjs — formas Mega reales (PokeAPI)\nexport const MEGAS = ' + JSON.stringify(out) + ';\n');
console.log(`\n✅ Megas: ${ok} ok, ${fail} sin forma → ${dst}`);
