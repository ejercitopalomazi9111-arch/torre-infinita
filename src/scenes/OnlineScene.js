// OnlineScene — CLUB DE BATALLA (modo online). Se entra desde un edificio dedicado
// en los pueblos. Permite HOSPEDAR o UNIRSE a una sala P2P (PeerJS) por un código
// corto, y desde ahí: COMERCIAR un Pokémon o retar a PVP (combate online por
// lockstep determinista, ver BattleScene). Sin servidor propio (WebRTC).
import Phaser from 'phaser';
import { VIEW, frameCamera } from '../main.js';
import { makeInput } from '../systems/input.js';
import { sfx } from '../systems/audio.js';
import { getRun, saveRun } from '../systems/state.js';
import { Net } from '../systems/net.js';

const FONT = '"Press Start 2P"';

export class OnlineScene extends Phaser.Scene {
  constructor() { super('Online'); }

  init(data) { this.returnTo = data.returnTo || 'Floor'; }

  create() {
    frameCamera(this);
    const { w, h } = VIEW;
    this.add.rectangle(0, 0, w, h, 0x0a0e1a, 1).setOrigin(0, 0);
    this.add.rectangle(0, 0, w, 24, 0x05060a, 1).setOrigin(0, 0);
    this.add.text(w / 2, 12, '⚔ CLUB DE BATALLA ONLINE', { fontFamily: FONT, fontSize: '9px', color: '#ffd76a' }).setOrigin(0.5);
    this.msg = this.add.text(w / 2, h - 16, '', { fontFamily: FONT, fontSize: '7px', color: '#9fb0d0', align: 'center', wordWrap: { width: w - 40 } }).setOrigin(0.5);
    this.panel = this.add.container(0, 0);
    this.gba = makeInput(this);
    this.run = getRun(this.registry);
    this.net = null; this.mode = null; this.cursor = 0; this.opts = [];
    this.tradeMine = null; this.tradeTheirs = null; this.tradeOk = false; this.theirOk = false;
    this.showMenu();
    this.cameras.main.fadeIn(250, 0, 0, 0);
    // al volver del PVP: limpia estado de combate y reabre el lobby si seguimos conectados
    this.events.on('resume', () => {
      this.pvpLaunched = false; this.pvpSeed = null; this.theirTeam = null;
      if (this.net?.connected) this.onConnected(); else this.resetNet();
    });
  }

  list(title, items, hint = '') {
    this.panel.removeAll(true);
    this.opts = items; this.cursor = 0;
    const { w } = VIEW;
    this.panel.add(this.add.text(w / 2, 40, title, { fontFamily: FONT, fontSize: '9px', color: '#e8f6ff', align: 'center', wordWrap: { width: w - 40 } }).setOrigin(0.5));
    this.rows = items.map((it, i) => this.add.text(w / 2, 78 + i * 22, it.label, { fontFamily: FONT, fontSize: '8px', color: '#9fb0d0' }).setOrigin(0.5));
    this.panel.add(this.rows);
    this.msg.setText(hint);
    this.paint();
  }

  paint() {
    this.rows?.forEach((r, i) => r.setColor(i === this.cursor ? '#ffd76a' : '#9fb0d0').setText((i === this.cursor ? '▶ ' : '  ') + this.opts[i].label));
  }

  showMenu() {
    this.state = 'menu';
    this.list('¿Qué quieres hacer?', [
      { label: 'HOSPEDAR SALA', onPick: () => this.startHost() },
      { label: 'UNIRSE POR CÓDIGO', onPick: () => this.startJoin() },
      { label: '❓ CÓMO CONECTAR (otra PC)', onPick: () => this.showHowTo() },
      { label: 'VOLVER', onPick: () => this.leave() },
    ], 'Hospeda y comparte tu código, o únete al de un amigo. P2P (WebRTC).');
  }

  /** Guía paso a paso para jugar entre dos dispositivos distintos. */
  showHowTo() {
    this.state = 'howto';
    let url = 'el mismo enlace del juego';
    try { url = (location.origin + location.pathname).replace(/\/$/, ''); } catch { /* */ }
    this.panel.removeAll(true);
    const { w, h } = VIEW;
    const lines = [
      'JUGAR CON UN AMIGO (otra PC o teléfono):',
      '',
      '1) Que tu amigo abra ESTA MISMA web en su',
      '   dispositivo:',
      `   ${url}`,
      '',
      '2) UNO elige HOSPEDAR SALA y le sale un CÓDIGO.',
      '3) El OTRO elige UNIRSE y escribe ese código.',
      '4) ¡Listos! Ya pueden COMERCIAR o LUCHAR.',
      '',
      'No hace falta misma red ni servidor: es directo',
      'entre los dos (P2P). Solo necesitan internet.',
    ];
    this.panel.add(this.add.text(w / 2, 36, lines.join('\n'), { fontFamily: FONT, fontSize: '7px', color: '#e8f6ff', align: 'left', lineSpacing: 5, wordWrap: { width: w - 30 } }).setOrigin(0.5, 0));
    this.opts = [{ label: '◀ VOLVER', onPick: () => this.showMenu() }];
    this.cursor = 0;
    this.rows = [this.add.text(w / 2, h - 32, '▶ ◀ VOLVER', { fontFamily: FONT, fontSize: '8px', color: '#ffd76a' }).setOrigin(0.5)];
    this.panel.add(this.rows);
    this.msg.setText('A/Enter o B para volver');
  }

  // ---------- conexión ----------
  startHost() {
    this.state = 'wait';
    this.list('Creando sala...', [{ label: 'CANCELAR', onPick: () => this.resetNet() }]);
    this.net = new Net();
    this.net.on('open', (code) => { this.code = code; this.list(`TU CÓDIGO: ${code}`, [{ label: 'CANCELAR', onPick: () => this.resetNet() }], 'Dile este código a tu rival. Esperando que se una...'); })
      .on('connect', () => { sfx(this, 'levelup'); this.onConnected(); })
      .on('error', (e) => this.msg.setText('Error de red: ' + (e?.type || e?.message || e)))
      .on('close', () => this.onPeerLeft());
    this.net.host();
  }

  startJoin() {
    this.state = 'join';
    this.promptCode((code) => {
      if (!code) return this.showMenu();
      this.list(`Uniéndote a ${code}...`, [{ label: 'CANCELAR', onPick: () => this.resetNet() }]);
      this.net = new Net();
      this.net.on('connect', () => { sfx(this, 'levelup'); this.onConnected(); })
        .on('error', (e) => this.msg.setText('No se pudo conectar: ' + (e?.type || e?.message || e)))
        .on('close', () => this.onPeerLeft());
      this.net.join(code);
    });
  }

  /** Input HTML overlay para teclear el código (4 letras). */
  promptCode(cb) {
    const el = document.createElement('input');
    el.maxLength = 4; el.placeholder = 'CÓDIGO';
    el.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:99999;font-family:monospace;font-size:28px;text-transform:uppercase;text-align:center;width:160px;padding:10px;background:#05060a;color:#ffd76a;border:2px solid #ffd76a;border-radius:8px;letter-spacing:8px';
    document.body.appendChild(el); el.focus();
    const done = (val) => { el.remove(); cb(val); };
    el.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') done(el.value.toUpperCase()); else if (e.key === 'Escape') done(null); });
    this.list('Escribe el código de la sala', [{ label: 'CANCELAR', onPick: () => { if (document.body.contains(el)) done(null); } }], 'Teclea las 4 letras y Enter');
  }

  onConnected() {
    this.state = 'lobby';
    this.list('¡CONECTADO!', [
      { label: 'COMERCIAR', onPick: () => this.startTrade() },
      { label: 'COMBATE PVP', onPick: () => this.startPvp() },
      { label: 'SALIR', onPick: () => this.resetNet() },
    ], 'Elige una actividad con tu rival.');
    if (!this._dataWired) { this._dataWired = true; this.net.on('data', (m) => this.onData(m)); }
  }

  onPeerLeft() { if (this.state !== 'menu') { this.msg.setText('El rival se desconectó.'); this.time.delayedCall(1200, () => this.resetNet()); } }
  resetNet() { this.net?.close(); this.net = null; this._dataWired = false; this.pvpLaunched = false; this.pvpSeed = null; this.theirTeam = null; this.showMenu(); }
  leave() { this.net?.close(); this.cameras.main.fadeOut(220, 0, 0, 0); this.time.delayedCall(240, () => { this.scene.stop(); this.scene.resume(this.returnTo); }); }

  // ---------- COMERCIO ----------
  startTrade() {
    this.state = 'trade';
    const team = (this.run?.party || []).concat(this.run?.box || []);
    if (!team.length) { this.msg.setText('No tienes Pokémon para ofrecer.'); return; }
    const items = team.slice(0, 12).map((m, i) => ({ label: `${m.name?.toUpperCase() || '???'} Nv${m.level}`, onPick: () => this.offerMon(i) }));
    items.push({ label: 'VOLVER', onPick: () => this.onConnected() });
    this.list('Elige a quién OFRECES', items, 'Ambos ofrecen 1 Pokémon; al confirmar los dos, se intercambian.');
  }

  offerMon(i) {
    const team = (this.run?.party || []).concat(this.run?.box || []);
    this.tradeMine = team[i]; this.tradeIdx = i; this.tradeOk = false; this.theirOk = false;
    this.net.send({ type: 'trade-offer', mon: this.tradeMine });
    this.renderTrade();
  }

  renderTrade() {
    this.state = 'trade-confirm';
    const mine = this.tradeMine ? `${this.tradeMine.name.toUpperCase()} Nv${this.tradeMine.level}` : '—';
    const theirs = this.tradeTheirs ? `${this.tradeTheirs.name.toUpperCase()} Nv${this.tradeTheirs.level}` : '(esperando)';
    this.list(`TÚ: ${mine}\nRIVAL: ${theirs}`, [
      { label: this.tradeOk ? '✓ CONFIRMADO' : 'CONFIRMAR TRATO', onPick: () => this.confirmTrade() },
      { label: 'CAMBIAR OFERTA', onPick: () => this.startTrade() },
    ], this.tradeTheirs ? (this.theirOk ? 'El rival ya confirmó. ¡Confirma tú!' : 'Confirma cuando estés listo.') : 'Esperando la oferta del rival...');
  }

  confirmTrade() {
    if (!this.tradeMine || !this.tradeTheirs) { this.msg.setText('Faltan ofertas.'); return; }
    this.tradeOk = true; this.net.send({ type: 'trade-confirm' });
    this.renderTrade();
    this.tryFinalizeTrade();
  }

  tryFinalizeTrade() {
    if (this.tradeOk && this.theirOk && this.tradeTheirs) {
      // saca el mío del equipo/caja, mete el suyo
      const team = this.run.party, box = this.run.box || (this.run.box = []);
      const pIdx = team.indexOf(this.tradeMine);
      if (pIdx >= 0) team.splice(pIdx, 1); else { const bIdx = box.indexOf(this.tradeMine); if (bIdx >= 0) box.splice(bIdx, 1); }
      const got = this.tradeTheirs;
      if (team.length < 6) team.push(got); else box.push(got);
      if (this.run.dex && !this.run.dex.caught.includes(got.speciesId)) this.run.dex.caught.push(got.speciesId);
      saveRun(this.registry, this.registry.get('floorNum') || 1);
      sfx(this, 'evolve');
      this.tradeMine = this.tradeTheirs = null; this.tradeOk = this.theirOk = false;
      this.cameras.main.flash(300, 120, 255, 200);
      this.list('¡INTERCAMBIO COMPLETO!', [{ label: 'OTRO TRATO', onPick: () => this.startTrade() }, { label: 'SALIR', onPick: () => this.resetNet() }], `¡Recibiste a ${got.name.toUpperCase()}!`);
    }
  }

  // ---------- PVP (lockstep; el combate ya es determinista por seed) ----------
  startPvp() {
    this.state = 'pvp-wait';
    if (!(this.run?.party || []).some(m => m.hp > 0)) { this.msg.setText('Tu equipo no puede luchar.'); return; }
    // el HOST fija la semilla y la comparte; ambos lanzan Battle con el mismo seed
    if (this.net.isHost) { this.pvpSeed = 'pvp-' + Date.now().toString(36); this.net.send({ type: 'pvp-start', seed: this.pvpSeed, team: this.run.party }); }
    this.net.send({ type: 'pvp-team', team: this.run.party });
    this.list('Preparando combate PVP...', [{ label: 'CANCELAR', onPick: () => this.onConnected() }], 'Intercambiando equipos con el rival...');
  }

  maybeLaunchPvp() {
    if (this.pvpLaunched || !this.pvpSeed || !this.theirTeam) return;
    if (!(this.run?.party || []).some(m => m.hp > 0)) { this.msg.setText('Tu equipo no puede luchar.'); return; }
    this.pvpLaunched = true;
    this.scene.launch('Pvp', {
      net: this.net, isHost: this.net.isHost, seed: this.pvpSeed,
      myTeam: this.run.party, theirTeam: this.theirTeam, returnTo: 'Online',
    });
    this.scene.pause();
  }

  onData(m) {
    if (!m || !m.type) return;
    switch (m.type) {
      case 'trade-offer': this.tradeTheirs = m.mon; this.theirOk = false; if (this.state.startsWith('trade')) this.renderTrade(); break;
      case 'trade-confirm': this.theirOk = true; if (this.state.startsWith('trade')) { this.renderTrade(); this.tryFinalizeTrade(); } break;
      case 'pvp-start': this.pvpSeed = m.seed; this.theirTeam = m.team; this.maybeLaunchPvp(); break;
      case 'pvp-team': this.theirTeam = m.team; this.maybeLaunchPvp(); break;
    }
  }

  update() {
    if (!this.gba || !this.opts?.length) return;
    const d = this.gba.dirJust();
    if (d === 'up') { this.cursor = Math.max(0, this.cursor - 1); sfx(this, 'cursor'); this.paint(); }
    else if (d === 'down') { this.cursor = Math.min(this.opts.length - 1, this.cursor + 1); sfx(this, 'cursor'); this.paint(); }
    if (this.gba.confirm()) { const it = this.opts[this.cursor]; if (it?.onPick) { sfx(this, 'select'); it.onPick(); } }
    else if (this.gba.cancel()) { if (this.state === 'menu') this.leave(); else if (this.state === 'howto') this.showMenu(); }
  }
}
