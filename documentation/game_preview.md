# Game Preview and Lights

BevyBroom can mirror the scene into your running Bevy game while you edit. The game shows your level with its own renderer (DynLight), its own materials and its own lights, and updates as you work.

The game side lives in the Rust workspace in `bevy/` of this repository: the `broom_bridge` crate that a game adds, and a ready-made `broom_preview` program. Its `README.md` explains how to add the bridge to your own game.

## Start the preview

1. Start the game or the preview program. From the editor folder:

   ```
   bun run preview:game C:\path\to\your\game\broom.project.json
   ```

   This reads the `preview` section of the project file and runs it (for the sample project that is `cargo run --release -p broom_preview`). You can also start the game yourself.

2. In the editor choose **Run > Game Preview…**.
3. Check the endpoint (default `http://127.0.0.1:15702`) and press **Connect**.

The panel shows what the game received and applied: state and geometry revisions, the number of lights, the bake state, how many game materials were loaded and the newest error the game reported.

If the game is not running yet the panel says it is retrying; it connects as soon as the game answers. When the game restarts, the editor notices and sends everything again, so you never get duplicate objects.

## What updates live

| Change in the editor                          | What the game does                                                                                                                                |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Moving, rotating, scaling, hiding objects     | Updates transforms and visibility immediately.                                                                                                    |
| Adding, editing, duplicating, deleting lights | Spawns, updates or removes the matching game light.                                                                                               |
| Adding, editing, removing game components     | Inserts, updates or removes the component on the matching game entity.                                                                            |
| Moving a parent group                         | Children and lights inside it move with it.                                                                                                       |
| Editing geometry (brushes, CSG, faces, UVs)   | Rebuilds the level geometry once you release the mouse and the edit settles, then swaps it in. The old geometry stays until the new one is ready. |
| Undo and redo                                 | Treated like any other change.                                                                                                                    |

Geometry is sent as a GLB file that keeps every object's id and material id, and the game stores each revision as a new file. If a revision is broken, the game keeps showing the previous one and reports the error.

## Lights

Choose **Add > Lights > Point Light** or **Spot Light**. A light shows as a small translucent box in its own color, with its icon inside: a bulb for point lights and a spotlight for spot lights. Click the box to select the light, then move and rotate it like any object; dragging inside the box moves the light in every view, including up and down in the front and side views. While a light is selected, thin lines show its range; spot lights also show their cone, pointing along the light's local −Z axis, at any angle up to 179°, and lights with fog show its outline. Unselected lights show only their box. The box, its icon and the orange balls show in the 3D view and in the top, front and side views.

A selected light shows orange balls you drag to size it:

- **Radius ball**: on the range circle of a point light, always to the right of the light in each view. On a spot light it sits at the tip of the cone's axis, and moves to the right of the light when the axis points straight at you. Drag it to set the **Radius**.
- **Cone ball** (spot lights): on the rim of the cone. Drag it to set the **Outer** angle; the **Inner** angle keeps its share of the outer one.

With grid snapping on, the radius snaps to the grid step and the cone angle to the rotation step. A drag updates the light and the game while you move, `Esc` cancels it, and one undo restores it. Locked lights show no balls.

Lights are not scaled, and their box has no resize bars. Scaling a light with `S`, the scale gizmo or typed values changes its **Radius** instead, and the light keeps a scale of 1; one undo restores both. The Scale fields are hidden when only lights are selected. Scenes saved with a scaled light load with that scale turned into the radius, which is what the game already showed.

The fog radius follows the light: dragging the radius ball, scaling, or typing a new **Radius** (also through the MCP `set_light_settings` tool) changes the fog radius by the same factor. Set the fog radius on its own in the **Fog** group.

The Properties panel edits a selected light. The main fields are always shown:

- **Type**: point or spot.
- **Enabled**: disabled lights stay in the scene but give no light.
- **Color** and **Intensity**: intensity does not change the range.
- **Radius**: in meters, where the light ends.
- **Falloff**: extra fading within the radius; 0 is physically based.
- **Inner / Outer** (spot lights): the cone angles in degrees from the axis.
- **Realtime**: realtime lights are never baked and can move freely in the game.
- **Shadows**: raytraced (baked) or realtime.

Click a group header to open DynLight's light features:

| Group       | Settings                                                                                                                                                                                                           |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Effect**  | An intensity animation: steady, pulse, random, strobe, flicker, three fluorescent tubes, candle, pulsar, fire, generator, lightning, cloudy or overcast, with speed, minimum, offset and step.                     |
| **Cookie**  | Spot lights only: an image the light projects, like a gobo. When connected, the picker lists the game's image files (png, jpg, jpeg).                                                                              |
| **Fog**     | Volumetric fog in the light's color: shape (sphere, box, cone along the light, cone along its up axis, or a shaft), radius, thickness, opacity and clear distance. The viewport draws its outline as dashed lines. |
| **Shimmer** | Moving light patterns: none, water (like caustics) or random (like firelight), with scale and minimum.                                                                                                             |
| **Baking**  | Illumination (direct, or with one baked bounce), transparency, and the bounce light's tint, strength, samples and storage.                                                                                         |

Things to know:

- A cookie only shows on a spot light whose **Outer** angle is 90° or less; the Cookie group says so when the cone is wider. The image must be inside the game's assets folder.
- Fog only shows on cameras with DynLight's `FogPostProcess` component. The preview program adds it; add it to your game's camera too.
- Effect, cookie, fog, shimmer and the bounce light's visibility change live and never make the bake out of date. Illumination, transparency and the other bounce settings are baked, so changing them asks for a new bake.

Lights are saved in the scene file, duplicate with `Ctrl+D`, and are left out of normal GLB exports because the game creates them itself. Shipped levels carry every light setting in the level manifest.

## Rooms and portals

Rooms and portals let the game skip drawing (and lighting) whatever the camera cannot see through a doorway. DynLight calls this portal culling.

- **Add > Portals > Room** adds a room: a box drawn as a wireframe, with a small box and floor plan icon at its center that you click to select it. A selected room's selection box is the whole room, so its resize bars resize the room. Size it exactly in the Properties panel with **Half size X / Y / Z** (meters from its center), then move, rotate and scale it like any object. Cover each walkable space with one room.
- **Add > Portals > Portal** adds a portal: a rectangle with an arrow on its front side. Set **Width** and **Height** in the Properties panel and place it in a doorway, in the wall between two rooms.
- **Closed** on a portal makes it a shut door: the game stops looking through it. Closing and opening doors updates the game live.

Moving rooms and portals or toggling a door never rebuilds the level geometry; only the room and portal data is sent.

DynLight joins rooms through portals by itself. Each room must reach the middle of the wall at every doorway it touches; if the rooms and portals do not fit together, the game turns culling off and the panel's **Rooms** line says **culling off** followed by DynLight's reason. When everything fits it says **culling active**. With no rooms in the scene culling is simply not used.

Rooms and portals are saved in the scene file and are exported to GLB as empty nodes the game can read (see [Saving, Loading, Importing, and Exporting](files_import_and_export.md)).

## Game components

The game reports the components it registered for placement. They appear under **Add > Game Entities** and in the **Game Components** section of the Properties panel, with the game's own fields and defaults. Adding, editing and removing components updates the game live, also on brushes, and a component stays on a brush when its geometry is rebuilt. Data asset files are edited through the game, which writes and reloads them. See [Game components and data assets](game_components.md).

## Game materials

When connected, the material browser in the inspector's **Face** tab shows the game's material catalog as **Game materials**. Assigning one of them to a face stores the game material id, and the game uses its own material for that face, including normal and metallic maps the editor does not show. When the catalog file or one of its textures changes on disk, both the game and the editor update in place.

## Preview bake

Moving static geometry or baked lights makes the game's baked shadows out of date; the panel then shows **Scene changed, bake needed**. Press **Preview Bake** to bake again. If you keep editing while the bake runs, its result is dropped instead of showing shadows for an older scene; this also applies to the very first bake of a level, which then reports **bake needed** rather than **No bake**.

Baked shadows use the second UV set (`TEXCOORD_1`) the editor writes on every exported mesh, so the game no longer falls back to the texture UVs.

## Saving

`Ctrl+S` saves to the file you last saved or opened, so a scene keeps the same document id and the game recognizes it after a restart. Browsers without file system access download a new file each time instead.

**File > Save As…** (`Ctrl+Shift+S`) saves a copy as a new document with its own id, so the game treats the copy and the original as two separate levels. If you cancel the dialog, nothing changes.

The game stores each level in a folder named after the scene file. When a document is saved under a new name, the game moves it to the new folder and deletes its own files (`geometry_*.glb` and `level.broom.json`) from the old one. It never deletes anything else, and never touches another document's folder.

If the game fails to load a geometry revision, the editor sends it once more. If that fails too, the error stays in the panel until the next geometry edit.
