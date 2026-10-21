# BevyBroom ⇄ Bevy

The game side of the BevyBroom editor: a Bevy 0.20 bridge that shows the level you are editing inside your game, rendered with [DynLight](../DynLightBevy), and a ready-made preview program.

```
crates/
  broom_bridge/    the library a game adds
  broom_preview/   a preview window: DynLight + the bridge + a free camera
assets/              sample game assets: textures and the material catalog
fixtures/            JSON examples of the protocol, parsed by the tests
broom.project.json the sample project file
```

## Quick start

```
cargo run --release -p broom_preview -- --project broom.project.json
```

Or from the editor folder, `bun run preview:game ..\AiWorldEdBevy\broom.project.json`, which runs whatever the project's `preview` section says.

Then in the editor choose **Game > Game Preview…** and press **Connect**. Fly the camera with WASD and the mouse (hold the right button).

Preview flags (`crates/broom_preview/src/arguments.rs`):

| Flag | Meaning |
| --- | --- |
| `--project FILE` | Project file, `broom.project.json` by default. |
| `--port N` | Bridge port, 15702 by default. |
| `--level NAME` | Load a level from its manifest at startup, as the shipped game would. |
| `--scene FILE` | Spawn a GLB exported from the editor (path under the asset root), with its `broom_components` extras applied. |
| `--bake` | Request a preview bake once the level is shown. |
| `--frames N` / `--screenshot FILE` | Exit after N frames, optionally saving the last frame (smoke tests). |
| `--hidden` | Never show the window; rendering, bakes and the bridge keep running (automated tests). |

## The project file

`broom.project.json` sits at the game's root and is shared by the editor and the game:

```json
{
  "project_version": 1,
  "project_id": "broom-sample-project",
  "asset_root": "assets",
  "material_catalog": "broom/materials.json",
  "level_directory": "broom/levels",
  "document_directory": "broom/documents",
  "preview": { "program": "cargo", "arguments": ["run", "--release", "-p", "broom_preview", "--", "--project", "broom.project.json"], "working_directory": ".", "endpoint": "http://127.0.0.1:15702" },
  "coordinate_profile": "bevy_meters"
}
```

`material_catalog` and `level_directory` are relative to `asset_root`; every path must stay inside the project.

## Adding the bridge to your game

```rust
use broom_bridge::prelude::*;

let paths = ProjectPaths::load("broom.project.json")?;
app.add_plugins(DefaultPlugins.set(AssetPlugin {
        file_path: paths.asset_root.to_string_lossy().into_owned(),
        ..default()
    }))
    .add_plugins(dynlight::prelude::DynamicLightingPlugin)
    .add_plugins(BroomBridgePlugin::new(paths)); // development builds
    // .add_plugins(BroomLevelPlugin { paths }); // shipped builds: no editor connection
```

The game's `AssetPlugin` must use the project's asset root. Load a level with a `LevelLoadRequest { level_name }` message.

- **`BroomLevelPlugin`** loads generated levels (geometry GLB plus a manifest with the lights and transforms), binds catalog materials and tracks bakes. Games ship with it.
- **`BroomBridgePlugin`** adds the editor connection: Bevy's remote protocol on `127.0.0.1` with the `broom.*` methods below. Development only; it accepts any local caller.

## Materials

`assets/broom/materials.json` lists the game's materials with stable ids (`stone/castle_wall`). The editor shows them in its texture browser; a face assigned one exports the id as the glTF material extras key `broom_material`, and the bridge gives that primitive the catalog's `DynLitMaterial`. Unknown ids keep their glTF material, which DynLight converts.

A catalog entry can name a `resolver`; register your own with `CatalogResolvers::register` to build game-specific materials. When the catalog file or one of its textures changes on disk, materials and textures are rebuilt in place, so meshes keep their handles. A broken catalog file keeps the previous catalog and is reported.

## Game components

A game registers reflected components the editor may place, with their `Default` as the defaults the editor shows:

```rust
app.register_data_asset::<DoorStats>("door.ron")
    .register_placeable::<Door>(PlaceableOptions::point().category("Doors"));
```

- `register_placeable::<T>` needs `Component + Reflect + Default`. `PlaceableOptions::point()` places it on empty Game Entities; `any()` on every object. Field attributes `FieldRange`, `FieldStep`, `FieldLabel` and `FieldHidden` tune the editor's controls.
- `register_placeable_asset::<A>(&["ext"])` lets `Handle<A>` fields pick asset files by path. `register_data_asset::<A>("ext")` adds a loader for RON files holding the fields that differ from `A::default()` (`{ "health": 400.0, }`) and lets the editor edit them through `broom.data_asset_write`.
- `BroomProperties` is a built-in placeable with named text, number and bool values.
- The editor sends only overridden fields (`components` on each authored object, `{type_path: {field_path: value}}` in a normalized JSON form). The `placeables` slice composes each component from `Default` plus the overrides, inserts, updates or removes it, and puts it back after a geometry swap. Unknown classes and bad fields are reported through `broom.status`; the other components still apply.
- Shipped levels get the components from the manifest, or from the `broom_components` node extras of a GLB exported by the editor. `BroomGltfComponentsPlugin` reads those extras on its own, without the bridge.

The editor's `documentation/game_components.md` describes the workflow from the editor's side.

## How live editing works

- **Authored state** (`broom.apply_state`): the editor sends every object's id, parent, transform and visibility, and every light's settings, about 30 times a second while something changes. Snapshots carry a revision; an older or invalid snapshot never replaces a newer one. Lights are DynLight `DynamicLight`s spawned by id at the top level, so geometry swaps never despawn them. Rooms and portals arrive the same way and become DynLight `Room` and `Portal` entities, with `ClosedPortal` added or removed live when a door closes or opens; their world transform, including scale, sizes the cells. The geometry the editor sends for the preview carries no room or portal nodes, so they never exist twice; a GLB exported from the editor for a game carries them as `dynlight_room` / `dynlight_portal` / `dynlight_portal_closed` node extras, which DynLight's glTF import reads without the bridge.
- **Geometry** (`broom.publish_geometry`): after a geometry edit settles, the editor sends a GLB. Each revision is written as a new immutable file in the level directory, loaded hidden and swapped in once spawned; a revision that fails to load is dropped and the previous geometry stays; `broom.status` reports it as `geometry_revision_failed` and the bridge forgets it, so the editor may send it again. Nodes carry their editor id in the extras key `broom_id` and are flagged `dynlight_static` for baking.
- **Manifest**: each level directory holds a `level.broom.json` naming the shown geometry file plus the authored state (lights, rooms, portals, transforms, visibility), so the game loads the same level without the editor. When a document is shown under a new level name, the bridge deletes its own `geometry_*.glb` and `level.broom.json` from the old directory, then the directory if it is empty; it never deletes other files or another document's level.
- **Bakes** (`broom.bake_preview`): a preview bake runs in memory once geometry is settled. A bake whose scene changed before it finished is dropped. `broom.status` reports whether the shown bake is current; when a requested bake was dropped and none is shown yet, it reports `needs_bake` rather than `no_bake`.
- **Restarts**: `broom.status` returns an `instance_id`. When it changes, the editor resends state, geometry and catalog. Revisions are ordered per editor session, so a restarted editor starts over cleanly.

| Method | Purpose |
| --- | --- |
| `broom.apply_state` | Queue an authored snapshot. |
| `broom.publish_geometry` | Queue a geometry revision (GLB, base64). |
| `broom.status` | Revisions received, applied and failed, lights, rooms and portals (`room_count`, `portal_count`, `portal_state`, `portal_message`), bake state, errors. |
| `broom.catalog` | The material catalog and its generation counters. |
| `broom.read_asset` | A file under the asset root, base64, for editor previews. |
| `broom.bake_preview` | Request a preview bake. |
| `broom.load_level` | Load a level from its manifest. |
| `broom.placeable_classes` | The placeable component classes with their fields and defaults, and the asset types with their files. |
| `broom.data_asset_read` | The overridden fields of a data asset file. |
| `broom.data_asset_write` | Queue writing a data asset file; `broom.status` reports `data_asset_generation` once it is written and reloaded. |

## Coordinates

The `bevy_meters` profile matches the editor: Y up, right-handed, one unit is one meter, so no conversion is needed. Spot lights shine along their local −Z axis.

## Checks

```
cargo fmt --all
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
```

### End-to-end test with the editor

The editor repository has opt-in acceptance tests that drive its real preview link against this preview program. One covers two rooms with catalog materials, point and spot lights, drags, duplicate / delete / undo / redo, a parent move, a geometry swap, invalid input, save and reopen, a game restart, catalog and texture reloads, and a stale bake. The other covers rooms and portals with culling on, a door closing and opening, a failed geometry load and its resend, a renamed level's cleanup, a stale first bake, a bake without UV1 warnings, and Save As. A third covers game components: placed defaults, overrides, undo, a component on a brush across a geometry swap, removal, properties, a data asset field and a data asset write, a shipped GLB loaded with `--scene` next to its manifest, and an unknown class. Each copies the project to a temporary directory and starts its own preview on its own port with `--hidden`, so no window appears; set `BROOM_E2E_SHOW_WINDOWS=1` to watch. A fourth test drives the built desktop editor over MCP against the preview; see the editor's `documentation/building_and_running.md`.

```
cargo build --release -p broom_preview
cd ..\AiWorldEd
set BROOM_E2E_PREVIEW_EXE=..\AiWorldEdBevy\target\release\broom_preview.exe
set BROOM_E2E_PROJECT_DIR=..\AiWorldEdBevy
bun run e2e
```

Without the two variables the tests are skipped, so `bun run testrun` stays offline.
