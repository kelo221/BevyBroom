import type { ToolbarMenuEntry } from '@/ui/menu/menu_types.js';
import type { TopologyVertexMergeMode } from '@/edit/topology/topology_vertex_merge_mode.js';
import { keyboardHintFormat } from '@/settings/keyboard/keyboard_hint_format.js';

/**
 * Shortcut text of the loop cut, shown with the primary modifier of the
 * platform.
 */
const VIEWPORT_TOOL_EDIT_MENU_LOOP_CUT_SHORTCUT = '{ctrl}+R';

/** Shortcut text of the component delete, the delete key of the platform. */
const VIEWPORT_TOOL_EDIT_MENU_DELETE_SHORTCUT = '{keyname:Backspace}';

/**
 * Shortcut text of the component dissolve, the forward delete key of the
 * platform.
 */
const VIEWPORT_TOOL_EDIT_MENU_DISSOLVE_SHORTCUT = '{keyname:Delete}';

/** Callbacks for Edit Mode Mesh / Vertex / Edge / Face menus. */
export interface ViewportToolEditMenuActions {
  onKnife: () => void;
  onLoopCut: () => void;
  onMerge: (mode: TopologyVertexMergeMode) => void;
  onDelete: () => void;
  onDissolve: () => void;
}

/**
 * Builds the Blender-style Mesh menu.
 *
 * @param actions Edit tool actions.
 * @returns Menu entries.
 */
export function buildViewportToolMeshMenuEntries(actions: ViewportToolEditMenuActions): ToolbarMenuEntry[] {
  return [
    createAction('Knife Topology Tool', 'K', 'Insert a vertex on a hovered edge', actions.onKnife),
    createAction(
      'Loop Cut',
      VIEWPORT_TOOL_EDIT_MENU_LOOP_CUT_SHORTCUT,
      'Cut a convex edge belt and slide it',
      actions.onLoopCut,
    ),
    { kind: 'separator' },
    createMergeSubmenu(actions.onMerge),
    createAction(
      'Delete',
      VIEWPORT_TOOL_EDIT_MENU_DELETE_SHORTCUT,
      'Delete the current component selection',
      actions.onDelete,
    ),
    createAction(
      'Dissolve',
      VIEWPORT_TOOL_EDIT_MENU_DISSOLVE_SHORTCUT,
      'Dissolve the current component selection into the surrounding faces',
      actions.onDissolve,
    ),
  ];
}

/**
 * Builds the Blender-style Vertex menu.
 *
 * @param actions Edit tool actions.
 * @returns Menu entries.
 */
export function buildViewportToolVertexMenuEntries(actions: ViewportToolEditMenuActions): ToolbarMenuEntry[] {
  return [
    createMergeSubmenu(actions.onMerge),
    createAction(
      'Delete Vertices',
      VIEWPORT_TOOL_EDIT_MENU_DELETE_SHORTCUT,
      'Delete selected vertices and the faces that use them',
      actions.onDelete,
    ),
    createAction(
      'Dissolve Vertices',
      VIEWPORT_TOOL_EDIT_MENU_DISSOLVE_SHORTCUT,
      'Dissolve selected vertices into the surrounding faces',
      actions.onDissolve,
    ),
  ];
}

/**
 * Builds the Blender-style Edge menu.
 *
 * @param actions Edit tool actions.
 * @returns Menu entries.
 */
export function buildViewportToolEdgeMenuEntries(actions: ViewportToolEditMenuActions): ToolbarMenuEntry[] {
  return [
    createAction(
      'Loop Cut',
      VIEWPORT_TOOL_EDIT_MENU_LOOP_CUT_SHORTCUT,
      'Cut a convex edge belt and slide it',
      actions.onLoopCut,
    ),
    createAction('Knife Topology Tool', 'K', 'Insert a vertex on a hovered edge', actions.onKnife),
    { kind: 'separator' },
    createAction(
      'Delete Edges',
      VIEWPORT_TOOL_EDIT_MENU_DELETE_SHORTCUT,
      'Delete edge vertices and every face that used them',
      actions.onDelete,
    ),
    createAction(
      'Dissolve Edges',
      VIEWPORT_TOOL_EDIT_MENU_DISSOLVE_SHORTCUT,
      'Join the faces beside the selected edges into one face',
      actions.onDissolve,
    ),
  ];
}

/**
 * Builds the Blender-style Face menu.
 *
 * @param actions Edit tool actions.
 * @returns Menu entries.
 */
export function buildViewportToolFaceMenuEntries(actions: ViewportToolEditMenuActions): ToolbarMenuEntry[] {
  return [
    createAction(
      'Delete Faces',
      VIEWPORT_TOOL_EDIT_MENU_DELETE_SHORTCUT,
      'Delete the selected faces and leave the others unchanged',
      actions.onDelete,
    ),
    createAction(
      'Dissolve Faces',
      VIEWPORT_TOOL_EDIT_MENU_DISSOLVE_SHORTCUT,
      'Join two adjacent selected faces into one',
      actions.onDissolve,
    ),
  ];
}

/**
 * Builds the Merge Vertices submenu.
 *
 * @param onMerge Merge callback.
 * @returns Submenu entry.
 */
function createMergeSubmenu(onMerge: (mode: TopologyVertexMergeMode) => void): ToolbarMenuEntry {
  return {
    kind: 'submenu',
    label: 'Merge Vertices',
    children: [
      createAction('At Center', 'M', 'Merge selected vertices at their centroid', () => onMerge('at_center')),
      createAction('At First', 'M', 'Merge selected vertices at the first selected', () => onMerge('at_first')),
      createAction('At Last', 'M', 'Merge selected vertices at the last selected', () => onMerge('at_last')),
      { kind: 'separator' },
      createAction('By Distance', 'M', 'Weld vertices closer than the merge epsilon', () => onMerge('by_distance')),
    ],
  };
}

/**
 * Builds one labeled action row whose shortcut text is filled with the modifier
 * and key names of the platform.
 *
 * @param label Visible label.
 * @param shortcut Shortcut text template.
 * @param tooltip Hover help.
 * @param onClick Click handler.
 * @returns Menu action.
 */
function createAction(label: string, shortcut: string, tooltip: string, onClick: () => void): ToolbarMenuEntry {
  return { label, shortcut: keyboardHintFormat(shortcut), tooltip, onClick };
}
