# PLAN MAESTRO — Torre Infinita (2026-06-17)

Consolida: lo pedido en esta sesión + lo pendiente de los docs (ROADMAP_LOTES, MASTER_LIST, PLAN_DEMO) + lo que le falta a un juego de este calibre. Reglas permanentes siguen vigentes (assets reales web salvo TILES que Carlos prefiere procedurales; ≥1 Pokémon/update; todo seleccionable con descripción divertida; QA con captura).

## ✅ HECHO en sesiones 2026-06-17 (a/b)
Mega/Z/Dinamax/Tera · menú interactivo de aprender-mov · evolución por nivel (verificada) · pesca + charcos animados · hierba alta como sprites delante + squash + sonido · biomas cueva (sin pueblo/hierba, encuentros en todo el piso) · repelentes + cuerda huida · generación aleatoria (seed por run + biomas barajados) · tiles vueltos a procedural · 11 fixes (hueco intro, árboles, HUD PS/palanca/mouse, anim al chocar, Pikachu anclaje, seguidor revivido, pesca trabada, disco congela).

## 🔜 LOTE 1 — Objetos y mecánicas que faltan (pedido directo)
- [ ] 1A. Consumibles: **Caramelo Raro** (+1 Nv), **Éter/Éter Máx** (restaura PP), **Proteína/etc.** (EV) — sprites reales PokeAPI.
- [ ] 1B. **MT/MO (discos de movimiento)**: enseñar movimientos (no solo habilidades). Menú de aprender ya existe → reusar.
- [ ] 1C. **Clima en combate**: aplicar el `weather` del bioma (sol/lluvia/nieve/arena/niebla) a daño y estados (lluvia↑agua, sol↑fuego, etc.).
- [ ] 1D. **Piedras Mega / Cristales Z / etc. como OBJETOS** que desbloquean los fenómenos (hoy son botón libre). Opcional: gating por objeto.
- [ ] 1E. Caramelos de EXP, **Cuerda Huida** ✅, **Repelentes** ✅.

## 🔜 LOTE 2 — Combate y mundo (pendiente de docs)
- [ ] 2A. **ENTRENADOR al final del combate** (B8): 4+ reacciones por escenario (huir/derrota/victoria/captura), ball correcta.
- [ ] 2B. **Sprites de combate ANIMADOS** frente+ESPALDA (B/W gen-V, GIF→spritesheet) (D3).
- [ ] 2C. **NPC entrenadores con línea de visión** que te desafían (! sobre la cabeza) (C4).
- [ ] 2D. **Pokémon corredor visible** en el mapa; tocarlo = combate (C3).
- [ ] 2E. **JEFES /10** con mecánica única + biomas con eventos propios (D5).
- [ ] 2F. Más **FX por movimiento** (no solo por tipo) (B6).
- [ ] 2G. Embestida en combate según categoría del ataque (A8 resto).

## 🔜 LOTE 3 — Estructura / progresión
- [ ] 3A. **Pueblos: interiores habitables** (casas a-d), crecer el pueblo /5 (refs FireRed).
- [ ] 3B. **Meta-progresión pre-run** (tienda con puntos de partidas) (C5).
- [ ] 3C. **Velocidad bici** (modo de movimiento rápido) + escape rope ✅.
- [ ] 3D. Deploy a **GitHub Pages** (link jugable) — primer deploy pendiente.

## 🔜 LOTE 4 — Lo que le falta a un juego de este calibre (propuesta nueva)
- [ ] 4A. **Menú de OPCIONES**: velocidad de texto, volumen música/SFX, mostrar daño, dificultad. (Hoy no existe → polish básico esperado.)
- [ ] 4B. **Estados persistentes en el campo** (veneno resta PS al caminar; curación en Centro/objeto). Hoy el estado solo vive en combate.
- [ ] 4C. **Reto diario / semilla compartible**: la generación ya es por seed → permitir introducir/compartir seed para competir.
- [ ] 4D. **Logros / hitos** (capturas, pisos, rachas) con notificación.
- [ ] 4E. **Pantalla de resumen de run** al morir (pisos, capturas, mejor Pokémon, tiempo) + récord.
- [ ] 4F. **Accesibilidad**: remapeo de teclas, modo daltónico, texto grande.
- [ ] 4G. **+1 Pokémon por update** (regla permanente; correr `fetch-sprites` y ampliar Pokédex). PENDIENTE de varias sesiones.
- [ ] 4H. **PP en combate visible y gestionable** (ya hay PP; faltan items Éter — ver 1A).
- [ ] 4I. **Tutorial/onboarding** contextual de las mecánicas nuevas (fenómenos, pesca, repelentes).

## Orden sugerido de ejecución
1. LOTE 1 (objetos/mecánicas — pedido directo, alto valor, bajo riesgo).
2. 4A Opciones + 4B estados en campo (polish esperado).
3. 2A/2G combate vivo (entrenador final, embestida).
4. 4G +1 Pokémon (regla) + 4E resumen de run.
5. Resto por prioridad de Carlos.

> QA siempre: `node tools/combat-smoke.mjs` + `node tools/smoke.mjs` + `node tools/shot.mjs` (0 errores) tras cada lote.
