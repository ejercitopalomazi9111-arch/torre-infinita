// TitleScene — pantalla de título con estética cuidada (prioridad ①).
import Phaser from 'phaser';
import { t } from '../systems/i18n.js';
import { VIEW, frameCamera } from '../main.js';
import { SPECIES } from '../../data/species.generated.js';
import { makeInput } from '../systems/input.js';
import { hasSave, loadRun, hasPlayed } from '../systems/state.js';
import { playBgm, sfx } from '../systems/audio.js';

export class TitleScene extends Phaser.Scene {
  constructor() { super('Title'); }

  create() {
    frameCamera(this);
    const { w, h } = VIEW;
    playBgm(this, 'bgm_title', 0.3);   // tema del menú de FireRed
    // fondo: degradado vertical nocturno + viñeta
    const bg = this.add.graphics().setDepth(-3);   // capas: fondo -3 · cielo vivo -2/-1 · UI 0
    for (let i = 0; i < h; i += 2) {
      const f = i / h;
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(
        new Phaser.Display.Color(20, 18, 40), new Phaser.Display.Color(6, 8, 16), 100, f * 100);
      bg.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1).fillRect(0, i, w, 2);
    }
    // estrellas tenues
    for (let i = 0; i < 60; i++) {
      const s = this.add.rectangle(Phaser.Math.Between(0, w), Phaser.Math.Between(0, h * 0.7),
        1, 1, 0xffffff, Phaser.Math.FloatBetween(0.15, 0.7)).setDepth(-2);
      this.tweens.add({ targets: s, alpha: 0.1, duration: Phaser.Math.Between(1200, 3000), yoyo: true, repeat: -1 });
    }

    // silueta de torre ascendente (cuerpo + línea de luz por piso)
    const tower = this.add.graphics();
    for (let i = 0; i < 14; i++) {
      const tw = 120 - i * 6, tx = w / 2 - tw / 2, ty = h - 40 - i * 16;
      tower.fillStyle(0x0c0f1a, 1).fillRect(tx, ty, tw, 16);
      tower.fillStyle(0x202842, 1).fillRect(tx, ty, tw, 2);          // borde superior
      tower.fillStyle(0xffd76a, 0.5).fillRect(tx + tw / 2 - 1, ty + 6, 2, 4); // ventana
    }

    // Pokémon flotando junto al título (uno aleatorio del set), con oscilación viva
    const sp = Phaser.Utils.Array.GetRandom(SPECIES);
    const mon = this.add.image(72, 170, 'mon_' + sp.id).setScale(1.1);
    this.tweens.add({ targets: mon, y: 182, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.tweens.add({ targets: mon, x: 80, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.tweens.add({ targets: mon, angle: 4, duration: 2100, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    // ⭐ estrellas fugaces ocasionales
    this.time.addEvent({ delay: 3400, loop: true, callback: () => {
      if (Math.random() < 0.4) return;
      // cometa discreto de fondo: ENTRA desde fuera de pantalla, la cola crece
      // durante el vuelo y al final se apaga desde la cabeza hacia atrás
      const ang = Phaser.Math.DegToRad(30);
      const sx = Phaser.Math.Between(-60, w * 0.5), sy = -12 - Math.random() * 18;   // nace fuera
      const cmt = this.add.container(sx, sy).setDepth(-2).setRotation(ang);
      const tail = this.add.rectangle(-17, 0, 16, 1, 0xffffff, 0.35).setOrigin(0, 0.5).setScale(0.15, 1);
      const head = this.add.circle(0, 0, 1.4, 0xffffff, 0.8);
      cmt.add([tail, head]);
      this.tweens.add({ targets: tail, scaleX: 1, duration: 700 });                  // la cola crece
      this.tweens.add({
        targets: cmt, x: sx + Math.cos(ang) * 250, y: sy + Math.sin(ang) * 250, duration: 950,
        onComplete: () => {
          this.tweens.add({ targets: head, alpha: 0, duration: 130 });               // primero la cabeza...
          this.tweens.add({ targets: tail, scaleX: 0, alpha: 0, duration: 320, delay: 90, onComplete: () => cmt.destroy() });
        },
      });
    } });
    // 🐦 Pokémon voladores en silueta, muuuy al fondo
    const FLYERS = [16, 22, 41, 163, 276, 278, 396, 519];
    this.time.addEvent({ delay: 7000, loop: true, callback: () => {
      if (Math.random() < 0.35) return;
      const goingLeft = Math.random() < 0.5;
      const f = this.add.image(goingLeft ? w + 30 : -30, Phaser.Math.Between(30, 110), 'mon_' + Phaser.Utils.Array.GetRandom(FLYERS))
        .setTint(0x0c1020).setAlpha(0.5).setScale(0.45).setFlipX(goingLeft).setDepth(-1);
      this.tweens.add({ targets: f, x: goingLeft ? -40 : w + 40, duration: Phaser.Math.Between(14000, 22000), onComplete: () => f.destroy() });
      this.tweens.add({ targets: f, y: '+=7', duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    } });

    // título
    const title = this.add.text(w / 2, 92, t('game.title'), {
      fontFamily: '"Press Start 2P"', fontSize: '26px', color: '#ffd76a',
      align: 'center', stroke: '#3a2a08', strokeThickness: 6,
    }).setOrigin(0.5);
    title.setShadow(0, 4, 'rgba(0,0,0,0.6)', 6);
    this.tweens.add({ targets: title, scale: 1.03, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    this.add.text(w / 2, 128, t('game.subtitle'), {
      fontFamily: '"Press Start 2P"', fontSize: '9px', color: '#9fb0d0',
    }).setOrigin(0.5);

    // prompt
    const prompt = this.add.text(w / 2, h - 56, t('menu.press_start'), {
      fontFamily: '"Press Start 2P"', fontSize: '10px', color: '#e8f6ff',
    }).setOrigin(0.5);
    this.tweens.add({ targets: prompt, alpha: 0.2, duration: 700, yoyo: true, repeat: -1 });

    this.went = false;
    this.go = (target = 'Intro', data = {}) => {
      if (this.went) return; this.went = true;
      sfx(this, 'select');
      this.cameras.main.fadeOut(350, 0, 0, 0);
      this.time.delayedCall(360, () => this.scene.start(target, data));
    };
    // al pulsar START: si YA jugaste antes → MENÚ PRINCIPAL (Nueva/Cargar/Ajustes/
    // Créditos); si es tu PRIMERA vez → directo a la intro (nueva partida).
    const start = () => this.go(hasPlayed() ? 'MainMenu' : 'Intro');
    this.input.keyboard.once('keydown-ENTER', start);
    this.input.keyboard.once('keydown-SPACE', start);
    this.input.once('pointerdown', start);
    this.startMenu = start;
    this.gba = makeInput(this);   // gamepad: ✕/Options también inician

    // partida guardada → opción CONTINUAR
    if (hasSave()) {
      const sv = hasSave();
      const cont = this.add.text(w / 2, h - 38, `C: continuar partida (piso ${sv.floor})`, { fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#54e0c8' }).setOrigin(0.5);
      this.tweens.add({ targets: cont, alpha: 0.4, duration: 900, yoyo: true, repeat: -1 });
      this.continueGame = () => {
        const fl = loadRun(this.registry);
        if (fl) this.go('Floor', { seed: this.registry.get('run')?.seed, floor: fl });
      };
      this.input.keyboard.once('keydown-C', this.continueGame);
    }
    this.cameras.main.fadeIn(400, 0, 0, 0);

    // indicador de GAMEPAD: avisa cuando el navegador registra el control
    if (this.input.gamepad) {
      const padTxt = this.add.text(w - 8, h - 8, '', { fontFamily: '"Press Start 2P"', fontSize: '7px', color: '#54e0c8' }).setOrigin(1, 1);
      const refresh = () => padTxt.setText(this.input.gamepad.total > 0 ? '🎮 control conectado' : 'pulsa un botón del control...');
      this.input.gamepad.on('connected', refresh);
      this.input.gamepad.on('disconnected', refresh);
      refresh();
    }
  }

  update() {
    if (!this.gba || this.went) return;
    if (this.gba.justDown('TRI') && this.continueGame) return this.continueGame();   // △ continuar
    if (this.gba.confirm() || this.gba.justDown('START')) this.startMenu();
  }
}
