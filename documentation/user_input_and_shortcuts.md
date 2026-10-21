# User Input and Shortcuts

BevyBroom supports both direct manipulation and keyboard-driven editing. Most shortcuts are ignored while you are typing in a text field, number field, list, or other form control.

## Mouse input

### In a viewport

- Left-click selects a visible object or face, depending on the active selection tool.
- `Shift` with selection adds to the selection.
- `Ctrl` with selection toggles membership in the selection.
- Clicking empty space clears the selection.
- In Object Select, dragging a selected object moves the selection, and
  dragging while nothing is selected draws a new box brush. There is no
  rubber-band selection; in Face Select a drag paints faces into the selection.
- Right mouse navigates the 2D views and activates fly-look in Perspective.
- Middle mouse drag pans any view, both the 2D views and Perspective.
- Alt + middle mouse drag moves the Perspective camera forward or back when
  **Alt + middle mouse drag to move camera** is enabled in **Settings > Mouse**.
- The wheel zooms or moves the camera.
- Right-click may open a context menu when navigation is not taking ownership of the gesture.

### In the hierarchy

- Click selects an item.
- Double-click the name to rename it.
- Drag an item onto another suitable item to reparent it.
- Use the visibility and lock controls to manage editing state.
- Right-click opens hierarchy actions.

### On transform handles

Drag a colored axis or plane handle to constrain the edit. The exact handles depend on Bounds, Move, Rotate, or Scale mode.

## Default keyboard shortcuts

Shortcuts can be changed in **Settings > Keyboard**. The table below describes the defaults.

### Tools and selection

| Shortcut        | Action                                                    |
| --------------- | --------------------------------------------------------- |
| `T`             | Bounds resize                                             |
| `W`             | Move                                                      |
| `E`             | Rotate                                                    |
| `R`             | Scale                                                     |
| `Tab`           | Return to Object Select                                   |
| `Shift+Tab`     | Enter Face Select                                         |
| `Escape`        | Cancel the active tool or clear selection                 |
| `Ctrl+A`        | Select all                                                |
| `Ctrl+Shift+A`  | Select none                                               |
| `Delete`        | Delete selected objects, or dissolve Edit Mode components |
| `1` / `2` / `3` | Vertex / Edge / Face select (Edit Mode)                   |
| `K`             | Knife: add a vertex on a hovered edge (Edit Mode)         |
| `Ctrl+R`        | Loop Cut (Edit Mode)                                      |
| `M`             | Merge selected vertices (Edit Mode)                       |
| `X`             | Dissolve selected components (Edit Mode)                  |
| `Ctrl+C`        | Copy the selection to the clipboard                       |
| `Ctrl+X`        | Cut: copy the selection, then delete it                   |
| `Ctrl+V`        | Paste under the mouse pointer, snapped to the grid        |
| `Ctrl+Alt+V`    | Paste at the copied position                              |
| `Ctrl+D`        | Duplicate selected in place                               |
| Drag selected   | Move the selection (`Alt` held: move vertically)          |
| `Ctrl+drag`     | Duplicate and move the selection in a viewport            |
| Drag empty      | Draw a new box brush while nothing is selected            |
| `Shift+E`       | Extrude selected faces                                    |
| `G` / `R` / `S` | UV Move / Rotate / Scale (Face Select, faces selected)    |
| `M` (hold)      | UV Smear while dragging faces (Face Select)               |
| `F11`           | Toggle fullscreen in the desktop app only                 |

Earlier builds may have described plain `Tab` as a toggle. In the current default bindings, `Shift+Tab` enters face mode and `Tab` returns to object mode.

### History and files

| Shortcut       | Action         |
| -------------- | -------------- |
| `Ctrl+Z`       | Undo           |
| `Ctrl+Y`       | Redo           |
| `Ctrl+Shift+Z` | Alternate redo |
| `Ctrl+S`       | Save scene     |
| `Ctrl+O`       | Load scene     |
| `Ctrl+Shift+E` | Export GLB     |

### Organization and alignment

| Shortcut  | Action                                               |
| --------- | ---------------------------------------------------- |
| `Shift+G` | Group selected                                       |
| `Shift+U` | Ungroup selected                                     |
| `Alt+G`   | Align to origin                                      |
| `A`       | Cycle alignment restriction through All, X, Y, and Z |

### View and shading

| Shortcut  | Action                           |
| --------- | -------------------------------- |
| `F`       | Fit selection in the active view |
| `Shift+F` | Fit all viewports                |
| `1`       | Solid shading                    |
| `2`       | Wireframe shading                |
| `3`       | Flat shading                     |
| `4`       | Solid with wireframe overlay     |

`Space` and `Ctrl+Space` act on the view under the pointer.

| Shortcut     | Action                                                                 |
| ------------ | ---------------------------------------------------------------------- |
| `Space`      | Cycle the view through Perspective, Top, Front, and Side               |
| `Ctrl+Space` | Maximize the view, or restore the previous pane layout                 |
| `F5`         | Start play mode (**Run > Play**); earlier builds used `Space` for this |

### Main window

| Shortcut     | Action                        |
| ------------ | ----------------------------- |
| `Ctrl+1`     | Show the Map inspector tab    |
| `Ctrl+2`     | Show the Entity inspector tab |
| `Ctrl+3`     | Show the Face inspector tab   |
| `Ctrl+4`     | Show or hide the info panel   |
| `Ctrl+5`     | Show or hide the inspector    |
| `Ctrl+Alt+T` | Show or hide the toolbar      |

These shortcuts are listed under **Window and Views** in **Settings > Keyboard**, and the menus show the current binding next to each command.

### Snapping

| Shortcut  | Action                                |
| --------- | ------------------------------------- |
| `.`       | Next snap interval                    |
| `,`       | Previous snap interval                |
| `Shift+.` | Move forward by three interval steps  |
| `Shift+,` | Move backward by three interval steps |

### Clip Plane tool

These keys are interpreted differently while Clip Plane is active:

| Shortcut | Action                          |
| -------- | ------------------------------- |
| `F`      | Flip the side that will be kept |
| `Enter`  | Commit the clip                 |
| `X`      | Split into both sides           |
| `Escape` | Cancel                          |

## When a shortcut does not work

Check the following:

1. Finish or unfocus the current text or number field.
2. Release the right mouse button after fly navigation.
3. Confirm the active tool: its button is highlighted in the toolbar.
4. Confirm the current selection is appropriate for the action.
5. Review the Keyboard tab in Settings in case the binding was changed.
