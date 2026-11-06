import { createDefaultWorkspaces, WORKSPACE_IDS, type WorkspaceDefinition } from './workspace_definition.js';
import { workspaceQuadBottomRowMigrate } from './workspace_builtin_quad_bottom_row_migration.js';

/**
 * Revision of the built-in workspace layouts. Raise it whenever a built-in
 * layout changes so saved copies of that built-in are migrated once. Revision 1
 * arranges the quad as two columns. Revision 2 orders the quad bottom row as
 * front on the left and side on the right.
 */
export const WORKSPACE_BUILTIN_LAYOUT_REVISION = 2;

/** Revision whose quad layouts are only reordered instead of replaced. */
const WORKSPACE_BUILTIN_REVISION_TWO_COLUMN_QUAD = 1;

/** Built-in workspaces whose saved layout is replaced when the revision rises. */
const WORKSPACE_BUILTIN_IDS_MIGRATED: readonly string[] = [WORKSPACE_IDS.quad];

/**
 * Migrates saved built-in workspaces written with an older revision. Layouts
 * older than the two-column quad are replaced by the current built-in layout;
 * two-column quads with side and front on the bottom row get them swapped.
 * Names, order and user workspaces stay unchanged.
 *
 * @param workspaces Saved workspaces.
 * @param savedRevision Revision stored with the workspaces; 0 when missing.
 * @returns Workspaces with migrated built-in layouts.
 */
export function workspaceBuiltinLayoutsMigrate(
  workspaces: WorkspaceDefinition[],
  savedRevision: number,
): WorkspaceDefinition[] {
  if (savedRevision >= WORKSPACE_BUILTIN_LAYOUT_REVISION) {
    return workspaces;
  }
  if (savedRevision >= WORKSPACE_BUILTIN_REVISION_TWO_COLUMN_QUAD) {
    return workspaces.map(workspaceBuiltinQuadBottomRowReorder);
  }
  const defaults = createDefaultWorkspaces();
  return workspaces.map((workspace) => workspaceBuiltinLayoutReplace(workspace, defaults));
}

/**
 * Returns the built-in quad workspace with its bottom row in front-then-side
 * order; other workspaces are returned unchanged.
 *
 * @param workspace Saved workspace.
 * @returns Workspace with a reordered quad layout, or the saved workspace.
 */
function workspaceBuiltinQuadBottomRowReorder(workspace: WorkspaceDefinition): WorkspaceDefinition {
  if (workspace.id !== WORKSPACE_IDS.quad) {
    return workspace;
  }
  return { ...workspace, layout: workspaceQuadBottomRowMigrate(workspace.layout) };
}

/**
 * Returns a workspace with its built-in layout when it is a migrated built-in.
 *
 * @param workspace Saved workspace.
 * @param defaults Current built-in workspaces.
 * @returns Workspace with the current layout, or the saved workspace.
 */
function workspaceBuiltinLayoutReplace(
  workspace: WorkspaceDefinition,
  defaults: readonly WorkspaceDefinition[],
): WorkspaceDefinition {
  if (!WORKSPACE_BUILTIN_IDS_MIGRATED.includes(workspace.id)) {
    return workspace;
  }
  const builtin = defaults.find((item) => item.id === workspace.id);
  return builtin ? { ...workspace, layout: builtin.layout } : workspace;
}
