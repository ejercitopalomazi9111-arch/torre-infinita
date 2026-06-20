# PLAN — Torre Infinita (Roguelike Pokémon)

> Documento VIVO y corto. Estado real, no aspiracional.

## Stack
HTML5 + Phaser 3 (ES modules) · data-driven (JSON/JS) · Vite ligero · deploy GitHub Pages.

## Orden de prioridad (inquebrantable)
① Estética → ② UX/UI → ③ Combate → ④ Gameplay principal → ⑤ Gameplay 2º/3º → ⑥ Online → ⑦ Extras → ⑧ Historia.

## Estado por sistema
| # | Sistema | Estado |
|---|---------|--------|
| A | Motor + QA pipeline (smoke + shot) | ✅ smoke + shot operativos (0 errores) |
| D | Generador procedural torre + solver anti-softlock | ✅ validado (145 pisos, 0 softlocks) + capa ruido/texturas |
| C | Dirección artística / sprites reales | 🟡 494 Pokémon reales (Gen 1-4 completa) + 14 entrenadores Showdown. REGLA: prohibido crear assets → sustituir texgen por tilesets reales ⚪ |
| K | Combate modo 1 (turnos) | 🟡 jugable: tipos+movimientos+daño+estados, BattleScene, encuentros. Falta: cambiar/huir/objetos, balance |
| K | Combate modo 2 (anime/tiempo real) | ⚪ planificado |
| E | Sistemas Pokémon (datos profundos) | 🟡 stats reales + computeStats (A-01 ✅); resto planificado |
| J | Seguidores + correa | 🟡 seguidor con correa funcionando en el slice |
| F | Crianza avanzada | ⚪ planificado |
| G | Rasgos de personalidad | ⚪ planificado |
| H | Jefes cada 10 pisos | ⚪ planificado |
| I | Vida/amistad/mascotas | ⚪ planificado |
| M | Aldea HUB + online | ⚪ planificado |
| O | UI completa + i18n | 🟡 i18n motor primero |
| P | Historia ambiental | ⚪ planificado (última) |
| Q | Reliquia 60s · easter egg escopeta | ⚪ planificado (extras) |

## Sesión actual (2026-06-11 — plan por fases aprobado, ver docs/MASTER_LIST.md)
1. ✅ FASE 0 cerrada: lote del crash QA-verificado (3 fixes: Enter selección, anims.play, escala gigante) + capturas aprobadas + Gen 4 completa (494)
2. ⏭️ FASE 1 (combate ③): Mochila usable en combate, captura fórmula Gen III/IV, cambiar/huir reales, IA arquetipos, balance A-14, FX por tipo, tilesets reales de la web
3. ⏭️ FASE 2 (loop ④): GUARDADO, zonas seguras /5, jefes /10, loot por rarezas, 6 biomas, shinys → deploy GitHub Pages


## Decisión clave de assets
Pokémon reales vía **PokeAPI sprites repo** (datos+sprites abiertos, recognizable, cero placeholders) — ver DECISIONS.md.
