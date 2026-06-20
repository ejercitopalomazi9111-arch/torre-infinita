// balls.js — TODAS las Poké Balls de los juegos + objetos de curación.
// Sprites oficiales (PokeAPI/sprites → assets/sprites/items/). DATA-DRIVEN:
// bonus fijo o regla ('quick','timer','net',...) que battle.js interpreta.

export const BALLS = {
  pokeball:    { file: 'poke-ball',    name: 'Poké Ball',    bonus: 1,    desc: 'La clásica. Roja, blanca y llena de esperanza.' },
  superball:   { file: 'great-ball',   name: 'Super Ball',   bonus: 1.5,  desc: 'Como la Poké Ball, pero fue al gimnasio.' },
  ultraball:   { file: 'ultra-ball',   name: 'Ultra Ball',   bonus: 2,    desc: 'Tecnología de punta amarilla. Casi trampa.' },
  masterball:  { file: 'master-ball',  name: 'Master Ball',  bonus: 255,  desc: 'NUNCA falla. Gástala con sabiduría... o pánico.' },
  safariball:  { file: 'safari-ball', name: 'Safari Ball',  bonus: 1.5,  desc: 'Huele a hierba alta y a vacaciones.' },
  fastball:    { file: 'fast-ball',    name: 'Veloz Ball',   rule: 'fast', desc: 'x4 contra velocistas. Atrápalos antes del sprint.' },
  levelball:   { file: 'level-ball',   name: 'Nivel Ball',   rule: 'level', desc: 'Cuanto más alto tu nivel sobre el rival, mejor.' },
  lureball:    { file: 'lure-ball',    name: 'Cebo Ball',    bonus: 1,    desc: 'Ideal pescando. Aquí arriba... decorativa.' },
  heavyball:   { file: 'heavy-ball',   name: 'Peso Ball',    rule: 'heavy', desc: 'A más kilos del rival, mejor agarre. Báscula incluida.' },
  loveball:    { file: 'love-ball',    name: 'Amor Ball',    bonus: 1,    desc: 'Funciona mejor cuando hay química. Ya llegará.' },
  friendball:  { file: 'friend-ball',  name: 'Amigo Ball',   bonus: 1,    desc: 'El capturado sale de buen humor. Qué lindo.' },
  moonball:    { file: 'moon-ball',    name: 'Luna Ball',    rule: 'moon', desc: 'x4 con tipos hada. La luna sabe cosas.' },
  sportball:   { file: 'sport-ball',   name: 'Competi Ball', bonus: 1.5,  desc: 'Reliquia del Concurso de Cazainsectos.' },
  netball:     { file: 'net-ball',     name: 'Malla Ball',   rule: 'net', desc: 'x3 contra bichos y acuáticos. Red incluida.' },
  diveball:    { file: 'dive-ball',    name: 'Buceo Ball',   rule: 'dive', desc: 'x3.5 contra tipo agua. Diseño hidrodinámico.' },
  nestball:    { file: 'nest-ball',    name: 'Nido Ball',    rule: 'nest', desc: 'Mejor contra rivales de nivel bajito. Cuna portátil.' },
  repeatball:  { file: 'repeat-ball',  name: 'Acopio Ball',  rule: 'repeat', desc: 'x3.5 si ya registraste esa especie. Coleccionista.' },
  timerball:   { file: 'timer-ball',   name: 'Turno Ball',   rule: 'timer', desc: 'Cada turno que pasa agarra más fuerte. Paciencia.' },
  luxuryball:  { file: 'luxury-ball',  name: 'Lujo Ball',    bonus: 1,    desc: 'Interior de terciopelo. El capturado te querrá más.' },
  premierball: { file: 'premier-ball', name: 'Premier Ball', bonus: 1,    desc: 'Edición conmemorativa. Blanca y elegante.' },
  duskball:    { file: 'dusk-ball',    name: 'Ocaso Ball',   bonus: 3,    desc: 'x3 en sitios oscuros. ¿Y esta torre qué crees que es?' },
  healball:    { file: 'heal-ball',    name: 'Sana Ball',    rule: 'heal', desc: 'Cura por completo al recién capturado. Spa incluido.' },
  quickball:   { file: 'quick-ball',   name: 'Rapid Ball',   rule: 'quick', desc: 'x5 en el PRIMER turno. Sin saludar siquiera.' },
  cherishball: { file: 'cherish-ball', name: 'Gloria Ball',  bonus: 1,    desc: 'De eventos especiales. Brilla con historia.' },
  dreamball:   { file: 'dream-ball',   name: 'Ensueño Ball', rule: 'dream', desc: 'x4 contra rivales con problemas de estado. Dulces sueños.' },
  beastball:   { file: 'beast-ball',   name: 'Ente Ball',    bonus: 0.4,  desc: 'Para Ultraentes. Contra lo normal... mala idea.' },
  parkball:    { file: 'park-ball',    name: 'Parque Ball',  bonus: 1.5,  desc: 'Del Parque Compi. Jubilada pero funcional.' },
};

export const HEALS = {
  potion:       { file: 'potion',       name: 'Poción',       heal: 20,     desc: 'Spray sanador con olor a hospital. +20 PS.' },
  superpotion:  { file: 'super-potion', name: 'Superpoción',  heal: 60,     desc: 'El spray premium. +60 PS y aroma a victoria.' },
  hyperpotion:  { file: 'hyper-potion', name: 'Hiperpoción',  heal: 120,    desc: 'Calidad enfermería. +120 PS de golpe.' },
  maxpotion:    { file: 'max-potion',   name: 'Máx. Poción',  heal: 'full', desc: 'PS al tope. El rocío de los campeones.' },
  fullrestore:  { file: 'full-restore', name: 'Restau. Total', heal: 'full', cure: true, desc: 'TODO al tope y sin estados. La palabra mágica.' },
  revive:       { file: 'revive',       name: 'Revivir',      revive: 0.5,  desc: 'Levanta a un debilitado con la mitad de PS.' },
  maxrevive:    { file: 'max-revive',   name: 'Máx. Revivir', revive: 1,    desc: 'Resurrección de lujo: PS completos.' },
};

// REPELENTES: suprimen encuentros salvajes durante N pasos (clave en cuevas,
// que no tienen zonas seguras). Solo se usan en el CAMPO, no en combate.
export const REPELS = {
  repel:      { file: 'repel',       name: 'Repelente',      repel: 50,  desc: 'Aleja a los salvajes durante 50 pasos.' },
  superrepel: { file: 'super-repel', name: 'Superrepelente', repel: 100, desc: 'Tranquilidad andante: 100 pasos sin sustos.' },
  maxrepel:   { file: 'max-repel',   name: 'Máx. Repelente', repel: 250, desc: '250 pasos de paz absoluta. El favorito en cuevas.' },
};
// OBJETOS DE CAMPO varios (mecánicas de otros juegos).
export const FIELD = {
  escaperope: { file: 'escape-rope', name: 'Cuerda Huida', escape: true, desc: 'Tira de la cuerda y caes al siguiente piso al instante.' },
  bici:       { file: 'bicycle',     name: 'Bici',         bike: true, desc: 'Móntate para ir MÁS RÁPIDO. Úsala otra vez para bajarte.' },
  huevo:      { file: 'lucky-egg',   name: 'Huevo Misterioso', egg: true, desc: 'Del criadero. Camina con él y eclosionará en un Pokémon bebé.' },
};

// CONSUMIBLES sobre un Pokémon (suben nivel o restauran PP). Se usan en el CAMPO.
export const CONSUM = {
  rarecandy:  { file: 'rare-candy', name: 'Caramelo Raro', level: 1,        desc: 'Sube 1 nivel al instante. Dulce atajo al poder.' },
  ether:      { file: 'ether',      name: 'Éter',          ppMove: 10,      desc: 'Restaura 10 PP de un movimiento agotado.' },
  maxether:   { file: 'max-ether',  name: 'Éter Máx',      ppMove: 'full',  desc: 'Restaura TODOS los PP de un movimiento.' },
  elixir:     { file: 'elixir',     name: 'Elixir',        ppAll: 10,       desc: '+10 PP a TODOS los movimientos.' },
  maxelixir:  { file: 'max-elixir', name: 'Elixir Máx',    ppAll: 'full',   desc: 'PP al tope en todos los movimientos.' },
};

/** Multiplicador real de una ball según la regla y el contexto del combate. */
export function ballBonus(key, { foe, turn, caught = [], baseOf }) {
  const b = BALLS[key];
  if (!b) return 1;
  if (b.bonus != null) return b.bonus;
  switch (b.rule) {
    case 'quick': return turn <= 1 ? 5 : 1;
    case 'timer': return Math.min(4, 1 + turn * 0.3);
    case 'net':   return (foe.types.includes('bug') || foe.types.includes('water')) ? 3 : 1;
    case 'dive':  return foe.types.includes('water') ? 3.5 : 1;
    case 'nest':  return Math.max(1, (40 - foe.level) / 10);
    case 'repeat': return caught.includes(foe.speciesId) ? 3.5 : 1;
    case 'fast':  return (baseOf?.spe ?? 0) >= 100 ? 4 : 1;
    case 'heavy': { const kg = (baseOf?.weight ?? 0) / 10; return kg >= 200 ? 4 : kg >= 100 ? 2.5 : kg >= 50 ? 1.5 : 1; }
    case 'moon':  return foe.types.includes('fairy') ? 4 : 1;
    case 'dream': return foe.status ? 4 : 1;
    case 'level': return 1; // se resuelve en battle.js (niveles de ambos)
    case 'heal':  return 1;
    default: return 1;
  }
}
