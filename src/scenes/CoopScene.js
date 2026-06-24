// CoopScene — MULTIJUGADOR LOCAL (couch co-op) hasta 4 jugadores en pantalla
// dividida. Arena compartida grande por bioma; cada jugador con su control
// (P1 WASD+FGQE, P2 flechas+JKLB, P3/P4 gamepads). Toca Pokémon salvajes para
// atraparlos (contador compartido), recoge objetos y lleguen TODOS al portal
// para bajar al siguiente nivel (más profundo = bioma distinto + más fauna).
// Mantiene el single-player intacto: es una escena aparte.
import Phaser from 'phaser';
import { CANVAS, VIEW } from '../main.js';
import { registerBiomeTextures } from '../systems/textureFactory.js';
import { BIOMES, biomeForFloor } from '../../data/biomes.js';
import { SPECIES } from '../../data/species.generated.js';
import { OWMETA } from '../../data/owmeta.generated.js';
import { makeInput, PLAYER_CONTROLS } from '../systems/input.js';
import { makeRNG } from '../engine/rng.js';
import { playBgm, sfx } from '../systems/audio.js';

const T = 32;                 // tamaño de tile en pantalla (igual que FloorScene)
const AW = 28, AH = 18;       // arena en tiles (ancho × alto) → mundo 896×576
const COLORS = [0xffd76a, 0x54e0c8, 0xff7ad0, 0x8aff6a];   // P1 oro · P2 cian · P3 rosa · P4 verde
const PNAME = ['P1', 'P2', 'P3', 'P4'];
const GOAL_DEPTH = 5;         // co-op = CARRERA de capturas a través de 5 niveles; gana quien más cace

export class CoopScene extends Phaser.Scene {
  constructor() { super('Coop'); }

  init(data) {
    this.numPlayers = Phaser.Math.Clamp(data.players || 2, 2, 4);
    this.depth = data.depth || 1;
    this.seed = data.seed || ('coop-' + Date.now().toString(36));
    this.catches = data.catches || 0;   // contador compartido (persiste entre niveles)
  }

  create() {
    const rng = makeRNG(`${this.seed}:${this.depth}`);
    this.biome = biomeForFloor(this.depth, this.seed) || BIOMES[0];
    registerBiomeTextures(this, this.biome);
    this.cameras.main.setBackgroundColor('#05060a');

    this.world = this.add.container(0, 0);
    this.blocked = Array.from({ length: AH }, () => Array(AW).fill(false));
    this.renderArena(rng);

    // --- objetos del mundo ---
    this.roamers = [];   // Pokémon que deambulan; tocarlos = capturar
    this.items = [];     // objetos recogibles
    this.spawnFauna(rng);

    // portal de descenso compartido (centro-abajo)
    this.portal = { c: AW >> 1, r: AH - 3 };
    const pp = this.tile(this.portal.c, this.portal.r);
    const ring = this.add.ellipse(pp.x, pp.y + 2, 44, 28, 0x000000, 0.5);
    this.portalSprite = this.add.ellipse(pp.x, pp.y, 34, 20, 0x7ad0ff, 0.9);
    this.add.tween({ targets: this.portalSprite, scaleX: 1.15, scaleY: 1.2, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.world.add([ring, this.portalSprite]);

    // --- jugadores + split-screen ---
    this.players = [];
    this.buildPlayers();
    this.setupCameras();
    this.buildHud();

    playBgm(this, this.biome?.music || 'bgm_explore', 0.3);   // playBgm hace carga perezosa
    this.transitioning = false;
  }

  tile(c, r) { return { x: c * T + T / 2, y: r * T + T / 2 }; }

  renderArena(rng) {
    const key = (id) => `${this.biome.id}_${id}`;
    const rt = this.add.renderTexture(0, 0, AW * T, AH * T).setOrigin(0, 0);
    const tmp = this.add.image(0, 0, key('floor0')).setOrigin(0, 0).setScale(2).setVisible(false);
    for (let r = 0; r < AH; r++) for (let c = 0; c < AW; c++) {
      const wall = r === 0 || c === 0 || r === AH - 1 || c === AW - 1;
      // obstáculos internos dispersos (no en el borde de spawn ni el centro)
      const obst = !wall && rng.float() < 0.07 && !(r < 3 && c < 6) && !(Math.abs(c - (AW >> 1)) < 2 && Math.abs(r - (AH >> 1)) < 2);
      const v = Math.floor(rng.float() * 5);
      tmp.setTexture(key((wall || obst ? 'wall' : 'floor') + v)).setPosition(c * T, r * T);
      rt.draw(tmp);
      if (wall || obst) this.blocked[r][c] = true;
    }
    tmp.destroy();
    this.world.add(rt);
  }

  walkable(c, r) { return c >= 0 && r >= 0 && c < AW && r < AH && !this.blocked[r][c]; }

  spawnFauna(rng) {
    const free = () => { for (let i = 0; i < 40; i++) { const c = 2 + (rng.float() * (AW - 4) | 0), r = 2 + (rng.float() * (AH - 4) | 0); if (this.walkable(c, r)) return { c, r }; } return { c: 2, r: 2 }; };
    const pool = SPECIES.filter(s => this.textures.exists('mon_' + s.id));
    const n = 6 + this.depth + (rng.float() * 4 | 0);
    for (let i = 0; i < n; i++) {
      const cell = free(), sp = pool[rng.float() * pool.length | 0]; if (!sp) break;
      const p = this.tile(cell.c, cell.r);
      const spr = this.add.image(p.x, p.y, 'mon_' + sp.id).setScale(0.55).setDepth(50 + p.y);
      this.add.tween({ targets: spr, y: p.y - 4, duration: 600 + rng.float() * 400, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      this.world.add(spr);
      this.roamers.push({ c: cell.c, r: cell.r, sprite: spr, sp, moveT: 0 });
    }
    for (let i = 0; i < 4 + this.depth; i++) {
      const cell = free(), p = this.tile(cell.c, cell.r);
      const it = this.add.image(p.x, p.y, this.textures.exists('item_pokeball') ? 'item_pokeball' : 'pokeball').setScale(0.8).setDepth(50 + p.y);
      this.world.add(it);
      this.items.push({ c: cell.c, r: cell.r, sprite: it });
    }
  }

  // sprites REALES de entrenador (chibi GBA animado) por jugador, con un anillo de
  // color en el suelo para distinguirlos en la pantalla dividida.
  buildPlayers() {
    const spawns = [[2, 2], [4, 2], [2, 4], [4, 4]];
    const TR = ['red', 'calem', 'nate', 'dawn', 'may', 'lucas', 'hilda', 'rosa']
      .filter(id => OWMETA[id] && this.textures.exists('ow_' + id));
    for (let i = 0; i < this.numPlayers; i++) {
      const cfg = PLAYER_CONTROLS[i];
      const input = makeInput(this, cfg.map, cfg.pad);
      const [c, r] = spawns[i], p = this.tile(c, r);
      const trId = TR[i % TR.length] || 'red';
      const chibi = OWMETA[trId] && OWMETA[trId].frames >= 9 && this.textures.exists('ow_' + trId);
      const ring = this.add.ellipse(p.x, p.y + 11, 26, 12, COLORS[i], 0.5).setStrokeStyle(2, COLORS[i], 0.9).setDepth(48 + p.y);
      let sprite;
      if (chibi) { this.ensureOwAnims(trId); sprite = this.add.sprite(p.x, p.y, 'ow_' + trId, 0).setScale(2); }
      else sprite = this.add.image(p.x, p.y, this.textures.exists('ow_' + trId) ? 'ow_' + trId : (this.textures.exists('trainer_' + trId) ? 'trainer_' + trId : 'trainer_red'));
      sprite.setOrigin(0.5, 0.8).setDepth(60 + p.y);
      // etiqueta de jugador (P1/P2/...) en su color, para identificarse en split-screen
      const tag = this.add.text(p.x, p.y - 26, PNAME[i], { fontFamily: '"Press Start 2P"', fontSize: '7px', color: '#' + COLORS[i].toString(16).padStart(6, '0'), stroke: '#05060a', strokeThickness: 3 }).setOrigin(0.5).setDepth(90 + p.y);
      this.world.add([ring, sprite, tag]);
      this.players.push({ idx: i, c, r, input, sprite, ring, tag, trId, chibi, facing: 'down', stepping: false, moveT: 0, catches: 0, color: COLORS[i], onPortal: false });
    }
  }

  animDir(d) { return (d === 'left' || d === 'right') ? 'side' : d; }
  ensureOwAnims(id) {
    const rows = { down: [3, 0, 4, 0], up: [5, 1, 6, 1], side: [7, 2, 8, 2] };
    for (const [dir, seq] of Object.entries(rows)) {
      const key = `cow${id}_${dir}`;
      if (this.anims.exists(key)) continue;
      this.anims.create({ key, frames: seq.map(f => ({ key: 'ow_' + id, frame: f })), frameRate: 9, repeat: -1 });
    }
  }
  faceFlip(pl, dir) {   // los frames laterales del chibi miran a la izquierda
    if (dir === 'left') pl.sprite.setFlipX(false);
    else if (dir === 'right') pl.sprite.setFlipX(true);
    else pl.sprite.setFlipX(false);
  }
  idleFrame(pl) { if (pl.chibi) { pl.sprite.anims.stop(); pl.sprite.setFrame(({ down: 0, up: 1, side: 2 })[this.animDir(pl.facing)]); } }

  setupCameras() {
    const n = this.numPlayers, W = CANVAS.w, H = CANVAS.h;
    // viewports: 2 = mitades verticales · 3-4 = cuadrantes
    const vp = n === 2 ? [[0, 0, W / 2, H], [W / 2, 0, W / 2, H]]
      : [[0, 0, W / 2, H / 2], [W / 2, 0, W / 2, H / 2], [0, H / 2, W / 2, H / 2], [W / 2, H / 2, W / 2, H / 2]];
    this.cameras.main.setViewport(...vp[0]);
    this.pcams = [this.cameras.main];
    for (let i = 1; i < n; i++) this.pcams.push(this.cameras.add(...vp[i]));
    this.pcams.forEach((cam, i) => {
      cam.setBounds(0, 0, AW * T, AH * T);
      cam.setZoom(1);
      cam.startFollow(this.players[i].sprite, true, 0.15, 0.15);
      cam.setBackgroundColor(i % 2 ? '#0a0e16' : '#070a12');
    });
  }

  buildHud() {
    // cámara de UI que renderiza SOLO la barra superior; las cámaras de juego la ignoran.
    this.hud = this.add.container(0, 0).setDepth(100000).setScrollFactor(0);
    const bar = this.add.rectangle(0, 0, CANVAS.w, 18, 0x05060a, 0.85).setOrigin(0, 0);
    this.hudTxt = this.add.text(6, 4, '', { fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#e8f0ff' });
    // separadores de pantalla
    const g = this.add.graphics(); g.lineStyle(2, 0xffd76a, 0.5);
    if (this.numPlayers === 2) g.lineBetween(CANVAS.w / 2, 0, CANVAS.w / 2, CANVAS.h);
    else { g.lineBetween(CANVAS.w / 2, 0, CANVAS.w / 2, CANVAS.h); g.lineBetween(0, CANVAS.h / 2, CANVAS.w, CANVAS.h / 2); }
    this.hud.add([bar, this.hudTxt, g]);
    this.uiCam = this.cameras.add(0, 0, CANVAS.w, CANVAS.h);
    // cada cámara de juego ignora el HUD; la de UI ignora el mundo
    this.pcams.forEach(cam => cam.ignore(this.hud));
    this.uiCam.ignore(this.world);
    this.uiCam.ignore(this.players.flatMap(p => [p.sprite, p.ring, p.tag]));
    this.refreshHud();
  }

  refreshHud() {
    const parts = this.players.map(p => `${PNAME[p.idx]}:${p.catches}`);
    this.hudTxt.setText(`NIVEL ${this.depth}/${GOAL_DEPTH}   ${parts.join('  ')}   ¡carrera de capturas! · todos al portal ↓`);
  }

  update(time, delta) {
    if (this.finished) {   // pantalla de resultados: Start/A de cualquiera vuelve al menú
      if (this.players.some(p => p.input.justDown('START') || p.input.justDown('A'))) { sfx(this, 'select'); this.scene.start('MainMenu'); }
      return;
    }
    if (this.transitioning) return;
    for (const pl of this.players) this.movePlayer(pl, delta);
    this.wanderRoamers(delta);
    // feedback de "LISTO" cuando un jugador está sobre el portal esperando a los demás
    for (const pl of this.players) {
      const onP = pl.c === this.portal.c && pl.r === this.portal.r;
      if (onP !== pl.onPortal) { pl.onPortal = onP; pl.ring.setStrokeStyle(onP ? 3 : 2, onP ? 0x7ad0ff : pl.color, onP ? 1 : 0.9); if (onP) sfx(this, 'cursor', 0.4); }
    }
    // ¿todos los jugadores sobre el portal? → bajar
    if (this.players.every(p => p.onPortal)) this.descend();
    // salir al menú con START de cualquier jugador
    if (this.players.some(p => p.input.justDown('START'))) { sfx(this, 'back'); this.scene.start('MainMenu'); }
  }

  movePlayer(pl, delta) {
    if (pl.stepping) return;
    const d = pl.input.dirHeld();
    if (!d) { this.idleFrame(pl); return; }
    pl.facing = d; this.faceFlip(pl, d);
    const [dx, dy] = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[d];
    const nc = pl.c + dx, nr = pl.r + dy;
    if (!this.walkable(nc, nr)) { this.idleFrame(pl); return; }
    pl.c = nc; pl.r = nr; pl.stepping = true;
    const p = this.tile(nc, nr);
    const running = pl.input.isDown('B');           // B = correr
    const dur = running ? 90 : 150;
    if (pl.chibi) { const key = `cow${pl.trId}_${this.animDir(d)}`; if (this.anims.exists(key)) { pl.sprite.play(key, true); pl.sprite.anims.timeScale = running ? 1.7 : 1; } }
    this.tweens.add({ targets: pl.sprite, x: p.x, y: p.y, duration: dur, ease: 'Linear', onComplete: () => { pl.stepping = false; this.afterStep(pl); } });
    this.tweens.add({ targets: pl.ring, x: p.x, y: p.y + 11, duration: dur, ease: 'Linear' });
    this.tweens.add({ targets: pl.tag, x: p.x, y: p.y - 26, duration: dur, ease: 'Linear' });
    pl.sprite.setDepth(60 + p.y); pl.ring.setDepth(48 + p.y); pl.tag.setDepth(90 + p.y);
  }

  afterStep(pl) {
    // ¿pisó un Pokémon? → CAPTURA con pokéball (contador compartido)
    const ri = this.roamers.findIndex(m => m.c === pl.c && m.r === pl.r);
    if (ri >= 0) {
      const m = this.roamers[ri]; this.roamers.splice(ri, 1);
      this.catchAnim(pl, m);
      pl.catches++; this.catches++; this.refreshHud();
    }
    // ¿objeto? → recoger
    const ii = this.items.findIndex(it => it.c === pl.c && it.r === pl.r);
    if (ii >= 0) {
      const it = this.items[ii]; this.items.splice(ii, 1);
      this.tweens.add({ targets: it.sprite, y: it.sprite.y - 14, alpha: 0, duration: 250, onComplete: () => it.sprite.destroy() });
      sfx(this, 'coin', 0.5); this.popup(pl, '+objeto');
    }
  }

  /** Animación de captura: el jugador lanza una pokébola al Pokémon, clic y se va. */
  catchAnim(pl, m) {
    sfx(this, 'ballthrow', 0.5);
    const ball = this.add.image(pl.sprite.x, pl.sprite.y - 8, this.textures.exists('item_pokeball') ? 'item_pokeball' : 'pokeball').setScale(0.8).setDepth(95000);
    this.world.add(ball); this.uiCam?.ignore(ball);
    this.tweens.add({ targets: ball, x: m.sprite.x, y: m.sprite.y, angle: 540, duration: 220, ease: 'Quad.out', onComplete: () => {
      sfx(this, 'ballopen', 0.5);
      this.tweens.add({ targets: m.sprite, scale: 0.1, alpha: 0, duration: 200, onComplete: () => m.sprite.destroy() });
      this.tweens.add({ targets: ball, y: ball.y + 8, duration: 160, yoyo: true, repeat: 1, ease: 'Sine.inOut', onComplete: () => {
        sfx(this, 'ballclick', 0.6);
        this.tweens.add({ targets: ball, alpha: 0, scale: 0.3, duration: 160, onComplete: () => ball.destroy() });
      } });
    } });
    this.popup(pl, `¡${m.sp.name.toUpperCase()}!`);
  }

  popup(pl, txt) {
    const t = this.add.text(pl.sprite.x, pl.sprite.y - 22, txt, { fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#ffffff', stroke: '#05060a', strokeThickness: 3 }).setOrigin(0.5).setDepth(99000);
    this.world.add(t); this.uiCam?.ignore(t);
    this.tweens.add({ targets: t, y: t.y - 14, alpha: 0, duration: 700, onComplete: () => t.destroy() });
  }

  wanderRoamers(delta) {
    for (const m of this.roamers) {
      m.moveT += delta;
      if (m.moveT < 520) continue; m.moveT = 0;
      // ¿hay un jugador CERCA (≤3 casillas)? → HUYE en dirección contraria (reto de caza)
      let near = null, best = 99;
      for (const pl of this.players) { const dist = Math.abs(pl.c - m.c) + Math.abs(pl.r - m.r); if (dist <= 3 && dist < best) { best = dist; near = pl; } }
      let opts;
      if (near) {
        const fx = Math.sign(m.c - near.c), fy = Math.sign(m.r - near.r);   // alejarse
        opts = [[fx, 0], [0, fy], [fx, fy]].filter(([a, b]) => a || b);
      } else {
        if (Math.random() < 0.45) continue;   // deambular relajado
        opts = [[0, -1], [0, 1], [-1, 0], [1, 0]];
      }
      const [dx, dy] = opts[Math.random() * opts.length | 0] || [0, 0];
      if ((!dx && !dy) || !this.walkable(m.c + dx, m.r + dy)) continue;
      if (this.roamers.some(o => o !== m && o.c === m.c + dx && o.r === m.r + dy)) continue;
      m.c += dx; m.r += dy; const p = this.tile(m.c, m.r);
      this.tweens.add({ targets: m.sprite, x: p.x, y: p.y, duration: near ? 200 : 320, ease: 'Linear' });
      m.sprite.setDepth(50 + p.y);
    }
  }

  descend() {
    this.transitioning = true;
    sfx(this, 'save', 0.6);
    // ¿llegaron a la META? → pantalla de resultados (fin de la carrera)
    if (this.depth >= GOAL_DEPTH) { this.time.delayedCall(200, () => this.finale()); return; }
    this.pcams.forEach(c => c.flash(200, 120, 200, 255));
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.time.delayedCall(320, () => this.scene.restart({ players: this.numPlayers, depth: this.depth + 1, seed: this.seed, catches: this.catches }));
  }

  /** Fin de la carrera co-op: tabla de posiciones por capturas + ganador. El banner
   *  vive en el contenedor HUD (lo pinta SOLO la uiCam, las de juego lo ignoran). */
  finale() {
    this.finished = true;
    sfx(this, 'levelup');
    const W = CANVAS.w, H = CANVAS.h;
    const rank = this.players.slice().sort((a, b) => b.catches - a.catches);
    const topScore = rank[0].catches;
    const winners = rank.filter(p => p.catches === topScore);
    const ttl = winners.length > 1 ? '¡EMPATE!' : `¡GANA ${PNAME[winners[0].idx]}!`;
    this.hud.add(this.add.rectangle(0, 0, W, H, 0x05060a, 0.92).setOrigin(0, 0).setDepth(150000));
    this.hud.add(this.add.text(W / 2, 40, '🏆 FIN DE LA CARRERA', { fontFamily: '"Press Start 2P"', fontSize: '14px', color: '#ffd76a' }).setOrigin(0.5).setDepth(150001));
    this.hud.add(this.add.text(W / 2, 70, ttl, { fontFamily: '"Press Start 2P"', fontSize: '11px', color: '#7ad0ff' }).setOrigin(0.5).setDepth(150001));
    rank.forEach((p, i) => {
      const y = 110 + i * 26;
      const medal = ['🥇', '🥈', '🥉', '4º'][i] || '';
      const col = '#' + p.color.toString(16).padStart(6, '0');
      this.hud.add(this.add.text(W / 2, y, `${medal}  ${PNAME[p.idx]}   ${p.catches} capturas`, { fontFamily: '"Press Start 2P"', fontSize: '10px', color: i === 0 ? '#ffd76a' : col }).setOrigin(0.5).setDepth(150001));
    });
    this.hud.add(this.add.text(W / 2, H - 30, `Total del equipo: ${this.catches} Pokémon en ${GOAL_DEPTH} niveles`, { fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#9fb0d0' }).setOrigin(0.5).setDepth(150001));
    const prompt = this.add.text(W / 2, H - 14, 'Start / A: volver al menú', { fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#ffd76a' }).setOrigin(0.5).setDepth(150001);
    this.hud.add(prompt);
    this.tweens.add({ targets: prompt, alpha: 0.3, duration: 700, yoyo: true, repeat: -1 });
    this.cameras.main.flash(400, 255, 226, 120);
  }
}
