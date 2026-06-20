# MASTER LIST — Torre Infinita (lista maestra de cobertura)

> Derivada del prompt original (misión A–R) + prompt de auditoría (15 secciones) + prompt director indie.
> Regla: cada ítem está ✅ hecho, 🟡 en progreso, ⚪ planificado o 🔽 bajado de prioridad. NUNCA eliminado.
> Verificar esta lista al cierre de cada sesión.

## ⭐ Reglas permanentes (de Carlos, no negociables)
- Cada actualización añade **≥1 Pokémon nuevo** (sprite+stats reales; fangames OK)
- **Sprites REALES siempre**: Pokémon → PokeAPI/sprites repo (GitHub PokeAPI/sprites) · Entrenadores → Pokémon Showdown (play.pokemonshowdown.com/sprites/trainers) · cero placeholders
- **PROHIBIDO que la IA cree assets** (2026-06-11): ni placeholders ni procedurales nuevos; TODO asset se descarga de la web (tiles/UI/FX: tilesets reales de Pokémon — Spriters Resource, packs abiertos). Pendiente derivado: sustituir texturas procedurales (texgen) por tilesets reales ⚪
- **Replays = estilo COMENTARISTA** (retransmisión con comentarista emocionado, commentary.js) — no repetición muda
- **anime.js es la biblia de animaciones** UI/interactivas (animejs.com): usar su vocabulario de easings/curvas/stagger/timelines; en Phaser se implementa con tweens respetando esas curvas (Back.out, Elastic, spring…)
- Estética ① ante todo: captura confundible con un Pokémon oficial 2D
- **Todo lo SELECCIONABLE lleva descripción divertida** (2026-06-11): movimientos, objetos, opciones, entrenadores, equipo… (data/flavor.js; navegar menús debe entretener; sin sabor IA). Pendiente extender a: Pokédex/repeticiones, futuros menús de tienda/caja/correa ⚪

- **UNA SOLA ESTÉTICA por capa** (2026-06-11): overworld = chibi GBA/PMD · selección y combate = arte completo · no mezclar estilos en la misma pantalla. Si se adoptan sprites animados de combate, se cambia la capa ENTERA (preferir PokeAPI gen-V B/W animated, que tiene frente+espalda y es coherente; los Gen 6 de DeviantArt solo si no rompen la estética)

## 📋 COLA PRÓXIMO LOTE (pedidos de Carlos 2026-06-11, en orden)
1. ⚪ Captura COMPLETA estilo juegos: estrellitas al capturar + jingle, pantalla "¡registrado en la Pokédex!" si es nuevo, prompt "¿Quieres ponerle un mote?" SIEMPRE, y si ya hay 6 en el equipo → va al PC (con aviso)
2. ⚪ CORREA individual (objeto): los capturados NO siguen al jugador hasta equiparles su correa; gestionar quién sigue
3. ⚪ Movepools COMPLETOS por especie (PokeAPI move data) + lista de "movimientos descubiertos" (al capturar se añaden los suyos; al aprender/enseñar también) + enseñar movimientos
4. ⚪ Pokédex CLÁSICA: menú estilo juegos (lo actual está simplón), entradas VISTAS abribles con datos en "???"
5. ⚪ Replay: comentarista DESPUÉS de la acción (no antes, "parece que conoce el futuro"), textos más ARRIBA (se cortan), cámara con perspectivas (detrás del rival, órbita pseudo-3D), más FX, pausas entre movimientos
6. ⚪ Sprites de combate ANIMADOS (B/W animated de PokeAPI gen-V: frente + ESPALDA para que tu Pokémon pelee de espaldas) — requiere decodificar GIF→spritesheet (dep npm) y cambiar la capa entera (regla estética)
7. ⚪ Botón MOCHILA en el overworld (menú con sprites de los objetos)
8. ⚪ EVOLUCIÓN + EXP/subida de nivel (pendiente previo; necesita evolution-chains de PokeAPI)

## A. Motor + QA
- ✅ Phaser 3 + Vite, ES modules, data-driven
- ✅ smoke.mjs (torre) + combat-smoke.mjs + shot.mjs (Puppeteer, gate 0 errores)
- ⚪ Deploy GitHub Pages (link jugable) — pendiente primer deploy

## C. Dirección artística (prioridad ①)
- ✅ Sprites reales PokeAPI (442 cacheados) + texturas/tiles procedurales + paleta nocturna
- ✅ Título pulido, transiciones fade, pixel-perfect
- 🟡 Animación única POR ataque — motor data-driven HECHO con FX por TIPO (18, sprites reales Showdown, fxPlayer.js); siguiente nivel: por movimiento individual
- ⚪ Clima visual (lluvia/sol/nieve/arena/niebla), iluminación
- ⚪ Spritesheet de caminar del entrenador (hoy: estático Showdown + rebote — decisión D-006)

## D. Torre procedural (9111 pisos)
- ✅ Generador grafo de salas por semilla + solver anti-softlock (145 pisos, 0 softlocks)
- ✅ Salas: normal/tesoro/llave/puerta/escalera
- ⚪ Salas especiales: tienda, Centro Pokémon, puzzle, secreta, santuario, evento raro, legendario, comerciante oculto, atajos
- 🟡 Biomas temáticos por tramo: 8 definidos (cuevas/bosque/ruinas/glaciar/volcán/lab/cielo/distorsión) con paleta + props de entorno propios (obstáculos+clutter, 2026-06-11); falta música/eventos/jefes por bioma
- ⚪ Cadencias: cada 5 pisos zona segura · cada 10 pisos JEFE (sección H)
- ⚪ Dificultad adaptativa + selector Fácil/Normal/Difícil/Infierno
- ⚪ Metroidvania ligero: bicicleta, atajos, backtracking
- ⚪ Variantes de pisos (auditoría §2): malditos, oscuros, invertidos, congelados, infestados, temporales
- ⚪ Endgame/prestigio (auditoría §2): reinicios opcionales, recompensas permanentes, rutas nuevas

## E. Sistemas Pokémon
- ✅ Especie/nivel/stats reales + computeStats Gen III (IVs/EVs/naturaleza en fórmula)
- ✅ Captura + Pokédex con ficha (nº, tipos, peso/altura, stats, movimientos)
- 🟡 Moveset por tipo (movepool) — falta: aprendizaje por nivel real, PP
- ⚪ Evolución (nivel/objeto/amistad), megas, formas regionales
- ⚪ Habilidades con efecto real, géneros, amistad, shiny (§10 auditoría: shinys variantes/corruptos/legendarios + FX)
- ⚪ Objetos: equipables, bayas, Pokochos, entrenamiento EVs, evolutivos, cosméticos

## F–G. Crianza + rasgos
- ⚪ Guardería, herencia IVs/naturaleza/habilidad/rasgo, grupos huevo, linaje shiny
- ⚪ Rasgos de personalidad con efecto mecánico (agresivo/tímido/protector/perezoso…) — followers ya deambulan según naturaleza

## H. Jefes (cada 10 pisos)
- ⚪ IA superior + mecánica única por jefe + fases + telegrafía (NO solo más vida)

## I–J. Vida/amistad + seguidores
- ✅ Seguidores en cola estilo HGSS (entrenador→Pikachu→Eevee), deambular por naturaleza
- ⚪ Correa como OBJETO equipable (hoy followers son fijos), múltiples correas por progresión
- ⚪ Amistad profunda: acariciar/jugar/alimentar, beneficios en combate, accesorios

## K. Combate
- ✅ Modo 1 turnos: typechart 18 tipos, daño Gen V+, estados, stat stages, determinista (A-02), grabación/replay
- 🟡 Menú combate completo: Luchar ✅ · Mochila ✅ (navegable) · Pokémon ✅ (cambio) · Huir — verificar/balancear
- 🟡 Balance sistemático (A-14): gate TTK 2.5–9 turnos en combat-smoke ✅; falta curva por piso
- ✅ IA de combate por arquetipos (§7): wild/aggressive/defensive/smart, determinista, replay-safe
- ⚪ Sinergias de equipo, combos, estrategias de jefes
- ⚪ MODO 2 anime/tiempo real (correa): movimiento libre, esquivas, cobertura, combos — NO turnos disfrazados

## L. Objetos y movilidad
- ⚪ Bicicleta, zapatillas, repelentes, cañas — versiones MEJORADAS

## M. Aldea HUB + online
- ⚪ Aldea persistente: tiendas, Centro, guardería, NPCs con memoria/relaciones (§6), personalización
- ⚪ Online por fases (§9): intercambios, mercado, combates pisos 15/25/35, clanes, rankings, torneos, temporadas — arquitectura WebSocket con stubs
- ⚪ Economía completa (§3): dinero + monedas raras + materiales por bioma, sumideros, precios dinámicos, anti-exploit
- ⚪ Botín moderno (§4): rarezas (común→mítico), únicos por partida, corruptos, reliquias
- ⚪ Clases de entrenador (§5): explorador/científico/criador/cazador shiny/comerciante + árbol de habilidades
- ⚪ Misiones (§8): principales/secundarias/secretas/de bioma/de amistad/de crianza

## N. Automatización (filosofía Spore)
- ✅ fetch-sprites.mjs (roster masivo), fetch-trainers.mjs, texgen procedural, PNG encoder propio
- ⚪ Motor de animaciones de ataque data-driven (forma+partículas+timing por dato)
- ⚪ Motor de diálogos anti-repetición/anti-sabor-IA
- ⚪ Editores internos (§14): pisos, NPCs, diálogos, jefes, eventos, objetos, habilidades

## O. UI + i18n
- ✅ HUD exploración (piso/minimapa), HUD combate, Pokédex, mochila/equipo navegables por teclado
- ✅ Motor i18n (EN base + ES)
- 🟡 Cobertura i18n total (hay cadenas hardcodeadas en escenas nuevas)
- ⚪ Caja/PC, tiendas, configuración, gestión correa/amistad

## P. Historia (prioridad ⑧ — última)
- ⚪ Lore ambiental fragmentado, secretos por bioma, condiciones absurdamente específicas (§11: legendarios, mazmorras ocultas, jefes secretos)
- ⚪ PROHIBIDO: historia de Galubas, diálogos repetitivos/sabor IA

## Q. Extras
- ⚪ Reliquia "60 Segundos" (DEBE existir)
- 🔽 Easter egg escopeta (prioridad bajísima, no eliminar)

## §12–13. Retención + rendimiento
- ⚪ Logros, títulos, récords, estadísticas, desafíos diarios/semanales/mensuales
- ⚪ Guardado de partida/run (¡aún NO hay save!) + perf: lazy-load sprites, pooling, presupuesto por escena

## Roguelike core (rescate 2026-06-10)
- ✅ Movimiento por casillas GBA (D-pad, correr con B), control 100% teclado
- ✅ Game Over estilo Undertale (derrota = nueva partida, sin curar)
- ✅ Selección de personaje (14 entrenadores Showdown reales)
- 🟡 QA del lote de selección — bug Enter detectado 2026-06-10, en arreglo
