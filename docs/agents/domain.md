# Domain Docs

How the engineering skills should consume this workspace's domain documentation when exploring the code.

This workspace is **multi-context**. Each context is one of the three repos inside it, and each repo is its own git repo:

| Context | Folder | Domain |
|---|---|---|
| Server | `rpg_server/` | World simulation, combat, management API, persistence |
| Client | `godot-mmorpgui/` | HUD, networking, world rendering |
| Maps | `mmorpg_map/` | Map editing/generation, exports to server and client |

## Before exploring, read these

- **`GLOSSARY-MAP.md`** at the workspace root: it points at one `GLOSSARY.md` per context, plus shared terms that cross repos (protocol messages, map data, `side_effect`, etc.). Read each one relevant to the topic.
- **`docs/adr/`** at the workspace root: cross-repo decisions (protocol, map pipeline, how the repos fit together).
- **`<repo>/docs/adr/`**: decisions scoped to a single repo. Read the ones that touch the area you're about to work in.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## File structure

```
maydaonline/                         ← workspace repo (orchestrator)
├── GLOSSARY-MAP.md                  ← index + cross-repo terms
├── docs/adr/                        ← cross-repo decisions
├── rpg_server/                      ← own git repo
│   ├── GLOSSARY.md
│   └── docs/adr/
├── godot-mmorpgui/                  ← own git repo
│   ├── GLOSSARY.md
│   └── docs/adr/
└── mmorpg_map/                      ← own git repo
    ├── GLOSSARY.md
    └── docs/adr/
```

Files inside a sub-repo are committed **in that repo**, not in the workspace. The workspace `.gitignore` excludes the three repo folders.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in the relevant `GLOSSARY.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders), but worth reopening because…_
