// battle.js — Máquina de turnos DETERMINISTA (resuelve A-02 de la auditoría).
// Sin dependencias de DOM: testeable en Node, reusable por BattleScene.
// Orden por prioridad → velocidad (paralizado = ½ vel) → desempate sembrado.
// Emite un LOG de eventos que la escena reproduce/anima.

import { makeRNG } from '../../engine/rng.js';
import { computeStats } from '../pokemon/stats.js';
import { computeDamage } from './damage.js';
import { makeMoveset } from './movepool.js';
import { MOVES } from '../../../data/moves.js';
import { SPECIES_BY_ID } from '../../../data/species.generated.js';
import { BALLS, HEALS, ballBonus } from '../../../data/balls.js';
import { HELD, BERRIES } from '../../../data/items.js';
import { MEGAS } from '../../../data/megas.generated.js';
import { survivesKO, speedItemMultiplier, blocksStatus, blocksStatDrop } from './abilities.js';
import { abilityName } from '../../../data/abilities.js';

/** Construye un combatiente a partir de una especie + nivel (+ opts). */
export function makeBattleMon(speciesId, level, opts = {}) {
  const sp = SPECIES_BY_ID[speciesId];
  if (!sp) throw new Error('especie desconocida: ' + speciesId);
  const abil = (sp.abilities || []).find(a => !a.hidden) || (sp.abilities || [])[0];
  const mon = {
    speciesId, name: opts.nickname || sp.name, level,
    types: sp.types, base: sp.base, sprite: sp.sprite,
    nature: opts.nature, ivs: opts.ivs, evs: opts.evs,
    moves: opts.moves || ((sp.name || '').toLowerCase() === 'ditto' ? ['transform'] : makeMoveset(sp)),
    ball: opts.ball || 'pokeball',   // con qué ball vive (se actualiza al capturarlo)
    ability: opts.ability || abil?.name || null,   // habilidad real (PokeAPI)
    item: opts.item || null,                        // objeto equipado (held)
    itemUsed: false,                                // bayas/banda focus de un uso
    status: null, statusTurns: 0, stages: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
  };
  mon.stats = computeStats({ base: sp.base, level, nature: mon.nature, ivs: mon.ivs, evs: mon.evs });
  mon.maxhp = mon.stats.hp; mon.hp = mon.maxhp;
  mon.pp = Object.fromEntries(mon.moves.map(m => [m, MOVES[m].pp]));
  return mon;
}

const STAGE_MULT = (s) => (s >= 0 ? (2 + s) / 2 : 2 / (2 - s));

function effStat(mon, key) {
  let v = mon.stats[key] * STAGE_MULT(mon.stages[key] || 0);
  if (key === 'spe') { v *= speedItemMultiplier(mon); if (mon.status === 'paralysis') v *= 0.5; }
  return v;
}

export class Battle {
  constructor(teamA, teamB, seed = 'battle', aiStyle = 'wild') {
    this.teams = { A: teamA, B: teamB };
    // nunca arrancar con un Pokémon debilitado en el campo (bug "revive con 0 PS")
    this.active = {
      A: Math.max(0, teamA.findIndex(m => m.hp > 0)),
      B: Math.max(0, teamB.findIndex(m => m.hp > 0)),
    };
    // PARTICIPANTES (lado A): índices de party que han salido al campo. Sirve para
    // repartir XP por igual a todos los que combatieron (no solo el activo final).
    this.participated = new Set([this.active.A]);
    this.rng = makeRNG(seed);
    this.aiStyle = aiStyle;  // 'wild' | 'aggressive' | 'defensive' | 'smart'
    this.turn = 0;
    this.over = false;
    this.winner = null;
    this.result = null;     // 'win' | 'lose' | 'caught' | 'fled'
    this.log = [];
    // FENÓMENOS de batalla (gimmicks): 1 uso por combate cada uno, solo lado A.
    this.gimmicksUsed = { mega: false, z: false, dynamax: false, tera: false };
  }

  /** Aplica un FENÓMENO al Pokémon activo del jugador (Mega/Dinamax/Tera arman
   *  efecto para el resto del combate; Z arma un único golpe potenciado). */
  applyGimmick(side, kind, moveId, variant) {
    if (side !== 'A' || !kind || this.gimmicksUsed[kind]) return;
    const m = this.mon(side);
    this.gimmicksUsed[kind] = true;
    if (kind === 'mega') {
      // FORMA MEGA REAL: cambia tipos + stats base + sprite (data/megas.generated.js).
      const form = MEGAS[m.speciesId];
      if (form) {
        const xy = variant === 'y' ? 'y' : 'x';
        const f = form.dual ? form[xy] : form;   // Charizard/Mewtwo → elige Mega X o Y
        const ratio = m.hp / m.maxhp;
        m.base = f.base; m.types = f.types;
        m.stats = computeStats({ base: f.base, level: m.level, nature: m.nature, ivs: m.ivs, evs: m.evs });
        m.maxhp = m.stats.hp; m.hp = Math.max(1, Math.round(m.maxhp * ratio));
        m.megaSprite = 'mega_' + m.speciesId + (form.dual ? '_' + xy : '');
      } else {
        for (const k of ['atk', 'def', 'spa', 'spd', 'spe']) m.stats[k] = Math.floor(m.stats[k] * 1.3);
      }
      m.mega = true;
      this.log.push({ t: 'gimmick', side, kind, name: m.name, sprite: m.megaSprite, text: `¡${m.name.toUpperCase()} ha MEGAEVOLUCIONADO!` });
    } else if (kind === 'dynamax') {
      m.maxhp = Math.floor(m.maxhp * 2); m.hp = Math.floor(m.hp * 2); m.dynamax = true;
      this.log.push({ t: 'gimmick', side, kind, name: m.name, hp: m.hp, maxhp: m.maxhp, text: `¡${m.name.toUpperCase()} usó DINAMAX y se hizo GIGANTE!` });
    } else if (kind === 'tera') {
      m.tera = m.types[0]; m.teraActive = true;
      this.log.push({ t: 'gimmick', side, kind, name: m.name, text: `¡${m.name.toUpperCase()} se TERACRISTALIZÓ (${m.tera})!` });
    } else if (kind === 'z') {
      m.zArmed = moveId;
      this.log.push({ t: 'gimmick', side, kind, name: m.name, text: `¡${m.name.toUpperCase()} libera su poder Z!` });
    }
  }

  mon(side) { return this.teams[side][this.active[side]]; }
  foeSide(side) { return side === 'A' ? 'B' : 'A'; }
  aliveCount(side) { return this.teams[side].filter(m => m.hp > 0).length; }

  // ---- HABILIDADES / OBJETOS con estado ----

  /** Infligir un estado respetando habilidad (bloqueo) y baya (cura inmediata). */
  inflict(side, status) {
    const m = this.mon(side);
    if (m.status) return false;
    if (blocksStatus(m, status)) { this.log.push({ t: 'ability', side, text: `${m.name.toUpperCase()} evita el estado por ${abilityName(m.ability)}.` }); return false; }
    m.status = status;
    this.log.push({ t: 'status', side, status });
    this.checkBerryCure(side);
    return true;
  }

  /** Bajar una característica respetando Cuerpo Puro / Corte Fuerte. */
  tryStatDrop(side, stat, stages) {
    const m = this.mon(side);
    if (blocksStatDrop(m)) { this.log.push({ t: 'ability', side, text: `¡${abilityName(m.ability)} impide bajar la característica de ${m.name.toUpperCase()}!` }); return; }
    m.stages[stat] = Math.max(-6, Math.min(6, (m.stages[stat] || 0) + stages));
    this.log.push({ t: 'stat', side, stat, stages });
  }

  /** Baya equipada que cura el estado recién sufrido (Meloc, Ziuela, etc.). */
  checkBerryCure(side) {
    const m = this.mon(side); const b = BERRIES[m.item];
    if (!b || m.itemUsed || !b.cure || !m.status) return;
    if (b.cure === 'any' || b.cure === m.status) {
      m.status = null; m.itemUsed = true;
      this.log.push({ t: 'berry', side, item: m.item, text: `¡${m.name.toUpperCase()} comió su ${b.name} y se recuperó!` });
      m.item = null;
    }
  }

  /** Disparadores de ENTRADA al campo (Intimidación). */
  triggerSwitchIn(side) {
    const m = this.mon(side);
    // IMPOSTER: al entrar, Ditto copia automáticamente al rival activo.
    if (m.ability === 'imposter' && !m._origForm) {
      const foe = this.mon(this.foeSide(side));
      if (foe && foe.hp > 0 && !foe._origForm) this.doTransform(side, this.foeSide(side));
    }
    if (m.ability === 'intimidate') {
      const foeS = this.foeSide(side);
      if (this.mon(foeS).hp > 0) {
        this.log.push({ t: 'ability', side, text: `¡${m.name.toUpperCase()} intimida al rival!` });
        this.tryStatDrop(foeS, 'atk', -1);
      }
    }
  }

  /** Habilidades de los líderes al empezar el combate (devuelve su log). */
  leadAbilities() {
    this.log = [];
    this.triggerSwitchIn('B');
    this.triggerSwitchIn('A');
    return this.log.splice(0);
  }

  /** IA por ARQUETIPOS (§7 auditoría), determinista vía el rng del combate.
   *  wild: bestia salvaje — buen golpe, pero 30% instinto (movimiento al azar).
   *  aggressive: SIEMPRE el máximo daño; prioridad si puede rematar.
   *  defensive: abre con estados/bajadas de stat, luego pega.
   *  smart: daño esperado real + no repite estados inútiles + remata con prioridad. */
  chooseAI(side) {
    const me = this.mon(side), foe = this.mon(this.foeSide(side));
    const usable = me.moves.filter(id => (me.pp[id] ?? 0) > 0);
    if (!usable.length) return { type: 'move', move: 'struggle' };
    const probe = makeRNG('probe'); // estimación estable, no consume el rng real
    const dmg = (id) => { const d = computeDamage(me, foe, id, probe); return d.damage * (d.eff || 1); };
    const statusMoves = usable.filter(id => MOVES[id].cat === 'status');
    const attackMoves = usable.filter(id => MOVES[id].cat !== 'status');
    const bestAttack = attackMoves.sort((a, b) => dmg(b) - dmg(a))[0];
    const killers = attackMoves.filter(id => dmg(id) >= foe.hp);
    const priorityKill = killers.find(id => (MOVES[id].prio || 0) > 0);

    switch (this.aiStyle) {
      case 'aggressive':
        return { type: 'move', move: priorityKill || killers[0] || bestAttack || usable[0] };
      case 'defensive': {
        // primeros turnos: estado al rival / bajar sus stats (si aún sirve)
        const useful = statusMoves.find(id => {
          const e = MOVES[id].effect || {};
          if (e.status) return !foe.status && e.target === 'foe';
          return true;
        });
        if (this.turn <= 2 && useful) return { type: 'move', move: useful };
        return { type: 'move', move: bestAttack || usable[0] };
      }
      case 'smart': {
        if (priorityKill || killers[0]) return { type: 'move', move: priorityKill || killers[0] };
        const useful = statusMoves.find(id => {
          const e = MOVES[id].effect || {};
          return e.status ? (!foe.status && e.target === 'foe') : this.turn <= 3;
        });
        // estado temprano si el rival está sano; si no, máximo daño
        if (useful && foe.hp > foe.maxhp * 0.6 && this.rng.float() < 0.6) return { type: 'move', move: useful };
        return { type: 'move', move: bestAttack || usable[0] };
      }
      case 'wild':
      default: {
        if (this.rng.float() < 0.3) return { type: 'move', move: usable[Math.floor(this.rng.float() * usable.length)] };
        return { type: 'move', move: bestAttack || usable[0] };
      }
    }
  }

  /** Resuelve un turno completo. playerAction puede ser:
   *  {type:'move',move} | {type:'item',item} | {type:'switch',index} | {type:'run'} */
  resolveTurn(playerAction) {
    if (this.over) return this.log.splice(0);
    this.turn++;
    this.log = [];
    const pa = playerAction || { type: 'move', move: this.chooseAI('A').move };

    // FENÓMENO armado por el jugador este turno (va en la acción → los replays
    // lo reproducen igual). Mega/Dinamax/Tera potencian el resto del combate; Z el golpe.
    if (pa.gimmick) this.applyGimmick('A', pa.gimmick, pa.move, pa.megaVariant);

    // acciones especiales del jugador (objeto/cambio/huida): actúa primero,
    // luego el rival ataca si el combate sigue.
    if (pa.type && pa.type !== 'move') {
      this.doPlayerSpecial(pa);
      if (!this.over && this.mon('B').hp > 0 && this.mon('A').hp > 0) {
        this.doMove('B', this.chooseAI('B'));
        this.endOfTurnStatus();
        this.checkEnd();
      }
      return this.log.splice(0);
    }

    const actions = { A: { move: pa.move }, B: this.chooseAI('B') };

    // orden de acción
    const order = ['A', 'B'].sort((s1, s2) => {
      const p1 = MOVES[actions[s1].move]?.prio || 0, p2 = MOVES[actions[s2].move]?.prio || 0;
      if (p1 !== p2) return p2 - p1;
      const sp1 = effStat(this.mon(s1), 'spe'), sp2 = effStat(this.mon(s2), 'spe');
      if (sp1 !== sp2) return sp2 - sp1;
      return this.rng.float() < 0.5 ? -1 : 1;
    });

    for (const side of order) {
      if (this.over) break;
      if (this.mon(side).hp <= 0) continue;
      this.doMove(side, actions[side]);
    }

    this.endOfTurnStatus();
    this.checkEnd();
    return this.log.splice(0);
  }

  /** PVP LOCKSTEP: resuelve un turno con las acciones REALES de AMBOS jugadores
   *  (no IA). Es determinista por seed → ambos clientes producen el MISMO log sin
   *  desincronizarse. v1 solo movimientos (sin objetos/cambios/fenómenos). */
  resolveTurnPvp(actA, actB) {
    if (this.over) return this.log.splice(0);
    this.turn++;
    this.log = [];
    const moveOf = (side, act) => {
      const m = this.mon(side);
      const id = act?.move;
      return (id && (m.pp[id] ?? 0) > 0) ? id : 'struggle';
    };
    const actions = { A: { move: moveOf('A', actA) }, B: { move: moveOf('B', actB) } };
    const order = ['A', 'B'].sort((s1, s2) => {
      const p1 = MOVES[actions[s1].move]?.prio || 0, p2 = MOVES[actions[s2].move]?.prio || 0;
      if (p1 !== p2) return p2 - p1;
      const sp1 = effStat(this.mon(s1), 'spe'), sp2 = effStat(this.mon(s2), 'spe');
      if (sp1 !== sp2) return sp2 - sp1;
      return this.rng.float() < 0.5 ? -1 : 1;
    });
    for (const side of order) {
      if (this.over) break;
      if (this.mon(side).hp <= 0) continue;
      this.doMove(side, actions[side]);
    }
    this.endOfTurnStatus();
    this.checkEnd();
    return this.log.splice(0);
  }

  /** Índice del próximo Pokémon vivo de un lado (para auto-cambio en PVP).
   *  Determinista (primer vivo) → ambos clientes cambian al mismo. -1 si ninguno. */
  nextAlive(side) {
    return this.teams[side].findIndex(m => m.hp > 0);
  }

  endOfTurnStatus() {
    for (const side of ['A', 'B']) {
      let m = this.mon(side);
      if (m.hp <= 0) continue;
      // daño por estado
      if (m.status === 'burn') this.applyChip(side, Math.max(1, Math.floor(m.maxhp / 16)), 'quemadura');
      else if (m.status === 'poison') this.applyChip(side, Math.max(1, Math.floor(m.maxhp / 8)), 'veneno');
      m = this.mon(side); if (m.hp <= 0) continue;   // pudo debilitarse por el estado
      // RESTOS: recupera 1/16 de PS
      const held = HELD[m.item];
      if (held?.endTurnHeal && m.hp < m.maxhp) {
        const amt = Math.max(1, Math.floor(m.maxhp * held.endTurnHeal)); m.hp = Math.min(m.maxhp, m.hp + amt);
        this.log.push({ t: 'item', side, item: m.item, amount: amt, hp: m.hp, maxhp: m.maxhp, text: `${m.name.toUpperCase()} recuperó PS con sus ${held.name}.` });
      }
      // BAYA de PS bajos (Aranja/Zidra): cura al bajar de la mitad
      const berry = BERRIES[m.item];
      if (berry && !m.itemUsed && berry.trigger === 'lowhp' && m.hp <= Math.floor(m.maxhp / 2) && m.hp > 0) {
        const amt = berry.healFrac ? Math.floor(m.maxhp * berry.healFrac) : (berry.healFlat || 0);
        m.hp = Math.min(m.maxhp, m.hp + amt); m.itemUsed = true; const used = m.item; m.item = null;
        this.log.push({ t: 'berry', side, item: used, amount: amt, hp: m.hp, maxhp: m.maxhp, text: `¡${m.name.toUpperCase()} comió su ${berry.name} y recuperó ${amt} PS!` });
      }
      // IMPULSO (Speed Boost): +1 Velocidad cada turno
      if (m.ability === 'speed-boost' && (m.stages.spe || 0) < 6) {
        this.log.push({ t: 'ability', side, text: `¡${m.name.toUpperCase()} aceleró con Impulso!` });
        this.applyStage(side, 'spe', 1);
      }
    }
  }

  // --- acciones especiales del jugador (lado A) ---
  doPlayerSpecial(pa) {
    if (pa.type === 'run') return this.tryRun();
    if (pa.type === 'switch') return this.doSwitch('A', pa.index);
    if (pa.type === 'item') return this.useItem(pa.item);
  }

  tryRun() {
    const me = this.mon('A'), foe = this.mon('B');
    const chance = Math.max(0.25, Math.min(0.95, 0.5 + (me.stats.spe - foe.stats.spe) / 200 + this.turn * 0.05));
    if (this.rng.float() < chance) { this.over = true; this.winner = null; this.result = 'fled'; this.log.push({ t: 'run' }); this.log.push({ t: 'end', winner: null, result: 'fled' }); this._revertTransforms(); }
    else this.log.push({ t: 'runfail' });
  }

  doSwitch(side, index) {
    const team = this.teams[side];
    if (index == null || index < 0 || index >= team.length || team[index].hp <= 0 || index === this.active[side]) { this.log.push({ t: 'badswitch', side }); return; }
    const out = this.mon(side);
    if (out.ability === 'natural-cure' && out.status) out.status = null;   // se cura al retirarse
    this._revertOne(out);   // la transformación de Ditto se deshace al cambiar
    this.active[side] = index;
    if (side === 'A') this.participated.add(index);
    const m = this.mon(side);
    this.log.push({ t: 'switchIn', side, name: m.name, speciesId: m.speciesId, hp: m.hp, maxhp: m.maxhp, ball: m.ball });
    this.triggerSwitchIn(side);
  }

  useItem(item) {
    const ball = BALLS[item];
    if (ball) {
      const me = this.mon('A'), foe = this.mon('B');
      const sp = SPECIES_BY_ID[foe.speciesId] || {};
      let bonus = ballBonus(item, { foe, turn: this.turn, caught: this.ctx?.caught || [], baseOf: { spe: foe.base?.spe, weight: sp.weight } });
      if (ball.rule === 'level') bonus = me.level >= foe.level * 2 ? 4 : me.level > foe.level ? 2 : 1;
      return this.throwBall(item, bonus, ball.rule === 'heal');
    }
    const h = HEALS[item];
    if (!h) return;
    if (h.revive != null) {
      // revive al PRIMER debilitado del equipo (no vuelve al campo solo)
      const idx = this.teams.A.findIndex(m => m.hp <= 0);
      if (idx === -1) { this.log.push({ t: 'noeffect' }); return; }
      const m = this.teams.A[idx];
      m.hp = Math.max(1, Math.floor(m.maxhp * h.revive)); m.status = null;
      this.log.push({ t: 'revive', index: idx, name: m.name, hp: m.hp, maxhp: m.maxhp });
      return;
    }
    const me = this.mon('A'); const before = me.hp;
    me.hp = h.heal === 'full' ? me.maxhp : Math.min(me.maxhp, me.hp + h.heal);
    if (h.cure) me.status = null;
    this.log.push({ t: 'heal', side: 'A', item, amount: me.hp - before, hp: me.hp });
  }

  throwBall(item, bonus, healAfter = false) {
    const foe = this.mon('B');
    this.log.push({ t: 'throw', item });
    const { caught, shakes } = this.catchCalc(foe, bonus);
    if (caught) {
      foe.ball = item;   // recordar SU ball para sacadas/cambios futuros
      if (healAfter) { foe.hp = foe.maxhp; foe.status = null; }   // Sana Ball
      this.over = true; this.winner = 'A'; this.result = 'caught';
      this.log.push({ t: 'caught', speciesId: foe.speciesId, name: foe.name, shakes, item });
      this.log.push({ t: 'end', winner: 'A', result: 'caught' });
      this._revertTransforms();
    } else {
      this.log.push({ t: 'catchfail', shakes });
    }
  }

  /** Fórmula de captura (aprox. Gen) — determinista vía el rng del combate. */
  catchCalc(foe, ballBonus) {
    const bst = Object.values(foe.base).reduce((a, b) => a + b, 0);
    const rate = Math.max(25, Math.min(220, 210 - Math.floor(bst / 6))); // BST alto = más difícil
    const statusBonus = (foe.status === 'freeze') ? 2 : (foe.status ? 1.5 : 1);
    const a = ((3 * foe.maxhp - 2 * foe.hp) * rate * ballBonus) / (3 * foe.maxhp) * statusBonus;
    if (a >= 255) return { caught: true, shakes: 4 };
    const b = Math.floor(65536 / Math.pow(255 / a, 0.1875));
    let shakes = 0;
    for (let i = 0; i < 4; i++) { if (this.rng.int(0, 65535) < b) shakes++; else break; }
    return { caught: shakes === 4, shakes };
  }

  doMove(side, action) {
    const me = this.mon(side), foeSide = this.foeSide(side), foe = this.mon(foeSide);

    // estados que impiden actuar
    if (me.status === 'paralysis' && this.rng.float() < 0.25) { this.log.push({ t: 'flinch', side, reason: 'paralizado' }); return; }
    if (me.status === 'freeze') {
      if (this.rng.float() < 0.2) { me.status = null; this.log.push({ t: 'thaw', side }); }
      else { this.log.push({ t: 'flinch', side, reason: 'congelado' }); return; }
    }

    let moveId = action.move;
    if ((me.pp[moveId] ?? 0) <= 0) moveId = 'struggle';
    if (moveId !== 'struggle') me.pp[moveId]--;
    const move = MOVES[moveId];
    this.log.push({ t: 'move', side, move: moveId, name: move.name });

    if (move.cat === 'status') { this.applyStatusMove(side, foeSide, move); return; }

    const res = computeDamage(me, foe, moveId, this.rng);
    if (res.immune) { this.handleImmune(side, foeSide, res.immune); return; }
    if (res.missed) { this.log.push({ t: 'miss', side }); return; }

    const hpBefore = foe.hp;
    let dmg = res.damage;
    // FENÓMENOS: Movimiento Z (×1.8 un solo golpe) y Teracristal (+STAB del tipo tera)
    if (me.zArmed === moveId) { dmg = Math.floor(dmg * 1.8); me.zArmed = null; this.log.push({ t: 'zmove', side, name: me.name, ztype: move.type, base: move.name }); }
    if (me.teraActive && me.tera === move.type && move.cat !== 'status') dmg = Math.floor(dmg * 1.3);
    if (me.dynamax && move.cat !== 'status') dmg = Math.floor(dmg * 1.4);   // Movimientos Max pegan más fuerte
    // baya reductora de daño por tipo supereficaz (un solo uso)
    const rb = BERRIES[foe.item];
    if (rb && !foe.itemUsed && rb.resist === move.type && res.eff > 1) {
      dmg = Math.floor(dmg / 2); foe.itemUsed = true; const used = foe.item; foe.item = null;
      this.log.push({ t: 'berry', side: foeSide, item: used, text: `¡${foe.name.toUpperCase()} amortiguó el golpe con su ${rb.name}!` });
    }
    // Robustez / Banda Focus: sobrevivir a 1 PS un golpe letal desde full
    let survived = null;
    if (dmg >= hpBefore) survived = survivesKO(foe, hpBefore);
    if (survived) { dmg = hpBefore - 1; if (survived === 'item') foe.itemUsed = true; }
    foe.hp = Math.max(0, hpBefore - dmg);
    this.log.push({ t: 'damage', side, target: foeSide, amount: dmg, eff: res.eff, crit: res.crit, hp: foe.hp, maxhp: foe.maxhp });
    // MECÁNICA ÚNICA DE JEFE: al bajar del 50% PS por 1ª vez, ENFURECE (se cura +
    // sube Ataque/Vel). Determinista (depende solo del HP) → replays lo reproducen.
    if (foe.isBossMon && !foe.enraged && foe.hp > 0 && foe.hp <= Math.floor(foe.maxhp * 0.5)) {
      foe.enraged = true;
      foe.hp = Math.min(foe.maxhp, foe.hp + Math.floor(foe.maxhp * 0.25));
      foe.stages.atk = Math.min(6, (foe.stages.atk || 0) + 2);
      foe.stages.spe = Math.min(6, (foe.stages.spe || 0) + 1);
      this.log.push({ t: 'bossrage', side: foeSide, name: foe.name, hp: foe.hp, maxhp: foe.maxhp });
    }
    if (survived) this.log.push({ t: 'ability', side: foeSide, text: survived === 'sturdy' ? `¡${foe.name.toUpperCase()} aguantó con Robustez!` : `¡${foe.name.toUpperCase()} resistió con su Banda Focus!` });

    // Vidasfera: retroceso al atacante
    const lo = HELD[me.item];
    if (lo?.recoil && dmg > 0) { const r = Math.max(1, Math.floor(me.maxhp * lo.recoil)); me.hp = Math.max(0, me.hp - r); this.log.push({ t: 'recoil', side, amount: r, hp: me.hp }); }
    if (move.recoil) { const r = Math.max(1, Math.floor(dmg * move.recoil)); me.hp = Math.max(0, me.hp - r); this.log.push({ t: 'recoil', side, amount: r, hp: me.hp }); }

    // efecto secundario del movimiento (estado / cambio de stat)
    if (move.effect && foe.hp > 0) this.maybeEffect(side, foeSide, move.effect);
    // habilidad de CONTACTO del defensor (movimiento físico)
    if (move.cat === 'physical' && foe.hp > 0) this.contactAbility(side, foeSide);

    if (me.hp <= 0) this.onFaint(side);        // retroceso/Piel Tosca puede tumbar al atacante
    if (foe.hp <= 0) this.onFaint(foeSide);
  }

  /** Inmunidad/absorción al recibir un movimiento (habilidad del defensor). */
  handleImmune(side, foeSide, imm) {
    const foe = this.mon(foeSide);
    if (imm.kind === 'absorb') {
      const before = foe.hp; foe.hp = Math.min(foe.maxhp, foe.hp + Math.floor(foe.maxhp / 4));
      this.log.push({ t: 'absorb', side: foeSide, ability: imm.ability, amount: foe.hp - before, hp: foe.hp, maxhp: foe.maxhp });
    } else if (imm.kind === 'redirect') {
      this.log.push({ t: 'ability', side: foeSide, text: `¡${foe.name.toUpperCase()} atrajo el ataque con ${abilityName(imm.ability)}!` });
      this.applyStage(foeSide, imm.stat, 1);
    } else if (imm.kind === 'flashfire') {
      foe.flashfire = true;
      this.log.push({ t: 'ability', side: foeSide, text: `¡${foe.name.toUpperCase()} absorbió el fuego con ${abilityName(imm.ability)}!` });
    } else {
      this.log.push({ t: 'ability', side: foeSide, text: `No afecta a ${foe.name.toUpperCase()} (${abilityName(imm.ability)}).` });
    }
  }

  /** Reacción del defensor al ser golpeado por contacto (físico). */
  contactAbility(attackerSide, defenderSide) {
    const def = this.mon(defenderSide), atk = this.mon(attackerSide);
    if (def.ability === 'rough-skin') {
      const r = Math.max(1, Math.floor(atk.maxhp / 8)); atk.hp = Math.max(0, atk.hp - r);
      this.log.push({ t: 'chip', side: attackerSide, amount: r, reason: abilityName(def.ability), hp: atk.hp });
      return;
    }
    const onContact = { static: 'paralysis', 'flame-body': 'burn', 'poison-point': 'poison' }[def.ability];
    if (onContact && !atk.status && this.rng.float() < 0.3) {
      this.log.push({ t: 'ability', side: defenderSide, text: `¡${abilityName(def.ability)} de ${def.name.toUpperCase()}!` });
      this.inflict(attackerSide, onContact);
    }
  }

  applyStatusMove(side, foeSide, move) {
    const e = move.effect; if (!e) return;
    if (e.kind === 'transform') return this.doTransform(side, foeSide);
    const targetSide = e.target === 'foe' ? foeSide : side;
    if (e.status) this.inflict(targetSide, e.status);
    if (e.stat) this.applyStage(targetSide, e.stat, e.stages);
  }

  maybeEffect(side, foeSide, e) {
    if (e.chance != null && this.rng.float() >= e.chance) return;
    const targetSide = e.target === 'foe' ? foeSide : side;
    if (e.status) this.inflict(targetSide, e.status);
    if (e.stat) this.applyStage(targetSide, e.stat, e.stages);
  }

  /** Cambia una característica: las BAJADAS pasan por tryStatDrop (Cuerpo Puro). */
  applyStage(side, stat, stages) {
    if (stages < 0) return this.tryStatDrop(side, stat, stages);
    const m = this.mon(side);
    m.stages[stat] = Math.max(-6, Math.min(6, (m.stages[stat] || 0) + stages));
    this.log.push({ t: 'stat', side, stat, stages });
  }

  applyChip(side, amount, reason) {
    const m = this.mon(side); m.hp = Math.max(0, m.hp - amount);
    this.log.push({ t: 'chip', side, amount, reason, hp: m.hp });
    if (m.hp <= 0) this.onFaint(side);
  }

  onFaint(side) {
    this.log.push({ t: 'faint', side, name: this.mon(side).name });
    this._revertOne(this.mon(side));   // si era Ditto transformado, recupera su forma
    const next = this.teams[side].findIndex(m => m.hp > 0);
    if (next === -1) { this.over = true; this.winner = this.foeSide(side); this.result = this.winner === 'A' ? 'win' : 'lose'; this.log.push({ t: 'end', winner: this.winner, result: this.result }); this._revertTransforms(); }
    else {
      this.active[side] = next;
      if (side === 'A') this.participated.add(next);
      const nm2 = this.teams[side][next];
      this.log.push({ t: 'switch', side, name: nm2.name, speciesId: nm2.speciesId, hp: nm2.hp, maxhp: nm2.maxhp, ball: nm2.ball });
      this.triggerSwitchIn(side);
    }
  }

  /** TRANSFORMACIÓN (Ditto / Imposter): copia especie, tipos, stats, movimientos y
   *  habilidad del objetivo. El HP propio NO se copia. Es REVERSIBLE (snapshot en
   *  _origForm) para no corromper el Pokémon guardado al terminar el combate/cambiar. */
  doTransform(side, fromSide) {
    const me = this.mon(side), src = this.mon(fromSide);
    if (me._origForm || src._origForm || !src || src.hp <= 0) {
      this.log.push({ t: 'transformfail', side, name: me.name, text: `¡El ataque de ${me.name.toUpperCase()} falló!` });
      return;
    }
    me._origForm = {
      speciesId: me.speciesId, name: me.name, types: me.types, base: me.base,
      sprite: me.sprite, ability: me.ability, moves: me.moves,
      stats: { ...me.stats }, pp: { ...me.pp }, stages: { ...me.stages },
    };
    const origName = me.name;
    me.types = [...src.types]; me.base = src.base; me.sprite = src.sprite;
    me.speciesId = src.speciesId; me.ability = src.ability;
    me.moves = [...src.moves];
    me.pp = Object.fromEntries(me.moves.map(id => [id, Math.min(5, MOVES[id]?.pp ?? 5)]));
    me.stages = { ...src.stages };
    const ns = computeStats({ base: src.base, level: me.level, nature: me.nature, ivs: me.ivs, evs: me.evs });
    ns.hp = me._origForm.stats.hp;   // el HP NO se copia: conserva el suyo
    me.stats = ns;
    me.transformedInto = src.speciesId;
    this.log.push({ t: 'transform', side, into: src.speciesId, sprite: src.sprite, name: origName, text: `¡${origName.toUpperCase()} se TRANSFORMÓ en ${src.name.toUpperCase()}!` });
  }

  /** Deshace la transformación de un combatiente (si la tenía). Conserva su HP actual. */
  _revertOne(m) {
    const o = m && m._origForm; if (!o) return;
    m.speciesId = o.speciesId; m.name = o.name; m.types = o.types; m.base = o.base;
    m.sprite = o.sprite; m.ability = o.ability; m.moves = o.moves;
    m.stats = o.stats; m.pp = o.pp; m.stages = o.stages;
    delete m._origForm; delete m.transformedInto;
  }

  /** Revierte TODAS las transformaciones (al terminar el combate). */
  _revertTransforms() { for (const s of ['A', 'B']) for (const m of this.teams[s]) this._revertOne(m); }

  checkEnd() {
    for (const side of ['A', 'B']) if (this.aliveCount(side) === 0 && !this.over) {
      this.over = true; this.winner = this.foeSide(side); this.result = this.winner === 'A' ? 'win' : 'lose';
      this.log.push({ t: 'end', winner: this.winner, result: this.result });
    }
    if (this.over) this._revertTransforms();
  }
}
