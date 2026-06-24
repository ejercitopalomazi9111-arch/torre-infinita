// StoryScene — INTRO narrativa: picnic en el bosque → el suelo se abre →
// caes a una cueva → tu inicial te encuentra y te trata según su PERSONALIDAD
// → le ofreces un Pokocho → amistad → te sigue. Select/C salta la intro.
import Phaser from 'phaser';
import { VIEW, frameCamera } from '../main.js';
import { makeInput } from '../systems/input.js';
import { SPECIES_BY_ID } from '../../data/species.generated.js';
import { WALKMETA } from '../../data/walkmeta.generated.js';
import { OWMETA } from '../../data/owmeta.generated.js';
import { generateRoomTiles } from '../systems/tower/tileGen.js';
import { registerBiomeTextures } from '../systems/textureFactory.js';
import { biomeForFloor } from '../../data/biomes.js';
import { sfx } from '../systems/audio.js';

// estilo de saludo por inicial (cómo te trata ANTES del Pokocho)
const PERS = {
  brave: { ids: [4, 158, 498, 255], hello: (n) => n === 'TOTODILE' ? '¡¿Y este?! ¡Te MORDIÓ el brazo! Auch, auch, AUCH.' : `¡${n} te embiste de saludo! Parece que así demuestra cariño...` },
  shy: { ids: [152, 155, 1, 387], hello: (n) => `${n} se esconde tras una roca... solo asoma un ojito.` },
  proud: { ids: [495, 393, 252, 7], hello: (n) => `${n} te mira de arriba a abajo... y te da la espalda. Qué carácter.` },
  playful: { ids: [25, 133, 390, 258, 501], hello: (n) => `¡${n} corre en círculos a tu alrededor! No sabes si es un saludo o una emboscada.` },
};
const styleOf = (id) => Object.keys(PERS).find(k => PERS[k].ids.includes(id)) || 'playful';

export class StoryScene extends Phaser.Scene {
  constructor() { super('Story'); }

  create() {
    frameCamera(this);
    const { w, h } = VIEW;
    this.gba = makeInput(this);
    this.starterId = this.registry.get('starter') || 25;
    this.sName = (SPECIES_BY_ID[this.starterId]?.name || 'PIKACHU').toUpperCase();
    const tr = this.registry.get('trainer');

    // ---- escenario PICNIC: una SALA REAL de bosque (misma estética que el piso 1) ----
    const biome = biomeForFloor(1);
    registerBiomeTextures(this, biome);
    const tm = generateRoomTiles({ id: 0, doors: [], type: 'normal' }, biome, 'story-picnic');
    const rt = this.add.renderTexture(0, 0, 480, 352).setOrigin(0);
    const key = (id) => `${biome.id}_${id}`;
    const tmp = this.add.image(0, 0, key('floor0')).setOrigin(0).setScale(2).setVisible(false);
    for (let r = 0; r < 11; r++) for (let c2 = 0; c2 < 15; c2++) {
      const cell = tm.cells[r][c2];
      tmp.setTexture(key(cell.base === 'wall' ? 'wall' + cell.variant : 'floor' + cell.variant)).setPosition(c2 * 32, r * 32);
      rt.draw(tmp);
    }
    tmp.destroy();
    // hojas que caen (ambiente vivo)
    this.time.addEvent({ delay: 900, loop: true, callback: () => {
      if (this.phase === 'cave') return;
      const lf = this.add.image(Phaser.Math.Between(0, w), -8, Math.random() < 0.5 ? 'fx_leaf1' : 'fx_leaf2').setScale(0.5).setAlpha(0.8);
      this.tweens.add({ targets: lf, y: h + 10, x: lf.x + Phaser.Math.Between(-40, 40), angle: 200, duration: Phaser.Math.Between(3500, 6000), onComplete: () => lf.destroy() });
    } });
    // ÁRBOLES GBA reales bordeando el claro. Anclados POR LA BASE (origin y=1) y
    // con profundidad < personajes: así la copa SOBRESALE de la pared y no quedan
    // "a la altura" de los muros (antes: origin centrado + sin depth → se fundían).
    // SOLO en la franja de pasto de ARRIBA, e INSET de los muros laterales
    // (antes: árboles en x≈26 / x≈w-26 y filas bajas caían sobre las paredes
    // izq/der). La copa sobresale del muro superior; nada toca los costados.
    const treeAt = (x, y, s, a = 1) => this.add.image(x, y, 'prop_tree', 0)
      .setOrigin(0.5, 1).setScale(s).setAlpha(a).setDepth(1).setFlipX(Math.random() < 0.5);
    const L = 64, R = w - 64;                          // margen seguro vs muros laterales
    for (let i = 0; i < 6; i++) {
      const x = L + (R - L) * (i / 5);
      treeAt(x, 72, 3.0);                              // fila de pasto superior
      if (i % 2 === 0) treeAt(x + 24, 104, 2.5, 0.92); // segunda fila, escalonada, aún arriba
    }
    this.add.image(60, 300, 'fx_rock1').setScale(0.8);
    this.add.image(w - 70, 296, 'fx_rock2').setScale(0.7);

    // mantel de picnic (textura gingham real) + meriendas
    this.picnic = this.add.container(0, 0);
    const mat = this.add.image(123, 255, 'picnic_mat').setOrigin(0.5).setAngle(-5);
    mat.setDisplaySize(84, 50);
    this.picnic.add(mat);
    this.picnic.add(this.add.image(110, 244, 'item_oranberry').setScale(1.1));
    this.picnic.add(this.add.image(146, 262, 'item_potion').setScale(1));

    // jugador (chibi) sentado junto al mantel
    const om = tr && OWMETA[tr.id];
    this.player = this.add.sprite(180, 236, om ? 'ow_' + tr.id : 'ow_red', 0).setOrigin(0.5, 0.9).setScale(2);
    this.trId = om ? tr.id : 'red';
    this.trMeta = om || OWMETA.red;

    // caja de diálogo
    this.box = this.add.graphics().setDepth(900);
    this.box.fillStyle(0x05060a, 0.94).fillRect(8, h - 78, w - 16, 70);
    this.box.lineStyle(2, 0xffd76a, 1).strokeRect(8, h - 78, w - 16, 70);
    this.txt = this.add.text(20, h - 68, '', { fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#e8f6ff', wordWrap: { width: w - 40 }, lineSpacing: 6 }).setDepth(901);
    this.hint = this.add.text(w - 16, h - 16, 'A continuar · Select saltar', { fontFamily: '"Press Start 2P"', fontSize: '6px', color: '#5a6a8a' }).setOrigin(1, 1).setDepth(901);

    this.phase = 'picnic';
    this.stepIdx = -1; this.waiting = false;
    this.steps = this.buildSteps();
    this.next();
    this.cameras.main.fadeIn(400, 0, 0, 0);
  }

  say(t) { this.txt.setText(t); this.waiting = true; }

  hearts() {
    for (let i = 0; i < 3; i++) {
      const hh = this.add.image(this.mon.x - 8 + i * 9, this.mon.y - 38, 'fx_heart').setScale(0.2).setAlpha(0).setDepth(60);
      this.tweens.add({ targets: hh, alpha: 1, scale: 0.6, y: hh.y - 14, duration: 380, delay: i * 140, ease: 'Back.out',
        onComplete: () => this.tweens.add({ targets: hh, alpha: 0, duration: 220, onComplete: () => hh.destroy() }) });
    }
  }

  next() {
    this.stepIdx++;
    const s = this.steps[this.stepIdx];
    if (!s) return;
    if (s.ask) {   // pregunta con opciones (Sí/No) — en su PROPIO recuadro
      this.txt.setText(s.ask);
      this.choiceIdx = 0; this.choosing = s; this.waiting = false;
      const opts = s.options, lh = 20, padX = 16, padY = 12;
      const bw = Math.min(VIEW.w - 16, Math.max(...opts.map(o => o.length)) * 9 + padX * 2 + 14);
      const bh = opts.length * lh + padY * 2 - (lh - 12);
      const bx = VIEW.w - 8 - bw, by = VIEW.h - 84 - bh;   // sobre la caja de diálogo
      this.choiceBox = this.add.graphics().setDepth(902);
      this.choiceBox.fillStyle(0x05060a, 0.96).fillRect(bx, by, bw, bh);
      this.choiceBox.lineStyle(2, 0xffd76a, 1).strokeRect(bx, by, bw, bh);
      this.choiceTexts = opts.map((op, i) =>
        this.add.text(bx + padX, by + padY + i * lh, op, { fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#9fb0d0' }).setDepth(903));
      this.paintChoice();
    } else if (s.say) this.say(typeof s.say === 'function' ? s.say() : s.say);
    else if (s.do) { this.waiting = false; s.do(() => this.next()); }
  }

  paintChoice() {
    this.choiceTexts.forEach((t, i) => t.setColor(i === this.choiceIdx ? '#ffd76a' : '#9fb0d0')
      .setText((i === this.choiceIdx ? '▶ ' : '  ') + this.choosing.options[i]));
  }

  buildSteps() {
    const { w } = VIEW;
    const style = styleOf(this.starterId);
    return [
      { say: 'Un día PERFECTO para un picnic en el Bosque Susurrante.\nSol, bayas, y ni un solo Beedrill a la vista.' },
      { say: 'Dicen que por aquí está la entrada a la TORRE INFINITA...\npero eso son cuentos. ¿Verdad?' },
      { do: (cb) => {   // camina a la DERECHA (frames laterales + flip) y el suelo cruje
        const meta = this.trMeta;
        if (meta.frames >= 9) {
          this.anims.create({ key: 'st_walk', frames: [7, 2, 8, 2].map(f => ({ key: 'ow_' + this.trId, frame: f })), frameRate: 8, repeat: -1 });
          this.player.setFlipX(true);   // el arte lateral GBA mira a la izquierda
          this.player.play('st_walk');
        }
        this.tweens.add({ targets: this.player, x: 280, duration: 1700, onComplete: () => {
          this.player.anims?.stop(); this.player.setFlipX(false).setFrame(0);
          this.cameras.main.shake(500, 0.012);
          cb();
        } });
      } },
      { say: '¡¿Q-qué fue eso?! El suelo... ¡EL SUELO!' },
      { do: (cb) => {   // se abre el agujero y caes (el agujero va DETRÁS del jugador)
        const hole = this.add.ellipse(this.player.x, this.player.y + 6, 8, 5, 0x05060a, 1).setDepth(20);
        this.player.setDepth(60);   // el PJ queda por DELANTE del agujero (se ve cayendo dentro)
        this.tweens.add({ targets: hole, scaleX: 9, scaleY: 8, duration: 500, ease: 'Quad.in' });
        this.cameras.main.shake(400, 0.018);
        this.time.delayedCall(480, () => {
          this.tweens.add({ targets: this.player, y: 270, scale: 0.1, angle: 540, duration: 650, ease: 'Quad.in' });
          this.cameras.main.fadeOut(700, 0, 0, 0);
          this.time.delayedCall(760, () => { hole.destroy(); this.toCave(); cb(); });
        });
      } },
      { say: '...\n\n...auch.' },
      { do: (cb) => {   // te levantas
        this.tweens.add({ targets: this.player, angle: 0, y: this.player.y - 6, duration: 350, ease: 'Back.out', onComplete: cb });
      } },
      { say: 'Estás en el fondo de una cueva. Arriba, muuuy arriba, se ve un puntito de luz.\n\nY algo se acerca...' },
      { do: (cb) => {   // entra el inicial caminando
        const meta = WALKMETA[this.starterId];
        if (meta && this.textures.exists('walk_' + this.starterId)) {
          this.mon = this.add.sprite(w + 20, 240, 'walk_' + this.starterId, 6 * meta.frames).setOrigin(0.5, 0.85);
          this.mon.setScale(44 / meta.fh);
          const key = `stw${this.starterId}`;
          this.anims.create({ key, frames: this.anims.generateFrameNumbers('walk_' + this.starterId, { start: 6 * meta.frames, end: 6 * meta.frames + meta.frames - 1 }), frameRate: 9, repeat: -1 });
          this.mon.play(key);
        } else {
          this.mon = this.add.image(w + 20, 240, 'mon_' + this.starterId).setScale(1.1);
        }
        this.mon.setDepth(4);   // llega EN SOMBRA (bajo la penumbra de la cueva)
        this.tweens.add({ targets: this.mon, x: this.player.x + 70, duration: 1500, onComplete: () => {
          this.mon.anims?.stop();
          this.mon.setDepth(10);                       // ¡se REVELA quién es!
          this.cameras.main.flash(140, 255, 255, 255);
          cb();
        } });
      } },
      { say: PERS[style].hello(this.sName) },
      { do: (cb) => this.helloAnim(style, cb) },
      { ask: 'Espera... en el bolsillo te queda UN Pokocho del picnic.\n\n¿Se lo das?', options: ['¡Claro que sí!', 'Mmm... mejor no.'], pick: (i, cb) => { this.gaveBerry = i === 0; cb(); } },
      { do: (cb) => {   // el Pokocho y la amistad (con o sin arrebato)
        const berry = this.add.image(this.player.x + 8, this.player.y - 20, 'item_oranberry').setScale(0.4).setDepth(50);
        if (!this.gaveBerry) {
          // dijiste que no... pues TE LO ARREBATA de la mano
          this.tweens.add({ targets: berry, scale: 1.1, y: this.player.y - 26, duration: 300 });
          this.tweens.add({ targets: this.mon, x: this.player.x + 16, duration: 220, delay: 350, ease: 'Quad.in', onComplete: () => {
            this.cameras.main.shake(120, 0.008);
            berry.destroy();
            this.tweens.add({ targets: this.mon, x: this.player.x + 48, duration: 300, onComplete: () => {
              this.tweens.add({ targets: this.mon, scaleY: this.mon.scaleY * 0.85, duration: 120, yoyo: true, repeat: 2 });
              this.time.delayedCall(650, () => { this.hearts(); this.time.delayedCall(900, cb); });
            } });
          } });
          return;
        }
        this.tweens.add({ targets: berry, x: this.player.x + 42, y: 246, scale: 1.2, duration: 480, ease: 'Quad.out', onComplete: () => {
          this.tweens.add({ targets: this.mon, x: this.player.x + 48, duration: 420, onComplete: () => {
            berry.destroy();
            this.tweens.add({ targets: this.mon, scaleY: this.mon.scaleY * 0.85, duration: 120, yoyo: true, repeat: 2 });   // ñam ñam
            this.time.delayedCall(650, () => { this.hearts(); this.time.delayedCall(900, cb); });
          } });
        } });
      } },
      { say: () => this.gaveBerry
          ? `A ${this.sName} le ENCANTÓ.\n\nDa un saltito, se sacude... y se planta a tu lado como si siempre hubiera estado ahí.`
          : `¡¿TE LO ARREBATÓ DE LA MANO?!\n\n...En fin. A ${this.sName} le encantó igual, y por lo visto ahora eres su humano favorito.` },
      { say: `¡${this.sName} y tú ahora son un equipo!\n\nSolo queda un camino: la TORRE. Piso a piso, hasta la cima.` },
      { do: () => this.finish() },
    ];
  }

  helloAnim(style, cb) {
    const px = this.player.x;
    if (style === 'brave') {
      this.tweens.add({ targets: this.mon, x: px + 26, duration: 220, ease: 'Quad.in', yoyo: true, onYoyo: () => {
        this.cameras.main.shake(150, 0.01);
        this.tweens.add({ targets: this.player, x: px - 10, duration: 120, yoyo: true });
      }, onComplete: cb });
    } else if (style === 'shy') {
      this.tweens.add({ targets: this.mon, x: this.mon.x + 34, alpha: 0.4, duration: 380, yoyo: true, hold: 500, onComplete: cb });
    } else if (style === 'proud') {
      // giro con squash (sin "pop"): se aplasta, voltea, se estira
      const sx = this.mon.scaleX;
      const turn = (flip, after) => this.tweens.add({ targets: this.mon, scaleX: 0, duration: 130, ease: 'Quad.in', onComplete: () => {
        this.mon.setFlipX(flip);
        this.tweens.add({ targets: this.mon, scaleX: sx, duration: 130, ease: 'Quad.out', onComplete: after });
      } });
      turn(true, () => this.time.delayedCall(750, () => turn(false, cb)));
    } else {  // playful: da vueltas a tu alrededor
      const path = [[px - 40, 252], [px, 262], [px + 50, 252], [px + 70, 240]];
      let i = 0;
      const hop = () => {
        if (i >= path.length) return cb();
        this.tweens.add({ targets: this.mon, x: path[i][0], y: path[i][1], duration: 260, onComplete: hop });
        i++;
      };
      hop();
    }
  }

  toCave() {
    // re-vestir la escena como CUEVA (overlay oscuro + jugador tirado en el suelo)
    this.phase = 'cave';
    this.add.rectangle(0, 0, VIEW.w, VIEW.h, 0x14101f, 0.93).setOrigin(0).setDepth(5);
    this.picnic.setVisible(false);
    const beam = this.add.triangle(240, 0, 0, 0, 60, 0, 30, 150, 0xfff3a8, 0.08).setDepth(6);   // el puntito de luz
    this.tweens.add({ targets: beam, alpha: 0.04, duration: 1600, yoyo: true, repeat: -1 });
    this.player.setDepth(10).setPosition(210, 252).setScale(2).setAngle(90).setFrame(0);
    this.cameras.main.fadeIn(500, 0, 0, 0);
  }

  finish() {
    this.cameras.main.fadeOut(450, 0, 0, 0);
    // sin seed fijo: FloorScene genera una semilla ALEATORIA por partida (pisos y
    // biomas únicos cada run; antes 'palomazi' fijo hacía idénticas todas las partidas)
    this.time.delayedCall(470, () => this.scene.start('Floor', { floor: 1 }));
  }

  update() {
    if (this.gba.justDown('SELECT')) return this.finish();          // saltar intro
    if (this.choosing) {
      const d = this.gba.dirJust();
      if (d === 'up') { this.choiceIdx = Math.max(0, this.choiceIdx - 1); sfx(this, 'cursor'); this.paintChoice(); }
      else if (d === 'down') { this.choiceIdx = Math.min(this.choosing.options.length - 1, this.choiceIdx + 1); sfx(this, 'cursor'); this.paintChoice(); }
      if (this.gba.confirm()) {
        sfx(this, 'select');
        const s = this.choosing;
        this.choiceTexts.forEach(t => t.destroy());
        this.choiceBox?.destroy(); this.choiceBox = null;
        this.choosing = null;
        s.pick(this.choiceIdx, () => this.next());
      }
      return;
    }
    if (this.waiting && this.gba.confirm()) { sfx(this, 'select'); this.waiting = false; this.next(); }
  }
}
