import { EditorToolId } from '@/types/editor_tool_id.js';
import type { ToolInstruction } from './tool_instruction.js';

/** Static map of rail tooltip instructions for every primary editor tool. */
const TOOL_INSTRUCTIONS_BY_ID: Readonly<Record<EditorToolId, ToolInstruction>> = {
  [EditorToolId.OBJECT]: {
    title: 'Object Select',
    shortcut: 'O',
    description:
      'Select whole objects in the viewport. Use transform modes on the options bar, or G / R / S for grab, rotate, and scale. Tab toggles Object Mode and Edit Mode. In Edit Mode, K adds a vertex, Ctrl+R loop-cuts, M merges, and Delete dissolves the selection.',
  },
  [EditorToolId.ENTITY]: {
    title: 'Entity Tool',
    shortcut: 'Shift+E',
    description:
      'Place the active game entity or point object class where you click in any viewport. Choose the active class on the options bar or in the Entity Browser.',
  },
  [EditorToolId.BLOCK]: {
    title: 'Block Tool',
    shortcut: 'Shift+B',
    description:
      'Drag in any viewport to draw a new convex brush using the active shape (Cuboid, Stairs, Arch, Cylinder, Cone, Spheroid UV, Spheroid Icosahedron) and current texture.',
  },
  [EditorToolId.FACE]: {
    title: 'Face Select',
    shortcut: 'Shift+Tab',
    description:
      'Select individual faces on content meshes and solid results. Click selects one face, Ctrl+click toggles a face, Shift+click selects the whole brush and Ctrl+Shift+click adds the whole brush. Right-drag looks around (2D: pans) and the wheel changes fly speed while right-dragging in 3D. Right-click a face to apply the current texture, Alt+right-click to apply it with the lifted alignment. Open the Face Edit Sheet or Extrude from the tool options bar.',
  },
  [EditorToolId.STAMP]: {
    title: 'Apply Current Texture',
    shortcut: 'Shift+T',
    description:
      'Applies the current texture from the texture bar to the selected objects or faces, then stays active: click or right-click a face in the viewport to stamp the current texture on it, Alt+right-click to stamp it with the lifted alignment.',
  },
  [EditorToolId.CLIP_PLANE]: {
    title: 'Clip Plane',
    shortcut: 'Shift+X',
    description:
      'Place a cutting plane through the selected mesh. Flip keeps the other side, Clip discards one half, Split keeps both. Requires a selected mesh. Esc cancels.',
  },
  [EditorToolId.VERTEX]: {
    title: 'Vertex Tool',
    shortcut: 'Shift+V',
    description:
      'Enter Edit Mode in Vertex selection mode on the selected brush or mesh to move, merge, or split vertices directly.',
  },
  [EditorToolId.POLYGON]: {
    title: 'Polygon Tool',
    description:
      'Click 2D outline vertices in an orthographic viewport and extrude into convex solid brush pieces. Outline vertices remain re-editable.',
  },
  [EditorToolId.SPRINKLE]: {
    title: 'Sprinkle Tool',
    description:
      'Entity Sprinkle: LMB drag paints the chosen sprinkle type onto surfaces, Ctrl+LMB drag erases it, RMB drag changes the brush radius. Type, Mode, Density and grid live in the Entity Sprinkle window.',
  },
  [EditorToolId.GRID]: {
    title: 'Grid',
    description:
      'Independent grid and camera orientations. Align the snap grid with a face or edge (X/Y/Z). Camera align and reset leave the grid alone.',
  },
};

/**
 * Looks up the tooltip instruction for a primary editor tool id.
 *
 * @param toolId Editor tool id.
 * @returns Tool instruction entry.
 */
export function toolInstructionLookupByToolId(toolId: EditorToolId): ToolInstruction {
  return TOOL_INSTRUCTIONS_BY_ID[toolId];
}
