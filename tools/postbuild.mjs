// postbuild.mjs — copia los assets de runtime (sprites/audio/i18n) al dist/, ya que
// Phaser los carga por RUTA (no como import) y Vite no los empaqueta solo.
import { cpSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
for (const dir of ['assets', 'i18n', 'data']) {
  const src = root + dir, dst = root + 'dist/' + dir;
  if (existsSync(src)) { cpSync(src, dst, { recursive: true }); console.log('  copiado', dir, '→ dist/' + dir); }
}
console.log('✅ postbuild: assets en dist/');
