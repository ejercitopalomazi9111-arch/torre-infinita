# ROADMAP POR LOTES — Torre Infinita (2026-06-11)
> Orden pedido por Carlos: PRIMERO lo estético (mochila, sprites, vida del mundo), LUEGO lo previo.
> Cada ítem cumple las reglas permanentes (assets de la web, una estética por capa, ≥1 Pokémon/update, QA con captura).

## LOTE A — Estética y UX inmediata 🎨 (EN CURSO)
- [x] A1. MOCHILA en overworld (tecla M, sprites de objetos, curar/revivir fuera de combate) ✅
- [x] A2. Carrusel alineado (pies sobre la sombra) ✅
- [x] A3. Pociones rocían DE FRENTE (bote a la derecha, mirando al Pokémon) ✅
- [x] A4. Flechas de puertas eliminadas ✅
- [x] A5. Título vivo (estrellas fugaces + siluetas voladoras + oscilación) ✅
- [x] A6. Game Over = Poké Ball rompiéndose ✅
- [ ] A7. Props estilo GBA clásico (las rocas Showdown son demasiado detalladas): rocas/arbustos/charcos de tilesets reales GBA (pret) · hierba alta en pisos NO-cueva · charquitos animados · estética "mundo abierto clásico"
- [ ] A8. Vida en combate: idle de respiración/oscilación de los sprites + embestida según categoría del ataque (como los clásicos)
- [ ] A9. Mundo vivo: hojas que caen, polvo, agua animada
- [ ] A10. Chibi que SÍ corresponda al entrenador elegido (mejor mapeo o fuente FRLG/HGSS)

## LOTE B — Combate y captura core ⚔️
- [ ] B1. EXP al ganar (barrita animada subiendo) + monedas + subida de nivel
- [ ] B2. LEARNSETS REALES por nivel (PokeAPI moves): el inicial NUNCA sale con todo; aprende al subir; lista de movimientos descubiertos (por captura y por aprendizaje)
- [ ] B3. Captura completa estilo juegos: estrellitas + jingle, "¡registrado en la Pokédex!" si es nuevo, prompt de MOTE siempre, equipo lleno (6) → PC con aviso
- [ ] B4. Cada Pokémon recuerda SU ball de captura; cambio de Pokémon = regresar (rayo rojo a su ball) + lanzar la ball del entrante
- [ ] B5. Encuentros tipo RUTAS: tabla por piso (piso 1 = débiles estilo Ruta 1), niveles escalan suave, RATE reducido en pisos tempranos (hoy es injugable)
- [ ] B6. Más variedad de FX (por movimiento, no solo por tipo)
- [ ] B7. EVOLUCIÓN (PokeAPI evolution-chains) + Caramelo Raro + objetos NO aparecen de la nada (origen: tienda/pickups)
- [ ] B8. ENTRENADOR al final del combate (aparece SIEMPRE): huir → recoge a su Pokémon (rayo a su ball) · derrota → lo recoge + gotitas de sudor + ball quebrándose · victoria → celebra con su Pokémon / levanta su ball al aire · captura → lanza al aire LA ball usada. La ball SIEMPRE es la correcta (con la que se capturó / se intentó). Mínimo 4 reacciones distintas por escenario, al azar
- [ ] B9. Personaje no se queda en anim de caminar al volver de combate ✅ (fix 2026-06-11)

## LOTE C — Mundo y estructura 🌍
- [ ] C1. Piso 1 SIEMPRE bosque; bajada al 2 = agujero de cueva; en cuevas escaleras estilo PMD
- [ ] C2. Poké Balls tiradas por el piso con objetos al azar (pickups brillantes)
- [ ] C3. Pokémon corredor visible en el mapa: si lo tocas, combate
- [ ] C4. Entrenadores NPC que caminan, te VEN (línea de visión) y te desafían (con ! y todo)
- [ ] C5. TIENDA PRE-RUN roguelike: ventajas compradas con puntos de partidas anteriores (meta-progresión) + GUARDADO
- [ ] C6. INTRO NARRATIVA bonita: picnic en el bosque → caes por el agujero → tu inicial te encuentra y te trata según su PERSONALIDAD (Totodile muerde → Pokocho → amistad → te protege), con animaciones

## LOTE D — Lo previo (sigue vigente) 📦
- [ ] D1. Pokédex CLÁSICA (menú estilo juegos, vistos con "???")
- [ ] D2. Replay: comentarista DESPUÉS de la acción, textos más arriba, cámara orbital/detrás del rival, pausas
- [ ] D3. Sprites de combate ANIMADOS B/W (PokeAPI gen-V, frente + ESPALDA) — capa entera, GIF→spritesheet
- [ ] D4. CORREA individual (capturados no siguen sin su correa)
- [ ] D5. Zonas seguras /5 · JEFES /10 con mecánica única · biomas con música
- [ ] D6. Tilesets reales para suelos/paredes (sustituir texgen)
- [ ] D7. Aldea HUB, online, retención, historia (MASTER_LIST)
