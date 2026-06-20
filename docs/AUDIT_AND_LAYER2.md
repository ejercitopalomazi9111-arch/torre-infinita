# AUDITORÍA AAA + SEGUNDA CAPA DE DISEÑO — Torre Infinita

> Documento de **segunda capa**. NO reemplaza `PLAN.md` (aprobado). Asume el plan
> como base y añade profundidad de director (Game Freak + Nintendo + AAA).
> Anclado a la arquitectura real ya construida: data-driven, sembrada por semilla,
> ES modules, solver anti-softlock, capa de ruido/texturas. Regla: no simplificar.

Leyenda de prioridad: **P0** (bloqueante) · **P1** (crítico) · **P2** (importante) · **P3** (deseable).

---

## 1. AUDITORÍA COMPLETA — puntos débiles, vacíos y riesgos

> Formato por hallazgo: Riesgo · Cuándo aparece · Prevención · Solución.

### 1.1 Sistemas incompletos
| # | Hallazgo | Riesgo | Cuándo aparece | Prevención | Solución |
|---|----------|--------|----------------|------------|----------|
| A-01 | **Modelo de datos de Pokémon sin capa de cálculo de stats** (IVs/EVs/naturaleza definidos pero sin fórmula central) | Stats inconsistentes entre combate, crianza y UI | Al implementar el 2º consumidor de stats (UI tras combate) | Una sola función `computeStats(mon)` pura y memoizada, fuente única de verdad | Crear `systems/pokemon/stats.js` con fórmula GenIII+ exacta; prohibir cálculo inline en cualquier otro módulo |
| A-02 | **Sin máquina de estados de turno formal** en combate modo 1 | Bugs de orden (prioridad, velocidad, post-turno) difíciles de reproducir | Al añadir estados/clima/objetos que actúan "a fin de turno" | Diseñar la fase de turno como pipeline de sub-fases nombradas | `BattlePhase` enum + cola de eventos resueltos en orden determinista |
| A-03 | **Modo 2 (tiempo real) sin contrato de simulación fijo** | Desync online, físicas no deterministas | Al meter online o repeticiones (replays) | Fijar tickrate (p.ej. 30 Hz) y simulación determinista por entero/fixed-point | Lockstep determinista + semilla compartida; render desacoplado de simulación |
| A-04 | **i18n motor existe pero sin extractor** | Cadenas hardcodeadas se cuelan con el tiempo | A las pocas semanas de contenido | Lint/CI que prohíbe strings literales en `scenes/ui` | `tools/i18n-scan.mjs` que falla el build si halla texto fuera de tablas |
| A-05 | **Pokédex/lore sin esquema de "condición de descubrimiento"** | Misterios de comunidad imposibles de versionar | Al diseñar legendarios/secretos (sección 11) | Esquema declarativo de condiciones desde ya | `data/discovery/*.js` con predicados serializables |

### 1.2 Dependencias ocultas
| # | Dependencia | Riesgo | Prevención / Solución |
|---|-------------|--------|------------------------|
| A-06 | Crianza (F) depende de genética + naturalezas + habilidades + grupos huevo → **4 subsistemas deben existir antes** | Si se empieza crianza temprano, se bloquea | Marcar crianza como P2 detrás de E completo. Gate en `gate-check`. |
| A-07 | Modo 2 depende de **pathfinding + colisión + correa (J)** | Construir combate anime sin navegación = retrabajo | Orden: navegación de piso → correa/seguidor → modo 2 |
| A-08 | Online (M) depende de **simulación determinista (A-03) + formato de save versionado (sección 13)** | Netcode sobre base no determinista = imposible | Determinismo y save-schema son prerequisitos duros |
| A-09 | Jefes con mecánica única (H) dependen de un **motor de scripting de combate** | Jefes hardcodeados = deuda enorme | Motor de eventos de combate data-driven antes del 1er jefe real |

### 1.3 Cuellos de botella técnicos
| # | Cuello | Riesgo | Prevención / Solución |
|---|--------|--------|------------------------|
| A-10 | **Generación de texturas en runtime** por celda | Tirones al entrar a sala | Pre-generar N variantes por bioma a un atlas en `boot`, reusar (ya diseñado en `makeVariants`) |
| A-11 | **9111 pisos en memoria** si se cachean | OOM | Solo el piso actual + vecinos en memoria; el resto se regenera por semilla (determinista, gratis) |
| A-12 | **Sprites de cientos de Pokémon** cargados de golpe | Pico de RAM/red | Carga perezosa por especie presente en el piso + LRU cache (sección 13) |
| A-13 | **Phaser DisplayList con miles de tiles** | Caída de FPS | Tilemaps por chunk + culling fuera de cámara; objetos estáticos a RenderTexture |

### 1.4 Riesgos de escalabilidad / balance / redundancia / deuda
| # | Hallazgo | Tipo | Riesgo · Prevención · Solución |
|---|----------|------|-------------------------------|
| A-14 | Escalado de dificultad **adaptativo + por piso + manual** se multiplican | Balance | Pueden colisionar y volver trivial/imposible un piso. **Prevención:** un único `difficultyResolver(floor, team, history, manual)` con techos y suelos. **Solución:** clamp a banda [0.6×, 2.2×] del baseline. |
| A-15 | EVs + objetos de entrenamiento + rasgos + amistad + crianza **todos suben poder** | Balance | Inflación de stats que rompe la curva. **Prev.:** presupuesto de poder por Pokémon (Power Budget, ver §3.5). **Sol.:** rendimientos decrecientes y caps duros. |
| A-16 | Reliquia 60s + botín + economía pueden **dar recursos infinitos** | Economía | Bucle de farmeo. **Prev.:** sumideros y cooldowns (§3). **Sol.:** diminishing returns por piso repetido. |
| A-17 | Modo 1 y Modo 2 podrían volverse **redundantes** (uno domina) | Redundancia | **Prev.:** que cada modo dé recompensas/feel distintos, no estrictamente superior. **Sol.:** Modo 2 = más riesgo/skill/recompensa; Modo 1 = control/seguridad. |
| A-18 | Diálogos generados con plantillas → **"sabor IA"** | Deuda/calidad | **Prev.:** banco de voz por arquetipo + verificador anti-repetición (n-gram). **Sol.:** `tools/dialogue-lint.mjs` rechaza repeticiones y muletillas. |
| A-19 | Datos data-driven sin **validación de esquema** | Deuda | Un JSON malo rompe runtime. **Prev.:** esquemas + `tools/data-validate.mjs` en CI. **Sol.:** validación al cargar con errores claros. |
| A-20 | Save gigante (cajas, dex, progreso, economía) | Escalabilidad | **Prev.:** save versionado + delta + compresión (§13.4). **Sol.:** migradores por versión. |

**Top 5 a atacar primero (P0/P1):** A-01 (stats únicos), A-02/A-03 (determinismo de combate), A-09 (scripting de jefes), A-14/A-15 (resolver de dificultad y power budget), A-19 (validación de datos).

---

## 2. ENDGAME REAL — 9111 pisos sin repetición

**Principio:** la repetición se combate con **variación combinatoria** (no con contenido lineal infinito, imposible de producir). Cada expedición = combinación única de {bioma×ciclo} × {modificador de piso} × {semilla} × {objetivos} × {estado meta del jugador}.

### 2.1 Sistema de Prestigio ("Ascenso de la Torre")
- Al alcanzar un **hito de cumbre** (p.ej. piso 100, 250, 500, 1000…) el jugador puede **Ascender**: reinicia la expedición desde piso 1 pero conserva *meta-progreso*.
- **Niveles de Prestigio (P-rank):** cada Ascenso sube P-rank. Cada P-rank:
  - +1 ranura de **Reliquia permanente** equipable.
  - Desbloquea una **ruta nueva** del árbol de la torre (ramas alternativas con biomas reordenados).
  - +5% recompensa rara, pero +8% dificultad base (la torre "recuerda").
- **Moneda de prestigio:** `Esencia de Cumbre` (rara), solo se obtiene Ascendiendo. Gasta en mejoras permanentes (§3.1).

### 2.2 Reinicios opcionales y recompensas permanentes
- **Reinicio suave (Expedición):** mueres/sales → vuelves a la Aldea con lo cosechado (run-based). Es el bucle normal roguelike.
- **Reinicio duro (Ascenso):** voluntario, da meta-recompensas grandes. Nunca forzado.
- **Recompensas permanentes** (no se pierden nunca): entradas de Pokédex, Reliquias permanentes, mejoras de Aldea, títulos, cosméticos, nodos del **Árbol del Guardián** (meta-árbol de bonificaciones: +slot de equipo, +inventario, +chance shiny, autorrevivir 1×, etc.), recetas de crianza descubiertas.

### 2.3 Nuevas rutas y nuevos biomas (desbloqueo progresivo)
- La torre es un **grafo de tramos**, no una pila lineal. Tras cada bioma hay 1–3 salidas → distintos biomas siguientes. El jugador elige ruta (riesgo/recompensa).
- **Biomas de élite** (desbloqueados por P-rank o secretos): Jardín Prisma (shinies +), Necrópolis (pisos malditos garantizados), Sala de los Espejos (pisos invertidos), Núcleo del Tiempo (pisos temporales). Cada uno reusa el motor de biomas (`data/biomes.js`) — solo datos nuevos.

### 2.4 Variantes de piso (modificadores) — el corazón de la rejugabilidad
Cada piso puede recibir 0–2 **modificadores** (sembrados; más arriba, más probables). Implementación: campo `floor.modifiers[]` aplicado en `generateFloor`, consumido por render/combate/loot.

| Modificador | Efecto mecánico | Estética | Recompensa |
|-------------|-----------------|----------|------------|
| **Maldito** | Enemigos +30% poder, sin huida, 1 bendición al limpiarlo | Paleta desaturada, partículas moradas | Botín épico+ garantizado |
| **Oscuro** | Visión reducida (FoW circular), encuentros sorpresa | Iluminación por farol del seguidor | +materiales raros |
| **Invertido** | Tabla de tipos invertida; navegación espejada | UI/mapa reflejados | Objetos "espejo" únicos |
| **Congelado** | Suelo resbaladizo (movimiento por deslizamiento, puzzles de hielo), Pokémon Hielo + | Escarcha, niebla fría | Cristales de bioma |
| **Infestado** | Sobrepoblación: hordas, encuentros encadenados | Enjambres, sonido denso | XP masiva, riesgo alto |
| **Temporal** | Cuenta atrás real; al llegar a 0 colapsa (debes subir rápido) | Reloj en HUD, distorsión creciente | Esencia de Cumbre |
| **Espejado** | Aparece un "doble" rival que copia tu equipo | Sombras invertidas | Reliquia corrupta |
| **Sobrecargado** | Clima permanente extremo del bioma | FX de clima al máximo | Objetos de clima |

Regla de combinación: máx 2, nunca combinaciones contradictorias (validador rechaza Congelado+Sobrecargado-fuego → re-rol).

### 2.5 Eventos ultra raros (memorables, "una vez en mil pisos")
- Probabilidad base ~0.1% por sala de evento, escalada por suerte/objetos. Sembrados (reproducibles para verificación de comunidad).
- Ejemplos: **El Comerciante Errante** (vende un objeto único por una memoria de tu equipo), **La Grieta** (mini-mazmorra de bolsillo a otra dimensión), **El Eco** (te enfrentas a un equipo legendario fantasma), **La Lotería del Guardián** (apuesta tu run por una Reliquia mítica), **Jardín Dormido** (todos los encuentros son shiny durante 1 piso).

---

## 3. ECONOMÍA COMPLETA

### 3.1 Monedas y recursos (capas separadas, no fungibles entre sí sin fricción)
| Recurso | Fuente (faucet) | Uso (sink) | Escasez |
|---------|-----------------|------------|---------|
| **PokéÓro (₽)** | Combates, ventas, salas tesoro | Tiendas, curación, reparaciones | Común, abundante |
| **Fichas de Bioma** | Solo del bioma actual | Comercio especializado del bioma | Media, no transferible entre biomas |
| **Cristales raros** | Salas raras, jefes | Crafting/objetos de alto nivel | Rara |
| **Materiales especiales** (escamas, esporas, núcleos) | Drop por especie/bioma | Crianza avanzada, evolución, crafting | Variable, coleccionable |
| **Esencia de Cumbre** | Solo Ascenso/pisos temporales | Meta-mejoras permanentes | Ultra rara |
| **Tokens de prestigio** | Logros, desafíos | Cosméticos, títulos | Rara, no pay-to-win |

### 3.2 Sumideros (anti dinero infinito) — OBLIGATORIOS
- **Curación con coste creciente** en Centro Pokémon según pisos avanzados (no gratis arriba).
- **Reparación/recarga** de objetos y "durabilidad" de Reliquias temporales.
- **Impuesto de la torre:** cada zona segura cobra peaje en ₽ para usar servicios premium.
- **Crianza/reroll de IVs/naturaleza** cuesta materiales + ₽ con coste exponencial por intento.
- **Reroll de modificadores/botín** (si se permite) con coste creciente.
- **Sumidero de prestigio:** las meta-mejoras tienen costes que crecen geométricamente (×1.6 por nivel).
- **Decaimiento de carry:** al volver a la Aldea solo conservas un % de ₽ (incentiva gastar antes de salir).

### 3.3 Mercado
- **NPC dinámico:** precios = `base × demanda_bioma × rareza × (1 − reputación_descuento)`. Stock rotativo por semilla diaria.
- **Jugador↔NPC:** vender con penalización (50–70% del valor) → sumidero implícito.
- **Jugador↔Jugador (online, fase tardía):** mercado con **escrow** (intercambio atómico, anti-scam), **fee del 5%** (sumidero), límites anti-lavado.
- **Precios dinámicos:** oferta/demanda global suavizada (media móvil) para evitar manipulación; banda de precios [0.5×, 2×] del valor base.

### 3.4 Balance y anti-exploit
| Exploit potencial | Defensa |
|-------------------|---------|
| Farmeo de piso fácil repetido | **Diminishing returns** por re-visita (drop ×0.85^n), encuentros se agotan |
| Duplicación por save-scumming | Save server-authoritative en online; checksum + nonce offline |
| Arbitraje de mercado (comprar barato/vender caro al mismo NPC) | Spread compra/venta siempre negativo (compras caro, vendes barato) |
| Inflación por faucet alto | Sumideros escalan con riqueza del jugador (impuestos progresivos) |
| Venta de objetos únicos infinitos | Únicos son **no vendibles** o de venta única registrada |

### 3.5 **Power Budget** (regla maestra de balance, resuelve A-15)
Cada Pokémon tiene un presupuesto de poder `PB = base + nivel + suma(EV/4) + bonos(rasgo, amistad, objeto)` con **cap duro**. Objetos/rasgos/amistad compiten por el mismo budget (no apilan linealmente). Un validador (`tools/balance-check`) marca cualquier build que supere el cap como **roto** → ajuste automático sugerido.

---

## 4. SISTEMA DE BOTÍN (roguelike moderno)

### 4.1 Rarezas y tablas
| Rareza | Color | Peso base | Modificadores | Notas |
|--------|-------|-----------|---------------|-------|
| Común | gris | 1000 | 0–1 | relleno útil |
| Poco común | verde | 420 | 1 | |
| Raro | azul | 150 | 1–2 | |
| Épico | morado | 38 | 2–3 | |
| Legendario | dorado | 7 | 3 + propiedad especial | |
| Mítico | rojo/iris | 0.8 | 3 + propiedad + set | drop fanfarria + cámara |

Drop = `weighted(tabla_bioma × suerte_jugador × modificador_piso)`. **Suerte** (stat del entrenador, §5) desplaza la curva. Implementado data-driven en `data/loot/*.js` con el `rng.weighted` ya existente.

### 4.2 Objetos únicos (uno por partida)
- Pool de **Únicos**: cada uno existe **máximo 1 vez por expedición** (registro `run.uniquesSpawned`). Tienen nombre propio, lore, arte y un efecto que define builds (ej.: *"Brújula de Arceus": revela 1 sala secreta por piso*).
- Si dropea, se retira del pool de esa run. Nunca duplicable.

### 4.3 Objetos corruptos (beneficio enorme / desventaja enorme)
- Diseño de **alto riesgo**: ej. *"Corazón Voraz": +60% daño, pero tu Pokémon pierde 5% HP máx por turno*; *"Ojo Ciego": ves todo el piso, pero los enemigos también te ven siempre*.
- Visualmente marcados (aura glitcheada). **Purificables** en Santuario por coste alto → versión equilibrada.

### 4.4 Reliquias (permanentes durante una expedición)
- Equipables en ranuras de Reliquia (escalan con P-rank). Efectos pasivos de run: *+1 reroll de tienda*, *los huevos eclosionan al doble*, *primer golpe del piso siempre crítico*.
- **Reliquias permanentes** (vía prestigio) vs **temporales** (de la run, se pierden al morir salvo que las "ancles" en Santuario por coste).

---

## 5. SISTEMA DE ENTRENADORES (profundidad de personaje)

El jugador no es solo "una bolsa de Pokémon": tiene **clase, especialización, árbol y rasgos**.

### 5.1 Clases (eliges 1 al empezar, cambiable en Aldea por coste)
| Clase | Fantasía | Pasiva núcleo | Penalización |
|-------|----------|---------------|--------------|
| **Explorador** | descubrir | +sala secreta detect, +mapa | −descuento tienda |
| **Científico** | datos | +EV/IV info, +XP +10% | −drop materiales |
| **Veterano** | combate | +5% daño, +acceso Modo 2 antes | −amistad gana lento |
| **Criador** | vínculo | +amistad, +huevos, +herencia | −poder de combate directo |
| **Cazador de Shiny** | suerte | +chance shiny, +suerte botín | −₽ por venta (coleccionista) |
| **Comerciante** | economía | mejores precios, +1 slot tienda | −stats de equipo |

### 5.2 Especializaciones (a mitad de árbol, sub-clase)
Cada clase abre 2 especializaciones (ej. Veterano → *Táctico* [sinergias/formaciones] o *Berserker* [combos de riesgo]). Define identidad de build.

### 5.3 Árbol de habilidades del entrenador
- Nodos por **puntos de maestría** (ganados subiendo de nivel de entrenador, separado del nivel Pokémon).
- Ramas: **Combate** (órdenes, prioridad, crítico), **Exploración** (visión, atajos, llaves), **Vínculo** (amistad, mascotas, correa multi), **Fortuna** (suerte, economía, reroll).
- Respec en Aldea por coste creciente.

### 5.4 Rasgos del entrenador (3 ranuras, encontrables/desbloqueables)
Ej.: *Madrugador* (+drop primeros 3 pisos), *Corazón Valiente* (inmune a miedo de jefes), *Mano Firme* (−1 fallo de orden en Modo 2), *Empático* (Pokémon de rasgo "tímido" rinden +). Interactúan con rasgos de personalidad Pokémon (§G del plan) creando combos entrenador↔Pokémon.

---

## 6. SISTEMA DE NPCS AVANZADO (memoria + relaciones)

### 6.1 Memoria
- Cada NPC persistente tiene un **registro de hechos** (`npc.memory[]`): acciones del jugador que presenció/le afectaron (le compraste, lo ignoraste, salvaste su pueblo, le ganaste, lo traicionaste en intercambio).
- Implementación: event bus → `MemorySystem` filtra eventos relevantes por NPC y los persiste en el save (acotado: últimas N + flags importantes permanentes).

### 6.2 Relaciones
- Eje **afinidad** (−100 a +100): amistad / neutralidad / rivalidad. Cambia por acciones y diálogo.
- Efectos: amistad → descuentos, misiones exclusivas, regalos; rivalidad → te reta, sabotea precios, aparece como jefe opcional.

### 6.3 Eventos únicos y misiones dinámicas
- **Misiones dinámicas:** generadas por estado (NPC recuerda que cazas shinies → te pide uno; recuerda que perdiste → te ofrece entrenamiento). Plantillas + voz por arquetipo + verificador anti-repetición (A-18).
- **Comerciantes especiales:** stock según tu historial (el Errante recuerda qué le vendiste).

### 6.4 Anti-"sabor IA" (calidad de diálogo)
- Banco de voz por arquetipo (sabio, bromista, seco, entusiasta, místico…). Cada línea pasa por `dialogue-lint`: rechaza repetición de n-gramas, muletillas IA ("¡Vaya, parece que…!"), y exige variación léxica. Sección 14 incluye el editor de diálogos.

---

## 7. COMBATE AVANZADO

### 7.1 IA (arquetipos + capa adaptativa)
| Arquetipo | Comportamiento | Telegrafía |
|-----------|----------------|------------|
| **Agresiva** | maximiza daño, ignora defensa | carga visible antes de golpe fuerte |
| **Defensiva** | cura, protege, estados, stall | postura/escudo |
| **Inteligente** | minimax 1–2 turnos, explota debilidades, predice cambios | lectura de amenaza |
| **Adaptativa** | aprende tus patrones en la run, contra-arma | cambia de plan a media pelea |
- **Motor:** árbol de comportamiento + scoring de movimientos (`score = dañoEsperado×w1 + utilidad×w2 + riesgo×w3`), pesos por arquetipo. La capa adaptativa registra tus tendencias (qué tipo usas más) y ajusta pesos. Resuelve A-09 si el scoring es data-driven.

### 7.2 Sinergias de equipo
- **Sinergias de tipo/habilidad:** ej. *Drizzle + Swift Swim*, *Trick Room + lentos*, *clima compartido*. Definidas en `data/synergies.js`; el HUD muestra sinergias activas.
- **Sinergias de rasgo (G):** *protector* cubre a *temerario*; *competitivo* gana boost si un aliado cae.

### 7.3 Formaciones (Modo 2 y dobles)
- Posiciones: **Vanguardia / Flanco / Retaguardia**, cada una con bono (vanguardia +daño/−defensa; retaguardia +apoyo/curación). Formación elegida antes del combate, parte de la estrategia.

### 7.4 Combos
- **Cadenas de movimientos** entre aliados con ventana temporal (Modo 2) o en turnos consecutivos (Modo 1): ej. *Hueco + Tierra* (lanzar al aire → golpe a tierra) = daño extra + efecto. Definidos en `data/combos.js`.

### 7.5 Estrategias de jefes (no "más vida")
- Cada jefe = **script de fases** (motor de scripting, A-09): fase 1 prueba, fase 2 mecánica única (clima forzado/terreno/adds/contadores/inmunidad condicional), fase 3 "enrage" con ventana de castigo. Telegrafía clara. Recompensa leer al rival. Ejemplo: *Guardián del Glaciar*: congela ranuras de tu equipo por turnos; debes romper el hielo golpeando con fuego en la ventana correcta.

---

## 8. SISTEMA DE MISIONES

| Tipo | Origen | Persistencia | Ejemplo |
|------|--------|--------------|---------|
| **Principal** | hilo de la torre | permanente | "Alcanza la primera cumbre (piso 100)" |
| **Secundaria** | NPCs de Aldea | run o permanente | "Trae 3 escamas del Glaciar" |
| **Secreta** | condiciones ocultas (§11) | permanente | descubierta solo por investigación |
| **Comunitaria** | online, meta global | temporada | "El servidor captura 1M de Pokémon" |
| **De bioma** | entrar a un bioma | run | "Limpia el bioma sin curarte" |
| **De amistad** | alta afinidad Pokémon (I) | permanente | minijuego de vínculo |
| **De crianza** | guardería (F) | permanente | "Eclosiona un shiny por linaje" |
- **Motor de misiones** data-driven: objetivos = predicados sobre eventos; recompensas declarativas. Reusa el event bus. Un solo `QuestSystem` evalúa todos los tipos.

---

## 9. SISTEMA SOCIAL ONLINE (fase tardía, arquitectura desde ya)

- **Clanes / Equipos:** grupos persistentes, banco compartido (con permisos), objetivos de clan, sala de clan en Aldea.
- **Rankings:** por piso máximo, velocidad (speedrun de tramo), shinies, riqueza, logros. Ligas con reset por **temporada**.
- **Torneos:** combates online en pisos 15/25/35… (ya en el plan); brackets, matchmaking por MMR, espectador.
- **Intercambios seguros:** escrow atómico server-authoritative, registro auditable, anti-scam/anti-RMT.
- **Eventos globales:** jefe de servidor con HP compartida, biomas-evento temporales, metas comunitarias (§8).
- **Temporadas:** ciclo de ~8–10 semanas: tema, modificadores rotativos, recompensas cosméticas exclusivas, leaderboard reset. **Sin monetización predatoria** (cosméticos por juego, no por dinero).
- **Arquitectura:** backend ligero WebSocket, **autoridad de servidor** para economía/intercambio/ranking; simulación determinista (A-03) para combate online; stubs claros desde el inicio.

---

## 10. SHINYS Y POKÉMON ESPECIALES (que encontrarlos emocione)

| Categoría | Rareza | Distinción |
|-----------|--------|------------|
| **Shiny normal** | 1/1024 base (modificable por suerte/cadena) | paleta alterna + destello + jingle |
| **Shiny variante** | sub-rareza | paletas múltiples por especie (varias "pieles" shiny) |
| **Shiny corrupto** | muy raro | paleta glitch + aura; stats sesgados, comportamiento errático |
| **Shiny legendario** | evento | entrada de Pokédex única, cinemática de aparición |
- **Emoción de encuentro:** hitstop al aparecer, zoom de cámara, oscurecer fondo, partículas, sonido icónico, marca permanente en Pokédex ("★ visto el piso X"). **Cadena de shiny** (encuentros consecutivos de la especie suben la probabilidad) recompensa la dedicación.
- **Efectos visuales exclusivos:** trail de partículas al seguirte (correa, J), animación de entrada a combate propia, icono en caja/PC.
- **Entradas especiales de Pokédex:** los shiny/corruptos/legendarios desbloquean lore extra y arte alternativo.

---

## 11. CONTENIDO LEGENDARIO (misterios de comunidad)

- **Encuentros legendarios:** uno por bioma de élite + errantes raros. No capturables a la primera: requieren condición.
- **Eventos de invocación:** reunir N materiales + ritual en sala santuario + condición de equipo (ej. *6 Pokémon del tipo del bioma a amistad máxima*).
- **Mazmorras ocultas:** sub-pisos accesibles solo por pista (pared falsa hallada con objeto X en piso con modificador Y bajo clima Z).
- **Jefes secretos:** aparecen con condiciones absurdamente específicas (ej. *llegar al piso 333 sin haber usado ningún objeto, con un solo Pokémon, en luna nueva del reloj real*).
- **Condiciones "que la comunidad investiga años":** predicados serializables y **sembrados de forma global** (mismo para todos) para que la comunidad pueda compartir hallazgos. Pistas crípticas dispersas en lore (P). Implementación: `data/discovery/*.js` con predicados verificables y un sistema de "rumores" que filtra pistas parciales.

---

## 12. RETENCIÓN (cientos de horas)

- **Coleccionismo:** Pokédex completa (normal/shiny/variante/regional/forma), enciclopedia de objetos, biomas, Reliquias.
- **Logros y títulos:** cientos, de triviales a absurdos; títulos equipables visibles online.
- **Cosméticos:** ropa de entrenador, accesorios de Pokémon (I), skins de UI/HUD, efectos de seguidor, temas de Aldea. **Solo por juego.**
- **Récords y estadísticas:** piso máximo, mejor tiempo de tramo, daño máximo, shinies, KO, distancia caminada; **estadísticas globales** del servidor (online).
- **Desafíos rotativos:** **diarios** (semilla fija global, leaderboard), **semanales** (modificador temático), **mensuales** (gran reto con recompensa cosmética rara). Todos sembrados → justos y comparables.
- **Pase de temporada gratuito** (recompensas por jugar, no por pagar).

---

## 13. OPTIMIZACIÓN (miles de Pokémon/objetos/9111 pisos/online/saves)

### 13.1 Datos
- **Pokémon como structs ligeros** (campos numéricos/enum, no objetos pesados); cálculos derivados memoizados (A-01).
- **Especies/movimientos/objetos** = datos inmutables compartidos (flyweight): una instancia describe miles.

### 13.2 Mundo
- Solo **piso actual ± vecinos** instanciados; el resto se **regenera por semilla** (determinista, coste cero de memoria, A-11).
- **Sprites** por carga perezosa + **LRU cache** limitado por presupuesto de RAM (A-12); descargar especies no presentes.
- **Tilemaps por chunk** + culling + estáticos a RenderTexture (A-13). Atlas de texturas pre-generado en boot (A-10).

### 13.3 Combate / online
- Simulación determinista a tickrate fijo; **fixed-point** o enteros para reproducibilidad y netcode (A-03). Render interpolado, desacoplado.
- Pooling de objetos de combate/partículas (sin GC en frame caliente).

### 13.4 Saves enormes
- **Formato versionado** (`saveVersion`) con **migradores** por versión (A-20).
- **Estructura:** meta-progreso (permanente) + run actual (regenerable por semilla → guardar solo semilla + deltas, no el mundo).
- **Compresión** (deflate, ya disponible) + **checksum/nonce** anti-tamper (offline) / server-authoritative (online).
- Cajas/PC: almacenamiento paginado, no cargar 30 cajas de golpe.

### 13.5 Presupuestos (budgets) y CI de rendimiento
- Frame budget 16.6 ms; presupuesto de draw calls, de RAM de texturas, de entidades activas. `tools/perf-budget` falla el build si se exceden.

---

## 14. HERRAMIENTAS DE DESARROLLO (añadir contenido en minutos)

Filosofía Spore (§N del plan): **editores visuales data-driven** que escriben los mismos JSON/JS que consume el runtime → cero código por contenido.

| Editor | Entrada → Salida | Acelera |
|--------|------------------|---------|
| **Editor de pisos** | colocar plantillas/modificadores → `data/floors/*` (sobre el generador, no a mano) | tuning de generación + salas especiales |
| **Editor de NPCs** | clase, memoria, afinidad, stock → `data/npcs/*` | poblar Aldea/biomas |
| **Editor de diálogos** | árbol de diálogo + arquetipo de voz, con `dialogue-lint` integrado → `data/dialogue/*` | narrativa sin "sabor IA" |
| **Editor de jefes** | timeline de fases + mecánicas (scripting visual) → `data/bosses/*` | un jefe nuevo en minutos (A-09) |
| **Editor de eventos** | predicado → consecuencia → `data/events/*` | eventos raros/ultra raros |
| **Editor de objetos** | rareza, efectos, corrupción → `data/items/*` | loot masivo |
| **Editor de habilidades/movimientos** | categoría, efecto, animación (data del motor de FX) → `data/moves/*` | movimientos con animación única sin código |
| **Editor de animaciones de ataque** | forma/partículas/timing/sonido → animación generada (motor §N) | FX por ataque a escala |

Todos validan contra esquema al guardar (A-19) y previsualizan (reusan `texshot`/render headless). Se construyen **después** del vertical slice, pero su formato de datos se define **ya** para no rehacer contenido.

---

## 15. AUDITORÍA FINAL

### 15.1 Tabla de sistemas faltantes
| Sistema | Prioridad | Dificultad | Impacto en experiencia | Tiempo estimado* | Riesgo principal |
|---------|-----------|------------|------------------------|------------------|------------------|
| `computeStats` único (A-01) | P0 | Baja | Alto (base de todo) | 0.5 sem | inconsistencia si se difiere |
| Máquina de turnos determinista (A-02) | P0 | Media | Alto | 1–1.5 sem | bugs de orden |
| Motor de scripting de jefes (A-09) | P0 | Alta | Alto | 2 sem | deuda si se hardcodea |
| Resolver de dificultad + Power Budget (A-14/15) | P0 | Media | Alto (balance) | 1 sem | juego trivial/imposible |
| Validación de datos/esquemas (A-19) | P1 | Baja | Medio | 0.5 sem | runtime frágil |
| Simulación determinista Modo 2 (A-03) | P1 | Alta | Alto | 2–3 sem | bloquea online |
| Sistema de botín completo (§4) | P1 | Media | Alto | 1.5 sem | inflación |
| Economía + sumideros (§3) | P1 | Media | Alto | 1.5 sem | dinero infinito |
| Modificadores de piso (§2.4) | P1 | Media | Muy alto (rejugabilidad) | 1 sem | combinaciones rotas |
| IA de combate por arquetipos (§7.1) | P1 | Alta | Alto | 2 sem | IA tonta o injusta |
| NPC memoria/relaciones (§6) | P2 | Media | Medio-alto | 1.5 sem | save crece |
| Entrenador: clases/árbol (§5) | P2 | Media | Alto | 1.5 sem | power creep |
| Crianza avanzada (F) | P2 | Alta | Medio | 2 sem | depende de E |
| Misiones (§8) | P2 | Media | Medio | 1 sem | repetitividad |
| Prestigio/meta-progreso (§2.1) | P2 | Media | Alto (retención) | 1 sem | balance de carry |
| Online social (§9) | P3 | Muy alta | Alto | 4–6 sem | seguridad/escala |
| Editores (§14) | P3 | Media c/u | Multiplicador de producción | 0.5–1 sem c/u | over-engineering |
| Legendarios/misterios (§11) | P3 | Media | Medio (comunidad) | continuo | spoileo temprano |

*Estimaciones de esfuerzo relativo de diseño+impl, no compromisos de calendario.

### 15.2 "10 cosas que TODAVÍA impedirían que parezca un Pokémon comercial" — y cómo resolverlas

1. **Sprites/animación de batalla a nivel oficial.** Tiles propios están bien, pero los Pokémon necesitan sprites animados consistentes. → *Solución:* pipeline de sprites (PokeAPI/showdown gifs cacheados) + atlas + estados (idle/hit/faint) uniformes; nada estático.
2. **Animación única por movimiento + FX por habilidad.** Sin esto se siente fangame. → *Motor de animaciones data-driven (§N)* con librería de partículas/timeline; cada move referencia una animación, no un genérico.
3. **"Game feel" de combate (juice).** Hitstop, screen shake, flash de daño, knockback, cámara. → *Capa de feedback central* aplicada a todo golpe; sin ella, golpes "sin peso".
4. **Audio cohesivo.** Música por bioma, jingles (shiny, subir nivel, victoria), SFX por tipo. → *Dirección de audio + banco libre estilo Pokémon*; sin audio el polish cae a la mitad.
5. **UI/UX a nivel Nintendo.** Menús animados, transiciones, navegación con foco, feedback sonoro, consistencia. → *Design system de UI* (tokens, componentes) + `aesthetic` en cada pantalla; nada de menús crudos.
6. **Curva de dificultad y balance fino.** Comercial = justo y legible. → *Resolver de dificultad + Power Budget + balance-check en CI* (A-14/15).
7. **Diálogo humano, no IA.** → *Banco de voz por arquetipo + dialogue-lint + editor* (§6/§14). Una sola línea robótica rompe la inmersión.
8. **Tutorial/onboarding suave.** Pokémon enseña sin abrumar. → *Onboarding por capas* (primeras salas guiadas, tips contextuales, no muros de texto).
9. **Pulido de transiciones y carga.** Entradas de combate, fade de piso, sin tirones. → *Atlas pre-cargado, transiciones animadas, carga perezosa* (§13). Las esperas matan la sensación AAA.
10. **Cohesión de identidad visual.** Que todo (UI, tiles, sprites, FX) se sienta del mismo juego. → *Art bible* (paleta, escala pixel, reglas de luz) que gobierna todo asset; sin biblia, mezcla incoherente "hecha por IA".

---

### Cierre de la auditoría
Nada de esto está "eliminado" del alcance: queda como **segunda capa priorizada**. Los **P0** (stats único, determinismo de turnos, scripting de jefes, resolver de dificultad + power budget, validación de datos) son los cimientos que evitan retrabajo masivo y deben implementarse junto al vertical slice. El resto escala por la prioridad del plan (① estética → ⑧ historia). El mayor multiplicador de producción a medio plazo son los **editores (§14)**: definir su formato de datos ahora hace que todo el contenido posterior cueste minutos.
