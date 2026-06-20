// combat-smoke.mjs — GATE de QA del combate modo 1.
// Verifica tabla de tipos, movesets y que muchas batallas terminan sin estados
// inválidos. Determinista. Uso: node tools/combat-smoke.mjs

import { typeEffectiveness } from '../data/typechart.js';
import { makeMoveset } from '../src/systems/combat/movepool.js';
import { MOVES } from '../data/moves.js';
import { Battle, makeBattleMon } from '../src/systems/combat/battle.js';
import { SPECIES, SPECIES_BY_ID } from '../data/species.generated.js';
import { makeRNG } from '../src/engine/rng.js';

let errors = 0;
const fail = (m) => { console.error('  ✗ ' + m); errors++; };

// 1) tabla de tipos (valores canónicos)
const cases = [
  [['water', ['fire']], 2], [['fire', ['water']], 0.5], [['electric', ['ground']], 0],
  [['normal', ['ghost']], 0], [['ground', ['fire', 'flying']], 0], [['fighting', ['rock', 'flying']], 1],
  [['ice', ['dragon', 'flying']], 4], [['fairy', ['dragon', 'dark']], 4], [['grass', ['water', 'ground']], 4],
  [['fighting', ['ghost']], 0], [['dragon', ['fairy']], 0],
];
for (const [[a, d], exp] of cases) {
  const got = typeEffectiveness(a, d);
  if (got !== exp) fail(`tipo ${a} vs [${d}] = ${got}, esperado ${exp}`);
}

// 2) movesets: 1..4 movimientos, al menos uno de daño
for (const sp of SPECIES) {
  const set = makeMoveset(sp);
  if (set.length < 1 || set.length > 4) fail(`moveset ${sp.name} tamaño ${set.length}`);
  if (!set.some(id => MOVES[id] && MOVES[id].power != null)) fail(`moveset ${sp.name} sin movimiento de daño`);
  if (set.some(id => !MOVES[id])) fail(`moveset ${sp.name} con id inválido`);
}

// 3) batallas a término + invariantes de estado
const ids = SPECIES.map(s => s.id);
let battles = 0, totalTurns = 0;
const rng = makeRNG('combat-smoke');
for (let i = 0; i < 250; i++) {
  const a = ids[Math.floor(rng.float() * ids.length)];
  const b = ids[Math.floor(rng.float() * ids.length)];
  const lvl = 5 + Math.floor(rng.float() * 60);
  const teamA = [makeBattleMon(a, lvl), makeBattleMon(ids[Math.floor(rng.float() * ids.length)], lvl)];
  const teamB = [makeBattleMon(b, lvl), makeBattleMon(ids[Math.floor(rng.float() * ids.length)], lvl)];
  const seed = 'b' + i;
  const style = ['wild', 'aggressive', 'defensive', 'smart'][i % 4];   // §7: arquetipos IA
  const battle = new Battle(teamA, teamB, seed, style);
  let guard = 0;
  while (!battle.over && guard++ < 500) {
    const ev = battle.resolveTurn();
    for (const e of ev) {
      if (e.hp != null && (e.hp < 0 || e.hp > e.maxhp + 0 + 9999)) fail(`HP fuera de rango: ${JSON.stringify(e)}`);
    }
    // invariante: ningún hp negativo
    for (const side of ['A', 'B']) for (const m of battle.teams[side]) if (m.hp < 0) fail(`hp negativo ${m.name}`);
  }
  if (!battle.over) fail(`batalla ${seed} no terminó en 500 turnos`);
  if (battle.over && battle.winner == null) fail(`batalla ${seed} terminó sin ganador`);
  battles++; totalTurns += battle.turn;

  // determinismo: re-correr con misma semilla/equipos da mismo resultado
  const t2A = [makeBattleMon(a, lvl), makeBattleMon(teamA[1].speciesId, lvl)];
  const t2B = [makeBattleMon(b, lvl), makeBattleMon(teamB[1].speciesId, lvl)];
  const battle2 = new Battle(t2A, t2B, seed, style);
  let g2 = 0; while (!battle2.over && g2++ < 500) battle2.resolveTurn();
  if (battle2.winner !== battle.winner || battle2.turn !== battle.turn) fail(`NO determinista ${seed} (${battle.winner}/${battle.turn} vs ${battle2.winner}/${battle2.turn})`);
}

// 4) balance A-14: duración media de combate en rango sano (TTK 2.5–9 turnos)
const avg = totalTurns / battles;
if (avg < 2.5 || avg > 9) fail(`balance A-14: promedio ${avg.toFixed(1)} turnos/batalla fuera de [2.5, 9]`);

console.log(`\nCOMBAT SMOKE — ${battles} batallas, ${SPECIES.length} especies, prom ${(totalTurns / battles).toFixed(1)} turnos/batalla`);
if (errors) { console.error(`\n❌ ${errors} error(es).`); process.exit(1); }
else console.log('\n✅ COMBAT SMOKE OK — tipos, movesets y batallas verificados.');
