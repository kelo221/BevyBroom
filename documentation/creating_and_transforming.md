# Creating and Transforming Objects

BevyBroom provides ordinary primitives for free-standing scene geometry and solid models for brush-based architecture.

## Create ordinary primitives

Open **Add > Geometry** in the menu bar:

- **Cube** for blockouts, walls, platforms, and box-shaped props.
- **Sphere** for rounded volumes and placeholders.
- **Cylinder** for columns, pipes, and radial shapes.
- **Plane** for flat surfaces.
- **Terrain** for a generated landscape surface.

After creation, the object appears in all relevant views and in the hierarchy. Select it and press `F` if it is not immediately visible.

## Create terrain

Choose **Add > Terrain > Terrain** to create a procedural landscape. Terrain uses configurable dimensions, subdivisions, height scale, and a deterministic seed. A repeated seed with the same settings gives a repeatable shape.

## Create stretchable procedural objects

**Add > Procedural** places objects whose mesh a generator builds from parameters. Drag their handles to resize them: fixed-size pieces keep their size and repeated pieces are spaced again, never scaled.

- **Girder**: drag the start and end. The profile (I-beam, C-channel, box or angle) keeps its height, flange and web sizes and only gets longer. The run may slope.
- **Railing**: drag the start and end. Posts repeat at most **Max Post Spacing** apart, with the first and last posts flush with the ends. The top and mid rails stretch and follow a slope, such as a staircase.
- **Window**: drag the faces. The frame and mullion widths stay fixed. The panes split the opening into the chosen columns and rows, with each pane as a separate glass part.

Each part is convex, and pieces stay on the grid when the handles are on it. The game receives the parts as level geometry and the parameters as the `BroomProceduralProp` component.

## Repeat entities in an array

Select an entity, such as a store fixture, a light or a procedural object. In Properties, set **Array > Repeat** to **On**. The entity then repeats along its own X, Y and Z axes:

- **Count X / Y / Z** is the number of objects on each axis, the entity itself included.
- **Gap** is the space between neighbours on each axis, in meters. Copies stand one footprint plus one gap apart. The footprint is the box the entity fills, such as a fixture's model box. Use a gap of 0 to place them flush.
- Turn or move the entity to aim and move the whole array.

The copies are rebuilt from the entity whenever it changes. A change such as another fixture variant reaches every copy in the same undo step. You cannot click a copy; edit the source entity instead. **Bake Copies** turns the copies into ordinary entities beside the source, each editable on its own. The game receives every copy as an ordinary entity with the source's components.

AI tools use `set_entity_array` and `bake_entity_array`.

## Create solid models

Choose **Add > Brushes > Solid Model** to create brush-based architecture.

Use terrain for broad layout and landscape blocking. Very dense terrain can be harder to edit and export, so begin with modest detail and add complexity only when the shape requires it.

## Draw box brushes and move with the mouse

With nothing selected, drag in empty space or across a surface to draw a new
box brush. In the 3D view the box starts on the surface under the pointer (or
on the grid) and you drag out its footprint; hold `Shift` for a square
footprint and `Alt` to pull the height. In a 2D view you drag the visible
rectangle and the depth comes from the last selection; `Shift` keeps the
sides equal. The box snaps outward to the grid, a flat side grows one grid
step, and the brush joins the active solid model (a new **World** model is
created when there is none) with the current texture. `Escape` cancels.

Drag a selected object to move the whole selection. The 3D view moves on the
horizontal grid plane; hold `Alt` to move vertically. 2D views move in the
view plane. Moves snap to grid steps unless `Shift` is held, `Ctrl` at the
start duplicates first, and `Escape` puts everything back. A press on a
visible resize arrow of the bounds still resizes; arrows hidden behind the
selection (drawn faintly through it) leave the press to the move.

## Transform modes

Choose the Object Select tool button in the tools palette to see the four transform choices in the tool options on the left of the view bar.

### Bounds

Bounds mode (`T`) resizes from the faces of an oriented bounding box. It is often the most intuitive way to change architectural dimensions because you can pull one side without thinking in scale factors.

### Move

Move mode (`W`) changes position. Drag an axis for a single-axis move or an available plane/free handle for a broader move.

### Rotate

Rotate mode (`E`) turns the selection around an axis. Rotation values in Object Properties are displayed in degrees.

### Scale

Scale mode (`R`) changes size by a multiplier. Use it for proportional resizing or per-axis stretching. For exact wall dimensions, Bounds mode is often easier to predict.

Point entities (lights and game entities) only move and rotate. While one is selected, Scale mode shows no handles, Bounds mode shows no resize bars, and the Scale fields are hidden. Rooms and portals keep their sizing.

## Global and Local transform space

- **Global** aligns the gizmo to the world's fixed X, Y, and Z directions.
- **Local** aligns the gizmo to the selected object's rotated axes.

Use Global for level layout and grid-aligned architecture. Use Local when moving or scaling an already rotated object along its own length or width.

## Edit exact values

Use Position, Rotation, and Scale in Object Properties when exact values matter.

For multiple selected objects, a dash indicates mixed values. Replacing a mixed X value, for example, makes the X component common while leaving untouched Y and Z values as they were.

## Undo-friendly editing

Transforms and property changes participate in undo and redo. The bottom-left counters show how much history is available.

Use small, deliberate operations:

1. Select the intended object or group.
2. Confirm the active transform mode and space.
3. Perform one change.
4. Inspect it in more than one viewport.
5. Undo immediately if the result is wrong.

## Convex shape expectations

The editor favors convex geometry. When you need a concave architectural result, build it from several convex pieces, use solid brushes, or use CSG to remove space. This keeps editing and level-design geometry predictable.
