// BootScene — genera texturas procedurales, carga sprites cacheados y datos,
// luego pasa al título. Pre-genera el atlas en boot (evita tirones, A-10).
import Phaser from 'phaser';
import { loadLocale } from '../systems/i18n.js';
import { SPECIES } from '../../data/species.generated.js';
import { TRAINERS } from '../../data/trainers.generated.js';
import { FX_FILES } from '../../data/fx.js';
import { WALKMETA } from '../../data/walkmeta.generated.js';
import { OWMETA } from '../../data/owmeta.generated.js';
import { BALLS, HEALS, REPELS, FIELD, CONSUM } from '../../data/balls.js';
import { ITEMS } from '../../data/items.js';
import { SFX_KEYS, loadAudioSettings } from '../systems/audio.js';
import { REAL_TILE_BIOMES } from '../../data/tilemeta.generated.js';
import { MEGAS } from '../../data/megas.generated.js';

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    // sprites de Pokémon reales (cacheados localmente por fetch-sprites.mjs)
    for (const s of SPECIES) this.load.image('mon_' + s.id, s.sprite);
    for (const tr of TRAINERS) this.load.image('trainer_' + tr.id, tr.sprite);
    // FX reales de Showdown (tools/fetch-fx.mjs) + Poké Ball real (no procedural)
    for (const f of FX_FILES) this.load.image('fx_' + f, 'assets/fx/' + f + '.png');
    this.load.image('pokeball', 'assets/fx/pokeball.png');
    // sprites OFICIALES de objetos: todas las balls + curación (PokeAPI)
    for (const [k, v] of Object.entries({ ...BALLS, ...HEALS, ...REPELS, ...FIELD, ...CONSUM })) {
      this.load.image('item_' + k, 'assets/sprites/items/' + v.file + '.png');
    }
    // música REAL de Pokémon FireRed/LeafGreen (tools/fetch-firered.mjs):
    // exploración por bioma + combate + pantallas. CARGA PEREZOSA: cada pista se baja
    // la primera vez que se necesita (playBgm en audio.js), no las 17 al boot → arranque
    // mucho más rápido (~55MB menos) y sin saturar el decodificador de audio del navegador.
    // SFX de interfaz CC0 (Juhani Junkala) — sonidos al interactuar
    for (const k of SFX_KEYS) this.load.audio('sfx_' + k, 'assets/audio/sfx/' + k + '.wav');
    // props GBA reales (árbol/roca rompible, 4 frames 16x16)
    this.load.spritesheet('prop_tree', 'assets/sprites/ow/prop_tree.png', { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('prop_rock', 'assets/sprites/ow/prop_rock.png', { frameWidth: 16, frameHeight: 16 });
    // edificios EXTERIORES reales de FireRed (Spriters Resource, tools/crop_buildings.py)
    // para los pueblos procedurales de los pisos seguros
    for (const b of ['center', 'mart', 'gym', 'house_a', 'house_b', 'house_c', 'house_d']) {
      this.load.image('bld_' + b, 'assets/sprites/town/' + b + '.png');
    }
    // INTERIORES reales (al entrar a un edificio del pueblo)
    for (const b of ['int_center', 'int_mart']) this.load.image(b, 'assets/sprites/town/' + b + '.png');
    this.load.image('picnic_mat', 'assets/sprites/town/picnic_mat.png');   // mantel de picnic (intro)
    for (const b of ['oran-berry', 'sitrus-berry', 'pecha-berry']) {
      this.load.image('item_' + b.replace('-', ''), 'assets/sprites/items/' + b + '.png');
    }
    // OBJETOS equipables / bayas / discos / fenómeno (held, sprites por `file`)
    for (const [k, v] of Object.entries(ITEMS)) {
      if (!this.textures.exists('item_' + k)) this.load.image('item_' + k, 'assets/sprites/items/' + v.file + '.png');
    }
    // hojas de CAMINAR (PMD SpriteCollab, 8 direcciones por filas)
    for (const [id, m] of Object.entries(WALKMETA)) {
      this.load.spritesheet('walk_' + id, 'assets/sprites/walk/' + id + '.png', { frameWidth: m.fw, frameHeight: m.fh });
    }
    // chibis overworld del protagonista (pret/pokeemerald, 9 frames GBA)
    for (const [id, m] of Object.entries(OWMETA)) {
      this.load.spritesheet('ow_' + id, 'assets/sprites/ow/' + id + '.png', { frameWidth: m.fw, frameHeight: m.fh });
    }
    // TILES de BIOMA REALES (GBA, pret/pokeemerald, tools/fetch-tiles.py). Al
    // existir estas texturas con las claves `<bioma>_floor0`… registerBiomeTextures
    // sale temprano y NO genera las procedurales (texgen queda solo de fallback).
    for (const b of REAL_TILE_BIOMES) {
      const dir = 'assets/sprites/tiles/' + b + '/';
      for (let i = 0; i < 5; i++) { this.load.image(`${b}_floor${i}`, dir + `floor${i}.png`); this.load.image(`${b}_wall${i}`, dir + `wall${i}.png`); }
      for (const d of ['rock', 'crack', 'flora', 'crystal']) this.load.image(`${b}_decor_${d}`, dir + `decor_${d}.png`);
    }
    this.load.image('tallgrass', 'assets/sprites/tiles/_shared/tallgrass.png');  // hierba alta (zonas de encuentro)
    // sprites de FORMAS MEGA reales (PokeAPI, tools/fetch-megas.mjs)
    for (const [id, f] of Object.entries(MEGAS)) {
      if (f.dual) { this.load.image('mega_' + id + '_x', `assets/sprites/pokemon/mega_${id}_x.png`); this.load.image('mega_' + id + '_y', `assets/sprites/pokemon/mega_${id}_y.png`); }
      else this.load.image('mega_' + id, `assets/sprites/pokemon/mega_${id}.png`);
    }

    const g = this.add.graphics();
    this.load.on('progress', (p) => {
      g.clear().fillStyle(0x54e0c8, 1).fillRect(140, 178, 200 * p, 4);
    });
  }

  async create() {
    await loadLocale('es');
    loadAudioSettings();        // volumen guardado (Ajustes)
    this.scene.launch('Hud');   // HUD lateral persistente (equipo + cabina arcade)
    this.scene.start('Title');
  }
}
