# Agent guidance

This workspace is the game side of the BevyBroom editor and lives in `bevy/` of the editor's repository (`..` from here): the `broom_bridge` library and the `broom_preview` program. Rendering is DynLight (`../../DynLightBevy`, a checkout next to the editor repository, path dependency). `README.md` explains the design; read it first.

## Hard rules

1. **No Bevy lights.** DynLight's rules apply: never spawn or read `PointLight`, `SpotLight`, `DirectionalLight`, ambient or environment lights. Load glTF with `load_lights: false`. Authored lights become `dynlight::light::DynamicLight`.
2. **Max 400 lines per file.** Split by feature before a file grows past it.
3. **Vertical slices.** `crates/broom_bridge/src/<slice>/` owns its data, systems and tests: `authoring` (state → lights, rooms, portals and node transforms), `level` (geometry files, loading, swap, manifest), `materials` (catalog, binding, reload), `bake_link` (preview bakes, staleness), `placeables` (game components the editor places: classes and their schema, composing from `Default` plus overrides, Game Entity points, data assets, and the `broom_components` glTF extras), `remote` (the `broom.*` methods), `status`, `project`, `protocol` (pure serde data and validation, no ECS).
4. **The protocol is a contract with the editor.** Field names are snake_case JSON. The editor's TypeScript mirror is `../src/preview/protocol/preview_protocol_types.ts`; change both together and keep `fixtures/` parsing in the tests (the editor's `tests/preview/protocol/preview_protocol_fixtures.test.ts` reads the same files). Bump `PROTOCOL_VERSION` for breaking changes.
5. **Remote handlers only validate and queue.** Entities change in the normal schedule (`BroomSystems`), never inside a handler.
6. **Never lose the shown state on bad input.** Invalid or stale snapshots, broken GLBs, broken catalog files and stale bakes are rejected and reported through `BridgeStatus::report_error`; what is shown stays.
7. **Logging** uses `tracing` macros (`info!`, `warn!`), never `println!` in library code.
8. **Permissive licenses only** (MIT, Apache-2.0, BSD, zlib) for new dependencies.
9. **Git:** this workspace is part of the editor repository (kelo221/BevyBroom); stage files explicitly by path, never `git add -A` or `git add .`.

## Testing

Prefer proving behavior end to end, with unit tests underneath:

1. **Unit tests for every slice.** Each system and validation rule gets a test in its slice, built with `test_support` (a minimal app, no window). The tests build what they need and check the result; no hardcoded expectations copied from a run.
2. **An end-to-end step for everything the editor can observe.** That includes new protocol fields, authored entity kinds, level files, bake and status behavior, and anything a shipped level loads. Each gets a step in the editor's end-to-end tests (`../tests/e2e/`). Those tests drive the real `broom_preview` with the editor's real preview link, and check the game's status, its entities through the Bevy remote protocol (`world.query`), and the files it writes.
3. **Keep the preview testable.** Every component an end-to-end test checks must be reflected and registered so `world.query` can see it. The preview must keep running with `--hidden`, so new features may not depend on a visible window.

## Before handoff

```
cargo fmt --all
cargo clippy --workspace --all-targets -j 2 -- -D warnings
cargo test --workspace -j 2
```

All three must pass. If DynLight was changed, run the same checks in `../../DynLightBevy`.

When the change is visible to the editor, rebuild the preview and run the editor's end-to-end tests too. A stale `broom_preview.exe` silently tests old code.

```
cargo build --release -j 2 -p broom_preview
cd ..
set BROOM_E2E_PREVIEW_EXE=bevy\target\release\broom_preview.exe
set BROOM_E2E_PROJECT_DIR=bevy
bun run e2e
```

The tests copy the project to a temporary folder and keep every window hidden. Set `BROOM_E2E_SHOW_WINDOWS=1` to watch them.
