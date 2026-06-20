// fetch-trainers.mjs — cachea sprites de entrenadores reales de Pokémon Showdown.
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
const LIST = [
  ['red', 'Rojo'], ['blue', 'Azul'], ['leaf', 'Hoja'], ['ethan', 'Oro'],
  ['lyra', 'Lyra'], ['brendan', 'Bruno'], ['may', 'Aura'], ['lucas', 'Lucas'],
  ['dawn', 'Maya'], ['hilbert', 'Hilbert'], ['hilda', 'Hilda'], ['nate', 'Nate'],
  ['rosa', 'Rosa'], ['calem', 'Calem'], ['serena', 'Serena'],
  // Hoenn (todos con chibi REAL de pret/pokeemerald)
  ['steven', 'Máximo'], ['wally', 'Blasco'], ['wallace', 'Plubio'],
  ['roxanne', 'Petra'], ['brawly', 'Marcial'], ['wattson', 'Erico'],
  ['flannery', 'Candela'], ['norman', 'Norman'], ['winona', 'Alana'], ['juan', 'Galano'],
  ['sidney', 'Sixto'], ['phoebe', 'Fátima'], ['glacia', 'Nívea'], ['drake', 'Dracón'],
  ['maxie', 'Magno'], ['archie', 'Aquiles'],
];
const DIR = new URL('../assets/sprites/trainers/', import.meta.url);
mkdirSync(DIR, { recursive: true });
const out = [];
for (const [id, name] of LIST) {
  try {
    const url = `https://play.pokemonshowdown.com/sprites/trainers/${id}.png`;
    const f = new URL(`${id}.png`, DIR);
    if (!existsSync(f)) {
      const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!r.ok) throw new Error(r.status);
      writeFileSync(f, Buffer.from(await r.arrayBuffer()));
    }
    out.push({ id, name, sprite: `assets/sprites/trainers/${id}.png` });
    process.stdout.write(`✓${id} `);
  } catch (e) { process.stderr.write(`✗${id}(${e.message}) `); }
}
writeFileSync(new URL('../data/trainers.generated.js', import.meta.url),
  `// AUTO-GENERADO. Entrenadores (Pokémon Showdown).\nexport const TRAINERS = ${JSON.stringify(out)};\n`);
console.log(`\n✅ ${out.length} entrenadores → data/trainers.generated.js`);
