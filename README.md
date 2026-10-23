# BevyBroom — Browser-Based 3D Level Editor

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE.md)
[![Three.js](https://img.shields.io/badge/Three.js-0.185-blue.svg)](https://threejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue.svg)](https://www.typescriptlang.org/)
[![Vitest](https://img.shields.io/badge/Vitest-2.0-green.svg)](https://vitest.dev/)

A professional 3D level editor that runs entirely in your browser. Built with Three.js and TypeScript, designed for fast iteration on game worlds with CSG solid modeling, texture painting, and precision tools.

[**OPEN THE EDITOR ONLINE**](https://kelo221.github.io/BevyBroom/)

[![Screenshot of the editor](https://raw.githubusercontent.com/wiki/Henry00IS/AiWorldEd/images/home.png)](https://kelo221.github.io/BevyBroom/)

> BevyBroom is created and maintained entirely by AI (Grok 4.5 and Qwen 3.6) under human guidance. No human has manually edited the source code.

---

## Features

### Solid CSG Modeling

Build levels from brushes using constructive solid geometry. Add, subtract, and intersect brush volumes to carve out rooms, corridors, and architecture — then compile them into a single textured mesh.

- **Additive / Subtractive / Clip brushes** — each brush has a boolean operation
- **Live rebuild** — geometry updates in real-time as you move and resize brushes
- **Per-face textures** — assign different textures to each face of a brush, carried through CSG compilation
- **Brush reordering** — drag brushes in the outliner to change boolean evaluation order

### Primitives

Create basic geometry to start building your scene:

- Cubes, Spheres, Cylinders, and Planes
- All primitives support textures, colors, and CSG operations

### CSG Boolean Operations

Combine any two meshes using BSP-based boolean operations:

- **Union** — merge two meshes into one
- **Subtract** — cut one mesh from another
- **Intersect** — keep only the overlapping volume

### Clip Plane Tool

Slice meshes with an interactive clipping plane. Place three points in the viewport to define a plane, then flip, clip, or split your geometry:

- **Clip** — cut away one side of the mesh
- **Split** — split the mesh into two separate pieces
- **Flip** — swap which side is kept

### Face Selection & Extrusion

Switch to face mode to select individual faces on any mesh, then extrude them into new convex prism geometry:

- Click or drag to select faces
- Coplanar face region grouping for multi-face extrusion
- Extruded geometry is created as a new mesh (source stays intact)

### Texturing & Face Inspector

Full texture workflow with per-face control in the inspector's Face tab:

- **Material browser** — load textures from a local folder using the File System Access API, filter them by name, and click one to apply it
- **Per-face texture assignment** — assign different textures to each face of a solid
- **Face attributes** — offset (X/Y), scale (X/Y), and rotation fields with quick nudge buttons, docked above the material browser
- **Texture alignment** — one-click align to floor, wall, or ceiling orientation
- **Planar UV projection** — automatic world-aligned UV baking per face
- **Cylinder side unwrap** — special-case UV unwrapping for cylinder geometry
- **UV smear** — drag to adjust UV coordinates directly on the mesh
- **Texture lock** — keep UVs locked to world space during transform operations

### Terrain Generation

Procedural heightmap terrain for blocking-out landscapes and level layouts:

- Configurable width, depth, segmentation, and height scale
- Deterministic seed-based generation
- Automatic world-aligned texture projection

### Transform Gizmos

Precision object manipulation with Unity-style gizmos:

- **Bounds resize** — OBB-based bounding box gizmo for intuitive scaling
- **Translate** — move along X, Y, Z axes or free in 3D
- **Rotate** — rotate around individual axes
- **Scale** — uniform or per-axis scaling
- **Grid snap** — configurable snap intervals (cycle with `,` / `.` keys)
- **Texture lock** — UVs stay world-aligned when objects are transformed

### Alignment Tools

Snap selected objects to the world origin with per-axis control. Cycle through ALL / X / Y / Z axis restrictions with the `A` key.

### Scene Hierarchy

Organize your scene with a full object hierarchy:

- **Group / Ungroup** objects into containers
- **Drag-and-drop reparenting** in the outliner
- **Visibility toggles** per object
- **Lock toggles** to protect objects from edits
- **Inline renaming** with double-click
- **Context menus** with duplicate, delete, group, ungroup, visibility

### Multi-Viewport Layout

Four-viewport Quad View workspace arranged like TrenchBroom:

- **Perspective** (top left) — 3D fly camera with orbit and pan controls
- **Top** (top right) — orthographic XZ view
- **Side** (bottom left) — orthographic YZ view
- **Front** (bottom right) — orthographic XY view
- **Cycle and maximize** — `Space` cycles the view under the pointer, `Ctrl+Space` maximizes or restores it
- **Workspace tabs** — switch between saved arrangements such as Single Perspective, Dual, and Triple
- **Viewport sync** — 2D viewport selection syncs with the 3D viewport
- **Camera widget** — navigation indicator in the 3D viewport
- **Infinite grid** — grid that scales with camera distance

### Shading Modes

Toggle viewport rendering modes for any viewport:

- **Solid** — standard shaded rendering
- **Wireframe** — wireframe-only display
- **Flat** — flat-shaded rendering
- **Wireframe Overlay** — solid with wireframe edges on top

### Selection

Robust selection system with full multi-select support:

- Click to select, Shift+click to add, Ctrl+click to toggle
- TrenchBroom-style dragging: drag a selected object to move it (Alt moves vertically in 3D, Ctrl duplicates first), or drag while nothing is selected to draw a box brush
- Copy, cut and paste through the system clipboard (Ctrl+C / Ctrl+X / Ctrl+V, Ctrl+Alt+V at the original position)
- Tab to switch between object and face selection modes
- Mixed-value display in inspector for multi-select

### Properties Inspector

Unity-style properties panel with live editing:

- **Position / Rotation / Scale** — numeric inputs with axis color coding
- **Material color** — color picker for mesh tint
- **Mixed values** — shows dashes for non-uniform multi-selection
- **Solid brush properties** — operation type, per-face texture assignment

### Import / Export

- **Save scene** — proprietary JSON format with full geometry, transforms, textures, and solid model data
- **Load scene** — restore saved projects with all data
- **Export GLB** — binary glTF export for use in game engines (Unity, Godot, Unreal), Blender, and more
- **File dialogs** — native save/open dialogs via the File System Access API

### GLB Coordinate-Space Contract

BevyBroom authors all scene data in a right-handed, Y-up, `-Z`-forward space,
where one editor unit is one meter. A game profile converts that authored data
at export time; it does not change the editor scene.

The GLB exporter clones the scene and places the profile conversion on an
`ExportRoot` node. Position, normal, UV, and index buffers are not baked or
rewritten. The conversion includes the selected unit scale and axis basis.
Right-handed profiles produce a positive-determinant root transform.
Left-handed profiles (Unity, Unreal, and custom left-handed bases) produce a
negative-determinant root transform.

| Target profile | Export basis                                            | Units                                 | Import requirement                                                                       |
| -------------- | ------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------- |
| Godot          | Right-handed, Y-up, `-Z` forward                        | Select the project unit               | Preserve the GLB node hierarchy and root transform.                                      |
| Blender        | Right-handed, Z-up, `+Y` forward                        | Select the desired Blender unit scale | Preserve the GLB node hierarchy and root transform.                                      |
| Unity          | Left-handed, Y-up, `+Z` forward                         | Meter profile                         | Preserve the mirrored root transform; do not bake it without reversing triangle winding. |
| Unreal Engine  | Left-handed, Z-up, `+X` forward                         | Centimeter profile                    | Preserve the mirrored root transform; do not bake it without reversing triangle winding. |
| Custom         | The three selected axes define the basis and handedness | Selected profile unit                 | Apply the same determinant and bake rules as the derived basis.                          |

For every target, validate a test asset containing an asymmetric triangle,
outward normals, a textured face, and collision geometry. Its position and
orientation must match the profile axes; front faces must remain visible,
normals must point outward, textures must not be mirrored unexpectedly, and
collision must match the rendered mesh. Importers may retain the reflected
root transform directly. If an importer or an optimization step bakes a
negative-determinant transform into geometry, it must reverse each triangle's
index winding and transform normals with the inverse-transpose matrix. The
current GLB export intentionally does not bake that transform.

### Undo / Redo

Full undo/redo for all operations:

- 35+ tracked command types covering every editor action
- Coalesced commands for smooth property panel editing
- `Ctrl+Z` / `Ctrl+Y` shortcuts

### Keyboard Shortcuts

```
W       Move tool
E       Rotate tool
R       Scale tool
T       Bounds resize
A       Cycle alignment axis
F       Fit to selection
Shift+F Fit all viewports
Delete  Delete selected
Ctrl+C  Copy selected
Ctrl+X  Cut selected
Ctrl+V  Paste under the mouse pointer
Ctrl+Alt+V  Paste at the original position
Ctrl+D  Duplicate selected
Ctrl+Z  Undo
Ctrl+Y  Redo
Ctrl+S  Save scene
Ctrl+O  Load scene
Ctrl+Shift+E  Export GLB
Shift+G Group selected
Shift+U Ungroup selected
Alt+G   Align to origin
Shift+E Extrude faces
1-4     Shading mode (Solid, Wireframe, Flat, Wireframe+Overlay)
Tab     Toggle object / face selection
.       Snap interval forward
,       Snap interval backward
Escape  Deselect / exit tool
Ctrl+A  Select all
Ctrl+Shift+A  Select none
Space   Cycle the view under the pointer
Ctrl+Space    Maximize / restore the view under the pointer
F5      Play
Ctrl+1-3      Show the Map / Entity / Face inspector tab
Ctrl+4  Toggle the info panel
Ctrl+5  Toggle the inspector
Ctrl+Alt+T    Toggle the toolbar
```

All shortcuts can be rebound in Settings > Keyboard.

### UI

- **Blender-inspired dark theme** — dark backgrounds with orange selection highlights
- **Menu bar** — File, Edit, Add, Tools, View, Run, and Help menus
- **Toolbar** — undo and redo, tool buttons, snap and grid size, gizmo axes, and texture locks
- **View bar** — the active tool's options and the workspace tabs above the viewports
- **Inspector** — docked on the right with Map (layers and outliner), Entity (properties and entity browser), and Face (face attributes and material browser) tabs
- **Outliner** — collapsible tree view of the scene hierarchy
- **Properties panel** — transform, material, and brush property editors
- **Entity browser** — thumbnails of every placeable kind; drag one onto a viewport to place it
- **Info panel** — docked below the viewports with Console (messages and errors) and Issues (map validation) tabs
- **Remembered layout** — dock visibility, sizes, and tabs are restored between sessions
- **Floating panels** — draggable Solid Model, Game Preview, and other tool panels
- **Status bar** — real-time feedback on tool state, snap settings, and shading mode
- **Context menus** — right-click actions on objects in the outliner and viewports

### Standalone executable updates

The Settings > Update tab checks the latest published release from the
[BevyBroom GitHub Releases page](https://github.com/kelo221/BevyBroom/releases)
when the editor is hosted inside a standalone executable. The browser build
shows the release page instead because a browser cannot replace its own
executable.

Electrobun desktop builds use Electrobun's native updater over typed Bun/webview
RPC. The Update tab's `Automatic update checks` toggle controls whether the
standalone app checks its configured release channel when the tab opens. Native
Electrobun builds use the release artifacts generated by `electrobun build` and
the `latest/download` release base URL configured in `electrobun.config.ts`.

Standalone shells other than Electrobun can enable automatic installation by defining
`window.bevybroomStandaloneUpdater` before loading the editor:

```ts
window.bevybroomStandaloneUpdater = {
  platform: 'windows',
  installUpdate: async ({ version, downloadUrl, fileName, releasePageUrl }) => {
    // The shell downloads, verifies, replaces, and restarts the executable.
  },
};
```

The updater only passes HTTPS GitHub asset URLs selected for the host platform
and only installs a release after the user presses “Install update and
restart”.

---

## Technical Details

- **241 TypeScript source files** across 18 subdirectories
- **179 unit tests** covering viewport rendering, CSG, selection, transforms, textures, serialization, and UI
- **Zero external dependencies** beyond Three.js — all UI, CSG, and editor logic is custom-written
- **Convex-only geometry** policy for level design simplicity
- **BSP-based CSG** with polygon clipping, mesh rebuilding, and texture propagation
- **Deep-cloned 2D viewport geometry** for correct orthographic display
- **Schema v3** serialization format with face texture maps and buffer UV channels

---

## Development

```bash
bun install
bun run dev          # Start development server
bun run testrun      # Run all tests
bun run format       # Format authored source, tests, and configuration
bun run format:check # Verify formatting without changing files
bun run ci           # Run formatting, tests, and the web build
bun run build        # Production build
bun run typecheck    # Baseline TypeScript check
bun run typecheck:strict # Strongest TypeScript check (informational in CI)
bun run desktop:dev  # Watch and launch the Electrobun desktop app
bun run desktop:build # Build the native desktop app into desktop_artifacts/
bun run desktop:run  # Relaunch the last Electrobun build
```

The desktop build uses Electrobun with Bun and the native renderer configured for
Windows, Linux, and macOS. The desktop view bundles the same `src/app.ts` editor
entrypoint as the browser build, so editor behavior remains shared between both
targets.

## CI/CD

GitHub Actions runs formatting, unit tests, and the Vite production build for
pull requests and pushes to `main`. The strict TypeScript check from
`tsconfig.strict.json` also runs as an informational step while the existing
type errors remain unresolved.

Every successful push to `main` starts native Electrobun builds on Windows,
Linux, and macOS. The resulting `desktop_artifacts/` files are uploaded as
platform-specific GitHub Actions artifacts named with the platform and commit
SHA and retained for 30 days.

---

## License

MIT — see [LICENSE.md](LICENSE.md)

---

## Support

[![Join Discord](https://dcbadge.limes.pink/api/server/sKEvrBwHtq)](https://discord.gg/sKEvrBwHtq)

[Join the Discord server](https://discord.gg/sKEvrBwHtq) for discussion and support.

If you found this tool useful, consider supporting its development:

[![Patreon](https://raw.githubusercontent.com/wiki/Henry00IS/DynamicLighting/images/badges/patreon.svg)](https://patreon.com/henrydejongh)
[![Ko-fi](https://raw.githubusercontent.com/wiki/Henry00IS/DynamicLighting/images/badges/kofi.svg)](https://ko-fi.com/henry00)
[![PayPal](https://raw.githubusercontent.com/wiki/Henry00IS/DynamicLighting/images/badges/paypal.svg)](https://paypal.me/henrydejongh)
