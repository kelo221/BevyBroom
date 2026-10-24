# Game Components and Data Assets

Game components let you place your game's own data in a level: a door with a speed and a key, a spinner on a platform, spawn points with a team name. You write the component in Rust as usual, register it, and the editor shows it with the fields and default values your Rust code defines. Data assets are files of shared settings (for example the stats of a heavy door) that many components can point at, much like Unity's ScriptableObjects.

The Rust type is the only source of truth. The editor stores just the fields you changed, so when you change a default in Rust, every placed object that did not override that field picks up the new default.

## In the game

Add the bridge as described in the bridge's `README.md`, then register the components and asset types the editor may place:

```rust
use bevy::prelude::*;
use broom_bridge::prelude::*;

#[derive(Component, Reflect)]
#[reflect(Component, Default)]
pub struct Door {
    #[reflect(@FieldRange::new(0.0, 10.0), @FieldStep(0.1), @FieldLabel("Speed"))]
    pub speed: f32,
    pub locked: bool,
    pub key_name: String,
    pub kind: DoorKind,
    pub stats: Handle<DoorStats>,
}

impl Default for Door { /* the defaults the editor shows */ }

#[derive(Asset, Reflect)]
#[reflect(Default)]
pub struct DoorStats {
    pub health: f32,
    pub open_seconds: f32,
}

app.register_data_asset::<DoorStats>("door.ron")
    .register_placeable::<Door>(
        PlaceableOptions::point()
            .category("Doors")
            .marker_color(Srgba::rgb(0.9, 0.5, 0.1)),
    );
```

- `register_placeable::<T>(options)` makes a component placeable. `PlaceableOptions::point()` offers it on new Game Entities; `PlaceableOptions::any()` also offers it on brushes, meshes, lights, rooms and portals. `category`, `label` and `marker_color` control how the editor lists and draws it.
- Field attributes: `FieldRange::new(min, max)`, `FieldStep(step)`, `FieldLabel("text")` and `FieldHidden` (the editor does not show the field).
- `register_placeable_asset::<A>(&["ext"])` lets `Handle<A>` fields pick files with those extensions.
- `register_data_asset::<A>("ext")` does the same and also makes the files editable from the editor. It installs a loader for `A`.

### Field kinds

| Rust field                             | Editor control                                     |
| -------------------------------------- | -------------------------------------------------- |
| `f32`, `f64`                           | Number, with the range and step attributes.        |
| integers                               | Whole number.                                      |
| `bool`                                 | Checkbox.                                          |
| `String`                               | Text.                                              |
| `Vec2`, `Vec3`, `Vec4`                 | Two to four numbers.                               |
| `Color`                                | Color picker (sRGB).                               |
| enums with unit variants               | Choice of the variant names.                       |
| `Handle<A>` of a registered asset type | Choice of the matching files in the assets folder. |
| nested structs                         | A group of the fields above.                       |
| anything else, such as enums with data | Shown read-only; the game keeps its default.       |

Vector fields are game data and are never converted between coordinate systems, also not for Unity or Blender exports.

### Free-form properties

The built-in **Properties** component (`BroomProperties`) holds named text, number and true/false values for data that has no Rust type yet. Read them with `properties.text("team")`, `properties.number("lives")` and `properties.flag("boss")`.

### Data asset files

A data asset file is a RON map of the fields that differ from the type's `Default`, for example `assets/data/doors/heavy.door.ron`:

```ron
{
    "health": 400.0,
    "open_seconds": 3.0,
}
```

Missing fields keep their Rust default, so an empty file is a valid asset with default values. A field the type does not have is reported and ignored. Asset fields inside data assets are not supported yet.

## In the editor

Connect the game preview first (see [Game preview and lights](game_preview.md)). The editor asks the game for its classes and keeps a copy per project, so the components stay editable after the game is closed; a saved scene also keeps a copy of the classes it uses.

- **Add > Game Entities > Empty Game Entity** adds a point object (a small translucent box with a puzzle piece icon inside, which you click to select it) with no components. The submenus below it list the point classes by category; picking one adds a Game Entity that already carries that component, tinted with the class's marker color.
- The **Game Components** section of the Properties panel works on any selection. **Add** attaches a component, **×** removes it.
- Fields start at the game's defaults. A changed field is highlighted orange and gets a **↺** button that resets it to the default. When several objects with different values are selected, the field is shown blank, and an edit sets all of them.
- All edits, including adding and removing components, are part of undo and redo and go to the running game live.
- A component the game does not know (renamed in Rust, or from another game) is listed as **(not in game)**. Its values are kept and saved but are read-only, and the game reports it as an error while the other components still apply.

### Editing data assets

An asset field of an editable data asset type has two extra buttons:

- **✎** opens the selected file in the data asset panel. Fields work as in the Properties panel; **↺** returns a field to the type's default.
- **+** creates a new file with default values, inside the assets folder and with the type's extension, and selects it.

The game writes the file and reloads it, so every component that uses it updates at once. These edits change files on disk: they need a connected game and are not part of the editor's undo.

## In a shipped level

A shipped game gets the components in two ways, so use whichever loader your game uses:

- The level manifest (`level.broom.json`) the preview writes holds every object's components, and `BroomLevelPlugin` applies them when it loads the level.
- **File > Export GLB** writes the components into the glTF node extras under the key `broom_components`, and Game Entities become empty nodes. Add `BroomGltfComponentsPlugin` to a game that spawns such GLB scenes itself; it does not need the rest of the bridge.

One limit applies to the GLB route: inside a solid model only the model itself is a node, so put components on the solid model rather than on single brushes. **Build Level** refuses to build while a brush carries components and lists it in the Issues panel.

## AI tools

The editor's MCP server offers the same features: `list_game_classes`, `add_game_entity`, `set_game_components` (a `null` component removes it), `read_data_asset` and `write_data_asset`. They use the same commands as the panel, so their edits can be undone too, except data asset writes.
