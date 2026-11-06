# Toolbar

The toolbar is the row of icon buttons and quick controls between the menu bar
and the view bar. It holds undo and redo, duplicating and flipping, grouping,
snapping and the **Grid** size dropdown, the gizmo axes, the texture locks, and
the MCP server button. The menus are in the separate menu bar above it, and the
tools are in the tools palette on the left. See
[Understanding the interface](understanding_the_interface.md).

## Toolbar buttons

From left to right:

- **Undo** and **Redo**.
- **Duplicate** duplicates the selection.
- **Flip Horizontally** and **Flip Vertically** mirror the selection.
- **Group** puts the selection into a new group, and **Ungroup** dissolves the
  selected groups into their parent.
- **Ignore Groups** is a toggle. While it is highlighted, clicking an object in
  a viewport selects that object even when it belongs to a group; while it is
  off, the click selects according to the **Select:** filter in the right dock.
- **Snap** turns grid snapping on or off, and the **Grid** dropdown shows and
  changes the grid size.
- **Global** and **Local** choose the gizmo axes.
- **Pos Lock** and **Stretch Lock** keep textures in place while brushes move or
  stretch.
- The **MCP** server button on the far right, highlighted orange while the
  server runs.

## Tools palette

The tools are not on the toolbar. They are in the vertical **tools palette**
along the left edge of the window: Object Select, Entity Tool, Block Tool, Face
Select, Apply Current Texture, Clip Plane, Vertex Tool, Polygon Tool, Sprinkle
Tool, and Grid. Hover over a palette button to read its name and shortcut, and
use **View > Show Tools Palette** to hide or show the palette. The options of
the active tool appear on the view bar above the viewports.

## Hide the toolbar

Choose **View > Show Toolbar** or press `Ctrl+Alt+T` to hide or show the
toolbar. The editor remembers the choice between sessions. Every toolbar action
is also available in the menus.

## Resize the toolbar

1. Point at the thin resize strip along the toolbar's bottom edge.
2. Drag the strip vertically.
3. Release it when the toolbar reaches the preferred size.

The toolbar snaps to small, medium, and large states. Small uses compact
16-by-16-pixel icons. Medium is the default and uses 25-by-25-pixel icons.
Controls wrap onto additional rows when the window is too narrow.

## Show labels in the expanded toolbar

1. Open **Settings** with **File > Preferences…**.
2. Select the **View** tab.
3. Find **User Interface**.
4. Enable **Expanded toolbar button labels**.
5. Resize the toolbar to its large state.

In the large state, quick-access icons are replaced by their action names.
Disable the setting to keep icons visible at every toolbar size. The editor
saves this preference for future sessions.

If labels do not appear, confirm that the toolbar is in its largest snapped
state. The setting does not add labels to the small or medium states.
