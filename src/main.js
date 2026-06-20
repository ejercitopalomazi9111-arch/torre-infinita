// main.js — Punto de entrada. Config de Phaser + registro de escenas.
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { TitleScene } from './scenes/TitleScene.js';
import { FloorScene } from './scenes/FloorScene.js';
import { BattleScene } from './scenes/BattleScene.js';
import { PokedexScene } from './scenes/PokedexScene.js';
import { GameOverScene } from './scenes/GameOverScene.js';
import { CharacterSelectScene } from './scenes/CharacterSelectScene.js';
import { IntroScene } from './scenes/IntroScene.js';
import { StoryScene } from './scenes/StoryScene.js';
import { HudScene } from './scenes/HudScene.js';
import { InteriorScene } from './scenes/InteriorScene.js';
import { MainMenuScene } from './scenes/MainMenuScene.js';

// VIEW = área LÓGICA de juego (cada escena la usa para su layout interno).
export const VIEW = { w: 480, h: 360 };
// El canvas es más ancho: el juego de 480 va CENTRADO y a los lados quedan los
// paneles del HUD lateral (equipo Nuzlocke + cabina arcade), estilo dashboard.
export const HUD = { margin: 96 };
export const CANVAS = { w: VIEW.w + HUD.margin * 2, h: VIEW.h };

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: CANVAS.w,
  height: CANVAS.h,
  pixelArt: true,            // sin blur: pixel-perfect (sección C)
  roundPixels: true,
  backgroundColor: '#05060a',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: 'arcade', arcade: { debug: false } },
  input: { gamepad: true },   // control PS4/DualShock (y cualquier gamepad estándar)
  // HudScene va al final → se renderiza POR ENCIMA (overlay persistente).
  scene: [BootScene, TitleScene, MainMenuScene, IntroScene, CharacterSelectScene, StoryScene, FloorScene, BattleScene, PokedexScene, GameOverScene, InteriorScene, HudScene],
};

/** Confina la cámara de una escena al área central de juego (deja los márgenes
 *  del canvas para el HUD lateral). Llamar al INICIO de create(). */
export function frameCamera(scene) {
  scene.cameras.main.setViewport(HUD.margin, 0, VIEW.w, VIEW.h);
}

// handle global para QA (tools/shot.mjs y debug)
window.__GAME = new Phaser.Game(config);
