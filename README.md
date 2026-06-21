# 🗼 Torre Infinita

Un **roguelike Pokémon** de 9111 pisos hecho con HTML5 + Phaser 3. Sube la torre piso a piso, captura entre **1024 Pokémon (Gen 1–9, Pokédex nacional)**, vence entrenadores y jefes, y desata fenómenos de batalla. Cada partida es única.

🎮 **Juega ya:** https://ejercitopalomazi9111-arch.github.io/torre-infinita/

> Hecho por **Mazi (Carlos)** con Claude. Sprites: PokeAPI · pret/pokeemerald. Música/SFX: FireRed/LeafGreen.

---

## ▶️ Cómo jugar

**La forma fácil (Windows):** doble clic en **`Jugar Torre Infinita.bat`**.
Abre el servidor local y el navegador en `http://localhost:5173/`. Para cerrar: cierra la ventana negra.

**Manual (cualquier sistema):**
```bash
npm install      # solo la 1ª vez
npm run dev      # luego abre http://localhost:5173/
```

---

## 🎮 Controles

| Acción | Teclado | Mando |
|---|---|---|
| Mover | Flechas / WASD | D-pad / stick |
| Correr | mantener **B** | ◯ / L1 |
| **Bici** (rápido) | úsala desde la mochila (**M**) | — |
| Confirmar / A | Enter / Z / Espacio | ✕ |
| Cancelar / B | Retroceso / X | ◯ |
| Mochila | **M** | △ |
| Equipo / Caja PC | **T** | □ |
| Pokédex / Repeticiones | **P** | Select (Shift/C) |
| **IA juega sola** | **I** | — |
| Volver al menú | **Esc** | — |
| Saltar diálogos | **C** (Select) | Share |

En menús: **mantén pulsada** una dirección para desplazarte rápido. Casi todo es clicable con el ratón.

---

## 🌍 Mecánicas

- **Pisos y biomas:** 8 biomas (bosque, cuevas, ruinas, glaciar, volcán, laboratorio, cielo, distorsión) que se barajan cada partida. Baja por el **agujero** de cada piso. El **piso 1 siempre es bosque**.
- **Encuentros:** en biomas con vegetación, solo en la **HIERBA ALTA**; en **cuevas** (oscuros), en cualquier casilla (usa **repelentes**). También **Pokémon corredores** visibles: tócalos y combates.
- **Pueblos** (cada 5 pisos): Centro Pokémon, tienda y posada (con interiores). Sin combates.
- **Entrenadores NPC:** si te ven en su línea de visión (**¡!**), te retan. No puedes capturar sus Pokémon; pagan premio.
- **Jefes** (cada 10 pisos): Pokémon colosal del bioma con **Furia** (se enfurece al 50% PS). Sueltan objetos de fenómeno.
- **Pesca:** lanza la caña a un charco (A) para Pokémon de agua.
- **Combate:** estados, habilidades, objetos equipables, bayas, ~**450 animaciones**, comentarista "Torre TV", y **videocámara** (repeticiones).

### ✨ Fenómenos de batalla (necesitan objeto equipado)
- **Megaevolución:** equipa la **Piedra Mega** a una especie que megaevolucione (p. ej. Charizard → Mega Charizard **X** Fuego/Dragón o **Y** Fuego/Volador). Cambia forma, tipo y stats.
- **Movimiento Z:** equipa el **Cristal Z**; tu próximo golpe se vuelve el Z-move de su tipo (×1.8).
- **Dinamax:** equipa la **Maxibanda**; el Pokémon se hace gigante y pega como Movimiento Max.

### ⚔ Online (Club de Batalla)
En cada pueblo hay un **⚔ CLUB**: habla con su encargado (**A**) para jugar con un amigo por internet (**P2P**, sin servidor — usa WebRTC). Uno **HOSPEDA** (genera un código de 4 letras) y el otro **se UNE** con ese código. Desde ahí pueden:
- **Comerciar** un Pokémon (oferta mutua + confirmación → intercambio real que se guarda).
- **Combatir PVP** por *lockstep* determinista (ambos eligen movimiento cada turno y el combate se resuelve idéntico en las dos pantallas, sin trampa).

### 🏆 Meta-progresión
Al perder ganas **puntos** (pisos + capturas + victorias). Gástalos en el menú **MEJORAS** en mejoras **permanentes** (más dinero, pociones, balls, nivel inicial, Cristal Z de inicio) que aplican a tus próximas partidas.

---

## 💾 Guardado
3 ranuras de partida. Se guarda en cada piso (al recargar la página vuelves al menú y puedes **Cargar**). Ajustes (volumen) y mejoras persisten. En **Settings → Reinicio de fábrica** borras todo (pide resolver una operación).

---

## 🛠️ Desarrollo

```bash
npm run dev      # servidor de desarrollo
npm run build    # build de producción → dist/ (estático, hosteable)
npm run preview  # sirve el dist localmente

# QA
node tools/smoke.mjs            # generador de torre (0 softlocks)
node tools/combat-smoke.mjs     # 250 batallas / 1024 especies
node tools/shot.mjs [url]       # captura el juego real (gate 0 errores de consola)
node tools/godtest.mjs [pisos] [url]   # CAZABUGS: IA invencible recorre N pisos
```

### 🐞 Modo Dios / Cazabugs (QA automático)
La IA juega sola, invencible, visitando **todas las salas** de cada piso a velocidad
bestial, y reporta errores/softlocks. Desde la consola del navegador:
```js
__GODTEST.start({ floor: 1, speed: 200 })  // arranca el tester
__GODTEST.report()                          // pisos superados, encuentros, etc.
__GODTEST.stop()
```
O headless: `node tools/godtest.mjs 200` (necesita `npm run preview` corriendo).

### ⌨️ Consola DEBUG (Código Konami)
Dentro del juego, pulsa **`` ` ``** o el **Código Konami** (↑↑↓↓←→←→ B A) para abrir el
panel de cheats: dar Pokémon por nombre+nivel+stats, curar, subir nivel, revelar
mapa, dinero, warp de piso, y control de la IA/Modo Dios. Por consola:
```js
__DEBUG.give('charizard', 100, { atk: 999 })   // dar Pokémon a la medida
__DEBUG.heal(); __DEBUG.reveal(); __DEBUG.warp(50); __DEBUG.god()
```

**Arquitectura:** escenas Phaser en `src/scenes/`, sistemas en `src/systems/`, datos en `data/` (varios `*.generated.js` por los `tools/fetch-*.mjs`). Los tiles de bioma son procedurales (`src/engine/texgen.js`); el resto de arte son sprites reales.

**Publicar online:** el `dist/` es estático; sirve para GitHub Pages / Netlify / cualquier host. (Ajusta `base` en la config de Vite si va en un subdirectorio.)
