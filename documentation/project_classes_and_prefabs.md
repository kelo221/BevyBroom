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
  Prefab…** (also in the **Edit** menu, in command search, and `Ctrl+Alt+P`). Type
  a name, optionally a category (the last one used is filled in), and press
  `Enter`. The prefab keeps geometry, brushes, textures, game components and
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
