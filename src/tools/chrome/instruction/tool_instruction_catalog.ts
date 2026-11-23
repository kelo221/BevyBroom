import { EditorToolId } from '@/types/editor_tool_id.js';
import { TransformMode } from '@/types/transform_mode.js';
import type { ToolInstruction } from './tool_instruction.js';
import { toolInstructionLookupByToolId } from './tool_instruction_catalog_hammer.js';

/**
 * Returns the rail instruction for a primary editor tool.
 *
 * @param toolId Tool id.
 * @returns Instruction for tooltips.
 */
export function toolInstructionForEditorTool(toolId: EditorToolId): ToolInstruction {
  return toolInstructionLookupByToolId(toolId);
}

/**
 * Returns the instruction for a transform mode control.
 *
 * @param mode Transform mode.
 * @returns Instruction for tooltips.
 */
export function toolInstructionForTransformMode(mode: TransformMode): ToolInstruction {
  if (mode === TransformMode.TRANSLATE) {
    return {
      title: 'Move',
      shortcut: 'W',
      description: 'Show the translate gizmo. Drag axes or use G for free grab move.',
    };
  }
  if (mode === TransformMode.ROTATE) {
    return {
      title: 'Rotate',
      shortcut: 'E',
      description: 'Show the rotate gizmo. Drag rings or use R for free rotate.',
    };
  }
  if (mode === TransformMode.SCALE) {
    return {
      title: 'Scale',
      shortcut: 'R',
      description: 'Show the scale gizmo. Drag handles or use S for free scale.',
    };
  }
  if (mode === TransformMode.SHEAR) {
    return {
      title: 'Shear',
      description:
        'Show bounds side handles. Drag a side to slide it parallel to itself; Alt slides side faces vertically.',
    };
  }
  return {
    title: 'Bounds',
    shortcut: 'T',
    description: 'Show oriented bounds handles for one-sided resize and face drag.',
  };
}

/** Instruction for opening the Browser on its Textures tab from face mode. */
export const TOOL_INSTRUCTION_FACE_INSPECTOR: ToolInstruction = {
  title: 'Textures',
  description: 'Open the Textures tab of the Browser to pick and align the material of the selected faces.',
};

/** Instruction for face extrude. */
export const TOOL_INSTRUCTION_EXTRUDE: ToolInstruction = {
  title: 'Extrude',
  shortcut: '{shift}+E',
  description: 'Extrude the selected face regions into a new solid prism along their normals.',
};

/** Instruction for keeping Side A of the clip plane. */
export const TOOL_INSTRUCTION_CLIP_KEEP_SIDE_A: ToolInstruction = {
  title: 'Keep Side A',
  shortcut: 'Tab',
  description:
    'Keep the piece the arrow points to and remove the red piece. Tab or {shift}+X cycles Side A, Side B and Both.',
};

/** Instruction for keeping Side B of the clip plane. */
export const TOOL_INSTRUCTION_CLIP_KEEP_SIDE_B: ToolInstruction = {
  title: 'Keep Side B',
  shortcut: 'Tab',
  description:
    'Keep the piece on the other side of the plane and remove the red piece. Tab or {shift}+X cycles Side A, Side B and Both.',
};

/** Instruction for keeping both pieces of the clip plane. */
export const TOOL_INSTRUCTION_CLIP_KEEP_BOTH: ToolInstruction = {
  title: 'Keep Both',
  shortcut: 'Tab',
  description:
    'Split into two brushes, shown in two colors, and keep both. Tab or {shift}+X cycles Side A, Side B and Both.',
};

/** Instruction for applying the clip. */
export const TOOL_INSTRUCTION_CLIP_APPLY: ToolInstruction = {
  title: 'Apply Clip',
  shortcut: 'Enter',
  description: 'Cut the selection with the plane and keep the chosen pieces. The plane must be ready.',
};

/** Instruction for Edit Mode vertex component select. */
export const TOOL_INSTRUCTION_COMPONENT_VERTEX: ToolInstruction = {
  title: 'Vertex Select',
  shortcut: '1',
  description: 'Select vertices on the edit domain. Available only in Edit Mode.',
};

/** Instruction for Edit Mode edge component select. */
export const TOOL_INSTRUCTION_COMPONENT_EDGE: ToolInstruction = {
  title: 'Edge Select',
  shortcut: '2',
  description: 'Select edges on the edit domain. Available only in Edit Mode.',
};

/** Instruction for Edit Mode face component select. */
export const TOOL_INSTRUCTION_COMPONENT_FACE: ToolInstruction = {
  title: 'Face Select',
  shortcut: '3',
  description: 'Select faces on the edit domain. Available only in Edit Mode.',
};

/** Instruction for resetting global grid orientation only. */
export const TOOL_INSTRUCTION_GRID_RESET: ToolInstruction = {
  title: 'Reset Grid',
  description: 'Restore the default world Y-up floor grid. Does not change camera orientation.',
};

/** Instruction for aligning the global grid to a face. */
export const TOOL_INSTRUCTION_GRID_ALIGN_TO_FACE: ToolInstruction = {
  title: 'Align Grid to Face',
  description: 'Click a mesh face to make it the new floor. Only the snap/visual grid reorients. Esc cancels the pick.',
};

/** Instruction for aligning grid X to an edge. */
export const TOOL_INSTRUCTION_GRID_ALIGN_X: ToolInstruction = {
  title: 'Align Grid X',
  description:
    'Click a mesh edge to make it the working X axis. Y is preserved; Z is rebuilt. Hover shows a preview triad. Esc cancels.',
};

/** Instruction for aligning grid Y to an edge. */
export const TOOL_INSTRUCTION_GRID_ALIGN_Y: ToolInstruction = {
  title: 'Align Grid Y',
  description:
    'Click a mesh edge to make it the working Y (up) axis. Z is preserved; X is rebuilt. Hover shows a preview triad. Esc cancels.',
};

/** Instruction for aligning grid Z to an edge. */
export const TOOL_INSTRUCTION_GRID_ALIGN_Z: ToolInstruction = {
  title: 'Align Grid Z',
  description:
    'Click a mesh edge to make it the working Z axis (tunnel direction). Y is preserved; X is rebuilt. Hover shows a preview triad. Esc cancels.',
};

/** Instruction for zeroing the grid lattice origin to a vertex. */
export const TOOL_INSTRUCTION_GRID_ORIGIN_VERTEX: ToolInstruction = {
  title: 'Zero Origin to Vertex',
  description:
    'Click a mesh vertex to set the snap/visual grid origin (0,0,0) there. Axes stay the same; only the lattice phase moves. Esc cancels.',
};

/** Instruction for resetting camera orientation only. */
export const TOOL_INSTRUCTION_CAMERA_RESET: ToolInstruction = {
  title: 'Reset Camera',
  description: 'Restore default camera working orientation (Y-up fly frame). Does not change the grid.',
};

/** Instruction for aligning the camera to a face. */
export const TOOL_INSTRUCTION_CAMERA_ALIGN_TO_FACE: ToolInstruction = {
  title: 'Align Camera to Face',
  description:
    'Click a mesh face so camera up matches that normal. Grid orientation is unchanged. Esc cancels the pick.',
};
