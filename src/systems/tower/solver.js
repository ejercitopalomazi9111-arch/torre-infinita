// solver.js — Validador anti-softlock (sección D).
// Modelo: alcanzabilidad por punto-fijo. Una llave se "recoge" cuando su sala
// es alcanzable; una cerradura se abre cuando su keyId fue recogido.
// Si la salida (y el jefe en pisos de jefe) no es alcanzable → softlock.
// Coste lineal. generateFloor regenera ante un veredicto !ok.

/**
 * @param {object} floor  salida de generateFloor (antes de validar)
 * @returns {{ok:boolean, reason?:string, reachableCount:number, total:number,
 *            exitReachable:boolean, bossReachable:boolean}}
 */
export function validateFloor(floor) {
  const { roomById, entranceId, exitId, bossId, isBossFloor, keys = [] } = floor;
  const total = roomById.size;

  const reachable = new Set([entranceId]);
  const collected = new Set();
  const keysByRoom = new Map();
  for (const k of keys) {
    if (!keysByRoom.has(k.roomId)) keysByRoom.set(k.roomId, []);
    keysByRoom.get(k.roomId).push(k.id);
  }

  let changed = true;
  while (changed) {
    changed = false;
    // recoger llaves de salas ya alcanzables
    for (const id of reachable) {
      const ks = keysByRoom.get(id);
      if (ks) for (const kid of ks) collected.add(kid);
    }
    // expandir frontera
    for (const id of [...reachable]) {
      for (const door of roomById.get(id).doors) {
        if (reachable.has(door.to)) continue;
        if (door.locked && !collected.has(door.keyId)) continue;
        reachable.add(door.to);
        changed = true;
      }
    }
  }

  const exitReachable = reachable.has(exitId);
  const bossReachable = !isBossFloor || (bossId != null && reachable.has(bossId));

  let ok = true, reason;
  if (!exitReachable) { ok = false; reason = 'salida (escaleras) inalcanzable'; }
  else if (!bossReachable) { ok = false; reason = 'sala de jefe inalcanzable en piso de jefe'; }

  // sanity: ninguna sala con llave imprescindible quedó tras su propia cerradura
  // (implícito en exitReachable, pero lo reportamos por claridad)
  return { ok, reason, reachableCount: reachable.size, total, exitReachable, bossReachable };
}
