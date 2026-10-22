# Saving, Loading, Importing, and Exporting

BevyBroom distinguishes between an editable scene project and a model exported for another application.

## Save a scene

Choose **File > Save** or press `Ctrl+S`.

The scene format is the working project. It preserves editor-specific information such as:

- Object hierarchy and names.
- Geometry and transforms.
- Material and texture assignments.
- Solid models, brushes, operations, and ordering.
- UV data and other editing state needed to reconstruct the world.

The status bar displays the last saved filename when available.

After the first save, `Ctrl+S` writes to the same file again (in browsers with file system access); a loaded scene saves back to the file it came from. **File > New** forgets that file.

Choose **File > Save As…** or press `Ctrl+Shift+S` to save to a new file. The new file becomes a separate document with its own document id, and later `Ctrl+S` saves go to it. The original file keeps its id. Cancelling the dialog leaves the scene unchanged.

## Load a scene

Choose **File > Load** or press `Ctrl+O`, then choose a previously saved BevyBroom scene.

Loading replaces the active editing context with the loaded project. Save current work first if you may need it later.

After loading:

1. Inspect the hierarchy.
2. Frame a known object.
3. Check texture availability.
4. Confirm the active game profile before the next export.

## Import a VMF map

Choose **File > Import VMF…** and select a Valve Map Format file. Import converts supported brush geometry and surface information into BevyBroom's scene.

Large maps may show an import progress overlay. After import, review:

- Overall scale and orientation.
- Brush validity and CSG results.
- Materials that could not be matched to local images.
- Surface alignment.
- Hierarchy naming and organization.

VMF and BevyBroom do not share an identical internal representation, so treat import as the start of a verification pass, not as proof that every source detail translated perfectly.

## Export GLB

Choose **File > Export GLB** or press `Ctrl+Shift+E`.

GLB is a compact glTF model file for Blender, Godot, Unity, Unreal Engine, and other 3D applications. Export uses the active game profile to convert units and axes.

The export places coordinate conversion on a root node. Preserve that node hierarchy and root transform when importing the GLB. This is especially important for left-handed targets such as Unity and Unreal, where the root can contain a reflection.

Every exported mesh gets a second UV set (`TEXCOORD_1`) for baked lighting. Each flat region of a mesh is laid out once, at the same texel density everywhere, without overlaps and with padding between regions. Use it as the lightmap UV channel in your engine; the first UV set (`TEXCOORD_0`) stays the texture UVs.

Rooms and portals are exported as empty nodes without meshes, carrying glTF node extras that DynLight reads directly:

| Extras key               | Node                                                                        |
| ------------------------ | --------------------------------------------------------------------------- |
| `dynlight_room`          | A room cell: a box from −1 to +1 on each axis, sized by the node transform. |
| `dynlight_portal`        | A portal: a square from −1 to +1 in local XY, front side along local +Z.    |
| `dynlight_portal_closed` | Added to a portal that is closed.                                           |

Game components are written as node extras too, under `broom_components`: a map from each component's Rust type path to the fields that differ from the game's defaults. Game Entities are exported as empty nodes carrying only that key. A game reads them with the bridge's `BroomGltfComponentsPlugin` (see [Game components and data assets](game_components.md)).

Enabled lights are exported as empty nodes under the light's transform, carrying the DynLight light extras `dynlight_type`, `dynlight_color`, `dynlight_intensity`, `dynlight_radius`, `dynlight_falloff`, `dynlight_inner_cutoff`, `dynlight_outer_cutoff` and `dynlight_realtime`, plus `dynlight_effect`, `dynlight_fog` (the fog shape) and `dynlight_shimmer` when the light uses them. DynLight's glTF import turns them into lights, so an exported level is lit without the editor or the bridge. Settings that DynLight extras cannot carry yet (shadow mode, bounce, cookie, fog density and the effect's timing) keep DynLight's defaults; the level manifest written by the live preview carries all of them. A game that loads both an exported GLB and a level manifest of the same document gets each light twice, so ship one or the other.

Light markers, Game Entity markers and the editor's room and portal outlines are never exported as meshes.

## Target application notes

- **Godot:** use the right-handed Y-up profile and preserve the imported root transform.
- **Blender:** use the Blender profile when you want Z-up conversion and preserve the node hierarchy.
- **Unity:** preserve the mirrored root transform. Do not casually bake it into mesh data.
- **Unreal Engine:** use the centimeter-oriented profile and preserve the mirrored root transform.
- **Custom:** verify the selected right, up, and forward axes and the resulting handedness.

## Validate an export

Before exporting an entire production level, make a small asymmetric test:

1. Include an object with a clear front, top, and right side.
2. Apply a directional or asymmetric texture.
3. Place it away from the origin.
4. Export using the intended profile.
5. Import it into the target application without flattening the root hierarchy.
6. Check position, scale, front-face visibility, normals, texture orientation, and collision.

An asymmetric test reveals mirrored axes and reversed orientation far more clearly than a centered cube.

## Browser permissions

Browser builds use browser file and folder access. If saving or loading fails:

- Allow the browser's file picker and download prompts.
- Grant folder permission for texture browsing.
- Avoid private browsing modes that discard permissions aggressively.
- Try the standalone application if browser security policy blocks a required workflow.
