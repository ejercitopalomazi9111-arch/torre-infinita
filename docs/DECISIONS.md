# DECISIONS — por qué cada decisión es superior a sus alternativas

## D-001 · Stack: Phaser 3 + ES modules + Vite ligero
**Alternativas:** PixiJS puro (más bajo nivel, reinventar escenas/input), Kaboom (menos maduro para RPG), Unity/Godot (no es web-share inmediato, viola "link jugable y probable").
**Decisión:** Phaser 3. Tiene escenas, input, tilemaps, animaciones, audio y WebGL pixel-perfect listos. Vite da HMR sin build pesado. Deploy estático directo a GitHub Pages.

## D-002 · Assets de Pokémon: PokeAPI sprites repo
**Alternativas:** (a) dibujar criaturas originales → "mediocres", el prompt prefiere variedad de Pokémon reales; (b) rip manual de ROMs → lento, legalmente más turbio; (c) generar con IA → "sabor IA", prohibido.
**Decisión:** PokeAPI (pokeapi.co) + su repo de sprites (sprites oficiales Gen 1-9, incluidos los animados Gen5 B/W y showdown gifs) — datos abiertos, recognizable al instante, CERO placeholders, sin caza manual. Proyecto no comercial/fan. Se cachean localmente en build para no depender de red en runtime.
**Consecuencia:** UI/tiles NO vienen de aquí → se construyen con tileset abierto estilo Pokémon + pixel art propio.

## D-003 · Solver anti-softlock por modelo de alcanzabilidad con llaves consumibles
**Alternativas:** generar siempre "perfecto" sin validar (frágil), o BFS exhaustivo sobre todos los estados de llaves (exponencial).
**Decisión:** punto-fijo de alcanzabilidad: expandir conjunto alcanzable recogiendo llaves de salas alcanzables; abrir cerraduras frontera mientras (llaves recogidas − cerraduras abiertas) > 0. Si no hay progreso y la salida no es alcanzable → softlock → regenerar con siguiente semilla. Garantía total, coste lineal.

## D-005 · Videocámara de Combate: grabación por RE-SIMULACIÓN determinista
**Petición:** objeto/función de Pokédex para guardar una "grabación" de un combate y reverla.
**Alternativas:** (a) grabar vídeo/frames → pesadísimo en almacenamiento, imposible en localStorage; (b) grabar cada estado por turno → grande y frágil.
**Decisión:** como la batalla es determinista (RNG sembrado + log de eventos), una grabación = **snapshot inicial de ambos equipos + semilla + secuencia de acciones del jugador**. Al reproducir se reconstruye el combate idéntico, golpe por golpe. Almacenamiento mínimo (no frames, se re-simula). En `localStorage`, capado a 12.
**Consecuencia:** exige que el combate NUNCA dependa de aleatoriedad no sembrada → ya garantizado por battle.js. La IA (lado B) también es determinista por la misma semilla.

## D-004 · Generación: grilla estilo Binding of Isaac
**Decisión:** crecimiento por grilla desde sala central; dead-ends → salas especiales (jefe en el más lejano por BFS). Reproducible por semilla. Cadencias: cada 5 pisos zona segura, cada 10 jefe.

## D-006 · Entrenador en el piso: sprite Showdown ESTÁTICO + saltito (por ahora)
**Contexto:** los sprites de entrenador de Showdown no traen hojas de caminar (solo pose estática). El entrenador procedural 4-dir con frames (registerTrainerFrames) existe, pero viola la regla de assets (2026-06-11: prohibido crear assets, todo de la web).
**Alternativas:** (a) procedural animado → prohibido por regla de assets; (b) buscar overworld sheets reales (Spriters Resource HGSS/BW) → es lo correcto, pendiente ⚪; (c) estático + saltito de paso (como los seguidores) → coherente, cero assets propios, listo hoy.
**Decisión:** (c) ahora, (b) como mejora planificada. El saltito usa la escala base de setDisplaySize (bug del gigante ya corregido).

## D-007 · Confirmaciones de menú: evento keydown + polling (cinturón y tirantes)
**Contexto:** en QA headless el frame rate baja; una pulsación corta (down+up entre frames) se perdía para el polling JustDown → Enter no elegía personaje y el shot pasaba "en verde" sin haber salido de la selección.
**Decisión:** acciones de confirmación críticas escuchan el EVENTO keydown (con guard anti-doble) además del polling GBA; shot.mjs usa pulsaciones sostenidas (~100ms). Regla para futuras escenas de menú.
