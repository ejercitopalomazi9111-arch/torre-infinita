# PLAN DEMO "de un sentón" — orden de importancia (2026-06-12)
> Regla de Carlos: NO avanzar al siguiente bloque hasta terminar el anterior.
> Espaldas/sprites animados B/W y extras: SOLO después de cerrar estos 4 bloques.

## BLOQUE 1 — JUGABILIDAD CRÍTICA (bloqueadores)
- [ ] 1.1 FIX piso 2 pantalla negra al bajar (repro: tools/debug-descend.mjs)
- [ ] 1.2 FIX título no inicia con gamepad (✕/Options) — polling gba en TitleScene
- [ ] 1.3 FIX cambio de Pokémon en combate: usa e.speciesId del EVENTO (hoy lee el estado final → anuncia Wurmple pero se ve Piplup, y el faint anima al equivocado). battle.js: añadir speciesId al evento 'switch' (post-faint) también
- [ ] 1.4 FIX barra de vida en cambio: NUNCA baja antes de la animación/daño (al cambiar aparece ya descontada). rebuildPanel debe usar el HP "visto" (shownHp) del momento, no el final del turno
- [ ] 1.5 FIX sendout: la ball del lanzamiento debe ser LA DEL POKÉMON (mon.ball, guardar al capturar; iniciales = pokeball). Cambio de pokémon: regresar con su ball + lanzar la del entrante
- [ ] 1.6 Pickups: la pokéball tirada BLOQUEA el paso (cell.blocked) y se abre con A mirándola (no auto-pisar)
- [ ] 1.7 GUARDADO: saveRun() en localStorage (run+floor+trainer+starter+allTrainers) tras bajar piso/combate/servicio; Título muestra "C: continuar" si hay save. (El "se reinicia al cambiar de ventana" es en parte el reload de Vite cuando edito; el save lo cura)
- [ ] 1.8 Movimiento del jugador MÁS LENTO al caminar (WALK_MS 150→190; correr igual 85)

## BLOQUE 2 — ANIMACIÓN INICIAL pulida
- [ ] 2.1 Fondo = MISMA estética que los pisos de bosque (paleta + rocas/props; ÁRBOLES: probar pret misc/cuttable_tree.png con tRNS; el piso de la caída ES el piso 1 bosque)
- [ ] 2.2 El chibi mira a la DERECHA al caminar (frames laterales + flip, no fila down)
- [ ] 2.3 Pokémon llega EN SOMBRA (bajo overlay) y se REVELA al presentarse (depth swap + flash)
- [ ] 2.4 Pregunta "¿Darle el Pokocho?" Sí/No → No = te lo ARREBATA (lunge + línea graciosa); Sí = normal
- [ ] 2.5 Giro del orgulloso (Piplup) SIN pop: squash scaleX→0, flip, scaleX→normal (como el caminar procedural)

## BLOQUE 3 — MENÚS (referencias de Carlos en Screenshots/)
- [ ] 3.1 FIX contorno de botones de pelea se sale del recuadro (quitar setScale del highlight)
- [ ] 3.2 FIX barra HUD superior tapa la pared/paso norte → auto-desvanecer a alpha 0.35 tras 2.5s (volver al abrir menú/toast)
- [ ] 3.3 FIX repeticiones: scroll cuando hay muchas (contenedor con máscara + offset al mover)
- [ ] 3.4 FIX replay: el shake deja ver 1-2px bajo el letterbox (barras +6px de alto)
- [ ] 3.5 Pociones: ELEGIR a qué Pokémon (en combate y mochila: sub-lista de equipo)
- [ ] 3.6 Menú POKéMON (combate y piso): al seleccionar → Info / Usar objeto / Equipar objeto
- [ ] 3.7 Botón de Pokédex en gamepad (Select abre Pokédex en el piso)
- [ ] 3.8 GRANDES (estilo Gen 3, imágenes de referencia): pantalla EQUIPO con paneles laterales del SITIO (DOM/CSS: cajas de equipo con sprite+mote+nv+barra, se oscurecen al morir, fondo Rayquaza Esmeralda oscurecido, botones arcade animados al pulsar) · ficha INFO de Pokémon (perfil/movimientos/memo de entrenador con DÓNDE se capturó + botón para reproducir la repetición de su captura) · pantalla APRENDER MOVIMIENTO (reemplazar/hueco/cancelar) · PC de cajas (depositar/retirar/cambiar, los debilitados NO se curan) · menú OPTIONS clásico · Pokédex con la estética de la referencia en otros colores
- [ ] 3.9 Iniciales: solo el del jugador a Nv1; el resto de mecánica igual

## BLOQUE 4 — SONIDO COMPLETO
- [ ] 4.1 tools/fetch-audio.mjs: música REAL desde play.pokemonshowdown.com/audio/ (mp3 de combate por gen) + cries (audio/cries/<nombre>.ogg) — probar URLs, tolerar 404
- [ ] 4.2 BGM por BIOMA en el piso (loop, volumen suave) + música de COMBATE + en REPETICIONES: música de pelea + SONIDOS DE PÚBLICO (crowd; buscar en showdown sfx o fuente abierta)
- [ ] 4.3 Cries: al aparecer el salvaje y al sacar tu Pokémon (carga dinámica local)
- [ ] 4.4 SFX de menús (mover cursor/confirmar/cancelar)

## DESPUÉS (no tocar hasta cerrar 1-4)
Espaldas + sprites animados B/W · entrenadores NPC con visión · pokémon corredor · variantes de piso · gimnasios/casino/torneo/guardería (pisos 15+) · tienda pre-run con meta-puntos · evolución+caramelos · learnsets completos · correa individual · dopamina de avance (mini-eventos de historia, recompensas por piso)
