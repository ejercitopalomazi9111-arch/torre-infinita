# Torre Infinita en el teléfono 📱

Tres caminos, de más fácil a más complicado. **El primero ya funciona hoy.**

---

## 1) PWA — instalar desde el navegador (✅ LISTO, sin Mac, sin $99, sin tienda)

El juego ya es una **PWA instalable**. En el teléfono, abre la URL en vivo:

> https://ejercitopalomazi9111-arch.github.io/torre-infinita/

- **Android (Chrome):** menú ⋮ → **"Instalar app"** / "Añadir a pantalla de inicio".
- **iPhone (Safari):** botón Compartir → **"Añadir a pantalla de inicio"**.

Queda un ícono (Mewtwo con brackets dorados) en la pantalla de inicio. Al abrirlo
arranca **a pantalla completa, sin barras del navegador**, y tras la primera partida
**funciona sin internet** (el Service Worker cachea el juego y el audio que vayas oyendo).

**Controles táctiles:** aparecen solos en pantallas táctiles (D-pad + A/B + atajos
mochila/equipo/Pokédex + botón ⛶ pantalla completa). Se pueden forzar en PC con
`?touch=1`, o encender/apagar en **Ajustes → Controles táctiles**.

### QA de la PWA
```
npm run build
npx vite preview --port 4280      # sirve dist/
node tools/_pwatest.mjs http://localhost:4280/    # manifiesto + SW + iconos + 0 errores
node tools/_touchtest.mjs http://localhost:4280/  # overlay táctil despacha teclas
```

---

## 2) Android APK/AAB con Capacitor (envuelve la PWA en una app nativa)

Ya está el `capacitor.config.json` (webDir = `dist`, appId `club.mazis.torreinfinita`).
Necesitas **Android Studio** instalado en tu PC. Pasos:

```
npm i @capacitor/core @capacitor/cli @capacitor/android
npx cap add android          # crea la carpeta android/
npm run build                # genera dist/
npx cap copy                 # copia dist/ al proyecto Android
npx cap open android         # abre Android Studio → Build > Build APK(s)
```

El APK sale en `android/app/build/outputs/apk/`. Lo pasas al teléfono y lo instalas
(activando "orígenes desconocidos"). Para subir a Play Store: AAB firmado + cuenta de
desarrollador de Google ($25 pago único).

> Tras cada cambio del juego: `npm run build && npx cap copy` y reconstruyes.

---

## 3) iOS (.ipa) — necesita Mac

Capacitor también genera proyecto iOS, pero compilarlo **requiere macOS + Xcode** y una
**cuenta Apple Developer ($99/año)**. Como Carlos está en Windows:

- **Opción A:** la PWA (camino 1) — en iPhone se instala desde Safari, gratis, ya funciona.
- **Opción B:** build en la nube con runner macOS (GitHub Actions, Codemagic o Ionic
  Appflow) si algún día quieres un `.ipa` real para TestFlight/App Store.

```
npx cap add ios && npx cap copy && npx cap open ios   # solo en un Mac
```

---

**Recomendación:** usa la **PWA** (camino 1) para jugar y compartir ya mismo. El APK de
Android (camino 2) cuando quieras una app instalable "de verdad". iOS nativo solo si
consigues un Mac; mientras tanto la PWA cubre iPhone.
