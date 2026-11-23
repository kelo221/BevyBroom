# Face Editing and Clipping

Face tools let you work with visible surface regions rather than whole objects. The Clip Plane tool cuts an object using a plane defined directly in the viewport.

## Enter Face Select

Press `Shift+Tab` or click the **Face Select** tool button in the tools palette. The status bar changes to Face selection and reports how many faces are selected.

Click a surface to select its face region. The selection modifiers work like Hammer:

- Click selects only that face.
- `Ctrl`+click toggles the face: it adds an unselected face and removes a selected one. A `Ctrl` drag keeps the choice of the first face it touches, so it either adds or removes every face it crosses.
- `Shift`+click selects only the whole brush the face belongs to.
- `Ctrl`+`Shift`+click adds the whole brush to the selection.
- Double-click expands the click to the whole brush and adds it, or removes it again when it is already selected.
- A plain drag paints more faces into the selection.

Right-click a face to apply the current texture. A right drag looks around in Perspective and pans the 2D views instead, without applying a texture. Work from a clear view so you do not accidentally select a front-facing surface when you intended one behind it.

Press `Tab` to return to Object Select.

## Edit Mode vertices, edges, and faces

Press `Tab` on a selected mesh or solid brush to enter Edit Mode. `1`, `2`, and `3` switch Vertex, Edge, and Face select. The options bar also has Blender-style **Mesh**, **Vertex**, **Edge**, and **Face** menus for Knife, Loop Cut, Merge, and Dissolve.

- `K` starts the knife: click an edge to insert a vertex. The new point stays on the edge, so a convex brush stays convex.
- `Ctrl+R` starts Loop Cut: hover an edge, click to lock that belt, slide along the locked edge, then click or Enter to confirm. Loop cuts only insert vertices on the locked belt edges.
- `M` opens Merge (At Center, At First, At Last, By Distance).
- `Delete` or `X` dissolves the current component selection. Brushes refuse an edit that would drop below a tetrahedron. A brush that is non-convex, has two faces with the same outward normal, or has two vertices at the same position stays editable and is left out of solid compilation until a later edit makes it valid again. Duplicating that brush leaves the copy out of compilation as well.
- Yellow warning triangles mark distinct vertices that share a position. Merge By Distance welds the current vertex selection. With nothing selected, By Distance welds every coincident cluster in the edit session. Moving two vertices together does not auto-weld.

Press `Tab` again to return to Object Mode.

## Extrude selected faces

1. Enter Face Select.
2. Select one or more suitable coplanar face regions.
3. Press `Shift+E` or click **Extrude** in the tool options on the view bar.
4. Drag to choose the extrusion depth.
5. Commit the interaction.

Extrusion creates new convex prism geometry while leaving the source geometry intact. This makes extrusion useful for adding ledges, panels, steps, or extensions without destroying the original object.

If extrusion is unavailable, confirm that at least one compatible face is selected and that Face Select is active.

## Clip Plane tool

The Clip Plane tool cuts the selected brushes and meshes with a plane you place in any view.

1. Select the brushes you want to cut.
2. Press `Shift+X`, click the **Clip Plane** tool button in the tools palette, or choose **Tools > Clip Plane**.
3. Drag a line across the brush in any view: press where the cut starts and release where it ends. Or click two points. A third click tilts the plane freely.
4. Check the preview, then press `Enter` or click **Apply**.

While you place the second point, the preview follows the pointer and shows the cut a click would make. In the 2D views you can start in empty space; points land on the view plane through the selection.

### Reading the preview

- The pale sheet with the yellow outline is the plane itself, a little larger than the selection. In a 2D view that looks along the plane it is a line across the brush.
- Red marks the piece the clip removes.
- Green arrows point from the cut into the piece that stays.
- With **Both**, the two pieces show in green and blue with an arrow into each.
- The round points are big handles: drag them to adjust the plane. A point under the pointer grows. Hold `Shift` while placing or dragging to skip grid snapping.

### Choosing what to keep

The **Keep** buttons in the tool options choose the pieces:

- **Side A** keeps the piece the plane normal points to.
- **Side B** keeps the other piece.
- **Both** splits the brush into two brushes and keeps both.

`Tab` cycles Side A, Side B and Both, the same way TrenchBroom does. Pressing `Shift+X` again while the tool is active cycles too, like Hammer. The choice stays for the next cut until you leave the tool.

### Clip keys

- `Shift+X` opens the tool; pressed again it cycles the kept side.
- `Tab` cycles the kept side.
- `Enter` applies the cut.
- `Escape` cancels the tool.

All of them can be changed in **Settings > Keyboard**.

## Placing a predictable plane

- Use Top, Front, or Side view for axis-aligned cuts: a line dragged there cuts straight into the view.
- Keep grid snapping on so the cut stays on grid points.
- Check the red piece in Perspective before applying.
- Cycle the kept side with `Tab` instead of placing the points again when only the kept side is wrong.

## Face selection for texturing

Face selection is also the basis for per-face texture assignment and UV editing. Select the intended face regions first, then use the **Face Edit Sheet** (it opens with Face Select; **Textures** on the view bar reopens it) or the **Textures** tab of the Browser. See [Textures and UV mapping](textures_and_uvs.md).
