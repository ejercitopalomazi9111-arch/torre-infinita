// vite.config.js — base RELATIVA ('./') para que el juego funcione tanto en la
// raíz (dev/preview) como bajo un subpath de GitHub Pages (/torre-infinita/).
// Phaser carga los assets por ruta relativa, así que todo resuelve contra la
// URL del documento sin importar el subdirectorio.
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: { target: 'es2020', chunkSizeWarningLimit: 4000 },
});
