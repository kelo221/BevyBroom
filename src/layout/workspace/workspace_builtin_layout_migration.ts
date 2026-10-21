import { createDefaultWorkspaces, WORKSPACE_IDS, type WorkspaceDefinition } from './workspace_definition.js';

/**
 * Revision of the built-in workspace layouts. Raise it whenever a built-in
 * layout changes so saved copies of that built-in are replaced once. Revision 1
 * arranges the quad as perspective and side on the left, top and front on the
 * right.
 */
export const WORKSPACE_BUILTIN_LAYOUT_REVISION = 1;

/** Built-in workspaces whose saved layout is replaced when the revision rises. */
const WORKSPACE_BUILTIN_IDS_MIGRATED: readonly string[] = [WORKSPACE_IDS.quad];

/**
 * Replaces the saved layout of migrated built-in workspaces with the current
 * built-in layout when the saved revision is older. Names, order and user
 * workspaces stay unchanged.
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
  const defaults = createDefaultWorkspaces();
  return workspaces.map((workspace) => workspaceBuiltinLayoutReplace(workspace, defaults));
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
