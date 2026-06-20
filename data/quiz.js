// quiz.js — Entrevista de entrada estilo Pokémon Mundo Misterioso (data-driven).
// Cada respuesta suma puntos a rasgos; el rasgo dominante decide qué Pokémon
// inicial y qué entrenador se le OFRECEN al jugador (nunca se le imponen).

export const QUIZ = [
  {
    q: 'Aparece una cueva que ayer no estaba ahí. ¿Qué haces?',
    options: [
      { txt: '¡Entro sin pensarlo dos veces!', traits: { valiente: 2 } },
      { txt: 'La observo y tomo notas primero.', traits: { listo: 2, curioso: 1 } },
      { txt: 'Busco a alguien para entrar juntos.', traits: { alegre: 2 } },
    ],
  },
  {
    q: 'Un Pokémon salvaje te roba la merienda...',
    options: [
      { txt: '¡Lo persigo hasta recuperarla!', traits: { travieso: 2, valiente: 1 } },
      { txt: 'Le dejo la mitad. Tendrá hambre.', traits: { tranquilo: 2 } },
      { txt: 'Me quedo helado sin saber qué hacer.', traits: { timido: 2 } },
    ],
  },
  {
    q: '¿Qué premio te haría más ilusión?',
    options: [
      { txt: 'Una medalla que nadie más tenga.', traits: { duro: 2 } },
      { txt: 'Un libro lleno de secretos.', traits: { curioso: 2, listo: 1 } },
      { txt: 'Una gran fiesta con todos mis amigos.', traits: { alegre: 2, tranquilo: 1 } },
    ],
  },
  {
    q: 'Tormenta en plena torre. Tu equipo te mira...',
    options: [
      { txt: '"Seguimos. La cima no espera."', traits: { duro: 2, valiente: 1 } },
      { txt: '"Acampamos y cuento historias."', traits: { alegre: 1, tranquilo: 2 } },
      { txt: '"Calculemos el refugio más seguro."', traits: { listo: 2 } },
    ],
  },
  {
    q: 'Tres puertas. Solo puedes abrir una:',
    options: [
      { txt: 'La roja, que está calientita.', traits: { valiente: 2, travieso: 1 } },
      { txt: 'La azul, que susurra tu nombre.', traits: { curioso: 2 } },
      { txt: 'La pequeñita escondida detrás.', traits: { timido: 2, listo: 1 } },
    ],
  },
  {
    q: 'Tu mejor amigo llega llorando porque perdió un combate...',
    options: [
      { txt: '"¡Vamos a entrenar AHORA mismo!"', traits: { duro: 2 } },
      { txt: 'Le preparo su comida favorita.', traits: { tranquilo: 2, alegre: 1 } },
      { txt: 'Analizo el combate para encontrar el error.', traits: { listo: 2 } },
    ],
  },
  {
    q: 'Encuentras 1000₽ tirados en el suelo del Centro Pokémon.',
    options: [
      { txt: 'Los entrego en recepción, claro.', traits: { tranquilo: 2, listo: 1 } },
      { txt: 'Miro a los lados... y los entrego (con dolor).', traits: { travieso: 2 } },
      { txt: 'Grito "¿DE QUIÉN ES ESTO?" delante de todos.', traits: { valiente: 1, alegre: 2 } },
    ],
  },
  {
    q: 'En el examen de la escuela de entrenadores, no sabes una respuesta.',
    options: [
      { txt: 'La dejo en blanco. La honestidad primero.', traits: { timido: 1, tranquilo: 2 } },
      { txt: 'Razono hasta deducirla. Siempre hay lógica.', traits: { listo: 2 } },
      { txt: 'Pongo "Magikarp" y confío en el destino.', traits: { travieso: 2, alegre: 1 } },
    ],
  },
  {
    q: 'Una noche oyes un ruido EXTRAÑO en la cocina...',
    options: [
      { txt: 'Bajo con una linterna y una sartén.', traits: { valiente: 2 } },
      { txt: 'Me tapo con la cobija hasta la cabeza.', traits: { timido: 2 } },
      { txt: '¡A lo mejor es un Pokémon! ¡Voy a verlo!', traits: { curioso: 2, alegre: 1 } },
    ],
  },
];

// rasgo dominante → inicial + entrenador sugeridos + frase del Gurú
export const TRAIT_RESULT = {
  valiente:  { starter: 4,   trainer: 'red',    line: '¡Un corazón VALIENTE! El fuego te reconoce.' },
  listo:     { starter: 7,   trainer: 'serena', line: 'Mente fría y LISTA. Como la marea: paciente y exacta.' },
  alegre:    { starter: 25,  trainer: 'lyra',   line: '¡Pura chispa ALEGRE! Hasta las nubes se ríen contigo.' },
  curioso:   { starter: 133, trainer: 'ethan',  line: 'CURIOSO sin remedio... como quien aún no decide qué será.' },
  duro:      { starter: 155, trainer: 'hilda',  line: 'Voluntad DURA: brasas que nunca se apagan.' },
  timido:    { starter: 152, trainer: 'dawn',   line: 'TÍMIDO pero floreciente. La hoja crece en silencio.' },
  tranquilo: { starter: 1,   trainer: 'lucas',  line: 'Calma TRANQUILA: la semilla que todo lo aguanta.' },
  travieso:  { starter: 158, trainer: 'nate',   line: '¡TRAVIESO con dientes! Que el mundo se cuide.' },
};

// TODOS los iniciales de TODOS los juegos disponibles en el roster (Gen 1-5)
export const STARTERS = [
  { id: 1,   name: 'Bulbasaur',  desc: 'Sale de fábrica con mochila de semilla.' },
  { id: 4,   name: 'Charmander', desc: 'Llama en la cola, drama en el alma.' },
  { id: 7,   name: 'Squirtle',   desc: 'Caparazón pulido, actitud de escuadrón.' },
  { id: 25,  name: 'Pikachu',    desc: 'La estrella. Cachetes con peligro real.' },
  { id: 133, name: 'Eevee',      desc: 'Ocho futuros posibles y cero prisa.' },
  { id: 152, name: 'Chikorita',  desc: 'Huele a campo recién llovido. Calma pura.' },
  { id: 155, name: 'Cyndaquil',  desc: 'Tímido hasta que se le enciende la espalda.' },
  { id: 158, name: 'Totodile',   desc: 'Muerde primero, se disculpa... a veces.' },
  { id: 252, name: 'Treecko',    desc: 'Frialdad de pared vertical. Nunca se despeina.' },
  { id: 255, name: 'Torchic',    desc: 'Bolita de fuego con patadas de campeón.' },
  { id: 258, name: 'Mudkip',     desc: 'Tan tierno que duele. Tan fuerte que asusta.' },
  { id: 387, name: 'Turtwig',    desc: 'Lleva su propio jardín a cuestas. Paciencia infinita.' },
  { id: 390, name: 'Chimchar',   desc: 'Travesura con fuego en la retaguardia.' },
  { id: 393, name: 'Piplup',     desc: 'Orgulloso, elegante y CERO abrazable (según él).' },
  { id: 495, name: 'Snivy',      desc: 'Te mira por encima del hombro... con cariño.' },
  { id: 498, name: 'Tepig',      desc: 'Ronca fuego y corre con el corazón.' },
  { id: 501, name: 'Oshawott',   desc: 'Su vieira no es decoración: es una espada.' },
];
