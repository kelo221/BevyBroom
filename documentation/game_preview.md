# Game Preview and Lights

BevyBroom can mirror the scene into your running Bevy game while you edit. The game shows your level with its own renderer (DynLight), its own materials and its own lights, and updates as you work.

The game side lives in a separate Rust workspace (`AiWorldEdBevy`): the `broom_bridge` crate that a game adds, and a ready-made `broom_preview` program. Its `README.md` explains how to add the bridge to your own game.

## Start the preview

1. Start the game or the preview program. From the editor folder:

   ```
   bun run preview:game C:\path\to\your\game\broom.project.json
   ```

   This reads the `preview` section of the project file and runs it (for the sample project that is `cargo run --release -p broom_preview`). You can also start the game yourself.

2. In the editor choose **Game > Game Preview…**.
3. Check the endpoint (default `http://127.0.0.1:15702`) and press **Connect**.

The panel shows what the game received and applied: state and geometry revisions, the number of lights, the bake state, how many game materials were loaded and the newest error the game reported.

If the game is not running yet the panel says it is retrying; it connects as soon as the game answers. When the game restarts, the editor notices and sends everything again, so you never get duplicate objects.

## What updates live

| Change in the editor                          | What the game does                                                                                                                                |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Moving, rotating, scaling, hiding objects     | Updates transforms and visibility immediately.                                                                                                    |
| Adding, editing, duplicating, deleting lights | Spawns, updates or removes the matching game light.                                                                                               |
| Moving a parent group                         | Children and lights inside it move with it.                                                                                                       |
| Editing geometry (brushes, CSG, faces, UVs)   | Rebuilds the level geometry once you release the mouse and the edit settles, then swaps it in. The old geometry stays until the new one is ready. |
| Undo and redo                                 | Treated like any other change.                                                                                                                    |

Geometry is sent as a GLB file that keeps every object's id and material id, and the game stores each revision as a new file. If a revision is broken, the game keeps showing the previous one and reports the error.

## Lights

Choose **Add > Lights > Point Light** or **Spot Light**. Lights appear as a small diamond marker you can click, select, move and rotate like any object. Thin lines show the light's range; spot lights also show their cone, pointing along the light's local −Z axis.

The Properties panel edits a selected light:

- **Type**: point or spot.
- **Enabled**: disabled lights stay in the scene but give no light.
- **Color** and **Intensity**: intensity does not change the range.
- **Radius**: in meters, where the light ends.
- **Falloff**: extra fading within the radius; 0 is physically based.
- **Inner / Outer** (spot lights): the cone angles in degrees from the axis.
- **Realtime**: realtime lights are never baked and can move freely in the game.
- **Shadows**: raytraced (baked) or realtime.

Lights are saved in the scene file, duplicate with `Ctrl+D`, and are left out of normal GLB exports because the game creates them itself.

## Rooms and portals

Rooms and portals let the game skip drawing (and lighting) whatever the camera cannot see through a doorway. DynLight calls this portal culling.

- **Add > Portals > Room** adds a room: a box drawn as a wireframe. Size it in the Properties panel with **Half size X / Y / Z** (meters from its center), then move, rotate and scale it like any object. Cover each walkable space with one room.
- **Add > Portals > Portal** adds a portal: a rectangle with an arrow on its front side. Set **Width** and **Height** in the Properties panel and place it in a doorway, in the wall between two rooms.
- **Closed** on a portal makes it a shut door: the game stops looking through it. Closing and opening doors updates the game live.

Moving rooms and portals or toggling a door never rebuilds the level geometry; only the room and portal data is sent.

DynLight joins rooms through portals by itself. Each room must reach the middle of the wall at every doorway it touches; if the rooms and portals do not fit together, the game turns culling off and the panel's **Rooms** line says **culling off** followed by DynLight's reason. When everything fits it says **culling active**. With no rooms in the scene culling is simply not used.

Rooms and portals are saved in the scene file and are exported to GLB as empty nodes the game can read (see [Saving, Loading, Importing, and Exporting](files_import_and_export.md)).

## Game materials

When connected, the texture browser shows the game's material catalog as **Game materials**. Assigning one of them to a face stores the game material id, and the game uses its own material for that face, including normal and metallic maps the editor does not show. When the catalog file or one of its textures changes on disk, both the game and the editor update in place.

## Preview bake

Moving static geometry or baked lights makes the game's baked shadows out of date; the panel then shows **Scene changed, bake needed**. Press **Preview Bake** to bake again. If you keep editing while the bake runs, its result is dropped instead of showing shadows for an older scene; this also applies to the very first bake of a level, which then reports **bake needed** rather than **No bake**.

Baked shadows use the second UV set (`TEXCOORD_1`) the editor writes on every exported mesh, so the game no longer falls back to the texture UVs.

## Saving

`Ctrl+S` saves to the file you last saved or opened, so a scene keeps the same document id and the game recognizes it after a restart. Browsers without file system access download a new file each time instead.

**File > Save As…** (`Ctrl+Shift+S`) saves a copy as a new document with its own id, so the game treats the copy and the original as two separate levels. If you cancel the dialog, nothing changes.

The game stores each level in a folder named after the scene file. When a document is saved under a new name, the game moves it to the new folder and deletes its own files (`geometry_*.glb` and `level.broom.json`) from the old one. It never deletes anything else, and never touches another document's folder.

If the game fails to load a geometry revision, the editor sends it once more. If that fails too, the error stays in the panel until the next geometry edit.
