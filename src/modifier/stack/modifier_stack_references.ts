import { MODIFIER_STACK_CAP_KEYS } from './evaluate/modifier_stack_caps.js';
import type { ModifierStackSettings } from './modifier_stack_types.js';

/**
 * Rewrites the target ids a stack names, its exclusions and its cap pieces,
 * through an id map. Ids the map does not hold stay as they are.
 *
 * @param settings Stack changed in place.
 * @param targetIdByOld New target id per old target id.
 */
export function modifierStackReferencesRemap(
  settings: ModifierStackSettings,
  targetIdByOld: ReadonlyMap<string, string>,
): void {
  settings.excludedIds = settings.excludedIds.map((id) => targetIdByOld.get(id) ?? id);
  for (const step of settings.modifiers) {
    for (const key of MODIFIER_STACK_CAP_KEYS) {
      const value = step.parameters[key];
      if (typeof value === 'string') step.parameters[key] = targetIdByOld.get(value) ?? value;
    }
  }
}
