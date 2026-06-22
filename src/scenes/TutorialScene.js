// TutorialScene — PRE-GAME: explica cómo se juega ANTES del picnic (StoryScene).
// Paginado, saltable con C/Select. Va: CharacterSelect → Tutorial → Story → Piso 1.
import Phaser from 'phaser';
import { VIEW } from '../main.js';
import { sfx } from '../systems/audio.js';

const FONT = '"Press Start 2P"';
const GOLD = '#ffd76a', INK = '#e8e0d0', DIM = '#9fb0d0';

const PAGES = [
  { title: 'BIENVENIDO A LA TORRE', lines: [
    'Sube la TORRE INFINITA piso a piso.',
    'Captura entre 1024 Pokémon, vence',
    'entrenadores y JEFES, y llega lo más',
    'alto que puedas. Cada partida es única.',
  ] },
  { title: 'CONTROLES', lines: [
    'Mover: FLECHAS / WASD   ·   Correr: B',
    'A (aceptar): ENTER / Z / ESPACIO',
    'B (cancelar): RETROCESO / X',
    'Mochila: M   ·   Equipo/Caja: T   ·   Pokédex: P',
    'En móvil: D-pad y botones en pantalla.',
  ] },
  { title: 'EL MUNDO', lines: [
    'Encuentros: solo en la HIERBA ALTA',
    '(en cuevas, en cualquier casilla).',
    'PUEBLOS cada 5 pisos: Centro, Tienda,',
    'y CRIADERO 🥚 (deja a Ditto + otro y',
    'consigue un Huevo). JEFE cada 10 pisos.',
  ] },
  { title: 'COMBATE', lines: [
    'Aprovecha los TIPOS (ventajas x2).',
    'Equipa Piedra Mega / Cristal Z / Maxibanda',
    'o Teracristal para desatar FENÓMENOS.',
    'Lanza BALLS para capturar (debilita primero).',
    '¡Mucha suerte, entrenador!',
  ] },
];

export class TutorialScene extends Phaser.Scene {
  constructor() { super('Tutorial'); }

  create() {
    const { w, h } = VIEW;
    this.page = 0;
    this.add.rectangle(0, 0, w, h, 0x05060a, 1).setOrigin(0);
    this.add.rectangle(8, 8, w - 16, h - 16, 0x0b0e16, 0).setOrigin(0).setStrokeStyle(2, 0x2a3a5a);
    // brackets dorados esquinados (estética Mazi)
    for (const [x, y, sx, sy] of [[14, 14, 1, 1], [w - 14, 14, -1, 1], [14, h - 14, 1, -1], [w - 14, h - 14, -1, -1]]) {
      const g = this.add.graphics().lineStyle(2, 0xffd76a, 1);
      g.beginPath(); g.moveTo(x, y + sy * 16); g.lineTo(x, y); g.lineTo(x + sx * 16, y); g.strokePath();
    }
    this.add.text(w / 2, 22, 'CÓMO SE JUEGA', { fontFamily: FONT, fontSize: '11px', color: GOLD }).setOrigin(0.5);

    this.titleT = this.add.text(w / 2, 56, '', { fontFamily: FONT, fontSize: '10px', color: INK }).setOrigin(0.5);
    this.bodyT = this.add.text(w / 2, 80, '', { fontFamily: FONT, fontSize: '7px', color: INK, align: 'center', lineSpacing: 7, wordWrap: { width: w - 56 } }).setOrigin(0.5, 0);
    this.dots = this.add.text(w / 2, h - 40, '', { fontFamily: FONT, fontSize: '8px', color: GOLD }).setOrigin(0.5);
    this.hint = this.add.text(w / 2, h - 22, 'A / toca: siguiente   ·   C: saltar', { fontFamily: FONT, fontSize: '6px', color: DIM }).setOrigin(0.5);
    this.tweens.add({ targets: this.hint, alpha: 0.4, duration: 800, yoyo: true, repeat: -1 });

    this.paint();

    const next = () => this.advance();
    const skip = () => this.go();
    this.input.keyboard.on('keydown-ENTER', next);
    this.input.keyboard.on('keydown-SPACE', next);
    this.input.keyboard.on('keydown-Z', next);
    this.input.keyboard.on('keydown-RIGHT', next);
    this.input.keyboard.on('keydown-C', skip);
    this.input.keyboard.on('keydown-SHIFT', skip);
    this.input.keyboard.on('keydown-ESC', skip);
    this.input.on('pointerdown', next);
  }

  paint() {
    const p = PAGES[this.page];
    this.titleT.setText(p.title);
    this.bodyT.setText(p.lines.join('\n'));
    this.dots.setText(PAGES.map((_, i) => (i === this.page ? '●' : '○')).join(' '));
  }

  advance() {
    if (this.leaving) return;
    try { sfx(this, 'select', 0.5); } catch {}
    if (this.page < PAGES.length - 1) { this.page++; this.paint(); }
    else this.go();
  }

  go() {
    if (this.leaving) return;
    this.leaving = true;
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.time.delayedCall(320, () => this.scene.start('Story'));   // → picnic → Piso 1
  }
}
