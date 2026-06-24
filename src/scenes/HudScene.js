// HudScene — overlay PERSISTENTE a ambos lados del juego (estilo dashboard tipo
// JARVIS / cabina arcade). Izquierda: tu EQUIPO al estilo Nuzlocke (sprite, mote,
// nivel, en GRIS si está debilitado). Derecha: una cabina ARCADE (joystick +
// botones + palanca) que se mueve al pulsar/mover los controles físicos.
// Estética Umbreon: negro + anillos dorados + acento cian. Vive sobre el resto.
import Phaser from 'phaser';
import { VIEW, HUD, CANVAS } from '../main.js';

const GOLD = 0xffd76a, CYAN = 0x54e0c8, INK = 0x0a0a12, GRAY = 0x6a6a78;
const FONT = '"Press Start 2P"';

export class HudScene extends Phaser.Scene {
  constructor() { super('Hud'); }

  create() {
    // se calculan en runtime (evitar TDZ con los exports de main.js)
    this.M = HUD.margin;             // ancho de cada panel
    this.LX = 0;                     // x del panel izquierdo
    this.RX = VIEW.w + this.M;       // x del panel derecho (96+480 = 576)
    const M = this.M, LX = this.LX, RX = this.RX;
    const H = CANVAS.h;
    // la cámara del HUD cubre TODO el canvas; el juego se ve por el centro
    this.cameras.main.setViewport(0, 0, CANVAS.w, H);

    // ----- fondo de los dos paneles laterales -----
    const g = this.add.graphics().setDepth(0);
    for (const px of [LX, RX]) {
      g.fillStyle(INK, 0.98).fillRect(px, 0, M, H);
      g.lineStyle(2, GOLD, 0.9).strokeRect(px + 3, 3, M - 6, H - 6);
    }
    // marco/bisel alrededor del área de juego central
    g.lineStyle(2, CYAN, 0.5).strokeRect(M, 1, VIEW.w, H - 2);

    // anillos decorativos Umbreon (rotan suave)
    this.rings = [];
    for (const [cx, cy] of [[LX + M / 2, H - 26], [RX + M / 2, H - 26]]) {
      const r = this.add.circle(cx, cy, 16).setStrokeStyle(2, GOLD, 0.5).setDepth(1);
      const r2 = this.add.circle(cx, cy, 9).setStrokeStyle(1, CYAN, 0.6).setDepth(1);
      this.rings.push(r, r2);
    }

    // ----- cabecera de cada panel -----
    this.add.text(LX + M / 2, 12, 'EQUIPO', { fontFamily: FONT, fontSize: '8px', color: '#ffd76a' }).setOrigin(0.5, 0).setDepth(2);
    this.add.text(RX + M / 2, 12, 'MANDO', { fontFamily: FONT, fontSize: '8px', color: '#ffd76a' }).setOrigin(0.5, 0).setDepth(2);

    // ----- EQUIPO (Nuzlocke): 6 ranuras -----
    this.teamLayer = this.add.container(0, 0).setDepth(3);
    this.teamSig = null;

    // ----- CABINA ARCADE (derecha) -----
    this.buildArcade(H);

    // ----- entradas físicas para animar la cabina -----
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = this.input.keyboard.addKeys({
      up: K.UP, down: K.DOWN, left: K.LEFT, right: K.RIGHT,
      w: K.W, a: K.A, s: K.S, d: K.D,
      enter: K.ENTER, z: K.Z, space: K.SPACE, x: K.X, back: K.BACKSPACE,
    }, false);   // capture=false: no robar las teclas a las escenas de juego
  }

  buildArcade(H) {
    const M = this.M, RX = this.RX;
    const cx = RX + M / 2;
    // joystick: base + bola
    this.add.circle(cx, 150, 24, 0x05060a).setStrokeStyle(3, GOLD, 0.9).setDepth(2);
    this.add.circle(cx, 150, 24).setStrokeStyle(1, CYAN, 0.4).setDepth(2);
    this.stickBase = { x: cx, y: 150 };
    this.stick = this.add.circle(cx, 150, 11, CYAN).setStrokeStyle(2, 0xffffff, 0.8).setDepth(4);
    this.stickShaft = this.add.line(0, 0, cx, 150, cx, 150, 0xffffff, 0.5).setLineWidth(2).setDepth(3);

    // botones A / B (se iluminan al pulsar). CLICABLES con el mouse: cada uno
    // despacha el evento de teclado real → la escena activa lo procesa igual.
    this.btnA = this.add.circle(cx - 12, 232, 11, 0x2a5a3a).setStrokeStyle(2, 0x58e070).setDepth(4);
    this.add.text(cx - 12, 232, 'A', { fontFamily: FONT, fontSize: '7px', color: '#bff0c8' }).setOrigin(0.5).setDepth(5);
    this.btnB = this.add.circle(cx + 12, 252, 11, 0x5a2a2a).setStrokeStyle(2, 0xf06060).setDepth(4);
    this.add.text(cx + 12, 252, 'B', { fontFamily: FONT, fontSize: '7px', color: '#ffc8c8' }).setOrigin(0.5).setDepth(5);
    this.btnABase = 0x2a5a3a; this.btnBBase = 0x5a2a2a;
    this.bindButton(this.btnA, 90, 'z');             // A = la tecla A REAL (Z): interactuar/confirmar
    this.bindButton(this.btnB, 88, 'x');             // B = atrás/cancelar (X)

    // ----- botones que FALTABAN en el mando (Carlos): Start, Select, L, R + atajos -----
    // gatillos L/R arriba de la cabina
    this.btnL = this.add.circle(cx - 16, 100, 9, 0x2a3a5a).setStrokeStyle(2, CYAN, 0.8).setDepth(4);
    this.add.text(cx - 16, 100, 'L', { fontFamily: FONT, fontSize: '6px', color: '#bfe0ff' }).setOrigin(0.5).setDepth(5);
    this.btnR = this.add.circle(cx + 16, 100, 9, 0x2a3a5a).setStrokeStyle(2, CYAN, 0.8).setDepth(4);
    this.add.text(cx + 16, 100, 'R', { fontFamily: FONT, fontSize: '6px', color: '#bfe0ff' }).setOrigin(0.5).setDepth(5);
    this.bindButton(this.btnL, 81, 'q');             // L = Q (bici)
    this.bindButton(this.btnR, 69, 'e');             // R = E (IA)
    // Start (Enter) y Select (Shift) como pastillas pequeñas
    const pill = (x, y, label, code, key, col) => {
      const w = 30, h = 13;
      const r = this.add.rectangle(x, y, w, h, 0x14141f).setStrokeStyle(2, col, 0.9).setDepth(4);
      this.add.text(x, y, label, { fontFamily: FONT, fontSize: '5px', color: '#e8f6ff' }).setOrigin(0.5).setDepth(5);
      this.bindButton(r, code, key);
      return r;
    };
    this.btnStart = pill(cx - 18, 272, 'START', 13, 'Enter', GOLD);
    this.btnSelect = pill(cx + 18, 272, 'SELECT', 16, 'Shift', CYAN);
    // atajos directos: 🎒 mochila (M) · 👥 equipo (T) · ▦ dex (P)
    const tag = (x, y, label, code, key) => {
      const r = this.add.circle(x, y, 9, 0x1a1a26).setStrokeStyle(2, GOLD, 0.7).setDepth(4).setInteractive({ useHandCursor: true });
      this.add.text(x, y, label, { fontFamily: 'system-ui,sans-serif', fontSize: '9px', color: '#ffd76a' }).setOrigin(0.5).setDepth(5);
      this.bindButton(r, code, key);
      return r;
    };
    tag(cx - 18, 56, '🎒', 77, 'm');
    tag(cx, 56, '👥', 84, 't');
    tag(cx + 18, 56, '▦', 80, 'p');

    // palanca arcade: base + mástil con bola que pivota desde abajo (se inclina
    // con el eje X). Antes era un rectángulo fino que se veía "roto".
    const leverY = 308;
    this.add.ellipse(cx, leverY + 1, 24, 10, 0x14141f).setStrokeStyle(2, GOLD, 0.9).setDepth(2);  // mont./base
    this.lever = this.add.container(cx, leverY).setDepth(3);
    const shaft = this.add.rectangle(0, 0, 6, 30, 0xc89a3a).setOrigin(0.5, 1).setStrokeStyle(1, 0x6a4f18);
    const knob = this.add.circle(0, -30, 9, 0xf04040).setStrokeStyle(2, 0xffffff, 0.85);   // bola roja
    const shine = this.add.circle(-3, -33, 3, 0xffffff, 0.6);
    this.lever.add([shaft, knob, shine]);
    this.leverKnob = knob; this.leverShine = shine; this.leverBaseY = leverY;

    // JOYSTICK clicable: zona invisible sobre la base; arrastrar/clic en una
    // dirección manda la flecha correspondiente a la escena activa.
    this.mouseDir = null;
    const zone = this.add.circle(cx, 150, 26, 0xffffff, 0.001).setDepth(5).setInteractive({ useHandCursor: true });
    const dirFrom = (p) => {
      const ox = p.x - cx, oy = p.y - 150;
      if (Math.hypot(ox, oy) < 5) return null;
      return Math.abs(ox) > Math.abs(oy)
        ? (ox < 0 ? [37, 'ArrowLeft'] : [39, 'ArrowRight'])
        : (oy < 0 ? [38, 'ArrowUp'] : [40, 'ArrowDown']);
    };
    const setDir = (d) => {
      if (this.mouseDir && (!d || d[0] !== this.mouseDir[0])) { this.fireKey(this.mouseDir[0], this.mouseDir[1], false); this.mouseDir = null; }
      if (d && (!this.mouseDir || d[0] !== this.mouseDir[0])) { this.mouseDir = d; this.fireKey(d[0], d[1], true); }
    };
    zone.on('pointerdown', (p) => setDir(dirFrom(p)));
    zone.on('pointermove', (p) => { if (p.isDown) setDir(dirFrom(p)); });
    zone.on('pointerup', () => setDir(null));
    zone.on('pointerout', () => setDir(null));
  }

  /** Despacha un evento de teclado REAL (Phaser lo reparte a la escena activa). */
  fireKey(keyCode, key, down) {
    const ev = new KeyboardEvent(down ? 'keydown' : 'keyup', { key, bubbles: true, cancelable: true });
    Object.defineProperty(ev, 'keyCode', { get: () => keyCode });
    Object.defineProperty(ev, 'which', { get: () => keyCode });
    window.dispatchEvent(ev);
  }

  /** Hace un círculo clicable que mantiene pulsada una tecla mientras se aprieta. */
  bindButton(circle, keyCode, key) {
    circle.setInteractive({ useHandCursor: true });
    const press = () => this.fireKey(keyCode, key, true);
    const release = () => this.fireKey(keyCode, key, false);
    circle.on('pointerdown', press);
    circle.on('pointerup', release);
    circle.on('pointerout', release);
    circle.on('pointerupoutside', release);
  }

  // ---- refresco del EQUIPO (solo cuando cambia) ----
  refreshTeam() {
    // NO refrescar durante el combate: el motor aplica el daño de todo el turno de
    // golpe, así que el HUD mostraría el HP final ANTES de la animación (spoiler).
    // Al volver al piso (resume) se sincroniza. (En replay sí, no hay run real editándose.)
    if (this.scene.isActive('Battle')) return;
    const M = this.M, LX = this.LX;
    const run = this.registry.get('run');
    const party = run?.party || [];
    // incluye el HP REAL en la firma: así la barra se refresca al curar / al
    // recibir daño / curación pasiva (antes solo miraba vivo-vs-K.O. y no movía la barra).
    const sig = party.map(m => `${m.speciesId}:${m.level}:${m.hp}/${m.maxhp}`).join('|') + '/' + (run?.box?.length || 0);
    if (sig === this.teamSig) return;
    this.teamSig = sig;
    this.teamLayer.removeAll(true);

    const slotH = 47, top = 30;
    for (let i = 0; i < 6; i++) {
      const y = top + i * slotH;
      const dead = party[i] && party[i].hp <= 0;
      const bg = this.add.rectangle(LX + M / 2, y + slotH / 2 - 2, M - 12, slotH - 5,
        party[i] ? (dead ? 0x1a0e12 : 0x12161f) : 0x0c0c14, 0.95)
        .setStrokeStyle(1, party[i] ? (dead ? 0x7a3a3a : CYAN) : 0x2a2a36, 0.8);
      this.teamLayer.add(bg);
      const m = party[i];
      if (!m) { this.teamLayer.add(this.add.text(LX + M / 2, y + 18, '—', { fontFamily: FONT, fontSize: '8px', color: '#33333f' }).setOrigin(0.5)); continue; }
      // sprite
      const sx = LX + 22, sy = y + 20;
      if (this.textures.exists('mon_' + m.speciesId)) {
        const img = this.add.image(sx, sy, 'mon_' + m.speciesId);
        const src = this.textures.get('mon_' + m.speciesId).getSourceImage();
        img.setScale(30 / Math.max(src.width, src.height));
        if (dead) img.setTint(GRAY).setAlpha(0.55);
        this.teamLayer.add(img);
      }
      // mote + nivel + barra de PS
      const tx = LX + 40;
      const nm = (m.name || '').toUpperCase().slice(0, 7);
      this.teamLayer.add(this.add.text(tx, y + 5, nm, { fontFamily: FONT, fontSize: '6px', color: dead ? '#9a7a7a' : '#e8f6ff' }));
      this.teamLayer.add(this.add.text(tx, y + 16, 'Nv' + m.level, { fontFamily: FONT, fontSize: '6px', color: dead ? '#7a5a5a' : '#ffd76a' }));
      if (dead) {
        this.teamLayer.add(this.add.text(tx, y + 28, 'K.O.', { fontFamily: FONT, fontSize: '6px', color: '#f06060' }));
      } else {
        const ratio = Phaser.Math.Clamp(m.hp / (m.maxhp || m.hp || 1), 0, 1);
        const col = ratio > 0.5 ? 0x58e070 : ratio > 0.2 ? 0xf8d030 : 0xf04040;
        this.teamLayer.add(this.add.rectangle(tx, y + 30, M - 52, 4, 0x05060a).setOrigin(0, 0.5));
        this.teamLayer.add(this.add.rectangle(tx, y + 30, (M - 52) * ratio, 4, col).setOrigin(0, 0.5));
      }
    }
  }

  update(time, delta) {
    this.refreshTeam();

    // anillos Umbreon girando suave
    for (let i = 0; i < this.rings.length; i++) this.rings[i].rotation += (i % 2 ? -0.01 : 0.012);

    // dirección física (teclado o gamepad) → inclina el joystick
    const k = this.keys;
    let dx = 0, dy = 0;
    if (k.left.isDown || k.a.isDown) dx -= 1;
    if (k.right.isDown || k.d.isDown) dx += 1;
    if (k.up.isDown || k.w.isDown) dy -= 1;
    if (k.down.isDown || k.s.isDown) dy += 1;
    const pad = this.input.gamepad?.pad1;
    if (pad) {
      if (Math.abs(pad.axes[0]?.getValue() || 0) > 0.2) dx += pad.axes[0].getValue();
      if (Math.abs(pad.axes[1]?.getValue() || 0) > 0.2) dy += pad.axes[1].getValue();
      if (pad.left) dx -= 1; if (pad.right) dx += 1; if (pad.up) dy -= 1; if (pad.down) dy += 1;
    }
    const len = Math.hypot(dx, dy) || 1;
    const tx = this.stickBase.x + (dx / len) * (Math.min(1, Math.hypot(dx, dy)) * 12);
    const ty = this.stickBase.y + (dy / len) * (Math.min(1, Math.hypot(dx, dy)) * 12);
    // suavizado hacia el objetivo
    this.stick.x += (tx - this.stick.x) * 0.35;
    this.stick.y += (ty - this.stick.y) * 0.35;
    this.stickShaft.setTo(this.stickBase.x, this.stickBase.y, this.stick.x, this.stick.y);
    // palanca: pivota con el eje X (inclinación) y SE ESTIRA/ENCOGE con el eje Y
    // para dar sensación 3D (arriba = empujada hacia adelante/más larga, abajo =
    // tirada hacia ti/más corta y baja). Antes solo se movía a los lados.
    const leverTarget = (dx / len) * 0.5;
    this.lever.rotation += (leverTarget - this.lever.rotation) * 0.3;
    // PERSPECTIVA 3D en el eje Y: ARRIBA = la palanca se va hacia adelante-arriba
    // (mástil más largo) y la bola se ve más PEQUEÑA (lejos). ABAJO = la bola se ve
    // más GRANDE (cerca, hacia ti) y el mástil se acorta inclinándose.
    const ny = Math.abs(dy) > 0.05 ? dy / len : 0;          // -1 arriba … +1 abajo
    const shaftSY = 1 - ny * 0.35;                           // arriba alarga, abajo acorta
    this.lever.scaleY += (shaftSY - this.lever.scaleY) * 0.3;
    const knobScale = 1 - ny * 0.55;                         // arriba pequeña, abajo grande
    if (this.leverKnob) {
      this.leverKnob.scale += (knobScale - this.leverKnob.scale) * 0.3;
      this.leverKnob.y += ((-30 - ny * 4) - this.leverKnob.y) * 0.3;   // arriba sube más
      if (this.leverShine) { this.leverShine.scale = this.leverKnob.scale; this.leverShine.y = this.leverKnob.y - 3; }
    }
    this.lever.y += ((this.leverBaseY + ny * 4) - this.lever.y) * 0.3;

    // botones: A = confirmar, B = atrás/cancelar
    const aDown = k.enter.isDown || k.z.isDown || k.space.isDown || pad?.A || pad?.buttons?.[0]?.pressed;
    const bDown = k.x.isDown || k.back.isDown || pad?.B || pad?.buttons?.[1]?.pressed;
    this.btnA.setFillStyle(aDown ? 0x58e070 : this.btnABase).setScale(aDown ? 0.86 : 1);
    this.btnB.setFillStyle(bDown ? 0xf06060 : this.btnBBase).setScale(bDown ? 0.86 : 1);
  }
}
