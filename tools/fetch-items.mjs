// fetch-items.mjs — Sprites OFICIALES de objetos (PokeAPI/sprites): todas las
// Poké Balls de los juegos + curación. Idempotente.
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/';
const OUT = fileURLToPath(new URL('../assets/sprites/items/', import.meta.url));
mkdirSync(OUT, { recursive: true });

const FILES = [
  // balls (todas las de los juegos)
  'poke-ball', 'great-ball', 'ultra-ball', 'master-ball', 'safari-ball',
  'fast-ball', 'level-ball', 'lure-ball', 'heavy-ball', 'love-ball',
  'friend-ball', 'moon-ball', 'sport-ball', 'net-ball', 'dive-ball',
  'nest-ball', 'repeat-ball', 'timer-ball', 'luxury-ball', 'premier-ball',
  'dusk-ball', 'heal-ball', 'quick-ball', 'cherish-ball', 'dream-ball',
  'beast-ball', 'park-ball',
  // curación
  'potion', 'super-potion', 'hyper-potion', 'max-potion', 'full-restore',
  'revive', 'max-revive',
  // bayas (Pokocho de la intro + futuros)
  'oran-berry', 'sitrus-berry', 'pecha-berry',
  // OBJETOS EQUIPABLES (held items)
  'leftovers', 'life-orb', 'focus-sash', 'choice-band', 'choice-specs',
  'choice-scarf', 'everstone',
  // DISCOS DE HABILIDAD (cápsula y parche)
  'ability-capsule', 'ability-patch',
  // BAYAS de estado / curación
  'lum-berry', 'cheri-berry', 'chesto-berry', 'rawst-berry', 'aspear-berry',
  'persim-berry', 'leppa-berry', 'figy-berry', 'aguav-berry',
  // BAYAS reductoras de daño por tipo
  'occa-berry', 'passho-berry', 'wacan-berry', 'rindo-berry', 'chople-berry', 'shuca-berry',
];

let ok = 0, miss = [];
for (const f of FILES) {
  const dest = OUT + f + '.png';
  if (existsSync(dest)) { ok++; continue; }
  try {
    const r = await fetch(BASE + f + '.png', { signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error(r.status);
    writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
    ok++;
  } catch (e) { miss.push(f + '(' + e.message + ')'); }
}
console.log(`✅ Items: ${ok}/${FILES.length} en assets/sprites/items/` + (miss.length ? `\n  fallos: ${miss.join(', ')}` : ''));
