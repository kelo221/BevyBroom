# Integrating a Game

This guide connects a new Bevy game to BevyBroom step by step: the game shows the level you are editing while you work, offers its own components for placement, and loads the levels you build. The smallest working game is the example `bevy/crates/broom_bridge/examples/minimal_game.rs`; every snippet below is taken from it.

Try the example first, from the `bevy/` folder of this repository:

```
cargo run -p broom_bridge --example minimal_game -- --project broom.project.json
```

Add `--no-default-features` to run it without DynLight.

## 1. Add the dependencies

The game side is the `broom_bridge` crate in `bevy/crates/broom_bridge` of this repository. It targets Bevy 0.20, so the game must use the same Bevy version.

A game rendered with [DynLight](https://github.com/kelo221/DynamicLighting-Bevy) adds both crates as path dependencies:

```toml
[dependencies]
bevy = "0.20"
broom_bridge = { path = "../BevyBroom/bevy/crates/broom_bridge" }
dynlight = { path = "../DynLightBevy" }
```

The bridge finds DynLight in a `DynLightBevy` checkout next to the BevyBroom checkout, at the commit pinned in `compatibility.json`. The game's own `dynlight` dependency must point at that same checkout, or Cargo builds two different DynLight crates whose types do not match.

A game rendered another way turns the bridge's `dynlight` feature off and needs no DynLight checkout:

```toml
[dependencies]
bevy = "0.20"
broom_bridge = { path = "../BevyBroom/bevy/crates/broom_bridge", default-features = false }
```

What changes without DynLight is listed under **Games without DynLight** in `bevy/README.md`. In short: geometry, catalog materials, transforms, game components and level loading work; authored lights, rooms and portals are accepted but not shown, and there are no preview bakes.

## 2. Write the project file

`broom.project.json` sits at the game's root. The editor and the game both read it, so they agree on where things are. The sample project's file is `bevy/broom.project.json`:

```json
{
  "project_version": 1,
  "project_id": "broom-sample-project",
  "name": "BevyBroom sample game",
  "asset_root": "assets",
  "material_catalog": "broom/materials.json",
  "level_directory": "broom/levels",
  "document_directory": "broom/documents",
  "texture_directories": ["textures"],
  "preview": {
    "program": "cargo",
    "arguments": ["run", "--release", "-p", "broom_preview", "--", "--project", "broom.project.json"],
    "working_directory": ".",
    "endpoint": "http://127.0.0.1:15702"
  },
  "coordinate_profile": "bevy_meters"
}
```

Every path is relative and must stay inside the project; a path such as `../other` is refused.

| Field                       | Meaning                                                                                                                                                                                                                                        |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `project_version`           | The project file format. Must be `1`.                                                                                                                                                                                                          |
| `project_id`                | A stable id for the game. The game reports it in its handshake, documents remember it, and the editor refuses to send a document into the game of another project. Never change it once documents use it.                                      |
| `name`                      | Optional. The name the editor shows for the project; `project_id` when missing.                                                                                                                                                                |
| `asset_root`                | Relative to the project file: the folder the game's `AssetPlugin` loads from. The other asset paths are relative to it.                                                                                                                        |
| `material_catalog`          | Relative to `asset_root`: the game's material catalog (see step 3). The game reads it and sends it to the editor.                                                                                                                              |
| `level_directory`           | Relative to `asset_root`: where levels are written, one folder per level, by the live preview and by **Run > Build Level**.                                                                                                                    |
| `document_directory`        | Relative to the project file: meant for the editor's scene files, `broom/documents` by default. It is checked to stay inside the project, but neither the editor nor the game uses it yet.                                                     |
| `texture_directories`       | Optional, relative to `asset_root`: folders whose images the desktop editor's Textures tab lists as **Project textures**. See [Textures and UV mapping](textures_and_uvs.md). The game does not read it.                                       |
| `sprinkle_directories`      | Optional, relative to `asset_root`: folders whose `*.txt` sprinkle definition files (Valve KeyValues) the desktop editor's Sprinkle tool loads as types. The game does not read it.                                                            |
| `entity_classes`            | Optional, relative to the project file: a `.json` file declaring the game's entity classes for every level, without the game running. See [Project classes and prefabs](project_classes_and_prefabs.md). The game does not read it.            |
| `prefab_directory`          | Optional, relative to the project file: the folder holding one file per prefab. See [Project classes and prefabs](project_classes_and_prefabs.md). The game does not read it.                                                                  |
| `tool_textures`             | Optional: `{ "nodraw": [texture ids] }`. Faces with a `nodraw` texture keep their collision but are left out of the exported render geometry. See [Exporting levels for a game](level_export.md).                                              |
| `preview`                   | Optional. Without it the project still opens and levels, textures, classes and prefabs work; the editor just cannot build or start the game.                                                                                                   |
| `preview.program`           | The program that starts the game, such as `cargo` or a built executable. A bare name is looked up in the PATH of your login shell, so `bun` or `cargo` installed for your user is found even when the desktop app was started from the Finder. |
| `preview.arguments`         | Its arguments. Pass `--project` with the project file when your game reads it from the command line, as the example does. `{level_id}`, `{level_document}` and `{level_export_directory}` start the game in the open level (see below).        |
| `preview.working_directory` | Relative to the project file, `.` by default: where the program starts.                                                                                                                                                                        |
| `preview.endpoint`          | The game's bridge address, `http://127.0.0.1:15702` by default. It must match the bridge's port.                                                                                                                                               |
| `preview.build`             | Optional: `program`, `arguments` and `working_directory` of the command that builds the game without starting it. Without it the desktop editor builds a `cargo run` launch with the matching `cargo build`.                                   |
| `coordinate_profile`        | `bevy_meters` (Y up, right-handed, one unit is one meter), the default. Neither the editor nor the game reads it yet; the editor and Bevy already share these axes, so nothing is converted.                                                   |

For your own game, point `preview` at your game instead of `broom_preview`, for example `"arguments": ["run", "--release", "--", "--project", "broom.project.json"]`.

### Start the game in the open level

`preview.arguments` may name the level open in the editor. When the game starts, the editor replaces:

| Placeholder                | Becomes                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------- |
| `{level_id}`               | The open level's id, the name its package is published under, such as `store`.              |
| `{level_document}`         | The absolute path of the open level's document, such as `…/broom/documents/store.json`.     |
| `{level_export_directory}` | The absolute folder its package is built into, `<asset_root>/<level_directory>/<level_id>`. |

A placeholder can be a whole argument or part of one (`--level={level_id}`). For `broom_preview`: `"arguments": ["--project", "broom.project.json", "--level", "{level_id}"]`.

When the arguments use a placeholder, **Launch**, **Rebuild** and **Restart** (in the Run menu, the Game Preview panel and the MCP `game_launch`, `game_rebuild` and `game_restart` tools) first save the open level into its document. When the arguments name `{level_id}` or `{level_export_directory}`, they also build the level like **Run > Build Level**; a game that names only `{level_document}` reads the saved document, so nothing is built. If the save or the build fails, the game is not started and the panel says why. With no project level open, the start is refused with a message; open or save the scene as a project level first. The Game Preview panel shows which level the game starts in.

The **Play Level** button of the Game Preview panel (and the MCP `game_play_level` tool) is the one-key way to try the level: it saves the open level and starts the game in it, or, when the game already runs, builds and starts it again so it shows the level as it is now (it restarts without building when the project names no build).

### Run configurations (F9)

F9 runs the **active run configuration**: a named list of steps such as "Play", "Bake Lighting" or "Bake + Play". A project that stores none gets one "Play" that does what Play Level does. Edit them in **Run > Edit Run Configurations…** (Shift+F9); **Run > Run Configuration** runs any of them once and **Run > Active Configuration** picks the one F9 runs. The configurations are stored in the project file under `run_configurations`, so the whole team shares them; which one is active is remembered on each computer.

| Step kind             | What it does                                                                                                                     |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `level_save`          | Saves the open level.                                                                                                            |
| `level_package_build` | Builds the open level's package like **Run > Build Level**.                                                                      |
| `command`             | Runs `program` with `arguments` in `working_directory` (relative to the project) to its end; a non-zero exit code fails the run. |
| `game_play`           | Starts the game with `preview`, or builds and starts it again when it runs.                                                      |
| `game_stop`           | Stops the game the editor started.                                                                                               |

Steps run from top to bottom and the first failing step stops the run; its reason shows in the Console. A step with `"enabled": false` is kept but skipped. Command arguments may use the level placeholders above and `{project_directory}`. A light bake, for example:

```json
"run_configurations": [
  {
    "id": "bake",
    "name": "Bake Lighting",
    "steps": [
      { "kind": "level_save" },
      { "kind": "level_package_build" },
      { "kind": "command", "program": "cargo", "arguments": ["run", "-p", "game", "--", "--bake-level", "{level_export_directory}"] }
    ]
  }
]
```

The MCP tools `list_run_configurations`, `set_run_configurations` and `run_configuration` list, store and run them.

A placeholder the editor does not know, such as `{level_name}`, is a project error, so a typo cannot start the game with a literal `{…}` argument. Arguments without placeholders start the game exactly as written. `bun run preview:game` refuses a project whose arguments use a placeholder, because only the editor knows the open level.

## 3. Describe the materials

The material catalog lists the game's materials with stable ids such as `stone/castle_wall`. The editor shows them on the Textures tab of the Browser as **Game materials**; a face that uses one exports the id, and the game gives that face its own material. Start from `bevy/assets/broom/materials.json` (the sample game's catalog) or `bevy/fixtures/material_catalog_sample.json` (a short example of the format, parsed by the tests of both sides). Texture paths in the catalog are relative to `asset_root`.

- With the `dynlight` feature the bridge builds each entry as a `DynLitMaterial`; without it as a `StandardMaterial`.
- To bind your own material type, implement `CatalogMaterialKind` for it and add `BroomBridgePlugin::new(paths).with_catalog_material::<M>()`. Your renderer must add `MaterialPlugin::<M>`.
- An entry may name a `resolver`. Register a function under that name with `CatalogResolvers::<M>::register` to build game-specific materials; entries without one use `dynlit`, the built-in resolver that builds the plain material from the entry.
- `CatalogMaterials<M>::handle(id)` gives the material of an id, for the game's own meshes.

Editing the catalog file or one of its textures while the game runs rebuilds the materials in place. See **Materials** in `bevy/README.md` for details.

## 4. Add the plugins

The game's `AssetPlugin` must load from the project's asset root, so read the project file first. `ProjectPaths::load` resolves every path to an absolute one:

```rust
use std::path::PathBuf;

use bevy::asset::AssetMetaCheck;
use bevy::prelude::*;
use bevy::winit::WinitSettings;
use broom_bridge::prelude::*;
```

```rust
fn main() -> AppExit {
    let paths = match project_argument().and_then(|file| ProjectPaths::load(&file)) {
        Ok(paths) => paths,
        Err(error) => {
            eprintln!("minimal_game: {error}");
            return AppExit::error();
        }
    };
    let mut app = App::new();
    app.add_plugins(DefaultPlugins.set(AssetPlugin {
        file_path: paths.asset_root.to_string_lossy().into_owned(),
        meta_check: AssetMetaCheck::Never,
        ..default()
    }));
    #[cfg(feature = "dynlight")]
    app.add_plugins(dynlight::prelude::DynamicLightingPlugin);
    app.add_plugins(BroomBridgePlugin::new(paths))
        .register_placeable::<SpawnPoint>(PlaceableOptions::point().category("Players"))
        .insert_resource(WinitSettings::continuous())
        .add_systems(Startup, spawn_camera)
        .run()
}
```

`project_argument` reads `--project FILE` from the command line, `broom.project.json` when it is missing; `spawn_camera` spawns a `Camera3d`. Both are in the example. A game that always uses DynLight adds `DynamicLightingPlugin` without the `cfg`; the example needs it only because it builds both ways. Never spawn Bevy lights in a DynLight game: authored lights arrive as DynLight lights. `WinitSettings::continuous()` keeps the game drawing while the editor window has focus.

Pick the plugin by build:

- **`BroomBridgePlugin::new(paths)`** for development: everything the level plugin does, plus the editor connection on `127.0.0.1` (port 15702 by default, the `port` field changes it). It accepts any local caller, so leave it out of shipped builds.
- **`BroomLevelPlugin::new(paths)`** for shipped builds: loads levels the editor built, binds catalog materials and places game components, without any connection.
- **`BroomGltfComponentsPlugin`** on its own, for a game that spawns GLB files exported with **File > Export GLB** itself and needs only their `broom_components` node extras turned into components.

## 5. Register game components

Any reflected component with a `Default` can be placed from the editor. The example's spawn point:

```rust
/// Where players appear, placed from the editor's Add > Game Entities menu.
#[derive(Component, Reflect, Clone, Debug, PartialEq)]
#[reflect(Component, Default)]
pub struct SpawnPoint {
    pub team: String,
    #[reflect(@FieldRange::new(0.0, 30.0), @FieldLabel("Respawn delay (s)"))]
    pub respawn_seconds: f32,
    pub enabled: bool,
}

impl Default for SpawnPoint {
    fn default() -> Self {
        Self {
            team: "red".into(),
            respawn_seconds: 5.0,
            enabled: true,
        }
    }
}
```

`register_placeable::<SpawnPoint>(PlaceableOptions::point().category("Players"))` in step 4 offers it under **Add > Game Entities > Players**. The editor shows the `Default` values and stores only the fields you change.

- `register_placeable::<T>(options)`: a placeable component. `point()` places it on Game Entities, `any()` also on brushes, meshes, lights, rooms and portals.
- `register_data_asset::<A>("ext")`: RON files of shared settings that components point at with `Handle<A>` fields, editable from the editor.
- `register_placeable_asset::<A>(&["ext"])`: lets `Handle<A>` fields pick asset files with those extensions.

[Game components and data assets](game_components.md) covers field kinds, field attributes and data assets in full.

## 6. Run the game with the editor

Start the game from the editor folder with the project's `preview` command:

```
bun run preview:game C:\path\to\your\game\broom.project.json
```

Then choose **Run > Game Preview** in the editor, check the endpoint and press **Connect**. Or, in the desktop app, choose **File > Open Project…**, pick the `broom.project.json`, and use **Run > Launch Game**, which builds the game, starts it and connects (see [Building and running from source](building_and_running.md)).

Once connected:

- The game shows the level as you edit it: transforms, geometry, materials and, with DynLight, lights, rooms and portals. See [Game preview and lights](game_preview.md).
- The Textures tab of the Browser lists the catalog as **Game materials**, and, in the desktop app with the project open, the images of `texture_directories` as **Project textures**.
- **Add > Game Entities** lists the registered components by category, and the **Class Info** tab of Object Properties edits them.
- The Game Preview panel shows what the game received and applied, and the newest error it reported.

## 7. Load a shipped level

**Run > Build Level** writes the open document to `<asset_root>/<level_directory>/<name>/`: a geometry GLB, a `level.broom.json` manifest with the lights, rooms, portals, transforms and components, and a `collision.json` with the level's convex collision pieces and placements. `bun scripts/level_export.ts` writes the same files from the command line, without the editor, for scripts and CI. See [Exporting levels for a game](level_export.md). A game with `BroomLevelPlugin` (or `BroomBridgePlugin`) loads it by name with a message:

```rust
fn load_first_level(mut loads: MessageWriter<LevelLoadRequest>) {
    loads.write(LevelLoadRequest {
        level_name: "castle".into(),
    });
}
```

`broom_preview --level castle` does the same, which is a quick way to check a built level. See **Build Level** in [Game preview and lights](game_preview.md).

## 8. Troubleshooting

When something does not arrive, ask the game directly. With the game running:

```
curl -X POST http://127.0.0.1:15702 -H "Content-Type: application/json" -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"broom.hello\"}"
```

The answer lists `protocol`, `min_protocol`, `capabilities` and `project_id`. `broom.status` reports revisions, counts and errors, and `broom.placeable_classes` lists the registered components.

- **Panel says Game is incompatible, nothing is sent.** The Console says why:
  - The protocol range does not include the editor's version: rebuild the game with the current `broom_bridge`, or update the editor. `compatibility.json` names the protocol this editor speaks.
  - A required capability is missing (`state`, `geometry`): the game uses an old bridge; rebuild it.
  - The running game belongs to another project: the document is linked to a different `project_id`. Start the right game, or in the desktop app open the right project and use **Link Document** in the panel.
- **Panel keeps retrying.** The game is not running, or `preview.endpoint` does not match the bridge's port. Check that the game logs `broom bridge: listening on http://127.0.0.1:…`. Only one game can use a port at a time.
- **Console says "This game does not render editor lights".** The game was built without the `dynlight` feature. Lights, rooms and portals are still saved and exported, but this game does not show them and does not serve preview bakes.
- **Faces show the editor's texture, not the game's material.** Check `catalog_error` in `broom.status`: a broken catalog file keeps the previous catalog, and an entry whose `resolver` the game did not register is named there. Check also that the face uses a **Game materials** entry. With your own material type, check that the renderer adds `MaterialPlugin::<M>`.
- **Catalog textures are missing in the game.** Texture paths are relative to `asset_root`, and the game's `AssetPlugin` must use `paths.asset_root`.
- **Project textures do not appear.** They need the desktop app with the project open. The folders in `texture_directories` are relative to `asset_root`; a missing folder shows a warning when the project opens. New images appear after opening the project again.
- **A component does not appear under Add > Game Entities.** It must be registered with `register_placeable` and derive `Reflect` with `#[reflect(Component, Default)]`. Connect once so the editor learns the classes; it keeps a copy per project afterwards.

More fixes for the editor itself are in [Troubleshooting](troubleshooting.md).
