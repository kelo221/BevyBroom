# Textures and UV Mapping

Texturing has two parts: choosing an image and controlling how that image is placed on the selected surfaces. Both happen in the inspector's **Face** tab: the face attributes at the top place the image, and the material browser below them chooses it. Click the **Face** tab or press `Ctrl+3` to show it.

## Open a texture folder

1. Show the inspector's **Face** tab.
2. Click **Open Folder…** next to the filter field of the material browser.
3. Choose a local folder containing supported image files.
4. Approve browser access if prompted.

The material browser shows the folder name, texture thumbnails, and the number of textures found. Hovering a tile reveals its relative path. Type in the **Filter** field to show only the textures whose name or path contains those words. If no folder is open, the browser displays an empty-state message.

For manageable projects, keep related textures in a dedicated folder with clear filenames. The editor scans the selected folder and presents eligible images.

## Apply a texture

For an entire ordinary mesh:

1. Use Object Select.
2. Select the mesh.
3. Click a texture in the material browser.

For individual surfaces:

1. Enter Face Select with `Shift+Tab`.
2. Select one or more face regions.
3. Click a texture in the material browser.

Solid-model brushes retain per-face texture information through CSG rebuilding where the surface can be traced through the result.

## Face attributes

The face attributes sit at the top of the **Face** tab. To show them from Face Select, you can also click **Face Inspector** in the tool options on the view bar. The top row shows a preview and the name of the selected surfaces' material, or **Multiple materials** when they differ, and reports the number of selected face regions it can edit.

If it says **No surfaces selected**, enter Face Select and choose a surface first.

## Alignment presets

The icon strip below the material row offers:

- **Align to Floor** for upward-facing horizontal surfaces.
- **Align to Wall** for vertical surfaces.
- **Align to Ceiling** for downward-facing horizontal surfaces.
- **Reset UVs** to restore the default mapping.

These are quick starting orientations. Choose the closest surface type, then refine it with numeric values.

## Scale, offset, and rotation

The fields are arranged in rows with an X (U) column and a Y (V) column:

- **Offset** X and Y slide the image across the surface. The `−¼` and `+¼` buttons shift it by a quarter tile.
- **Scale** X and Y control texture size or repetition along the two surface directions. The `½` and `×2` buttons halve or double the scale.
- **Rotation** turns the image on the surface in degrees. The `−90` and `+90` buttons turn it a quarter turn.

Commit a changed field to apply it. When several surfaces are selected, the change applies across the target regions, and a field whose value differs between them shows a dash until you enter a value.

The U and V directions belong to the surface, not necessarily to world X and Y. If a texture moves in an unexpected screen direction, remember that you are editing the surface's own 2D coordinate system.

## Interactive UV transform (Face Select)

With Face Select active and one or more faces selected:

- **Drag a selected face** (without Shift or Ctrl) to slide the texture so it tracks the mouse on the surface.
- **G** starts single-use UV Move (confirm with click or Enter; Escape cancels).
- **R** starts single-use UV Rotate about the hit point under the cursor.
- **S** starts single-use UV Scale about that same pivot.

Grid snap applies to position, rotation, and scale. Hold **Shift** after a transform has started to temporarily disable snap for free adjustment.

## UV smear

UV smear transfers continuous texture layout across neighboring faces while you paint. Hold **M** and drag across faces so textures match at shared edges (arches, corridors, multi-face walls).

For exact repeating architectural materials, the numeric face attributes are usually more predictable. For quickly lining up a visible feature, interactive slide or smear can be faster.

## Position Lock and Stretch Lock

The toolbar and the **Tools** menu separate two texture behaviors:

- **Pos Lock** controls whether UVs stick to the object as it moves or rotates. When it is off, the surface can slide through world-aligned texture space.
- **Stretch Lock** controls scaling behavior. When it is on, the existing UV layout stretches with the object; when it is off, the editor preserves tile density by rebaking the mapping.

Examples:

- Turn on Pos Lock when a painted sign or unique detail must remain attached while the object moves.
- Turn off Pos Lock for world-aligned walls whose pattern should stay anchored in the level.
- Turn on Stretch Lock when scaling should visibly stretch the image.
- Turn off Stretch Lock when bricks or tiles should remain roughly the same world size after resizing.

## Material color

The Material color in Properties tints a mesh. It is separate from the selected texture. A non-white tint can make the image appear darker or colored, so return the tint to white when you want the texture's original colors.

## Diagnosing texture problems

- **Texture is on the wrong faces:** return to Face Select and review the selected regions.
- **Texture is sideways:** use Align to Floor, Wall, or Ceiling, then adjust Rotation.
- **Pattern size differs after scaling:** review Stretch Lock.
- **Texture slides or sticks unexpectedly during movement:** review Pos Lock.
- **Texture looks tinted:** inspect Material color.
- **Browser is empty:** confirm that folder permission was granted and that supported image files exist in the selected folder.
