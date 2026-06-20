// fetch-fx.mjs — Descarga sprites de EFECTOS reales del cliente de Pokémon
// Showdown (play.pokemonshowdown.com/fx/) para las animaciones de ataque.
// Regla de assets (2026-06-11): prohibido crear assets propios → FX reales.
// Idempotente; tolera 404 (reporta y sigue).
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BASE = 'https://play.pokemonshowdown.com/fx/';
const OUT = fileURLToPath(new URL('../assets/fx/', import.meta.url));
mkdirSync(OUT, { recursive: true });

// candidatos (nombres reales del cliente Showdown); los 404 se reportan
const FILES = [
  'fireball.png', 'bluefireball.png', 'waterwisp.png', 'lightning.png',
  'icicle.png', 'leaf1.png', 'leaf2.png', 'poisonwisp.png', 'mudwisp.png',
  'rock1.png', 'rock2.png', 'rock3.png', 'web.png', 'shadowball.png',
  'mistball.png', 'energyball.png', 'electroball.png', 'iceball.png',
  'fist.png', 'foot.png', 'wisp.png', 'blackwisp.png', 'feather.png',
  'sword.png', 'shield.png', 'heart.png', 'angry.png', 'shine.png',
  'pokeball.png', 'gear.png', 'hitmarker.png', 'flareball.png',
];

let ok = 0, miss = [];
for (const f of FILES) {
  const dest = OUT + f;
  if (existsSync(dest)) { ok++; continue; }
  try {
    const r = await fetch(BASE + f, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error(r.status);
    writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
    ok++;
    console.log('  ✓', f);
  } catch (e) { miss.push(f + ' (' + e.message + ')'); }
}
console.log(`\nFX: ${ok}/${FILES.length} descargados en assets/fx/`);
if (miss.length) console.log('  404/fallos:', miss.join(', '));
