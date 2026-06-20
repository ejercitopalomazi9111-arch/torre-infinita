// commentary.js — Narración estilo comentarista deportivo para las REPETICIONES
// (modo retransmisión "Torre TV"). Variado y con voz propia para evitar el
// "sabor IA". Determinista: misma semilla → misma narración al reverla.

export const COMMENTATORS = [
  { name: 'Rocco «Trueno» Vega', color: '#ffd76a' },
  { name: 'Lía Solaris', color: '#54e0c8' },
];

const UP = (s) => (s ? s.toUpperCase() : s);

// bancos de frases por evento (se elige una al azar, sin repetir consecutivas)
const LINES = {
  start: [
    '¡Bienvenidos a la Torre TV! El estadio contiene la respiración...',
    'Damas y caballeros, las luces se apagan: ¡comienza el duelo!',
    'Lo que van a ver quedará grabado en la leyenda de la Torre.',
  ],
  move: [
    '¡{atk} se lanza con {move}!',
    '¡Ahí va! {move}, ejecutado por {atk}.',
    '{atk} no se anda con rodeos: ¡{move}!',
    'Lectura perfecta de {atk}... ¡{move}!',
  ],
  crit: [
    '¡GOLPE CRÍTICO! ¡La grada estalla!',
    '¡Justo en el punto débil! ¡Brutal, brutal!',
    '¡Quirúrgico! ¡No ha podido ser más preciso!',
  ],
  super: [
    '¡Supereficaz! ¡{def} lo acusa de lleno!',
    '¡Demoledor! Eso ha dolido de verdad.',
    '¡La diferencia de tipos se hace notar! ¡Castigo máximo!',
  ],
  hit: ['Impacto limpio.', 'Conecta el golpe.', 'Daño confirmado, sigue el intercambio.'],
  resist: ['{def} apenas se inmuta...', 'Poca cosa, lo resiste con clase.', 'Defensa sólida de {def}.'],
  miss: ['¡FALLA! ¡Increíble esquiva!', '¡Al aire! Se salvó por centímetros.', '¡Lo lee y lo evita! ¡Qué reflejos!'],
  status: ['¡{def} queda tocado! Mal asunto para su esquina.', 'Cambio de planes: esto condiciona el combate.'],
  faint: [
    '¡Y CAE! ¡{name} no puede más! ¡LA TORRE RUGE!',
    '¡Fulminado! ¡Qué manera de cerrar el punto!',
    '¡Se acabó para {name}! ¡El público en pie!',
  ],
  caught: ['¡CAPTURADO! ¡Un nuevo fichaje para la leyenda!', '¡La esfera se cierra! ¡Pieza de colección!'],
  switch: ['¡Cambio en la pista! Entra {name} con todo que demostrar.', 'Movimiento de banquillo: ¡{name} al ruedo!'],
  win: ['¡SE ACABÓ! ¡Victoria de época!', '¡Telón! Un final para enmarcar.'],
  fled: ['¡Huida! El combate se desvanece entre el humo...', 'Y se escapa... no habrá desenlace hoy.'],
};

/** Crea un narrador determinista. rng = makeRNG(semilla del combate). */
export function makeCommentator(rng) {
  let last = {};
  let speakerIdx = 0;
  const pick = (key) => {
    const bank = LINES[key]; if (!bank) return null;
    let i = Math.floor(rng.float() * bank.length);
    if (bank.length > 1 && i === last[key]) i = (i + 1) % bank.length;
    last[key] = i;
    return bank[i];
  };
  const fill = (tpl, ctx) => (tpl || '').replace(/\{(\w+)\}/g, (m, k) => UP(ctx[k]) ?? m);

  return {
    /** Devuelve {speaker, line} para un evento, o null si no amerita narración. */
    say(event, ctx = {}) {
      let key = null;
      switch (event.t) {
        case 'start': key = 'start'; break;
        case 'move': key = 'move'; break;
        case 'damage': key = event.crit ? 'crit' : event.eff > 1 ? 'super' : event.eff < 1 ? 'resist' : 'hit'; break;
        case 'miss': key = 'miss'; break;
        case 'status': key = 'status'; break;
        case 'faint': key = 'faint'; break;
        case 'caught': key = 'caught'; break;
        case 'switchIn': key = 'switch'; break;
        case 'end': key = event.result === 'caught' ? 'caught' : event.result === 'fled' ? 'fled' : 'win'; break;
        default: return null;
      }
      const line = fill(pick(key), ctx);
      if (!line) return null;
      const speaker = COMMENTATORS[speakerIdx % COMMENTATORS.length];
      speakerIdx++;
      return { speaker, line };
    },
  };
}
