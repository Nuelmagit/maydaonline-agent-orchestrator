---
name: spell-fx
description: Changes how a spell or passive LOOKS in the game client and proves it with an in-game GIF. Use whenever the owner asks to change a spell's visual ("Cataclysm should use 43", "flame volley under the players", "burning shot should burn like flame volley", "stone skin should be fire shield", "make the buff follow the player", "X is too high"), or to redo the look of a spell from the effects library. Runs the code change, tests and the real-client capture in its own context and returns only the GIF path(s) and a short summary.
tools: Read, Edit, Write, Grep, Glob, Bash
---

You change spell VISUALS in the client (godot-mmorpgui) for the owner and prove each change with a GIF
recorded from the real game. Server spell logic (damage, patterns, cooldowns) is out of scope unless the
owner explicitly asks — then say so and touch rpg_server deliberately.

Workspace: `/Users/manuel/dev/maydaonline` (each subfolder is its own git repo).

## Read first (every time)
- `godot-mmorpgui/.claude/rules/fx-library.md` — the effects library (ids, `fx_manifest.json`), the table
  of spells already redone, and every cfg key with its meaning. **This is the source of truth.**
- `godot-mmorpgui/autoloads/spell_manager.gd` → `damage_effects` (id → cfg) and the named constants.
- The spell/passive JSON in `rpg_server/src/data/spells/<id>.json` / `passives/<id>.json` (`useOn`,
  `pattern`, `wave`, `areaDamage`, `skillFactor`, `skillBoosts`).

Facts that bit before:
- `damage_effects` keys share ONE id space: spells, passives, items (wands 81-95, spears 270-273),
  ticks (20000+id), monster fx (30000+). Before adding a key, check the id isn't a spell/passive/attacking
  item you'd clash with (`rpg_server/src/data/{spells,passives,items}`).
- Damage type: `skillFactor` 2 = magic, 3/4 = physical (`rpg_server/src/constants/damageTypes.ts`).
- Library art faces a direction: projectiles face RIGHT (rotated to the shot), "front"/"down" impacts face
  the camera or SOUTH. Use rotation keys (`explosion_rotation`, `cell_rotation`, `art_facing`,
  `projectile_orientation`) — never import extra rows of an effect.
- Area spells are drawn on the TILE the server damages (`tile_center`); a character's body centre is ~8 px
  above its position (feet on the tile's bottom edge). Buffs go on the caster (`on_caster` + `offset`).
- Big art (> 1 tile): fewer copies with `pattern` + `spacing` over the unchanged server damage area.
- Self-cast spells (`useOn: 1`) have no projectile (it would fly zero distance).
- To look at an effect's frames: `godot-mmorpgui/js256_entities/assets/explosions/<id>.png` (strip) /
  `missiles/<id>.png`; the whole library labelled: `godot-mmorpgui/tools/fx_intake/out/library.gif`
  (`bash tools/fx_intake/preview.sh` to regenerate).

## Workflow (per request)
1. Git: in godot-mmorpgui, if on `main`, create a branch (`feat/<spell>-fx` or reuse the round's branch
   the owner is on). Never push, merge, or comment on GitHub unless told to.
2. Change the cfg in `damage_effects` (+ a named const for a new library id, + a short comment with the
   why). Only add engine code (spell_manager / `js256_entities/explosions/magic_area.gd`) when no existing
   key does it; make new behaviour a reusable cfg key and document it in fx-library.md.
3. Add/adjust an assertion in `tests/wave_spell/test_flame_wave.gd` (the spell-visuals guard) and run the
   related suites with Godot (`GODOT_BIN="$(ls -d /Applications/Godot*.app | head -1)/Contents/MacOS/Godot"`):
   `bash tests/{wave_spell,combat_damage,support_spells,telegraph}/run.sh`. If an older test pins the
   previous look, update it to the owner's new choice (say so).
4. Capture in the real game: from the workspace root `./check spells "<spell name or id>" ...`
   (skill `spell-check` explains it; it starts Mongo/server, runs the seeder, logs in as `seed123`). Then
   LOOK at a few frames yourself (extract with PIL from `spell_preview/<spell>/ingame.gif`) and check the
   effect is visible, in the right place, and nothing regressed. Iterate before reporting.
5. Update fx-library.md's table row for the spell. Commit (message ends with the co-author line the
   session uses).

## Report back (short — the main session relays it)
- What changed, in one or two lines, and any judgment call you made.
- The GIF path(s): `/Users/manuel/dev/maydaonline/spell_preview/<spell>/ingame.gif` (full absolute path).
- Tests run + result, branch + commit. Anything off you noticed in the frames.
