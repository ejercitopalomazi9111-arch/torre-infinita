// CharacterSelectScene — CARRUSEL estilo Mundo Misterioso: un entrenador a la
// vez, D-pad ←/→ para moverse, arte COMPLETO (Showdown; el chibi va en el piso).
// El Gurú sugiere uno según la entrevista, pero el jugador elige libremente.
import Phaser from 'phaser';
import { VIEW, frameCamera } from '../main.js';
import { TRAINERS } from '../../data/trainers.generated.js';
import { makeInput } from '../systems/input.js';
import { TRAINER_DESC } from '../../data/flavor.js';
import { sfx } from '../systems/audio.js';

export class CharacterSelectScene extends Phaser.Scene {
  constructor() { super('CharacterSelect'); }

  create() {
    frameCamera(this);
    const { w, h } = VIEW;
    this.add.rectangle(0, 0, w, h, 0x0a0c16, 1).setOrigin(0, 0);
    this.add.text(w / 2, 22, 'ELIGE TU ENTRENADOR', { fontFamily: '"Press Start 2P"', fontSize: '13px', color: '#ffd76a' }).setOrigin(0.5);
    this.gba = makeInput(this);

    // por defecto solo entrenadores cuyo CHIBI corresponde de verdad;
    // el código Konami (↑↑↓↓←→←→ B A) desbloquea los 14 aunque su chibi no sea exacto
    // SOLO entrenadores con chibi exacto Y animación de caminar completa (9 frames)
    const MATCHED = ['red', 'brendan', 'may', 'steven', 'wally', 'wallace', 'norman', 'juan'];
    this.pool = this.registry.get('allTrainers') ? TRAINERS : TRAINERS.filter(t => MATCHED.includes(t.id));
    const suggested = this.registry.get('suggestedTrainer');
    this.sel = Math.max(0, this.pool.findIndex(t => t.id === suggested));
    this.chosen = false;

    const SEQ = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
    this.konami = 0;
    this.input.keyboard.on('keydown', (ev) => {
      const k = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
      this.konami = (k === SEQ[this.konami]) ? this.konami + 1 : (k === SEQ[0] ? 1 : 0);
      if (this.konami === SEQ.length && !this.registry.get('allTrainers')) {
        this.registry.set('allTrainers', true);
        this.cameras.main.flash(350, 84, 224, 200);
        this.scene.restart();
      }
    });

    // pedestal + sprite central (arte completo, pies sobre la sombra)
    this.add.ellipse(w / 2, 232, 150, 26, 0x000000, 0.35);
    this.img = this.add.image(w / 2, 236, 'trainer_' + this.pool[this.sel].id).setOrigin(0.5, 1);
    this.nameTxt = this.add.text(w / 2, 254, '', { fontFamily: '"Press Start 2P"', fontSize: '12px', color: '#ffffff' }).setOrigin(0.5);
    this.badge = this.add.text(w / 2, 50, '★ Sugerido por el Gurú ★', { fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#54e0c8' }).setOrigin(0.5);
    this.descTxt = this.add.text(w / 2, 276, '', { fontFamily: '"Press Start 2P"', fontSize: '7px', color: '#ffd76a', align: 'center', wordWrap: { width: w - 80 } }).setOrigin(0.5, 0);
    this.counter = this.add.text(w / 2, h - 34, '', { fontFamily: '"Press Start 2P"', fontSize: '7px', color: '#5a6a8a' }).setOrigin(0.5);

    // flechas del carrusel (clic o D-pad)
    const mkArrow = (x, ch, d) => this.add.text(x, 180, ch, { fontFamily: '"Press Start 2P"', fontSize: '22px', color: '#9fb0d0' })
      .setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.move(d))
      .on('pointerover', function () { this.setColor('#ffd76a'); })
      .on('pointerout', function () { this.setColor('#9fb0d0'); });
    mkArrow(60, '◀', -1); mkArrow(w - 60, '▶', 1);
    this.img.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.choose());

    this.add.text(w / 2, h - 14, '◀ ▶ mover · A/Enter elegir', { fontFamily: '"Press Start 2P"', fontSize: '7px', color: '#5a6a8a' }).setOrigin(0.5);

    // confirmación por EVENTO (no solo polling, D-007)
    const onConfirm = () => this.choose();
    this.input.keyboard.on('keydown-ENTER', onConfirm);
    this.input.keyboard.on('keydown-Z', onConfirm);
    this.input.keyboard.on('keydown-SPACE', onConfirm);

    this.refresh(0);
    this.cameras.main.fadeIn(250, 0, 0, 0);
  }

  refresh(dir) {
    const tr = this.pool[this.sel];
    this.img.setTexture('trainer_' + tr.id);
    const src = this.textures.get('trainer_' + tr.id).getSourceImage();
    this.img.setScale(110 / Math.max(src.width, src.height) * 1.2);
    this.nameTxt.setText(tr.name.toUpperCase());
    this.descTxt.setText(TRAINER_DESC[tr.id] || '');
    this.counter.setText(`${this.sel + 1} / ${this.pool.length}`);
    this.badge.setVisible(tr.id === this.registry.get('suggestedTrainer'));
    if (dir) {   // deslizamiento (curva Back.out estilo anime.js)
      this.img.setX(VIEW.w / 2 + dir * 70).setAlpha(0.2);
      this.tweens.add({ targets: this.img, x: VIEW.w / 2, alpha: 1, duration: 240, ease: 'Back.out' });
    }
  }

  move(d) {
    this.sel = (this.sel + d + this.pool.length) % this.pool.length;
    sfx(this, 'cursor');
    this.refresh(d);
  }

  choose() {
    if (this.chosen) return; this.chosen = true;
    sfx(this, 'select');
    this.registry.set('trainer', this.pool[this.sel]);
    this.registry.remove('run'); // nueva partida con el personaje elegido
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.time.delayedCall(320, () => this.scene.start('Story'));   // intro narrativa → Piso 1
  }

  update() {
    const d = this.gba.dirJust();
    if (d === 'left') this.move(-1); else if (d === 'right') this.move(1);
    if (this.gba.confirm()) this.choose();
  }
}

