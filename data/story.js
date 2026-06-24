// story.js — HITOS NARRATIVOS de la Torre Infinita. Se revelan UNA vez al ENTRAR
// a ciertos pisos clave, construyendo el misterio de por qué subes. Data-driven:
// añadir un hito = añadir una entrada (la lógica en FloorScene no cambia).
export const STORY_BEATS = {
  3:    'Caíste a la Torre desde un picnic en el bosque. La única salida... parece ser hacia ARRIBA.',
  5:    'Un pueblo dentro de una torre infinita. Nadie aquí recuerda haber entrado por su propia voluntad.',
  10:   "Una voz resuena en la piedra: «Sigue subiendo, escalador. Arriba está lo que perdiste».",
  25:   'Murales antiguos muestran a otros como tú... ninguno con rostro. Todos miran hacia arriba.',
  50:   'El aire cambia. Algo MUY viejo sabe que estás aquí. Y sonríe.',
  100:  'Cien pisos. Los legendarios susurran que la Torre no tiene cima... solo más Torre.',
  250:  "Un diario olvidado: «Si lees esto, no busques el final. Busca por QUÉ empezaste a subir».",
  500:  'La Torre ya te conoce. A veces jura tu nombre con la voz de alguien a quien amabas.',
  1000: 'Mil pisos. Y por primera vez, la voz calla. Como si por fin te respetara.',
  2500: 'Los escalones empiezan a repetir TUS propios pasos. ¿Subes tú, o la Torre te sube?',
  5000: 'A medio camino del cielo imposible, entiendes algo: no escapas de la Torre. La completas.',
  9111: 'El último piso. Una puerta. Y detrás de ella... tu picnic en el bosque, esperándote desde el inicio.',
};

/** Devuelve el texto del hito de ese piso (o null). */
export function storyBeatFor(floor) {
  return STORY_BEATS[floor] || null;
}
