// FloorScene — exploración: render del piso, MOVIMIENTO POR CASILLAS estilo
// Pokémon clásico (D-pad GBA, correr con B), seguidores en cola sin solaparse
// (con deambular ocasional), encuentros por casilla, HUD y minimapa.
import Phaser from 'phaser';
import { t } from '../systems/i18n.js';
import { VIEW, frameCamera } from '../main.js';
import { generateFloor } from '../systems/tower/floorGen.js';
import { generateRoomTiles } from '../systems/tower/tileGen.js';
import { registerBiomeTextures } from '../systems/textureFactory.js';
import { SPECIES, SPECIES_BY_TYPE } from '../../data/species.generated.js';
import { LEGENDARY_IDS } from '../../data/legendaries.generated.js';
import { makeBattleMon } from '../systems/combat/battle.js';
import { canBreed, eggResult } from '../systems/pokemon/breeding.js';
import { getRun, saveRun, tryUnlock, diffOf } from '../systems/state.js';
import { playBgm, sfx } from '../systems/audio.js';
import { makeInput } from '../systems/input.js';
import { makeRNG } from '../engine/rng.js';
import { BIOME_PROPS } from '../../data/biomes.js';
import { WALKMETA } from '../../data/walkmeta.generated.js';
import { OWMETA } from '../../data/owmeta.generated.js';
import { BALLS, HEALS, REPELS, FIELD, CONSUM } from '../../data/balls.js';
import { HELD, BERRIES, DISCS, ITEMS, isHoldable } from '../../data/items.js';
import { abilityName } from '../../data/abilities.js';
import { MOVES } from '../../data/moves.js';
import { computeStats } from '../systems/pokemon/stats.js';
import { nextLearnableMove } from '../systems/combat/movepool.js';
import { pendingEvolution, evolveMon } from '../systems/pokemon/evolution.js';

const itemAny = (k) => BALLS[k] || HEALS[k] || REPELS[k] || FIELD[k] || CONSUM[k] || CONSUM[k] || ITEMS[k] || null;

// filas de la hoja PMD: 0=abajo 2=derecha 4=arriba 6=izquierda
const WALK_ROW = { down: 0, right: 2, up: 4, left: 6 };

const T = 32;
const COLS = 15, ROWS = 11;
const ROOM_W = COLS * T, ROOM_H = ROWS * T;
const WALK_MS = 260, RUN_MS = 140, BIKE_MS = 95;   // caminar · correr (B/◯) · BICI (rapidísima)
const DIRV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const OPP = { N: 'S', S: 'N', E: 'W', W: 'E', up: 'down', down: 'up', left: 'right', right: 'left' };
const ENERGETIC = new Set(['jolly', 'naive', 'hasty', 'naughty', 'brave', 'lonely']);

// legendarios/míticos + pseudolegendarios finales: NUNCA en encuentros al azar
// (solo en salas-puzzle súper raras del piso 20+, pendiente del roadmap)
// pseudolegendarios fuertes (no marcados "legendary" en PokeAPI pero igual de raros)
// + TODOS los legendarios/míticos reales (data-driven, Gen 1-9, ver legendaries.generated.js)
const PSEUDO_LEGENDS = [149, 248, 373, 376, 445];
const LEGENDS = new Set([...PSEUDO_LEGENDS, ...LEGENDARY_IDS]);
const BST = new Map(SPECIES.map(s => [s.id, Object.values(s.base).reduce((a, b) => a + b, 0)]));

// catálogo de la TIENDA de zona segura (pisos 5, 15, 25...)
const SHOP_STOCK = [
  ['pokeball', 200], ['superball', 600], ['quickball', 1000], ['duskball', 1000],
  ['potion', 300], ['superpotion', 700], ['hyperpotion', 1200], ['revive', 1500],
  ['repel', 350], ['superrepel', 500], ['maxrepel', 700], ['escaperope', 550],
  ['rarecandy', 4800], ['ether', 600], ['maxether', 1200], ['elixir', 1500], ['maxelixir', 3000],
  // equipables y bayas
  ['restos', 2000], ['bayazidra', 400], ['bayaaranja', 200], ['bayameloc', 300],
  ['cintaelegida', 2500], ['panueloelegido', 2500], ['vidasfera', 3000],
  ['megastone', 6000], ['zcrystal', 5000], ['maxiband', 5500],   // objetos de FENÓMENO (Mega / Z / Dinamax)
  ['huevo', 1200],   // CRIADERO: eclosiona en un Pokémon bebé al caminar
];

export class FloorScene extends Phaser.Scene {
  constructor() { super('Floor'); }

  init(data) {
    // SEMILLA de la partida: cada run es ÚNICA. Prioridad: la que pasa la escena
    // (al bajar de piso) → la guardada en el run → una nueva aleatoria. Se fija en
    // run.seed para que pisos y biomas sean reproducibles dentro de la MISMA run
    // (y al "Continuar"), pero distintos entre partidas.
    const run = this.registry.get('run');
    this.seedBase = data.seed ?? run?.seed ?? ('run-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e9).toString(36));
    if (run && !run.seed) run.seed = this.seedBase;
    this.floorNum = data.floor ?? 1;
    this.visited = new Set();
    // restart-safe: la escena se REUTILIZA al bajar de piso; limpiar referencias
    // a objetos del piso anterior (ya destruidos) o create() truena (piso 2 negro)
    this.hud = null; this.bagUI = null; this.teamUI = null; this.shopUI = null;
    this.props = []; this.pickups = []; this.followers = []; this.npcs = []; this.ponds = []; this.trainers = [];
    this.fishing = false;   // reset: si no, un cambio de escena durante la pesca lo dejaba trabado
    this.biking = false; this.bikeSprite = null;   // te bajas de la bici al cambiar de piso
    this.roamers = [];   // Pokémon corredores visibles (tocarlos = combate)
    this.holeTile = null; this.serviceTile = null;
    this.giveUpExplore = false; this.exploreStall = 0; this.floorSteps = 0; this.exploreFails = 0; this._lastVisited = 0;   // MODO DIOS tester
  }

  create() {
    frameCamera(this);
    this.floor = generateFloor(this.seedBase, this.floorNum);
    this.biome = this.floor.biome;
    registerBiomeTextures(this, this.biome);
    this.run = getRun(this.registry);

    this.worldLayer = this.add.container(0, 0);
    this.gba = makeInput(this);                  // control tipo GBA

    // jugador: CHIBI overworld animado (GBA real); fallback al arte completo
    const tr = this.registry.get('trainer');
    const om = tr && OWMETA[tr.id];
    if (om && this.textures.exists('ow_' + tr.id)) {
      this.chibi = tr.id;
      this.chibiMeta = om;
      this.player = this.add.sprite(ROOM_W / 2, ROOM_H / 2, 'ow_' + tr.id, 0).setOrigin(0.5, 0.8).setScale(2);
      if (om.frames >= 9) this.ensureOwAnims(tr.id);   // hojas de 3 frames: sin anim de caminar
    } else {
      this.chibi = null;
      this.player = this.add.image(ROOM_W / 2, ROOM_H / 2, this.textures.exists('trainer_' + (tr?.id)) ? 'trainer_' + tr.id : 'trainer_red').setOrigin(0.5, 0.8);
      this.player.setDisplaySize(30, 38);
    }
    this.baseSX = this.player.scaleX; this.baseSY = this.player.scaleY;
    this.facing = 'down'; this.stepping = false; this.idleTime = 0;

    this.followers = [];      // sprites de Pokémon que siguen en cola
    this.history = [];        // tiles recientes para la cola (history[k] = follower k)

    this.cameras.main.setBounds(0, 0, ROOM_W, ROOM_H);
    this.cameras.main.centerOn(ROOM_W / 2, ROOM_H / 2);

    this.encCooldown = 6;     // pasos antes de poder tener un encuentro
    this.input.keyboard.on('keydown-F', () => this.startEncounter());
    this.input.keyboard.on('keydown-P', () => this.openPokedex());
    this.input.keyboard.on('keydown-M', () => this.toggleBag());
    this.input.keyboard.on('keydown-T', () => this.toggleTeam());
    this.input.keyboard.on('keydown-I', () => this.toggleAuto());   // IA: juega sola
    this.botTimer = 0;
    // ESC: guardar y volver al MENÚ PRINCIPAL (la partida queda guardada)
    this.input.keyboard.on('keydown-ESC', () => {
      saveRun(this.registry, this.floorNum);
      this.cameras.main.fadeOut(250, 0, 0, 0);
      this.time.delayedCall(260, () => { this.scene.stop(); this.scene.start('MainMenu'); });
    });

    this.events.on('resume', () => {
      this.stepping = false; this.transitioning = false; this.fishing = false; this.encCooldown = 6; this.buildFollowers();
      saveRun(this.registry, this.floorNum);   // autosave tras cada combate/menú
      playBgm(this, this.exploreBgm(), 0.3);    // volver a la música del bioma
      const lost = !this.run.party.some(m => m.hp > 0);
      if (lost) { /* GameOver ya lo maneja BattleScene */ }
      // bug: si entraste a combate caminando, no te quedes en la anim de caminar
      if (this.chibi) { this.player.anims.stop(); this.player.setFrame(({ down: 0, up: 1, side: 2 })[this.animDir(this.facing)]); }
      this.cameras.main.fadeIn(200, 0, 0, 0);
      // si saliste del Poké Mart pidiendo comprar, abre la tienda del piso
      if (this.registry.get('pendingShop')) { this.registry.remove('pendingShop'); this.time.delayedCall(120, () => this.useService('shop')); }
    });

    this.buildRoom(this.floor.entranceId, null);
    this.buildHud();
    this.time.delayedCall(900, () => this.checkAch());   // logros de piso/equipo/dinero
    this.hudFade = this.time.delayedCall(2600, () => { if (this.hud?.active) this.tweens.add({ targets: this.hud, alpha: 0.35, duration: 500 }); });
    // piso 1: penumbra del fondo de la cueva (continuidad con la caída de la intro)
    if (this.floorNum === 1) this.add.rectangle(0, 0, ROOM_W, ROOM_H + 16, 0x14101f, 0.4).setOrigin(0).setDepth(5000).setScrollFactor(0);
    playBgm(this, this.exploreBgm(), 0.3);
    saveRun(this.registry, this.floorNum);   // autosave al pisar cada piso
    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  // música de exploración: pueblo seguro → tema de Centro Pokémon; si no, la del
  // bioma (data/biomes.js); fallback a Pallet Town si la pista no existe.
  exploreBgm() {
    if (this.floor?.isSafeFloor) return 'bgm_town';
    return this.biome?.music || 'bgm_explore';   // playBgm hace carga perezosa
  }

  // ---------- construir sala ----------
  buildRoom(roomId, fromDir) {
    this.currentRoomId = roomId;
    this.visited.add(roomId);
    this.exploreStall = 0;   // entramos a una sala nueva → el bot tester no está atascado
    if (this.registry.get('godtest') && typeof window !== 'undefined') {
      (window.__godtrail = window.__godtrail || []).push(roomId);
      if (window.__godtrail.length > 40) window.__godtrail.shift();
    }
    const room = this.floor.roomById.get(roomId);
    const tm = generateRoomTiles(room, this.biome, this.floor.seed);
    this.tilemap = tm;

    this.worldLayer.removeAll(true);
    const rt = this.add.renderTexture(0, 0, ROOM_W, ROOM_H).setOrigin(0, 0);
    const key = (id) => `${this.biome.id}_${id}`;
    const tmp = this.add.image(0, 0, key('floor0')).setOrigin(0, 0).setScale(2).setVisible(false);
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const cell = tm.cells[r][c], x = c * T, y = r * T;
      tmp.setTexture(key(cell.base === 'wall' ? 'wall' + cell.variant : 'floor' + cell.variant)).setPosition(x, y); rt.draw(tmp);
      if (cell.decor) { tmp.setTexture(key('decor_' + cell.decor)).setPosition(x, y); rt.draw(tmp); }
    }
    tmp.destroy();
    this.worldLayer.add(rt);
    this.spawnProps(room, tm);
    this.spawnAmbientCritters(room, tm);
    this.spawnTrainers(room, tm);

    // puertas: dir → sala destino
    this.doors = new Map(room.doors.map(d => [d.dir, d.to]));

    // sala de ESCALERAS: agujero de bajada estilo Mundo Misterioso en el centro
    this.holeTile = null;
    if (room.type === 'stairs') {
      const hc = (COLS / 2) | 0, hr = (ROWS / 2) | 0;
      this.holeTile = { c: hc, r: hr };
      const hp = this.tileCenter(hc, hr);
      const rim = this.add.ellipse(hp.x, hp.y + 2, 36, 24, 0x000000, 0.5).setDepth(45);
      const hole = this.add.ellipse(hp.x, hp.y + 3, 28, 17, 0x05060a, 1).setDepth(46);
      this.worldLayer.add(rim); this.worldLayer.add(hole);
      this.tweens.add({ targets: hole, scaleX: 1.1, scaleY: 1.15, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }

    // servicios. En ZONA SEGURA (piso 5/15/25…) el piso es un PUEBLO: cada servicio
    // lo atiende un NPC (chibi real), con gente de relleno; no hay marcador flotante
    // y NO aparecen Pokémon salvajes en todo el piso. En mazmorra: marcador clásico.
    this.serviceTile = null;
    this.npcs = [];
    if (this.floor.isSafeFloor) {
      this.buildTown(room);
    } else if (['shop', 'pokecenter', 'rest'].includes(room.type)) {
      const sc = (COLS / 2) | 0, sr = 3;
      this.serviceTile = { type: room.type, c: sc, r: sr };
      const sp2 = this.tileCenter(sc, sr);
      const tex = room.type === 'shop' ? 'item_pokeball' : room.type === 'pokecenter' ? 'item_healball' : 'item_sitrusberry';
      const mk = this.add.image(sp2.x, sp2.y - 6, tex).setScale(1.3);
      const lbl = { shop: 'TIENDA', pokecenter: 'CENTRO POKéMON', rest: 'DESCANSO' }[room.type];
      const lt = this.add.text(sp2.x, sp2.y - 28, lbl, { fontFamily: '"Press Start 2P"', fontSize: '6px', color: '#ffd76a', stroke: '#05060a', strokeThickness: 3 }).setOrigin(0.5);
      this.worldLayer.add(mk); this.worldLayer.add(lt);
      this.tweens.add({ targets: mk, y: sp2.y - 12, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }

    // JEFE: en pisos /10, la sala del jefe contiene un combate ÉPICO que lo guarda.
    this.bossTile = null;
    const bossKey = `boss:${this.floorNum}`;
    if (this.floor.isBossFloor && roomId === this.floor.bossId && !(this.run.found || []).includes(bossKey)) {
      const bc = (COLS / 2) | 0, br = (ROWS / 2) | 0;
      this.bossSpeciesId = this.pickBoss();
      this.bossTile = { c: bc, r: br };
      const bp = this.tileCenter(bc, br);
      const tx = this.textures.exists('mon_' + this.bossSpeciesId) ? 'mon_' + this.bossSpeciesId : 'item_pokeball';
      const mk = this.add.image(bp.x, bp.y - 4, tx).setScale(0.85).setTint(0x1a1a26).setDepth(48);
      this.tweens.add({ targets: mk, scaleX: 0.92, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      const lt = this.add.text(bp.x, bp.y - 34, this.isGuardian ? '¡GUARDIÁN!' : '¡JEFE!', { fontFamily: '"Press Start 2P"', fontSize: '8px', color: this.isGuardian ? '#ffd76a' : '#ff5a5a', stroke: '#05060a', strokeThickness: 3 }).setOrigin(0.5);
      this.tweens.add({ targets: lt, alpha: 0.3, duration: 500, yoyo: true, repeat: -1 });
      this.worldLayer.add(mk); this.worldLayer.add(lt);
    }

    // spawn en casilla
    let col = (COLS - 1) / 2 | 0, row = (ROWS - 1) / 2 | 0;
    if (fromDir) {
      const ed = OPP[fromDir];
      if (ed === 'N') { col = 7; row = 1; }
      else if (ed === 'S') { col = 7; row = ROWS - 2; }
      else if (ed === 'W') { col = 1; row = 5; }
      else if (ed === 'E') { col = COLS - 2; row = 5; }
    }
    this.col = col; this.row = row;
    const p = this.tileCenter(col, row);
    this.player.setPosition(p.x, p.y);
    // bug: no quedarse pegado en la anim de caminar al cambiar de sala/piso
    if (this.chibi) { this.player.anims.stop(); this.player.setFrame(({ down: 0, up: 1, side: 2 })[this.animDir(this.facing)]); }
    this.stepping = false; this.transitioning = false;

    this.buildFollowers();
    if (this.hud) this.refreshHud();
    // la barra superior tapa la pared norte: tras 2.6s se desvanece (vuelve al cambiar de sala)
    if (this.hud) {
      this.hud.setAlpha(1);
      this.hudFade?.remove();
      this.hudFade = this.time.delayedCall(2600, () => { if (this.hud?.active) this.tweens.add({ targets: this.hud, alpha: 0.35, duration: 500 }); });
    }
  }

  // ---------- PUEBLO (zonas seguras /5): NPCs reales + servicios ----------
  buildTown(room) {
    const rng = makeRNG(`${this.floor.seed}:town:${room.id}`);
    // gente del pueblo: chibis overworld REALES ya cacheados (regla de assets)
    const POOL = ['wattson', 'norman', 'steven', 'wallace', 'roxanne', 'brawly', 'flannery',
      'winona', 'phoebe', 'glacia', 'drake', 'sidney', 'maxie', 'archie', 'lyra', 'may',
      'dawn', 'serena', 'rosa', 'hilda', 'nate', 'calem'].filter(id => OWMETA[id] && this.textures.exists('ow_' + id));
    const FLAVOR = [
      '¡Bienvenido al pueblo de la Torre! Aquí no hay Pokémon salvajes.',
      'Dicen que la cima está a 9111 pisos... ¡mucha suerte, escalador!',
      'Equipa una CORREA a tu Pokémon (menú EQUIPO) para que te siga afuera.',
      'En la tienda venden bayas, objetos para llevar y discos. ¡Échales ojo!',
      'Descansa en la posada antes de seguir subiendo, viajero.',
      '¿Sabías? Algunas habilidades cambian cómo pega tu Pokémon en combate.',
      'Guarda en el PC a los que no uses; los debilitados no se curan ahí.',
      'Las evoluciones llegan subiendo de nivel. ¡A entrenar!',
    ];
    // NPC que atiende el SERVICIO de esta sala (tienda / centro / posada)
    const SERVICE_NPC = { shop: 'wattson', pokecenter: 'lyra', rest: 'serena' };
    const SERVICE_LINE = {
      shop: '¡Bienvenido a la tienda! ¿Qué te preparo?',
      pokecenter: 'Déjame curar a tu equipo. ¡Listo!',
      rest: '¿Una siesta para recuperar PS? Adelante.',
    };
    const safe = this.doorSafeTiles(room);
    this._corridor = safe;   // corredores de puerta: ni edificios ni NPCs los bloquean
    const SERVICE_BLD = { shop: 'mart', pokecenter: 'center', rest: 'house_a' };
    const mid = (COLS / 2) | 0;
    if (['shop', 'pokecenter', 'rest'].includes(room.type)) {
      // EDIFICIO real del servicio arriba-centro + su encargado en la puerta
      this.placeBuilding(mid, 2, SERVICE_BLD[room.type], safe);
      const id = OWMETA[SERVICE_NPC[room.type]] ? SERVICE_NPC[room.type] : (POOL[0] || 'red');
      this.spawnNpc(mid, 3, id, room.type, SERVICE_LINE[room.type]);
    } else {
      // pueblo "normal": casas reales a los lados (sin tapar puertas)
      const HOUSES = ['house_a', 'house_b', 'house_c', 'house_d'];
      const pickH = () => HOUSES[Math.floor(rng.float() * HOUSES.length)];
      this.placeBuilding(3, 3, pickH(), safe);
      this.placeBuilding(COLS - 4, 3, pickH(), safe);
      if (rng.float() < 0.45) this.placeBuilding(mid, 2, 'gym', safe);
    }
    // CLUB DE BATALLA ONLINE — en CADA pueblo hay un encargado que abre el modo
    // online P2P (comerciar / PVP con un amigo por código de sala). Se le habla con A.
    let clubCell = this.freeTownCell(rng);
    if (!clubCell) {   // respaldo: primera casilla fija válida
      for (const [c, r] of [[COLS - 3, 6], [3, 6], [COLS - 3, 4], [3, 4]]) {
        const cell = this.tilemap.cells?.[r]?.[c];
        if (cell && cell.base === 'floor' && !cell.blocked && !this._corridor?.has(c + ',' + r)) { clubCell = { c, r }; break; }
      }
    }
    if (clubCell) {
      const clubId = (OWMETA['wallace'] && this.textures.exists('ow_wallace')) ? 'wallace' : (POOL[0] || 'red');
      this.spawnNpc(clubCell.c, clubCell.r, clubId, 'club', '¡Bienvenido al Club de Batalla! Conéctate con un amigo para comerciar o luchar online.');
      const cp = this.tileCenter(clubCell.c, clubCell.r);
      const tag = this.add.text(cp.x, cp.y - 30, '⚔ CLUB', { fontFamily: '"Press Start 2P"', fontSize: '6px', color: '#ffd76a', stroke: '#05060a', strokeThickness: 3 }).setOrigin(0.5).setDepth(60 + cp.y);
      this.worldLayer.add(tag);
      this.tweens.add({ targets: tag, y: cp.y - 36, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }

    // CRIADERO — en cada pueblo hay un Criador: deja a DITTO + otro Pokémon (o dos de
    // la misma familia) y te entrega un HUEVO que eclosiona caminando. Se le habla con A.
    const breedCell = this.freeTownCell(rng);
    if (breedCell) {
      const breederId = (OWMETA['daisy'] && this.textures.exists('ow_daisy')) ? 'daisy' : (POOL[0] || 'red');
      this.spawnNpc(breedCell.c, breedCell.r, breederId, 'criadero', '¡Hola! Soy el Criador. Tráeme a Ditto con otro Pokémon (o dos de la misma familia) y te consigo un Huevo.');
      const bp = this.tileCenter(breedCell.c, breedCell.r);
      const btag = this.add.text(bp.x, bp.y - 30, '🥚 CRIADERO', { fontFamily: '"Press Start 2P"', fontSize: '6px', color: '#9fd97f', stroke: '#05060a', strokeThickness: 3 }).setOrigin(0.5).setDepth(60 + bp.y);
      this.worldLayer.add(btag);
      this.tweens.add({ targets: btag, y: bp.y - 36, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }

    // vecinos de relleno repartidos por la sala (vida del pueblo)
    const nFlavor = 1 + Math.floor(rng.float() * 3);
    for (let i = 0; i < nFlavor; i++) {
      const cell = this.freeTownCell(rng);
      if (!cell) break;
      const id = POOL.length ? POOL[Math.floor(rng.float() * POOL.length)] : 'red';
      this.spawnNpc(cell.c, cell.r, id, null, FLAVOR[Math.floor(rng.float() * FLAVOR.length)]);
    }
  }

  /** Casilla de suelo libre para un NPC (lejos del spawn central, sin solapar). */
  freeTownCell(rng) {
    for (let t = 0; t < 30; t++) {
      const c = 2 + Math.floor(rng.float() * (COLS - 4));
      const r = 2 + Math.floor(rng.float() * (ROWS - 4));
      const cell = this.tilemap.cells[r][c];
      if (cell.base !== 'floor' || cell.blocked) continue;
      if (Math.abs(c - 7) <= 1 && Math.abs(r - 5) <= 1) continue;   // no tapar el spawn
      if (this._corridor?.has(c + ',' + r)) continue;               // no tapar corredores de puerta
      if (this.npcs.some(n => n.c === c && n.r === r)) continue;
      return { c, r };
    }
    return null;
  }

  /** Crea un NPC chibi en una casilla (bloquea el paso; se habla con A de frente). */
  spawnNpc(c, r, owId, role, line) {
    if (!this.inBounds(c, r)) return;
    const pos = this.tileCenter(c, r);
    let sprite;
    if (OWMETA[owId] && this.textures.exists('ow_' + owId)) {
      sprite = this.add.sprite(pos.x, pos.y, 'ow_' + owId, 0).setOrigin(0.5, 0.8).setScale(2);
    } else if (this.textures.exists('trainer_' + owId)) {
      sprite = this.add.image(pos.x, pos.y, 'trainer_' + owId).setOrigin(0.5, 0.8).setDisplaySize(26, 30);
    } else {
      sprite = this.add.image(pos.x, pos.y, 'item_pokeball').setOrigin(0.5, 0.8).setScale(1);
    }
    sprite.setDepth(50 + pos.y);
    this.worldLayer.add(sprite);
    // bloquea el paso salvo en un corredor de puerta (ahí el NPC sigue ahí y se le
    // habla, pero NO tapona el camino a la puerta → evita pueblos sin salida)
    if (this.tilemap?.cells?.[r]?.[c] && !this._corridor?.has(c + ',' + r)) this.tilemap.cells[r][c].blocked = true;
    if (role) {
      const lbl = { shop: 'TIENDA', pokecenter: 'CENTRO', rest: 'POSADA' }[role] || '';
      const lt = this.add.text(pos.x, pos.y - 30, lbl, { fontFamily: '"Press Start 2P"', fontSize: '6px', color: '#ffd76a', stroke: '#05060a', strokeThickness: 3 }).setOrigin(0.5).setDepth(70 + pos.y);
      this.worldLayer.add(lt);
    }
    this.tweens.add({ targets: sprite, y: pos.y - 2, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.npcs.push({ c, r, sprite, role, line });
  }

  /** Coloca un edificio exterior real anclado por su base; bloquea su huella
   *  pero NUNCA las casillas protegidas (puertas/corredores) → sin softlocks. */
  placeBuilding(centerCol, baseRow, key, protect) {
    const tex = 'bld_' + key;
    if (!this.textures.exists(tex)) return null;
    const src = this.textures.get(tex).getSourceImage();
    const pos = this.tileCenter(centerCol, baseRow);
    const baseY = pos.y + T / 2;                       // pegado al borde inferior de la casilla
    const img = this.add.image(pos.x, baseY, tex).setOrigin(0.5, 1).setDepth(50 + baseY);
    this.worldLayer.add(img);
    const hw = Math.round((src.width / 2) / T);
    const tall = Math.ceil(src.height / T);
    for (let r = baseRow - tall + 1; r <= baseRow; r++) {
      for (let c = centerCol - hw; c <= centerCol + hw; c++) {
        if (protect?.has(c + ',' + r)) continue;       // deja libres puertas/corredores
        if (this.tilemap?.cells?.[r]?.[c]) this.tilemap.cells[r][c].blocked = true;
      }
    }
    this.props.push(img);
    return img;
  }

  /** Casillas que NUNCA deben bloquearse (cada puerta + su corredor de entrada). */
  doorSafeTiles(room) {
    // Protege el CORREDOR COMPLETO de cada puerta hasta el centro (7,5): así toda
    // puerta conecta con la cruz central y, por tanto, con las demás puertas. Antes
    // solo se protegían 3 casillas y un edificio podía partir la sala dejando una
    // puerta (¡a veces la de las escaleras!) inalcanzable → pueblo encajonado.
    const cc = 7, cr = 5;   // centro lógico de la sala
    const set = new Set();
    const line = (c0, r0, c1, r1) => {
      const dc = Math.sign(c1 - c0), dr = Math.sign(r1 - r0);
      let c = c0, r = r0;
      set.add(c + ',' + r);
      while (c !== c1 || r !== r1) { c += dc; r += dr; set.add(c + ',' + r); }
    };
    for (const d of (room.doors || [])) {
      if (d.dir === 'N') line(cc, 0, cc, cr);
      else if (d.dir === 'S') line(cc, ROWS - 1, cc, cr);
      else if (d.dir === 'W') line(0, cr, cc, cr);
      else if (d.dir === 'E') line(COLS - 1, cr, cc, cr);
    }
    return set;
  }

  /** Interacción con el NPC de enfrente (A): servicio o diálogo de sabor. */
  talkToNpc() {
    const [fdx, fdy] = DIRV[this.facing];
    const npc = this.npcs?.find(n => n.c === this.col + fdx && n.r === this.row + fdy);
    if (!npc) return false;
    if (npc.role === 'criadero') this.openCriadero();   // CRIADERO: cría con Ditto (no es interior)
    else if (npc.role) this.enterBuilding(npc.role);     // ENTRAR al edificio (interior real)
    else this.toast(npc.line);
    return true;
  }

  // ---------- seguidores (cola sin solaparse) ----------
  buildFollowers() {
    for (const f of this.followers) f.sprite.destroy();
    this.followers = [];
    const [dx, dy] = DIRV[OPP[this.facing] || 'up'];   // hacia atrás del jugador
    this.history = [];
    // SOLO siguen los que llevan CORREA y están sanos (un K.O. no te sigue)
    const team = (this.run?.party || []).filter(m => m.correa && m.hp > 0).slice(0, 6);
    team.forEach((mon, k) => {
      // casilla detrás, k+1 pasos; si no es válida, se apila en la última válida
      let c = this.col + dx * (k + 1), r = this.row + dy * (k + 1);
      if (!this.inBounds(c, r)) { c = this.col; r = this.row; }
      this.history[k] = { col: c, row: r };
      const pos = this.tileCenter(c, r);
      // con hoja de caminar PMD → sprite ANIMADO; si no, imagen estática + saltito
      const meta = WALKMETA[mon.speciesId];
      let sprite, animated = false;
      if (meta && this.textures.exists('walk_' + mon.speciesId)) {
        this.ensureWalkAnims(mon.speciesId, meta);
        sprite = this.add.sprite(pos.x, pos.y, 'walk_' + mon.speciesId, 0).setOrigin(0.5, 0.8);
        sprite.setScale((T * 0.95) / meta.fh);
        animated = true;
      } else {
        sprite = this.add.image(pos.x, pos.y, 'mon_' + mon.speciesId).setScale(0.62).setOrigin(0.5, 0.72);
      }
      const canWander = ENERGETIC.has(mon.nature) || (mon.speciesId % 4 === 0);
      this.followers.push({ sprite, mon, meta, animated, homeX: pos.x, homeY: pos.y, canWander, wandering: false });
    });
    this.updateDepths();
  }

  // ---------- MOCHILA en el overworld (tecla M) ----------
  toggleBag() {
    if (this.transitioning) return;
    if (this.bagUI) return this.closeBag();
    const { w, h } = VIEW;
    const c = this.add.container(0, 0).setDepth(200000).setScrollFactor(0);
    // layout estilo FRLG (cinta de título + objeto grande + lista + franja de
    // descripción con icono) pero con la paleta ORIGINAL del juego
    c.add(this.add.rectangle(0, 0, w, h, 0x05060a, 0.94).setOrigin(0));
    c.add(this.add.rectangle(14, 12, 150, 22, 0x141a2a, 1).setOrigin(0).setStrokeStyle(2, 0xffd76a));
    c.add(this.add.text(24, 18, 'MOCHILA', { fontFamily: '"Press Start 2P"', fontSize: '10px', color: '#ffd76a' }));
    // marco izquierdo: el objeto seleccionado en grande
    c.add(this.add.rectangle(28, 80, 130, 130, 0x141a2a, 1).setOrigin(0).setStrokeStyle(2, 0x2a3a5a));
    this.bagBig = this.add.image(93, 145, 'item_pokeball').setScale(2.8);
    c.add(this.bagBig);
    // lista derecha con cursor ▶ rojo clásico
    const lx = 180, lw = w - lx - 16;
    c.add(this.add.rectangle(lx, 44, lw, h - 134, 0x141a2a, 1).setOrigin(0).setStrokeStyle(2, 0x2a3a5a));
    // la mochila muestra balls/curación; los objetos equipables/discos van por el menú Pokémon (T)
    this.bagKeys = Object.keys(this.run.bag).filter(k => this.run.bag[k] > 0 && (BALLS[k] || HEALS[k] || REPELS[k] || FIELD[k] || CONSUM[k]));
    this.bagCursor = Math.max(0, Math.min(this.bagCursor || 0, this.bagKeys.length - 1));
    this.bagRows = []; this.bagCurs = [];
    this.bagKeys.forEach((k, i) => {
      const y = 56 + i * 17;
      const info = BALLS[k] || HEALS[k] || REPELS[k] || FIELD[k] || CONSUM[k];
      const cur = this.add.text(lx + 8, y, '▶', { fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#c03028' });
      const t = this.add.text(lx + 22, y, info?.name || k, { fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#e8f6ff' });
      const q = this.add.text(lx + lw - 10, y, 'x' + this.run.bag[k], { fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#9fb0d0' }).setOrigin(1, 0);
      c.add([cur, t, q]); this.bagRows.push(t); this.bagCurs.push(cur);
    });
    // franja inferior: icono + descripción
    c.add(this.add.rectangle(14, h - 78, w - 28, 56, 0x141a2a, 1).setOrigin(0).setStrokeStyle(2, 0xffd76a));
    this.bagIcon = this.add.image(42, h - 50, 'item_pokeball').setScale(1.5);
    c.add(this.bagIcon);
    this.bagDesc = this.add.text(68, h - 70, '', { fontFamily: '"Press Start 2P"', fontSize: '7px', color: '#e8f6ff', wordWrap: { width: w - 122 }, lineSpacing: 5 });
    c.add(this.bagDesc);
    c.add(this.add.text(w / 2, h - 12, 'A usar · B/M cerrar', { fontFamily: '"Press Start 2P"', fontSize: '7px', color: '#5a6a8a' }).setOrigin(0.5));
    this.bagUI = c;
    this.paintBag();
  }

  paintBag() {
    this.bagRows.forEach((t, i) => t.setColor(i === this.bagCursor ? '#ffd76a' : '#e8f6ff'));
    this.bagCurs.forEach((cu, i) => cu.setVisible(i === this.bagCursor));
    const k = this.bagKeys[this.bagCursor];
    const info = BALLS[k] || HEALS[k] || REPELS[k] || FIELD[k] || CONSUM[k];
    this.bagDesc?.setText(info?.desc || '');
    if (this.textures.exists('item_' + k)) { this.bagBig.setTexture('item_' + k); this.bagIcon.setTexture('item_' + k); }
  }

  closeBag() { this.bagUI?.destroy(true); this.bagUI = null; }

  // ---------- EQUIPO / OBJETOS / DISCOS / CORREA / PC (tecla T) ----------
  toggleTeam() {
    if (this.transitioning) return;
    if (this.teamUI) return this.closeTeam();
    this.teamState = 'list'; this.teamCursor = 0; this.teamSel = 0; this.teamPick = -1;
    this.renderTeam();
  }
  closeTeam() { this.teamUI?.destroy(true); this.teamUI = null; this.teamState = null; }

  TX(c, x, y, s, size = 8, color = '#e8f6ff', o) { const t = this.add.text(x, y, s, { fontFamily: '"Press Start 2P"', fontSize: size + 'px', color }); if (o) t.setOrigin(...o); c.add(t); return t; }

  renderTeam() {
    this.teamUI?.destroy(true);
    const { w, h } = VIEW;
    const c = this.add.container(0, 0).setDepth(200000).setScrollFactor(0);
    c.add(this.add.rectangle(0, 0, w, h, 0x05060a, 0.95).setOrigin(0));
    c.add(this.add.rectangle(14, 12, w - 28, 22, 0x141a2a, 1).setOrigin(0).setStrokeStyle(2, 0xffd76a));
    const titles = { list: this.teamPick >= 0 ? 'EQUIPO · elige destino' : 'EQUIPO', action: '¿QUÉ HACER?', pickitem: 'EQUIPAR OBJETO', pickdisc: 'USAR DISCO', pc: 'CAJA PC' };
    this.TX(c, 24, 18, titles[this.teamState] || 'EQUIPO', 9, '#ffd76a');
    this.teamUI = c; this.teamRows = [];
    if (this.teamState === 'list') this.renderTeamList(c);
    else if (this.teamState === 'action') this.renderTeamAction(c);
    else if (this.teamState === 'pickitem' || this.teamState === 'pickdisc') this.renderPicker(c);
    else if (this.teamState === 'pc') this.renderPC(c);
    this.paintTeam();
  }

  renderTeamList(c) {
    const { w, h } = VIEW;
    this.run.party.forEach((m, i) => {
      const y = 58 + i * 38;
      const row = this.add.rectangle(18, y, w - 36, 34, 0x141a2a, 1).setOrigin(0, 0.5).setStrokeStyle(2, 0x2a3a5a);
      c.add(row);
      c.add(this.add.image(40, y, 'mon_' + m.speciesId).setDisplaySize(28, 28));
      // ball de CAPTURA (sprite real) junto al nombre
      const bk = 'item_' + (m.ball || 'pokeball');
      if (this.textures.exists(bk)) c.add(this.add.image(w - 44, y + 9, bk).setScale(0.7));
      this.TX(c, 60, y - 13, `${m.name.toUpperCase()} Nv${m.level}`, 8, '#e8f6ff');
      this.TX(c, 60, y - 2, `${m.hp}/${m.maxhp}PS${m.hp <= 0 ? ' K.O.' : ''}`, 7, m.hp > 0 ? '#9fb0d0' : '#c05050');
      const tags = [m.correa ? 'CORREA' : 'sin correa'];
      if (m.item) tags.push(ITEMS[m.item]?.name || m.item);
      this.TX(c, 60, y + 9, tags.join(' · '), 6, m.correa ? '#9fd97f' : '#5a6a8a');
      this.TX(c, w - 26, y - 11, abilityName(m.ability), 7, '#ffd76a', [1, 0]);
      this.teamRows.push(row);
    });
    const py = 58 + this.run.party.length * 38;
    const pc = this.add.rectangle(18, py, w - 36, 26, 0x14202c, 1).setOrigin(0, 0.5).setStrokeStyle(2, 0x2a3a5a);
    c.add(pc); this.TX(c, 36, py - 5, 'CAJA PC  (guardar / sacar)', 8, '#7fd9c8');
    this.teamRows.push(pc);
    this.TX(c, w / 2, h - 12, this.teamPick >= 0 ? 'A intercambiar · B cancelar' : 'A elegir · B cerrar', 7, '#5a6a8a', [0.5, 0.5]);
  }

  renderTeamAction(c) {
    const { w, h } = VIEW;
    const m = this.run.party[this.teamSel];
    c.add(this.add.image(46, 64, 'mon_' + m.speciesId).setDisplaySize(40, 40));
    this.TX(c, 76, 52, `${m.name.toUpperCase()} Nv${m.level}`, 9, '#e8f6ff');
    this.TX(c, 76, 66, `Hab: ${abilityName(m.ability)}`, 7, '#ffd76a');
    this.TX(c, 76, 78, `Obj: ${m.item ? (ITEMS[m.item]?.name || m.item) : '—'}`, 7, '#9fb0d0');
    this.actItems = [
      { label: `Correa: ${m.correa ? 'SÍ' : 'NO'}  (que te siga)`, fn: () => { m.correa = !m.correa; this.buildFollowers(); this.renderTeam(); } },
      { label: m.item ? `Quitar objeto (${ITEMS[m.item]?.name})` : 'Equipar objeto', fn: () => { if (m.item) { this.run.bag[m.item] = (this.run.bag[m.item] || 0) + 1; m.item = null; this.renderTeam(); } else { this.teamState = 'pickitem'; this.teamCursor = 0; this.renderTeam(); } } },
      { label: 'Usar disco de habilidad', fn: () => { this.teamState = 'pickdisc'; this.teamCursor = 0; this.renderTeam(); } },
      { label: 'Mover de lugar', fn: () => { this.teamPick = this.teamSel; this.teamState = 'list'; this.teamCursor = this.teamSel; this.renderTeam(); } },
      { label: 'Enviar a la Caja PC', fn: () => this.depositMon(this.teamSel) },
      { label: 'Volver', fn: () => { this.teamState = 'list'; this.teamCursor = this.teamSel; this.renderTeam(); } },
    ];
    this.actItems.forEach((it, i) => {
      const y = 104 + i * 26;
      const row = this.add.rectangle(18, y, w - 36, 22, 0x141a2a, 1).setOrigin(0, 0.5).setStrokeStyle(2, 0x2a3a5a);
      c.add(row); this.TX(c, 34, y - 5, it.label, 8, '#e8f6ff');
      this.teamRows.push(row);
    });
    this.TX(c, w / 2, h - 12, 'A confirmar · B atrás', 7, '#5a6a8a', [0.5, 0.5]);
  }

  renderPicker(c) {
    const { w, h } = VIEW;
    const disc = this.teamState === 'pickdisc';
    this.pickKeys = Object.keys(this.run.bag).filter(k => this.run.bag[k] > 0 && (disc ? DISCS[k] : isHoldable(k)));
    if (!this.pickKeys.length) {
      this.pickDesc = null;   // si no, paintTeam usa un texto YA DESTRUIDO → excepción cada frame (congelado)
      this.TX(c, w / 2, h / 2 - 10, disc ? 'No tienes discos.' : 'No tienes objetos equipables.', 8, '#9fb0d0', [0.5, 0.5]);
      this.TX(c, w / 2, h - 12, 'B atrás', 7, '#5a6a8a', [0.5, 0.5]);
      return;
    }
    this.pickKeys.forEach((k, i) => {
      const y = 58 + i * 22;
      const row = this.add.rectangle(18, y, w - 36, 20, 0x141a2a, 1).setOrigin(0, 0.5).setStrokeStyle(2, 0x2a3a5a);
      c.add(row);
      if (this.textures.exists('item_' + k)) c.add(this.add.image(36, y, 'item_' + k).setScale(0.7));
      this.TX(c, 52, y - 5, `${ITEMS[k].name}  x${this.run.bag[k]}`, 8, '#e8f6ff');
      this.teamRows.push(row);
    });
    this.pickDesc = this.TX(c, 18, h - 40, '', 7, '#9fb0d0');
    this.pickDesc.setWordWrapWidth(w - 36);
    this.TX(c, w / 2, h - 12, 'A elegir · B atrás', 7, '#5a6a8a', [0.5, 0.5]);
  }

  renderPC(c) {
    const { w, h } = VIEW;
    this.TX(c, 20, 44, 'EQUIPO', 8, '#ffd76a'); this.TX(c, w / 2 + 10, 44, 'CAJA', 8, '#7fd9c8');
    this.pcParty = this.run.party; this.pcBox = this.run.box || (this.run.box = []);
    this.pcPartyRows = []; this.pcBoxRows = [];
    this.pcParty.forEach((m, i) => {
      const y = 62 + i * 24;
      const row = this.add.rectangle(16, y, w / 2 - 24, 22, 0x141a2a, 1).setOrigin(0, 0.5).setStrokeStyle(2, 0x2a3a5a);
      c.add(row); c.add(this.add.image(30, y, 'mon_' + m.speciesId).setDisplaySize(18, 18));
      this.TX(c, 44, y - 5, `${m.name.toUpperCase()}`, 7, m.hp > 0 ? '#e8f6ff' : '#c05050');
      this.pcPartyRows.push(row);
    });
    if (!this.pcBox.length) this.TX(c, w / 2 + 10, 64, '(vacía)', 7, '#5a6a8a');
    this.pcBox.forEach((m, i) => {
      const y = 62 + i * 24;
      const row = this.add.rectangle(w / 2 + 8, y, w / 2 - 24, 22, 0x141a2a, 1).setOrigin(0, 0.5).setStrokeStyle(2, 0x2a3a5a);
      c.add(row); c.add(this.add.image(w / 2 + 22, y, 'mon_' + m.speciesId).setDisplaySize(18, 18));
      this.TX(c, w / 2 + 36, y - 5, `${m.name.toUpperCase()}`, 7, '#e8f6ff');
      this.pcBoxRows.push(row);
    });
    this.pcCol = this.pcCol || 'party'; this.pcCursor = 0;
    this.TX(c, w / 2, h - 12, 'Izq/Der cambiar lado · A guardar/sacar · B salir', 6, '#5a6a8a', [0.5, 0.5]);
    this.paintPC();
  }

  paintPC() {
    const rows = this.pcCol === 'party' ? this.pcPartyRows : this.pcBoxRows;
    this.pcCursor = Math.max(0, Math.min(this.pcCursor, Math.max(0, rows.length - 1)));
    this.pcPartyRows?.forEach((r, i) => r.setStrokeStyle(this.pcCol === 'party' && i === this.pcCursor ? 3 : 2, this.pcCol === 'party' && i === this.pcCursor ? 0xffd76a : 0x2a3a5a));
    this.pcBoxRows?.forEach((r, i) => r.setStrokeStyle(this.pcCol === 'box' && i === this.pcCursor ? 3 : 2, this.pcCol === 'box' && i === this.pcCursor ? 0x7fd9c8 : 0x2a3a5a));
  }

  depositMon(idx) {
    const p = this.run.party;
    if (p.length <= 1) return this.toast('No puedes guardar tu último Pokémon.');
    const after = p.filter((_, i) => i !== idx);
    if (!after.some(m => m.hp > 0)) return this.toast('Te quedarías sin Pokémon en pie.');
    const [m] = p.splice(idx, 1);
    (this.run.box || (this.run.box = [])).push(m);
    this.buildFollowers();                 // si tenía correa, deja de seguirte
    this.toast(`${m.name.toUpperCase()} fue a la Caja PC.`);
    this.teamState = 'list'; this.teamCursor = 0; this.renderTeam();
  }

  withdrawMon(idx) {
    if (this.run.party.length >= 6) return this.toast('Tu equipo está lleno (6).');
    const [m] = this.run.box.splice(idx, 1);
    this.run.party.push(m);
    this.buildFollowers();
    this.toast(`${m.name.toUpperCase()} se unió al equipo.`);
    this.renderTeam();
  }

  paintTeam() {
    if (this.teamState === 'pc') return;
    let descKeys = null;
    if (this.teamState === 'pickitem' || this.teamState === 'pickdisc') descKeys = this.pickKeys || [];
    this.teamRows.forEach((r, i) => {
      const on = i === this.teamCursor, picked = (this.teamState === 'list' && i === this.teamPick);
      r.setStrokeStyle(on || picked ? 3 : 2, picked ? 0x54e0c8 : on ? 0xffd76a : 0x2a3a5a);
    });
    if (descKeys && descKeys.length && this.pickDesc?.active) { const k = descKeys[this.teamCursor]; this.pickDesc.setText(ITEMS[k]?.desc || ''); }
  }

  /** Acciones del menú EQUIPO según el estado (llamado desde update). */
  teamConfirm() {
    const st = this.teamState;
    if (st === 'list') {
      const isPC = this.teamCursor === this.run.party.length;
      if (this.teamPick >= 0) {
        if (isPC) { this.teamPick = -1; this.renderTeam(); return; }
        const p = this.run.party; [p[this.teamPick], p[this.teamCursor]] = [p[this.teamCursor], p[this.teamPick]];
        this.teamPick = -1; this.buildFollowers(); this.renderTeam(); return;
      }
      if (isPC) { this.teamState = 'pc'; this.pcCol = 'party'; this.pcCursor = 0; this.renderTeam(); return; }
      this.teamSel = this.teamCursor; this.teamState = 'action'; this.teamCursor = 0; this.renderTeam(); return;
    }
    if (st === 'action') { this.actItems[this.teamCursor]?.fn(); return; }
    if (st === 'pickitem') {
      const k = this.pickKeys[this.teamCursor]; if (!k) return;
      const m = this.run.party[this.teamSel];
      if (m.item) this.run.bag[m.item] = (this.run.bag[m.item] || 0) + 1;   // devuelve el anterior
      m.item = k; this.run.bag[k]--;
      this.toast(`${m.name.toUpperCase()} lleva ${ITEMS[k].name}.`);
      this.teamState = 'action'; this.teamCursor = 0; this.renderTeam(); return;
    }
    if (st === 'pickdisc') {
      const k = this.pickKeys[this.teamCursor]; if (!k) return;
      const m = this.run.party[this.teamSel];
      m.ability = DISCS[k].ability; this.run.bag[k]--;
      this.toast(`${m.name.toUpperCase()} aprendió ${abilityName(m.ability)}.`);
      this.teamState = 'action'; this.teamCursor = 0; this.renderTeam(); return;
    }
    if (st === 'pc') {
      if (this.pcCol === 'party') this.depositMon(this.pcCursor);
      else if (this.pcBox[this.pcCursor]) this.withdrawMon(this.pcCursor);
    }
  }

  /** B (atrás) según el estado del menú EQUIPO. */
  teamBack() {
    const st = this.teamState;
    if (st === 'list') { if (this.teamPick >= 0) { this.teamPick = -1; this.renderTeam(); } else this.closeTeam(); return; }
    if (st === 'action') { this.teamState = 'list'; this.teamCursor = this.teamSel; this.renderTeam(); return; }
    if (st === 'pickitem' || st === 'pickdisc') { this.teamState = 'action'; this.teamCursor = 0; this.renderTeam(); return; }
    if (st === 'pc') { this.teamState = 'list'; this.teamCursor = 0; this.renderTeam(); return; }
  }

  teamCount() {
    const st = this.teamState;
    if (st === 'list') return this.run.party.length + 1;
    if (st === 'action') return this.actItems.length;
    if (st === 'pickitem' || st === 'pickdisc') return this.pickKeys.length;
    return 0;
  }

  useBagItem() {
    const k = this.bagKeys[this.bagCursor];
    if (!k) return;
    if (BALLS[k]) return this.toast('Las Poké Balls solo sirven en combate.');
    // REPELENTE: activa N pasos sin encuentros
    if (REPELS[k]) {
      this.run.repelSteps = REPELS[k].repel;
      this.run.bag[k]--;
      this.toast(`¡${REPELS[k].name} activado! ${this.run.repelSteps} pasos sin salvajes.`);
      this.closeBag(); this.toggleBag(); return;
    }
    // BICI: montar/desmontar (no se consume)
    if (FIELD[k]?.bike) { this.toggleBike(); this.closeBag(); return; }
    // CUERDA HUIDA: baja al siguiente piso al instante
    if (FIELD[k]?.escape) {
      this.run.bag[k]--;
      this.toast('Tiras de la cuerda...');
      this.closeBag();
      return this.descend();
    }
    // CONSUMIBLES (caramelo raro / éter / elixir): sobre el primer Pokémon en pie
    if (CONSUM[k]) { this.useConsumable(k); return; }
    const h = HEALS[k];
    if (!h) return;
    let target;
    if (h.revive != null) target = this.run.party.find(m => m.hp <= 0);
    else target = [...this.run.party].filter(m => m.hp > 0 && m.hp < m.maxhp).sort((a, b) => a.hp / a.maxhp - b.hp / b.maxhp)[0];
    if (!target) return this.toast('No tendría ningún efecto.');
    if (h.revive != null) { target.hp = Math.max(1, Math.floor(target.maxhp * h.revive)); target.status = null; }
    else { target.hp = h.heal === 'full' ? target.maxhp : Math.min(target.maxhp, target.hp + h.heal); if (h.cure) target.status = null; }
    this.run.bag[k]--;
    this.buildFollowers();   // si revivió un Pokémon con correa, vuelve a seguirte
    this.toast(`${target.name.toUpperCase()}: ${target.hp}/${target.maxhp} PS`);
    this.closeBag(); this.toggleBag();   // refrescar cantidades
  }

  /** Caramelo Raro (sube nivel + aprende/evoluciona) o Éter/Elixir (restaura PP),
   *  sobre el primer Pokémon en pie del equipo. */
  useConsumable(k) {
    const c = CONSUM[k];
    const m = this.run.party.find(p => p.hp > 0) || this.run.party[0];
    if (!m) return;
    if (!m.pp) m.pp = Object.fromEntries((m.moves || []).map(id => [id, MOVES[id].pp]));
    if (c.level) {
      if (m.level >= 100) return this.toast(`${m.name.toUpperCase()} ya está al máximo.`);
      m.level += c.level;
      const ratio = m.maxhp ? m.hp / m.maxhp : 1;
      m.stats = computeStats({ base: m.base, level: m.level, nature: m.nature, ivs: m.ivs, evs: m.evs });
      m.maxhp = m.stats.hp; m.hp = Math.max(1, Math.round(m.maxhp * ratio));
      let mv, guard = 0, extra = '';
      while ((mv = nextLearnableMove(m)) && guard++ < 4 && m.moves.length < 4) { m.moves.push(mv); m.pp[mv] = MOVES[mv].pp; extra += ` Aprendió ${MOVES[mv].name}.`; }
      const evo = pendingEvolution(m);
      if (evo) { const sp = evolveMon(m, evo); extra += ` ¡Evolucionó en ${sp.name.toUpperCase()}!`; this.buildFollowers(); }
      this.run.bag[k]--;
      this.toast(`${m.name.toUpperCase()} subió a Nv ${m.level}.${extra}`);
    } else if (c.ppMove != null) {
      const dep = m.moves.find(id => (m.pp[id] ?? MOVES[id].pp) < MOVES[id].pp);
      if (!dep) return this.toast('No haría efecto: PP llenos.');
      m.pp[dep] = c.ppMove === 'full' ? MOVES[dep].pp : Math.min(MOVES[dep].pp, (m.pp[dep] ?? 0) + c.ppMove);
      this.run.bag[k]--;
      this.toast(`Se restauraron PP de ${MOVES[dep].name}.`);
    } else if (c.ppAll != null) {
      let any = false;
      for (const id of m.moves) { const max = MOVES[id].pp, cur = m.pp[id] ?? max; if (cur < max) { m.pp[id] = c.ppAll === 'full' ? max : Math.min(max, cur + c.ppAll); any = true; } }
      if (!any) return this.toast('No haría efecto: PP llenos.');
      this.run.bag[k]--;
      this.toast(`${m.name.toUpperCase()}: PP restaurados.`);
    }
    this.closeBag(); this.toggleBag();
  }

  // ---------- movimiento por casillas ----------
  update(time, delta) {
    if (this.transitioning) return;
    if (this.bagUI) {                      // navegación de la mochila
      const d = this.gba.dirJust();
      if (d === 'up') { this.bagCursor = Math.max(0, this.bagCursor - 1); this.paintBag(); }
      else if (d === 'down') { this.bagCursor = Math.min(this.bagKeys.length - 1, this.bagCursor + 1); this.paintBag(); }
      if (this.gba.confirm()) this.useBagItem();
      else if (this.gba.cancel() || this.gba.justDown('TRI')) this.closeBag();
      return;
    }
    if (this.teamUI) {                     // navegación del menú de equipo (máquina de estados)
      const d = this.gba.dirJust();
      if (this.teamState === 'pc') {
        if (d === 'left') { this.pcCol = 'party'; this.pcCursor = 0; this.paintPC(); }
        else if (d === 'right') { this.pcCol = 'box'; this.pcCursor = 0; this.paintPC(); }
        else if (d === 'up') { this.pcCursor = Math.max(0, this.pcCursor - 1); this.paintPC(); }
        else if (d === 'down') { const n = (this.pcCol === 'party' ? this.pcPartyRows : this.pcBoxRows).length; this.pcCursor = Math.min(Math.max(0, n - 1), this.pcCursor + 1); this.paintPC(); }
        if (this.gba.confirm()) this.teamConfirm();
        else if (this.gba.cancel() || this.gba.justDown('SQR')) this.teamBack();
        return;
      }
      const n = this.teamCount();
      if (d === 'up') { this.teamCursor = Math.max(0, this.teamCursor - 1); this.paintTeam(); }
      else if (d === 'down') { this.teamCursor = Math.min(n - 1, this.teamCursor + 1); this.paintTeam(); }
      if (this.gba.confirm()) this.teamConfirm();
      else if (this.gba.cancel() || this.gba.justDown('SQR')) this.teamBack();
      return;
    }
    if (this.shopUI) {                     // navegación de la tienda
      const d = this.gba.dirJust();
      if (d === 'up') { this.shopCursor = Math.max(0, this.shopCursor - 1); this.paintShop(); }
      else if (d === 'down') { this.shopCursor = Math.min(SHOP_STOCK.length - 1, this.shopCursor + 1); this.paintShop(); }
      if (this.gba.confirm()) this.buyShopItem();
      else if (this.gba.cancel()) this.closeShop();
      return;
    }
    // ---- IA AUTÓNOMA: si está activa, el bot conduce (explora, recoge, baja) ----
    if (this.registry.get('autoplay') && !this.bagUI && !this.teamUI && !this.shopUI && !this.transitioning && !this.fishing) {
      this.updateDepths();
      if (this.registry.get('godtest')) {
        // MODO DIOS TESTER: turbo — muchos pasos INSTANTÁNEOS por frame (≈x500)
        const budget = this.registry.get('godspeed') || 200;
        for (let i = 0; i < budget; i++) {
          if (this.transitioning || this.stepping || this.bagUI || this.shopUI || this.teamUI) break;
          this.autoStep();
        }
      } else if (!this.stepping) { this.botTimer += delta; if (this.botTimer > 90) { this.botTimer = 0; this.autoStep(); } }
      else this.botTimer = 0;
      return;   // ignora input humano mientras la IA juega
    }
    // atajos de control: △ mochila · □ equipo · Select Pokédex
    if (this.gba.justDown('TRI')) return this.toggleBag();
    if (this.gba.justDown('SQR')) return this.toggleTeam();
    if (this.gba.justDown('SELECT')) return this.openPokedex();
    // A frente a una Poké Ball tirada → abrirla
    if (this.gba.confirm()) {
      const [fdx, fdy] = DIRV[this.facing];
      const pk = this.pickups?.find(p => p.c === this.col + fdx && p.r === this.row + fdy);
      if (pk) {
        this.run.found.push(pk.key);
        this.run.bag[pk.item] = (this.run.bag[pk.item] || 0) + pk.qty;
        this.tilemap.cells[pk.r][pk.c].blocked = false;
        const nm = itemAny(pk.item)?.name || pk.item;
        this.toast(`¡Encontraste ${nm} x${pk.qty}!`);
        this.tweens.add({ targets: pk.sprite, y: pk.sprite.y - 14, alpha: 0, duration: 250, onComplete: () => pk.sprite.destroy() });
        this.pickups = this.pickups.filter(p => p !== pk);
        saveRun(this.registry, this.floorNum);
      } else {
        const pond = this.ponds?.find(q => q.c === this.col + fdx && q.r === this.row + fdy);
        if (pond) this.fish(pond);          // ¿charco enfrente? → PESCAR
        else this.talkToNpc();              // ¿hay un NPC del pueblo enfrente? → hablar
      }
    }
    this.updateDepths();

    if (this.stepping) return;                 // bloqueado durante el paso

    const dir = this.gba.dirHeld();
    if (!dir) {                                // quieto: idle + posible deambular
      this.idleTime += delta;
      if (this.idleTime > 1400 && Math.random() < delta / 9000) this.tryWander();
      this.idleBob(time);
      return;
    }
    this.idleTime = 0;
    if (dir !== this.facing) this.faceDir(dir);

    const [dx, dy] = DIRV[dir];
    const tc = this.col + dx, tr = this.row + dy;

    // ¿puerta en el borde? → transición
    if (this.isBorderDoor(tc, tr)) { this.exitVia(tc, tr); return; }
    if (!this.walkable(tc, tr)) {              // bloqueado: gira pero NO sigas caminando
      // (bug: al chocar manteniendo la dirección, la anim de paso quedaba en loop
      //  porque el onComplete solo paraba si soltabas la tecla)
      if (this.chibi && !this.stepping) {
        if (this.chibiMeta.frames >= 9) this.player.anims.stop();
        this.player.setFrame(({ down: 0, up: 1, side: 2 })[this.animDir(dir)]);
      }
      return;
    }
    this.step(tc, tr, dir, this.gba.isDown('B'));
  }

  step(tc, tr, dir, running) {
    if (this.registry.get('godtest')) return this.stepInstant(tc, tr);   // turbo: sin tweens
    this.stepping = true;
    const prev = { col: this.col, row: this.row };
    this.col = tc; this.row = tr;
    const dur = this.biking ? BIKE_MS : running ? RUN_MS : WALK_MS;
    if (this.chibi && this.chibiMeta.frames >= 9) {
      // animación REAL de caminar (chibi GBA): estira la pierna y todo
      const key = `ow${this.chibi}_${this.animDir(dir)}`;
      this.player.play(key, true);
      this.player.anims.timeScale = running ? 1.7 : 1;
    } else if (this.chibi) {
      // chibi de 3 frames (líderes): pose por dirección + saltito de paso
      this.player.setFrame(({ down: 0, up: 1, side: 2 })[this.animDir(dir)]);
      this.tweens.add({ targets: this.player, scaleY: this.baseSY * 0.88, duration: dur / 2, yoyo: true });
    } else {
      this.tweens.add({ targets: this.player, scaleY: this.baseSY * 0.9, duration: dur / 2, yoyo: true });
    }
    const p = this.tileCenter(tc, tr);
    this.tweens.add({ targets: this.player, x: p.x, y: p.y, duration: dur, ease: 'Linear', onComplete: () => {
      this.stepping = false;
      this.onTileStep();
      if (this.chibi && !this.gba.dirHeld()) {
        if (this.chibiMeta.frames >= 9) this.player.anims.stop();
        this.player.setFrame(({ down: 0, up: 1, side: 2 })[this.animDir(this.facing)]);
      }
    } });

    // avanzar la cola: cada seguidor a la casilla del que va delante
    this.history.unshift(prev);
    this.history.length = Math.min(this.history.length, this.followers.length + 1);
    this.followers.forEach((f, k) => {
      const tile = this.history[k]; if (!tile) return;
      const fp = this.tileCenter(tile.col, tile.row);
      f.homeX = fp.x; f.homeY = fp.y; f.wandering = false;
      if (f.animated) {
        // animación de caminar REAL (hoja PMD): dirección por el delta del paso
        const ddx = fp.x - f.sprite.x, ddy = fp.y - f.sprite.y;
        const fdir = Math.abs(ddx) >= Math.abs(ddy) ? (ddx < 0 ? 'left' : 'right') : (ddy < 0 ? 'up' : 'down');
        if (ddx || ddy) f.sprite.play(`w${f.mon.speciesId}_${fdir}`, true);
        this.tweens.add({ targets: f.sprite, x: fp.x, y: fp.y, duration: dur, ease: 'Linear', onComplete: () => {
          if (!this.stepping) { f.sprite.anims.stop(); f.sprite.setFrame(WALK_ROW[fdir] * f.meta.frames); }
        } });
      } else {
        // los sprites frontales de PokeAPI miran a la IZQUIERDA del espectador:
        // al avanzar a la derecha hay que voltearlos (antes Snivy miraba al revés)
        if (fp.x < f.sprite.x) f.sprite.setFlipX(false); else if (fp.x > f.sprite.x) f.sprite.setFlipX(true);
        this.tweens.add({ targets: f.sprite, x: fp.x, y: fp.y, duration: dur, ease: 'Linear' });
        this.tweens.add({ targets: f.sprite, scaleY: 0.54, duration: dur / 2, yoyo: true });  // saltito
      }
    });
  }

  faceDir(dir) {
    this.facing = dir;
    const artLeft = !!this.chibi;   // los frames laterales del chibi GBA miran a la izquierda
    if (dir === 'left') this.player.setFlipX(!artLeft);
    else if (dir === 'right') this.player.setFlipX(artLeft);
    else this.player.setFlipX(false);
    // girar también el FRAME: aunque el paso esté bloqueado, el chibi voltea a ver
    if (this.chibi && !this.stepping) this.player.setFrame(({ down: 0, up: 1, side: 2 })[this.animDir(dir)]);
  }
  animDir(d) { return (d === 'left' || d === 'right') ? 'side' : d; }

  idleBob(time) {
    if (this.chibi) return;   // el chibi GBA no se "estira": queda en su frame de reposo
    const s = 1 + Math.sin(time / 300) * 0.012;
    this.player.setScale(this.baseSX, this.baseSY * s);
  }

  tryWander() {
    const cand = this.followers.filter(f => f.canWander && !f.wandering);
    if (!cand.length) return;
    const f = Phaser.Utils.Array.GetRandom(cand);
    const dirs = Phaser.Utils.Array.Shuffle(['up', 'down', 'left', 'right']);
    for (const d of dirs) {
      const [dx, dy] = DIRV[d];
      const tile = { col: f.homeX / T - 0.5 + dx | 0, row: f.homeY / T - 0.5 + dy | 0 };
      const c = Math.round((f.homeX - T / 2) / T) + dx, r = Math.round((f.homeY - T / 2) / T) + dy;
      if (!this.walkable(c, r) || (c === this.col && r === this.row)) continue;
      if (this.followers.some(o => o !== f && Math.round((o.sprite.x - T / 2) / T) === c && Math.round((o.sprite.y - T / 2) / T) === r)) continue;
      f.wandering = true;
      const pos = this.tileCenter(c, r);
      this.tweens.add({ targets: f.sprite, x: pos.x, y: pos.y, duration: 220, yoyo: true, hold: 500, ease: 'Sine.inOut', onComplete: () => { f.wandering = false; } });
      this.tweens.add({ targets: f.sprite, scaleY: 0.54, duration: 110, yoyo: true });
      break;
    }
  }

  /** Anims del chibi GBA (9 frames: 0↓ 1↑ 2← parado · 3,4↓ 5,6↑ 7,8← andando). */
  ensureOwAnims(id) {
    const rows = { down: [3, 0, 4, 0], up: [5, 1, 6, 1], side: [7, 2, 8, 2] };
    for (const [dir, seq] of Object.entries(rows)) {
      const key = `ow${id}_${dir}`;
      if (this.anims.exists(key)) continue;
      this.anims.create({ key, frames: seq.map(f => ({ key: 'ow_' + id, frame: f })), frameRate: 9, repeat: -1 });
    }
  }

  /** Crea (una vez) las animaciones de caminar de una especie desde su hoja PMD. */
  ensureWalkAnims(id, meta) {
    for (const [dir, row] of Object.entries(WALK_ROW)) {
      const key = `w${id}_${dir}`;
      if (this.anims.exists(key)) continue;
      this.anims.create({
        key,
        frames: this.anims.generateFrameNumbers('walk_' + id, { start: row * meta.frames, end: row * meta.frames + meta.frames - 1 }),
        frameRate: 10, repeat: -1,
      });
    }
  }

  // ---------- props de entorno (rocas, hojas... por bioma) ----------
  spawnProps(room, tm) {
    for (const p of this.props || []) p.destroy();
    this.props = [];
    const spec = BIOME_PROPS[this.biome.id] || BIOME_PROPS.cuevas;
    const rng = makeRNG(`${this.floor.seed}:props:${room.id}`);
    const pick = (arr) => arr[Math.floor(rng.float() * arr.length)];
    const cx = (COLS - 1) / 2 | 0, cy = (ROWS - 1) / 2 | 0;   // zona de spawn
    const taken = [];
    // corredores de las puertas hasta el centro: NUNCA bloquearlos con obstáculos, o
    // una puerta (¡a veces la de las escaleras!) quedaría inalcanzable → sala perdida.
    const corridor = this.doorSafeTiles(room);
    const freeCell = (minDist) => {
      for (let tries = 0; tries < 30; tries++) {
        const c = 2 + Math.floor(rng.float() * (COLS - 4));
        const r = 2 + Math.floor(rng.float() * (ROWS - 4));
        const cell = tm.cells[r][c];
        if (cell.base !== 'floor' || cell.blocked || cell.decor) continue;
        if (Math.abs(c - cx) <= 1 && Math.abs(r - cy) <= 1) continue;          // no taponar el spawn
        if (corridor.has(c + ',' + r)) continue;                               // no taponar puertas
        if (taken.some(t => Math.max(Math.abs(t.c - c), Math.abs(t.r - r)) < minDist)) continue;
        return { c, r };
      }
      return null;
    };
    const place = (tex, c, r, { big }) => {
      const pos = this.tileCenter(c, r);
      const im = this.add.image(pos.x, pos.y + (big ? 6 : 4), 'fx_' + tex).setOrigin(0.5, 0.78);
      const src = this.textures.get('fx_' + tex).getSourceImage();
      const m = (big ? 0.85 : 0.45) * T / Math.max(src.width, src.height);
      im.setScale(m * (0.85 + rng.float() * 0.3)).setFlipX(rng.float() < 0.5);
      if (spec.tint) im.setTint(spec.tint);
      im.setAlpha(big ? 1 : 0.8).setDepth(big ? 50 + pos.y : 46);
      this.props.push(im);
    };
    // obstáculos (bloquean la casilla; separados ≥2 para no cerrar caminos).
    // En pueblos (pisos seguros) NO se generan: los edificios son el decorado.
    const nObs = this.floor.isSafeFloor ? 0 : 3 + Math.floor(rng.float() * 3);
    for (let i = 0; i < nObs; i++) {
      const cell = freeCell(2); if (!cell) break;
      tm.cells[cell.r][cell.c].blocked = true;
      taken.push(cell);
      place(pick(spec.obstacles), cell.c, cell.r, { big: true });
    }
    // clutter pequeño (solo visual, se pisa)
    const nClu = 5 + Math.floor(rng.float() * 4);
    for (let i = 0; i < nClu; i++) {
      const cell = freeCell(1); if (!cell) break;
      taken.push(cell);
      place(pick(spec.clutter), cell.c, cell.r, { big: false });
    }

    // HIERBA ALTA (zonas de encuentro): solo en biomas con vegetación (NO cueva).
    // Se dibuja como BLADES anclados por la base, DELANTE del jugador (y-sort), de
    // modo que caminas ENTRE ella; al pisarla suena y se aplasta. El resto del piso
    // queda seguro. En cuevas no hay hierba: ver onTileStep.
    this.tallCells = [];
    if (!this.floor.isSafeFloor && !this.biome.dark && !['entrance', 'pokecenter', 'shop', 'rest'].includes(room.type)) {
      const patches = 1 + Math.floor(rng.float() * 2);
      for (let pI = 0; pI < patches; pI++) {
        const seed = freeCell(2); if (!seed) break;
        const pw = 2 + Math.floor(rng.float() * 2), ph = 2 + Math.floor(rng.float() * 2);
        for (let dr = 0; dr < ph; dr++) for (let dc = 0; dc < pw; dc++) {
          const c = seed.c + dc, r = seed.r + dr;
          if (c <= 0 || r <= 0 || c >= COLS - 1 || r >= ROWS - 1) continue;
          const cell = tm.cells[r][c];
          if (cell.base !== 'floor' || cell.blocked || cell.decor || cell.tall) continue;
          if (Math.abs(c - cx) <= 1 && Math.abs(r - cy) <= 1) continue;   // no sobre el spawn
          cell.tall = true;
          this.tallCells.push({ c, r, sprite: this.makeGrassBlade(c, r) });
        }
      }
    }

    // CHARCOS DE AGUA (puntos de PESCA): 0-2 por sala normal. Bloquean el paso
    // pero se PESCA desde una casilla adyacente (A). Animados (brillo + ondas)
    // para que NO se confundan con el agujero de bajada (que es negro).
    this.ponds = [];
    if (!this.floor.isSafeFloor && room.type !== 'entrance') {
      const nP = rng.float() < 0.55 ? 1 + (rng.float() < 0.4 ? 1 : 0) : 0;
      for (let i = 0; i < nP; i++) {
        const cell = freeCell(2); if (!cell) break;
        taken.push(cell);
        tm.cells[cell.r][cell.c].blocked = true;
        this.spawnPond(cell.c, cell.r);
      }
    }

    // POKÉ BALLS TIRADAS con objetos (el suministro de la run; una vez cada una)
    this.run.found = this.run.found || [];
    this.pickups = [];
    const LOOT = ['pokeball', 'pokeball', 'potion', 'potion', 'superball', 'quickball', 'duskball', 'superpotion', 'netball', 'revive', 'repel', 'superrepel', 'escaperope', 'ether', 'zcrystal'];
    const nPick = room.type === 'treasure' ? 3 : (rng.float() < 0.5 ? 1 : 0);
    for (let i = 0; i < nPick; i++) {
      const key = `${this.floorNum}:${room.id}:${i}`;
      const cell = freeCell(1); if (!cell) break;
      taken.push(cell);
      if (this.run.found.includes(key)) continue;
      const pp = this.tileCenter(cell.c, cell.r);
      const im = this.add.image(pp.x, pp.y, 'item_pokeball').setScale(0.9).setDepth(48);
      this.tweens.add({ targets: im, y: pp.y - 3, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      this.props.push(im);
      tm.cells[cell.r][cell.c].blocked = true;   // bloquea el paso: se abre con A
      this.pickups.push({ c: cell.c, r: cell.r, key, sprite: im, item: LOOT[Math.floor(rng.float() * LOOT.length)], qty: 1 + (rng.float() < 0.35 ? 1 : 0) });
    }
  }

  /** Pokémon CORREDORES visibles del bioma que corretean por la sala. Si los
   *  TOCAS (misma casilla o adyacente), se inicia combate con ESA especie. */
  spawnAmbientCritters(room, tm) {
    this.roamers = [];
    if (this.floor.isSafeFloor || room.type === 'entrance') return;
    const rng = makeRNG(`${this.floor.seed}:crit:${room.id}`);
    let pool = [];
    for (const ty of (this.biome.typesFavored || ['normal'])) pool = pool.concat(SPECIES_BY_TYPE[ty] || []);
    const cap = 330 + this.floorNum * 14;
    pool = pool.filter(id => !LEGENDS.has(id) && this.textures.exists('mon_' + id) && (BST.get(id) || 999) <= cap);
    if (!pool.length) return;
    const n = rng.float() < 0.45 ? 1 : 2;
    for (let i = 0; i < n; i++) {
      let c = 0, r = 0, ok = false;
      for (let t = 0; t < 20 && !ok; t++) { c = 2 + Math.floor(rng.float() * (COLS - 4)); r = 2 + Math.floor(rng.float() * (ROWS - 4)); ok = tm.cells[r]?.[c]?.base === 'floor' && !tm.cells[r][c].blocked && (Math.abs(c - 7) > 1 || Math.abs(r - 5) > 1); }
      if (!ok) continue;
      const id = pool[Math.floor(rng.float() * pool.length)], pos = this.tileCenter(c, r);
      const spr = this.add.image(pos.x, pos.y, 'mon_' + id).setScale(0.5).setOrigin(0.5, 0.8).setDepth(49).setAlpha(0.92);
      this.props.push(spr);
      const roamer = { sprite: spr, id, c, r };
      this.roamers.push(roamer);
      const ev = this.time.addEvent({ delay: 900 + Math.floor(rng.float() * 1100), loop: true, callback: () => {
        if (!spr.active || this.transitioning) { if (!spr.active) ev.remove(); return; }
        // a veces HUYE del jugador, a veces deambula
        const flee = Math.random() < 0.5;
        let dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
        if (flee) dirs.sort((a, b) => (Math.abs(roamer.c + b[0] - this.col) + Math.abs(roamer.r + b[1] - this.row)) - (Math.abs(roamer.c + a[0] - this.col) + Math.abs(roamer.r + a[1] - this.row)));
        else dirs.sort(() => Math.random() - 0.5);
        for (const [dx, dy] of dirs) {
          const nc = roamer.c + dx, nr = roamer.r + dy;
          if (this.inBounds(nc, nr) && tm.cells[nr]?.[nc]?.base === 'floor' && !tm.cells[nr][nc].blocked) {
            roamer.c = nc; roamer.r = nr; const np = this.tileCenter(nc, nr); if (dx) spr.setFlipX(dx > 0);
            this.tweens.add({ targets: spr, x: np.x, y: np.y, duration: 240, ease: 'Quad.out', onComplete: () => this.checkRoamerTouch() });
            this.tweens.add({ targets: spr, scaleY: 0.44, duration: 120, yoyo: true });
            break;
          }
        }
      } });
      roamer.ev = ev;
    }
  }

  /** ENTRENADOR NPC: mira en una dirección; si te ve en su línea de visión, te reta. */
  spawnTrainers(room, tm) {
    this.trainers = [];
    if (this.floor.isSafeFloor || room.type === 'entrance' || this.floorNum < 3) return;
    const rng = makeRNG(`${this.floor.seed}:tr:${room.id}`);
    if (rng.float() > 0.3) return;
    let c = 0, r = 0, ok = false;
    for (let t = 0; t < 20 && !ok; t++) { c = 2 + Math.floor(rng.float() * (COLS - 4)); r = 2 + Math.floor(rng.float() * (ROWS - 4)); ok = tm.cells[r]?.[c]?.base === 'floor' && !tm.cells[r][c].blocked && !(Math.abs(c - 7) <= 1 && Math.abs(r - 5) <= 1); }
    if (!ok) return;
    const dir = ['up', 'down', 'left', 'right'][Math.floor(rng.float() * 4)];
    const key = `tr:${this.floorNum}:${room.id}`;
    this.run.found = this.run.found || [];
    const beaten = this.run.found.includes(key);
    const owPool = ['hilbert', 'nate', 'calem', 'lass', 'rosa', 'hilda', 'serena', 'dawn'].filter(id => OWMETA[id] && this.textures.exists('ow_' + id));
    const owId = owPool.length ? owPool[Math.floor(rng.float() * owPool.length)] : 'red';
    const pos = this.tileCenter(c, r);
    let sprite;
    if (OWMETA[owId] && this.textures.exists('ow_' + owId)) { sprite = this.add.sprite(pos.x, pos.y, 'ow_' + owId, ({ down: 0, up: 1, side: 2 })[this.animDir(dir)]).setOrigin(0.5, 0.8).setScale(2); if (dir === 'left') sprite.setFlipX(true); }
    else sprite = this.add.image(pos.x, pos.y, 'trainer_red').setOrigin(0.5, 0.8).setDisplaySize(26, 30);
    sprite.setDepth(50 + pos.y); this.worldLayer.add(sprite);
    // NO bloquear la casilla: si un entrenador tapara un corredor del camino, ni la
    // IA ni el jugador podrían pasar. Su LÍNEA DE VISIÓN es lo que te reta.
    if (beaten) sprite.setTint(0x888888).setAlpha(0.75);
    this.tweens.add({ targets: sprite, y: pos.y - 2, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.trainers.push({ c, r, dir, sprite, key, beaten });
  }

  /** ¿Te ve un entrenador (línea recta, sin muros)? → combate de entrenador. */
  checkTrainerSight() {
    if (this.transitioning || this.floor.isSafeFloor) return;
    for (const t of this.trainers || []) {
      if (t.beaten) continue;
      const [dx, dy] = DIRV[t.dir];
      for (let i = 1; i <= 4; i++) {
        const sc = t.c + dx * i, sr = t.r + dy * i;
        if (!this.inBounds(sc, sr)) break;
        const cell = this.tilemap.cells[sr]?.[sc];
        if (!cell || cell.base === 'wall' || cell.blocked) break;
        if (sc === this.col && sr === this.row) return this.startTrainerBattle(t);
      }
    }
  }

  startTrainerBattle(t) {
    if (this.transitioning) return;
    if (this.registry.get('godtest')) { t.beaten = true; return this.godSkipBattle('entrenador'); }
    this.transitioning = true; this.stepping = false;
    t.beaten = true; (this.run.found = this.run.found || []).push(t.key);
    const ex = this.add.text(t.sprite.x, t.sprite.y - 32, '!', { fontFamily: '"Press Start 2P"', fontSize: '16px', color: '#ffd76a', stroke: '#05060a', strokeThickness: 4 }).setOrigin(0.5).setDepth(99999);
    this.tweens.add({ targets: ex, y: ex.y - 8, scale: 1.3, duration: 220, yoyo: true, onComplete: () => ex.destroy() });
    this.cameras.main.flash(140, 255, 240, 160);
    const rng = makeRNG(`${t.key}:team`);
    let pool = []; for (const ty of (this.biome.typesFavored || ['normal'])) pool = pool.concat(SPECIES_BY_TYPE[ty] || []);
    const cap = 380 + this.floorNum * 14;
    pool = pool.filter(id => !LEGENDS.has(id) && (BST.get(id) || 999) <= cap);
    if (!pool.length) pool = [19];
    const lvl = Phaser.Math.Clamp(2 + Math.floor(this.floorNum), 2, 95);
    const team = [];
    for (let i = 0; i < 2; i++) team.push(makeBattleMon(pool[Math.floor(rng.float() * pool.length)], Phaser.Math.Clamp(lvl + Phaser.Math.Between(-1, 1), 2, 95)));
    this.time.delayedCall(480, () => {
      this.scene.pause();
      this.scene.launch('Battle', { playerTeam: this.run.party, enemyTeam: team, run: this.run, floor: this.floorNum, biome: this.biome, seed: `${this.floor.seed}:trb:${Date.now()}`, returnTo: 'Floor', trainer: true, trainerName: 'Entrenador', aiStyle: 'smart' });
    });
    saveRun(this.registry, this.floorNum);
  }

  /** Especie del JEFE del bioma; cada 50 pisos es un GUARDIÁN DE LA TORRE (rey legendario). */
  pickBoss() {
    // GUARDIANES: legendarios "rey" que despiertan en pisos milestone (/50)
    const GUARDIANS = [150, 384, 249, 250, 483, 484, 487, 493, 643, 644, 646];
    this.isGuardian = this.floorNum % 50 === 0;
    if (this.isGuardian) {
      const g = GUARDIANS.filter(id => this.textures.exists('mon_' + id));
      return g[(Math.floor(this.floorNum / 50) - 1) % g.length] || 150;
    }
    const rng = makeRNG(`${this.floor.seed}:boss:${this.floorNum}`);
    let pool = [];
    for (const ty of (this.biome.typesFavored || ['normal'])) pool = pool.concat(SPECIES_BY_TYPE[ty] || []);
    const legs = pool.filter(id => LEGENDS.has(id) && this.textures.exists('mon_' + id));
    if (legs.length) return legs[Math.floor(rng.float() * legs.length)];
    pool = pool.filter(id => this.textures.exists('mon_' + id)).sort((a, b) => (BST.get(b) || 0) - (BST.get(a) || 0));
    return pool[0] || 130;
  }

  startBossBattle() {
    if (this.transitioning) return;
    if (this.registry.get('godtest')) { this.bossTile = null; return this.godSkipBattle(this.isGuardian ? 'guardián' : 'jefe'); }
    this.transitioning = true; this.stepping = false;
    (this.run.found = this.run.found || []).push(`boss:${this.floorNum}`);
    const d = diffOf(this.run), guardian = this.isGuardian;
    const lvl = guardian ? 100 : Phaser.Math.Clamp(Math.round((5 + Math.floor(this.floorNum * 1.2)) * d.lvl), 5, 100);
    const boss = makeBattleMon(this.bossSpeciesId, lvl);
    boss.maxhp = boss.hp = Math.floor(boss.maxhp * (guardian ? 2.5 : d.bossHp));
    const mult = guardian ? 1.35 : 1.15;
    for (const k of ['atk', 'spa', 'def', 'spd', 'spe']) boss.stats[k] = Math.floor(boss.stats[k] * mult);
    boss.isBossMon = true;   // mecánica única: FURIA al bajar del 50% PS
    this.cameras.main.shake(guardian ? 700 : 400, guardian ? 0.02 : 0.012); this.cameras.main.flash(guardian ? 400 : 220, 140, 0, 0);
    this.toast(guardian ? `¡El GUARDIÁN DE LA TORRE, ${boss.name.toUpperCase()}, despierta ante ti!` : '¡Un Pokémon colosal bloquea el camino!');
    this.time.delayedCall(guardian ? 1000 : 620, () => {
      this.scene.pause();
      this.scene.launch('Battle', { playerTeam: this.run.party, enemyTeam: [boss], run: this.run, floor: this.floorNum, biome: this.biome, seed: `${this.floor.seed}:boss:${Date.now()}`, returnTo: 'Floor', boss: true, guardian, trainerName: boss.name, aiStyle: guardian ? 'smart' : 'boss' });
    });
    saveRun(this.registry, this.floorNum);
  }

  /** ¿El jugador y algún corredor están en contacto? → combate con esa especie. */
  checkRoamerTouch() {
    if (this.transitioning || this.floor.isSafeFloor) return;
    const o = this.roamers?.find(x => x.sprite.active && Math.abs(x.c - this.col) + Math.abs(x.r - this.row) <= 1);
    if (!o) return;
    o.ev?.remove();
    this.roamers = this.roamers.filter(x => x !== o);
    this.cameras.main.flash(120, 255, 255, 255);
    this.tweens.add({ targets: o.sprite, scale: 0.1, alpha: 0, duration: 160, onComplete: () => o.sprite.destroy() });
    this.startEncounter(true, { species: o.id });
  }

  /** Mata de HIERBA ALTA anclada por la base, DELANTE del jugador (y-sort): al
   *  estar dentro, las hojas tapan tus pies como en los juegos clásicos. */
  makeGrassBlade(c, r) {
    const pos = this.tileCenter(c, r);
    const baseY = pos.y + T / 2;
    const g = this.add.image(pos.x, baseY, 'tallgrass').setOrigin(0.5, 1);   // sprite ya verde, fondo transparente
    g.setDisplaySize(T, T * 0.8).setDepth(50 + baseY);   // y-sort: delante del jugador de su fila
    g._baseSY = g.scaleY;
    this.tweens.add({ targets: g, scaleX: g.scaleX * 1.06, duration: 700 + Math.random() * 300, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.props.push(g);
    return g;
  }

  /** Al pisar hierba alta: sonido + aplastón (squash) de las hojas y del jugador. */
  rustleGrass(c, r) {
    const g = this.tallCells?.find(t => t.c === c && t.r === r)?.sprite;
    if (!g || !g.active) return;
    sfx(this, 'grass', 0.45);
    this.tweens.add({ targets: g, scaleY: g._baseSY * 0.74, duration: 90, yoyo: true, ease: 'Quad.out' });
    if (this.player) this.tweens.add({ targets: this.player, scaleY: this.baseSY * 0.9, duration: 80, yoyo: true });
  }

  /** Dibuja un CHARCO de agua animado (brillo + ondas) en la casilla (c,r). */
  spawnPond(c, r) {
    const p = this.tileCenter(c, r);
    const cont = this.add.container(p.x, p.y).setDepth(44);
    // base de agua (azul, claramente NO un agujero negro)
    const water = this.add.ellipse(0, 2, T * 0.86, T * 0.6, 0x2f6fb0, 1).setStrokeStyle(2, 0x8fd0ff, 0.8);
    const water2 = this.add.ellipse(0, 1, T * 0.62, T * 0.42, 0x4f9fd8, 0.9);
    // ondas concéntricas que laten + destello
    const ripple = this.add.ellipse(0, 1, T * 0.3, T * 0.2, 0xffffff, 0).setStrokeStyle(1.5, 0xdff4ff, 0.9);
    const glint = this.add.ellipse(-T * 0.12, -T * 0.06, 4, 2, 0xffffff, 0.8);
    cont.add([water, water2, ripple, glint]);
    this.tweens.add({ targets: ripple, scaleX: 2.6, scaleY: 2.6, alpha: { from: 0.9, to: 0 }, duration: 1700, repeat: -1, ease: 'Sine.out' });
    this.tweens.add({ targets: water2, scaleX: 1.08, scaleY: 1.08, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.tweens.add({ targets: glint, alpha: 0.2, x: T * 0.1, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.props.push(cont);                       // se limpia con el resto de props
    this.ponds.push({ c, r, sprite: cont });
  }

  /** PESCA: lanza la caña a un charco adyacente. A veces pica un Pokémon de agua. */
  fish(pond) {
    if (this.transitioning || this.fishing) return;
    this.fishing = true;
    sfx(this, 'select', 0.5);
    this.toast('Lanzas la caña al agua...');
    // bob/flotador que cae al charco
    const pp = this.tileCenter(pond.c, pond.r);
    const bob = this.add.circle(pp.x, pp.y - 2, 3, 0xff5050).setStrokeStyle(1, 0xffffff).setDepth(60);
    this.tweens.add({ targets: bob, y: pp.y, scaleX: 1.4, scaleY: 0.7, duration: 300, yoyo: true, repeat: 2 });
    this.time.delayedCall(1500, () => {
      bob.destroy(); this.fishing = false;
      if (Math.random() < 0.5) { sfx(this, 'lowhp', 0.5); this.toast('¡Algo picó!'); this.checkAch('fish'); this.startEncounter(true, { water: true }); }
      else this.toast('...no picó nada. ¡Vuelve a intentarlo!');
    });
  }

  // ---------- utilidades de casilla ----------
  tileCenter(c, r) { return { x: c * T + T / 2, y: r * T + T / 2 }; }
  inBounds(c, r) { return c >= 0 && r >= 0 && c < COLS && r < ROWS; }
  walkable(c, r) { return this.inBounds(c, r) && !this.tilemap.cells[r][c].blocked; }
  isBorderDoor(c, r) {
    if (!this.inBounds(c, r)) return false;
    const cell = this.tilemap.cells[r][c];
    return cell.base === 'door' && (r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1);
  }
  borderDir(c, r) { if (r === 0) return 'N'; if (r === ROWS - 1) return 'S'; if (c === 0) return 'W'; return 'E'; }

  // ---------- servicios de zona segura ----------
  /** Entra al interior real del edificio (Centro/Mart/Posada). */
  enterBuilding(kind) {
    if (this.transitioning) return;
    this.transitioning = true;
    this.cameras.main.fadeOut(200, 0, 0, 0);
    // CLUB DE BATALLA ONLINE: no es un interior, es el modo P2P (comercio / PVP).
    const scene = kind === 'club' ? 'Online' : 'Interior';
    const data = kind === 'club' ? { returnTo: 'Floor' } : { kind, run: this.run, returnTo: 'Floor' };
    this.time.delayedCall(210, () => {
      this.scene.pause();
      this.scene.launch(scene, data);
    });
  }

  useService(type) {
    // blindado: si algo falla, NO debe tumbar el juego (Carlos: "al pararme en la
    // love ball [marcador del centro] explota todo"). Cualquier error → toast.
    try {
      if (this.registry.get('godtest')) return;   // tester: no abre tienda/centro (evita atascos)
      if (this.serviceBusy) return;            // anti-reentrada (paso repetido sobre el marcador)
      if (type === 'pokecenter') {
        if (!this.run?.party?.some(m => m.hp < m.maxhp || m.status)) return this.toast('Enfermera: "¡Vuelve cuando me necesites!"');
        this.serviceBusy = true;
        this.run.party.forEach(m => { m.hp = m.maxhp; m.status = null; });
        this.buildFollowers();   // los revividos con correa vuelven a la cola
        this.cameras.main.flash(250, 255, 190, 220);
        this.toast('¡Tu equipo fue restaurado por completo!');
        this.time.delayedCall(400, () => { this.serviceBusy = false; });
      } else if (type === 'rest') {
        const key = `rest:${this.floorNum}:${this.currentRoomId}`;
        this.run.found = this.run.found || [];
        if (this.run.found.includes(key)) return this.toast('Ya descansaste aquí.');
        this.run.found.push(key);
        this.run.party.forEach(m => { if (m.hp > 0) m.hp = Math.min(m.maxhp, m.hp + Math.ceil(m.maxhp * 0.5)); });
        this.toast('Una siesta reparadora: +50% PS para el equipo.');
      } else if (type === 'shop' && !this.shopUI) {
        this.openShop();
      }
    } catch (e) {
      this.serviceBusy = false;
      this.toast('El servicio falló, intenta de nuevo.');
      console.warn('useService error:', e);
    }
  }

  /** CRIADERO: busca una pareja compatible en el equipo y te entrega un Huevo de la
   *  forma base. Ditto cría con cualquiera; o dos de la misma familia. Un huevo a la vez. */
  openCriadero() {
    try {
      if (this.registry.get('godtest')) return;
      const party = this.run?.party || [];
      if (this.run.egg) return this.toast('Criador: "Ya llevas un Huevo. ¡Que eclosione primero!"');
      let pair = null;
      for (let i = 0; i < party.length && !pair; i++)
        for (let j = i + 1; j < party.length && !pair; j++)
          if (canBreed(party[i], party[j])) pair = [party[i], party[j]];
      if (!pair) return this.toast('Criador: "Tráeme a DITTO con otro Pokémon, o dos de la misma familia."');
      const egg = eggResult(pair[0], pair[1]);
      if (!egg || !this.textures.exists('mon_' + egg.id)) return this.toast('Criador: "Hmm, esta pareja no congenió..."');
      this.run.egg = { speciesId: egg.id, steps: 220 };
      sfx(this, 'select', 0.6);
      this.cameras.main.flash(180, 200, 255, 200);
      this.toast(`🥚 ¡El Criador te entrega un Huevo de ${egg.name.toUpperCase()}! Camina para que eclosione.`);
      saveRun(this.registry, this.floorNum);
    } catch (e) { this.toast('El criadero falló, intenta de nuevo.'); console.warn('openCriadero error:', e); }
  }

  openShop() {
    const { w, h } = VIEW;
    const c = this.add.container(0, 0).setDepth(200000).setScrollFactor(0);
    c.add(this.add.rectangle(0, 0, w, h, 0x05060a, 0.94).setOrigin(0));
    c.add(this.add.rectangle(14, 12, 130, 22, 0x141a2a, 1).setOrigin(0).setStrokeStyle(2, 0xffd76a));
    c.add(this.add.text(24, 18, 'TIENDA', { fontFamily: '"Press Start 2P"', fontSize: '10px', color: '#ffd76a' }));
    this.shopMoney = this.add.text(w - 16, 18, `${this.run.money}₽`, { fontFamily: '"Press Start 2P"', fontSize: '10px', color: '#9fd97f' }).setOrigin(1, 0);
    c.add(this.shopMoney);
    c.add(this.add.rectangle(20, 44, w - 40, h - 116, 0x141a2a, 1).setOrigin(0).setStrokeStyle(2, 0x2a3a5a));
    this.shopCursor = 0; this.shopOff = 0;
    // lista DESPLAZABLE (la reconstruye paintShop): el surtido ampliado desbordaba
    this.shopListC = this.add.container(0, 0).setScrollFactor(0);
    c.add(this.shopListC);
    this.shopDesc = this.add.text(w / 2, h - 62, '', { fontFamily: '"Press Start 2P"', fontSize: '7px', color: '#9fb0d0', align: 'center', wordWrap: { width: w - 70 } }).setOrigin(0.5, 0);
    c.add(this.shopDesc);
    c.add(this.add.text(w / 2, h - 14, 'A comprar · B salir', { fontFamily: '"Press Start 2P"', fontSize: '7px', color: '#5a6a8a' }).setOrigin(0.5));
    this.shopUI = c;
    this.paintShop();
  }

  paintShop() {
    const { w } = VIEW, VIS = 9;
    if (this.shopCursor < this.shopOff) this.shopOff = this.shopCursor;
    if (this.shopCursor >= this.shopOff + VIS) this.shopOff = this.shopCursor - VIS + 1;
    const end = Math.min(SHOP_STOCK.length, this.shopOff + VIS);
    this.shopListC.removeAll(true);
    const add = (o) => this.shopListC.add(o);
    for (let i = this.shopOff; i < end; i++) {
      const [k, price] = SHOP_STOCK[i], on = i === this.shopCursor, y = 56 + (i - this.shopOff) * 20;
      if (on) add(this.add.text(30, y, '▶', { fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#c03028' }));
      if (this.textures.exists('item_' + k)) add(this.add.image(56, y + 4, 'item_' + k).setScale(0.7));
      add(this.add.text(72, y, itemAny(k).name, { fontFamily: '"Press Start 2P"', fontSize: '8px', color: on ? '#ffd76a' : '#e8f6ff' }));
      add(this.add.text(w - 34, y, price + '₽', { fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#ffd76a' }).setOrigin(1, 0));
    }
    if (this.shopOff > 0) add(this.add.text(w / 2, 46, '▲', { fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#9fb0d0' }).setOrigin(0.5));
    if (end < SHOP_STOCK.length) add(this.add.text(w / 2, 56 + VIS * 20 - 6, '▼', { fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#9fb0d0' }).setOrigin(0.5));
    this.shopDesc?.setText(itemAny(SHOP_STOCK[this.shopCursor][0])?.desc || '');
  }

  buyShopItem() {
    const [k, price] = SHOP_STOCK[this.shopCursor];
    if (this.run.money < price) return this.toast('Te faltan monedas...');
    // HUEVO del criadero: no va a la mochila, se "lleva" y eclosiona caminando
    if (k === 'huevo') {
      if (this.run.egg) return this.toast('Ya llevas un huevo. ¡Que eclosione primero!');
      this.run.money -= price;
      const cand = SPECIES.filter(s => !LEGENDS.has(s.id) && (BST.get(s.id) || 999) <= 320 && this.textures.exists('mon_' + s.id));
      const baby = (cand.length ? cand[Math.floor(Math.random() * cand.length)] : SPECIES[0]).id;
      this.run.egg = { speciesId: baby, steps: 220 };
      this.shopMoney.setText(`${this.run.money}₽`);
      return this.toast('¡Un Huevo Misterioso! Camina con él para que eclosione.');
    }
    this.run.money -= price;
    this.run.bag[k] = (this.run.bag[k] || 0) + 1;
    this.shopMoney.setText(`${this.run.money}₽`);
    this.toast(`¡Compraste ${itemAny(k).name}! (${this.run.bag[k]})`);
  }

  closeShop() { this.shopUI?.destroy(true); this.shopUI = null; }

  /** Caer por el agujero → siguiente piso (misma run, todo persiste). */
  descend() {
    if (this.transitioning) return;
    this.transitioning = true;
    // MODO DIOS: registra el piso superado y baja INSTANTÁNEO (sin animación)
    if (this.registry.get('godtest')) {
      const rep = (typeof window !== 'undefined') ? window.__godreport : null;
      if (rep) { rep.floorsCleared = (rep.floorsCleared || 0) + 1; rep.lastFloor = this.floorNum; rep.roomsVisited = (rep.roomsVisited || 0) + this.visited.size; }
      return this.scene.restart({ seed: this.seedBase, floor: this.floorNum + 1 });
    }
    this.toast(`Bajando al piso ${this.floorNum + 1}...`);
    this.tweens.add({ targets: this.player, scale: 0.1, angle: 360, duration: 420, ease: 'Quad.in' });
    this.cameras.main.fadeOut(450, 0, 0, 0);
    this.time.delayedCall(480, () => this.scene.restart({ seed: this.seedBase, floor: this.floorNum + 1 }));
  }

  exitVia(c, r) {
    const dir = this.borderDir(c, r);
    const to = this.doors.get(dir);
    if (to == null) return;
    if (this.registry.get('godtest')) { this.buildRoom(to, dir); return; }   // tester: cambio de sala instantáneo
    this.transitioning = true;
    this.cameras.main.fadeOut(170, 0, 0, 0);
    this.time.delayedCall(180, () => { this.buildRoom(to, dir); this.cameras.main.fadeIn(170, 0, 0, 0); });
  }

  updateDepths() {
    this.player.setDepth(50 + this.player.y);
    for (const f of this.followers) f.sprite.setDepth(50 + f.sprite.y - 4);
    if (this.bikeSprite?.visible) this.bikeSprite.setPosition(this.player.x, this.player.y + 7).setDepth(this.player.depth - 1).setFlipX(this.facing === 'left');
  }

  /** Montar/desmontar la BICI: más velocidad + sprite de bici bajo el jugador. */
  toggleBike() {
    this.biking = !this.biking;
    if (this.biking) {
      sfx(this, 'select', 0.5);
      if (!this.bikeSprite || !this.bikeSprite.active) this.bikeSprite = this.add.image(this.player.x, this.player.y + 7, 'item_bici').setScale(1.2);
      this.bikeSprite.setVisible(true);
      this.toast('🚲 ¡En la bici! Vas más rápido (úsala otra vez para bajar).');
    } else {
      this.bikeSprite?.setVisible(false);
      this.toast('Te bajaste de la bici.');
    }
  }

  /** Eclosiona el huevo: nace un Pokémon bebé Nv1 que se une al equipo (o a la caja). */
  hatchEgg() {
    const id = this.run.egg?.speciesId; if (!id) return;
    this.run.egg = null;
    const baby = makeBattleMon(id, 1);
    baby.correa = true;
    if (this.run.party.length < 6) this.run.party.push(baby); else (this.run.box = this.run.box || []).push(baby);
    sfx(this, 'levelup');
    this.cameras.main.flash(220, 255, 255, 200);
    this.toast(`¡El huevo eclosionó en ${baby.name.toUpperCase()}!`);
    this.buildFollowers();
    saveRun(this.registry, this.floorNum);
  }

  /** Comprueba logros y los notifica con un toast (escalonado). */
  checkAch(event) {
    const fresh = tryUnlock({ run: this.run, floor: this.floorNum, event });
    fresh.forEach((a, i) => this.time.delayedCall(i * 1500, () => this.toast('🏆 Logro: ' + a.name)));
  }

  // ---------- IA AUTÓNOMA (juega sola: explora, recoge, pesca, baja, lucha) ----------
  toggleAuto() {
    const on = !this.registry.get('autoplay');
    this.registry.set('autoplay', on);
    this.toast(on ? '🤖 IA ACTIVADA: juega sola (I para parar)' : 'IA desactivada.');
    if (!this.autoTag) this.autoTag = this.add.text(VIEW.w - 4, 22, '', { fontFamily: '"Press Start 2P"', fontSize: '7px', color: '#54e0c8' }).setOrigin(1, 0).setScrollFactor(0).setDepth(99999);
    this.autoTag.setText(on ? '🤖 IA' : '').setVisible(on);
  }

  /** Un "tick" del bot: recoge lo adyacente, desvía a un objeto ALCANZABLE, o
   *  avanza hacia la salida del piso. Paso aleatorio para no atascarse nunca. */
  autoStep() {
    if (this.serviceBusy) return;
    const DS = [['up', 0, -1], ['down', 0, 1], ['left', -1, 0], ['right', 1, 0]];
    const DOOR_T = { N: { c: 7, r: 0 }, S: { c: 7, r: ROWS - 1 }, W: { c: 0, r: 5 }, E: { c: COLS - 1, r: 5 } };
    // 1) objeto/NPC justo al lado → recoger / entrar
    for (const [d, dx, dy] of DS) {
      const c = this.col + dx, r = this.row + dy;
      const pk = this.pickups?.find(p => p.c === c && p.r === r);
      if (pk) { this.faceDir(d); return this.botPickup(pk); }
    }
    // 1.5) MODO DIOS TESTER: explora TODAS las salas; al terminar (o rendirse), vuelve
    //      a la sala de escaleras y DESCIENDE directo — sin depender de pisar el agujero
    //      (en pueblos un edificio puede taparlo) ni de holeTile (null fuera de esa sala).
    if (this.registry.get('godtest')) {
      // límites ESCALADOS por nº de salas (los pisos de 20 salas necesitan más pasos
      // que los de 5). floorSteps NO se reinicia al cambiar de sala.
      const nRooms = this.floor.roomById.size;
      this.floorSteps = (this.floorSteps || 0) + 1;
      // tope DURO: si tras MUCHOS pasos no logró bajar (p.ej. acceso a escaleras
      // bloqueado), lo registra como bug real y FUERZA el descenso (nunca se cuelga).
      if (this.floorSteps > Math.max(6000, nRooms * 600)) {
        const rep = (typeof window !== 'undefined') ? window.__godreport : null;
        if (rep) { (rep.boxedIn = rep.boxedIn || []).push({ floor: this.floorNum, biome: this.biome.id, safe: !!this.floor.isSafeFloor, visited: this.visited.size, rooms: nRooms }); }
        return this.descend();
      }
      const exploring = !this.giveUpExplore && !this.allRoomsVisited();
      if (exploring) {
        if (this.visited.size > (this._lastVisited || 0)) { this._lastVisited = this.visited.size; this.exploreFails = 0; }   // progreso → resetea fallos
        // se rinde de explorar si: gasta demasiados pasos, o falla en ruta muchas veces
        // seguidas (sala no visitada tras una puerta físicamente bloqueada → inalcanzable)
        if (this.floorSteps > nRooms * 300 || (this.exploreFails || 0) > 24) { this.giveUpExplore = true; }
        else {
          const ud = this.nextUnvisitedDoorDir();
          if (ud) {
            const dir = this.botPathDir(DOOR_T[ud]);
            if (dir) return this.botMove(dir);
            this.exploreFails = (this.exploreFails || 0) + 1;   // no pude pathear a esa puerta
          } else { this.giveUpExplore = true; }   // no queda sala alcanzable sin visitar
        }
      }
      if (this.giveUpExplore || this.allRoomsVisited()) {
        if (this.currentRoomId === this.floor.exitId) return this.descend();   // ¡en las escaleras! baja
        const ed = this.nextDoorDir();
        if (ed) { const dir = this.botPathDir(DOOR_T[ed]); if (dir) return this.botMove(dir); }
        for (const door of (this.floor.roomById.get(this.currentRoomId)?.doors || [])) {
          const dir = this.botPathDir(DOOR_T[door.dir]); if (dir) return this.botMove(dir);
        }
        // ENCAJONADO: no puede llegar a la salida. Lo registra y FUERZA el descenso
        // para seguir cubriendo pisos (posible bug real: pueblo que bloquea el camino).
        if (++this.exploreStall > 1200) {
          const rep = (typeof window !== 'undefined') ? window.__godreport : null;
          if (rep) { (rep.boxedIn = rep.boxedIn || []).push({ floor: this.floorNum, biome: this.biome.id, safe: !!this.floor.isSafeFloor, visited: this.visited.size, rooms: this.floor.roomById.size }); }
          return this.descend();
        }
      }
    }
    // 2) escaleras de este piso → ir a bajar
    if (this.holeTile) { const dir = this.botPathDir(this.holeTile); if (dir) return this.botMove(dir); }
    // 3) objeto ALCANZABLE en la sala → ir por él (verifica que haya camino real)
    for (const pk of (this.pickups || [])) {
      for (const [, dx, dy] of DS) {
        const adj = { c: pk.c + dx, r: pk.r + dy };
        if (this.walkable(adj.c, adj.r)) { const dir = this.botPathDir(adj); if (dir) return this.botMove(dir); }
      }
    }
    // 4) avanzar hacia la SALIDA (puerta del camino más corto); si esa puerta no es
    //    alcanzable (obstáculos), prueba CUALQUIER puerta de la sala que sí lo sea.
    const dd = this.nextDoorDir();
    if (dd) { const dir = this.botPathDir(DOOR_T[dd]); if (dir) return this.botMove(dir); }
    const room = this.floor.roomById.get(this.currentRoomId);
    for (const door of (room?.doors || []).slice().sort(() => Math.random() - 0.5)) {
      const dir = this.botPathDir(DOOR_T[door.dir]); if (dir) return this.botMove(dir);
    }
    // 5) desatasco: cualquier paso transitable al azar
    for (const [d, dx, dy] of DS.sort(() => Math.random() - 0.5)) { if (this.walkable(this.col + dx, this.row + dy) || this.isBorderDoor(this.col + dx, this.row + dy)) return this.botMove(d); }
  }

  botPickup(pk) {
    this.run.found.push(pk.key);
    this.run.bag[pk.item] = (this.run.bag[pk.item] || 0) + pk.qty;
    if (this.tilemap.cells[pk.r]?.[pk.c]) this.tilemap.cells[pk.r][pk.c].blocked = false;
    this.toast(`¡IA encontró ${itemAny(pk.item)?.name || pk.item}!`);
    this.tweens.add({ targets: pk.sprite, y: pk.sprite.y - 14, alpha: 0, duration: 250, onComplete: () => pk.sprite.destroy() });
    this.pickups = this.pickups.filter(p => p !== pk);
    saveRun(this.registry, this.floorNum);
  }

  botTarget() {
    // escaleras de este piso → bajar
    if (this.holeTile) return this.holeTile;
    // objeto sin recoger en la sala → casilla adyacente a él
    if (this.pickups?.length) {
      const pk = this.pickups[0];
      for (const d of ['up', 'down', 'left', 'right']) { const [dx, dy] = DIRV[d]; const c = pk.c + dx, r = pk.r + dy; if (this.walkable(c, r)) return { c, r }; }
    }
    // puerta hacia la salida (BFS del grafo de salas)
    const dir = this.nextDoorDir();
    if (dir) return ({ N: { c: 7, r: 0 }, S: { c: 7, r: ROWS - 1 }, W: { c: 0, r: 5 }, E: { c: COLS - 1, r: 5 } })[dir];
    return null;
  }

  /** Dirección (N/S/E/W) de la puerta en el camino más corto a la salida. */
  nextDoorDir() {
    const f = this.floor, start = this.currentRoomId, goal = f.exitId;
    if (start === goal) return null;
    const prev = new Map([[start, null]]), q = [start];
    while (q.length) {
      const id = q.shift();
      for (const dr of (f.roomById.get(id)?.doors || [])) {
        if (!prev.has(dr.to)) { prev.set(dr.to, { from: id, dir: dr.dir }); if (dr.to === goal) { q.length = 0; break; } q.push(dr.to); }
      }
    }
    if (!prev.has(goal)) { const ds = f.roomById.get(start)?.doors; return ds?.length ? ds[0].dir : null; }   // sin ruta: prueba una puerta
    let cur = goal, step = prev.get(cur);
    while (step && step.from !== start) { cur = step.from; step = prev.get(cur); }
    return step?.dir || null;
  }

  /** Primer paso (dir) de un camino BFS dentro de la sala hasta (target). */
  botPathDir(target) {
    const key = (c, r) => r * COLS + c, sk = key(this.col, this.row), tk = key(target.c, target.r);
    const prev = new Map([[sk, null]]), q = [[this.col, this.row]];
    const dirs = [['up', 0, -1], ['down', 0, 1], ['left', -1, 0], ['right', 1, 0]];
    while (q.length) {
      const [c, r] = q.shift();
      if (key(c, r) === tk) break;
      for (const [d, dx, dy] of dirs) {
        const nc = c + dx, nr = r + dy, nk = key(nc, nr);
        if (prev.has(nk)) continue;
        const passable = (nc === target.c && nr === target.r) || this.isBorderDoor(nc, nr) || this.walkable(nc, nr);
        if (!passable) continue;
        prev.set(nk, { from: [c, r], dir: d }); q.push([nc, nr]);
      }
    }
    if (!prev.has(tk)) {
      // sin camino directo: avanza greedy hacia el objetivo si es transitable
      for (const [d, dx, dy] of dirs.sort(() => Math.random() - 0.5)) { const nc = this.col + dx, nr = this.row + dy; if (this.walkable(nc, nr) || this.isBorderDoor(nc, nr)) { if (Math.sign(dx) === Math.sign(target.c - this.col) || Math.sign(dy) === Math.sign(target.r - this.row)) return d; } }
      return null;
    }
    let cur = tk, step = prev.get(cur);
    while (step && key(step.from[0], step.from[1]) !== sk) { cur = key(step.from[0], step.from[1]); step = prev.get(cur); }
    return step?.dir || null;
  }

  botMove(dir) {
    if (dir !== this.facing) this.faceDir(dir);
    const [dx, dy] = DIRV[dir], tc = this.col + dx, tr = this.row + dy;
    if (this.isBorderDoor(tc, tr)) return this.exitVia(tc, tr);
    if (this.walkable(tc, tr)) this.step(tc, tr, dir, false);
  }

  // ---------- MODO DIOS (tester automático): explora todo, no muere, turbo ----------
  /** ¿Se visitaron ya todas las salas de este piso? */
  allRoomsVisited() {
    for (const id of this.floor.roomById.keys()) if (!this.visited.has(id)) return false;
    return true;
  }

  /** Dirección (N/S/E/W) de la puerta hacia la SALA NO VISITADA más cercana (BFS del
   *  grafo de salas). null si no queda ninguna alcanzable. */
  nextUnvisitedDoorDir() {
    const f = this.floor, start = this.currentRoomId;
    const prev = new Map([[start, null]]), q = [start];
    while (q.length) {
      const id = q.shift();
      for (const dr of (f.roomById.get(id)?.doors || [])) {
        if (prev.has(dr.to)) continue;
        prev.set(dr.to, { from: id, dir: dr.dir });
        if (!this.visited.has(dr.to)) {            // sala nueva: traza el PRIMER paso
          let cur = dr.to, step = prev.get(cur);
          while (step && step.from !== start) { cur = step.from; step = prev.get(cur); }
          return step?.dir || dr.dir;
        }
        q.push(dr.to);
      }
    }
    return null;
  }

  /** Paso INSTANTÁNEO (sin tweens): teletransporta al jugador y la cola, y dispara
   *  onTileStep de inmediato. Solo en MODO DIOS, para correr a velocidad bestial. */
  stepInstant(tc, tr) {
    const prev = { col: this.col, row: this.row };
    this.col = tc; this.row = tr;
    const p = this.tileCenter(tc, tr);
    this.player.setPosition(p.x, p.y);
    this.history.unshift(prev);
    this.history.length = Math.min(this.history.length, this.followers.length + 1);
    this.followers.forEach((fl, k) => {
      const tile = this.history[k]; if (!tile) return;
      const fp = this.tileCenter(tile.col, tile.row);
      fl.sprite.setPosition(fp.x, fp.y); fl.homeX = fp.x; fl.homeY = fp.y; fl.wandering = false;
    });
    this.stepping = false;
    this.onTileStep();
  }

  // ---------- CONSOLA DEBUG (Código Konami) — cheats para probar el juego ----------
  /** Da un Pokémon por NOMBRE (o id), eligiendo NIVEL y STATS específicas. */
  dbgGive(name, level = 50, stats = null) {
    const q = String(name || '').trim().toLowerCase();
    const sp = SPECIES.find(s => s.name === q) || SPECIES.find(s => String(s.id) === q) || SPECIES.find(s => s.name.includes(q));
    if (!sp) { this.toast(`DEBUG: no existe "${name}"`); return null; }
    const mon = makeBattleMon(sp.id, Phaser.Math.Clamp((level | 0) || 50, 1, 100));
    if (stats) {
      for (const k of ['hp', 'atk', 'def', 'spa', 'spd', 'spe']) if (stats[k] != null) mon.stats[k] = stats[k] | 0;
      if (stats.hp != null) { mon.maxhp = stats.hp | 0; mon.hp = mon.maxhp; }
    }
    mon.correa = true;
    if (this.run.party.length < 6) this.run.party.push(mon); else (this.run.box = this.run.box || []).push(mon);
    if (!this.run.dex.caught.includes(sp.id)) this.run.dex.caught.push(sp.id);
    this.buildFollowers(); saveRun(this.registry, this.floorNum);
    this.toast(`DEBUG: ${mon.name.toUpperCase()} Nv${mon.level} ${this.run.party.length <= 6 ? 'al equipo' : 'a la caja'}`);
    return mon;
  }

  dbgHeal() {
    this.run.party.forEach(m => { m.hp = m.maxhp; m.status = null; m.pp = Object.fromEntries(m.moves.map(mv => [mv, MOVES[mv].pp])); });
    this.buildFollowers(); this.toast('DEBUG: equipo curado al 100%');
  }

  dbgLevel(n = 1) {
    const m = this.run.party.find(x => x.hp > 0) || this.run.party[0]; if (!m) return;
    m.level = Phaser.Math.Clamp(m.level + (n | 0), 1, 100);
    m.stats = computeStats({ base: m.base, level: m.level, nature: m.nature, ivs: m.ivs, evs: m.evs });
    m.maxhp = m.stats.hp; m.hp = m.maxhp;
    this.toast(`DEBUG: ${m.name.toUpperCase()} ahora Nv${m.level}`);
  }

  dbgWarp(floor) { this.scene.restart({ seed: this.seedBase, floor: Phaser.Math.Clamp(floor | 0, 1, 9111) }); }
  dbgMoney(n) { this.run.money = (this.run.money || 0) + (n | 0); this.toast(`DEBUG: dinero → ${this.run.money} ₽`); }
  dbgItem(key, qty = 10) { this.run.bag[key] = (this.run.bag[key] || 0) + (qty | 0); this.toast(`DEBUG: +${qty} ${key}`); }
  dbgReveal() { for (const id of this.floor.roomById.keys()) this.visited.add(id); this.toast('DEBUG: mapa revelado'); }

  /** En MODO DIOS no se libran combates (invencible por diseño): se registran y se
   *  cuentan como victoria para que la progresión (pools/encuentros) avance normal. */
  godSkipBattle(kind) {
    const rep = (typeof window !== 'undefined') ? (window.__godreport || (window.__godreport = {})) : null;
    if (rep) { rep.encounters = (rep.encounters || 0) + 1; rep.byKind = rep.byKind || {}; rep.byKind[kind] = (rep.byKind[kind] || 0) + 1; }
    this.run.wins = (this.run.wins || 0) + 1;
    this.encCooldown = 6;
  }

  // ---------- encuentros (por casilla) ----------
  onTileStep() {
    // ¿agujero de bajada?
    if (this.holeTile && this.col === this.holeTile.c && this.row === this.holeTile.r) return this.descend();
    // ¿servicio de zona segura?
    if (this.serviceTile && this.col === this.serviceTile.c && this.row === this.serviceTile.r) this.useService(this.serviceTile.type);
    // pisar hierba alta: rustle (sonido + aplastón), aunque no salga encuentro
    const here = this.tilemap?.cells?.[this.row]?.[this.col];
    if (here?.tall) this.rustleGrass(this.col, this.row);
    // ¿tocaste un Pokémon corredor? → combate con esa especie
    this.checkRoamerTouch();
    if (this.transitioning) return;
    // ¿te vio un entrenador? → combate de entrenador
    this.checkTrainerSight();
    if (this.transitioning) return;
    // ¿llegaste al JEFE? → combate de jefe (lo guarda el piso)
    if (this.bossTile && Math.abs(this.bossTile.c - this.col) + Math.abs(this.bossTile.r - this.row) <= 1) return this.startBossBattle();
    // HUEVO: eclosiona al caminar
    if (this.run.egg && --this.run.egg.steps <= 0) this.hatchEgg();

    if (this.floor.isSafeFloor) return;                  // pueblo: nunca combate
    // REPELENTE activo: suprime encuentros mientras queden pasos (persiste en el run)
    if (this.run.repelSteps > 0) { this.run.repelSteps--; if (this.run.repelSteps === 0) this.toast('El efecto del repelente se acabó.'); return; }
    const cell = this.tilemap?.cells?.[this.row]?.[this.col];
    // CUEVA (dark): salvajes en CUALQUIER casilla. BOSQUE/ruinas: solo en hierba alta.
    if (!this.biome.dark && !cell?.tall) return;
    if (this.encCooldown > 0) { this.encCooldown--; return; }
    const base = this.floorNum <= 3 ? 0.12 : this.floorNum <= 8 ? 0.16 : 0.2;
    const rate = this.biome.dark ? base * 0.6 : base;    // en cueva es por cada paso → algo menor
    if (Math.random() < rate) this.startEncounter(false);
  }

  startEncounter(forced = true, opts = {}) {
    if (this.transitioning) return;
    if (this.registry.get('godtest')) return this.godSkipBattle(opts.water ? 'pesca' : 'salvaje');
    // PUEBLO: nada de combates salvajes en todo el piso seguro
    if (this.floor.isSafeFloor) { if (forced) this.toast('Es un pueblo seguro: aquí no hay Pokémon salvajes.'); return; }
    const room = this.floor.roomById.get(this.currentRoomId);
    if (!forced && ['entrance', 'pokecenter', 'shop'].includes(room.type)) return;
    let speciesId, level, handicap = false;
    if (opts.species) {
      // Pokémon CORREDOR tocado: combate con ESA especie
      speciesId = opts.species;
      level = Phaser.Math.Clamp(1 + Math.floor(this.floorNum * 0.9) + Phaser.Math.Between(-1, 1), 1, 95);
    } else if (!opts.water && (this.run.wins || 0) < 2) {
      // los 2 primeros combates: orugas de "Ruta 1" debilitadas → victoria GARANTIZADA
      speciesId = Phaser.Utils.Array.GetRandom([10, 13, 265]);
      level = 1; handicap = true;
    } else {
      // PESCA: solo Pokémon de agua; si no, los favorecidos del bioma
      const favored = opts.water ? ['water'] : (this.biome.typesFavored || ['normal']);
      let pool = [];
      for (const ty of favored) pool = pool.concat(SPECIES_BY_TYPE[ty] || []);
      if (!pool.length) pool = SPECIES.map(s => s.id);
      // RUTAS: pisos bajos = Pokémon básicos (techo de BST por piso); sin legendarios
      const cap = 330 + this.floorNum * 14;
      pool = pool.filter(id => !LEGENDS.has(id) && (BST.get(id) || 999) <= cap);
      if (!pool.length) pool = SPECIES.filter(s => !LEGENDS.has(s.id) && BST.get(s.id) <= cap).map(s => s.id);
      if (!pool.length) pool = [19];
      speciesId = Phaser.Utils.Array.GetRandom(pool);
      // escala suave tipo rutas: piso 1 ≈ Nv1-3, sube de a poco (× dificultad)
      level = Phaser.Math.Clamp(Math.round((1 + Math.floor(this.floorNum * 0.9) + Phaser.Math.Between(-1, 1)) * diffOf(this.run).lvl), 1, 99);
    }
    if (!this.run.party.some(m => m.hp > 0)) return;   // K.O. total: nada de curas gratis (revivir/Centro)
    this.transitioning = true; this.stepping = false;
    this.cameras.main.flash(180, 255, 255, 255);
    this.encCooldown = 6;
    const enemy = makeBattleMon(speciesId, level);
    if (handicap) {   // tutorial: pega flojito y aguanta poco
      enemy.maxhp = enemy.hp = Math.max(7, Math.floor(enemy.maxhp * 0.65));
      enemy.stats.atk = Math.max(3, Math.floor(enemy.stats.atk * 0.45));
      enemy.stats.spa = Math.max(3, Math.floor(enemy.stats.spa * 0.45));
    }
    this.time.delayedCall(200, () => {
      this.scene.pause();
      this.scene.launch('Battle', {
        playerTeam: this.run.party, enemyTeam: [enemy], run: this.run, floor: this.floorNum,
        biome: this.biome, seed: `${this.floor.seed}:enc:${Date.now()}`, returnTo: 'Floor',
      });
    });
  }

  openPokedex() {
    if (this.transitioning || this.stepping) return;
    this.scene.pause();
    this.scene.launch('Pokedex', { run: this.run, returnTo: 'Floor' });
  }

  toast(text) {
    const tx = this.add.text(VIEW.w / 2, 40, text, { fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#ffd76a', backgroundColor: '#05060acc', padding: { x: 8, y: 6 } }).setOrigin(0.5).setScrollFactor(0).setDepth(300001);
    this.tweens.add({ targets: tx, alpha: 0, delay: 1200, duration: 500, onComplete: () => tx.destroy() });
  }

  // ---------- HUD ----------
  buildHud() {
    this.hud = this.add.container(0, 0).setDepth(100000).setScrollFactor(0);
    const bar = this.add.graphics();
    bar.fillStyle(0x05060a, 0.85).fillRect(0, 0, VIEW.w, 26);
    bar.fillStyle(0xffd76a, 1).fillRect(0, 26, VIEW.w, 1);
    this.hudFloor = this.add.text(8, 8, '', { fontFamily: '"Press Start 2P"', fontSize: '9px', color: '#ffd76a' });
    this.hudBiome = this.add.text(VIEW.w - 8, 8, '', { fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#9fb0d0' }).setOrigin(1, 0);
    const hint = this.add.text(VIEW.w / 2, VIEW.h - 4, 'D-pad mover · B correr · M bici · I IA · Esc menú', { fontFamily: '"Press Start 2P"', fontSize: '6px', color: '#5a6a8a' }).setOrigin(0.5, 1);
    this.hud.add([bar, this.hudFloor, this.hudBiome, hint]);
    this.mini = this.add.graphics().setDepth(100000).setScrollFactor(0);
    this.refreshHud();
  }

  refreshHud() {
    this.hudFloor.setText(t('hud.floor', { n: this.floorNum }));
    this.hudBiome.setText(this.biome.name);
    const g = this.mini; g.clear();
    const rooms = this.floor.rooms;
    const xs = rooms.map(r => r.gx), ys = rooms.map(r => r.gy);
    const minx = Math.min(...xs), miny = Math.min(...ys);
    const cell = 9, pad = 6, ox = VIEW.w - (Math.max(...xs) - minx + 1) * cell - pad, oy = VIEW.h - (Math.max(...ys) - miny + 1) * cell - pad;
    g.fillStyle(0x05060a, 0.7).fillRect(ox - 3, oy - 3, (Math.max(...xs) - minx + 1) * cell + 6, (Math.max(...ys) - miny + 1) * cell + 6);
    const COL = { stairs: 0x54e0c8, boss: 0xff5a5a, shop: 0xffd76a, pokecenter: 0xff9fb0, entrance: 0xffffff };
    for (const r of rooms) {
      if (!this.visited.has(r.id) && r.id !== this.currentRoomId) continue;
      const col = r.id === this.currentRoomId ? 0xffffff : (COL[r.type] || 0x5a6a8a);
      g.fillStyle(col, 1).fillRect(ox + (r.gx - minx) * cell, oy + (r.gy - miny) * cell, cell - 2, cell - 2);
    }
  }
}
