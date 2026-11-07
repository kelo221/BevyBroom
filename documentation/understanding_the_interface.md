# Understanding the Interface

The main window is arranged like Hammer++. From top to bottom and left to right
it has:

1. The **menu bar** with the File, Edit, Add, Tools, View, Run, and Help menus.
2. The **toolbar**, one row of icon buttons and quick controls.
3. The **tools palette**, a vertical column of tool buttons on the left edge.
4. The **view column** in the center: a view bar above four viewports.
5. The **right dock** with the selection filter, the current texture, VisGroups,
   prefabs, and the Map section with layers and the outliner.
6. The **info panel** docked below the viewports, with Console and Issues tabs.
7. The **status bar** along the bottom edge.

Detailed editing happens in floating windows that open above the workspace:
the **Object Properties** dialog, the **Face Edit Sheet**, the **Texture
Browser**, **Replace Textures**, and the **Entity Browser**.

## Menu bar

- **File** starts a new scene; saves, saves as, and loads BevyBroom scenes;
  imports VMF and OBJ files; exports GLB, OBJ/MTL, and FBX models; and opens
  **Preferences…** (the Settings dialog).
- **Edit** has Undo and Redo; Cut, Copy, Paste, and Paste at Original
  Position; Duplicate and Delete; **Object Properties** (`Alt+Enter`); Select
  All, Select None, and a **Select** submenu; Group and Ungroup; a **CSG**
  submenu that performs Union, Subtract, or Intersect on suitable selected
  meshes; and an **Align** submenu that moves the selection to the origin, the
  grid center, or another object.
- **Add** organizes creation commands into flyout menus such as **Geometry**,
  **Terrain**, **Brushes**, **Lights**, **Portals**, and **Game Entities**. The
  new object is created using the current placement context and selected.
- **Tools** chooses a tool; toggles Snap to Grid, Position Lock, and Stretch
  Lock; chooses Global or Local gizmo axes; and opens the **Solid Model…**
  panel.
- **View** has a **Grid** submenu for the grid size, commands that frame the
  selection in one or all views, **Cycle View** and **Maximize View**, Hide
  Selected, Isolate Selected, and Show All, **Map Inspector** (`Ctrl+1`), the
  **Texture Browser** and **Entity Browser** windows, **Show Inspector**,
  **Show Info Panel**, **Show Toolbar**, and **Show Tools Palette**, and
  **Detached Viewport…**.
- **Run** starts **Play** mode and opens the **Game Preview…** panel.
- **Help** opens this **Documentation**, the **About BevyBroom…** dialog, the
  **MCP Server…** dialog, and the **AI Captures (Debug)…** panel, and switches
  **Editor Sounds** on or off.

Menu rows show their current keyboard shortcut, and a check mark shows an
option or panel that is currently on. A disabled menu item means the current
selection does not meet that action's requirements. For example, mesh CSG
requires a compatible selection, and Object Properties requires a selection. An
open menu appears over the viewport so every option remains visible and
clickable. While one menu is open, moving across the other menu names switches
between them.

## Toolbar

From left to right the toolbar holds:

- Undo and redo.
- **Duplicate**, **Flip Horizontally**, and **Flip Vertically**.
- **Group**, **Ungroup**, and **Ignore Groups**. Group puts the selection into
  a new group and Ungroup dissolves the selected groups. While **Ignore
  Groups** is highlighted, clicks in the viewports select the objects inside
  groups instead of the whole group.
- The **Snap** toggle and the **Grid** dropdown, which shows the current grid
  size (for example **Grid 1.0**) and lists every preset size.
- **Global** and **Local** gizmo axes.
- **Pos Lock** and **Stretch Lock** texture behavior controls.
- The **MCP** server button on the far right, highlighted while the
  server runs.

Hover over an icon to display its name. A highlighted control is active.
See the [Toolbar](toolbar.md) page for resizing and labels, and the
[Glyph reference](glyph_reference.md) for numbered visual examples and a
description of every icon.

Hide or show the toolbar with **View > Show Toolbar** or `Ctrl+Alt+T`.

## Tools palette

The tools palette is the narrow column on the left edge of the window. Each
button activates one tool; hover over a button to read its name and shortcut.
From top to bottom:

- **Object Select** (`O`) selects whole objects and moves, rotates, and scales
  them. `Tab` switches between Object and Edit Mode.
- **Entity Tool** (`Shift+E`) places the active entity class, chosen on the
  view bar or in the Entity Browser.
- **Block Tool** (`Shift+B`) draws a new convex brush in the active shape:
  Cuboid, Stairs, Arch, Cylinder, Cone, Spheroid (UV), or Spheroid (Icosahedron).
- **Face Select** (`Shift+Tab`) selects faces for texturing and opens the Face
  Edit Sheet. **Textures** on the view bar reopens it. A click selects one
  face, `Ctrl`+click toggles a face, `Shift`+click selects the whole brush, and
  `Ctrl`+`Shift`+click adds the whole brush.
- **Apply Current Texture** (`Shift+T`) paints the current texture onto the
  selection, then stamps it onto the faces you click.
- **Clip Plane** (`Shift+X`) cuts brushes along a plane you place.
- **Vertex Tool** (`Shift+V`) edits the vertices of the selection.
- **Polygon Tool** draws a 2D outline and extrudes it into convex solids.
- **Sprinkle Tool** scatters entities or prefabs with a radius, a density,
  seeded randomness, and an orientation.
- **Grid** aligns the grid and camera orientation to a face or edge.

In Edit Mode the palette shows only the tools that work there. Hide or show the
palette with **View > Show Tools Palette**.

## View bar

The view bar sits directly above the viewports. Its left side shows the options
of the active tool, such as the Bounds, Move, Rotate, and Scale transform modes
for Object Select, the **Textures** and **Extrude** actions for Face
Select, the class picker and **Browse** button of the Entity Tool, or **Flip**,
**Clip**, and **Split** for Clip Plane. Hover over an option to read what it
does. Its right side holds the workspace tabs, which switch between saved
viewport arrangements such as **Quad View** and **Single Perspective**.

## The four viewports

The default **Quad View** workspace divides the center into a 2 × 2 grid of
views, in reading order: Perspective, Top, Front, and Side. Each viewport
has a small header containing:

- The view name, which opens a menu to switch the view to Top, Front, Side, or
  Perspective.
- An axis caption that names the plane the view looks at: **top (x/z)**,
  **front (x/y)**, **side (z/y)**, or **camera** for the 3D view.
- Toggles for content and brush wireframes and for the projected surface grid.
- Solid, Wireframe, Flat, and Wireframe Overlay shading buttons.
- A Fit button that frames the selection in that view, and a maximize button.

Shading changes how you inspect the scene; it does not change exported material
data.

The orthographic views are valuable for alignment and exact silhouette work because they remove perspective distortion. The Perspective view is better for judging space, depth, and the experience of moving through the level.

Two shortcuts act on the view under the pointer:

- `Space` cycles that view through Perspective, Top, Front, and Side and frames
  the selection in the new view.
- `Ctrl+Space` maximizes that view, and pressing it again restores your
  previous pane layout. The square-corners button in a viewport header does the
  same.

## Right dock

The right dock is a column of compact Hammer++ style sections above the Map
section. Hide or show the whole dock with **View > Show Inspector** or
`Ctrl+5`.

### Select and current texture

- **Select:** with **Groups**, **Objects**, and **Solids** sets what a click in
  a viewport selects: the outermost group, the object under its group, or the
  single brush that was hit.
- **Current texture:** shows a thumbnail, the name, and the size of the texture
  that new brushes and **Apply Current Texture** use. **Browse** opens the
  Texture Browser and **Replace** opens Replace Textures with the current
  texture filled in.

### VisGroups

VisGroups hide and show related objects together without moving them in the
hierarchy. The **VisGroups:** section has three tabs:

- **User** lists the groups you create. The checkbox in front of a group shows
  or hides its members.
- **Auto** lists groups the editor builds by kind: **World Geometry** with
  **Solids** and **Content Meshes**, and **Entities** with **Lights**, **Rooms
  & Portals**, and **Game Entities**.
- **Cordon** has **Toggle Cordon Active** and **Fit Cordon to Selection**,
  which limit the visible map to a box.

Below the lists, **Show** toggles the highlighted group, **Edit** creates a new
user group named **Group N** that holds the selection, and **Mark** selects the
visible members of the highlighted group. Creating a group and assigning the
selection is one undo step.

### Move selected and prefabs

- **Move selected:** **toEntity** ties the selected brushes to an entity: a
  single group keeps its place, several objects are wrapped in a new group, and
  the result receives a game component. **toWorld** turns entities back into
  plain world geometry by removing their game components and outputs.
- **Categories:** and **Objects:** pick a saved prefab. Type a name into
  **Prefab name...** and choose **Create Prefab** to save the selection as a
  prefab, or choose **Insert** to place the picked prefab.

### Map section

The Map section fills the rest of the dock with the [Layers](layers.md) list
above the outliner. Drag the splitter between them to give one more room.

The outliner shows how scene objects are organized. It is more than a list:

- Click an item to select it.
- Expand or collapse groups and solid models.
- Drag objects to change their parent.
- Toggle visibility to temporarily hide geometry.
- Toggle locking to protect an object from edits.
- Double-click a name to rename it.
- Right-click for object actions such as duplicate, delete, group, or ungroup.

Selecting a parent can represent a larger hierarchy. Be aware of this before deleting or transforming a group.

## Object Properties

Press `Alt+Enter`, choose **Edit > Object Properties**, or double-click an
object to open the Object Properties dialog on the selection. Double-clicking
works on any selectable object (brush, entity, light, room, portal) in any
viewport while the object selection tool is active; it selects the object
first, unless the object is already part of a multi-selection, in which case
the dialog opens on the whole selection. Double-clicking empty space does
nothing, and Face mode keeps its own double-click (selecting every face of a
brush). Its title names the object, or the number of selected objects. Edits
show live in the viewports and in a connected game while the dialog is open.

- **Apply** closes the dialog and keeps every edit made in it as **one** undo
  step.
- **Cancel**, the `×` button, or `Escape` closes the dialog and restores the
  state from before it opened, without adding history.
- `Ctrl+Z` and `Ctrl+Y` step through the edits made in the dialog while it is
  open.
- Selecting another object while the dialog is open applies the edits so far
  and continues with the new selection.
- **Copy** and **Paste** at the top copy the game components of the first
  selected object and paste them onto every selected object.

The dialog has these tabs:

- **Class Info** shows the name, the game component classes with their fields,
  a **Help** box that describes each class and its outputs and inputs, the
  angles with a compass dial and **Point At**, and free-form comments.
- **Outputs** lists the entity I/O connections the object fires. Each row
  shows **My Output**, **Target Entity**, **Via This Input**, **With
  Parameter**, **After Delay**, and **Only Once**. A row whose target matches
  no object is drawn red with a `!` badge; a target that matches several objects
  (for example `door_*`) is drawn bold. Select a row to edit it below the table:
  pick or type the output, type the target or pick it in a viewport with the
  eyedropper button, choose **Mark** to select every object the target matches,
  pick or type the input (the target classes' inputs plus **Enable**,
  **Disable**, and **Cancel**, which every named object accepts), and set the
  parameter, the delay in seconds, and **Once**. **Add**, **Copy**, **Paste**,
  and **Delete** manage the rows; copied rows can be pasted onto another object.
- **Inputs** lists, read only, every connection in the map that targets this
  object: **Source**, **Output**, **My Input**, **Delay**, **Once**, and
  **Parameter**. **Mark** selects the source of the highlighted row;
  double-clicking a row selects its source and frames it in the views.
- **Properties** shows the transform and the object-specific sections such as
  light, room, portal, and solid model settings. Shared values are shown
  normally and differing values as a dash; entering a value changes it across
  the editable selection. Locked objects are not edited.
- **VisGroup** has a checkbox for every user VisGroup that adds the selection
  to it or removes it.

See [Game components](game_components.md) for game classes and entity I/O.

## Floating windows

Floating windows open above the workspace. Reposition one by dragging its title
bar and close it with its `×` button. Closing a window does not delete scene
data. The Face Edit Sheet, Texture Browser, Replace Textures, and Entity Browser
open centered the first time, then reopen where you last left them during the
session.

### Face Edit Sheet

The Face Edit Sheet opens when you choose **Face Select**, and the view bar
reopens it after you close it. It edits the selected faces and has two tabs:

- **Material** follows the Hammer layout. The top row has **Texture scale** X
  and Y, **Texture shift** X and Y (the **X** and **Y** buttons beside them
  shift that axis by a random whole number of texels, which breaks up repeated
  faces such as stair steps), and **Rotation**. The spinner arrows, Arrow Up
  and Arrow Down in a field, or the mouse wheel over a field step the value;
  hold `Shift` for ten steps or `Ctrl` for a tenth of a step. Below them are
  the **UV vectors (X Y Z)**. The **Justify** box fits (**Fit**) or justifies
  (**T**, **L**, **C**, **R**, **B**) the texture. The **Align** box projects
  it from the **World** axes or the **Face**. Beside them are **Treat as one**,
  the **Mode** button, and **Hide mask**. The texture block shows the current
  texture with **Mark…**, **Browse…**, and **Replace…**, and **Apply** paints
  it onto the selection. The **Current texture** list picks the current
  texture. The collapsed **More tools** section holds the extra tools: Tile
  ±U/±V (whole-tile shifts), Fit H/V, Align ◀/▶, Flip, Rot ±90, Align Floor /
  Wall / Ceiling, Reset UVs / World, shear, and the offset and scale nudges.
- **Displacement** turns the selected faces into sculptable displacements:
  choose a **Power** and **Create** (or **Destroy**), then **Subdivide**,
  **Invert Alpha**, **Sew** neighboring edges together, **Smooth**, and add
  **Noise** between **Min** and **Max** with a **Seed**. **Elevation** and
  **Scale** adjust the whole surface, and the paint settings sculpt it with the
  pointer.

The **Mode** button cycles what a left click on a face does in Face Select:

- **Lift+Select** lifts the face (its texture becomes the current texture and
  its alignment is remembered) and selects it.
- **Lift** only lifts the face.
- **Select** only selects the face.
- **Apply (texture only)** paints the current texture on the face and keeps
  the face's alignment.
- **Apply (texture + values)** paints the current texture with the lifted
  alignment, continued across the shared edge so the texture flows on.
- **Align to View** projects the current texture onto the face from the
  camera like a slide projector, at the face's current texture scale.

In every mode, **right-click** a face to apply the current texture to it
(texture only), and **Alt+right-click** to apply the texture with the lifted
alignment. Align one face, lift it, then Alt+right-click the neighboring faces
one by one so the texture continues across them. Dragging with the right
button still moves the camera. `Alt+click` copies the material and alignment of
the primary selected face onto the clicked face. The **Apply Current Texture**
tool paints the current texture on the selection when you choose it, then
stamps it on every face you click.

See [Textures and UV mapping](textures_and_uvs.md).

### Texture Browser

The Texture Browser shows the face attributes of the current material above a
grid of every material. Type in its filter to match material names and paths;
click a material to make it current. Open it with **Browse** in the right dock,
**Browse…** in the Face Edit Sheet, or **View > Texture Browser**.

### Replace Textures

Replace Textures swaps one texture for another. Choose the texture to
**Find**, the one to **Replace** it with, and whether to search the
**Selected objects** or **Everything**; the dialog reports how many faces
changed. Open it with **Replace** in the right dock or **Replace…** in the
Face Edit Sheet.

### Entity Browser

The Entity Browser shows a thumbnail tile for every kind of object the **Add**
menu can create, including the game's entity classes when a game is connected.
Open it with **Browse** on the Entity Tool's view bar or **View > Entity
Browser**.

- Drag a tile onto a viewport to place that object where you drop it.
- Click a tile to select it, then double-click it or press `Enter` to add the
  object the same way the Add menu does.
- The dropdown sorts the tiles by **Name** or **Category**. **Group** shows the
  tiles under category headers, **Used** shows only the kinds used in this map,
  and the **Search** field filters the tiles by name.

A tile's number badge shows how many objects of that kind the map contains.

### Other panels

**Tools > Solid Model…**, **Run > Game Preview…**, and **Help > AI Captures
(Debug)…** also open as floating panels. **Solid Model** shows the active model
and provides a quick **+ Box Brush** action.

## Info panel

The info panel is docked below the viewports. Hide or show it with **View >
Show Info Panel** or `Ctrl+4`.

It starts folded to a one-line strip that shows the **Console** and **Issues**
tabs, the newest console line in its severity color, and count badges for
issues, console errors, and console warnings. A new error line or a new issue
briefly pulses its badge without unfolding the panel. Click a tab, a badge, or
the newest line to unfold the panel to its last height; click the shown tab of
an unfolded panel to fold it again. The viewports take the space the folded
panel frees.

- **Console** lists status messages, errors, and game preview connection
  changes as they happen. Right-click it and choose **Clear** to empty it.
- **Issues** lists problems found in the map, such as invalid solid brushes,
  solid model warnings, and game components whose class the game does not
  know. The list updates shortly after each edit. Click an issue to select its
  object and frame it in every view.

## Arranging the main window

Drag the splitter at the inner edge of the right dock or the info panel to
resize it. The editor remembers which docks, the tools palette, and the toolbar
are shown, their sizes, and their selected tabs between sessions. AI assistants
connected through MCP can read and change this arrangement with the
`get_main_window` and `set_main_window` tools, measure the views, the info
panel, and the right dock with `get_shell_layout`, and open, apply, or cancel the
Object Properties dialog with `get_object_properties_dialog` and
`set_object_properties_dialog`; see the [AI tools reference](../src/ai/README.md).

## Status bar

The bottom bar is the quickest way to confirm the editor's state. It reports:

- Available undo and redo counts.
- Recent action or error feedback.
- Object or face selection mode.
- Active transform mode.
- Whether snapping is enabled and its interval.
- Current alignment axis restriction.
- Current shading mode.
- Last saved filename when available.

If an action appears to do nothing, check this bar first. It often explains that the wrong selection type is active, no suitable object is selected, or another tool owns the current input.
