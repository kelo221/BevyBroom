# Roadmap status

Status of the milestones tracked in issues #3 to #12 on kelo221/BevyBroom. Each entry lists what is done and verified, and what is still open. All commits are on branch `Bevy` of kelo221/BevyBroom (pull request #14). The game side (`broom_bridge`, `broom_preview`) lives in `bevy/` of the same repository, imported with its history.

Every finished milestone passed: `bun run testrun`, `bun run build`, `bun run typecheck:strict`, `bun run format:check`, `cargo fmt`, `cargo clippy -D warnings` and `cargo test` in `bevy/`, and `bun run e2e` with `BROOM_E2E_REQUIRED=1` against a freshly built `broom_preview` and desktop app.

## M01 Reproducible Bevy integration (#3): mostly done

Done:

- `broom.hello` handshake (protocol 4, accepts 3 to 4): protocol range, capabilities, project id and process id. The editor publishes nothing into a game that does not accept its protocol, lacks a required capability or belongs to another project, and shows **incompatible** with the reason.
- Shared wire fixtures in `bevy/fixtures/`, parsed by the Rust tests and by `tests/preview/protocol/preview_protocol_fixtures.test.ts` straight from the same files (no mirror). `bevy/` is excluded from Prettier.
- `compatibility.json` pins protocol, Bevy and the DynLight commit; a test checks it against the editor and `bevy/`.
- CI on `master`, strict type check required; a **Bevy workspace** job runs `cargo fmt --check`, `cargo clippy -D warnings` and `cargo test` on `bevy/` for every pull request, with the renderer checked out at the pinned commit; a manual **Game integration** workflow builds the programs and runs `bun run e2e` with `BROOM_E2E_REQUIRED=1`.
- Clean machine: the editor and the game side come from one clone of kelo221/BevyBroom, the renderer from kelo221/DynamicLighting-Bevy at the pinned commit (steps in `documentation/building_and_running.md`).
- Release, updater and documentation links point at kelo221/BevyBroom.
- End-to-end: `broom_preview --protocol-override` proves a mismatch is reported before any scene is published.

Open:

- Minimal example game with one material, one placeable component, one data asset and the runtime loader (the preview program covers most of it, but there is no separate example).
- A runner with a GPU, so the end-to-end suites can run automatically instead of on demand.

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

## M04 Build and ship complete levels (#6): mostly done

Done:

- Lights ship in exported GLBs: **File > Export GLB** writes every enabled light as an empty node with DynLight light extras (type, color, intensity, radius, falloff, cone, realtime, effect, fog shape, shimmer). DynLight's glTF import turns them into lights without the editor or the bridge. Light markers are still never exported as meshes (`src/light/export/`, unit tests in `tests/light/export/`).
- End-to-end: the portals suite exports its scene, starts a fresh `broom_preview --scene` with no editor link and no manifest, and finds both rooms, the portal and the light with its authored radius through the Bevy remote protocol.
- Every light setting ships: each light node also carries `broom_light` (the complete light definition) and `broom_light_of` (its editor id). The bridge applies the complete definition on top of DynLight's import, so shadow mode, bounce, cookie, fog density and effect timing no longer need a renderer change. A shared fixture (`bevy/fixtures/light_extras_sample.json`) is written exactly by the editor's exporter and read by the bridge's tests.
- No doubled lights: while the shown document (live editor or level manifest) has an object with a shipped light's editor id, the shipped light is switched off (`ShippedLightReplaced`) and the bridge's light stands for it; it comes back when the document no longer has the id. Rust tests in `bevy/crates/broom_bridge/src/authoring/tests/shipped.rs`; end-to-end in `tests/e2e/preview_bridge_shipped_lights_e2e.test.ts` (realtime shadows from the GLB alone, one light with the editor attached, the shipped light back after the editor deletes its light).

- **Build Level** (branch `feature/tb_parity_uv_milestones`): **File > Build Level** and the MCP `build_level` tool. A preflight run of the Issues checks stops the build on any error (new check: game components on a brush inside a solid model, which a GLB cannot carry). The package is the game GLB plus a version 2 `level.broom.json` (`manifest_version`, the authored state and the `materials` read back from the GLB), written into `<asset_root>/<level_directory>/<name>/` of the open project by the desktop app: a new immutable `geometry_<stamp>.glb`, the manifest replaced by one rename, older geometry pruned afterwards. A failure at any step leaves the previous package loadable (unit tested on real temporary folders, including a failing manifest rename).
- Manifest version 2 in the companion: `LevelManifest` gains `manifest_version` (missing reads as 1, newer is refused) and `materials`; the bridge writes version 2 itself. `bevy/fixtures/level_manifest_sample.json` is parsed by the Rust tests and by `tests/level_build/manifest/level_build_manifest.test.ts`, which also checks the editor's manifest keys match it exactly.
- End-to-end step written (`tests/e2e/desktop/desktop_level_build_e2e.test.ts`): the desktop app opens a temporary project, builds a floor, a room and a light, runs `build_level`, checks the manifest and geometry on disk, then a fresh `broom_preview --level` with no editor shows the room and the light. **Not run yet**: the desktop build fails on this machine (`hutch electrobun: could not project the Electrobun 2.0.4 devkit: AccessDenied`).

Open:

- `bun run build:level` (a command line build without the editor window).
- Data asset references and an optional bake in the package.
- End-to-end check of a full package (textured room, lit doorway, component, data asset, portals, bake) and of an interrupted build on a real game. The current Build Level end-to-end step (a floor, a room and a light loaded with `--level`) passes.

## M05 Real game materials and assets (#7): not started

The material browser gained **Replace With Selected Material** (swap one material for another on every face, or only on the selection, as one undo step; also the MCP `replace_texture` tool). Everything the issue lists is still open: the game material authoring adapter for `DynLitMaterial`, shared versus per-instance materials, game-rendered previews, reimport and override precedence, and an isolated preview world. Most of it needs game-side work in the companion and a decision on how material previews are isolated from the authored scene's lighting.

## M06 DynLight authoring and dependable baking (#8): started

Done:

- The Game Preview panel counts realtime lights and realtime shadows against the game's `realtime_light_budget` and `shadow_cubemap_budget`, and explains a budget the scene goes over with DynLight's own rule (only the realtime lights nearest the camera stay realtime; only that many lights cast realtime shadows at once). Unit tested in `tests/preview/ui/preview_status_lines.test.ts`.

Open:

- Rectangle and tube lights, fixture presets, and the reason a single selected light falls back (the status reports totals, not per-light decisions; that needs a protocol addition).
- Full bake, progress and cancellation in the UI, bake identity per project, document and input revision, and the wider freshness checks (moved occluders, alpha and bounce inputs).
- Shader feature prewarming.

## M07 Connected game view and Play mode (#9): not started

Camera synchronization, shared selection and Play / Pause / Exit hooks all need new protocol methods and a lighting-viewer policy in the companion. Nothing is implemented yet.

## M08 Reusable content and safe game data (#10): not started

Reusable instances with overrides, stable entity references, richer reflected field types and transactional data-asset writes are all open. Linked groups were left out of the editor work for the same reason: they should be built on the instance model this milestone defines.

## M09 Environment lighting and spatial tools (#11): started

Done:

- **Tight culling bounds for level geometry.** A solid model that uses several materials exports one glTF primitive per material, all sharing one vertex list, and Bevy gave each of them the box of the whole list. The bridge now gives every level primitive the box of the vertices its triangles use and keeps Bevy from overwriting it, so camera culling and shadow caster selection see each part where it is. Unit tested in `bevy/crates/broom_bridge/src/level/bounds.rs`; end-to-end step in `tests/e2e/preview_bridge_bounds_e2e.test.ts`.

Open:

- **Split level geometry by room** (added to #11). A solid model still exports as one mesh per material, so it is drawn whenever any part of it is on screen and redrawn into every shadow cubemap face it touches. Writing one piece per room, plus one for geometry outside the rooms, lets culling work room by room. The split must be deterministic so bakes, lightmap UVs and bake freshness stay valid.
- **Room-based mesh culling in DynLight** (added to #11). Portal culling drops only realtime lights, shadow cubemaps and fog; meshes are culled by the camera frustum alone. Hiding pieces whose room the camera's portal view does not reach needs the split above.
- Sun, sky, reflection probes and fog authoring. Room and portal diagnostics already show the game's culling reason in the Game Preview panel (from M01 to M03).

## M10 Daily-use quality and release readiness (#12): started

Done:

- **Unsaved changes** in the status bar while the scene differs from its saved file; undoing back to the save clears it (the saved point is the newest undo step at save time).
- **Autosave and recovery**: about fifteen seconds after an edit, and when the window closes, the unsaved scene is written to the editor's local storage, never to the scene file. Save, New and Load remove it. At startup the editor offers **Restore** (loads it as an unsaved scene that stays protected) or **Discard** (deletes it). A snapshot that fails to load is kept. A storage that refuses the write is reported once in the Console.
- **Safe saves**: the scene file is replaced only when the whole write finishes, and a failed write is aborted, so the previous file stays intact.
- **Newer file on disk**: when another program changed the scene file after it was opened or saved, Save asks before overwriting it and never overwrites it unasked.
- Unit tests in `tests/scene_recovery/`, `tests/io/dialog/` and `tests/tools/io/handler_scene_io.test.ts`, on real scenes, history and status bar.

Open:

- Autosave lives in web storage, which limits scene size (the failure is reported); the desktop app could write it to a file in the app's data folder instead. Web storage is also shared by every editor window of the same profile, so two windows open at once keep one recovery snapshot between them. The game preview endpoint had the same problem and now stays per window.
- No end-to-end step yet for a desktop session that is killed and restarted.
- Workspace restore (open project, layout, camera bookmarks), the performance scene and measurements, long-session and fault-injection runs, and the release checklist with a playable example.

## Verification of this branch

Branch `feature/tb_parity_uv_milestones` passes `bun run testrun`, `bun run build`, `bun run typecheck:strict` and `bun run format:check`, and `cargo fmt --check`, `cargo clippy -D warnings` and `cargo test` in `bevy/`. All end-to-end suites, preview and desktop, pass against a fresh `broom_preview` and desktop build. `bun run desktop:build:dev` fails with `hutch electrobun: could not project the Electrobun 2.0.4 devkit: AccessDenied` while a Vite dev server watches the repository, because Windows cannot rename a watched folder; `vite.config.ts` now leaves the build folders out of the watch.
