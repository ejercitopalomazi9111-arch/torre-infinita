# LOG — errores (causa raíz → solución → razonamiento) y decisiones

## 2026-06-10 · Arranque
- **Decisión:** construir la LÓGICA de la torre antes que cualquier contenido (sección D del brief). Razón: poblar pisos a mano o sobre un generador no validado garantiza softlocks y retrabajo. Un generador sembrado + solver es la base barata que vuelve gratis todo el contenido posterior.
- **Decisión:** todo el módulo de torre es ES module puro sin dependencias de DOM/Phaser, para poder testearlo en Node (smoke) y reusarlo en el navegador. Razón: cumple el gate "node smoke = 0 errores" sin headless para la lógica pura.

## 2026-06-10 · Bug: zona segura sin servicios en pisos pequeños
- **Síntoma:** smoke falló — pisos x5 (5, 15, 25) a veces sin 'pokecenter'/'rest'.
- **Causa raíz:** los servicios garantizados solo se colocaban en dead-ends; pisos pequeños tienen <3 dead-ends.
- **Solución:** fallback en assignRoomTypes → si no hay dead-end, el servicio va a cualquier sala normal libre (`freeNormal`). Las zonas seguras SIEMPRE tienen shop+pokecenter+rest.
- **Resultado:** smoke 145/145 pisos OK, 0 softlocks.

## Resultado del gate (2026-06-10)
- 145 pisos (5 semillas × 29 pisos: arranque, x5, x10, x25, hasta 9111).
- 0 softlocks · reproducible · puertas simétricas · jefes presentes · zonas seguras completas.
- Promedio 14.9 salas/piso, 85 cerraduras seguras colocadas.

## 2026-06-10 · Capa de ruido + texturas procedurales
- Añadidos: `engine/noise.js` (value noise + fBm + ridged), `engine/texgen.js` (tiles bitmap por código con variación), `systems/tower/tileGen.js` (tilemap de sala con bordes orgánicos y decoración por bioma).
- **Bug crítico (precedencia):** `hash2` en noise.js → `(...) >>> 0 / 4294967296` se evaluaba como `>>> (0/4e9)`, devolviendo uint32 sin normalizar → texturas casi blancas (floor px [240,237,245] en vez de [90,74,106]).
  - **Causa raíz:** `/` tiene mayor precedencia que `>>>`.
  - **Solución:** `((h ^ (h >>> 16)) >>> 0) / 4294967296`. Verificado por pixel y por PNG.
- **Bug:** salas de biomas orgánicos salían no-transitables (erosión/decoración sólida cortaba puertas).
  - **Solución:** `tileGen` despeja un carril recto puerta→centro tras colocar decoración; `roomIsTraversable` lo valida. Sala 40 cuevas: false → true.
- **Verificación visual:** `tools/texshot.mjs` exporta PNGs (vía `tools/pngutil.mjs`, codificador PNG con node:zlib). Revisadas con la vista: cueva púrpura con veta, bosque verde, variantes que difieren, decoración legible. Aprobadas.

## 2026-06-10 · Vertical slice jugable (R.3)
- Assets: `tools/fetch-sprites.mjs` cacheó 16 Pokémon reales (sprite + stats base reales) de PokeAPI → `data/species.generated.js`. Confirma D-002 (red OK).
- `systems/pokemon/stats.js` (resuelve A-01): computeStats Gen III+. Verificado vs valores canónicos (Pikachu Lv50 timid max EV = 156 Spe ✓).
- App Phaser: index.html + main.js + BootScene/TitleScene/FloorScene + textureFactory (texgen→Phaser) + entrenador procedural.
- FloorScene: render del grafo+tilemap con texturas, movimiento WASD/flechas + colisión, transición entre salas, **seguidor con correa** (Pikachu rastrea con retraso), HUD (piso/bioma) y minimapa.
- **Bug:** `const URL` en shot.mjs tapó el constructor global `URL` → "URL is not a constructor". Solución: renombrar a `TARGET`.
- **Bug:** 404 de consola = favicon que Chromium pide solo. Solución: `<link rel="icon" href="data:,">`.
- **Verificación (shot.mjs, Puppeteer):** 3 capturas revisadas con la vista — título dorado pulido, cueva navegable con entrenador legible + Pikachu siguiendo. Gate: **0 errores de consola**.

## 2026-06-10 · Combate modo 1 + Videocámara
- Roster 16→442 (Gen 1-3 + Gen 4 inicial), fetcher concurrente con reintentos.
- Combate determinista: typechart/moves/damage/battle. combat-smoke: 250 batallas OK, deterministas (re-run misma semilla = mismo ganador/turnos).
- **Videocámara (recorder.js):** grabación = snapshot equipos + semilla + acciones → re-simulación (ver D-005). Reproduce con R.
- **Bug (repetido):** typo `0x10friendly` (token inválido) en paneles → lo introduje 2 veces (TitleScene y BattleScene) copiando un patrón de relleno. Eliminado ambos. NOTA: revisar este patrón al copiar.
- **Bug:** atajo `keydown-1` no existe en Phaser (usa `keydown-ONE`); el menú no respondía a teclado. Solución: handler único que lee `parseInt(ev.key)`.
- **Bug:** la tecla F no disparaba combate en la sala de entrada (excluida). Solución: el disparador manual ignora la restricción de tipo de sala; los encuentros aleatorios la mantienen.
- **Verificado (shot.mjs):** título, piso, combate (BEAUTIFLY/AGGRON/KAKUNA vs PIKACHU), animación de ataque y REPRODUCCIÓN de grabación. Gate: 0 errores de consola.

## Pendientes técnicos detectados
- Empaquetado: assets runtime funcionan en `vite dev`; para `vite build`/GitHub Pages mover a `/public` o importarlos.
- Polish combate: sprites de espalda del jugador (uso front+flip); balance (prom 3.8 turnos/batalla es algo rápido → curva del difficulty resolver, A-14); cambiar de Pokémon/huir/objetos en menú (solo "luchar" por ahora).
- Polish: follower se solapa al spawnear; fBm del suelo un pelín "nuboso".
- UI de grabaciones: existe guardar+reproducir-última (R); falta la lista/galería en la Pokédex.
