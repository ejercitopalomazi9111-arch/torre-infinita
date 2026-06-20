// abilities.js — Catálogo de HABILIDADES (nombre ES + descripción divertida) y
// marca de cuáles están IMPLEMENTADAS en el motor (src/systems/combat/abilities.js).
// Los datos base (qué habilidad tiene cada especie) vienen de species.generated.js
// (PokeAPI). Aquí damos nombre en español y sabor para los menús (regla flavor).

export const ABILITIES = {
  overgrow:     { es: 'Espesura',         desc: 'Sus ataques de planta se vuelven feroces cuando está al borde.' },
  blaze:        { es: 'Mar Llamas',       desc: 'Acorralado, el fuego dentro de él arde el doble.' },
  torrent:      { es: 'Torrente',         desc: 'Con pocos PS, sus ataques de agua se desbordan.' },
  swarm:        { es: 'Enjambre',         desc: 'Herido, sus ataques bicho zumban con más fuerza.' },
  guts:         { es: 'Agallas',          desc: 'Un problema de estado no lo frena: lo enfurece (+ Ataque).' },
  hustle:       { es: 'Entusiasmo',       desc: 'Pega más fuerte aunque a veces se le va la puntería.' },
  'huge-power': { es: 'Potencia',         desc: 'Una fuerza descomunal: dobla su Ataque.' },
  'pure-power': { es: 'Energía Pura',     desc: 'Con pura mente, dobla su Ataque.' },
  intimidate:  { es: 'Intimidación',      desc: 'Al salir, asusta al rival y le baja el Ataque.' },
  levitate:    { es: 'Levitación',        desc: 'Flota: los ataques de tierra no le hacen nada.' },
  sturdy:      { es: 'Robustez',          desc: 'Aguanta a 1 PS un golpe que lo dejaría K.O. desde full.' },
  'thick-fat': { es: 'Sebo',              desc: 'Su grasa amortigua el fuego y el hielo a la mitad.' },
  'speed-boost': { es: 'Impulso',         desc: 'Cada turno que pasa se vuelve más veloz.' },
  static:      { es: 'Elec. Estática',    desc: 'Tocarlo puede paralizar al atacante.' },
  'flame-body': { es: 'Cuerpo Llama',     desc: 'Tocarlo puede quemar al atacante.' },
  'poison-point': { es: 'Punto Tóxico',   desc: 'Tocarlo puede envenenar al atacante.' },
  'rough-skin': { es: 'Piel Tosca',       desc: 'Quien lo toca se hace daño con su piel áspera.' },
  'water-absorb': { es: 'Absorbe Agua',   desc: 'El agua no lo daña: lo cura.' },
  'volt-absorb': { es: 'Absorbe Elec.',   desc: 'La electricidad no lo daña: lo cura.' },
  'flash-fire': { es: 'Absorbe Fuego',    desc: 'El fuego no lo daña; encima potencia el suyo.' },
  'lightning-rod': { es: 'Pararrayos',    desc: 'Atrae la electricidad y la anula (le sube Ataque Esp.).' },
  chlorophyll: { es: 'Clorofila',         desc: 'Con sol, corre como el viento. (Clima: próximamente.)' },
  'swift-swim': { es: 'Nado Rápido',      desc: 'Bajo la lluvia, nada a toda velocidad. (Clima: próximamente.)' },
  'natural-cure': { es: 'Cura Natural',   desc: 'Al retirarse del combate se cura los problemas de estado.' },
  immunity:    { es: 'Inmunidad',         desc: 'Su cuerpo no puede ser envenenado.' },
  limber:      { es: 'Flexibilidad',      desc: 'Tan elástico que no puede ser paralizado.' },
  insomnia:    { es: 'Insomnio',          desc: 'No hay quien lo duerma.' },
  'inner-focus': { es: 'Foco Interno',    desc: 'Concentrado: no retrocede por el miedo.' },
  'clear-body': { es: 'Cuerpo Puro',      desc: 'Nadie le baja las características.' },
  'magic-guard': { es: 'Muro Mágico',     desc: 'Solo le hacen daño los ataques directos.' },
  'compound-eyes': { es: 'Ojo Compuesto', desc: 'Su puntería es de francotirador.' },
  'shed-skin': { es: 'Mudar',             desc: 'Mudando la piel, a veces se cura solo de los estados.' },
  pickup:      { es: 'Recogida',          desc: 'A veces encuentra objetos por el camino.' },
  'run-away':  { es: 'Fuga',              desc: 'Siempre logra huir de los combates salvajes.' },
};

// IDs implementados con EFECTO real en el motor (los demás dan nombre/sabor).
export const IMPLEMENTED = new Set([
  'overgrow', 'blaze', 'torrent', 'swarm', 'guts', 'hustle', 'huge-power', 'pure-power',
  'intimidate', 'levitate', 'sturdy', 'thick-fat', 'speed-boost', 'static', 'flame-body',
  'poison-point', 'rough-skin', 'water-absorb', 'volt-absorb', 'flash-fire', 'lightning-rod',
  'natural-cure', 'immunity', 'limber', 'insomnia', 'inner-focus', 'clear-body',
]);

/** Nombre en español (o prettify del id real de PokeAPI si no está catalogado). */
export function abilityName(id) {
  if (!id) return '—';
  return ABILITIES[id]?.es || id.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
}
export function abilityDesc(id) {
  return ABILITIES[id]?.desc || 'Una habilidad misteriosa de esta especie.';
}
