// InteriorScene — interior REAL de un edificio del pueblo (Centro Pokémon / Poké
// Mart / posada). Entras por el felpudo de abajo, caminas hasta el mostrador y
// pulsas A para el servicio; B (o salir por abajo) vuelve al pueblo.
import Phaser from 'phaser';
import { VIEW, frameCamera } from '../main.js';
import { makeInput } from '../systems/input.js';
import { sfx } from '../systems/audio.js';
import { OWMETA } from '../../data/owmeta.generated.js';

const IMG = { pokecenter: 'int_center', rest: 'int_center', shop: 'int_mart', house: 'int_center' };
const TITLE = { pokecenter: 'CENTRO POKéMON', rest: 'POSADA', shop: 'POKé MART', house: 'CASA' };
const CLERK = { pokecenter: 'lyra', rest: 'serena', shop: 'wattson', house: 'may' };
// pistas/charla del vecino al entrar a una CASA decorativa (sin efecto mecánico)
const HOUSE_TIPS = [
  '"¡Bienvenido a mi casa! Equipa una CORREA y tu Pokémon te seguirá afuera."',
  '"Dicen que cada 50 pisos despierta un GUARDIÁN de la Torre... ten cuidado."',
  '"En la tienda venden discos para enseñar habilidades. ¡Échales ojo!"',
  '"Si todo tu equipo cae y tienes Pokémon en el PC, uno saldrá a rescatarte."',
  '"Descansa en el Centro antes de seguir subiendo, viajero."',
  '"Las bayas se activan solas en combate cuando tu Pokémon lo necesita."',
];
const SPEED = 0.14;   // px por ms

export class InteriorScene extends Phaser.Scene {
  constructor() { super('Interior'); }

  init(data) {
    this.kind = data.kind || 'pokecenter';
    this.run = data.run;
    this.returnTo = data.returnTo || 'Floor';
    this.leaving = false; this.served = false;
  }

  create() {
    frameCamera(this);
    const { w, h } = VIEW;
    this.gba = makeInput(this);
    this.add.rectangle(0, 0, w, h, 0x05060a, 1).setOrigin(0);

    // fondo: el interior real, escalado para caber dejando un margen
    const key = IMG[this.kind];
    const src = this.textures.get(key).getSourceImage();
    const s = Math.min((w - 16) / src.width, (h - 30) / src.height);
    const iw = src.width * s, ih = src.height * s;
    this.left = (w - iw) / 2; this.top = (h - ih) / 2;
    this.add.image(this.left, this.top, key).setOrigin(0, 0).setScale(s).setDepth(1);

    // límites caminables (dentro del suelo) y umbral de mostrador
    this.bounds = { x0: this.left + 26, x1: this.left + iw - 26, y0: this.top + ih * 0.42, y1: this.top + ih - 34 };
    this.counterY = this.top + ih * 0.48;

    // dependiente tras el mostrador (chibi real; decorativo)
    const clerk = CLERK[this.kind];
    if (OWMETA[clerk] && this.textures.exists('ow_' + clerk)) {
      this.add.sprite(w / 2, this.top + ih * 0.2, 'ow_' + clerk, 0).setOrigin(0.5, 0.8).setScale(2).setDepth(40);
    }

    // jugador (chibi del entrenador elegido), en el felpudo de entrada
    const tr = this.registry.get('trainer');
    const pid = tr?.id || 'red';
    this.facing = 'up';
    if (OWMETA[pid] && this.textures.exists('ow_' + pid)) {
      this.player = this.add.sprite(w / 2, this.bounds.y1, 'ow_' + pid, 1).setOrigin(0.5, 0.8).setScale(2);
    } else {
      this.player = this.add.image(w / 2, this.bounds.y1, this.textures.exists('trainer_' + pid) ? 'trainer_' + pid : 'trainer_red').setOrigin(0.5, 0.8);
    }
    this.player.setDepth(50);

    // cartel/título + ayuda
    this.add.text(w / 2, 8, TITLE[this.kind], { fontFamily: '"Press Start 2P"', fontSize: '9px', color: '#ffd76a', stroke: '#05060a', strokeThickness: 4 }).setOrigin(0.5, 0).setDepth(60);
    this.prompt = this.add.text(w / 2, h - 14, '', { fontFamily: '"Press Start 2P"', fontSize: '7px', color: '#cfe0f0', stroke: '#05060a', strokeThickness: 3 }).setOrigin(0.5).setDepth(60);

    sfx(this, 'select');
    this.cameras.main.fadeIn(220, 0, 0, 0);
  }

  setFrame(dir) {
    if (!this.player.setFrame) return;
    if (dir === 'down') this.player.setFrame(0).setFlipX(false);
    else if (dir === 'up') this.player.setFrame(1).setFlipX(false);
    else if (dir === 'left') this.player.setFrame(2).setFlipX(true);
    else if (dir === 'right') this.player.setFrame(2).setFlipX(false);
  }

  update(time, delta) {
    if (this.leaving) return;
    const d = this.gba.dirHeld();
    if (d) {
      const step = SPEED * delta;
      if (d === 'left') this.player.x -= step;
      else if (d === 'right') this.player.x += step;
      else if (d === 'up') this.player.y -= step;
      else if (d === 'down') this.player.y += step;
      this.player.x = Phaser.Math.Clamp(this.player.x, this.bounds.x0, this.bounds.x1);
      this.player.y = Phaser.Math.Clamp(this.player.y, this.bounds.y0, this.bounds.y1);
      this.facing = d;
      this.setFrame(d);
    }

    const atCounter = this.player.y <= this.counterY + 4;
    const atDoor = this.player.y >= this.bounds.y1 - 2;
    this.prompt.setText(atCounter ? 'A: usar servicio · B: salir'
      : atDoor ? '↓/B: salir' : 'Sube al mostrador · B: salir');

    if (this.gba.cancel()) return this.exit();
    if (atCounter && this.gba.confirm()) this.service();
  }

  service() {
    const run = this.run;
    if (this.kind === 'house') {
      // CASA decorativa: el vecino te saluda y suelta una pista (sin truco mecánico)
      this.toast(HOUSE_TIPS[Math.floor(Math.random() * HOUSE_TIPS.length)]);
      return;
    }
    if (this.kind === 'shop') {
      // reutiliza la tienda del piso (mismo surtido/UI): vuelve y la abre
      this.registry.set('pendingShop', true);
      return this.exit();
    }
    // Centro / Posada: curación completa
    const needs = run.party.some(m => m.hp < m.maxhp || m.status);
    if (!needs) { this.toast('"¡Tu equipo ya está en plena forma!"'); return; }
    run.party.forEach(m => { m.hp = m.maxhp; m.status = null; });
    sfx(this, 'heal');
    this.cameras.main.flash(260, 255, 190, 220);
    this.toast(this.kind === 'rest' ? '¡Descansaste! Equipo restaurado.' : '¡Tu equipo fue restaurado por completo!');
  }

  toast(text) {
    this.served = true;
    const t = this.add.text(VIEW.w / 2, 30, text, { fontFamily: '"Press Start 2P"', fontSize: '7px', color: '#ffd76a', backgroundColor: '#05060acc', padding: { x: 6, y: 5 }, align: 'center', wordWrap: { width: VIEW.w - 60 } }).setOrigin(0.5, 0).setDepth(70);
    this.tweens.add({ targets: t, alpha: 0, delay: 1400, duration: 500, onComplete: () => t.destroy() });
  }

  exit() {
    if (this.leaving) return; this.leaving = true;
    sfx(this, 'back');
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.time.delayedCall(210, () => { this.scene.stop(); this.scene.resume(this.returnTo); });
  }
}
