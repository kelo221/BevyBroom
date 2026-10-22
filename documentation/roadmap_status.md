# Roadmap status

Status of the milestones tracked in issues #3 to #12 on kelo221/BevyBroom. Each entry lists what is done and verified, and what is still open. Editor commits are on branch `Bevy` (pull request #14); companion commits are local to `../AiWorldEdBevy`, which has no remote yet.

Every finished milestone passed: `bun run testrun`, `bun run build`, `bun run typecheck:strict`, `bun run format:check`, the companion's `cargo fmt`, `cargo clippy -D warnings` and `cargo test`, and `bun run e2e` with `BROOM_E2E_REQUIRED=1` against a freshly built `broom_preview` and desktop app.

## M01 Reproducible Bevy integration (#3): mostly done

Done:

- `broom.hello` handshake (protocol 4, accepts 3 to 4): protocol range, capabilities, project id and process id. The editor publishes nothing into a game that does not accept its protocol, lacks a required capability or belongs to another project, and shows **incompatible** with the reason.
- Shared wire fixtures in `AiWorldEdBevy/fixtures/`, parsed by Rust tests and mirrored in `tests/preview/protocol/fixtures/` (excluded from Prettier so the mirror stays byte-identical).
- `compatibility.json` pins protocol, Bevy and the DynLight commit; a test checks it against the editor and the companion checkout.
- CI on `master`, strict type check required; a manual **Game integration** workflow builds the programs and runs `bun run e2e` with `BROOM_E2E_REQUIRED=1`.
- Release, updater and documentation links point at kelo221/BevyBroom.
- End-to-end: `broom_preview --protocol-override` proves a mismatch is reported before any scene is published.

Open:

- The companion workspace needs a public home (a repository or published crates). Until then the "clean machine" exit check and an automatically triggered integration job cannot pass. This is a decision for the maintainer.
- Minimal example game with one material, one placeable component, one data asset and the runtime loader (the preview program covers most of it, but there is no separate example).
- A runner with a GPU for the rendering tests.

## M02 Open and run a Bevy project (#4): mostly done

Done:

- **File > Open Project…** and **File > Recent Projects**; the project file is validated (asset root, working directories, programs, endpoint; paths with spaces and non-ASCII characters are unit tested).
- A document is linked to its project (`projectId` in the scene file). The linked project is the one the game must report in `broom.hello`, and the companion's `broom.apply_state` refuses a snapshot naming another project.
- The desktop app launches, rebuilds, restarts and stops the game. Builds use `preview.build` or the `cargo build` matching a `cargo run` launch; compiler errors appear in the Console and Issues list with file and line. Stop kills the process tree of the game this editor started, and never another process.
- The Game Preview panel shows the project, the game phase, the last message and build errors, with the actions that fit the phase, and **Link Document** when the document belongs to another project. The browser editor explains that it can only attach to a running game.
- MCP tools `project_open`, `project_status`, `game_launch`, `game_rebuild`, `game_restart`, `game_stop`.
- End-to-end (`tests/e2e/desktop/desktop_project_e2e.test.ts`): open a project, launch, edit, introduce a compile error and see it in the Console and Issues list, fix it, rebuild and restart, the new game shows the same document, stop, and the game of a second project is refused.

Open:

- No end-to-end check yet that a separately launched game survives the editor closing (the host only ever stops its own handle; unit tested).
- Switching projects reconnects the link with the new expectation; a dedicated test for a switch while a connection attempt is pending is still missing.

## M03 Live editing you can trust (#5): partly done

Done:

- Every content channel (state, geometry, catalog, game component classes and feature channels) carries a request generation. A resend after a game restart or project switch makes every reply still in flight stale; stale replies commit nothing and report nothing. A reply only counts when its revision matches the one sent.
- Authored versus game-owned values are written down in the companion's README and enforced: the bridge writes an object's authored values only when that object changed since the previous snapshot of the same document. A door opened or a light moved by gameplay survives edits of other objects (Rust tests in `authoring/tests/ownership.rs`, end-to-end step in `tests/e2e/preview_bridge_portals_e2e.test.ts`).
- Identity regression suite (`tests/preview/state/preview_state_identity_regression.test.ts`): ids survive save and load and reparenting with undo, duplicates get new ids that survive undo and redo, and 25 duplicate, delete, undo and redo cycles leave the object set the game receives unchanged. Save As getting a new document id is covered end to end by the portals suite.

Open:

- Latency recording (edit to applied revision, p50 and p95) is not written yet.
- Undo granularity audit (one gesture, one undoable step) and reporting rejected edits in the Console beyond the existing status errors.
- BakeId mapping for objects made of several primitives is not covered by a dedicated test.

## M04 Build and ship complete levels (#6): started

Done:

- Lights ship in exported GLBs: **File > Export GLB** writes every enabled light as an empty node with DynLight light extras (type, color, intensity, radius, falloff, cone, realtime, effect, fog shape, shimmer). DynLight's glTF import turns them into lights without the editor or the bridge. Light markers are still never exported as meshes (`src/light/export/`, unit tests in `tests/light/export/`).
- End-to-end: the portals suite exports its scene, starts a fresh `broom_preview --scene` with no editor link and no manifest, and finds both rooms, the portal and the light with its authored radius through the Bevy remote protocol.

Open:

- The **Build Level** command (preflight validation, a package with a version 2 `level.broom.json`, GLB, material and data references and an optional bake, written to a temporary folder and renamed into place), with its menu entry, `bun run build:level` and the MCP `build_level` tool.
- The companion's loader for manifest version 2 (keeping version 1).
- Settings DynLight extras cannot carry yet (shadow mode, bounce, cookie, fog density, effect timing). They need new extras keys in DynLight's importer, which is a renderer change.
- End-to-end check of a full package (textured room, lit doorway, component, data asset, rooms, portals, bake) and of an interrupted build keeping the last good output.

## M05 to M10: not started
