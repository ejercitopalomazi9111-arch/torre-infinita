// smoke.mjs — GATE de QA de lógica pura (sección A).
// Genera muchos pisos sembrados, valida cada uno contra el solver y verifica
// invariantes estructurales. 0 errores = pasa. Cualquier softlock = falla.
//
// Uso: node tools/smoke.mjs   (o npm run smoke)

import { generateFloor, criticalPath } from '../src/systems/tower/floorGen.js';
import { validateFloor } from '../src/systems/tower/solver.js';

const SEEDS = ['palomazi', 'torre-9111', 'mazi', 42, 1337];
// Cubrimos arranque, zonas seguras (x5), jefes (x10), legendarios (x25) y pisos altos.
const FLOORS = [
  1, 2, 3, 4, 5, 6, 9, 10, 11, 15, 20, 24, 25, 30, 40, 50, 60, 75, 90,
  100, 150, 200, 250, 500, 999, 1000, 4555, 9110, 9111,
];

let errors = 0;
let checked = 0;
const stats = { rooms: 0, locks: 0, bossFloors: 0, safeFloors: 0, regenMax: 0 };

function fail(msg) { console.error('  ✗ ' + msg); errors++; }

for (const seed of SEEDS) {
  for (const floor of FLOORS) {
    let f;
    try {
      f = generateFloor(seed, floor);
    } catch (e) {
      fail(`generateFloor(${seed}, ${floor}) lanzó: ${e.message}`);
      continue;
    }
    checked++;

    // 1) reproducibilidad: misma semilla+piso → mismo nº de salas y salida
    const f2 = generateFloor(seed, floor);
    if (f.rooms.length !== f2.rooms.length || f.exitId !== f2.exitId) {
      fail(`NO reproducible: ${seed}/${floor} (${f.rooms.length} vs ${f2.rooms.length} salas)`);
    }

    // 2) solver: 0 softlocks
    const v = validateFloor(f);
    if (!v.ok) fail(`SOFTLOCK ${seed}/${floor}: ${v.reason}`);
    if (!v.exitReachable) fail(`salida inalcanzable ${seed}/${floor}`);

    // 3) invariantes estructurales
    if (f.entranceId === f.exitId) fail(`entrada == salida en ${seed}/${floor}`);
    if (criticalPath(f.roomById, f.entranceId, f.exitId).length === 0)
      fail(`sin camino entrada→salida en ${seed}/${floor}`);
    if (f.isBossFloor && f.bossId == null) fail(`piso de jefe sin sala de jefe ${seed}/${floor}`);
    if (f.isSafeFloor) {
      const types = new Set(f.rooms.map(r => r.type));
      for (const need of ['shop', 'pokecenter', 'rest'])
        if (!types.has(need)) fail(`zona segura ${seed}/${floor} sin '${need}'`);
    }
    // puertas simétricas
    for (const r of f.rooms) {
      for (const d of r.doors) {
        const back = f.roomById.get(d.to)?.doors.find(x => x.to === r.id);
        if (!back) fail(`puerta no simétrica ${seed}/${floor} sala ${r.id}->${d.to}`);
        if (back && back.locked !== d.locked) fail(`cerradura asimétrica ${seed}/${floor}`);
      }
    }

    stats.rooms += f.rooms.length;
    stats.locks += f.keys.length;
    if (f.isBossFloor) stats.bossFloors++;
    if (f.isSafeFloor) stats.safeFloors++;
  }
}

console.log(`\nSMOKE TORRE — ${checked} pisos generados (${SEEDS.length} semillas × ${FLOORS.length} pisos)`);
console.log(`  salas totales: ${stats.rooms} (prom ${(stats.rooms / checked).toFixed(1)}/piso)`);
console.log(`  cerraduras colocadas: ${stats.locks}`);
console.log(`  pisos de jefe: ${stats.bossFloors} · zonas seguras: ${stats.safeFloors}`);

if (errors > 0) {
  console.error(`\n❌ SMOKE FALLÓ con ${errors} error(es).`);
  process.exit(1);
} else {
  console.log(`\n✅ SMOKE OK — 0 errores, 0 softlocks.`);
}
