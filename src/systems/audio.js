// audio.js — BGM global (una pista a la vez) + SFX REALES de FireRed/LeafGreen
// (Sounds Resource, tools/fetch-sfx-firered.mjs) + cries REALES de Pokémon.

// claves de SFX cargadas en BootScene (assets/audio/sfx/<key>.wav)
export const SFX_KEYS = ['cursor', 'select', 'back', 'coin', 'heal', 'levelup', 'evolve', 'hit', 'error', 'lowhp', 'ballthrow', 'ballopen', 'save', 'grass'];

// claves de BGM REAL de FireRed/LeafGreen (assets/audio/bgm/<key>.mp3, tools/fetch-firered.mjs).
// Exploración por bioma (data/biomes.js → music) + combate + pantallas.
export const BGM_KEYS = [
  'forest', 'cave', 'ruins', 'glacier', 'volcano', 'lab', 'sky', 'distortion',
  'explore', 'town', 'battle', 'boss', 'replay', 'legendary', 'title', 'victory', 'evolve',
];

const SFX_VOL = { cursor: 0.3, select: 0.35, back: 0.3, coin: 0.45, heal: 0.5, levelup: 0.55, evolve: 0.6, hit: 0.45, error: 0.4, lowhp: 0.4, ballthrow: 0.5, ballopen: 0.5, save: 0.4, grass: 0.4 };

// ---- VOLUMEN global (ajustes, persisten en localStorage) ----
const SET_KEY = 'torre_infinita_settings';
let MUSIC_VOL = 1, SFX_MULT = 1;
export function loadAudioSettings() {
  try { const s = JSON.parse(localStorage.getItem(SET_KEY) || '{}'); MUSIC_VOL = s.music ?? 1; SFX_MULT = s.sfx ?? 1; } catch { /* */ }
}
export function getAudioSettings() { return { music: MUSIC_VOL, sfx: SFX_MULT }; }
function persistAudio() { try { const s = JSON.parse(localStorage.getItem(SET_KEY) || '{}'); s.music = MUSIC_VOL; s.sfx = SFX_MULT; localStorage.setItem(SET_KEY, JSON.stringify(s)); } catch { /* */ } }
export function setMusicVol(v, scene) { MUSIC_VOL = Math.max(0, Math.min(1, v)); persistAudio(); try { scene?.registry.get('bgm')?.setVolume(0.32 * MUSIC_VOL); } catch { /* */ } }
export function setSfxVol(v) { SFX_MULT = Math.max(0, Math.min(1, v)); persistAudio(); }

export function playBgm(scene, key, volume = 0.35) {
  if (scene.registry.get('godtest')) return;   // cazabugs/turbo: sin música (satura el loader)
  const cur = scene.registry.get('bgm');
  if (cur && cur.key === key && cur.isPlaying) return;
  try { cur?.stop(); } catch { /* ya destruida */ }
  scene.registry.set('bgmWant', key);   // recuerda la última pista pedida (anti-carrera)
  const start = () => {
    if (scene.registry.get('bgmWant') !== key) return;   // ya pidieron otra; aborta
    if (!scene.cache.audio.exists(key)) return;
    const snd = scene.sound.add(key, { loop: true, volume: volume * MUSIC_VOL });
    snd.play();
    scene.registry.set('bgm', snd);
  };
  if (scene.cache.audio.exists(key)) return start();
  // CARGA PEREZOSA: el BGM se baja la primera vez que se necesita (no los 17 al
  // boot → arranque más rápido y sin saturar el decodificador de audio).
  const file = (key.indexOf('bgm_') === 0 ? key.slice(4) : key);
  scene.load.audio(key, 'assets/audio/bgm/' + file + '.mp3');
  scene.load.once('complete', start);
  scene.load.start();
}

export function stopBgm(scene) {
  try { scene.registry.get('bgm')?.stop(); } catch { /* */ }
  scene.registry.remove('bgm');
}

/** Reproduce un efecto de interfaz (no se solapa consigo mismo de forma molesta). */
export function sfx(scene, key, volume) {
  const full = 'sfx_' + key;
  if (!scene.cache.audio.exists(full)) return;
  try { scene.sound.play(full, { volume: (volume ?? SFX_VOL[key] ?? 0.4) * SFX_MULT }); } catch { /* */ }
}

/** Reproduce el cry REAL del Pokémon (carga perezosa del .ogg cacheado). */
export function playCry(scene, speciesId, volume = 0.5) {
  const key = 'cry_' + speciesId;
  if (scene.cache.audio.exists(key)) { try { scene.sound.play(key, { volume }); } catch { /* */ } return; }
  // cargar bajo demanda y reproducir al terminar
  scene.load.audio(key, 'assets/audio/cries/' + speciesId + '.ogg');
  scene.load.once('complete', () => { if (scene.cache.audio.exists(key)) { try { scene.sound.play(key, { volume }); } catch { /* */ } } });
  scene.load.start();
}
