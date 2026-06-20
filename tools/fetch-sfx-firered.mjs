// fetch-sfx-firered.mjs — SFX REALES de Pokémon FireRed/LeafGreen.
// Fuente: The Sounds Resource (pack ripeado del juego, dominio público de facto).
//   https://sounds.spriters-resource.com/game_boy_advance/pokemonfireredleafgreen/asset/397732/
// Los .wav vienen nombrados por el ID hexadecimal del Sound Effect del motor
// (ver guía: pokecommunity.com/threads/sound-effect-numbers-for-fire-red.209508/).
// firered_00XX.wav == SE 0xXX (0x0 "Blank" se omite por ser silencio).
// Descarga el zip, extrae, y copia las pistas mapeadas a assets/audio/sfx/.
// Uso: node tools/fetch-sfx-firered.mjs
import { writeFileSync, copyFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ZIP_URL = 'https://sounds.spriters-resource.com/media/assets/395/397732.zip';
const SFX_DIR = fileURLToPath(new URL('../assets/audio/sfx/', import.meta.url));
mkdirSync(SFX_DIR, { recursive: true });

// clave del juego  →  ID de SE de FireRed (nombre de archivo = firered_<ID>.wav)
const MAP = {
  cursor: '0005',    // Click Noise (mover selección / interactuar)
  select: '0005',    // Click Noise (confirmar A) — el sonido de "pulsar botón"
  back:   '0006',    // Open Menu (cancelar B / abrir)
  coin:   '0019',    // Insert Coin
  heal:   '0001',    // Use Item (usar objeto / curar)
  levelup:'0054',    // Level Up Ding
  evolve: '005F',    // Light Jingle
  hit:    '005C',    // Smack (golpe)
  error:  '0016',    // Error / False sound
  lowhp:  '0053',    // Low Health Alert (pitido de PS bajos)
  ballthrow: '0036', // Throw Pokeball (lanzar pokébola)
  ballopen:  '000F', // Pokeball Open (sale el Pokémon)
  save:   '0030',    // Save (guardar)
};

const tmp = join(tmpdir(), 'frlg_sfx_' + Date.now());
const zip = tmp + '.zip';
mkdirSync(tmp, { recursive: true });

const r = await fetch(ZIP_URL, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://sounds.spriters-resource.com/' }, signal: AbortSignal.timeout(120000) });
if (!r.ok) { console.error('✗ descarga zip:', r.status); process.exit(1); }
writeFileSync(zip, Buffer.from(await r.arrayBuffer()));
console.log('  ✓ zip descargado');

// Expand-Archive (PowerShell, presente en Windows) — extrae el pack
execSync(`powershell -NoProfile -Command "Expand-Archive -LiteralPath '${zip}' -DestinationPath '${tmp}' -Force"`, { stdio: 'ignore' });

let ok = 0, fail = 0;
for (const [key, id] of Object.entries(MAP)) {
  const src = join(tmp, 'firered_' + id + '.wav');
  if (!existsSync(src)) { console.log('  ✗ ' + key + ' (falta firered_' + id + '.wav)'); fail++; continue; }
  copyFileSync(src, SFX_DIR + key + '.wav');
  console.log('  ✓ ' + key + '.wav ← firered_' + id + '.wav'); ok++;
}
rmSync(tmp, { recursive: true, force: true });
rmSync(zip, { force: true });
console.log(`\n✅ SFX FireRed: ${ok} copiados, ${fail} fallaron.`);
