# CLAUDE.md — maydaonline (workspace / orquestador)

Este folder **no es código del juego**: es el workspace que agrupa los repos del MMORPG. Cada
subcarpeta es su propio repo git con su propio `CLAUDE.md` y `.claude/rules/` — leelos cuando
toques ese repo. Este archivo solo cubre **cómo se conectan** entre sí.

## Repos

| Carpeta | Qué es | Stack | Contexto propio |
|---|---|---|---|
| `rpg_server/` | Servidor autoritativo (world sim + management API + broadcaster WS) | Node/TypeScript, MongoDB, Redis, FlatBuffers, Cucumber | `rpg_server/CLAUDE.md`, `rpg_server/.claude/rules/` |
| `godot-mmorpgui/` | Cliente del juego (HUD, red, render del mundo) | Godot 4.3 (GDScript) | `godot-mmorpgui/CLAUDE.md`, `godot-mmorpgui/.claude/rules/` |
| `mmorpg_map/` | Editor/generador de mapas; exporta datos al server y un `.pck` al cliente | Godot 4.3 (headless tools) | `mmorpg_map/.claude/rules/map-creation.md`, agente `map-builder` |

> Nombres viejos: varios docs/scripts todavía dicen `godot_ui/` o `godot_ui/new-game-project/` —
> hoy es `godot-mmorpgui/`.

## Cómo fluyen las cosas entre repos

```
mmorpg_map ──build.sh maps──▶ rpg_server/src/data/map/32/<coord>/*.json   (colisiones, NPCs, teleports, floor effects…)
mmorpg_map ──build.sh pack──▶ godot-mmorpgui/external_packages/top-down-map.pck   (tiles/escenas que renderiza el cliente)

godot-mmorpgui ◀──── WebSocket binario ────▶ rpg_server (broadcaster ↔ world thread)
godot-mmorpgui ◀──── HTTP :2122 (/rpg/*) ──▶ rpg_server (management thread)
godot-mmorpgui ◀── GET /rpg/static-data/* ── rpg_server (items, spells, monsters, classes, passives, tuning.json)
```

### Protocolo cliente ↔ server — se mantiene A MANO en los dos lados
No hay código generado compartido. Cualquier cambio de mensaje toca ambos repos:

| Concepto | Server (`rpg_server/`) | Cliente (`godot-mmorpgui/`) |
|---|---|---|
| IDs de mensaje | `src/world/core/constants/messageTypes.ts` (`Message` enum) | `network_parser/server_message_types.gd` (`Message` enum, mismos números) |
| SubQueries de `QUERY_GENERAL` | idem server | `ServerMessageTypes.SubQueries` |
| Encode server → cliente | `src/world/adapters/flatBuffers/`, `src/management/adapters/flatBuffers/encoders/` | `network_parser/network_decoder.gd` (lectura byte a byte) |
| Encode cliente → server | decoders en las mismas carpetas | `network_parser/network_encoder.gd` |
| Management por WS (msg 61/62, JSON) | `executeQuery`/`processMessage` del management | `autoloads/ws_management_api.gd` |
| Schemas | `src/messaging/internet/definitions/*.fbs` → `npm run compile:flat` | — |

Regla: **un mensaje nuevo o modificado no está terminado hasta que el enum, el encoder y el decoder
coinciden en los dos repos** (orden de campos, tamaños, endianness, `offset += 1` tras el subQuery).
Usá el agente `protocol-sync` para verificarlo.

### Datos de mapa
- Escenas prod: `mmorpg_map/map/scenes/` (`map32.tscn`, `map32-2.tscn` … `map32-5.tscn`; cada una
  con su `map_coord` → `map_exports/<coord>/`). `map/testing_scenes/` nunca se exporta.
- Valores de `side_effect` (colisión, cambio de piso…): `mmorpg_map/AREADME_MAP_SIDE_EFFECT.txt`.
- El server los lee en `rpg_server/src/data/map.ts` y `src/data/npc_data.ts`.
- Agente `map-data-sync` para validar que export ↔ server ↔ `.pck` estén alineados.

## Builds / tests

| Repo | Comando | Notas |
|---|---|---|
| `rpg_server` | `npm run dev` / `npm run test:cucumber` / `npm run compile:flat` | |
| `godot-mmorpgui` | `./build.sh [web\|windows\|android]`; tests en `tests/<area>/run.sh` | Requiere `GODOT_BIN` |
| `mmorpg_map` | `./build.sh` (maps + pack) | Requiere `GODOT_BIN`, `MAP_PCK_DEST`, `MAP_DATA_DEST` |

⚠️ Los `build.sh` de Godot tienen defaults de Windows (`C:\Users\Manuel\Desktop\godot 4.3\...`) y
el de `mmorpg_map` apunta a `../godot_ui/new-game-project/external_packages`. En este layout (mac)
exportar antes:

```bash
export GODOT_BIN="/Applications/Godot.app/Contents/MacOS/Godot"   # ajustar a la instalación real
export MAP_PCK_DEST="$PWD/godot-mmorpgui/external_packages"
export MAP_DATA_DEST="$PWD/rpg_server/src/data/map/32"
```

## Cómo trabajar acá

- **Feature de un solo repo** → abrir Claude dentro de ese repo (carga sus settings, rules y agentes).
- **Feature cross-repo** → abrir Claude en este folder. Antes de editar un repo, leer su `CLAUDE.md`.
- **Ramas**: una feature que toca varios repos usa **el mismo nombre de rama** en cada uno
  (ej. `feat/trade-window`). Los commits van por repo — este workspace no versiona código de los repos.
- **Agentes**: los cross-repo viven en `.claude/agents/` de este folder. Los de un repo viven en ese
  repo; si hace falta usarlos desde acá se symlinkean (ej. `map-builder.md`).
- Repo nuevo: clonarlo acá, agregarlo al `.gitignore` y a la tabla de arriba.
