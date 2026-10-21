# Layers

Layers split a map into named sets of objects, like in TrenchBroom. Use them to hide parts of a level while you work, to protect finished areas from accidental edits, or to keep helper geometry out of the game.

The layers list is at the top of the inspector's **Map** tab, above the scene hierarchy. Click the **Map** tab or press `Ctrl+1` to show it, and drag the splitter between the two lists to change their heights.

## The default layer

Every map has a **Default Layer**. It always comes first and cannot be renamed or removed. Maps saved before layers existed open with everything in the default layer.

## The current layer

One layer is the **current layer**: its radio button is filled and its name is bold. Everything you create or import joins the current layer. Duplicates stay in the layer of the object they were copied from.

To make a layer current, click its radio button, double-click its row, or right-click it and choose **Make Current**.

## Layer switches

Each layer row shows how many objects it holds and three switches:

| Switch               | What it does                                                                                                          |
| -------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Omit from export** | Leaves the layer out of exported files and out of the running game. Use it for reference shapes and notes.            |
| **Visibility (eye)** | Hides the layer in every view. Hidden objects cannot be clicked or box-selected, and the running game hides them too. |
| **Lock**             | Keeps the layer from being selected, moved, deleted or otherwise edited. Locked objects stay visible.                 |

Hiding or locking a layer deselects its objects. Hidden layers are still exported, so a shipped level contains them; use **Omit from export** to leave a layer out. Hiding a layer does not change the visibility of the objects in it, so your own eye toggles in the hierarchy are kept. Objects in hidden layers appear greyed out in the hierarchy.

## Managing layers

Use the buttons under the list:

- **+** adds a layer named "Layer N" and lets you type a new name right away.
- **−** removes the selected layer. Its objects move to the default layer.
- **▲** and **▼** move the selected layer up or down.

Right-click a layer for more:

- **Move Selection Here** puts the selected objects into the layer. Objects inside a group move with their group.
- **Select All in Layer** selects every object of the layer.
- **Isolate** hides every other layer; **Show All** shows every layer again.
- **Rename** and **Remove**.

Every layer change can be undone with `Ctrl+Z`, except choosing the current layer.

## Layers and files

Layers, their switches and the current layer are saved in the scene file. AI assistants connected through MCP can manage layers too; see the layer tools in the [AI tools reference](../src/ai/README.md).
