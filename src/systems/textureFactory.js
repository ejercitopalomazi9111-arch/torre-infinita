// textureFactory.js — Convierte las texturas de bioma (texgen) en texturas de
// Phaser. (El entrenador y la pokébola usan SPRITES REALES; el arte procedural
// de personaje/objeto se eliminó — ver chibis ow_ y assets/fx/pokeball.png.)

import { makeVariants, makeDecor, TILE } from '../engine/texgen.js';

function bufToCanvas(buf) {
  const c = document.createElement('canvas');
  c.width = buf.w; c.height = buf.h;
  const ctx = c.getContext('2d');
  ctx.putImageData(new ImageData(new Uint8ClampedArray(buf.data), buf.w, buf.h), 0, 0);
  return c;
}

/** Registra el atlas de un bioma (5 suelos, 5 muros, 4 decoraciones). Idempotente. */
export function registerBiomeTextures(scene, biome) {
  const key = (id) => `${biome.id}_${id}`;
  if (scene.textures.exists(key('floor0'))) return;
  makeVariants('floor', biome.palette, 5, 1).forEach((b, i) => scene.textures.addCanvas(key('floor' + i), bufToCanvas(b)));
  makeVariants('wall', biome.palette, 5, 2).forEach((b, i) => scene.textures.addCanvas(key('wall' + i), bufToCanvas(b)));
  for (const d of ['rock', 'crack', 'flora', 'crystal']) scene.textures.addCanvas(key('decor_' + d), bufToCanvas(makeDecor(d, biome.palette, 2)));
}
