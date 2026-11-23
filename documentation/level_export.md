# Exporting Levels for a Game

A game reads everything about a level from its exported **level package**: the geometry it draws, the collision it builds, and the objects it places. It never reads the editor's scene file, and it never runs CSG itself.

**Run > Build Level** in the desktop app and the command-line export write the same package into `<asset_root>/<level_directory>/<level>/`:

| File               | Holds                                                                                                                                                                                        |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `geometry.glb`     | The render geometry, with lightmap UVs. Tool-texture faces and volumes are left out (see below). Each solid model's and plain mesh's node carries its collision as `broom_collision` extras. |
| `level.broom.json` | The manifest: lights, rooms, portals, transforms and game components, as the live preview sends them. A game with `BroomLevelPlugin` loads it by name.                                       |
| `collision.json`   | The convex collision pieces of every solid model, the parts that are not convex, and the placements of game entities and procedural objects. Format below.                                   |

## Export from the command line

The export runs without a window, a GPU or a running editor, so a game's own scripts and its CI can re-export a level whenever its document is newer than the package:

```
bun scripts/level_export.ts --project <path/to/broom.project.json> --level <id> [--out <dir>] [--check]
```

- `--level` is the level id the Level Browser lists: the document's path inside `document_directory`, without `.json`, with `/` turned into `_`.
- `--out` writes somewhere else than the project's level directory.
- `--check` writes nothing. It exits with `0` when the package on disk is what the document produces now. Otherwise it exits with `1` and names each file that differs.

Run it from the editor's checkout (it needs the editor's sources and `bun install`). The same document always gives the same bytes:

- objects are written in scene order;
- numbers are rounded to six decimals;
- the geometry file is named after a hash of its bytes;
- a document without an id gets one derived from the level id.

## Collision kinds

Every solid model and every plain mesh (such as an Add > Box mesh) has one collision kind:

| Kind     | Meaning                                                                                                      |
| -------- | ------------------------------------------------------------------------------------------------------------ |
| `solid`  | Blocks movement. The default.                                                                                |
| `volume` | An area the game reads, such as a finish zone or a door place. Nothing collides with it and it is not drawn. |
| `none`   | Drawn only.                                                                                                  |

A game class declares the kind its brush entities take, with `collision` in the [project class file](project_classes_and_prefabs.md) or `PlaceableOptions::any().collision(PlaceableCollisionKind::Volume)` in the game. The **Collision** section of the properties panel shows the kind of the selected solid models and plain meshes and lets them override it. Volumes still export as empty nodes, so their transform, components and `broom_collision` extras stay in the GLB.

## Tool textures

A texture the project marks as `nodraw` keeps its faces in the collision but leaves them out of the render geometry. Mark it once in `broom.project.json`, by texture id (the path relative to `asset_root`):

```json
"tool_textures": { "nodraw": ["textures/tools/NODRAW.png"] }
```

## `collision.json`

The format is a contract. The editor writes it, and the fixture `bevy/fixtures/collision_sample.json` is checked by the editor's tests and by the bridge's `CollisionDocument` reader. All positions are in world space, in meters.

```json
{
  "collision_version": 1,
  "level_name": "store",
  "pieces": [
    {
      "object_id": "…", "object_name": "Room", "brush_id": "…", "brush_name": "Outer",
      "kind": "solid", "components": { "game::Shelf": { "fixture": "end-cap" } },
      "planes": [{ "normal": [0, -1, 0], "distance": 0, "texture": "textures/floor.png" }],
      "vertices": [[-2, 0, -2], …]
    }
  ],
  "flagged": [
    { "object_id": "…", "reason": "displacement", "vertices": […], "triangles": [[0, 1, 2], …], … }
  ],
  "placements": [
    {
      "object_id": "…", "name": "Escalator", "kind": "procedural",
      "position": [x, y, z], "rotation": [x, y, z, w], "scale": [x, y, z],
      "components": { "broom_bridge::placeables::procedural::BroomProceduralProp": { … } },
      "procedural": {
        "generator": "people_mover", "version": 2, "parameters": { … }, "derived": { "shape": "escalator", "belt": 3, … },
        "derived_points_world": { "low_end": [x, y, z], "high_end": [x, y, z], "entry_end": [x, y, z], "exit_end": [x, y, z] }
      }
    }
  ]
}
```

- **pieces**: the convex parts of each solid model's final CSG result, following the editor's rules:
  - subtractive brushes are carved out, and a later additive brush fills back in;
  - intersecting brushes and compound groups are reduced;
  - an inverted world is bounded by its brushes plus one meter.

  Every plain mesh (Add > Box walls, platforms, props) that is a closed convex solid is also **one piece**, with the same record shape. A mesh is convex when every vertex lies behind every triangle plane, within 0.1 mm. Its `brush_id` and `brush_name` are empty, and each plane's texture is the material of the triangles on it.

  Each piece has its outward planes (`normal · p = distance`), the texture of the face on each plane (empty for a cut with no face), its vertices, the object's name, its kind, and its game components with every class default resolved.

- **flagged**: parts that are not convex pieces, as triangles: displaced surfaces (`displacement`), brushes edited into a non-convex shape (`non_convex_brush`), and plain meshes that are not closed convex solids, such as a torus or a flat plane (`non_convex_mesh`). A game can mesh them or refuse them by name.
- **placements**: every game entity, every procedural object and every other object carrying game components. Each one has its world position, rotation as a quaternion, scale and resolved components.
  - Procedural objects also carry their generator, parameters and derived values.
  - Derived values that are points, such as a people mover's `low_end` and `high_end`, are also given in world space, so a game never composes transforms.
  - A people mover's parameters hold its `direction` (`start_to_end` or `end_to_start`) and its unsigned belt `speed` in meters per second. Its derived values add `entry_end` and `exit_end`, where people step on and off, and `belt`, the speed signed positive toward the high end. Version 1 movers stored that signed `belt` as a parameter; the editor turns them into a direction and a speed when it loads them.

In Rust, `broom_bridge::prelude::CollisionDocument::read(level_directory)` parses the file into `CollisionPiece`, `CollisionFlagged` and `CollisionPlacement` values. `CollisionPiece::contains` tests a point, and `CollisionPlacement::transform` gives the world `Transform`.
