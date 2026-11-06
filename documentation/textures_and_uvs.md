# Textures and UV Mapping

Texturing has two parts: choosing an image and controlling how that image is placed on the selected surfaces. Choosing happens in the floating **Texture Browser**. Placement happens in the **Face Edit Sheet**.

Face Select (`Shift+Tab`) opens the Face Edit Sheet. **Textures** on the view bar reopens it if you closed it. Open the Texture Browser with **Browse** in the right dock, **Browse…** in the Face Edit Sheet, or **View > Texture Browser**. See [Understanding the interface](understanding_the_interface.md).

## Open a texture folder

1. Open the **Texture Browser**.
2. Click **Open Folder…** next to the filter field.
3. Choose a local folder containing supported image files.
4. Approve browser access if prompted.

The browser shows the folder name, texture thumbnails, and the number of textures found. Hovering a tile reveals its relative path. Type in the **Filter** field to show only the textures whose name or path contains those words. If no folder is open, the browser displays an empty-state message.

For manageable projects, keep related textures in a dedicated folder with clear filenames. The editor scans the selected folder and presents eligible images.

When a game preview is connected, the browser also lists the game's material catalog as **Game materials**. Assigning one of them to a face stores the game material id, and the game uses its own material for that face.

## Apply a texture

For an entire ordinary mesh:

1. Use Object Select.
2. Select the mesh.
3. Click a texture in the Texture Browser.

For individual surfaces:

1. Enter Face Select with `Shift+Tab`.
2. Select one or more face regions.
3. Click a texture in the Texture Browser, or **Apply** in the Face Edit Sheet.

In Face Select, **right-click** a face to put the current texture on it, keeping that face's alignment. **Alt+right-click** applies the texture plus the alignment of the last face you lifted. The **Apply Current Texture** tool on the tools palette paints the current texture onto the selection, then stamps it onto the faces you click.

Solid-model brushes retain per-face texture information through CSG rebuilding where the surface can be traced through the result.

## Face attributes

The Face Edit Sheet **Material** tab edits the selected faces. The texture block shows a preview and the name of the selected surfaces' material, or **Multiple materials** when they differ, and reports the number of selected face regions it can edit.

If it says **No surfaces selected**, enter Face Select and choose a surface first.

The top row has **Texture scale** X and Y, **Texture shift** X and Y, and **Rotation**. The spinner arrows, Arrow Up and Arrow Down in a field, or the mouse wheel over a field step the value; hold `Shift` for ten steps or `Ctrl` for a tenth of a step. The **X** and **Y** buttons beside Shift shift that axis by a random whole number of texels. Below them are the **UV vectors (X Y Z)**. **Justify** fits or justifies the texture; **Align** projects it from the **World** axes or the **Face**.

## Alignment presets

The collapsed **More tools** section of the Face Edit Sheet offers:

- **Align to Floor** for upward-facing horizontal surfaces.
- **Align to Wall** for vertical surfaces.
- **Align to Ceiling** for downward-facing horizontal surfaces.
- **Reset UVs** to restore the default mapping.

These are quick starting orientations. Choose the closest surface type, then refine it with numeric values.

## Scale, offset, and rotation

The fields are arranged with an X (U) column and a Y (V) column:

- **Texture shift** X and Y slide the image across the surface.
- **Texture scale** X and Y control texture size or repetition along the two surface directions.
- **Rotation** turns the image on the surface in degrees.

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

The Material color in Object Properties tints a mesh. It is separate from the selected texture. A non-white tint can make the image appear darker or colored, so return the tint to white when you want the texture's original colors.

## Diagnosing texture problems

- **Texture is on the wrong faces:** return to Face Select and review the selected regions.
- **Texture is sideways:** use Align to Floor, Wall, or Ceiling, then adjust Rotation.
- **Pattern size differs after scaling:** review Stretch Lock.
- **Texture slides or sticks unexpectedly during movement:** review Pos Lock.
- **Texture looks tinted:** inspect Material color.
- **Browser is empty:** confirm that folder permission was granted and that supported image files exist in the selected folder.
