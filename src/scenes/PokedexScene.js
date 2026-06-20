// PokedexScene — dos pestañas: POKéDEX (vistos/capturados) y REPETICIONES
// (grabaciones de combate, que se ven en modo retransmisión épica "Torre TV").
// Totalmente navegable por TECLADO: ←/→ cambia pestaña, ↑/↓ desplaza/selecciona,
// Enter/Z reproduce, P/Esc vuelve. El ratón es opcional.
import Phaser from 'phaser';
import { VIEW, frameCamera } from '../main.js';
import { SPECIES } from '../../data/species.generated.js';
import { listRecordings, clearRecordings } from '../systems/combat/recorder.js';
import { makeMoveset } from '../systems/combat/movepool.js';
import { MOVES } from '../../data/moves.js';
import { makeInput } from '../systems/input.js';

const COLS = 8, CELL = 52, SPRITE = 34, TOP = 56;
const RESULT = { win: 'Victoria', lose: 'Derrota', caught: 'Capturado', fled: 'Huida' };

export class PokedexScene extends Phaser.Scene {
  constructor() { super('Pokedex'); }

  init(data) { this.run = data.run; this.returnTo = data.returnTo || 'Floor'; this.mode = data.mode || 'dex'; }

  create() {
    frameCamera(this);
    const { w, h } = VIEW;
    // estética POKÉMON BLANCO/NEGRO: negro pleno, blancos limpios, acento mínimo
    this.add.rectangle(0, 0, w, h, 0x0b0b0e, 1).setOrigin(0, 0);
    this.add.rectangle(0, 0, w, 48, 0x17171c, 1).setOrigin(0, 0);
    this.add.rectangle(0, 48, w, 2, 0xffffff, 1).setOrigin(0, 0);
    this.tabDex = this.add.text(12, 16, 'POKéDEX', { fontFamily: '"Press Start 2P"', fontSize: '12px', color: '#fff' }).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.setMode('dex'));
    this.tabRec = this.add.text(190, 18, 'REPETICIONES', { fontFamily: '"Press Start 2P"', fontSize: '10px', color: '#fff' }).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.setMode('rec'));
    this.tabUnderline = this.add.rectangle(0, 40, 10, 3, 0xffffff, 1).setOrigin(0, 0);
    this.headerInfo = this.add.text(w - 12, 8, '', { fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#cfd2dd' }).setOrigin(1, 0);

    this.content = this.add.container(0, 0);
    this.add.text(w / 2, h - 11, 'Q/E pestaña · flechas (mantén) mover · Enter ver · Supr borrar todas · P/Esc volver', { fontFamily: '"Press Start 2P"', fontSize: '7px', color: '#5a5f70' }).setOrigin(0.5);

    this.input.on('wheel', (p, o, dx, dy) => { if (this.mode === 'dex') this.scrollBy(dy * 0.5); else this.moveSel(dy > 0 ? 1 : -1); });
    // borrar TODAS las repeticiones (Supr)
    this.input.keyboard.on('keydown-DELETE', () => { if (this.mode === 'rec' && this.recs?.length) { clearRecordings(); this.setMode('rec'); } });
    // navegación UNIFICADA teclado+gamepad por polling (ver update);
    // pestañas también con TAB (teclado) además de Q/E y L1/R1
    this.gba = makeInput(this);
    this.input.keyboard.on('keydown-TAB', () => this.setMode(this.mode === 'dex' ? 'rec' : 'dex'));
    const close = () => { this.scene.stop(); this.scene.resume(this.returnTo); };
    this.input.keyboard.on('keydown-P', close);
    this.input.keyboard.on('keydown-ESC', close);

    this.setMode(this.mode);
    this.cameras.main.fadeIn(180, 0, 0, 0);
  }

  setMode(mode) {
    this.mode = mode;
    this.content.removeAll(true);
    const dexActive = mode === 'dex';
    this.tabDex.setColor(dexActive ? '#ffffff' : '#5a5f70');
    this.tabRec.setColor(dexActive ? '#5a5f70' : '#ffffff');
    const tab = dexActive ? this.tabDex : this.tabRec;
    this.tabUnderline.setPosition(tab.x, 42).setSize(tab.width, 3);
    if (dexActive) this.buildDex(); else this.buildRecordings();
  }

  // ---- PESTAÑA POKéDEX ----
  buildDex() {
    const { w, h } = VIEW;
    const seen = this.run.dex.seen.length, caught = this.run.dex.caught.length;
    this.headerInfo.setText(`Vistos ${seen}  ·  Capt. ${caught}/${SPECIES.length}`);
    this.grid = this.add.container(0, TOP); this.content.add(this.grid);
    const seenSet = new Set(this.run.dex.seen), caughtSet = new Set(this.run.dex.caught);
    const startX = (w - COLS * CELL) / 2 + CELL / 2;
    this.cellRects = [];
    SPECIES.forEach((sp, i) => {
      const cx = startX + (i % COLS) * CELL, cy = Math.floor(i / COLS) * CELL + CELL / 2;
      const rect = this.add.rectangle(cx, cy, CELL - 6, CELL - 6, 0x16161b, 1).setStrokeStyle(1, 0x2a2a32);
      rect.setInteractive({ useHandCursor: true }).on('pointerover', () => { this.dexSel = i; this.paintDex(); }).on('pointerdown', () => this.openSelected());
      this.grid.add(rect); this.cellRects.push(rect);
      if (caughtSet.has(sp.id)) {
        this.grid.add(this.add.image(cx, cy - 4, 'mon_' + sp.id).setDisplaySize(SPRITE, SPRITE));
        this.grid.add(this.add.text(cx, cy + 18, '#' + sp.id, { fontFamily: '"Press Start 2P"', fontSize: '6px', color: '#ffffff' }).setOrigin(0.5));
      } else if (seenSet.has(sp.id)) {
        this.grid.add(this.add.image(cx, cy - 4, 'mon_' + sp.id).setDisplaySize(SPRITE, SPRITE).setTintFill(0x26262e));
        this.grid.add(this.add.text(cx, cy + 18, '???', { fontFamily: '"Press Start 2P"', fontSize: '6px', color: '#5a5f70' }).setOrigin(0.5));
      } else {
        this.grid.add(this.add.text(cx, cy - 2, '?', { fontFamily: '"Press Start 2P"', fontSize: '12px', color: '#26262e' }).setOrigin(0.5));
      }
    });
    const maskShape = this.make.graphics().fillRect(0, TOP, w, h - TOP - 22);
    this.grid.setMask(maskShape.createGeometryMask());
    const rows = Math.ceil(SPECIES.length / COLS);
    this.maxScroll = Math.max(0, rows * CELL - (h - TOP - 22));
    this.scroll = 0;
    this.dexSel = this.dexSel ?? 0;
    this.paintDex();
  }
  scrollBy(d) { if (this.mode !== 'dex') return; this.scroll = Phaser.Math.Clamp(this.scroll + d, 0, this.maxScroll); this.grid.y = TOP - this.scroll; }

  /** Cursor de celda con flechas + autoscroll para mantenerlo a la vista. */
  moveDex(d) {
    if (this.detail) return;
    this.dexSel = Phaser.Math.Clamp((this.dexSel ?? 0) + d, 0, SPECIES.length - 1);
    const rowY = Math.floor(this.dexSel / COLS) * CELL;
    const viewH = VIEW.h - TOP - 22;
    if (rowY - this.scroll < 0) this.scroll = rowY;
    if (rowY - this.scroll > viewH - CELL) this.scroll = rowY - viewH + CELL;
    this.scroll = Phaser.Math.Clamp(this.scroll, 0, this.maxScroll);
    this.grid.y = TOP - this.scroll;
    this.paintDex();
  }
  paintDex() {
    this.cellRects?.forEach((r, i) => r.setStrokeStyle(i === this.dexSel ? 2 : 1, i === this.dexSel ? 0xffffff : 0x2a2a32));
  }
  openSelected() {
    const sp = SPECIES[this.dexSel ?? 0]; if (!sp) return;
    if (this.run.dex.caught.includes(sp.id)) this.showDetail(sp);
    else if (this.run.dex.seen.includes(sp.id)) this.showDetail(sp, true);   // ficha con ???
  }

  // ---- DETALLE DE UN POKéMON ----
  showDetail(sp, masked = false) {
    const { w, h } = VIEW;
    if (this.detail) this.detail.destroy(true);
    const Q = (v) => masked ? '???' : v;                 // visto pero no capturado → incógnitas
    const d = this.add.container(0, 0).setDepth(50);
    d.add(this.add.rectangle(0, 0, w, h, 0x0b0b0e, 0.98).setOrigin(0, 0).setInteractive());
    d.add(this.add.rectangle(0, 0, w, 48, 0x17171c, 1).setOrigin(0, 0));
    d.add(this.add.rectangle(0, 48, w, 2, 0xffffff, 1).setOrigin(0, 0));
    const im = this.add.image(70, 120, 'mon_' + sp.id).setDisplaySize(96, 96);
    if (masked) im.setTintFill(0x26262e);                // silueta misteriosa
    d.add(im);
    d.add(this.add.text(140, 60, `#${sp.id}  ${masked ? '???' : sp.name.toUpperCase()}`, { fontFamily: '"Press Start 2P"', fontSize: '12px', color: '#ffffff' }));
    d.add(this.add.text(140, 84, 'Tipo: ' + Q(sp.types.join(' / ')), { fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#cfd2dd' }));
    d.add(this.add.text(140, 102, masked ? 'Altura ??? · Peso ???' : `Altura ${(sp.height / 10).toFixed(1)}m · Peso ${(sp.weight / 10).toFixed(1)}kg`, { fontFamily: '"Press Start 2P"', fontSize: '7px', color: '#cfd2dd' }));
    const st = sp.base;
    d.add(this.add.text(140, 122, masked ? 'PS ??? ATK ??? DEF ???\nSPA ??? SPD ??? VEL ???' : `PS ${st.hp} ATK ${st.atk} DEF ${st.def}\nSPA ${st.spa} SPD ${st.spd} VEL ${st.spe}`, { fontFamily: '"Press Start 2P"', fontSize: '7px', color: '#cfd2dd', lineSpacing: 6 }));
    d.add(this.add.text(20, 168, masked ? 'Captúralo para registrar sus datos.' : 'Movimientos que puede usar:', { fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#ffffff' }));
    if (!masked) makeMoveset(sp).forEach((id, i) => d.add(this.add.text(24 + (i % 2) * 230, 188 + Math.floor(i / 2) * 18, '• ' + MOVES[id].name + ` (${MOVES[id].type})`, { fontFamily: '"Press Start 2P"', fontSize: '7px', color: '#e8e8ee' })));
    d.add(this.add.text(w / 2, h - 16, 'Enter/click: volver', { fontFamily: '"Press Start 2P"', fontSize: '7px', color: '#5a5f70' }).setOrigin(0.5));
    d.list[0].on('pointerdown', () => { d.destroy(true); this.detail = null; });
    this.detail = d;
  }

  // ---- PESTAÑA REPETICIONES ----
  buildRecordings() {
    const { w } = VIEW;
    const { h } = VIEW;
    this.recs = listRecordings();
    this.headerInfo.setText(`${this.recs.length} grabación(es)`);
    this.sel = 0; this.rowNodes = []; this.recScroll = 0;
    if (!this.recs.length) {
      this.content.add(this.add.text(w / 2, 140, 'Aún no has grabado combates.\nLucha y vuelve aquí.', { fontFamily: '"Press Start 2P"', fontSize: '9px', color: '#5a6a8a', align: 'center' }).setOrigin(0.5));
      this.recGrid = null;
      return;
    }
    // contenedor desplazable (antes: filas en y fijo dentro de content → no scrolleaba)
    this.recGrid = this.add.container(0, TOP); this.content.add(this.recGrid);
    this.recs.forEach((rec, i) => {
      const y = 8 + i * 34;
      const row = this.add.container(0, y);
      const bgr = this.add.rectangle(12, 0, w - 24, 30, 0x16161b, 1).setOrigin(0, 0).setStrokeStyle(2, 0x2a2a32);
      bgr.setInteractive({ useHandCursor: true }).on('pointerover', () => { this.sel = i; this.highlight(); }).on('pointerdown', () => this.playSelected());
      const a = (rec.titleA || '???').toUpperCase(), b = (rec.titleB || '???').toUpperCase();
      const title = this.add.text(22, 6, `${a}  vs  ${b}`, { fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#fff' });
      const meta = this.add.text(w - 22, 6, `${RESULT[rec.result] || '—'} · Piso ${rec.floor ?? '?'}`, { fontFamily: '"Press Start 2P"', fontSize: '7px', color: '#9fb0d0' }).setOrigin(1, 0);
      const play = this.add.text(22, 18, '▶ ver repetición', { fontFamily: '"Press Start 2P"', fontSize: '6px', color: '#54e0c8' });
      row.add([bgr, title, meta, play]);
      this.recGrid.add(row); this.rowNodes.push(bgr);
    });
    const viewH = h - TOP - 22;
    this.recMaxScroll = Math.max(0, this.recs.length * 34 + 8 - viewH);
    this.highlight();
  }
  moveSel(d) {
    if (!this.recs?.length) return;
    this.sel = Phaser.Math.Clamp(this.sel + d, 0, this.recs.length - 1);
    // desplazar el contenedor para que la fila seleccionada quede a la vista
    const rowY = 8 + this.sel * 34, viewH = VIEW.h - TOP - 22;
    if (rowY - this.recScroll < 0) this.recScroll = rowY;
    if (rowY - this.recScroll > viewH - 34) this.recScroll = rowY - viewH + 34;
    this.recScroll = Phaser.Math.Clamp(this.recScroll, 0, this.recMaxScroll || 0);
    if (this.recGrid) this.recGrid.y = TOP - this.recScroll;
    this.highlight();
  }
  highlight() { this.rowNodes?.forEach((r, i) => r.setFillStyle(i === this.sel ? 0x2c2c34 : 0x16161b).setStrokeStyle(2, i === this.sel ? 0xffffff : 0x2a2a32)); }

  applyMove(d) {
    if (this.mode === 'dex') this.moveDex({ up: -COLS, down: COLS, left: -1, right: 1 }[d]);
    else if (d === 'up') this.moveSel(-1);
    else if (d === 'down') this.moveSel(1);
  }

  playSelected() {
    const rec = this.recs?.[this.sel]; if (!rec) return;
    this.scene.pause();
    this.scene.launch('Battle', {
      replay: true, recording: rec,
      playerTeam: structuredClone(rec.teamA), enemyTeam: structuredClone(rec.teamB),
      biome: rec.biome, seed: rec.seed, floor: rec.floor, returnTo: 'Pokedex',
    });
    this.scene.bringToTop('Battle'); // que la repetición se vea sobre la Pokédex
  }

  update() {
    if (!this.gba) return;
    // pestañas: Q / E / L1 / R1
    if (this.gba.justDown('L')) return this.setMode('dex');
    if (this.gba.justDown('R')) return this.setMode('rec');
    const d = this.gba.dirJust();
    if (d && !this.detail) this.applyMove(d);
    // MANTENER PULSADO = scroll rápido (Pokédex y repeticiones tienen muchas entradas)
    const held = this.gba.dirHeld?.();
    if (held && !this.detail) {
      if (held !== this._holdDir) { this._holdDir = held; this._holdT = 0; this._holdR = 0; }
      else {
        const dt = this.game.loop.delta;
        this._holdT += dt;
        if (this._holdT > 300) { this._holdR += dt; if (this._holdR > 55) { this._holdR = 0; this.applyMove(held); } }
      }
    } else { this._holdDir = null; this._holdT = 0; this._holdR = 0; }
    if (this.gba.confirm()) {
      if (this.detail) { this.detail.destroy(true); this.detail = null; }
      else if (this.mode === 'rec') this.playSelected();
      else this.openSelected();
    } else if (this.gba.cancel()) {
      if (this.detail) { this.detail.destroy(true); this.detail = null; }
      else { this.scene.stop(); this.scene.resume(this.returnTo); }
    }
  }
}
