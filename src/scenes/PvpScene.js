// PvpScene — COMBATE PVP ONLINE (lockstep determinista). Escena AUTOCONTENIDA:
// reusa el motor `Battle` (combate determinista por seed) pero con su propio
// renderer ligero, para NO tocar el BattleScene del single-player (cero riesgo de
// regresión). Ambos clientes corren la MISMA simulación canónica (host = lado A,
// quien se une = lado B) y cada turno intercambian su acción real; como el motor
// es determinista, los dos llegan al MISMO resultado sin desincronizarse. Cada
// cliente renderiza desde SU perspectiva (su Pokémon abajo, el rival arriba).
import Phaser from 'phaser';
import { VIEW, frameCamera } from '../main.js';
import { Battle } from '../systems/combat/battle.js';
import { MOVES } from '../../data/moves.js';
import { makeInput } from '../systems/input.js';
import { playBgm, sfx, playCry } from '../systems/audio.js';

const FONT = '"Press Start 2P"';
const clone = (x) => (typeof structuredClone === 'function' ? structuredClone(x) : JSON.parse(JSON.stringify(x)));

export class PvpScene extends Phaser.Scene {
  constructor() { super('Pvp'); }

  init(data) {
    this.net = data.net;
    this.isHost = !!data.isHost;
    this.returnTo = data.returnTo || 'Online';
    // CANÓNICO en ambos clientes: A = equipo del HOST, B = equipo del que se unió.
    const myTeam = clone(data.myTeam || []);
    const theirTeam = clone(data.theirTeam || []);
    const teamA = this.isHost ? myTeam : theirTeam;
    const teamB = this.isHost ? theirTeam : myTeam;
    this.battle = new Battle(teamA, teamB, data.seed || 'pvp', 'wild');
    this.mySide = this.isHost ? 'A' : 'B';
    this.foeSide = this.isHost ? 'B' : 'A';
    this.turnNo = 0;
    this.myAction = null; this.theirAction = null;
    this.pendingFoe = {};   // acciones del rival llegadas antes de tiempo (por turno)
    this.ended = false;
  }

  create() {
    frameCamera(this);
    const { w, h } = VIEW;
    playBgm(this, 'bgm_battle', 0.32);
    // fondo simple (arena)
    const g = this.add.graphics();
    for (let i = 0; i < h; i += 2) {
      const f = i / h;
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(new Phaser.Display.Color(64, 90, 102), new Phaser.Display.Color(10, 12, 20), 100, f * 100);
      g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1).fillRect(0, i, w, 2);
    }
    this.add.ellipse(w - 110, 150, 150, 36, 0x000000, 0.25);
    this.add.ellipse(120, 250, 170, 42, 0x000000, 0.25);
    this.add.text(w / 2, 8, '⚔ COMBATE PVP', { fontFamily: FONT, fontSize: '8px', color: '#ffd76a' }).setOrigin(0.5).setDepth(950);

    // sprites: MI Pokémon abajo-izq (de espaldas), el del RIVAL arriba-der (de frente)
    this.foeSprite = this.add.image(w - 110, 128, 'mon_' + this.foeMon().speciesId).setScale(1.4).setDepth(12);
    this.mySprite = this.add.image(120, 226, 'mon_' + this.myMon().speciesId).setScale(1.8).setFlipX(true).setDepth(12);

    // paneles de PS
    this.foePanel = this.makePanel(40, 30, this.foeMon(), false);
    this.myPanel = this.makePanel(w - 212, 162, this.myMon(), true);

    // caja de mensajes
    this.box = this.add.graphics().setDepth(900);
    this.box.fillStyle(0x05060a, 0.92).fillRect(8, h - 92, w - 16, 84);
    this.box.lineStyle(2, 0xffd76a, 1).strokeRect(8, h - 92, w - 16, 84);
    this.msg = this.add.text(22, h - 82, '', { fontFamily: FONT, fontSize: '9px', color: '#e8f6ff', wordWrap: { width: w - 44 }, lineSpacing: 6 }).setDepth(901);
    this.menu = this.add.container(0, 0).setDepth(902);

    this.gba = makeInput(this);
    // red: escucha acciones del rival y su desconexión
    this._onData = (m) => this.onNet(m);
    this._onClose = () => this.opponentGone('El rival se desconectó.');
    this.net?.on('data', this._onData).on('close', this._onClose);
    this.events.once('shutdown', () => this.cleanup());

    this.time.delayedCall(150, () => playCry(this, this.foeMon().speciesId));
    this.cameras.main.fadeIn(250, 0, 0, 0);
    this.say(`¡${this.myMon().name.toUpperCase()} vs ${this.foeMon().name.toUpperCase()}!`, () => this.beginTurn());
  }

  myMon() { return this.battle.mon(this.mySide); }
  foeMon() { return this.battle.mon(this.foeSide); }

  // ---------- UI helpers ----------
  makePanel(x, y, mon, mine) {
    const c = this.add.container(x, y).setDepth(905);
    const bg = this.add.graphics();
    bg.fillStyle(0x0a0e1a, 0.92).fillRoundedRect(0, 0, 172, mine ? 46 : 40, 6);
    bg.lineStyle(2, 0xffd76a, 1).strokeRoundedRect(0, 0, 172, mine ? 46 : 40, 6);
    c.add(bg);
    c.add(this.add.text(8, 6, mon.name.toUpperCase(), { fontFamily: FONT, fontSize: '8px', color: '#ffffff' }));
    c.add(this.add.text(150, 6, 'Nv' + mon.level, { fontFamily: FONT, fontSize: '7px', color: '#ffd76a' }).setOrigin(1, 0));
    const barBg = this.add.graphics(); barBg.fillStyle(0x222a38, 1).fillRoundedRect(8, 24, 156, 8, 3); c.add(barBg);
    const bar = this.add.graphics(); c.add(bar);
    c._bar = bar; c._mon = mon;
    this.paintBar(c);
    if (mine) { c._hpTxt = this.add.text(150, 34, `${mon.hp}/${mon.maxhp}`, { fontFamily: FONT, fontSize: '7px', color: '#9fb0d0' }).setOrigin(1, 0); c.add(c._hpTxt); }
    return c;
  }

  paintBar(panel) {
    const m = panel._mon; const frac = Math.max(0, m.hp / m.maxhp);
    const col = frac > 0.5 ? 0x3fc23f : frac > 0.2 ? 0xf0c030 : 0xf04030;
    panel._bar.clear().fillStyle(col, 1).fillRoundedRect(8, 24, Math.max(0, 156 * frac), 8, 3);
    if (panel._hpTxt) panel._hpTxt.setText(`${Math.max(0, m.hp)}/${m.maxhp}`);
  }

  syncPanels() {
    this.foePanel._mon = this.foeMon(); this.myPanel._mon = this.myMon();
    this.paintBar(this.foePanel); this.paintBar(this.myPanel);
  }

  say(text, after, delay = 800) {
    this.msg.setText(text);
    if (after) this.time.delayedCall(delay, after);
  }

  // ---------- turno ----------
  beginTurn() {
    if (this.ended) return;
    this.turnNo++;
    this.myAction = null; this.theirAction = null;
    // ¿llegó ya la acción del rival para este turno?
    if (this.pendingFoe[this.turnNo]) { this.theirAction = this.pendingFoe[this.turnNo]; delete this.pendingFoe[this.turnNo]; }
    this.showMoves();
  }

  showMoves() {
    this.menu.removeAll(true);
    const mon = this.myMon();
    const moves = (mon.moves && mon.moves.length) ? mon.moves : ['struggle'];
    this.moveOpts = moves.slice(0, 4);
    this.cursor = 0;
    this.msg.setText(`¿Qué hará ${mon.name.toUpperCase()}?`);
    const { w, h } = VIEW;
    this.rows = this.moveOpts.map((id, i) => {
      const mv = MOVES[id] || { name: id, pp: 0 };
      const col = 8 + (i % 2) * (w / 2 - 8);
      const row = h - 60 + ((i / 2) | 0) * 22;
      const txt = this.add.text(col + 14, row, `${(mv.name || id).toUpperCase()}  ${mon.pp?.[id] ?? '∞'}/${mv.pp ?? '∞'}`, { fontFamily: FONT, fontSize: '8px', color: '#9fb0d0' });
      this.menu.add(txt); return txt;
    });
    this.paintMoves();
    this.picking = true;
  }

  paintMoves() {
    this.rows?.forEach((r, i) => r.setColor(i === this.cursor ? '#ffd76a' : '#9fb0d0').setText((i === this.cursor ? '▶ ' : '  ') + r.text.replace(/^[▶ ]+/, '')));
  }

  pickMove() {
    const id = this.moveOpts[this.cursor];
    this.picking = false;
    this.menu.removeAll(true);
    this.setMyAction({ type: 'move', move: id });
  }

  setMyAction(action) {
    this.myAction = action;
    this.net?.send({ type: 'pvp-act', turn: this.turnNo, action });
    this.msg.setText('Esperando al rival...');
    this.tryResolve();
  }

  onNet(m) {
    if (!m || !this.scene.isActive()) return;
    if (m.type === 'pvp-act') {
      if (m.turn === this.turnNo && !this.theirAction) { this.theirAction = m.action; this.tryResolve(); }
      else if (m.turn > this.turnNo) this.pendingFoe[m.turn] = m.action;   // llegó adelantada
    } else if (m.type === 'pvp-quit') {
      this.opponentGone('El rival abandonó el combate.');
    }
  }

  tryResolve() {
    if (this.ended || !this.myAction || !this.theirAction) return;
    const actA = this.isHost ? this.myAction : this.theirAction;
    const actB = this.isHost ? this.theirAction : this.myAction;
    const log = this.battle.resolveTurnPvp(actA, actB);
    this.playLog(log, () => this.postTurn());
  }

  /** Renderiza el log del turno por DIFF de estado (sencillo y a prueba de desync):
   *  muestra las líneas de texto y al final sincroniza barras + flash al golpeado. */
  playLog(log, done) {
    const lines = [];
    for (const e of log) {
      if (e.text) lines.push(e.text);
      else if (e.t === 'move') lines.push(`${(e.side === this.mySide ? this.myMon().name : this.foeMon().name).toUpperCase()} usó ${e.name}!`);
      else if (e.t === 'faint') lines.push(`¡${e.name?.toUpperCase() || 'El Pokémon'} se debilitó!`);
      else if (e.t === 'miss') lines.push('¡Falló el ataque!');
    }
    sfx(this, 'hit');
    this.cameras.main.flash(120, 255, 120, 120);
    let i = 0;
    const step = () => {
      if (this.ended) return;
      this.syncPanels();
      if (i >= lines.length) { this.time.delayedCall(350, done); return; }
      this.msg.setText(lines[i++]);
      this.time.delayedCall(750, step);
    };
    step();
  }

  postTurn() {
    if (this.ended) return;
    this.syncPanels();
    // auto-cambio determinista del Pokémon debilitado (ambos clientes igual)
    let switched = false;
    for (const side of ['A', 'B']) {
      if (this.battle.mon(side).hp <= 0 && !this.battle.over) {
        const nx = this.battle.nextAlive(side);
        if (nx >= 0) { this.battle.active[side] = nx; switched = true; }
      }
    }
    if (switched) { this.refreshSprites(); }
    if (this.battle.over) return this.endBattle();
    if (switched) {
      this.say(`¡Adelante, ${this.myMon().name.toUpperCase()}!`, () => this.beginTurn(), 700);
    } else {
      this.beginTurn();
    }
  }

  refreshSprites() {
    this.mySprite.setTexture('mon_' + this.myMon().speciesId);
    this.foeSprite.setTexture('mon_' + this.foeMon().speciesId);
    this.syncPanels();
  }

  endBattle() {
    if (this.ended) return;
    this.ended = true;
    const iWon = this.battle.winner === this.mySide;
    if (iWon) sfx(this, 'levelup'); else sfx(this, 'faint');
    this.cameras.main.flash(300, iWon ? 120 : 40, iWon ? 255 : 40, iWon ? 160 : 40);
    this.menu.removeAll(true); this.picking = false;
    this.say(iWon ? '¡GANASTE el combate PVP! 🏆' : 'Perdiste el combate PVP...', () => this.leave(), 1800);
  }

  opponentGone(text) {
    if (this.ended) return;
    this.ended = true; this.picking = false;
    this.say(text, () => this.leave(), 1400);
  }

  leave() {
    this.cleanup();
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.time.delayedCall(280, () => { this.scene.stop(); this.scene.resume(this.returnTo); });
  }

  cleanup() {
    if (this._onData) this.net?.off('data', this._onData);
    if (this._onClose) this.net?.off('close', this._onClose);
    this._onData = this._onClose = null;
  }

  update() {
    if (!this.picking || !this.gba) return;
    const d = this.gba.dirJust();
    if (d === 'left' && this.cursor % 2 === 1) { this.cursor--; sfx(this, 'cursor'); this.paintMoves(); }
    else if (d === 'right' && this.cursor % 2 === 0 && this.cursor + 1 < this.moveOpts.length) { this.cursor++; sfx(this, 'cursor'); this.paintMoves(); }
    else if (d === 'up' && this.cursor >= 2) { this.cursor -= 2; sfx(this, 'cursor'); this.paintMoves(); }
    else if (d === 'down' && this.cursor + 2 < this.moveOpts.length) { this.cursor += 2; sfx(this, 'cursor'); this.paintMoves(); }
    if (this.gba.confirm()) { sfx(this, 'select'); this.pickMove(); }
  }
}
