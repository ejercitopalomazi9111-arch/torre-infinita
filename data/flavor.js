// flavor.js — Descripciones DIVERTIDAS de todo lo seleccionable (regla 2026-06-11:
// navegar por los menús debe ser entretenido). Voz propia, nada de "sabor IA".

// --- menú principal de combate ---
export const MAIN_DESC = {
  LUCHAR: '¡A darle! Elige un movimiento y enseña quién manda.',
  MOCHILA: 'Pociones, Poké Balls y tesoros. El fondo está lleno de migajas.',
  'POKéMON': 'Tu equipo te mira con ojitos. ¿A quién le toca brillar?',
  HUIR: 'Retirada táctica. Nadie te juzga... bueno, quizá tu Pikachu.',
};

// --- objetos de la mochila ---
export const ITEM_DESC = {
  pokeball: 'La clásica. Roja, blanca y llena de esperanza.',
  superball: 'Como la Poké Ball, pero fue al gimnasio. x1.5 de agarre.',
  ultraball: 'Tecnología de punta amarilla. Casi trampa. Casi.',
  potion: 'Spray sanador con olor a hospital. Recupera 20 PS.',
  superpotion: 'El spray premium. 50 PS y un aroma a victoria.',
  back: 'Vuelve al menú anterior. Sin compromiso, sin preguntas.',
};

// --- movimientos (flavor corto; los datos duros se añaden solos) ---
export const MOVE_DESC = {
  tackle: 'El abrazo menos cariñoso del mundo.',
  scratch: 'Uñas sin cortar, rencor sin guardar.',
  quick_attack: 'Pega primero, pregunta después. SIEMPRE va antes.',
  body_slam: 'Plancha de lucha libre. A veces deja al rival tieso.',
  growl: 'Un gruñidito tierno que desarma: baja el Ataque rival.',
  ember: 'Chispitas calientes. A veces el rival sale ardiendo.',
  flamethrower: 'El clásico de los clásicos. Fuego a presión industrial.',
  fire_fang: 'Mordida a la brasa, término medio.',
  water_gun: 'Pistola de agua de feria, versión competitiva.',
  surf: 'Invoca una ola y arrasa con todo. Traje de baño no incluido.',
  aqua_jet: 'Torpedo húmedo: golpea antes de que parpadeen.',
  vine_whip: 'Látigo vegetal. Duele más que pisar un Lego.',
  razor_leaf: 'Hojas con filo de chef. Críticos frecuentes.',
  energy_ball: 'Esfera de pura clorofila concentrada. Puede frenar al rival.',
  thunder_shock: 'Toques eléctricos de bienvenida. Puede paralizar.',
  thunderbolt: 'EL rayo. Noventa de potencia y cero piedad.',
  thunder_wave: 'No hace daño, pero deja al rival como estatua.',
  gust: 'Aleteo huracanado. Despeina garantizado.',
  air_slash: 'Cuchillas de aire comprimido. Elegante y cortante.',
  confusion: 'Le revuelve las ideas al rival con el poder de la mente.',
  psychic: 'Telequinesis de gala. Dobla cucharas y voluntades.',
  shadow_ball: 'Una esfera de pura noche. Miedo en formato esfera.',
  lick: 'Asqueroso pero efectivo. Puede dejar paralizado del impacto.',
  bite: 'Mordisco traicionero, directo y sin remordimientos.',
  crunch: 'CRUNCH. Hasta la defensa rival se astilla.',
  rock_throw: 'Piedras voladoras. Rústico, pero funciona desde la edad de piedra.',
  earthquake: 'Sacude el piso entero. Los vecinos de abajo lo odian.',
  powder_snow: 'Nieve suave... que a veces congela hasta el alma.',
  ice_beam: 'Rayo polar premium. Convierte rivales en paletas.',
  dragon_claw: 'Garras legendarias con membresía de dragón.',
  sludge_bomb: 'Granada de lodo tóxico. Mancha Y envenena.',
  poison_sting: 'Picadita modesta con regalo venenoso adentro.',
  aura_sphere: 'Energía del aura pura: NUNCA falla. Nunca.',
  brick_break: 'Karate puro: rompe ladrillos y orgullos.',
  iron_tail: 'Cola de acero. Cuando acierta, hace MUCHO ruido.',
  metal_claw: 'Garras niqueladas recién afiladas.',
  bug_bite: 'Ñam. Mordida de bicho con hambre atrasada.',
  moonblast: 'Le cae la luna encima. Literal y fabulosamente.',
  fairy_wind: 'Brisa con purpurina. No subestimes la purpurina.',
  struggle: 'Sin PP no hay paraíso: golpe desesperado que también te duele.',
};

// --- entrenadores (selección de personaje) ---
export const TRAINER_DESC = {
  red: 'La leyenda silenciosa del Monte Plateado. Habla poco, gana mucho.',
  blue: 'Ex-campeón y ex-humilde. "¡Apesta ser tú!" es su saludo.',
  ethan: 'El chico de Pueblo Primavera con gorra al revés y suerte de oro.',
  lyra: 'Energía infinita y un Marill que no se calla. Imparable.',
  brendan: 'Hijo de profesor, gorro icónico. Cazador de récords en Hoenn.',
  may: 'Exploradora de Hoenn con brújula propia: siempre hacia la aventura.',
  lucas: 'El asistente estrella de Sinnoh. Orden, método y mucha Pokédex.',
  dawn: 'Estilo de Sinnoh y reflejos de campeona. Nada la despeina.',
  hilbert: 'De Teselia, con más kilómetros encima que un tren bala.',
  hilda: 'Mirada decidida y visera lista. Teselia entera la respeta.',
  nate: 'El novato de Aspertia que nunca sabe rendirse. Para nada.',
  rosa: 'Doble moño, doble determinación. Estrella de Pokéwood.',
  calem: 'El vecino elegante de Kalos. Compite hasta en cortesía.',
  serena: 'Estratega de Kalos con planes B, C y D. Y todos ganan.',
  steven: 'Campeón de Hoenn y coleccionista de piedras raras. Brilla más que ellas.',
  wally: 'El chico frágil que se hizo fuerte a puro corazón. Respeto total.',
  wallace: 'Campeón, artista del agua y de la capa. Drama y elegancia.',
  roxanne: 'Líder de Ciudad Férrica. Estudia rocas... y a sus rivales.',
  brawly: 'Líder surfista de Azuliza. Pelea mejor con la marea alta.',
  wattson: 'El abuelo eléctrico de Malvalona. Su risa también da toques.',
  flannery: 'Líder de Lavacalda, recién heredó el gimnasio y arde por demostrarlo.',
  norman: 'Líder de Petalia. Equilibrio puro: papá estricto, rival justo.',
  winona: 'Líder de Arborada. Dicen que sueña que vuela. Probablemente cierto.',
  juan: 'Maestro del agua de Arrecípolis. Cada combate es un espectáculo.',
  sidney: 'Alto Mando siniestro con sonrisa de tiburón. Buen perdedor, raro.',
  glacia: 'Alto Mando de hielo. Vino a Hoenn buscando calor... para congelarlo.',
};

/** Flavor del estado de un Pokémon del equipo (menú POKéMON). */
export function partyFlavor(m, isActive) {
  if (m.hp <= 0) return 'K.O. técnico. Sueña con un Centro Pokémon.';
  if (isActive) return '¡Ya está en el campo dándolo todo!';
  const r = m.hp / m.maxhp;
  if (r >= 1) return '¡En plena forma y pidiendo guerra!';
  if (r > 0.5) return 'Con cuerda para rato. Listo para entrar.';
  if (r > 0.25) return 'Cansadito, pero el orgullo pesa más.';
  return 'Al límite... una poción no le caería mal.';
}

// FENÓMENOS de batalla (Mega/Z/Dinamax/Tera) — nombre + descripción divertida.
export const GIMMICK_NAME = { mega: 'MEGAEVO', z: 'MOV. Z', dynamax: 'DINAMAX', tera: 'TERA' };
export const GIMMICK_DESC = {
  mega: 'Megaevolución: +30% a todas sus características el resto del combate. ¡Brilla!',
  z: 'Movimiento Z: tu próximo golpe pega ×1.8. Un solo uso, pero épico.',
  dynamax: 'Dinamax: duplica sus PS y se hace GIGANTE. Aguanta como un titán.',
  tera: 'Teracristalización: refuerza su tipo principal (+STAB). Cristal puro.',
};

// MOVIMIENTOS Z por tipo (uno por tipo, como en los juegos). El Cristal Z equipado
// convierte el siguiente golpe en el Z-move de su tipo.
export const Z_MOVE_NAMES = {
  normal: 'Gigaimpacto Z', fire: 'Hipercaos Ígneo', water: 'Hidrovórtice Abismal',
  electric: 'Gigavoltio Destructor', grass: 'Lluvia Floral', ice: 'Cero Absoluto Z',
  fighting: 'Demolición Total', poison: 'Deflagración Tóxica', ground: 'Cataclismo Telúrico',
  flying: 'Ciclón Devastador', psychic: 'Estallido Psíquico', bug: 'Plaga Devastadora',
  rock: 'Litobombardeo Z', ghost: 'Pesadilla Z', dragon: 'Dracoaliento Z',
  dark: 'Agujero Negro Z', steel: 'Acerodevastación Z', fairy: 'Hada Resplandor Z',
};
