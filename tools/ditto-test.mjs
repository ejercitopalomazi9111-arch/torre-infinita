// QA Ditto: Transformación (movimiento) + Imposter (habilidad) + no-corrupción.
// Uso: node tools/ditto-test.mjs   (desde la raíz del proyecto)
import { makeBattleMon, Battle } from '../src/systems/combat/battle.js';

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? '✅' : '❌') + ' ' + msg); if (!cond) fails++; };
const DITTO = 132, CHARIZARD = 6;

// ---------- 1) Transformación por MOVIMIENTO ----------
const ditto = makeBattleMon(DITTO, 50);
const backup = makeBattleMon(1, 50);            // Bulbasaur de relleno
const foe = makeBattleMon(CHARIZARD, 5);   // nivel bajo: Ditto (rápido y vivo) alcanza a transformarse

ok(ditto.name.toLowerCase() === 'ditto', 'Ditto se crea como Ditto');
ok(JSON.stringify(ditto.moves) === JSON.stringify(['transform']), 'Ditto SOLO conoce Transformación');
const origTypes = [...ditto.types], origMaxhp = ditto.maxhp, origHpStat = ditto.stats.hp;

const b = new Battle([ditto, backup], [foe], 'ditto-seed', 'aggressive');
b.leadAbilities();
b.resolveTurn({ type: 'move', move: 'transform' });

const d = b.teams.A[0];
ok(JSON.stringify(d.types) === JSON.stringify(foe.types), 'Tras Transformación copia los TIPOS del rival');
ok(d.speciesId === CHARIZARD, 'Copia la especie (sprite) del rival');
ok(d.base === foe.base, 'Copia los stats BASE del rival');
ok(JSON.stringify(d.moves) === JSON.stringify(foe.moves), 'Copia los MOVIMIENTOS del rival');
ok(d.maxhp === origMaxhp, 'El HP máximo NO se copia (conserva el suyo)');
ok(d.stats.hp === origHpStat, 'El stat de HP sigue siendo el de Ditto');
ok(Object.values(d.pp).every(p => p <= 5), 'Los movimientos copiados tienen ≤5 PP');
ok(!!d._origForm, 'Guarda snapshot para revertir');
ok(d.transformedInto === CHARIZARD, 'Marca en qué se transformó');

// transformación falla si ya está transformado
const before = b.log.length;
b.doTransform('A', 'B');
ok(b.log.some(e => e.t === 'transformfail'), 'No puede transformarse dos veces (falla)');

// ---------- 2) Reversión: pelea hasta el final y verifica que NO queda corrupto ----------
let guard = 0;
while (!b.over && guard++ < 100) b.resolveTurn({ type: 'move', move: d.moves[0] });
const after = b.teams.A[0];
ok(!after._origForm, 'Al terminar el combate, se quita el snapshot');
ok(JSON.stringify(after.types) === JSON.stringify(origTypes), 'Ditto RECUPERA sus tipos originales (no se corrompe)');
ok(JSON.stringify(after.moves) === JSON.stringify(['transform']), 'Ditto vuelve a conocer solo Transformación');
ok(after.speciesId === DITTO, 'Ditto vuelve a ser Ditto');

// ---------- 3) Habilidad IMPOSTER (auto-transformación al entrar) ----------
const imp = makeBattleMon(DITTO, 50, { ability: 'imposter' });
const foe2 = makeBattleMon(CHARIZARD, 50);
const b2 = new Battle([imp], [foe2], 'imp-seed', 'wild');
b2.leadAbilities();
ok(b2.teams.A[0].speciesId === CHARIZARD, 'IMPOSTER: Ditto se transforma solo al entrar al combate');

console.log('\n' + (fails === 0 ? '🎉 TODO VERDE' : `💥 ${fails} fallo(s)`));
process.exit(fails ? 1 : 0);
