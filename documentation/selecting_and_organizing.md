# Selecting and Organizing Objects

Selection determines what nearly every editing command will affect. The hierarchy determines how objects are named, grouped, parented, hidden, and protected.

## Object selection

Use Object Select when you want to transform complete objects or scene groups.

- Click an object to replace the selection.
- `Shift+click` adds another object.
- `Ctrl+click` toggles an object in or out.
- Drag a selected object to move the selection; dragging elsewhere does not
  change the selection.
- Click an item in the hierarchy when objects overlap or are difficult to reach.

Press `Tab` to return to Object Select from another selection tool. The status bar should read **Selection: Object**.

## Face selection

Use Face Select for surface-level work such as extrusion and per-face textures.

1. Press `Shift+Tab` or click the **Face Select** tool button in the toolbar.
2. Click a visible face.
3. Add more faces with selection modifiers or a drag selection.
4. Watch the face count in the status bar.

Face selection is separate from ordinary object selection. If an object command is unavailable, return to Object Select.

## Selecting through the hierarchy

The hierarchy is the safest way to select:

- Objects hidden behind other geometry.
- Groups and their children.
- Solid models and individual brushes.
- Items with similar silhouettes.

Expand a parent to see its children. A group selection may stand for the entire grouped structure, while selecting a child targets that item more narrowly.

## Rename objects

Double-click an object's name in the hierarchy, type a useful name, and commit it. Names such as `west_wall`, `door_cut`, and `spawn_platform` are easier to work with than a long list of generic cubes.

Renaming changes editor organization; it does not change geometry.

## Group and ungroup

To group:

1. Select two or more objects.
2. Choose **Edit > Group** or press `Shift+G`.

To remove a group while retaining its contents:

1. Select the group.
2. Choose **Edit > Ungroup** or press `Shift+U`.

Grouping is useful when several objects should move together or belong to one logical feature. Avoid grouping unrelated objects merely because they are currently near one another.

## Reparent with drag and drop

Drag an item in the hierarchy onto another suitable item to change its parent. Parenting affects hierarchy and can affect how transforms are inherited.

After reparenting, inspect the object in the viewports. The editor preserves the intended scene relationship, but a deeply nested hierarchy can make later transformations harder to reason about.

## Visibility

Temporarily hide distracting objects with their hierarchy visibility control or context action. This is useful for:

- Reaching geometry inside a room.
- Inspecting CSG results.
- Reducing visual clutter.
- Comparing alternate arrangements.

Hidden is not the same as deleted. Restore visibility from the hierarchy.

## Locking

Lock completed or reference objects so that normal edits do not move or alter them. Locked objects remain part of the scene, but editable selection operations filter them out.

If a multi-object change affects only part of the selection, check whether some items are locked.

## Copy, cut and paste

- `Ctrl+C` copies the selected objects and brushes to the clipboard as text.
- `Ctrl+X` cuts: it copies the selection and deletes it as one undo step.
- `Ctrl+V` pastes under the mouse pointer. In Perspective the copy rests
  against the surface under the pointer; in a 2D view it lands under the
  pointer at its original depth. The placement snaps to the grid.
- `Ctrl+Alt+V` pastes at the position the objects were copied from.
- Pasted objects get new ids, join the current layer and become the
  selection. Pasted brushes join the active solid model, or a new `World`
  solid model when the scene has none. One undo removes a paste.
- The clipboard holds plain text, so you can paste into another BevyBroom
  window. Text that holds no BevyBroom objects is ignored, and copying and
  pasting inside a text field works as usual.
- The same commands are in the Edit menu.

## Duplicate and delete

- `Ctrl+D` duplicates the selection in place.
- Hold `Ctrl` when you start dragging a selected object in a viewport to
  create a duplicate and move the copy in one gesture. The original stays in
  place, the new copy becomes selected, and one undo removes both steps.
- `Delete` removes the selection.
- The Edit menu and hierarchy context menu provide the same actions.

Duplicate an object before experimenting with a destructive-looking shape change. If the result is unwanted, undo immediately with `Ctrl+Z`.
