// fetch-ow.mjs — Chibis overworld REALES (pret/pokeemerald, GBA 16x32, 9 frames)
// para el protagonista en el piso. Inyecta un chunk tRNS para volver
// transparente el índice 0 de paleta (fondo verde) SIN tocar el arte.
// Genera assets/sprites/ow/<trainerId>.png + data/owmeta.generated.js
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BASE = 'https://raw.githubusercontent.com/pret/pokeemerald/master/graphics/object_events/pics/people/';
// entrenador del selector → hoja chibi de Emerald más parecida
const MAP = {
  red: 'red.png', blue: 'boy_2.png', ethan: 'boy_1.png', lyra: 'girl_1.png',
  brendan: 'brendan/walking.png', may: 'may/walking.png',
  lucas: 'boy_3.png', dawn: 'girl_3.png', hilbert: 'youngster.png', hilda: 'girl_2.png',
  nate: 'school_kid_m.png', rosa: 'lass.png', calem: 'camper.png', serena: 'picnicker.png',
  // Hoenn: chibi EXACTO del personaje
  steven: 'steven.png', wally: 'wally.png', wallace: 'wallace.png',
  roxanne: 'gym_leaders/roxanne.png', brawly: 'gym_leaders/brawly.png', wattson: 'gym_leaders/wattson.png',
  flannery: 'gym_leaders/flannery.png', norman: 'gym_leaders/norman.png', winona: 'gym_leaders/winona.png',
  juan: 'gym_leaders/juan.png',
  sidney: 'elite_four/sidney.png', phoebe: 'elite_four/phoebe.png', glacia: 'elite_four/glacia.png',
  drake: 'elite_four/drake.png', maxie: 'team_magma/maxie.png', archie: 'team_aqua/archie.png',
};
const OUT = fileURLToPath(new URL('../assets/sprites/ow/', import.meta.url));
mkdirSync(OUT, { recursive: true });

// crc32 (para el chunk tRNS)
const TBL = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = TBL[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

/** Inserta tRNS (índice 0 transparente) tras el PLTE de un PNG indexado. */
function addTransparency(png) {
  let off = 8;
  while (off < png.length) {
    const len = png.readUInt32BE(off), type = png.toString('ascii', off + 4, off + 8);
    if (type === 'tRNS') return png;                  // ya tiene
    if (type === 'PLTE') {
      const insertAt = off + 12 + len;
      const data = Buffer.from([0]);                  // alpha 0 para índice 0
      const chunk = Buffer.alloc(13);
      chunk.writeUInt32BE(1, 0);
      chunk.write('tRNS', 4, 'ascii');
      data.copy(chunk, 8);
      chunk.writeUInt32BE(crc32(Buffer.concat([Buffer.from('tRNS'), data])), 9);
      return Buffer.concat([png.subarray(0, insertAt), chunk, png.subarray(insertAt)]);
    }
    off += 12 + len;
  }
  return png;
}

// props GBA reales (árboles/roca) para escenarios
const PROPS = { prop_tree: 'misc/cuttable_tree.png', prop_rock: 'misc/breakable_rock.png' };

const meta = {};
let ok = 0;
for (const [id, path] of Object.entries(PROPS)) {
  try {
    const r = await fetch(BASE.replace('people/', '') + path, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error(r.status);
    let png = Buffer.from(await r.arrayBuffer());
    const w = png.readUInt32BE(16), h = png.readUInt32BE(20);
    writeFileSync(OUT + id + '.png', addTransparency(png));
    console.log(`  ✓ ${id} (${w}x${h})`);
  } catch (e) { console.log(`  ✗ ${id} (${e.message})`); }
}
for (const [id, path] of Object.entries(MAP)) {
  try {
    const r = await fetch(BASE + path, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error(r.status);
    let png = Buffer.from(await r.arrayBuffer());
    const w = png.readUInt32BE(16), h = png.readUInt32BE(20);
    png = addTransparency(png);
    writeFileSync(OUT + id + '.png', png);
    meta[id] = { fw: 16, fh: h, frames: Math.floor(w / 16) };
    ok++;
    console.log(`  ✓ ${id} ← ${path} (${w}x${h}, ${Math.floor(w / 16)} frames)`);
  } catch (e) { console.log(`  ✗ ${id} ← ${path} (${e.message})`); }
}
writeFileSync(new URL('../data/owmeta.generated.js', import.meta.url),
  '// GENERADO por tools/fetch-ow.mjs — chibis overworld pret/pokeemerald\nexport const OWMETA = ' + JSON.stringify(meta) + ';\n');
console.log(`\n✅ OW chibi: ${ok}/${Object.keys(MAP).length}`);
