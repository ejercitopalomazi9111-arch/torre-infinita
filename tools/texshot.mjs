// texshot.mjs — Render de QA visual de la capa procedural (ruido + bitmaps).
// Exporta PNGs reales (vía pngutil) para revisar la estética con la vista.
// Uso: node tools/texshot.mjs

import { writeFileSync, mkdirSync } from 'node:fs';
import { BIOMES } from '../data/biomes.js';
import { makeFloorTile, makeWallTile, makeDecor, makeVariants, TILE } from '../src/engine/texgen.js';
import { generateFloor } from '../src/systems/tower/floorGen.js';
import { generateRoomTiles, roomIsTraversable } from '../src/systems/tower/tileGen.js';
import { encodePNG, makeCanvas } from './pngutil.mjs';

const OUT = new URL('../assets/_preview/', import.meta.url);
mkdirSync(OUT, { recursive: true });
const save = (name, img, scale = 4) => {
  writeFileSync(new URL(name, OUT), encodePNG(img.scaled ? img.scaled(scale) : img));
  console.log('  →', name);
};

// 1) Hoja de variantes: 5 suelos + 5 muros + decoración, por bioma muestra.
function tileSheet(biome) {
  const floors = makeVariants('floor', biome.palette, 5, 1);
  const walls = makeVariants('wall', biome.palette, 5, 2);
  const decors = ['rock', 'crack', 'flora', 'crystal'].map((k, i) => makeDecor(k, biome.palette, i + 1));
  const cols = 5, pad = 2;
  const cv = makeCanvas(cols * (TILE + pad) + pad, 3 * (TILE + pad) + pad, [18, 18, 22, 255]);
  floors.forEach((t, i) => cv.blit(t, pad + i * (TILE + pad), pad));
  walls.forEach((t, i) => cv.blit(t, pad + i * (TILE + pad), pad + (TILE + pad)));
  decors.forEach((t, i) => { cv.blit(makeFloorTile(biome.palette, 9, {}), pad + i * (TILE + pad), pad + 2 * (TILE + pad)); cv.blit(t, pad + i * (TILE + pad), pad + 2 * (TILE + pad)); });
  return cv;
}

// 2) Render de una sala real generada por el pipeline.
function renderRoom(tilemap, biome) {
  const { cols, rows, cells } = tilemap;
  const cv = makeCanvas(cols * TILE, rows * TILE, [0, 0, 0, 255]);
  // pre-genera variantes para reusar (atlas)
  const floors = makeVariants('floor', biome.palette, 5, 1);
  const walls = makeVariants('wall', biome.palette, 5, 2);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const cell = cells[r][c];
    const x = c * TILE, y = r * TILE;
    if (cell.base === 'wall') cv.blit(walls[cell.variant], x, y);
    else cv.blit(floors[cell.variant], x, y); // floor y door = suelo transitable
    if (cell.decor) cv.blit(makeDecor(cell.decor, biome.palette, cell.variant + 1), x, y);
  }
  return cv;
}

console.log('TEXSHOT — exportando previews:');
for (const b of [BIOMES[0], BIOMES[1], BIOMES[3]]) { // cuevas, bosque, glaciar
  save(`sheet_${b.id}.png`, tileSheet(b), 4);
}

// sala real del piso 12 (semilla palomazi)
const floor = generateFloor('palomazi', 12);
const room = floor.rooms.find(r => r.doors.length >= 3) || floor.rooms[1];
const tm = generateRoomTiles(room, floor.biome, floor.seed);
console.log('  sala', room.id, 'transitable:', roomIsTraversable(tm));
save(`room_${floor.biome.id}_${room.id}.png`, renderRoom(tm, floor.biome), 4);

console.log('OK');
