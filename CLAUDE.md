# CLAUDE.md — maydaonline (workspace / orchestrator)

This folder **is not game code**: it is the workspace that groups the MMORPG's repos. Each
subfolder is its own git repo with its own `CLAUDE.md` and `.claude/rules/` — read them when you
touch that repo. This file only covers **how they connect** to each other.

## Repos

| Folder | What it is | Stack | Own context |
|---|---|---|---|
| `rpg_server/` | Authoritative server (world sim + management API + WS broadcaster) | Node/TypeScript, MongoDB, Redis, FlatBuffers, Cucumber | `rpg_server/CLAUDE.md`, `rpg_server/.claude/rules/` |
| `godot-mmorpgui/` | Game client (HUD, networking, world rendering) | Godot 4.7 (GDScript) | `godot-mmorpgui/CLAUDE.md`, `godot-mmorpgui/.claude/rules/` |
| `mmorpg_map/` | Map editor/generator; exports data to the server and a `.pck` to the client | Godot 4.7 (headless tools) | `mmorpg_map/.claude/rules/map-creation.md`, `map-builder` agent |

> Old names: several docs/scripts still say `godot_ui/` or `godot_ui/new-game-project/` —
> today it is `godot-mmorpgui/`.

## How things flow between repos

```
mmorpg_map ──build.sh maps──▶ rpg_server/src/data/map/32/<coord>/*.json   (collisions, NPCs, teleports, floor effects…)
mmorpg_map ──build.sh pack──▶ godot-mmorpgui/external_packages/top-down-map.pck   (tiles/scenes the client renders)

godot-mmorpgui ◀──── binary WebSocket ────▶ rpg_server (broadcaster ↔ world thread)
godot-mmorpgui ◀──── HTTP :2122 (/rpg/*) ──▶ rpg_server (management thread)
godot-mmorpgui ◀── GET /rpg/static-data/* ── rpg_server (items, spells, monsters, classes, passives, tuning.json)
```

### Client ↔ server protocol — maintained BY HAND on both sides
There is no shared generated code. Any message change touches both repos:

| Concept | Server (`rpg_server/`) | Client (`godot-mmorpgui/`) |
|---|---|---|
| Message IDs | `src/world/core/constants/messageTypes.ts` (`Message` enum) | `network_parser/server_message_types.gd` (`Message` enum, same numbers) |
| `QUERY_GENERAL` SubQueries | same as server | `ServerMessageTypes.SubQueries` |
| Encode server → client | `src/world/adapters/flatBuffers/`, `src/management/adapters/flatBuffers/encoders/` | `network_parser/network_decoder.gd` (byte-by-byte reads) |
| Encode client → server | decoders in the same folders | `network_parser/network_encoder.gd` |
| Management over WS (msg 61/62, JSON) | management `executeQuery`/`processMessage` | `autoloads/ws_management_api.gd` |
| Schemas | `src/messaging/internet/definitions/*.fbs` → `npm run compile:flat` | — |

Rule: **a new or modified message is not done until the enum, encoder and decoder match in both
repos** (field order, sizes, endianness, `offset += 1` after the subQuery).
Use the `protocol-sync` agent to verify it.

### Map data
- Prod scenes: `mmorpg_map/map/scenes/` (`map32.tscn`, `map32-2.tscn` … `map32-5.tscn`; each one
  with its `map_coord` → `map_exports/<coord>/`). `map/testing_scenes/` is never exported.
- `side_effect` values (collision, floor change…): `mmorpg_map/AREADME_MAP_SIDE_EFFECT.txt`.
- The server reads them in `rpg_server/src/data/map.ts` and `src/data/npc_data.ts`.
- `map-data-sync` agent to validate that export ↔ server ↔ `.pck` are aligned.

## Builds / tests

**`./check`** (workspace root) is the single entry point for testing the client: a menu to play with
the log saved, do a quick boot check, test login→logout→relogin, or run the full walkthrough. It uses its
own test account (`clientcheck`), so it never touches the user's guest account or characters. Details: skill `client-check`.

| Repo | Command | Notes |
|---|---|---|
| `rpg_server` | `npm run dev` / `npm run test:cucumber` / `npm run compile:flat` | |
| `godot-mmorpgui` | `./build.sh [web\|windows\|android]`; tests in `tests/<area>/run.sh` | Requires `GODOT_BIN` |
| `mmorpg_map` | `./build.sh` (maps + pack) | Requires `GODOT_BIN`, `MAP_PCK_DEST`, `MAP_DATA_DEST` |

⚠️ The Godot `build.sh` scripts auto-detect Godot (mac: `/Applications/Godot*.app`, else `godot` on PATH) unless `GODOT_BIN` is set, and
the `mmorpg_map` one points to `../godot_ui/new-game-project/external_packages`. In this (mac) layout,
export first:

```bash
export GODOT_BIN="/Applications/Godot.app/Contents/MacOS/Godot"   # adjust to the real install
export MAP_PCK_DEST="$PWD/godot-mmorpgui/external_packages"
export MAP_DATA_DEST="$PWD/rpg_server/src/data/map/32"
```

## How to work here

- **Single-repo feature** → open Claude inside that repo (loads its settings, rules and agents).
- **Cross-repo feature** → open Claude in this folder. Before editing a repo, read its `CLAUDE.md`.
- **Branches**: a feature that touches several repos uses **the same branch name** in each one
  (e.g. `feat/trade-window`). Commits go per repo — this workspace does not version the repos' code.
- **Agents**: cross-repo ones live in this folder's `.claude/agents/`. Single-repo ones live in that
  repo; if they're needed from here they get symlinked (e.g. `map-builder.md`).
- New repo: clone it here, add it to `.gitignore` and to the table above.

## Agent skills

### Issue tracker

GitHub Issues: cross-repo work goes in `Nuelmagit/maydaonline-agent-orchestrator`; single-repo work goes in that repo's issues (`gh -R Nuelmagit/<repo>`). See `docs/agents/issue-tracker.md`.

### Triage labels

Default labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`) in all 4 repos. See `docs/agents/triage-labels.md`.

### Domain docs

Multi-context: `GLOSSARY-MAP.md` + `docs/adr/` here (cross-repo decisions: protocol, map pipeline) → `GLOSSARY.md` + `docs/adr/` inside `rpg_server/`, `godot-mmorpgui/`, `mmorpg_map/`. See `docs/agents/domain.md`.
