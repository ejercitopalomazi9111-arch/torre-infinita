// achievements.js — LOGROS del juego. Cada uno tiene un id, nombre, descripción
// divertida y un check(ctx) donde ctx = { run, floor, event }. `event` es un
// string puntual ('capture','boss','trainer','gimmick','fish','evolve').
export const ACHIEVEMENTS = [
  { id: 'primer_paso',  name: 'Primer Paso',      desc: 'Baja al piso 2.',                 check: (c) => c.floor >= 2 },
  { id: 'escalador',    name: 'Escalador',        desc: 'Alcanza el piso 10.',             check: (c) => c.floor >= 10 },
  { id: 'veterano',     name: 'Veterano',         desc: 'Alcanza el piso 25.',             check: (c) => c.floor >= 25 },
  { id: 'leyenda',      name: 'Leyenda Viva',     desc: 'Alcanza el piso 50.',             check: (c) => c.floor >= 50 },
  { id: 'primera_cap',  name: 'Mi Primer Amigo',  desc: 'Captura tu primer Pokémon.',      check: (c) => c.event === 'capture' },
  { id: 'coleccionista',name: 'Coleccionista',    desc: 'Captura 10 Pokémon en una run.',  check: (c) => (c.run?.dex?.caught?.length || 0) >= 10 },
  { id: 'pokemaniaco',  name: 'Pokémaníaco',      desc: 'Captura 30 Pokémon en una run.',  check: (c) => (c.run?.dex?.caught?.length || 0) >= 30 },
  { id: 'domador',      name: 'Domador',          desc: 'Gana a un entrenador.',           check: (c) => c.event === 'trainer' },
  { id: 'matagigantes', name: 'Matagigantes',     desc: 'Vence a un JEFE.',                check: (c) => c.event === 'boss' },
  { id: 'fenomeno',     name: 'Fenómeno',         desc: 'Usa Mega, Z o Dinamax.',          check: (c) => c.event === 'gimmick' },
  { id: 'equipo_pleno', name: 'Equipo Completo',  desc: 'Ten 6 Pokémon en el equipo.',     check: (c) => (c.run?.party?.length || 0) >= 6 },
  { id: 'pescador',     name: 'Buen Pescador',    desc: 'Pesca un Pokémon.',               check: (c) => c.event === 'fish' },
  { id: 'evolucion',    name: '¡Está evolucionando!', desc: 'Evoluciona un Pokémon.',      check: (c) => c.event === 'evolve' },
  { id: 'ricachon',     name: 'Ricachón',         desc: 'Acumula 20000₽ en una run.',      check: (c) => (c.run?.money || 0) >= 20000 },
  { id: 'guardian',     name: 'Domador de Reyes', desc: 'Vence a un GUARDIÁN DE LA TORRE.', check: (c) => c.event === 'guardian' },
];
