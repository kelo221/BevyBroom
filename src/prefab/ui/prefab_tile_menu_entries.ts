import { prefabEditorActionsActive } from '@/prefab/actions/prefab_editor_actions_active.js';
import type { ToolbarMenuEntry } from '@/ui/menu/menu_types.js';

/**
 * Builds the right-click menu of a prefab tile: Rename, Change Category, Delete
 * and Reveal File. Reveal File is enabled only for project prefabs.
 *
 * @param templateId Prefab id.
 * @returns Menu entries, or none when no prefab actions are active.
 */
export function prefabTileMenuEntriesCreate(templateId: string): ToolbarMenuEntry[] {
  const actions = prefabEditorActionsActive.read();
  if (actions === null) {
    return [];
  }
  return [
    { kind: 'action', label: 'Rename…', onClick: () => void actions.renameAsk(templateId) },
    { kind: 'action', label: 'Change Category…', onClick: () => void actions.categoryChangeAsk(templateId) },
    { kind: 'action', label: 'Delete', onClick: () => actions.remove(templateId) },
    { kind: 'separator' },
    {
      kind: 'action',
      label: 'Reveal File',
      onClick: () => void actions.reveal(templateId),
      isEnabled: () => actions.isRevealable(templateId),
    },
  ];
}
