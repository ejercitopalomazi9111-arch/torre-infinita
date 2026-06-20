# PREGUNTAS para el humano (reviso ocasionalmente; mientras tanto avanzo con el supuesto razonable)

> Formato: Pregunta → Supuesto con el que avanzo → Impacto si me corriges.

## Q-001 · Estrategia de assets de Pokémon
**Pregunta:** ¿OK usar PokeAPI / sprites abiertos (recognizable, cero placeholders) cacheados localmente, asumiendo proyecto fan no comercial?
**Avanzo con:** sí, PokeAPI (ver D-002).
**Impacto si cambias:** afecta la fuente de TODOS los sprites de criatura, no la arquitectura.

## Q-002 · Ubicación del proyecto
**Pregunta:** ¿Carpeta correcta = `OneDrive\Desktop\Torre Infinita`?
**Avanzo con:** sí.
**Impacto:** solo mover carpeta.

## Q-003 · Online/backend
**Pregunta:** ¿Hay servidor disponible (Supabase/Railway/propio) para la fase online, o lo dejo como stubs WebSocket hasta tener uno?
**Avanzo con:** stubs + arquitectura lista, sin desplegar backend (prioridad ⑥, tardía).
**Impacto:** solo cuando lleguemos a online.

## ROADMAP pedido por Carlos (no olvidar)
- **Pesca (caña):** mecánica de pescar Pokémon de agua en biomas con agua (charcos/ríos/costa). Cañas de distinta calidad (Vieja/Buena/Súper) → pools de encuentro distintos. Mini-evento de "¡picó algo!". Va con L (objetos y movilidad clásicos mejorados).
- "y cosas así": objetos clásicos ampliados (repelentes, cañas, bici, MO/MT equivalentes), todos con función real.

## Q-004 · Alcance por sesión
**Nota de precisión:** este es un producto AAA de muchas sesiones. Construyo por capas, siempre dejando un build jugable. No prometo "todo terminado" en una sesión: eso sería falso.
