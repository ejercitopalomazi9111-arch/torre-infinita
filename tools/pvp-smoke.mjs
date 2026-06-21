// pvp-smoke.mjs — GATE de determinismo del PVP LOCKSTEP.
// Dos simulaciones independientes con el MISMO seed, equipos y secuencia de
// acciones de AMBOS lados deben producir EXACTAMENTE el mismo resultado (HP,
// ganador, turnos). Es la garantía de que los dos clientes online no se
// desincronizan. Uso: node tools/pvp-smoke.mjs
import { Battle, makeBattleMon } from '../src/systems/combat/battle.js';
import { SPECIES } from '../data/species.generated.js';
import { makeRNG } from '../src/engine/rng.js';

let errors = 0;
const fail = (m) => { console.error('  ✗ ' + m); errors++; };
const ids = SPECIES.map(s => s.id);
const rng = makeRNG('pvp-smoke');

// elige una acción de movimiento determinista para un lado (1er PP disponible),
// con auto-cambio al primer vivo (igual que la escena PVP en ambos clientes).
function runPvp(teamA, teamB, seed, picksA, picksB) {
  const b = new Battle(teamA, teamB, seed, 'wild');
  let guard = 0, t = 0;
  while (!b.over && guard++ < 400) {
    const ma = b.mon('A'), mb = b.mon('B');
    const aMove = (ma.moves[picksA[t % picksA.length] % ma.moves.length]) || 'struggle';
    const bMove = (mb.moves[picksB[t % picksB.length] % mb.moves.length]) || 'struggle';
    b.resolveTurnPvp({ type: 'move', move: aMove }, { type: 'move', move: bMove });
    t++;
    for (const side of ['A', 'B']) if (b.mon(side).hp <= 0 && !b.over) { const nx = b.nextAlive(side); if (nx >= 0) b.active[side] = nx; }
  }
  return { winner: b.winner, turn: b.turn, over: b.over, hpA: b.teams.A.map(m => m.hp), hpB: b.teams.B.map(m => m.hp) };
}

let n = 0;
for (let i = 0; i < 200; i++) {
  const a1 = ids[Math.floor(rng.float() * ids.length)], a2 = ids[Math.floor(rng.float() * ids.length)];
  const b1 = ids[Math.floor(rng.float() * ids.length)], b2 = ids[Math.floor(rng.float() * ids.length)];
  const lvl = 10 + Math.floor(rng.float() * 50);
  const seed = 'pvp' + i;
  const picksA = [0, 1, 2, 3].map(() => Math.floor(rng.float() * 4));
  const picksB = [0, 1, 2, 3].map(() => Math.floor(rng.float() * 4));
  // CLIENTE 1 (host) y CLIENTE 2 (joiner) corren la MISMA simulación canónica.
  const r1 = runPvp([makeBattleMon(a1, lvl), makeBattleMon(a2, lvl)], [makeBattleMon(b1, lvl), makeBattleMon(b2, lvl)], seed, picksA, picksB);
  const r2 = runPvp([makeBattleMon(a1, lvl), makeBattleMon(a2, lvl)], [makeBattleMon(b1, lvl), makeBattleMon(b2, lvl)], seed, picksA, picksB);
  if (!r1.over) fail(`PVP ${seed} no terminó`);
  if (r1.winner == null) fail(`PVP ${seed} sin ganador`);
  if (r1.winner !== r2.winner || r1.turn !== r2.turn) fail(`DESYNC ${seed}: ${r1.winner}/${r1.turn} vs ${r2.winner}/${r2.turn}`);
  if (JSON.stringify(r1.hpA) !== JSON.stringify(r2.hpA) || JSON.stringify(r1.hpB) !== JSON.stringify(r2.hpB)) fail(`DESYNC HP ${seed}`);
  n++;
}

console.log(`\nPVP SMOKE — ${n} combates lockstep verificados (host == joiner).`);
if (errors) { console.error(`\n❌ ${errors} error(es).`); process.exit(1); }
else console.log('\n✅ PVP SMOKE OK — combate online determinista, sin desincronización.');
