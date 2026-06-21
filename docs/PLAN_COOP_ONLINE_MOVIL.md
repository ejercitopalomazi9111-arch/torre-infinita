# Plan técnico — Co-op local · Online (PVP/comercio) · Port móvil

> Roadmap items #3-5 de Torre Infinita. **No empezar hasta que Carlos pruebe el juego
> con el modo debug.** Este doc deja el terreno listo para ejecutar rápido después.
> Aterrizado en la arquitectura real: Phaser 3, escenas en `src/scenes/`, input en
> `src/systems/input.js` (`makeInput`), estado/guardado en `src/systems/state.js`,
> combate determinista en `src/systems/combat/battle.js` (clave para online).

---

## #3 — Co-op local (2+ mandos) · dificultad: MEDIA

**Idea MVP:** pantalla compartida. P1 (teclado/gamepad 0) + P2 (gamepad 1) caminan el
MISMO piso, cada uno con su entrenador y su equipo. Los encuentros y jefes son
**co-op 2v1 / 2v2**: cada jugador elige el movimiento de su propio Pokémon en su turno.

**Pasos:**
1. **Input multi-jugador.** `makeInput(scene, padIndex)` → aceptar un índice de gamepad.
   Phaser ya trae `this.input.gamepad.pad1/pad2`. P1 conserva teclado; P2 = gamepad 1.
   (Detección: si hay ≥2 gamepads, ofrecer co-op en el menú principal.)
2. **Segundo entrenador en FloorScene.** Extraer la lógica del jugador (sprite, cola de
   seguidores, paso por casillas) a un pequeño helper reutilizable; instanciar 2. Cámara:
   seguir el punto medio, o partir en split-screen vertical si se alejan mucho.
3. **Estado co-op en el run.** `state.js`: `run.party2` / `run.players[]`. El guardado y la
   meta-progresión ya existen; extender a 2 equipos.
4. **Combate co-op.** `Battle`/`BattleScene` aceptan equipo de 2 mons activos del lado del
   jugador (ya soporta equipos; el reto es la UI de “turno de P1 / turno de P2”). MVP: el
   enemigo es 1, los 2 jugadores pegan por turno; bajar daño/subir HP enemigo para balance.
5. **Game Over co-op:** caes solo si AMBOS equipos se debilitan (o modo “revive al compa”).

**Esfuerzo:** ~1 sesión para overworld co-op; +1 sesión para combate co-op pulido.
**Riesgo:** UI de turnos en combate. Empezar por overworld compartido (visible y divertido ya).

---

## #4 — Online: PVP + comercio · dificultad: ALTA (proyecto aparte)

**Backend recomendado: Supabase** (Carlos ya lo usa en examen-admisión e ICAMP →
Realtime + Postgres + Auth listos, sin servidor propio que mantener).

**A. Comercio (lo más fácil, hacer primero):**
1. Tabla `trades` (oferta: `{from_user, mon_json, status}`) o un canal Realtime por sala.
2. UI: elegir un Pokémon del equipo/caja → generar código de sala → el otro entra con el
   código → ambos ven la oferta → confirmar. Al confirmar, intercambiar el `mon` (JSON) en
   ambos `run`. (El mon ya es serializable; ver `makeBattleMon`.)
3. Anti-trampa básico: validar el JSON del mon contra rangos legales (nivel ≤100, stats
   coherentes con `computeStats`) antes de aceptar.

**B. PVP (lockstep determinista — encaja con el motor actual):**
1. El combate YA es determinista (`Battle` + `makeRNG(seed)`). Dos clientes con el MISMO
   seed y la MISMA secuencia de inputs producen el MISMO combate → no hace falta servidor
   autoritativo pesado, solo **sincronizar inputs por turno** (lockstep).
2. Matchmaking: canal Realtime de Supabase (sala por código o cola). Intercambiar equipos
   (validados) + seed inicial.
3. Cada turno: ambos envían su elección; cuando llegan las dos, ambos clientes avanzan el
   turno localmente. Timeout → movimiento por defecto.
4. Anti-trampa: validar equipos al inicio; el lockstep evita inventar daño (ambos simulan
   lo mismo y se detecta divergencia por hash de estado).

**Esfuerzo:** comercio ~1-2 sesiones; PVP ~3-4 (matchmaking + lockstep + reconexión).
**Riesgo:** desconexiones, validación de equipos, latencia. Empezar por comercio.
**Gotcha conocido (memoria):** Supabase/Vercel → 1 solo git remote o el deploy se cuelga.

---

## #5 — Port móvil iOS + Android · dificultad: MEDIA-ALTA

**Enfoque: Capacitor** (envuelve el build web `dist/` en apps nativas; no rehacer en nativo).

**Pasos:**
1. **Controles táctiles.** Hoy el input es teclado/gamepad (`makeInput`). Añadir una capa
   HUD táctil: D-pad virtual + botones A/B/Select en pantalla (solo en móvil/touch). El
   juego ya está pensado a 480×360 con márgenes → caben controles a los lados.
2. **Capacitor:** `npm i @capacitor/core @capacitor/cli`, `npx cap init`, `npx cap add ios`
   y `android`. `webDir: dist`. `npm run build && npx cap copy`.
3. **Android:** `npx cap open android` → Android Studio → APK/AAB. Lo más fácil de probar.
4. **iOS:** requiere **Mac + Xcode** y cuenta Apple Developer ($99/año). `npx cap open ios`.
   (Carlos está en Windows → iOS necesitará un Mac o un servicio de build en la nube tipo
   Ionic Appflow / Codemagic / GitHub Actions con runner macOS.)
5. **Ajustes móviles:** orientación, safe-area, tamaño de fuente, audio (desbloqueo por
   gesto), guardado (localStorage funciona en WebView; o Capacitor Preferences).

**Esfuerzo:** táctil ~1 sesión; Android ~1 sesión; iOS depende de acceso a Mac.
**Riesgo:** iOS (hardware Apple + cuenta de pago). Android primero.

---

## Orden sugerido (tras la prueba de Carlos)
1. Co-op overworld local (rápido, visible, divertido) → combate co-op.
2. Comercio online (Supabase) → PVP lockstep.
3. Controles táctiles → Android (Capacitor) → iOS cuando haya Mac.

Cada fase: backup antes, QA (smoke/combat-smoke/godtest/shot) después, nunca dejar roto.
