# Project Classes and Prefabs

A project can keep two kinds of editor data in its own files, so every level of
the project shares them and they live in version control with the game:

- **Game entity classes**: the components your game places (fields, defaults,
  marker colour, placement), declared once instead of copied into every level.
- **Prefabs**: reusable groups of objects and brushes, one file each.

Both need the desktop app and an open project. Neither needs the game to run.

## The project file

Add one or both fields to `broom.project.json`. Paths are relative to the
project file and must stay inside the project.

```json
{
  "entity_classes": "broom/entity_classes.json",
  "prefab_directory": "broom/prefabs"
}
```

| Field              | Meaning                                                                                                  |
| ------------------ | -------------------------------------------------------------------------------------------------------- |
| `entity_classes`   | A `.json` file declaring the project's game entity classes. It is created on the first write if missing. |
| `prefab_directory` | A folder holding one `<id>.json` file per prefab. It is created when the first prefab is saved.          |

A project without these fields works as before: classes come from the running
game and from each level's own copy, and prefabs last for the session.

## Game entity classes

The class file uses the same format the game bridge reports its classes in:

```json
{
  "classes": [
    {
      "type_path": "cart_crashers::level::Shelf",
      "label": "Shelf",
      "category": "Store",
      "placement": "point",
      "marker_color": [0.9, 0.6, 0.2],
      "fields": [{ "path": "fixture", "label": "Fixture", "kind": "string", "default": "shelf-tall-4" }]
    }
  ],
  "asset_types": []
}
```

- Every level of the project shows these classes in **Add > Game Entities** and
  in Object Properties, with the game closed.
- A class can declare the box its markers are drawn as: `"marker_box"`, and
  `"marker_boxes"` keyed by the value of the field `"marker_box_field"` names.
  A box may name a `"model"`, a binary glTF (`.glb`) path relative to the
  asset root, which the editor draws at the entity's origin. A class that picks
  its box by a field is offered once per boxed value, so a catalogue of props
  becomes one Add menu entry and one Place tile per prop:

  ```json
  {
    "type_path": "cart_crashers::level::StoreProp",
    "label": "Store prop",
    "category": "Store",
    "placement": "point",
    "fields": [{ "path": "fixture", "label": "Fixture", "kind": "text", "default": "freezer" }],
    "marker_box_field": "fixture",
    "marker_boxes": {
      "freezer": {
        "size": [2.06, 0.75, 1.2],
        "offset": [0, 0.375, 0],
        "model": "assets/Models/Props/Freezer/Freezer.glb"
      }
    }
  }
  ```

  The model is stretched per axis to fill its box exactly, so a box sized on
  the grid draws its model on the grid even when the model's own size is
  slightly off; the game fills the box the same way. Placing an entity with a
  box lands the box's edges on the grid, even for sizes that are an odd number
  of half steps, and aiming at the top of another entity's box stacks it there.
  The model is an editor-only drawing: it is never picked, saved or exported,
  and the game spawns whatever it wants for the entity. BevyBroom reads the
  models again whenever the editor window gains focus, so a model exported
  again shows up without reopening the project.

- An enum field can name and group its values with `"variant_details"`, keyed
  by value: `{ "freezer": { "label": "Freezer", "group": "Fridges & freezers" } }`.
  The Add menu and the Place browser list each boxed value under its group, and
  the field's dropdown in the Properties panel shows the labels under their
  groups. Values without details show a readable form of the value itself.
- An `"enum_list"` field holds an ordered list of distinct values from its
  `"variants"`, such as the categories of a shelf run along an aisle. Its
  `"default"` is a list. In the Properties panel each held value is a numbered
  row with move up, move down and remove buttons, and an **Add…** dropdown,
  grouped like an enum field's, adds a value the list does not hold yet.
  `"variant_details"` and `"renamed_variants"` work as for an enum field;
  renames apply to each entry. Saved levels, the game preview and the
  exported `collision.json` carry the value as a JSON array of strings in the
  component's field, in order. An entry the field does not list shows an
  Issues line naming the object and the value.

  ```json
  {
    "path": "categories",
    "label": "Categories",
    "kind": "enum_list",
    "default": ["generic"],
    "variants": ["bottles", "cereal", "generic"],
    "renamed_variants": { "cans": "bottles" }
  }
  ```

- A variant's details may also declare the light an entity holding the
  variant carries, such as a fluorescent fixture's tube:

  ```json
  "light": {
    "kind": "tube", "from": [-0.5, 0, 0.04], "to": [0.5, 0, 0.04],
    "color": [0.88, 0.96, 1.0], "intensity": 0.4, "radius": 9,
    "effect": "fluorescent_starter",
    "fog": { "intensity": 0.04, "thickness": 1, "visibility_m": 2, "below_floor_m": 0.5 }
  }
  ```

  `kind` is `"tube"` (with `from` and `to`) or `"point"` (with `at`); positions
  are meters in the entity's own space and the color is linear. Placing the
  entity, or switching it to the variant, adds a child light: a tube centred
  between the ends with its local X axis running from `from` to `to` and its
  local −Z axis rolled as far down as the tube allows, or a point at `at`. Its color is stored in sRGB like every light. Fog becomes a
  frustum reaching from the light down to the first surface below it plus
  `below_floor_m`, measured once when the light is made. The light is an
  ordinary light you can edit; your edits stay until the variant changes,
  which makes the light again (or removes it when the new variant has none).
  Lights you add yourself under the entity are never touched. The whole
  change is one undo step with the edit that caused it.

- A class can name the editor icon of its entities with `"icon"`, one of the
  names in `src/ui/icons/icon_name.ts` such as `"lightbulb"` or `"door-closed"`.
  Markers, the outliner, the Add menu and the Place tiles show it; an unknown
  name or none shows the puzzle piece.
- A volume (a brush carrying a class) can show what it holds with three
  class keys, each naming a field of the class:

  ```json
  "marker_label_field": "categories",
  "marker_hatched_when_true": "blocked",
  "marker_runs_field": "categories"
  ```

  `marker_label_field` writes the field's value as a label along the volume's
  plan (the labels of an `enum_list` joined by " · ", an enum's label, other
  values as text). `marker_hatched_when_true` names a bool field; while it is
  true the plan is drawn with diagonal stripes, for example a blocked aisle.
  `marker_runs_field` names an `enum_list` field: the plan is split into one
  equal band per entry, in list order, coloured by the variant's
  `"color"` in `variant_details` (sRGB, 0 to 1 per channel; without one, a
  lighter or darker shade of `marker_color`) and labelled with its number
  and variant label. **Run rule** (games stock by the same rule): the bands
  follow the volume's longer local horizontal axis, local X when its X extent
  is at least its Z extent, else local Z, and the first band starts at that
  axis's negative end in the volume's own space. The plan is drawn on the
  volume's floor and on its roof, so it reads from above and from inside,
  follows every edit and resize live, and is never picked, saved or exported.

- An entity whose marker field holds a value the enum no longer lists, such as
  a fixture id the game renamed, shows a plain marker box, never another
  variant's model, and the Issues list warns about it with the object and the
  value.
- When an entity carries several classes that give a marker box, a box that
  names a model wins; otherwise the class first in type path order wins.
- The box size a class gives the selected objects is listed in the Help box of
  Object Properties (Class Info tab), not in the Properties panel.
- **Renames are data.** When a class or a value is renamed, say so in the class
  file and every level follows on its own:

  ```json
  {
    "type_path": "cart_crashers::level::StockFixture",
    "renamed_from": [
      "cart_crashers::level::Shelf",
      { "type_path": "cart_crashers::level::Rack", "defaults": { "fixture": "shelf-tall-4" } }
    ],
    "absorbs": [
      {
        "from": "cart_crashers::level::StoreProp",
        "field": "fixture",
        "variants": ["big-fridge", "freezer", "shop-shelf"],
        "default": "big-fridge"
      }
    ],
    "fields": [{ "path": "fixture", "kind": "enum", "renamed_variants": { "shop-shelf": "shop-shelf-4" } }]
  }
  ```

  - `renamed_from` lists old type paths. A component stored under one becomes
    this class. The long form names `defaults`: what a field the old component
    left out meant; without it the old class's defaults from the level's own
    copy are used.
  - `absorbs` moves components of another class (`from`) whose enum `field`
    holds one of `variants` into this class, with all their values. `default`
    is the value an old component without the field held.
  - `renamed_variants` on an enum or enum list field maps old values to new
    ones.
  - The editor rewrites levels when they are loaded or pasted and whenever the
    class file changes, and the Issues list shows one line per rewrite. Saved
    files, the game preview and every export use the new names, so the game
    never sees an old one.

- **Values never depend on a default.** The editor writes every enum and enum
  list field's
  value into the level, so changing a default in the class file never changes
  an object already placed. A component loaded without a value gets the
  current default written in, with an Issues line saying so.
- **The project's class file always wins** over the copy of the classes a level
  carries. When the copy differs, is replaced by a renamed class, or declares a
  class the file does not, the Issues list says so; the copy is refreshed when
  the level is saved.
- Every key above is optional: a class file without them works as before.
- A class can declare `"collision": "solid"`, `"volume"` or `"none"`: the
  collision kind solid models carrying it take in exported levels, such as
  `"volume"` for a finish zone. See
  [Exporting levels for a game](level_export.md).
- Edit the file in any text editor. BevyBroom reads it again whenever the editor
  window gains focus, and when the project is opened. A file that is not valid
  JSON is reported, and the classes shown before stay.
- When the game is connected, the classes it reports win over the file. The file
  wins over the copy a level carries.
- Levels still save a copy of the classes they use (`gameClasses` in the scene
  file), so a level opens anywhere and a game can read defaults from the level
  alone. That copy is taken from the classes shown, so it follows the class file.

### Moving a level's classes into the project

When an open level carries classes the class file does not declare, the Console
says so. **File > Move Level Classes to Project** adds those classes to the file.
Classes the file already declares are left as they are.

## Prefabs

Prefabs live on the **Place** tab of the Browser, next to every other kind of object you
place: each prefab is a tile with a 3D thumbnail, under **Prefabs** and its own
category. The search finds prefabs by name or category, and the category filter
shows only **Prefabs** (or any other category).

- **Make a prefab:** select objects, then right-click a view and choose **Make
  Prefab…** (also in the **Edit** menu, in command search, `Ctrl+Alt+P`, and the
  right-click menu of the hierarchy, which makes a whole group a prop). The name
  starts as the selected object's or group's name, or what several objects are;
  change it if you like, optionally set a category (the last one used is filled
  in), and press `Enter`. The prefab keeps geometry, brushes, textures, game components and
  entity I/O. With a `prefab_directory` it is saved as
  `<prefab_directory>/<id>.json`, where the id comes from the name (`Shelf Row`
  becomes `shelf_row.json`). Its tile appears on the Place tab, selected.
- **Place a prefab:** drag its tile into a 2D or 3D view. The copy lands with
  the bottom of its bounds on the surface under the cursor, centred on it and
  snapped to the grid; in a 2D top view it rests on whatever is under the
  cursor, in the other 2D views it keeps its height. Double-click the tile, or
  choose it under **Add > Prefabs**, to place it at the centre of the active
  view the same way.
- **Right-click a tile** for **Rename…**, **Change Category…**, **Delete** and
  **Reveal File** (project prefabs only, desktop app).

Every change is a single undo step; undoing **Make Prefab…** deletes the file
again and undoing **Delete** writes it back. Renaming keeps the id and the file
name.

Placed prefabs are **copies**. Changing or deleting a prefab later does not change
copies already placed in levels. Names that the prefab's own entity I/O fires at
get a fresh suffix in every copy, so two copies never trigger each other.

Prefab files are plain JSON (`"format": "bevybroom.prefab"`). Prefab files added
by other programs, or by pulling from version control, show up when the editor
window gains focus. The id follows the file name; renaming a prefab in the editor
changes only its display name.

## MCP tools

| Tool                            | What it does                                                                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `list_project_classes`          | The class file's state (`isConfigured`, `fileName`, `problem`), its `classes`, and `undeclaredLevelClasses`. |
| `set_project_class`             | Declares a class in the file, replacing the one with the same `type_path`.                                   |
| `remove_project_class`          | Removes a class from the file by `typePath`.                                                                 |
| `move_level_classes_to_project` | Adds the open level's undeclared classes to the file.                                                        |
| `list_prefabs`                  | Every prefab with `id`, `name`, `category`, `objectCount`, `brushCount` and `isProjectFile`.                 |
| `create_prefab`                 | Captures the selection as a prefab named `name` in `category`; saved to the project when it has a directory. |
| `place_prefab`                  | Places a copy of `prefabId`, at its captured position or with the bottom centre of its bounds at `position`. |
| `update_prefab`                 | Renames `prefabId` to `name` or moves it to `category`, keeping its id and file.                             |
| `delete_prefab`                 | Deletes `prefabId` and its project file.                                                                     |
