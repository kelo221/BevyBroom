# Project level browsing – work log (not committed)

## Frame
Level designers open scene JSON through file dialogs; nothing lists the levels of the open project.
Better = project lists its level documents (document_directory + optional `levels`), editor shows them in a
Level Browser, opens/saves without dialogs, remembers the open level so Save writes back, MCP tools drive it.
Done-check: unit tests + e2e round trip of a scene through a temp project copy; testrun/typecheck:strict/build pass.

## Baseline (2026-11-12)
- `bun run testrun`: 7081 passed, 1 failed (known: game_process_spawner_node 'directory with spaces'), 105 skipped.
- MCP tools: no project level tools. RPC schema: no level requests.
- Duplication: TextureProjectSourceLoader and SprinkleDefinitionLibraryProjectFollower both implement
  "follow workbench open key + generation counter + load".

## Design decisions
- Level id = built level name (levelBuildNameSanitize of explicit id or document stem); document path (relative to
  document_directory) is the unique key. Explicit `levels` entries come first in file order, then discovered `.json`.
- document_directory stays relative to the project file (matches game's ProjectConfig). Editor never rewrites
  broom.project.json; new levels are discovered from the directory. Rename refuses explicitly listed levels.
- One Bun listing layer: ProjectFileLister reused with root = document directory.
- One editor follower base: ProjectAssetFollower (generation + open key) shared by textures, sprinkle, levels.
- Save (Ctrl+S) writes back to the open project level; New/Load forget it. Save As stays a file dialog.
- Level Browser: name field + New Level / Save As New / Rename / Open; web build shows desktop-only note.
- Build Level defaults to the open project level id.

## Steps
1. [ ] Parser/validator + types + tests
2. [ ] Bun project_levels (paths, lister, reader, writer, rpc handlers) + RPC schema + tests
3. [ ] GameProcessControl additions + ProjectAssetFollower refactor
4. [ ] Editor: ProjectLevelService + open state + file actions + LayoutGamePreview wiring
5. [ ] Level Browser UI + shell registry + menus
6. [ ] MCP tools + docs + sample project
7. [ ] e2e step; full checks; commits
