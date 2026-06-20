// fetch-firered.mjs — Música REAL de Pokémon FireRed/LeafGreen desde khinsider.
// Cada pista se mapea a una clave BGM del juego (biomas + combate + extras).
// Flujo khinsider: página de canción → URL real en vgmtreasurechest → descarga.
// Uso: node tools/fetch-firered.mjs [--force]
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FORCE = process.argv.includes('--force');
const ALBUM = 'https://downloads.khinsider.com/game-soundtracks/album/pokemon-firered-leafgreen-music-super-complete/';
const BGM_DIR = fileURLToPath(new URL('../assets/audio/bgm/', import.meta.url));
mkdirSync(BGM_DIR, { recursive: true });

// clave BGM del juego  →  nombre de archivo de la pista (single-encoded %20)
const MAP = {
  // exploración por bioma (data/biomes.js usa estas claves en `music`)
  forest:     '1-17.%20Viridian%20Forest.mp3',
  cave:       '1-34.%20Mt.%20Moon.mp3',
  ruins:      '1-39.%20Pok%C3%A9mon%20Tower.mp3',
  glacier:    '1-63.%20Sevii%20Islands.mp3',
  volcano:    '1-56.%20Pok%C3%A9mon%20Mansion.mp3',
  lab:        '1-47.%20Silph%20Co..mp3',
  sky:        '1-37.%20Cycling.mp3',
  distortion: '1-38.%20Lavender%20Town.mp3',
  // exploración por defecto / pueblo seguro
  explore:    '1-06.%20Pallet%20Town.mp3',
  town:       '1-21.%20Pok%C3%A9mon%20Center.mp3',
  // combate
  battle:     '1-18.%20Battle%21%20%28Wild%20Pok%C3%A9mon%29.mp3',
  boss:       '1-27.%20Battle%21%20%28Gym%20Leader%29.mp3',
  replay:     '1-11.%20Battle%21%20%28Trainer%29.mp3',
  legendary:  '1-53.%20Battle%21%20%28Legendary%20Pok%C3%A9mon%29.mp3',
  // pantallas
  title:      '1-03.%20Title%20Screen.mp3',
  victory:    '1-19.%20Victory%21%20%28Wild%20Pok%C3%A9mon%29.mp3',
  evolve:     '1-30.%20Evolution.mp3',
};

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
async function getText(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error('page ' + r.status);
  return r.text();
}
async function getBuf(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Referer': 'https://downloads.khinsider.com/' }, signal: AbortSignal.timeout(90000) });
  if (!r.ok) throw new Error('dl ' + r.status);
  return Buffer.from(await r.arrayBuffer());
}

let ok = 0, skip = 0, fail = 0;
for (const [key, file] of Object.entries(MAP)) {
  const dest = BGM_DIR + key + '.mp3';
  if (existsSync(dest) && !FORCE) { skip++; continue; }
  try {
    const html = await getText(ALBUM + file);
    const m = html.match(/https:\/\/[^"']+\.mp3/);
    if (!m) throw new Error('sin enlace mp3');
    const buf = await getBuf(m[0]);
    if (buf.length < 50000) throw new Error('mp3 muy pequeño (' + buf.length + ')');
    writeFileSync(dest, buf);
    console.log(`  ✓ ${key}  (${(buf.length / 1048576).toFixed(1)} MB)  ${decodeURIComponent(file)}`);
    ok++;
  } catch (e) {
    console.log(`  ✗ ${key}  (${e.message})`);
    fail++;
  }
}
console.log(`\n✅ FireRed BGM: ${ok} nuevas, ${skip} ya estaban, ${fail} fallaron. Total claves: ${Object.keys(MAP).length}`);
