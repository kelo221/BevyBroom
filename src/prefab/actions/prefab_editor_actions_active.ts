import type { PrefabEditorActions } from '@/prefab/actions/prefab_editor_actions.js';
import { RegistryActiveSlot } from '@/utils/registry/registry_active_slot.js';

/**
 * Prefab actions of the open main window, used by the Add menu and the Edit
 * menu.
 */
export const prefabEditorActionsActive = new RegistryActiveSlot<PrefabEditorActions>();
