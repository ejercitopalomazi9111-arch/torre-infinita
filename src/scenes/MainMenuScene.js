// MainMenuScene — menú principal que aparece tras el título cuando YA se jugó
// antes: Nueva Partida (3 ranuras), Cargar (3 ranuras), Ajustes y Créditos.
// Fondo vivo con Pokémon revoloteando + easter egg (toca al Umbreon → saltito+cry).
import Phaser from 'phaser';
import { VIEW, frameCamera } from '../main.js';
import { makeInput } from '../systems/input.js';
import { SPECIES } from '../../data/species.generated.js';
import { listSlots, loadRun, clearSave, factoryReset, setActiveSlot, getMeta, buyPerk, PERKS, getUnlockedAch, setNextDifficulty, DIFFICULTY } from '../systems/state.js';
import { ACHIEVEMENTS } from '../../data/achievements.js';
import { playBgm, sfx, playCry, getAudioSettings, setMusicVol, setSfxVol } from '../systems/audio.js';

const FONT = '"Press Start 2P"';
const STARTER_NAME = { 1: 'Bulbasaur', 4: 'Charmander', 7: 'Squirtle', 25: 'Pikachu', 152: 'Chikorita', 155: 'Cyndaquil', 158: 'Totodile' };

export class MainMenuScene extends Phaser.Scene {
  constructor() { super('MainMenu'); }

  create() {
    frameCamera(this);
    const { w, h } = VIEW;
    playBgm(this, 'bgm_title', 0.3);
    this.add.rectangle(0, 0, w, h, 0x0a0a14, 1).setOrigin(0).setDepth(-5);
    // degradado nocturno
    const g = this.add.graphics().setDepth(-4);
    for (let i = 0; i < h; i += 2) { const f = i / h; const c = Phaser.Display.Color.Interpolate.ColorWithColor(new Phaser.Display.Color(22, 20, 46), new Phaser.Display.Color(6, 8, 16), 100, f * 100); g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1).fillRect(0, i, w, 2); }
    this.spawnLiveBackground();

    this.add.text(w / 2, 30, 'TORRE INFINITA', { fontFamily: FONT, fontSize: '18px', color: '#ffd76a', stroke: '#05060a', strokeThickness: 5 }).setOrigin(0.5);
    this.add.text(w / 2, 50, '9111 pisos te esperan', { fontFamily: FONT, fontSize: '7px', color: '#9fb0d0' }).setOrigin(0.5);

    this.gba = makeInput(this);
    this.panel = this.add.container(0, 0).setDepth(10);
    this.state = 'main';
    this.cursor = 0;
    this.showMain();
    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  // ---- fondo vivo: Pokémon que cruzan + un Umbreon clicable (easter egg) ----
  spawnLiveBackground() {
    const { w, h } = VIEW;
    const ids = SPECIES.map(s => s.id).filter(id => this.textures.exists('mon_' + id));
    this.time.addEvent({ delay: 1600, loop: true, callback: () => {
      if (ids.length === 0) return;
      const id = Phaser.Utils.Array.GetRandom(ids), dir = Math.random() < 0.5 ? 1 : -1;
      const y = Phaser.Math.Between(70, h - 30);
      const m = this.add.image(dir > 0 ? -24 : w + 24, y, 'mon_' + id).setScale(0.7).setAlpha(0.5).setDepth(-1).setFlipX(dir < 0);
      this.tweens.add({ targets: m, x: dir > 0 ? w + 24 : -24, duration: Phaser.Math.Between(5000, 9000), onComplete: () => m.destroy() });
      this.tweens.add({ targets: m, y: y - 8, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    } });
    // EASTER EGG: Umbreon (197) en una esquina; al tocarlo, saltito + su cry
    if (this.textures.exists('mon_197')) {
      const umb = this.add.image(40, h - 36, 'mon_197').setScale(0.8).setDepth(2).setInteractive({ useHandCursor: true });
      this.tweens.add({ targets: umb, y: h - 40, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      umb.on('pointerdown', () => { playCry(this, 197); this.tweens.add({ targets: umb, y: umb.y - 22, scaleX: 0.9, scaleY: 0.7, duration: 200, yoyo: true, ease: 'Quad.out' }); });
    }
  }

  // ---- render de menús ----
  clearPanel() { this.panel.removeAll(true); this.rows = []; this.opts = []; }
  list(title, items, hint) {
    this.clearPanel();
    const { w } = VIEW;
    this.opts = items;
    this.cursor = Math.min(this.cursor, items.length - 1);
    this.panel.add(this.add.text(w / 2, 74, title, { fontFamily: FONT, fontSize: '9px', color: '#54e0c8' }).setOrigin(0.5));
    // espaciado adaptable: con muchas filas (p.ej. logros) se compacta para caber
    const many = items.length > 7;
    const y0 = many ? 90 : 100, dy = many ? Math.min(26, (VIEW.h - 110) / items.length) : 26;
    const fs = many ? '7px' : '8px', rh = many ? 16 : 22;
    items.forEach((it, i) => {
      const y = y0 + i * dy;
      const r = this.add.rectangle(w / 2, y, 320, rh, 0x141a2a, 0.92).setStrokeStyle(2, 0x2a3a5a);
      const tx = this.add.text(w / 2, y, it.label, { fontFamily: FONT, fontSize: fs, color: it.color || '#e8f6ff' }).setOrigin(0.5);
      r.setInteractive({ useHandCursor: true }).on('pointerover', () => { this.cursor = i; this.paint(); }).on('pointerdown', () => { sfx(this, 'select'); it.onPick && it.onPick(); });
      this.panel.add([r, tx]); this.rows.push(r);
    });
    this.hint = this.add.text(w / 2, VIEW.h - 14, hint || 'Flechas mover · Enter elegir · B atrás', { fontFamily: FONT, fontSize: '7px', color: '#5a6a8a' }).setOrigin(0.5);
    this.panel.add(this.hint);
    this.paint();
  }
  paint() { (this.rows || []).forEach((r, i) => r.setStrokeStyle(i === this.cursor ? 3 : 2, i === this.cursor ? 0xffd76a : 0x2a3a5a)); }

  showMain() {
    this.state = 'main';
    this.list('MENÚ PRINCIPAL', [
      { label: 'NUEVA PARTIDA', onPick: () => this.showSlots('new') },
      { label: 'CARGAR PARTIDA', onPick: () => this.showSlots('load') },
      { label: 'REPETICIONES', onPick: () => { this.scene.launch('Pokedex', { run: { dex: { seen: [], caught: [] } }, mode: 'rec', returnTo: 'MainMenu' }); this.scene.pause(); } },
      { label: 'MEJORAS', onPick: () => this.showPerks() },
      { label: 'LOGROS', onPick: () => this.showAchievements() },
      { label: 'AJUSTES', onPick: () => this.showSettings() },
      { label: 'CRÉDITOS', onPick: () => this.showCredits() },
    ]);
  }

  slotLabel(meta, i) {
    if (!meta) return `Ranura ${i + 1}: — vacía —`;
    return `Ranura ${i + 1}: ${STARTER_NAME[meta.starter] || 'Pokémon'} · Piso ${meta.floor}`;
  }

  showSlots(mode) {
    this.state = 'slots'; this.slotMode = mode;
    const slots = listSlots();
    const items = slots.map((meta, i) => ({
      label: this.slotLabel(meta, i),
      color: meta ? '#e8f6ff' : '#7a8398',
      onPick: () => {
        if (mode === 'load') { if (!meta) return sfx(this, 'error'); return this.startLoad(i); }
        // nueva: si la ranura tiene partida, confirmar sobrescritura
        if (meta) { this.confirmText = `¿Sobrescribir la ranura ${i + 1}?`; this.confirmFn = () => this.startNew(i); return this.showConfirm(); }
        this.startNew(i);
      },
    }));
    items.push({ label: '← Atrás', color: '#9fb0d0', onPick: () => this.showMain() });
    this.list(mode === 'new' ? 'NUEVA — elige ranura' : 'CARGAR — elige ranura', items);
  }

  startNew(slot) {
    // elige DIFICULTAD antes de empezar
    this.state = 'diff';
    const items = Object.entries(DIFFICULTY).map(([id, d]) => ({ label: d.name, color: id === 'nightmare' ? '#f08080' : id === 'hard' ? '#ffd76a' : '#e8f6ff', desc: d.desc, onPick: () => this.beginNew(slot, id) }));
    items.push({ label: '← Atrás', color: '#9fb0d0', onPick: () => this.showSlots('new') });
    this.list('ELIGE DIFICULTAD', items);
  }
  beginNew(slot, diff) {
    setActiveSlot(slot); clearSave(slot); setNextDifficulty(diff);
    this.registry.set('run', null);   // empezar limpio
    this.go('Intro', {});
  }
  startLoad(slot) {
    const fl = loadRun(this.registry, slot);
    if (!fl) return sfx(this, 'error');
    this.go('Floor', { seed: this.registry.get('run')?.seed, floor: fl });
  }

  showSettings() {
    this.state = 'settings';
    const a = getAudioSettings();
    this.music = a.music; this.sfxv = a.sfx;
    const bar = (v) => '[' + '█'.repeat(Math.round(v * 10)) + '·'.repeat(10 - Math.round(v * 10)) + ']';
    this.list('AJUSTES', [
      { label: `Música  ${bar(this.music)}`, onPick: () => {} },
      { label: `Sonidos ${bar(this.sfxv)}`, onPick: () => {} },
      { label: 'Borrar guardado (ranura)', onPick: () => this.showDelete() },
      { label: 'Reinicio de fábrica', color: '#f08080', onPick: () => this.showReset() },
      { label: '← Atrás', color: '#9fb0d0', onPick: () => this.showMain() },
    ], 'Música/Sonidos: ←/→ ajustan · Enter/B salir');
  }
  adjustSetting(delta) {
    if (this.state !== 'settings') return;
    if (this.cursor === 0) { this.music = Math.max(0, Math.min(1, this.music + delta)); setMusicVol(this.music, this); }
    else if (this.cursor === 1) { this.sfxv = Math.max(0, Math.min(1, this.sfxv + delta)); setSfxVol(this.sfxv); sfx(this, 'cursor'); }
    else return;
    this.showSettings();   // re-render barras (conserva cursor)
  }

  showDelete() {
    this.state = 'delete';
    const slots = listSlots();
    const items = slots.map((meta, i) => ({ label: this.slotLabel(meta, i), color: meta ? '#f0b0b0' : '#7a8398', onPick: () => { if (meta) { clearSave(i); sfx(this, 'back'); } this.showDelete(); } }));
    items.push({ label: '← Atrás', color: '#9fb0d0', onPick: () => this.showSettings() });
    this.list('BORRAR GUARDADO', items);
  }

  showReset() {
    // confirmación con OPERACIÓN matemática (elige la respuesta correcta)
    this.state = 'reset';
    const a = Phaser.Math.Between(3, 9), b = Phaser.Math.Between(2, 8), ans = a + b;
    const opts = Phaser.Utils.Array.Shuffle([ans, ans + Phaser.Math.Between(1, 3), ans - Phaser.Math.Between(1, 2)]);
    const items = opts.map(o => ({ label: `${o}`, onPick: () => {
      if (o === ans) { factoryReset(); sfx(this, 'levelup'); this.flashMsg('¡Todo borrado de fábrica!', () => this.scene.start('Title')); }
      else { sfx(this, 'error'); this.showReset(); }
    } }));
    items.push({ label: '← Cancelar', color: '#9fb0d0', onPick: () => this.showSettings() });
    this.list(`REINICIO: resuelve  ${a} + ${b} = ?`, items, 'Elige la respuesta correcta para confirmar');
  }

  showConfirm() {
    this.state = 'confirm';
    this.list(this.confirmText || '¿Seguro?', [
      { label: 'SÍ', color: '#f0b0b0', onPick: () => this.confirmFn && this.confirmFn() },
      { label: 'NO', color: '#9fb0d0', onPick: () => this.showSlots(this.slotMode) },
    ]);
  }

  showPerks() {
    this.state = 'perks';
    const m = getMeta();
    const items = Object.entries(PERKS).map(([id, p]) => {
      const lvl = m.perks[id] || 0, maxed = lvl >= p.max, cost = maxed ? 0 : p.cost(lvl);
      return {
        label: `${p.name}  ${'★'.repeat(lvl)}${'·'.repeat(p.max - lvl)}  ${maxed ? 'MÁX' : cost + 'pt'}`,
        color: maxed ? '#7fd9a0' : (m.points >= cost ? '#e8f6ff' : '#7a8398'),
        desc: p.desc,
        onPick: () => { if (!maxed && buyPerk(id)) sfx(this, 'coin'); else sfx(this, 'error'); this.showPerks(); },
      };
    });
    items.push({ label: '← Atrás', color: '#9fb0d0', onPick: () => this.showMain() });
    this.list(`MEJORAS — ${m.points} puntos`, items, 'Gana puntos jugando · Enter compra · B atrás');
  }

  showAchievements() {
    this.state = 'ach';
    const got = new Set(getUnlockedAch());
    const items = ACHIEVEMENTS.map(a => ({
      label: `${got.has(a.id) ? '🏆' : '🔒'} ${a.name}`,
      color: got.has(a.id) ? '#ffd76a' : '#7a8398',
      desc: got.has(a.id) ? a.desc : 'Bloqueado · ' + a.desc,
      onPick: () => { },
    }));
    items.push({ label: '← Atrás', color: '#9fb0d0', onPick: () => this.showMain() });
    this.list(`LOGROS — ${got.size}/${ACHIEVEMENTS.length}`, items);
  }

  showCredits() {
    this.state = 'credits';
    this.clearPanel();
    const { w, h } = VIEW;
    const lines = ['TORRE INFINITA', '', 'Un roguelike Pokémon de 9111 pisos.', '', 'Diseño y dirección: Mazi (Carlos)', 'Desarrollo: Mazi + Claude', 'Sprites: PokeAPI · pret/pokeemerald', 'Música/SFX: FireRed/LeafGreen', '', '¡Gracias por jugar!'];
    lines.forEach((l, i) => this.panel.add(this.add.text(w / 2, 86 + i * 20, l, { fontFamily: FONT, fontSize: l === 'TORRE INFINITA' ? '12px' : '8px', color: l === 'TORRE INFINITA' ? '#ffd76a' : '#e8f6ff' }).setOrigin(0.5)));
    this.panel.add(this.add.text(w / 2, h - 16, 'B / Enter: volver', { fontFamily: FONT, fontSize: '7px', color: '#5a6a8a' }).setOrigin(0.5));
    this.rows = []; this.opts = [];
  }

  flashMsg(text, cb) {
    const t = this.add.text(VIEW.w / 2, VIEW.h / 2, text, { fontFamily: FONT, fontSize: '10px', color: '#ffd76a', backgroundColor: '#05060ae0', padding: { x: 10, y: 8 } }).setOrigin(0.5).setDepth(100);
    this.time.delayedCall(900, () => { t.destroy(); cb && cb(); });
  }

  go(target, data) { if (this.went) return; this.went = true; this.cameras.main.fadeOut(300, 0, 0, 0); this.time.delayedCall(320, () => this.scene.start(target, data)); }

  update() {
    if (!this.gba || this.went) return;
    const d = this.gba.dirJust();
    if (this.state === 'credits') { if (this.gba.confirm() || this.gba.cancel()) this.showMain(); return; }
    if (d === 'up') { this.cursor = Math.max(0, this.cursor - 1); sfx(this, 'cursor'); this.paint(); }
    else if (d === 'down') { this.cursor = Math.min((this.opts?.length || 1) - 1, this.cursor + 1); sfx(this, 'cursor'); this.paint(); }
    else if (d === 'left') this.adjustSetting(-0.1);
    else if (d === 'right') this.adjustSetting(0.1);
    if (this.gba.confirm()) { const it = this.opts?.[this.cursor]; if (it?.onPick) { sfx(this, 'select'); it.onPick(); } }
    else if (this.gba.cancel()) {
      if (this.state === 'main') return;
      sfx(this, 'back');
      if (this.state === 'slots' || this.state === 'confirm') this.showMain();
      else if (this.state === 'settings') this.showMain();
      else if (this.state === 'delete' || this.state === 'reset') this.showSettings();
      else this.showMain();
    }
  }
}
