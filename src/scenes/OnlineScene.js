// OnlineScene — CLUB DE BATALLA (modo online P2P, PeerJS/WebRTC, sin servidor).
// Entras desde el menú principal o desde un pueblo. HOSPEDAS o te UNES por código,
// y desde el lobby puedes INVITAR al rival a COMERCIAR o LUCHAR (PVP). El rival
// recibe la invitación y la acepta o rechaza — NO hace falta que ambos pulsen a la
// vez. El intercambio muestra los Pokémon con sprite, mote, nivel, estado y objeto.
import Phaser from 'phaser';
import { VIEW, frameCamera } from '../main.js';
import { makeInput } from '../systems/input.js';
import { sfx } from '../systems/audio.js';
import { getRun, saveRun } from '../systems/state.js';
import { Net } from '../systems/net.js';
import { ITEMS } from '../../data/items.js';

const FONT = '"Press Start 2P"';
const ACT_NAME = { trade: 'COMERCIAR', pvp: 'LUCHAR (PVP)' };

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
    this.cardLayer = this.add.container(0, 0).setDepth(5);   // sprites/tarjetas del trade
    this.gba = makeInput(this);
    this.run = getRun(this.registry);
    this.net = null; this.mode = null; this.cursor = 0; this.opts = [];
    this.tradeMine = null; this.tradeTheirs = null; this.tradeOk = false; this.theirOk = false;
    this.pendingInvite = null;   // actividad que YO propuse y espera respuesta
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
    this.cardLayer.removeAll(true);
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
    this.panel.removeAll(true); this.cardLayer.removeAll(true);
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

  // ---------- LOBBY ----------
  onConnected() {
    this.state = 'lobby';
    this.pendingInvite = null;
    this.tradeMine = this.tradeTheirs = null; this.tradeOk = this.theirOk = false;
    this.list('¡CONECTADO!', [
      { label: 'COMERCIAR', onPick: () => this.invite('trade') },
      { label: 'COMBATE PVP', onPick: () => this.invite('pvp') },
      { label: 'SALIR', onPick: () => this.resetNet() },
    ], 'Propón una actividad; tu rival la acepta o la rechaza.');
    if (!this._dataWired) { this._dataWired = true; this.net.on('data', (m) => this.onData(m)); }
  }

  // ---------- INVITACIONES (uno propone, el otro acepta/rechaza) ----------
  invite(activity) {
    if (!this.net?.connected) return;
    if (activity === 'pvp' && !(this.run?.party || []).some(m => m.hp > 0)) { this.msg.setText('Tu equipo no puede luchar (todos debilitados).'); sfx(this, 'error'); return; }
    this.pendingInvite = activity;
    this.state = 'invited-wait';
    this.net.send({ type: 'invite', activity });
    this.list(`Invitando a ${ACT_NAME[activity]}...`, [{ label: 'CANCELAR', onPick: () => this.cancelInvite() }], 'Esperando a que tu rival acepte...');
  }
  cancelInvite() {
    if (this.pendingInvite) this.net?.send({ type: 'invite-cancel' });
    this.pendingInvite = null; this.onConnected();
  }
  onInvite(activity) {
    // me llega una propuesta del rival
    this.state = 'invite-ask';
    sfx(this, 'levelup');
    this.list(`El rival quiere ${ACT_NAME[activity]}.`, [
      { label: '✓ ACEPTAR', onPick: () => this.acceptInvite(activity) },
      { label: '✗ RECHAZAR', onPick: () => { this.net.send({ type: 'invite-decline' }); this.onConnected(); } },
    ], '¿Aceptas la propuesta de tu rival?');
  }
  acceptInvite(activity) {
    if (activity === 'pvp' && !(this.run?.party || []).some(m => m.hp > 0)) { this.msg.setText('Tu equipo no puede luchar.'); sfx(this, 'error'); return; }
    this.net.send({ type: 'invite-accept', activity });
    this.beginActivity(activity);
  }
  beginActivity(activity) {
    if (activity === 'trade') this.startTrade();
    else if (activity === 'pvp') this.beginPvp();
  }

  onPeerLeft() { if (this.state !== 'menu') { this.msg.setText('El rival se desconectó.'); this.time.delayedCall(1200, () => this.resetNet()); } }
  resetNet() { this.net?.close(); this.net = null; this._dataWired = false; this.pvpLaunched = false; this.pvpSeed = null; this.theirTeam = null; this.pendingInvite = null; this.showMenu(); }
  leave() { this.net?.close(); this.cameras.main.fadeOut(220, 0, 0, 0); this.time.delayedCall(240, () => { this.scene.stop(); this.scene.resume(this.returnTo); }); }

  // ---------- COMERCIO (con sprites y datos completos) ----------
  team() { return (this.run?.party || []).concat(this.run?.box || []); }

  startTrade() {
    this.state = 'trade';
    const team = this.team();
    if (!team.length) { this.msg.setText('No tienes Pokémon para ofrecer.'); this.time.delayedCall(1000, () => this.onConnected()); return; }
    const items = team.slice(0, 12).map((m, i) => ({
      label: `${(m.name || '???').toUpperCase()} Nv${m.level}${m.hp <= 0 ? ' (K.O.)' : ''}`,
      onPick: () => this.offerMon(i),
    }));
    items.push({ label: 'CANCELAR', onPick: () => { this.net.send({ type: 'trade-cancel' }); this.onConnected(); } });
    this.list('Elige a quién OFRECES', items, 'Ambos ofrecen 1 Pokémon; al confirmar los dos, se intercambian.');
  }

  offerMon(i) {
    const team = this.team();
    this.tradeMine = team[i]; this.tradeIdx = i; this.tradeOk = false;
    this.net.send({ type: 'trade-offer', mon: this.tradeMine });
    this.renderTrade();
  }

  /** Tarjeta de un Pokémon: sprite + mote + nivel + vivo/K.O. + objeto que lleva. */
  monCard(mon, cx, top, label, labelColor) {
    const L = this.cardLayer;
    L.add(this.add.text(cx, top, label, { fontFamily: FONT, fontSize: '7px', color: labelColor }).setOrigin(0.5, 0));
    const boxW = 150, boxH = 86, by = top + 12;
    const dead = mon && mon.hp <= 0;
    const box = this.add.rectangle(cx, by + boxH / 2, boxW, boxH, dead ? 0x1a0e12 : 0x12161f, 0.96).setStrokeStyle(2, mon ? (dead ? 0x7a3a3a : 0x54e0c8) : 0x2a3a5a);
    L.add(box);
    if (!mon) { L.add(this.add.text(cx, by + boxH / 2, '(esperando)', { fontFamily: FONT, fontSize: '7px', color: '#7a8398' }).setOrigin(0.5)); return; }
    // sprite
    const key = 'mon_' + mon.speciesId;
    if (this.textures.exists(key)) {
      const img = this.add.image(cx - boxW / 2 + 28, by + 34, key);
      const src = this.textures.get(key).getSourceImage();
      img.setScale(46 / Math.max(src.width, src.height));
      if (dead) img.setTint(0x6a6a78).setAlpha(0.6);
      L.add(img);
    }
    // datos a la derecha del sprite
    const tx = cx - boxW / 2 + 56;
    const nm = (mon.name || '???').toUpperCase().slice(0, 10);
    L.add(this.add.text(tx, by + 8, nm, { fontFamily: FONT, fontSize: '7px', color: dead ? '#c89a9a' : '#e8f6ff' }));
    L.add(this.add.text(tx, by + 22, 'Nv ' + mon.level, { fontFamily: FONT, fontSize: '7px', color: '#ffd76a' }));
    L.add(this.add.text(tx, by + 36, dead ? 'K.O.' : `PS ${mon.hp}/${mon.maxhp}`, { fontFamily: FONT, fontSize: '6px', color: dead ? '#f06060' : '#7fd9a0' }));
    const itemName = mon.item ? (ITEMS[mon.item]?.name || mon.item) : 'sin objeto';
    L.add(this.add.text(tx, by + 50, '🎒 ' + itemName, { fontFamily: 'system-ui,sans-serif', fontSize: '8px', color: mon.item ? '#cfe0f0' : '#5a6a8a' }));
    // tipos
    if (mon.types?.length) L.add(this.add.text(tx, by + 64, mon.types.join('/').toUpperCase(), { fontFamily: FONT, fontSize: '5px', color: '#9fb0d0' }));
  }

  renderTrade() {
    this.state = 'trade-confirm';
    const { w } = VIEW;
    this.panel.removeAll(true); this.cardLayer.removeAll(true);
    this.panel.add(this.add.text(w / 2, 30, 'INTERCAMBIO', { fontFamily: FONT, fontSize: '9px', color: '#ffd76a' }).setOrigin(0.5));
    this.monCard(this.tradeMine, w / 2 - 82, 46, 'TÚ OFRECES', this.tradeOk ? '#7fd9a0' : '#54e0c8');
    this.monCard(this.tradeTheirs, w / 2 + 82, 46, 'RIVAL OFRECE', this.theirOk ? '#7fd9a0' : '#ffd76a');
    const ready = this.tradeMine && this.tradeTheirs;
    this.opts = [
      { label: this.tradeOk ? '✓ CONFIRMADO (espera al rival)' : 'CONFIRMAR TRATO', onPick: () => this.confirmTrade() },
      { label: 'CAMBIAR OFERTA', onPick: () => this.startTrade() },
      { label: 'CANCELAR', onPick: () => { this.net.send({ type: 'trade-cancel' }); this.onConnected(); } },
    ];
    this.cursor = 0;
    this.rows = this.opts.map((it, i) => this.add.text(w / 2, 156 + i * 16, it.label, { fontFamily: FONT, fontSize: '7px', color: '#9fb0d0' }).setOrigin(0.5));
    this.panel.add(this.rows);
    this.msg.setText(!this.tradeTheirs ? 'Esperando la oferta del rival...' : this.theirOk ? '¡El rival ya confirmó! Confirma tú para cerrar.' : 'Cuando ambos confirmen, se intercambian.');
    this.paint();
    void ready;
  }

  confirmTrade() {
    if (!this.tradeMine || !this.tradeTheirs) { this.msg.setText('Faltan ofertas de ambos.'); sfx(this, 'error'); return; }
    this.tradeOk = true; this.net.send({ type: 'trade-confirm' });
    this.renderTrade();
    this.tryFinalizeTrade();
  }

  tryFinalizeTrade() {
    if (this.tradeOk && this.theirOk && this.tradeMine && this.tradeTheirs) {
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
      this.cardLayer.removeAll(true);
      this.list('¡INTERCAMBIO COMPLETO!', [
        { label: 'OTRO TRATO', onPick: () => this.invite('trade') },
        { label: 'VOLVER AL LOBBY', onPick: () => this.onConnected() },
      ], `¡Recibiste a ${got.name.toUpperCase()}!`);
    }
  }

  // ---------- PVP (lockstep; combate determinista por seed) ----------
  // Tras aceptar la invitación, AMBOS mandan su equipo SIEMPRE (no solo el que
  // pulsó) — esto arregla que el host se quedara colgado en "Preparando...".
  beginPvp() {
    this.state = 'pvp-wait';
    this.pvpLaunched = false; this.theirTeam = null;
    if (this.net.isHost) { this.pvpSeed = 'pvp-' + Date.now().toString(36); this.net.send({ type: 'pvp-seed', seed: this.pvpSeed }); }
    else { this.pvpSeed = null; }
    this.net.send({ type: 'pvp-team', team: this.run.party });
    this.list('Preparando combate PVP...', [{ label: 'CANCELAR', onPick: () => { this.net.send({ type: 'pvp-cancel' }); this.onConnected(); } }], 'Intercambiando equipos con el rival...');
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
      // invitaciones
      case 'invite': if (this.state === 'lobby') this.onInvite(m.activity); break;
      case 'invite-accept': if (this.pendingInvite === m.activity) { const a = this.pendingInvite; this.pendingInvite = null; this.beginActivity(a); } break;
      case 'invite-decline': if (this.state === 'invited-wait') { this.pendingInvite = null; this.msg.setText('El rival rechazó la invitación.'); sfx(this, 'error'); this.time.delayedCall(900, () => this.onConnected()); } break;
      case 'invite-cancel': if (this.state === 'invite-ask') { this.msg.setText('El rival canceló.'); this.time.delayedCall(700, () => this.onConnected()); } break;
      // comercio
      case 'trade-offer': this.tradeTheirs = m.mon; this.theirOk = false; if (this.state.startsWith('trade')) this.renderTrade(); break;
      case 'trade-confirm': this.theirOk = true; if (this.state.startsWith('trade')) { this.renderTrade(); this.tryFinalizeTrade(); } break;
      case 'trade-cancel': if (this.state.startsWith('trade')) { this.msg.setText('El rival canceló el intercambio.'); this.time.delayedCall(800, () => this.onConnected()); } break;
      // pvp
      case 'pvp-seed': this.pvpSeed = m.seed; this.maybeLaunchPvp(); break;
      case 'pvp-team': this.theirTeam = m.team; this.maybeLaunchPvp(); break;
      case 'pvp-cancel': if (this.state === 'pvp-wait') { this.msg.setText('El rival canceló el combate.'); this.time.delayedCall(800, () => this.onConnected()); } break;
    }
  }

  update() {
    if (!this.gba || !this.opts?.length) return;
    const d = this.gba.dirJust();
    if (d === 'up') { this.cursor = Math.max(0, this.cursor - 1); sfx(this, 'cursor'); this.paint(); }
    else if (d === 'down') { this.cursor = Math.min(this.opts.length - 1, this.cursor + 1); sfx(this, 'cursor'); this.paint(); }
    if (this.gba.confirm()) { const it = this.opts[this.cursor]; if (it?.onPick) { sfx(this, 'select'); it.onPick(); } }
    else if (this.gba.cancel()) {
      if (this.state === 'menu') this.leave();
      else if (this.state === 'howto') this.showMenu();
      else if (this.state === 'lobby') this.resetNet();
      else if (this.state === 'invite-ask') { this.net.send({ type: 'invite-decline' }); this.onConnected(); }
      else if (this.state === 'invited-wait') this.cancelInvite();
    }
  }
}
