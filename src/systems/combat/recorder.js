// recorder.js — "Videocámara de Combate" (función de la Pokédex).
// Aprovecha que la batalla es DETERMINISTA: una grabación = snapshot inicial de
// ambos equipos + semilla + secuencia de acciones del jugador. Al reproducir,
// se reconstruye el combate exacto, golpe por golpe. Coste de almacenamiento
// mínimo (no se guardan frames, se re-simula).

const KEY = 'torre_infinita_recordings';
const MAX = 12; // capamos para no llenar localStorage

function readAll() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}
function writeAll(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX))); } catch { /* cuota llena: ignorar */ }
}

/** Crea el objeto-grabación al inicio del combate (snapshot inmutable). */
export function startRecording({ seed, teamA, teamB, biome, floor }) {
  return {
    v: 1, id: 'rec_' + Date.now(),
    date: Date.now(), floor: floor ?? null,
    biome: structuredClone(biome),
    seed,
    teamA: structuredClone(teamA),  // estado exacto al empezar (hp/pp/status incl.)
    teamB: structuredClone(teamB),
    actions: [],                    // se rellena con cada acción del jugador
    result: null,
    titleA: teamA[0]?.name, titleB: teamB[0]?.name,
  };
}

/** Persiste una grabación terminada (la más reciente queda primera). */
export function saveRecording(rec) {
  const list = readAll();
  list.unshift(rec);
  writeAll(list);
  return rec.id;
}

export function listRecordings() { return readAll(); }
export function getRecording(id) { return readAll().find(r => r.id === id) || null; }
export function getLastRecording() { return readAll()[0] || null; }
export function deleteRecording(id) { writeAll(readAll().filter(r => r.id !== id)); }
export function clearRecordings() { try { localStorage.removeItem(KEY); } catch { /* */ } }
