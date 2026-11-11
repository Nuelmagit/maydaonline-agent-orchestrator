# Issue tracker: GitHub (orchestrator + per-repo)

Issues and specs live as GitHub issues, spread over four repos. Use the `gh` CLI for all operations.

## Which repo an issue goes in

| Issue touches… | Repo | `-R` value |
|---|---|---|
| More than one repo (protocol changes, map pipeline, cross-repo features), or the workspace itself (agents, CLAUDE.md, scripts) | orchestrator | `Nuelmagit/maydaonline-agent-orchestrator` |
| Only the server | `rpg_server/` | `Nuelmagit/rpg_server` |
| Only the Godot client | `godot-mmorpgui/` | `Nuelmagit/godot-mmorpgui` |
| Only the map editor/generator | `mmorpg_map/` | `Nuelmagit/mmorpg_map` |

**Always pass `-R <owner/repo>`.** This folder's own remote is the orchestrator, so a bare `gh` call run from the workspace root lands there, and one run inside a sub-repo lands in that sub-repo. Don't rely on the working directory.

A cross-repo feature is a **parent issue in the orchestrator** with **child issues in each affected repo**. Refer to issues in other repos by full reference (`Nuelmagit/rpg_server#12`), never by bare `#12`.

## Conventions

- **Create an issue**: `gh issue create -R <repo> --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> -R <repo> --json number,title,body,labels,comments`.
- **List issues**: `gh issue list -R <repo> --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters. To see everything, run it for each of the four repos.
- **Make an issue a sub-issue of a parent**: same repo: `gh issue create -R <repo> --parent <parent> ...`, or `gh issue edit <parent> -R <repo> --add-sub-issue <child>` afterwards (`gh` 2.94+). Across repos (orchestrator parent, sub-repo child) use the API: `gh api --method POST repos/Nuelmagit/maydaonline-agent-orchestrator/issues/<parent>/sub_issues -F sub_issue_id=<child-db-id>`, where `<child-db-id>` is the child's database id (`gh api repos/Nuelmagit/<repo>/issues/<n> --jq .id`). If that fails, put `Part of Nuelmagit/maydaonline-agent-orchestrator#<parent>` at the top of the child body and add the child to a task list in the parent.
- **Comment on an issue**: `gh issue comment <number> -R <repo> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> -R <repo> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> -R <repo> --comment "..."`

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if these repos treat external PRs as feature requests; `/triage` reads this flag.)_

When set to `yes`, PRs run through the same labels and states as issues, using the `gh pr` equivalents (always with `-R`):

- **Read a PR**: `gh pr view <number> -R <repo> --comments` and `gh pr diff <number> -R <repo>` for the diff.
- **List external PRs for triage**: `gh api --paginate 'repos/<owner>/<repo>/pulls?state=open' --jq '.[] | select(.author_association | IN("OWNER","MEMBER","COLLABORATOR") | not) | {number, title, author: .user.login, author_association, labels: [.labels[].name]}'`.
- **Comment / label / close**: `gh pr comment`, `gh pr edit --add-label`/`--remove-label`, `gh pr close`.

GitHub shares one number space across issues and PRs in each repo, so a bare `#42` may be either: resolve with `gh pr view 42 -R <repo>` and fall back to `gh issue view 42 -R <repo>`.

## When a skill says "publish to the issue tracker"

Pick the repo from the table above, then create a GitHub issue there. For a cross-repo spec, publish the parent to the orchestrator and the per-repo tickets as children.

## When a skill says "fetch the relevant ticket"

Read it as in **Read an issue** above. If only a bare number is given, ask which repo or check the orchestrator first.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Map**: a single issue labelled `wayfinder:map` holding the Notes / Decisions-so-far / Fog body. Put it in the orchestrator if the work spans repos, otherwise in the one repo it touches. `gh issue create -R <repo> --label wayfinder:map`.
- **Child ticket**: an issue linked to the map as a GitHub sub-issue (see **Make an issue a sub-issue of a parent**), created in whichever repo the ticket touches. Where sub-issues aren't available, add the child to a task list in the map body and put `Part of <owner/repo>#<map>` at the top of the child body. Labels: `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Once claimed, the ticket is assigned to the driving dev.
- **Blocking**: GitHub's **native issue dependencies**, the canonical, UI-visible representation. Add an edge with `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`, where `<blocker-db-id>` is the blocker's numeric **database id** (`gh api repos/<owner>/<blocker-repo>/issues/<n> --jq .id`, _not_ the `#number` or `node_id`). GitHub reports `issue_dependencies_summary.blocked_by` (open blockers only, the live gate). Where dependencies aren't available, fall back to a `Blocked by: <owner/repo>#<n>, …` line at the top of the child body. A ticket is unblocked when every blocker is closed.
- **Frontier query**: list the map's open children (scoped to the map's sub-issues / task list, across repos), drop any with an open blocker (`issue_dependencies_summary.blocked_by > 0`, or an open issue in the `Blocked by` line) or an assignee; first in map order wins.
- **Claim**: `gh issue edit <n> -R <repo> --add-assignee @me`, the session's first write.
- **Resolve**: `gh issue comment <n> -R <repo> --body "<answer>"`, then `gh issue close <n> -R <repo>`, then append a context pointer (gist + full link) to the map's Decisions-so-far.
