// BattleScene — combate por turnos (modo 1). Visualiza la máquina determinista
// (battle.js): sprites, barras de HP animadas, números de daño, mensajes y un
// menú de 4 movimientos. Feedback con flash/hitstop ligero (juice).
import Phaser from 'phaser';
import { VIEW, frameCamera } from '../main.js';
import { t } from '../systems/i18n.js';
import { Battle } from '../systems/combat/battle.js';
import { MOVES } from '../../data/moves.js';
import { nextLearnableMove } from '../systems/combat/movepool.js';
import { startRecording, saveRecording } from '../systems/combat/recorder.js';
import { markSeen, addCapturedMon, tryUnlock, diffOf } from '../systems/state.js';
import { makeCommentator } from '../systems/combat/commentary.js';
import { playMoveFX, playStatFX } from '../systems/combat/fxPlayer.js';
import { MAIN_DESC, ITEM_DESC, MOVE_DESC, partyFlavor, GIMMICK_NAME, GIMMICK_DESC, Z_MOVE_NAMES } from '../../data/flavor.js';
import { BALLS, HEALS } from '../../data/balls.js';
import { HELD, MEGA_SPECIES } from '../../data/items.js';
import { MEGAS } from '../../data/megas.generated.js';

const itemInfo = (k) => BALLS[k] || HEALS[k] || null;
const itemName = (k) => itemInfo(k)?.name || k;
import { makeRNG } from '../engine/rng.js';
import { computeStats } from '../systems/pokemon/stats.js';
import { makeInput } from '../systems/input.js';
import { playBgm, sfx, playCry } from '../systems/audio.js';
import { pendingEvolution, evolveMon } from '../systems/pokemon/evolution.js';


// legendarios/míticos Gen 1-4 → disparan el tema de batalla legendaria
const LEGENDS = new Set([144, 145, 146, 150, 151, 243, 244, 245, 249, 250, 251,
  377, 378, 379, 380, 381, 382, 383, 384, 385, 386, 480, 481, 482, 483, 484, 485, 486, 487, 488, 489, 490, 491, 492, 493]);

const TYPE_COLORS = {
  normal: 0xa8a878, fire: 0xf08030, water: 0x6890f0, electric: 0xf8d030, grass: 0x78c850,
  ice: 0x98d8d8, fighting: 0xc03028, poison: 0xa040a0, ground: 0xe0c068, flying: 0xa890f0,
  psychic: 0xf85888, bug: 0xa8b820, rock: 0xb8a038, ghost: 0x705898, dragon: 0x7038f8,
  dark: 0x705848, steel: 0xb8b8d0, fairy: 0xee99ac,
};

export class BattleScene extends Phaser.Scene {
  constructor() { super('Battle'); }

  init(data) {
    this.playerTeam = data.playerTeam;
    this.enemyTeam = data.enemyTeam;
    this.biome = data.biome;
    this.run = data.run || null;
    this.returnTo = data.returnTo || 'Floor';
    this.replay = !!data.replay;             // modo reproducción (Videocámara)
    this.floorNum = data.floor ?? null;
    this.seed = data.seed || ('btl' + Date.now());
    this.aiStyle = data.aiStyle || data.recording?.ai || 'wild';   // arquetipo IA (replay-safe)
    this.isBoss = !!data.boss || this.aiStyle === 'boss';           // jefe → música épica
    this.isTrainer = !!data.trainer;                                // combate de ENTRENADOR (sin captura, +dinero)
    this.isGuardian = !!data.guardian;                             // GUARDIÁN DE LA TORRE (jefe milestone)
    this.trainerName = data.trainerName || 'Entrenador';
    // legendario → tema de batalla legendaria de FireRed
    this.isLegendary = !!data.legendary || (this.enemyTeam || []).some(m => LEGENDS.has(m.speciesId || m.id));
    this.battle = new Battle(this.playerTeam, this.enemyTeam, this.seed, this.aiStyle);
    this.battle.ctx = { caught: this.run?.dex?.caught || [] };   // para Acopio Ball etc.
    this.busy = false;
    this.activeBall = null;
    this.evoTarget = null; this.evoMon = null;
    this.pendingLearns = [];   // movimientos por aprender (con equipo lleno → menú)
    // grabación: snapshot inicial determinista
    this.rec = this.replay ? null : startRecording({ seed: this.seed, teamA: this.playerTeam, teamB: this.enemyTeam, biome: this.biome, floor: this.floorNum, ai: this.aiStyle });
    this.recordedActions = this.replay ? (data.recording?.actions || []) : null;
    this.replayIdx = 0;
  }

  create() {
    frameCamera(this);
    const { w, h } = VIEW;
    // MÚSICA por contexto: repetición / jefe / combate normal (antes sonaba la
    // de exploración en todo el juego porque ninguna escena la cambiaba).
    playBgm(this, this.replay ? 'bgm_replay' : this.isLegendary ? 'bgm_legendary' : this.isBoss ? 'bgm_boss' : 'bgm_battle', 0.32);
    // fondo: degradado con tinte del bioma
    const pal = this.biome?.palette || { wall: '#26323a', floor: '#3f5a66' };
    const top = Phaser.Display.Color.HexStringToColor(pal.floor);
    const g = this.add.graphics();
    for (let i = 0; i < h; i += 2) {
      const f = i / h;
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(top, new Phaser.Display.Color(10, 12, 20), 100, f * 100);
      g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1).fillRect(0, i, w, 2);
    }
    // ESCENARIO DE FONDO por bioma (siluetas + ambiente + Pokémon de fondo)
    this.buildBackdrop(this.biome?.id || 'bosque', pal);

    // escenario (plataformas + sprites + fx) en un contenedor para poder
    // mover la "cámara" (zoom/paneo) en el modo retransmisión sin tocar la UI.
    this.stage = this.add.container(0, 0).setDepth(10);
    this.stage.add(this.add.ellipse(w - 110, 150, 150, 36, 0x000000, 0.25));
    this.stage.add(this.add.ellipse(120, 250, 170, 42, 0x000000, 0.25));

    const pm = this.battle.mon('A'), em = this.battle.mon('B');
    // sprites (enemigo arriba-derecha, jugador abajo-izq)
    // posiciones clásicas (centro); la capa de MENÚ va al frente y tapa pies/colas
    this.enemySprite = this.add.image(w - 110, 128, 'mon_' + em.speciesId).setScale(1.4);
    this.playerSprite = this.add.image(120, 226, 'mon_' + pm.speciesId).setScale(1.8).setFlipX(true);
    this.playerSprite._ball = pm.ball;   // su ball de captura (para recall/sendout)
    this.stage.add([this.enemySprite, this.playerSprite]);
    this.spawnIntro();

    // paneles de info
    this.enemyPanel = this.makeInfoPanel(40, 36, em);
    this.playerPanel = this.makeInfoPanel(w - 232, 168, pm);

    // idle de combate (respiración) tras terminar la entrada de cada sprite
    this.time.delayedCall(700, () => this.startIdle(this.enemySprite, 1.4));
    this.time.delayedCall((this.introMs || 600) + 250, () => this.startIdle(this.playerSprite, 1.8));

    // caja de mensajes + menú — AL FRENTE: pies/colas de sprites quedan debajo
    this.box = this.add.graphics().setDepth(900);
    this.box.fillStyle(0x05060a, 0.92).fillRect(8, h - 92, w - 16, 84);
    this.box.lineStyle(2, 0xffd76a, 1).strokeRect(8, h - 92, w - 16, 84);
    this.msg = this.add.text(22, h - 82, '', { fontFamily: '"Press Start 2P"', fontSize: '9px', color: '#e8f6ff', wordWrap: { width: w - 44 }, lineSpacing: 6 }).setDepth(901);

    if (!this.replay && this.run) markSeen(this.run, em.speciesId); // Pokédex: visto
    this.setupMenuKeys();

    // El juego normal NO muestra nada de "grabando" (la grabación es silenciosa).
    // Solo la REPETICIÓN tiene la parafernalia de retransmisión "Torre TV".
    if (this.replay) this.buildBroadcast();

    if (this.replay) {
      this.showMessage('', () => { this.broadcast({ t: 'start' }); this.time.delayedCall(1600, () => this.autoStep()); });
    } else {
      this.time.delayedCall(200, () => playCry(this, em.speciesId));   // cry REAL del rival al aparecer
      const intro = this.isTrainer ? `¡${this.trainerName} te desafía!` : `¡Un ${em.name.toUpperCase()} salvaje apareció!`;
      this.showMessage(intro, () => this.showMain(), this.introMs || 600);
    }
    this.cameras.main.fadeIn(250, 0, 0, 0);
  }

  // ---- MODO RETRANSMISIÓN (solo repeticiones) ----
  buildBroadcast() {
    const { w, h } = VIEW;
    this.msg.setVisible(false);                 // ocultamos la caja de mensajes normal
    this.box.setVisible(false);
    // barras letterbox (cine)
    // barras 6px más altas: el shake de cámara dejaba ver una rendija por abajo
    this.bars = this.add.container(0, 0).setDepth(500);
    this.bars.add(this.add.rectangle(0, -40, w, 40, 0x000000, 1).setOrigin(0, 0));
    this.bars.add(this.add.rectangle(0, h, w, 40, 0x000000, 1).setOrigin(0, 0));
    this.tweens.add({ targets: this.bars.list[0], y: -6, duration: 400, ease: 'Cubic.out' });
    this.tweens.add({ targets: this.bars.list[1], y: h - 34, duration: 400, ease: 'Cubic.out' });

    // banner TORRE TV
    const banner = this.add.container(10, 8).setDepth(520);
    const dot = this.add.circle(2, 4, 4, 0xff3b3b);
    this.tweens.add({ targets: dot, alpha: 0.25, duration: 700, yoyo: true, repeat: -1 });
    banner.add([dot, this.add.text(12, -2, 'TORRE TV', { fontFamily: '"Press Start 2P"', fontSize: '10px', color: '#ffffff' }),
      this.add.text(12, 11, 'REPETICIÓN', { fontFamily: '"Press Start 2P"', fontSize: '7px', color: '#ffd76a' })]);

    // caja del comentarista — SOBRE la barra de cine inferior (antes quedaba tapada)
    this.voBox = this.add.container(0, h - 64).setDepth(520);
    this.voBox.add(this.add.rectangle(0, 0, w, 30, 0x05060a, 0.92).setOrigin(0, 0));
    this.voBox.add(this.add.rectangle(0, 0, w, 2, 0xffd76a, 1).setOrigin(0, 0));
    this.voName = this.add.text(10, 4, '', { fontFamily: '"Press Start 2P"', fontSize: '7px', color: '#ffd76a' });
    this.voLine = this.add.text(10, 15, '', { fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#e8f6ff', wordWrap: { width: w - 20 } });
    this.voBox.add([this.voName, this.voLine]);

    // narrador determinista por la semilla del combate
    this.vo = makeCommentator(makeRNG(this.seed + ':vo'));
  }

  /** Narración + cámara cinematográfica para un evento (solo replay). */
  broadcast(e) {
    if (!this.vo) return;
    const em = this.battle.mon('B'), pm = this.battle.mon('A');
    const ctx = {
      atk: e.side === 'A' ? pm.name : em.name,
      def: e.side === 'A' ? em.name : pm.name,
      name: e.name,
      move: e.name,   // las plantillas usan {move} (fix "(move)" literal)
    };
    const said = this.vo.say(e, ctx);
    if (said) { this.voName.setText('◉ ' + said.speaker.name).setColor(said.speaker.color); this.voLine.setText(said.line); }
    // cámara
    const foe = (s) => s === 'A' ? this.enemySprite : this.playerSprite;
    const self = (s) => s === 'A' ? this.playerSprite : this.enemySprite;
    switch (e.t) {
      case 'move': this.cineFocus(self(e.side), 1.35, 380); break;
      case 'damage': this.cineFocus(e.target === 'A' ? this.playerSprite : this.enemySprite, e.crit || e.eff > 1 ? 1.7 : 1.4, 220); this.cameras.main.shake(160, e.crit ? 0.014 : 0.007); break;
      case 'faint': this.cineFocus(e.side === 'A' ? this.playerSprite : this.enemySprite, 1.85, 600); break;
      case 'caught': this.cineFocus(this.enemySprite, 1.6, 500); break;
      case 'switchIn': this.cineFocus(this.playerSprite, 1.3, 400); break;
      case 'end': this.cineReset(700); break;
      default: break;
    }
  }

  /** Acerca el "escenario" hacia un sprite (zoom/paneo tipo cámara TV). */
  cineFocus(target, zoom, dur) {
    if (!target) return;
    const fx = target.x, fy = target.y;
    this.tweens.add({ targets: this.stage, scaleX: zoom, scaleY: zoom, x: fx * (1 - zoom), y: fy * (1 - zoom), duration: dur, ease: 'Cubic.out' });
  }
  cineReset(dur = 500) {
    this.tweens.add({ targets: this.stage, scaleX: 1, scaleY: 1, x: 0, y: 0, duration: dur, ease: 'Cubic.inOut' });
  }

  /** Reproducción: alimenta las acciones grabadas en orden (sin menú). */
  autoStep() {
    if (this.battle.over) { this.finish(); return; }
    const action = this.recordedActions[this.replayIdx++] || this.battle.chooseAI('A');
    const log = this.battle.resolveTurn(action);
    this.playLog(log);
  }

  /** Escenario de fondo temático del bioma: siluetas + ambiente animado +
   *  Pokémon de fondo (volando/correteando). Detrás de las plataformas (depth<10). */
  buildBackdrop(biomeId, pal) {
    const { w, h } = VIEW;
    const horizon = 168;
    const accent = Phaser.Display.Color.HexStringToColor(pal.accent || '#88aa88');
    const wall = Phaser.Display.Color.HexStringToColor(pal.wall || '#26323a');
    const DARK = (c, f = 0.55) => Phaser.Display.Color.GetColor(c.r * f | 0, c.g * f | 0, c.b * f | 0);
    const back = this.add.container(0, 0).setDepth(3);
    // banda de horizonte (suelo lejano)
    back.add(this.add.rectangle(0, horizon, w, h - horizon, DARK(wall, 0.8), 1).setOrigin(0));
    back.add(this.add.rectangle(0, horizon, w, 3, DARK(accent, 0.9), 0.7).setOrigin(0));

    const tri = (x, baseY, bw, bh, col, a = 1) => back.add(this.add.triangle(x, baseY, -bw / 2, 0, bw / 2, 0, 0, -bh, col, a).setOrigin(0, 0));
    const prop = (key, x, y, s, tint) => { if (this.textures.exists(key)) { const im = this.add.image(x, y, key, 0).setOrigin(0.5, 1).setScale(s); if (tint != null) im.setTint(tint); back.add(im); } };

    // SILUETAS según el bioma
    if (biomeId === 'bosque') {
      for (let i = 0; i < 7; i++) prop('prop_tree', 20 + i * 75, horizon + 8, 2.4 + (i % 3) * 0.4, DARK(wall, 0.5));
    } else if (biomeId === 'glaciar') {
      tri(110, horizon, 230, 120, DARK(accent, 0.85)); tri(330, horizon, 280, 150, DARK(accent, 0.7)); tri(540, horizon, 220, 110, DARK(accent, 0.9));
    } else if (biomeId === 'ruinas') {
      for (let i = 0; i < 5; i++) back.add(this.add.rectangle(40 + i * 130, horizon, 26, 60 + (i % 2) * 40, DARK(wall, 0.7), 1).setOrigin(0.5, 1));
    } else if (biomeId === 'volcan') {
      tri(200, horizon, 320, 150, DARK(wall, 0.7)); tri(470, horizon, 260, 120, DARK(wall, 0.6));
      back.add(this.add.ellipse(200, horizon - 130, 60, 16, 0xff7a30, 0.5));   // resplandor de lava
    } else if (biomeId === 'cuevas' || biomeId === 'laboratorio' || biomeId === 'distorsion') {
      for (let i = 0; i < 9; i++) back.add(this.add.triangle(20 + i * 75, 0, -16, 0, 16, 0, 0, 24 + (i % 3) * 18, DARK(wall, 0.85), 1).setOrigin(0, 0));   // estalactitas
      for (let i = 0; i < 4; i++) prop('fx_rock1', 60 + i * 180, horizon + 10, 1.6, DARK(wall, 0.5));
    } else if (biomeId === 'cielo') {
      for (let i = 0; i < 5; i++) back.add(this.add.ellipse(50 + i * 150, 40 + (i % 2) * 30, 90, 30, 0xffffff, 0.18));   // nubes
    }

    // AMBIENTE animado por bioma (partículas que caen/suben)
    const AMB = {
      bosque: { tex: ['fx_leaf1', 'fx_leaf2'], up: false, n: 900 }, cielo: { tex: ['fx_feather'], up: false, n: 1100 },
      glaciar: { tex: null, color: 0xffffff, up: false, n: 700 }, volcan: { tex: ['fx_fireball'], up: true, n: 600 },
      cuevas: { tex: null, color: 0x9a8fb0, up: false, n: 1400 }, distorsion: { tex: ['fx_mistball'], up: true, n: 1000 },
      ruinas: { tex: null, color: 0xd8c98a, up: false, n: 1300 }, laboratorio: { tex: ['fx_electroball'], up: true, n: 1200 },
    }[biomeId] || { tex: null, color: 0xffffff, up: false, n: 1200 };
    this.time.addEvent({ delay: AMB.n, loop: true, callback: () => {
      if (!this.scene.isActive()) return;
      const x = Phaser.Math.Between(0, w), y0 = AMB.up ? h : -8, y1 = AMB.up ? horizon - 20 : h + 10;
      let p;
      if (AMB.tex && this.textures.exists(AMB.tex[0])) p = this.add.image(x, y0, Phaser.Utils.Array.GetRandom(AMB.tex)).setScale(0.45).setAlpha(0.8).setDepth(6);
      else p = this.add.circle(x, y0, AMB.up ? 2 : 1.5, AMB.color, 0.8).setDepth(6);
      this.tweens.add({ targets: p, y: y1, x: x + Phaser.Math.Between(-30, 30), angle: AMB.tex ? 200 : 0, alpha: 0.1, duration: Phaser.Math.Between(2600, 5200), onComplete: () => p.destroy() });
    } });

    // POKÉMON DE FONDO: cada cierto tiempo una silueta cruza el horizonte (vuela/corre)
    const FLYERS = [16, 21, 41, 396, 17, 10].filter(id => this.textures.exists('mon_' + id));
    if (FLYERS.length) this.time.addEvent({ delay: 4200, loop: true, callback: () => {
      if (!this.scene.isActive() || Math.random() > 0.6) return;
      const id = Phaser.Utils.Array.GetRandom(FLYERS), dir = Math.random() < 0.5 ? 1 : -1;
      const y = Phaser.Math.Between(40, horizon - 30);
      const m = this.add.image(dir > 0 ? -20 : w + 20, y, 'mon_' + id).setScale(0.5).setTint(DARK(wall, 0.4)).setAlpha(0.6).setFlipX(dir < 0).setDepth(5);
      this.tweens.add({ targets: m, x: dir > 0 ? w + 20 : -20, y: y + Phaser.Math.Between(-10, 10), duration: Phaser.Math.Between(3200, 5000), onComplete: () => m.destroy() });
      this.tweens.add({ targets: m, scaleY: 0.44, duration: 300, yoyo: true, repeat: -1 });   // aleteo
    } });
  }

  spawnIntro() {
    this.enemySprite.setAlpha(0).setScale(0.2);
    this.tweens.add({ targets: this.enemySprite, alpha: 1, scale: 1.4, duration: 350, ease: 'Back.out' });
    const tr = this.registry.get('trainer');
    if (this.replay || !tr || !this.textures.exists('trainer_' + tr.id)) {
      this.introMs = 600;
      this.playerSprite.setX(-40);
      this.tweens.add({ targets: this.playerSprite, x: 120, duration: 400, ease: 'Cubic.out' });
      return;
    }
    // SACADA: el entrenador entra, lanza la Poké Ball y tu Pokémon aparece
    this.introMs = 1600;
    this.playerSprite.setAlpha(0).setScale(0.05);
    const timg = this.add.image(-50, 222, 'trainer_' + tr.id).setDepth(40);
    const src = this.textures.get('trainer_' + tr.id).getSourceImage();
    timg.setScale(100 / Math.max(src.width, src.height));
    this.stage.add(timg);
    const leadBall = 'item_' + (this.battle.mon('A')?.ball || 'pokeball');
    this.tweens.add({ targets: timg, x: 60, duration: 380, ease: 'Cubic.out', onComplete: () => {
      const ball = this.add.image(78, 208, this.textures.exists(leadBall) ? leadBall : 'item_pokeball').setScale(1.1).setDepth(360);
      this.stage.add(ball);
      this.tweens.add({ targets: ball, x: 120, y: 198, angle: 480, duration: 360, ease: 'Quad.out', onComplete: () => {
        this.cameras.main.flash(110, 255, 255, 255);
        ball.destroy();
        playCry(this, this.battle.mon('A').speciesId);   // cry al sacar tu Pokémon
        this.tweens.add({ targets: this.playerSprite, alpha: 1, scale: 1.8, duration: 320, ease: 'Back.out' });
        this.tweens.add({ targets: timg, x: -60, alpha: 0.4, duration: 420, delay: 380, ease: 'Quad.in', onComplete: () => timg.destroy() });
      } });
    } });
  }

  /** Bote de poción/revivir que aparece junto al Pokémon y lo rocía. */
  sprayAnim(sprite, item, sparkle = false) {
    const info = itemInfo(item);
    const tex = 'item_' + (info ? item : 'potion');
    if (this.textures.exists(tex)) {
      // el bote aparece a la DERECHA del Pokémon, mirándolo, y lo rocía de frente
      const bottle = this.add.image(sprite.x + 46, sprite.y - 40, tex).setScale(0).setDepth(360).setAngle(18);
      this.stage.add(bottle);
      this.tweens.add({ targets: bottle, scale: 1.3, duration: 200, ease: 'Back.out' });
      this.tweens.add({ targets: bottle, angle: -14, duration: 130, delay: 220, yoyo: true, repeat: 2 });       // sacudida de spray
      this.tweens.add({ targets: bottle, alpha: 0, y: bottle.y - 14, duration: 220, delay: 800, onComplete: () => bottle.destroy() });
    }
    // nube de rocío que viaja DEL BOTE HACIA el Pokémon (+ brillos si es revivir)
    const puffTex = sparkle ? 'fx_shine' : 'fx_waterwisp';
    for (let i = 0; i < 4; i++) {
      const p = this.add.image(sprite.x + 30 - i * 11, sprite.y - 26 - (i % 2) * 7, puffTex).setScale(0.2).setAlpha(0).setDepth(355);
      if (!sparkle) p.setTint(0xbfffd9);
      this.stage.add(p);
      this.tweens.add({
        targets: p, alpha: 0.9, scale: 0.55, x: p.x - 16, y: p.y - 8, duration: 260, delay: 280 + i * 90, ease: 'Quad.out',
        onComplete: () => this.tweens.add({ targets: p, alpha: 0, duration: 200, onComplete: () => p.destroy() }),
      });
    }
  }

  makeInfoPanel(x, y, mon) {
    const c = this.add.container(x, y).setDepth(960);
    const bg = this.add.graphics();
    bg.fillStyle(0x1a2238, 0.95).fillRoundedRect(0, 0, 192, 40, 6);
    bg.lineStyle(2, 0x2a3a5a, 1).strokeRoundedRect(0, 0, 192, 40, 6);
    const lvl = this.add.text(182, 6, 'Lv' + mon.level, { fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#ffd76a' }).setOrigin(1, 0);
    // nombre: alineado arriba-izq y AUTO-ESCALADO para que nunca pise el "Lv"
    // ni se salga de la caja (antes nombres largos quedaban mal escalados).
    const name = this.add.text(10, 6, mon.name.toUpperCase(), { fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#ffffff' }).setOrigin(0, 0);
    const maxNameW = 182 - 10 - lvl.width - 8;   // hueco real hasta el "Lv"
    for (let fs = 8; fs > 5 && name.width > maxNameW; fs--) name.setFontSize(fs);
    const barBg = this.add.graphics(); barBg.fillStyle(0x05060a, 1).fillRect(10, 24, 172, 8);
    const bar = this.add.graphics();
    const hpText = this.add.text(182, 14, `${mon.hp}/${mon.maxhp}`, { fontFamily: '"Press Start 2P"', fontSize: '7px', color: '#cfe0f0' }).setOrigin(1, 0);
    c.add([bg, name, lvl, barBg, bar, hpText]);
    const panel = { c, bar, mon, hpText, shownHp: mon.hp }; // shownHp = lo que se ve ahora
    this.drawHp(panel);
    return panel;
  }

  /** Dibuja la barra usando shownHp (no el hp ya mutado por el motor). */
  drawHp(panel) {
    const v = Math.max(0, Math.round(panel.shownHp));
    const ratio = Phaser.Math.Clamp(v / panel.mon.maxhp, 0, 1);
    const col = ratio > 0.5 ? 0x58e070 : ratio > 0.2 ? 0xf8d030 : 0xf04040;
    panel.bar.clear().fillStyle(col, 1).fillRect(11, 25, 170 * ratio, 6);
    if (panel.hpText) panel.hpText.setText(`${v}/${panel.mon.maxhp}`);
  }

  /** Anima la barra de un panel desde shownHp hasta un hp objetivo del evento. */
  animateHp(panel, toHp, dur = 360) {
    const from = panel.shownHp;
    this.tweens.addCounter({ from, to: toHp, duration: dur, onUpdate: (tw) => { panel.shownHp = tw.getValue(); this.drawHp(panel); }, onComplete: () => { panel.shownHp = toHp; this.drawHp(panel); } });
  }

  /** Reconstruye el panel de un lado para el Pokémon activo actual. */
  rebuildPanel(side, ev) {
    const mon = this.battle.mon(side);
    if (side === 'A') { if (this.playerPanel) this.playerPanel.c.destroy(true); this.playerPanel = this.makeInfoPanel(VIEW.w - 232, 168, mon); }
    else { if (this.enemyPanel) this.enemyPanel.c.destroy(true); this.enemyPanel = this.makeInfoPanel(40, 36, mon); }
    // la barra muestra el HP DEL MOMENTO del evento: el daño posterior se anima
    // después (la vida JAMÁS baja antes de la animación)
    const panel = side === 'A' ? this.playerPanel : this.enemyPanel;
    if (ev && ev.hp != null) {
      panel.shownHp = ev.hp;
      panel.hpText.setText(`${ev.hp}/${ev.maxhp ?? mon.maxhp}`);
      this.drawHp(panel);
    }
  }

  // --- sistema de menú (main / fight / bag / party) ---
  setupMenuKeys() {
    this.menuItems = [];
    this.cursor = 0;
    this.gba = makeInput(this);              // control tipo GBA (D-pad/A/B/...)
    // atajos numéricos opcionales (además del D-pad)
    this.input.keyboard.on('keydown', (ev) => {
      if (this.busy || this.replay) return;
      const n = parseInt(ev.key, 10);
      if (n >= 1 && n <= this.menuItems.length) this.menuItems[n - 1].onPick();
    });
  }

  /** Navegación de menús por teclado (D-pad mueve, A confirma, B vuelve). */
  update() {
    if (this.busy || this.replay || !this.gba || !this.menuItems.length) return;
    const cols = 2, n = this.menuItems.length;
    const dir = this.gba.dirJust();
    if (dir === 'left') this.moveCursor(-1);
    else if (dir === 'right') this.moveCursor(1);
    else if (dir === 'up') this.moveCursor(-cols);
    else if (dir === 'down') this.moveCursor(cols);
    if (this.gba.confirm()) { sfx(this, 'select'); this.menuItems[this.cursor]?.onPick(); }
    else if (this.gba.cancel()) { if (this.menuState && !['main', 'learn'].includes(this.menuState)) { sfx(this, 'back'); this.showMain(); } }
  }

  moveCursor(d) {
    const n = this.menuItems.length;
    const prev = this.cursor;
    this.cursor = Phaser.Math.Clamp(this.cursor + d, 0, n - 1);
    if (this.cursor !== prev) sfx(this, 'cursor');
    this.highlightCursor();
  }

  highlightCursor() {
    (this.menuRects || []).forEach((r, i) => {
      const on = i === this.cursor;
      // sin escalar: el botón crecido se salía del recuadro de la caja
      r.setStrokeStyle(on ? 3 : 2, on ? 0xffffff : 0x05060a);
    });
    // descripción divertida del elemento resaltado (regla: navegar entretiene)
    const it = this.menuItems[this.cursor];
    // compacta (8px, arriba) y RECORTADA a 2 líneas: antes una descripción larga
    // se montaba sobre los botones del menú (bug del cuadro de texto).
    this.msg.setFontSize(8).setLineSpacing(3).setY(VIEW.h - 90);
    const full = it?.desc || this.menuPrompt || '';
    this.msg.setText(full);
    const lines = this.msg.getWrappedText(full);
    if (lines.length > 2) this.msg.setText(lines.slice(0, 2).join('\n').replace(/\s*\S*$/, '…'));
  }

  clearPanel() {
    if (this.panel) this.panel.destroy(true);
    this.panel = this.add.container(0, 0).setDepth(950);
    this.menuItems = [];
    this.menuRects = [];
    this.cursor = 0;
  }

  /** Renderiza botones en rejilla dentro de la caja inferior. */
  renderGrid(items, { cols = 2 } = {}) {
    const { w, h } = VIEW;
    // altura adaptable: con >4 botones (p.ej. movimientos + Fenómeno) encoge para
    // no salirse de la caja ni pisar el mensaje.
    const rows = Math.ceil(items.length / cols);
    const bh = rows > 2 ? 15 : 18, yBase = h - 58;
    const bw = (w - 28) / cols;
    items.forEach((it, i) => {
      const bx = 14 + (i % cols) * (bw + 4), by = yBase + Math.floor(i / cols) * (bh + 3);
      const r = this.add.rectangle(bx, by, bw, bh, it.color ?? 0x2a3a5a, 1).setOrigin(0, 0).setStrokeStyle(2, 0x05060a);
      const fg = it.fg ?? '#ffffff';
      const label = this.add.text(bx + 7, by + 5, it.label, { fontFamily: '"Press Start 2P"', fontSize: '8px', color: fg });
      this.panel.add([r, label]);
      if (it.sub) this.panel.add(this.add.text(bx + bw - 6, by + 5, it.sub, { fontFamily: '"Press Start 2P"', fontSize: '7px', color: fg }).setOrigin(1, 0));
      r.setInteractive({ useHandCursor: true })
        .on('pointerover', () => { if (this.cursor !== i) sfx(this, 'cursor'); this.cursor = i; this.highlightCursor(); })
        .on('pointerdown', () => { sfx(this, 'select'); it.onPick(); });
      this.menuItems.push(it); this.menuRects.push(r);
    });
    this.highlightCursor();
  }

  /** Menú paginado que NUNCA pasa de 4 botones (rejilla 2×2): hasta 3 elementos
   *  + Atrás; si hay más, muestra 2 + "▼ Más" (cicla) + Atrás. Evita que las
   *  opciones se salgan de la caja durante el combate. */
  renderPagedMenu(content, off, reshow, back) {
    const items = [];
    if (content.length <= 3) {
      items.push(...content);
    } else {
      const page = content.slice(off, off + 2);
      items.push(...page);
      const next = off + 2 >= content.length ? 0 : off + 2;
      items.push({ label: '▼ Más', color: 0x33384a, desc: `Más opciones (${off + page.length}/${content.length}).`, onPick: () => reshow(next) });
    }
    items.push({ label: '← Atrás', color: 0x33384a, desc: ITEM_DESC.back, onPick: back });
    this.renderGrid(items);
  }

  showMain() {
    if (this.battle.over) return;
    this.menuState = 'main';
    this.clearPanel();
    this.menuPrompt = `¿Qué hará ${this.battle.mon('A').name.toUpperCase()}?`;
    this.renderGrid([
      { label: 'LUCHAR', color: 0xc03028, desc: MAIN_DESC.LUCHAR, onPick: () => this.showFight() },
      { label: 'MOCHILA', color: 0xd0901c, desc: MAIN_DESC.MOCHILA, onPick: () => this.showBag() },
      { label: 'POKéMON', color: 0x3a78c0, desc: MAIN_DESC['POKéMON'], onPick: () => this.showParty() },
      { label: 'HUIR', color: 0x556070, desc: MAIN_DESC.HUIR, onPick: () => this.act({ type: 'run' }) },
    ]);
    // IA AUTÓNOMA: si está activa (y no es repetición), decide el turno sola
    if (!this.replay && this.registry.get('autoplay')) this.time.delayedCall(450, () => this.autoBattleTurn());
  }

  /** Turno del jugador decidido por la IA: cura si está bajo, captura salvajes
   *  débiles, si no ataca con el mejor movimiento. */
  autoBattleTurn() {
    if (this.busy || this.battle.over || this.menuState !== 'main' || !this.registry.get('autoplay')) return;
    const me = this.battle.mon('A'), foe = this.battle.mon('B');
    const bag = this.run?.bag || {};
    // curar si está muy bajo y tiene con qué
    if (me.hp < me.maxhp * 0.28) {
      const heal = Object.keys(bag).find(k => bag[k] > 0 && HEALS[k] && (HEALS[k].heal != null));
      if (heal) return this.useItem(heal);
    }
    // capturar salvaje débil (no a entrenadores) si hay hueco y balls
    const wild = this.aiStyle === 'wild';
    if (wild && foe.hp < foe.maxhp * 0.4 && (this.run?.party?.length || 6) < 6) {
      const ball = ['ultraball', 'quickball', 'superball', 'pokeball'].find(k => bag[k] > 0) || Object.keys(bag).find(k => bag[k] > 0 && BALLS[k]);
      if (ball && Math.random() < 0.65) return this.useItem(ball);
    }
    // atacar con el movimiento de mayor poder disponible (+ fenómeno si lo lleva)
    const usable = me.moves.filter(id => (me.pp[id] ?? 1) > 0);
    const best = (usable.length ? usable : me.moves).sort((a, b) => (MOVES[b]?.power || 0) - (MOVES[a]?.power || 0))[0];
    const gim = this.gimmicksAvailable()[0];   // Mega/Z/Dinamax si el objeto equipado lo permite
    this.act({ type: 'move', move: best, gimmick: gim });
  }

  showFight() {
    this.menuState = 'fight';
    this.clearPanel();
    const g = this.pendingGimmick;
    this.menuPrompt = g ? `✦ ${GIMMICK_NAME[g]} listo — elige movimiento` : 'Elige un movimiento (B: atrás)';
    const mon = this.battle.mon('A');
    const items = mon.moves.map(id => {
      const mv = MOVES[id];
      const stats = mv.power != null ? `Pot ${mv.power} · Prec ${mv.acc > 100 ? '∞' : mv.acc}` : 'Estado';
      return {
        label: mv.name, sub: `${mon.pp[id]}/${mv.pp}`,
        color: TYPE_COLORS[mv.type] || 0x445566, fg: '#05060a',
        desc: `${MOVE_DESC[id] || ''} (${stats})`,
        onPick: () => { const gim = this.pendingGimmick, mv = this.pendingMegaVariant; this.pendingGimmick = null; this.pendingMegaVariant = null; this.act({ type: 'move', move: id, gimmick: gim, megaVariant: mv }); },
      };
    });
    // botón FENÓMENO (Mega/Z/Dinamax/Tera) si queda alguno sin usar (no en replay)
    if (!this.replay && this.gimmicksAvailable().length) {
      items.push({ label: g ? `✦ ${GIMMICK_NAME[g]}✓` : '✦ FENÓMENO', color: 0x6a3a8a, fg: '#ffffff',
        desc: 'Mega/Z/Dinamax/Tera: potencia a tu Pokémon (1 vez por combate cada uno).',
        onPick: () => this.showGimmick() });
    }
    this.renderGrid(items);
  }

  /** Fenómenos disponibles AHORA: dependen del OBJETO equipado en el Pokémon activo
   *  y de su elegibilidad. Mega: necesita Piedra Mega + ser especie que megaevoluciona
   *  (no cualquiera). Z: necesita Cristal Z (cualquier especie). 1 uso por combate. */
  gimmicksAvailable() {
    const u = this.battle.gimmicksUsed || {};
    const mon = this.battle.mon('A');
    const gi = mon?.item && HELD[mon.item]?.gimmick;   // gimmick del objeto que lleva
    const out = [];
    if (gi === 'mega' && MEGA_SPECIES.has(mon.speciesId) && !u.mega) out.push('mega');
    if (gi === 'z' && !u.z) out.push('z');
    if (gi === 'dynamax' && !u.dynamax) out.push('dynamax');
    return out;
  }

  /** Submenú para ARMAR un fenómeno; se aplica al elegir luego el movimiento. */
  showGimmick(off = 0) {
    this.menuState = 'gimmick';
    this.clearPanel();
    this.menuPrompt = 'Elige un FENÓMENO (B: atrás)';
    const monId = this.battle.mon('A')?.speciesId;
    const dualMega = MEGAS[monId]?.dual;
    const content = [];
    for (const k of this.gimmicksAvailable()) {
      if (k === 'mega' && dualMega) {
        // Charizard/Mewtwo: elige Mega X o Y (tipos/stats distintos)
        content.push({ label: 'MEGA X', color: 0x6a3a8a, desc: `Megaevoluciona a la forma X (${(MEGAS[monId].x.types || []).join('/')}).`, onPick: () => { this.pendingGimmick = 'mega'; this.pendingMegaVariant = 'x'; sfx(this, 'select'); this.showFight(); } });
        content.push({ label: 'MEGA Y', color: 0x6a3a8a, desc: `Megaevoluciona a la forma Y (${(MEGAS[monId].y.types || []).join('/')}).`, onPick: () => { this.pendingGimmick = 'mega'; this.pendingMegaVariant = 'y'; sfx(this, 'select'); this.showFight(); } });
      } else {
        content.push({ label: GIMMICK_NAME[k], color: 0x6a3a8a, desc: GIMMICK_DESC[k], onPick: () => { this.pendingGimmick = k; this.pendingMegaVariant = null; sfx(this, 'select'); this.showFight(); } });
      }
    }
    this.renderPagedMenu(content, off, (o) => this.showGimmick(o), () => this.showFight());
  }

  showBag(off = 0) {
    this.menuState = 'bag';
    this.clearPanel();
    this.menuPrompt = 'Mochila (B: atrás)';
    const bag = this.run?.bag || {};
    // en combate solo balls y curación; contra ENTRENADORES no se pueden lanzar balls
    const all = Object.keys(bag).filter(k => bag[k] > 0 && ((BALLS[k] && !this.isTrainer) || HEALS[k]));
    const content = all.map(k => ({
      label: itemName(k), sub: 'x' + bag[k], color: BALLS[k] ? 0x355a45 : 0x45355a,
      desc: itemInfo(k)?.desc || ITEM_DESC[k],
      onPick: () => this.useItem(k),
    }));
    this.renderPagedMenu(content, off, (o) => this.showBag(o), () => this.showMain());
  }

  showParty(off = 0) {
    this.menuState = 'party';
    this.clearPanel();
    this.menuPrompt = 'Cambiar Pokémon (B: atrás)';
    const team = this.run?.party || this.playerTeam;
    const content = team.map((m, i) => ({
      label: m.name.toUpperCase(), sub: `${m.hp}/${m.maxhp}`,
      color: m.hp > 0 ? (i === this.battle.active.A ? 0x445a8a : 0x2a3a5a) : 0x5a2a2a,
      desc: `Nv${m.level} ${m.types.join('/')}. ${partyFlavor(m, i === this.battle.active.A)}`,
      onPick: () => { if (m.hp > 0 && i !== this.battle.active.A) this.act({ type: 'switch', index: i }); },
    }));
    this.renderPagedMenu(content, off, (o) => this.showParty(o), () => this.showMain());
  }

  /** Ejecuta una acción del jugador: graba, resuelve turno, anima. */
  act(action) {
    if (this.busy || this.battle.over) return;
    if (this.rec) this.rec.actions.push(action);
    this.clearPanel();
    const log = this.battle.resolveTurn(action);
    this.playLog(log);
  }

  useItem(key) {
    if (this.run && this.run.bag[key] > 0) this.run.bag[key]--;
    this.act({ type: 'item', item: key });
  }

  // reproduce el log de eventos como animaciones+mensajes en secuencia
  playLog(log) {
    this.busy = true;
    const queue = [...log];
    const next = () => {
      if (!queue.length) {
        this.busy = false;
        if (this.battle.over) this.finish();
        else if (this.replay) this.autoStep();
        else this.showMain();
        return;
      }
      const e = queue.shift();
      this.handleEvent(e, next);
    };
    next();
  }

  handleEvent(e, done) {
    // narración DESPUÉS de la acción (si no, el comentarista "conoce el futuro")
    if (this.replay) this.time.delayedCall(430, () => this.broadcast(e));
    const D = 520;
    const panelFor = (side) => side === 'A' ? this.playerPanel : this.enemyPanel;
    const spriteFor = (side) => side === 'A' ? this.playerSprite : this.enemySprite;
    switch (e.t) {
      case 'move': {
        const who = e.side === 'A' ? this.battle.mon('A').name : this.battle.mon('B').name;
        // FX data-driven por TIPO del movimiento (motor fxPlayer, assets Showdown)
        const fs = spriteFor(e.side), ts = spriteFor(this.battle.foeSide(e.side));
        this.showMessage(`${who.toUpperCase()} usó ${e.name}!`);
        return playMoveFX(this, e.move, fs, ts, () => this.time.delayedCall(160, done));
      }
      case 'damage': {
        const p = panelFor(e.target), s = spriteFor(e.target);
        sfx(this, 'hit', e.crit ? 0.55 : 0.4);
        this.cameras.main.shake(120, e.crit ? 0.012 : 0.006);
        this.tweens.add({ targets: s, alpha: 0.2, duration: 60, yoyo: true, repeat: 2 });
        this.popDamage(s.x, s.y, e.amount, e.crit);
        this.animateHp(p, e.hp);   // anima desde lo que se ve hasta el hp del evento
        let extra = ''; if (e.eff > 1) extra = '¡Es supereficaz!'; else if (e.eff > 0 && e.eff < 1) extra = 'No es muy eficaz...'; else if (e.eff === 0) extra = 'No afecta...';
        if (e.crit) extra = '¡Golpe crítico! ' + extra;
        return this.time.delayedCall(D, () => extra ? this.showMessage(extra, done, 380) : done());
      }
      case 'miss': return this.showMessage('¡Pero falló!', done, 380);
      case 'status': return this.showMessage(`¡${this.statusName(e.status)}!`, done, 380);
      case 'stat': { playStatFX(this, spriteFor(e.side), e.stages > 0); return this.time.delayedCall(420, done); }
      case 'chip': { const p = panelFor(e.side); this.animateHp(p, e.hp); return this.showMessage(`Sufre daño de ${e.reason}.`, done, 380); }
      case 'faint': { const s = spriteFor(e.side); this.stopIdle(s); this.faintAnim(s, e.side); return this.showMessage(`¡${e.name.toUpperCase()} se debilitó!`, done, 600); }
      case 'switch': {
        // cambio: usar LOS DATOS DEL EVENTO (e), no el estado final del turno.
        const s = spriteFor(e.side);
        const fin = e.side === 'A' ? 1.8 : 1.4, flip = e.side === 'A';
        // jugador (no replay): guardar el actual con su haz y LANZAR la ball del nuevo
        if (e.side === 'A' && !this.replay) {
          this.stopIdle(s);
          this.showMessage('¡Vuelve!');
          this.recallAnim(s, () => {
            this.rebuildPanel('A', e);
            this.showMessage(`¡Adelante, ${e.name.toUpperCase()}!`);
            // RESET de posición: el faint previo bajó la `y` (+30); sin esto el
            // reemplazo (p.ej. Pikachu) emergía demasiado abajo, pegado a la caja.
            s.setPosition(120, 226);
            this.sendOutAnim(s, e.speciesId, fin, flip, 120, 250, done, e.ball);
          });
          return;
        }
        this.stopIdle(s);
        s.setTexture('mon_' + e.speciesId).setY(e.side === 'A' ? 226 : 128).setAlpha(1).setScale(fin).setFlipX(flip);
        this.startIdle(s, fin);
        this.rebuildPanel(e.side, e);
        return this.showMessage(`¡Adelante, ${e.name.toUpperCase()}!`, done, 450);
      }
      case 'thaw': return this.showMessage('¡Se descongeló!', done, 320);
      case 'flinch': return this.showMessage('No puede moverse.', done, 320);
      case 'recoil': { const p = panelFor(e.side); this.animateHp(p, e.hp); return done(); }
      case 'heal': {
        const p = this.playerPanel;
        sfx(this, 'heal');
        this.sprayAnim(this.playerSprite, e.item);              // aparece el bote y rocía
        this.time.delayedCall(450, () => this.animateHp(p, e.hp, 300));
        return this.showMessage(`${p.mon.name.toUpperCase()} recuperó ${e.amount} PS.`, done, 1000);
      }
      case 'revive': {
        this.sprayAnim(this.playerSprite, 'revive', true);
        return this.showMessage(`¡${e.name.toUpperCase()} volvió en sí! (${e.hp}/${e.maxhp} PS)`, done, 1000);
      }
      case 'noeffect': return this.showMessage('No tendría ningún efecto.', done, 450);
      case 'throw': { this.throwBallAnim(e.item); return this.showMessage(`¡Lanzaste una ${itemName(e.item)}!`, done, 900); }
      case 'catchfail': return this.wobbleBall(e.shakes, () => {
        const ball = this.activeBall;
        if (ball) { this.tweens.add({ targets: ball, alpha: 0, scale: 2.2, duration: 180, onComplete: () => ball.destroy() }); this.activeBall = null; }
        this.enemySprite.setPosition(VIEW.w - 110, 128).setScale(0.05).setAlpha(1);
        this.tweens.add({ targets: this.enemySprite, scale: 1.4, duration: 240, ease: 'Back.out', onComplete: () => this.startIdle(this.enemySprite, 1.4) });
        const msg = ['¡Oh, no! ¡Se ha escapado!', '¡Casi! ¡Estuvo cerca!', '¡Ahh! ¡Faltó muy poco!'][Math.min(2, e.shakes)];
        this.showMessage(`${e.shakes} sacudida(s)... ${msg}`, done, 700);
      });
      case 'caught': return this.wobbleBall(3, () => {
        const ball = this.activeBall;
        this.cameras.main.flash(160, 255, 230, 140);
        if (ball) this.tweens.add({ targets: ball, scaleX: 1.7, scaleY: 1.2, duration: 120, yoyo: true });
        this.checkAch('capture');
        this.showMessage(`¡${e.name.toUpperCase()} fue capturado!`, done, 900);
      });
      case 'run': return this.showMessage('¡Escapaste sin problemas!', done, 500);
      case 'runfail': return this.showMessage('¡No pudiste escapar!', done, 450);
      case 'switchIn': {
        this.stopIdle(this.playerSprite);
        this.playerSprite._ball = e.ball;
        this.playerSprite.setTexture('mon_' + e.speciesId).setPosition(120, 226).setScale(1.8).setAlpha(1);
        this.startIdle(this.playerSprite, 1.8);
        this.rebuildPanel('A', e);
        return this.showMessage(`¡Adelante, ${e.name.toUpperCase()}!`, done, 450);
      }
      case 'ability': { sfx(this, 'select', 0.3); return this.showMessage(e.text, done, 700); }
      case 'item': { sfx(this, 'heal', 0.4); const p = panelFor(e.side); if (e.hp != null) this.animateHp(p, e.hp); return this.showMessage(e.text, done, 750); }
      case 'berry': { sfx(this, 'heal'); const p = panelFor(e.side); if (e.hp != null) this.animateHp(p, e.hp); return this.showMessage(e.text, done, 800); }
      case 'absorb': { sfx(this, 'heal'); const p = panelFor(e.side); this.animateHp(p, e.hp); const nm = (e.side === 'A' ? this.battle.mon('A') : this.battle.mon('B')).name.toUpperCase(); return this.showMessage(`¡${nm} absorbió el ataque y recuperó PS!`, done, 800); }
      case 'gimmick': {
        const s = this.playerSprite;
        const aura = { mega: 0xff5fd0, dynamax: 0xff3030, tera: 0x54e0c8, z: 0xffe23a }[e.kind] || 0xffffff;
        sfx(this, 'levelup');
        this.cameras.main.flash(240, (aura >> 16) & 255, (aura >> 8) & 255, aura & 255);
        // anillo de aura que se expande
        const ring = this.add.circle(s.x, s.y, 28, aura, 0.4).setDepth((s.depth || 300) - 1);
        this.stage.add(ring);
        this.tweens.add({ targets: ring, scale: 2.4, alpha: 0, duration: 700, onComplete: () => ring.destroy() });
        // Mega/Dinamax crecen permanentemente; Tera/Z solo pulsan
        if (e.kind === 'mega' || e.kind === 'dynamax') {
          this.stopIdle(s);
          const grow = (e.kind === 'dynamax' ? 1.8 * 1.5 : 1.8 * 1.2);
          // MEGA: cambia al SPRITE de la forma mega real (Mega Charizard, etc.)
          if (e.kind === 'mega' && e.sprite && this.textures.exists(e.sprite)) {
            this.time.delayedCall(160, () => { s.setTexture(e.sprite).setFlipX(true); this.rebuildPanel('A', { hp: this.battle.mon('A').hp, maxhp: this.battle.mon('A').maxhp }); });
          }
          this.tweens.add({ targets: s, scaleX: grow, scaleY: grow, duration: 320, ease: 'Back.out', onComplete: () => this.startIdle(s, grow) });
          if (e.kind === 'dynamax' && e.hp != null) this.animateHp(panelFor('A'), e.hp, 320);
        } else {
          this.tweens.add({ targets: s, scaleX: s.scaleX * 1.15, scaleY: s.scaleY * 1.15, duration: 200, yoyo: true });
        }
        this.checkAch('gimmick');
        return this.showMessage(e.text, done, 950);
      }
      case 'bossrage': {
        sfx(this, 'levelup'); playCry(this, this.battle.mon('B').speciesId);
        this.cameras.main.flash(260, 200, 30, 30); this.cameras.main.shake(360, 0.014);
        const s = this.enemySprite; this.tweens.add({ targets: s, scaleX: s.scaleX * 1.25, scaleY: s.scaleY * 1.25, duration: 200, yoyo: true });
        const ring = this.add.circle(s.x, s.y, 20, 0xff3030, 0).setStrokeStyle(4, 0xff5a5a, 0.9).setDepth(360); this.stage.add(ring);
        this.tweens.add({ targets: ring, scale: 4, alpha: 0, duration: 600, onComplete: () => ring.destroy() });
        this.animateHp(panelFor('B'), e.hp, 400);
        return this.showMessage(`¡${e.name.toUpperCase()} se ENFURECIÓ! Su poder se desborda...`, done, 1000);
      }
      case 'zmove': {
        sfx(this, 'levelup'); this.cameras.main.flash(220, 255, 226, 58); this.cameras.main.shake(260, 0.014);
        // anillos Z expandiéndose desde el atacante
        const s = e.side === 'A' ? this.playerSprite : this.enemySprite;
        for (let i = 0; i < 3; i++) { const ring = this.add.circle(s.x, s.y, 14, 0xffe23a, 0).setStrokeStyle(3, 0xfff3a8, 0.9).setDepth(360); this.stage.add(ring); this.tweens.add({ targets: ring, scale: 4 + i, alpha: 0, duration: 600, delay: i * 90, onComplete: () => ring.destroy() }); }
        const zname = Z_MOVE_NAMES[e.ztype] || 'Movimiento Z';
        return this.showMessage(`¡Poder Z liberado! ¡${zname}!`, done, 750);
      }
      case 'badswitch': return done();
      case 'end': return done();
      default: return done();
    }
  }

  statusName(s) { return ({ burn: 'Quemado', poison: 'Envenenado', paralysis: 'Paralizado', freeze: 'Congelado' })[s] || s; }

  /** Comprueba y notifica logros (toast flotante) durante el combate. */
  checkAch(event) {
    const fresh = tryUnlock({ run: this.run, floor: this.floorNum, event });
    fresh.forEach((a, i) => this.time.delayedCall(i * 1500, () => {
      const t = this.add.text(VIEW.w / 2, 40, '🏆 Logro: ' + a.name, { fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#ffd76a', backgroundColor: '#05060ae0', padding: { x: 6, y: 5 } }).setOrigin(0.5).setDepth(99999);
      this.tweens.add({ targets: t, y: 34, alpha: { from: 1, to: 0 }, delay: 1500, duration: 500, onComplete: () => t.destroy() });
    }));
  }

  throwBallAnim(item = 'pokeball') {
    this.stopIdle(this.enemySprite);
    const ex = this.enemySprite.x, ey = this.enemySprite.y;
    const tex = 'item_' + item;
    const ball = this.add.image(120, 226, this.textures.exists(tex) ? tex : 'pokeball').setScale(1.4).setDepth(360);
    this.stage.add(ball);
    this.activeBall = ball;
    this.tweens.add({
      targets: ball, x: ex, y: ey - 6, duration: 420, ease: 'Quad.out', angle: 540,
      onComplete: () => {
        this.cameras.main.flash(120, 255, 255, 255);
        // el enemigo es absorbido por la ball
        this.tweens.add({ targets: this.enemySprite, x: ex, y: ey, scale: 0.05, alpha: 0, duration: 240 });
        this.tweens.add({ targets: ball, y: ey + 12, angle: 0, duration: 220, delay: 230, ease: 'Bounce.out' });
      },
    });
  }

  /** Haz de retorno: el Pokémon activo se encoge y "vuelve" a su pokébola. */
  /** Textura de la ball de un Pokémon (la de su captura), con fallback. */
  ballTex(key) { const t = 'item_' + (key || 'pokeball'); return this.textures.exists(t) ? t : 'pokeball'; }

  /** Animación de DEBILITARSE con variaciones (el rival salvaje reacciona distinto
   *  cada vez: se hunde, gira, estalla, HUYE, o se ESCONDE TRAS UNA ROCA real). */
  faintAnim(sprite, side) {
    if (side === 'A') { this.tweens.add({ targets: sprite, y: sprite.y + 30, alpha: 0, scaleX: sprite.scaleX * 0.6, scaleY: sprite.scaleY * 0.6, duration: 420, ease: 'Quad.in' }); return; }
    const r = Math.floor(Math.random() * 5);
    if (r === 0) {
      this.tweens.add({ targets: sprite, y: sprite.y + 30, alpha: 0, duration: 420 });
    } else if (r === 1) {
      this.tweens.add({ targets: sprite, angle: 540, scale: 0.05, alpha: 0, duration: 500, ease: 'Quad.in' });
    } else if (r === 2) {
      this.tweens.add({ targets: sprite, scaleX: sprite.scaleX * 1.4, scaleY: sprite.scaleY * 1.4, duration: 120, onComplete: () => { this.cameras.main.flash(120, 255, 255, 255); this.tweens.add({ targets: sprite, scale: 0.02, alpha: 0, duration: 240 }); } });
    } else if (r === 3 && this.textures.exists('fx_rock1')) {
      // ESCONDERSE TRAS UNA ROCA REAL: aparece la piedra y el Pokémon se mete detrás
      const rock = this.add.image(sprite.x + 30, sprite.y + 8, 'fx_rock1').setScale(0.95).setDepth((sprite.depth || 300) + 2);
      if (this.stage) this.stage.add(rock);
      rock.setScale(0.2); this.tweens.add({ targets: rock, scale: 0.95, duration: 200, ease: 'Back.out' });
      this.tweens.add({ targets: sprite, x: sprite.x + 26, y: sprite.y + 6, duration: 280, delay: 120, ease: 'Quad.out',
        onComplete: () => { sprite.setDepth(rock.depth - 1); this.tweens.add({ targets: sprite, alpha: 0, scaleY: sprite.scaleY * 0.7, duration: 300, delay: 120 });
          this.tweens.add({ targets: rock, y: rock.y - 4, duration: 180, yoyo: true, delay: 260, onComplete: () => this.tweens.add({ targets: rock, alpha: 0, duration: 400, delay: 250, onComplete: () => rock.destroy() }) }); } });
    } else {
      // HUIR corriendo fuera de pantalla
      const dir = sprite.x > VIEW.w / 2 ? 1 : -1;
      this.tweens.add({ targets: sprite, x: sprite.x + dir * 220, alpha: 0, duration: 460, ease: 'Quad.in' });
      this.tweens.add({ targets: sprite, scaleY: sprite.scaleY * 0.85, duration: 90, yoyo: true, repeat: 3 });
    }
  }

  recallAnim(sprite, cb) {
    sfx(this, 'ballopen', 0.4);
    const ball = this.add.image(sprite.x, sprite.y - 8, this.ballTex(sprite._ball)).setScale(0.9).setDepth(360);
    this.stage.add(ball);
    this.cameras.main.flash(90, 180, 90, 200);
    this.tweens.add({ targets: sprite, scale: 0.05, alpha: 0, duration: 240, ease: 'Quad.in' });
    this.tweens.add({ targets: ball, scale: 1.1, duration: 180, yoyo: true, delay: 220,
      onComplete: () => { ball.destroy(); cb && cb(); } });
  }

  /** Lanza la pokébola desde (fromX,fromY) hacia `sprite` y hace EMERGER al Pokémon. */
  sendOutAnim(sprite, speciesId, finalScale, flipX, fromX, fromY, cb, ballKey) {
    const tx = sprite.x, ty = sprite.y;
    sprite._ball = ballKey || sprite._ball;   // recuerda SU ball (la de captura) para futuros recalls
    sprite.setVisible(false);
    sfx(this, 'ballthrow', 0.5);
    const ball = this.add.image(fromX, fromY, this.ballTex(ballKey || sprite._ball)).setScale(1.2).setDepth(360);
    this.stage.add(ball);
    this.tweens.add({ targets: ball, x: tx, y: ty - 10, duration: 340, ease: 'Quad.out', angle: 540,
      onComplete: () => {
        sfx(this, 'ballopen', 0.5);
        this.cameras.main.flash(120, 255, 255, 255);
        ball.destroy();
        sprite.setTexture('mon_' + speciesId).setFlipX(flipX).setVisible(true).setAlpha(1).setScale(0.1).setPosition(tx, ty);
        this.tweens.add({ targets: sprite, scale: finalScale, duration: 260, ease: 'Back.out',
          onComplete: () => { this.startIdle(sprite, finalScale); cb && cb(); } });
      } });
  }

  /** Animación idle de combate: respiración sutil (juice). Solo escala (la `y`
   *  la usan los golpes/debilitarse), así no choca con otras animaciones. */
  startIdle(sprite, baseScale) {
    if (!sprite) return;
    this.stopIdle(sprite);
    sprite.setScale(baseScale);
    sprite._idleBase = baseScale;
    sprite._idle = this.tweens.add({
      targets: sprite, scaleY: baseScale * 1.04, scaleX: baseScale * 0.99,
      duration: 1050, yoyo: true, repeat: -1, ease: 'Sine.inOut',
    });
  }

  stopIdle(sprite) {
    if (sprite?._idle) { sprite._idle.remove(); sprite._idle = null; if (sprite._idleBase) sprite.setScale(sprite._idleBase); }
  }

  /** Sacude la ball `times` veces y luego ejecuta cb (suspense de captura). */
  wobbleBall(times, cb) {
    const ball = this.activeBall;
    if (!ball || times <= 0) { cb(); return; }
    let i = 0;
    const one = () => {
      if (i >= times) { cb(); return; }
      i++;
      this.tweens.add({ targets: ball, angle: { from: -16, to: 16 }, duration: 130, yoyo: true, ease: 'Sine.inOut', onComplete: () => this.time.delayedCall(140, one) });
    };
    this.time.delayedCall(500, one);
  }

  popDamage(x, y, amount, crit) {
    const txt = this.add.text(x, y - 20, '-' + amount, { fontFamily: '"Press Start 2P"', fontSize: crit ? '12px' : '9px', color: crit ? '#ffd76a' : '#ffffff', stroke: '#05060a', strokeThickness: 3 }).setOrigin(0.5).setDepth(300);
    this.stage.add(txt);
    this.tweens.add({ targets: txt, y: y - 44, alpha: 0, duration: 700, onComplete: () => txt.destroy() });
  }

  showMessage(text, done, delay = 600) {
    this.msg.setFontSize(9).setLineSpacing(6).setY(VIEW.h - 82);   // tamaño narrativo normal
    this.msg.setText(text);
    if (done) this.time.delayedCall(delay, done);
  }

  finish() {
    const result = this.battle.result;
    let endMsg;
    if (this.replay) {
      endMsg = '▶ Fin de la reproducción.';
    } else {
      // captura: añadir al equipo/caja + Pokédex
      if (result === 'caught' && this.run) {
        const mon = structuredClone(this.enemyTeam[this.battle.active.B]);
        const joined = this.run.party.length < 6;   // mensaje VERAZ (antes mentía)
        // APODO opcional al capturar (no en tester/replay)
        if (!this.registry.get('godtest') && typeof window !== 'undefined' && window.prompt) {
          const raw = window.prompt(`¡Capturaste a ${mon.name.toUpperCase()}! Ponle un APODO (deja vacío para usar su nombre):`, '');
          if (raw && raw.trim()) mon.name = raw.trim().slice(0, 14);
        }
        addCapturedMon(this.run, mon);
        endMsg = joined ? `¡${mon.name.toUpperCase()} se unió al equipo!` : `¡${mon.name.toUpperCase()} fue enviado a la Caja (equipo lleno)!`;
      } else if (result === 'fled') endMsg = 'Escapaste del combate.';
      else if (result === 'win') {
        // EXP + monedas. Recompensas más generosas (Carlos: "se gana muy poco").
        const mon = this.battle.mon('A');
        const foe = this.enemyTeam[this.battle.active.B];
        const gain = foe.level * 40 + 40, coins = foe.level * 25 + 10;
        const need = (l) => l * 15 + 10;
        // XP COMPARTIDA (#13): TODOS los que salieron al campo ganan la MISMA XP.
        // El activo abre el menú interactivo de aprendizaje; los demás, en automático.
        const party = this.run?.party || this.playerTeam;
        const idxs = [...(this.battle.participated || new Set([this.battle.active.A]))];
        let lvlMsg = '';
        for (const i of idxs) {
          const m = party[i];
          if (m) lvlMsg += this._gainExp(m, gain, need, m === mon);
        }
        let prize = this.isTrainer ? 250 + this.floorNum * 30 : 0;     // los entrenadores pagan premio
        if (this.isBoss) {
          prize += 1000 + this.floorNum * 50;
          // los JEFES sueltan un objeto de FENÓMENO (así descubres Mega/Z/Dinamax)
          if (this.run) { const drop = Phaser.Utils.Array.GetRandom(['megastone', 'zcrystal', 'maxiband', 'rarecandy']); this.run.bag[drop] = (this.run.bag[drop] || 0) + 1; }
        }
        if (this.isGuardian) {
          prize += 3000 + this.floorNum * 100;
          // el GUARDIÁN recompensa con una MASTER BALL + Máx. Revivir
          if (this.run) { this.run.bag.masterball = (this.run.bag.masterball || 0) + 1; this.run.bag.maxrevive = (this.run.bag.maxrevive || 0) + 1; }
          this.checkAch('guardian');
        }
        if (this.run) { this.run.wins = (this.run.wins || 0) + 1; this.run.money = (this.run.money || 0) + Math.round((coins + prize) * diffOf(this.run).reward); }
        if (this.isBoss) this.checkAch('boss'); else if (this.isTrainer) this.checkAch('trainer');
        this.checkAch();   // logros de stats (dinero, etc.)
        sfx(this, lvlMsg ? 'levelup' : 'coin');
        // ¿toca evolucionar? (se reproduce tras el mensaje de victoria)
        this.evoMon = mon; this.evoTarget = pendingEvolution(mon);
        endMsg = `¡Has ganado! +${gain} EXP${idxs.length > 1 ? ` (×${idxs.length})` : ''} · +${coins}₽.${lvlMsg}`;
      } else endMsg = 'Tu equipo ha caído...';   // roguelike: fin de partida

      // guardar grabación (Videocámara) en todos los finales reales
      if (this.rec) { this.rec.result = result; saveRecording(this.rec); this.registry.set('lastRecording', this.rec); }
    }
    const lost = !this.replay && result === 'lose';
    // RESCATE DEL PC: si pierdes pero tienes algún Pokémon en la caja, uno sale a
    // protegerte (en vez de Game Over). Ver pcRescue(). UNA SOLA VEZ POR PISO:
    // si ya te rescataron en este piso, esta vez sí es Game Over.
    if (this.run) this.run.rescuedFloors = this.run.rescuedFloors || [];
    const alreadyRescued = !!this.run && this.run.rescuedFloors.includes(this.floorNum);
    const canRescue = lost && !!this.run && (this.run.box?.length > 0) && !alreadyRescued;
    const proceed = () => {
      this.cameras.main.fadeOut(lost ? 600 : 300, 0, 0, 0);
      this.time.delayedCall(lost ? 620 : 320, () => {
        this.scene.stop();
        if (lost) this.scene.start('GameOver', { floorReached: this.floorNum });
        else this.scene.resume(this.returnTo);
      });
    };
    this.showMessage(endMsg, () => {
      // primero resolver aprendizajes pendientes (menú), luego evolución, luego salir
      this.resolveLearns(() => {
        if (canRescue) this.pcRescue();
        else if (this.evoTarget && this.evoMon) this.playEvolution(this.evoMon, this.evoTarget, proceed);
        else proceed();
      });
    }, 900);
  }

  /** Da XP a UN Pokémon, sube niveles, aprende movimientos y (si no es el activo)
   *  evoluciona en silencio. Devuelve el texto de subidas para el mensaje final.
   *  interactive=true → el activo encola aprendizajes para el menú con sprite. */
  _gainExp(mon, gain, need, interactive) {
    mon.exp = (mon.exp || 0) + gain;
    let lvlMsg = '', learnMsg = '';
    while (mon.exp >= need(mon.level) && mon.level < 100) {
      mon.exp -= need(mon.level);
      mon.level++;
      const ns = computeStats({ base: mon.base, level: mon.level, nature: mon.nature, ivs: mon.ivs, evs: mon.evs });
      mon.hp = Math.min(ns.hp, mon.hp + Math.max(0, ns.hp - mon.maxhp));
      mon.stats = ns; mon.maxhp = ns.hp;
      lvlMsg = ` ¡${mon.name.toUpperCase()} subió al Nv ${mon.level}!`;
      let mv, guard = 0;
      while ((mv = nextLearnableMove(mon)) && guard++ < 4) {
        if (mon.moves.length < 4) {
          mon.moves.push(mv); if (mon.pp) mon.pp[mv] = MOVES[mv].pp;
          learnMsg += ` ¡${mon.name.toUpperCase()} aprendió ${MOVES[mv].name}!`;
        } else if (interactive) {
          if (!this.pendingLearns.some(p => p.mon === mon && p.move === mv)) this.pendingLearns.push({ mon, move: mv });
          break;   // se resuelve con menú tras la victoria
        } else {
          // no activo: reemplaza el más débil si el nuevo es mejor (sin menú)
          const weakest = mon.moves.reduce((a, b) => (MOVES[a]?.power || 0) <= (MOVES[b]?.power || 0) ? a : b);
          if ((MOVES[mv]?.power || 0) > (MOVES[weakest]?.power || 0)) {
            if (mon.pp) { delete mon.pp[weakest]; mon.pp[mv] = MOVES[mv].pp; }
            mon.moves[mon.moves.indexOf(weakest)] = mv;
          }
        }
      }
    }
    // evolución silenciosa para los del banquillo (el activo evoluciona con animación)
    if (!interactive) {
      let evo, g = 0;
      while ((evo = pendingEvolution(mon)) && g++ < 6) evolveMon(mon, evo);
    }
    return lvlMsg + learnMsg;
  }

  /** Procesa la cola de movimientos por aprender, uno a uno, con menú. */
  resolveLearns(done) {
    if (this.replay) { this.pendingLearns = []; return done(); }   // los replays no abren menús
    if (!this.pendingLearns || !this.pendingLearns.length) return done();
    const { mon, move } = this.pendingLearns.shift();
    // si por lo que sea ya lo sabe o tiene hueco, resuélvelo sin menú
    if (mon.moves.includes(move)) return this.resolveLearns(done);
    if (mon.moves.length < 4) { mon.moves.push(move); if (mon.pp) mon.pp[move] = MOVES[move].pp; return this.resolveLearns(done); }
    // IA AUTÓNOMA: sin menú, reemplaza el más débil si el nuevo es mejor
    if (this.registry.get('autoplay')) {
      const weakest = mon.moves.reduce((a, b) => (MOVES[a]?.power || 0) <= (MOVES[b]?.power || 0) ? a : b);
      if ((MOVES[move]?.power || 0) > (MOVES[weakest]?.power || 0)) { if (mon.pp) { delete mon.pp[weakest]; mon.pp[move] = MOVES[move].pp; } mon.moves[mon.moves.indexOf(weakest)] = move; }
      return this.resolveLearns(done);
    }
    this.learnMenu(mon, move, () => this.resolveLearns(done));
  }

  /** MENÚ de aprendizaje: sprite + stats + 4 movimientos; elige cuál olvidar o no aprender. */
  learnMenu(mon, newMove, cb) {
    this.busy = false;
    this.menuState = 'learn';
    this.clearPanel();
    const nm = MOVES[newMove];
    this.menuPrompt = `${mon.name.toUpperCase()} quiere aprender ${nm.name}. ¿Qué movimiento olvida?`;
    // sprite del Pokémon
    if (this.textures.exists('mon_' + mon.speciesId)) {
      const img = this.add.image(40, VIEW.h - 116, 'mon_' + mon.speciesId);
      const src = this.textures.get('mon_' + mon.speciesId).getSourceImage();
      img.setScale(46 / Math.max(src.width, src.height));
      this.panel.add(img);
    }
    // stats compactos
    const s = mon.stats || {};
    const statLine = `Nv${mon.level}  PS ${mon.hp}/${mon.maxhp}\nAtq ${s.atk||0}  Def ${s.def||0}\nAtsp ${s.spa||0}  Defsp ${s.spd||0}  Vel ${s.spe||0}`;
    this.panel.add(this.add.text(72, VIEW.h - 132, statLine, { fontFamily: '"Press Start 2P"', fontSize: '7px', color: '#cfe0f0', lineSpacing: 4 }));
    // nuevo movimiento (destacado)
    this.panel.add(this.add.text(VIEW.w - 14, VIEW.h - 132, `NUEVO: ${nm.name}\n${nm.type} · Pot ${nm.power ?? '—'}`, { fontFamily: '"Press Start 2P"', fontSize: '7px', color: '#ffd76a', align: 'right' }).setOrigin(1, 0));
    // botones: los 4 movimientos actuales (reemplazar) + "No aprender"
    const items = mon.moves.map((id, i) => {
      const mv = MOVES[id];
      return {
        label: mv.name, sub: `${(mon.pp?.[id] ?? mv.pp)}/${mv.pp}`,
        color: TYPE_COLORS[mv.type] || 0x445566, fg: '#05060a',
        desc: `Olvidar ${mv.name} (${mv.type}, Pot ${mv.power ?? '—'}) y aprender ${nm.name}.`,
        onPick: () => {
          if (mon.pp) { delete mon.pp[id]; mon.pp[newMove] = nm.pp; }
          mon.moves[i] = newMove;
          this.menuState = 'main';
          this.showMessage(`¡${mon.name.toUpperCase()} olvidó ${mv.name} y aprendió ${nm.name}!`, cb, 1100);
        },
      };
    });
    items.push({ label: `✕ No aprender`, color: 0x33384a, fg: '#ffffff',
      desc: `${mon.name.toUpperCase()} no aprenderá ${nm.name}.`,
      onPick: () => { this.menuState = 'main'; this.showMessage(`${mon.name.toUpperCase()} no aprendió ${nm.name}.`, cb, 900); } });
    this.renderGrid(items);
  }

  /** Animación de evolución (parpadeo blanco → morph → flash + cry nueva forma). */
  playEvolution(mon, toId, cb) {
    const spr = this.playerSprite;
    const oldName = mon.name.toUpperCase();
    sfx(this, 'evolve');
    playBgm(this, 'bgm_evolve', 0.3);   // tema "Evolution" de FireRed (al volver al piso se restaura el del bioma)
    this.showMessage(`¿Eh? ¡${oldName} está evolucionando!`);
    spr.setTint(0xffffff);
    this.tweens.add({ targets: spr, scaleX: spr.scaleX * 1.15, scaleY: spr.scaleY * 1.15, duration: 240, yoyo: true, repeat: 3, ease: 'Sine.inOut' });
    this.tweens.add({ targets: spr, alpha: 0.25, duration: 170, yoyo: true, repeat: 5 });
    this.time.delayedCall(1700, () => {
      const sp = evolveMon(mon, toId);
      spr.setTexture('mon_' + toId).setAlpha(1).clearTint();
      this.cameras.main.flash(320, 255, 255, 255);
      sfx(this, 'levelup');
      playCry(this, toId);
      this.rebuildPanel('A', { hp: mon.hp, maxhp: mon.maxhp });
      this.checkAch('evolve');
      this.showMessage(`¡Enhorabuena! ${oldName} evolucionó en ${sp.name.toUpperCase()}!`, cb, 1500);
    });
  }

  /** RESCATE DEL PC: todo tu equipo cayó pero tienes Pokémon en la caja. Uno sale
   *  aleatorio: su pokébola llega desde el PC, emerge, va a buscarte y te protege
   *  de un golpe poniéndose delante de ti. Luego se une al equipo y vuelves al piso. */
  pcRescue() {
    // marca este piso como "ya rescatado" para que no se repita el rescate aquí.
    this.run.rescuedFloors = this.run.rescuedFloors || [];
    if (!this.run.rescuedFloors.includes(this.floorNum)) this.run.rescuedFloors.push(this.floorNum);
    const box = this.run.box;
    const pick = Phaser.Math.Between(0, box.length - 1);
    const mon = box[pick];
    const NAME = mon.name.toUpperCase();
    const { w, h } = VIEW;

    // 1) anuncio dramático
    this.cameras.main.fadeIn(1, 0, 0, 0);
    this.showMessage('¡No te queda ningún Pokémon en pie!');

    this.time.delayedCall(900, () => {
      this.showMessage(`¡Pero una pokébola sale disparada del PC!`);
      // 2) la pokébola llega volando desde el borde (el PC) y rebota hacia el frente
      sfx(this, 'ballthrow', 0.55);
      const ball = this.add.image(-30, 120, 'item_' + (mon.ball || 'pokeball')).setScale(0).setDepth(380);
      if (!this.textures.exists('item_' + (mon.ball || 'pokeball'))) ball.setTexture('pokeball');
      this.stage.add(ball);
      this.tweens.add({ targets: ball, scale: 1.4, duration: 200 });
      this.tweens.add({ targets: ball, x: 150, y: 250, angle: 720, duration: 620, ease: 'Quad.out',
        onComplete: () => {
          // 3) se abre y EMERGE el Pokémon
          sfx(this, 'ballopen', 0.6);
          this.cameras.main.flash(160, 255, 255, 255);
          ball.destroy();
          const rescuer = this.add.image(150, 250, 'mon_' + mon.speciesId).setScale(0.1).setDepth(60);
          this.stage.add(rescuer);
          playCry(this, mon.speciesId);
          this.tweens.add({ targets: rescuer, scale: 1.7, duration: 280, ease: 'Back.out',
            onComplete: () => {
              this.showMessage(`¡${NAME} saltó del PC para ayudarte!`);
              // 4) "va a buscarte": avanza hacia el frente con un pequeño trote
              this.time.delayedCall(650, () => {
                this.tweens.add({ targets: rescuer, x: 240, y: 290, scale: 2.1, duration: 700, ease: 'Sine.inOut',
                  onUpdate: () => {}, onComplete: () => this.rescueShield(rescuer, mon, pick) });
                // trotecito
                this.tweens.add({ targets: rescuer, y: '-=8', duration: 175, yoyo: true, repeat: 3, ease: 'Sine.inOut' });
              });
            } });
        } });
    });
  }

  /** Segunda animación: el rival lanza un golpe y el rescatador se interpone, te
   *  protege y se queda DELANTE de ti. Luego se une al equipo y vuelves al piso. */
  rescueShield(rescuer, mon, boxIdx) {
    const enemyName = this.battle.mon('B').name.toUpperCase();
    this.showMessage(`¡${enemyName} ataca... pero ${mon.name.toUpperCase()} se interpone!`);
    // golpe del rival: un proyectil rojo vuela hacia ti
    const blow = this.add.ellipse(this.enemySprite.x, this.enemySprite.y, 30, 30, 0xff5050, 0.9).setDepth(70);
    this.stage.add(blow);
    this.tweens.add({ targets: blow, x: rescuer.x, y: rescuer.y - 6, scale: 1.6, duration: 420, ease: 'Quad.in',
      onComplete: () => {
        // el rescatador lo encaja: escudo blanco + sacudida de cámara
        sfx(this, 'hit', 0.6);
        this.cameras.main.shake(220, 0.012);
        this.cameras.main.flash(120, 200, 230, 255);
        blow.destroy();
        const ring = this.add.circle(rescuer.x, rescuer.y - 4, 10, 0x9fdcff, 0.5).setStrokeStyle(3, 0xffffff).setDepth(69);
        this.stage.add(ring);
        rescuer.setTint(0xcfeaff);
        this.tweens.add({ targets: ring, scale: 4, alpha: 0, duration: 420, onComplete: () => ring.destroy() });
        this.tweens.add({ targets: rescuer, x: '+=6', duration: 70, yoyo: true, repeat: 2,
          onComplete: () => { rescuer.clearTint(); this.startIdle(rescuer, rescuer.scaleX); } });
        // se queda DELANTE de ti
        this.time.delayedCall(700, () => {
          this.showMessage(`¡${mon.name.toUpperCase()} te protegió y se puso delante de ti!`, () => {
            // une el Pokémon al equipo (revivido, con correa para que te siga)
            this.run.box.splice(boxIdx, 1);
            mon.hp = mon.maxhp || mon.hp || 1;
            mon.correa = true;
            this.run.party.push(mon);
            // vuelta al piso (NO Game Over)
            this.cameras.main.fadeOut(500, 0, 0, 0);
            this.time.delayedCall(520, () => { this.scene.stop(); this.scene.resume(this.returnTo); });
          }, 1400);
        });
      } });
  }
}
