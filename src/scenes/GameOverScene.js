// GameOverScene — fin de partida roguelike, estética tipo Undertale:
// pantalla negra, corazón que se rompe, "GAME OVER" y una línea de ánimo.
import Phaser from 'phaser';
import { VIEW, frameCamera } from '../main.js';
import { makeInput } from '../systems/input.js';
import { sfx } from '../systems/audio.js';
import { clearSave, addMeta, diffOf } from '../systems/state.js';

const LINES = [
  '* No te rindas...\n* La Torre aún te espera.',
  '* Tu determinación no se apaga.\n* Inténtalo de nuevo.',
  '* Cada caída es un nuevo comienzo.\n* Mantente firme.',
];

export class GameOverScene extends Phaser.Scene {
  constructor() { super('GameOver'); }
  init(data) { this.floorNum = data.floorReached ?? 1; }

  create() {
    frameCamera(this);
    const { w, h } = VIEW;
    this.add.rectangle(0, 0, w, h, 0x000000, 1).setOrigin(0, 0);
    this.gba = makeInput(this);

    // POKÉ BALL que se rompe (tiembla, destello y se parte en dos mitades)
    const cx = w / 2, cy = h / 2 - 30;
    const ball = this.add.image(cx, cy, 'item_pokeball').setScale(3);
    this.tweens.add({ targets: ball, x: cx + 4, duration: 70, yoyo: true, repeat: 5 });   // tiembla
    this.time.delayedCall(560, () => {
      sfx(this, 'faint');   // la pokébola se quiebra
      this.cameras.main.flash(120, 255, 80, 80);
      this.cameras.main.shake(200, 0.012);
      const src = this.textures.get('item_pokeball').getSourceImage();
      const hw = src.width, hh = Math.floor(src.height / 2);
      ball.destroy();
      const top = this.add.image(cx, cy, 'item_pokeball').setScale(3).setCrop(0, 0, hw, hh);
      const bot = this.add.image(cx, cy, 'item_pokeball').setScale(3).setCrop(0, hh, hw, hh);
      this.tweens.add({ targets: top, x: cx - 34, y: cy - 46, angle: -50, alpha: 0, duration: 950, ease: 'Quad.out' });
      this.tweens.add({ targets: bot, x: cx + 30, y: cy + 54, angle: 60, alpha: 0, duration: 950, ease: 'Quad.out' });
      for (let i = 0; i < 10; i++) {
        const s = this.add.rectangle(cx, cy, 3, 3, i % 2 ? 0xff4040 : 0xe8e8e8);
        this.tweens.add({ targets: s, x: cx + Phaser.Math.Between(-70, 70), y: cy + Phaser.Math.Between(-30, 80), alpha: 0, duration: 750 });
      }
      this.time.delayedCall(750, () => this.showText());
    });
  }

  showText() {
    const { w, h } = VIEW;
    this.add.text(w / 2, h / 2 - 22, 'GAME OVER', { fontFamily: '"Press Start 2P"', fontSize: '20px', color: '#ffffff' }).setOrigin(0.5);
    const line = Phaser.Utils.Array.GetRandom(LINES);
    this.add.text(w / 2, h / 2 + 14, line, { fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#e0e0e0', align: 'center', lineSpacing: 7 }).setOrigin(0.5);
    // RESUMEN de la partida (pisos, capturas, victorias, mejor Pokémon)
    const run = this.registry.get('run') || {};
    const best = (run.party || []).concat(run.box || []).sort((a, b) => (b.level || 0) - (a.level || 0))[0];
    const stats = [
      `Piso alcanzado:  ${this.floorNum}`,
      `Pokémon capturados:  ${run.dex?.caught?.length || 0}`,
      `Combates ganados:  ${run.wins || 0}`,
      best ? `Mejor Pokémon:  ${(best.name || '').toUpperCase()} Nv${best.level}` : '',
    ].filter(Boolean);
    // PUNTOS DE MEJORA ganados (meta-progresión): se gastan en el menú → Mejoras
    const pts = Math.round((this.floorNum * 5 + (run.dex?.caught?.length || 0) * 3 + (run.wins || 0) * 2) * diffOf(run).reward);
    addMeta(pts);
    stats.push(`+${pts} puntos de mejora`);
    const box = this.add.rectangle(w / 2, h - 58, 310, 14 + stats.length * 12, 0x101018, 0.85).setStrokeStyle(2, 0x3a3a4a);
    stats.forEach((s, i) => this.add.text(w / 2, h - 58 - (stats.length - 1) * 6 + i * 12, s, { fontFamily: '"Press Start 2P"', fontSize: '7px', color: i === stats.length - 1 ? '#ffd76a' : '#bfe0d0' }).setOrigin(0.5));
    const prompt = this.add.text(w / 2, h - 14, 'A / Enter: volver a intentar', { fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#ffd76a' }).setOrigin(0.5);
    this.tweens.add({ targets: prompt, alpha: 0.2, duration: 700, yoyo: true, repeat: -1 });
    this.ready = true;
  }

  update() {
    if (this.ready && this.gba.confirm()) {
      this.ready = false;
      sfx(this, 'select');
      this.registry.remove('run');           // nueva partida (roguelike)
      clearSave();                           // la derrota borra la partida guardada
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.time.delayedCall(420, () => { this.scene.stop('Floor'); this.scene.stop('Pokedex'); this.scene.start('Title'); });
    }
  }
}
