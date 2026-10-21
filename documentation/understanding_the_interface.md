# Understanding the Interface

The main window is arranged like a classic map editor. From top to bottom it has:

1. The **menu bar** with the File, Edit, Add, Tools, View, Run, and Help menus.
2. The **toolbar**, one row of icon buttons and quick controls.
3. The **view column** in the center: a view bar above the viewports.
4. The **inspector** docked on the right, with Map, Entity, and Face tabs.
5. The **info panel** docked below the viewports, with Console and Issues tabs.
6. The **status bar** along the bottom edge.

## Menu bar

- **File** starts a new scene; saves, saves as, and loads BevyBroom scenes;
  imports VMF and OBJ files; exports GLB, OBJ/MTL, and FBX models; and opens
  **Preferences…** (the Settings dialog).
- **Edit** has Undo and Redo, Duplicate and Delete, Select All and Select None,
  Group and Ungroup, a **CSG** submenu that performs Union, Subtract, or
  Intersect on suitable selected meshes, and an **Align** submenu that moves the
  selection to the origin, the grid center, or another object.
- **Add** organizes creation commands into flyout menus such as **Geometry**,
  **Terrain**, **Brushes**, **Lights**, **Portals**, and **Game Entities**. The
  new object is created using the current placement context and selected.
- **Tools** chooses Object Select, Face Select, Clip Plane, or Grid; toggles Snap
  to Grid, Position Lock, and Stretch Lock; chooses Global or Local gizmo axes;
  and opens the **Solid Model…** panel.
- **View** has a **Grid** submenu for the grid size, commands that frame the
  selection in one or all views, **Cycle View** and **Maximize View**, commands
  that show the Map, Entity, or Face inspector tab, toggles for the inspector,
  the info panel, and the toolbar, and **Detached Viewport…**.
- **Run** starts **Play** mode and opens the **Game Preview…** panel.
- **Help** opens this **Documentation**, the **About BevyBroom…** dialog, the
  **MCP Server…** dialog, and the **AI Captures (Debug)…** panel, and switches
  **Editor Sounds** on or off.

Menu rows show their current keyboard shortcut, and a check mark shows an
option or tab that is currently on. A disabled menu item means the current
selection does not meet that action's requirements. For example, mesh CSG
requires a compatible selection. An open menu appears over the viewport so
every option remains visible and clickable. While one menu is open, moving
across the other menu names switches between them.

## Toolbar

From left to right the toolbar holds:

- Undo and redo.
- The tool buttons: Object Select, Face Select, Clip Plane, and Grid.
- The **Snap** toggle and the **Grid** dropdown, which shows the current grid
  size (for example **Grid 1.0**) and lists every preset size.
- **Global** and **Local** gizmo axes.
- **Pos Lock** and **Stretch Lock** texture behavior controls.
- The **MCP** server button on the far right, highlighted orange while the
  server runs.

Hover over an icon to display its name. An orange-highlighted control is active.
See the [Glyph reference](glyph_reference.md) for numbered visual examples and a description of every icon.
Drag the bottom edge of the toolbar up or down to resize it. It snaps to three
states: small, medium, and large. Small uses compact 16 × 16 icons. Medium is
the default and uses 25 × 25 icons. Both states fit closely around their
controls instead of reserving an unused row. When **Settings > View > User
Interface > Expanded toolbar button labels** is enabled, large replaces the
quick-access icons with their action names. Disable that setting to retain
icons in the large state.

Hide or show the toolbar with **View > Show Toolbar** or `Ctrl+Alt+T`.

## View bar

The view bar sits directly above the viewports. Its left side shows the options
of the active tool, such as the Bounds, Move, Rotate, and Scale transform modes
for Object Select, the **Face Inspector** and **Extrude** actions for Face
Select, or **Flip**, **Clip**, and **Split** for Clip Plane. Hover over an
option to read what it does. Its right side holds the workspace tabs, which
switch between saved viewport arrangements such as **Quad View** and **Single
Perspective**.

## The four viewports

The default **Quad View** workspace divides the center into four views:
Perspective at the top left, Top at the top right, Side at the bottom left, and
Front at the bottom right. Each viewport has a small header containing:

- The view name.
- Solid, Wireframe, and Flat shading buttons.
- A Fit button that frames the selection in that view.

The keyboard shading shortcuts also include a fourth Wireframe Overlay mode. Shading changes how you inspect the scene; it does not change exported material data.

The orthographic views are valuable for alignment and exact silhouette work because they remove perspective distortion. The Perspective view is better for judging space, depth, and the experience of moving through the level.

Two shortcuts act on the view under the pointer:

- `Space` cycles that view through Perspective, Top, Front, and Side and frames
  the selection in the new view.
- `Ctrl+Space` maximizes that view, and pressing it again restores your
  previous pane layout. The square-corners button in a viewport header does the
  same.

## Inspector

The inspector is docked on the right and has three tabs. Click a tab, or press
`Ctrl+1`, `Ctrl+2`, or `Ctrl+3` to show the Map, Entity, or Face tab. Hide or
show the whole inspector with **View > Show Inspector** or `Ctrl+5`.

- **Map** shows the [Layers](layers.md) list above the scene hierarchy.
- **Entity** shows the Properties panel above the Entity Browser.
- **Face** shows the face attributes above the material browser. See
  [Textures and UV mapping](textures_and_uvs.md).

Drag the splitter between the two parts of the Map or Entity tab to give one of
them more room.

### Scene hierarchy

The hierarchy, often called an outliner, shows how scene objects are organized. It is more than a list:

- Click an item to select it.
- Expand or collapse groups and solid models.
- Drag objects to change their parent.
- Toggle visibility to temporarily hide geometry.
- Toggle locking to protect an object from edits.
- Double-click a name to rename it.
- Right-click for object actions such as duplicate, delete, group, or ungroup.

Selecting a parent can represent a larger hierarchy. Be aware of this before deleting or transforming a group.

### Properties panel

The Properties panel shows values for the current object selection. Its general sections are Position, Rotation, Scale, and Material.

For a multi-selection:

- A shared value is displayed normally.
- A differing value is displayed as a dash.
- Entering a replacement changes that axis or property across the editable selection.

Locked objects are not edited. When a solid model or one of its brushes is selected, an additional Solid Model section appears with brush operations and model-specific controls.

### Entity Browser

The Entity Browser below the Properties panel shows a thumbnail tile for every
kind of object the **Add** menu can create, including the game's entity
classes when a game is connected.

- Drag a tile onto a viewport to place that object where you drop it.
- Click a tile to select it, then double-click it or press `Enter` to add the
  object the same way the Add menu does.
- The dropdown sorts the tiles by **Name** or **Category**. **Group** shows the
  tiles under category headers, **Used** shows only the kinds used in this map,
  and the search field filters the tiles by name.

A tile's number badge shows how many objects of that kind the map contains.

## Info panel

The info panel is docked below the viewports. Hide or show it with **View >
Show Info Panel** or `Ctrl+4`.

- **Console** lists status messages, errors, and game preview connection
  changes as they happen. Right-click it and choose **Clear** to empty it.
- **Issues** lists problems found in the map, such as invalid solid brushes,
  solid model warnings, and game components whose class the game does not
  know. The list updates shortly after each edit. Click an issue to select its
  object and frame it in every view.

## Arranging the main window

Drag the splitter at the inner edge of the inspector or the info panel to
resize it. The editor remembers which docks and the toolbar are shown, their
sizes, and their selected tabs between sessions. AI assistants connected
through MCP can read and change this arrangement with the `get_main_window` and
`set_main_window` tools; see the [AI tools reference](../src/ai/README.md).

## Floating panels

Some panels still open above the workspace, such as **Tools > Solid Model…**,
**Run > Game Preview…**, and **Help > AI Captures (Debug)…**. Reposition one
by dragging its title bar.

- **Solid Model** shows the active model and provides a quick **+ Box Brush** action.

Close a panel with its `×` button. Closing a panel does not delete scene data or cancel edits already applied.

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
